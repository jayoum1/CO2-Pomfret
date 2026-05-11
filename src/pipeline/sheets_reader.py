"""
Google Sheets / public-CSV reader for the data pipeline.

Two modes are supported in Phase 1, both controlled by environment variables
so the FastAPI route can stay thin (it only calls :func:`read_workbook`).

Service-account mode (preferred)
--------------------------------
- ``CO2_SHEETS_SPREADSHEET_ID``    Required.
- ``CO2_SHEETS_CREDENTIALS_FILE``  Path to a service-account JSON key
  *or*
- ``CO2_SHEETS_CREDENTIALS_JSON``  Service-account JSON pasted into env.
- Requires the optional dependencies ``gspread`` and ``google-auth``
  (see ``docs/google_sheets_preview_pipeline.md``).

Public-CSV fallback mode (no auth required)
-------------------------------------------
- ``CO2_SHEETS_SPREADSHEET_ID``    Required.
- ``CO2_SHEETS_PUBLIC_CSV=true``   Activates this mode.
- The spreadsheet must be shared with "Anyone with the link can view".
- Uses ``https://docs.google.com/spreadsheets/d/<id>/gviz/tq?tqx=out:csv&sheet=<tab>``.
- Useful for local testing and for classroom workflows where setting up a
  service account is overkill.

Tab names
---------
- ``CO2_SHEETS_TAB_LOWER`` (default ``"Lower"``)
- ``CO2_SHEETS_TAB_MIDDLE`` (default ``"Middle"``)
- ``CO2_SHEETS_TAB_UPPER`` (default ``"Upper"``)
"""

from __future__ import annotations

import io
import json
import os
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import pandas as pd

from .validate_inventory import CANONICAL_PLOTS, normalize_tree_id

DEFAULT_TAB_NAMES: Dict[str, str] = {
    "Lower": "Lower",
    "Middle": "Middle",
    "Upper": "Upper",
}


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------


@dataclass
class SheetsConfig:
    spreadsheet_id: str
    tab_names: Dict[str, str] = field(
        default_factory=lambda: dict(DEFAULT_TAB_NAMES)
    )
    credentials_file: Optional[str] = None
    credentials_json: Optional[str] = None
    public_csv: bool = False

    @classmethod
    def from_env(cls, overrides: Optional[Dict[str, Any]] = None) -> "SheetsConfig":
        ov = overrides or {}
        sid = ov.get("spreadsheet_id") or os.environ.get("CO2_SHEETS_SPREADSHEET_ID")
        if not sid:
            raise SheetsConfigError(
                "CO2_SHEETS_SPREADSHEET_ID is not set "
                "(and no spreadsheet_id override was provided)."
            )
        tab_names = dict(DEFAULT_TAB_NAMES)
        for plot in CANONICAL_PLOTS:
            env_key = f"CO2_SHEETS_TAB_{plot.upper()}"
            tab_names[plot] = (
                (ov.get("tabs") or {}).get(plot)
                or os.environ.get(env_key)
                or tab_names[plot]
            )
        public_csv = bool(
            ov.get("public_csv")
            or os.environ.get("CO2_SHEETS_PUBLIC_CSV", "").lower() in {"1", "true", "yes"}
        )
        return cls(
            spreadsheet_id=sid,
            tab_names=tab_names,
            credentials_file=os.environ.get("CO2_SHEETS_CREDENTIALS_FILE"),
            credentials_json=os.environ.get("CO2_SHEETS_CREDENTIALS_JSON"),
            public_csv=public_csv,
        )

    def source_metadata(self) -> Dict[str, Any]:
        return {
            "spreadsheet_id": self.spreadsheet_id,
            "tab_names": self.tab_names,
            "mode": "public_csv" if self.public_csv else "service_account",
        }


class SheetsConfigError(RuntimeError):
    """Raised when the Sheets configuration is missing or invalid."""


class SheetsFetchError(RuntimeError):
    """Raised when reading from Google fails for a specific tab."""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def read_workbook(config: SheetsConfig) -> Dict[str, pd.DataFrame]:
    """Return ``{ canonical_plot: wide DataFrame }`` for each readable tab.

    Tabs that fail to load raise :class:`SheetsFetchError` — the route layer
    can catch and surface partial workbooks if it chooses. We deliberately
    don't swallow errors silently here.
    """
    if config.public_csv:
        return _read_via_public_csv(config)
    return _read_via_gspread(config)


# ---------------------------------------------------------------------------
# Service-account / gspread mode
# ---------------------------------------------------------------------------


def _read_via_gspread(config: SheetsConfig) -> Dict[str, pd.DataFrame]:
    try:
        import gspread  # type: ignore
        from google.oauth2.service_account import Credentials  # type: ignore
    except ImportError as e:  # pragma: no cover - dependency guard
        raise SheetsConfigError(
            "Service-account mode requires 'gspread' and 'google-auth'. "
            "Install with: pip install gspread google-auth"
        ) from e

    scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    creds = _load_service_account_credentials(config, scopes, Credentials)
    client = gspread.authorize(creds)
    sh = client.open_by_key(config.spreadsheet_id)

    workbook: Dict[str, pd.DataFrame] = {}
    for plot in CANONICAL_PLOTS:
        tab = config.tab_names.get(plot, plot)
        try:
            ws = sh.worksheet(tab)
            rows = ws.get_all_values()
        except Exception as e:  # noqa: BLE001
            raise SheetsFetchError(
                f"Failed to read tab '{tab}' (plot {plot}): {e}"
            ) from e
        workbook[plot] = _rows_to_dataframe(rows)
    return workbook


def _load_service_account_credentials(
    config: SheetsConfig,
    scopes: List[str],
    Credentials: Any,
) -> Any:
    if config.credentials_json:
        info = json.loads(config.credentials_json)
        return Credentials.from_service_account_info(info, scopes=scopes)
    if config.credentials_file:
        return Credentials.from_service_account_file(
            config.credentials_file, scopes=scopes
        )
    raise SheetsConfigError(
        "Service-account mode requires either CO2_SHEETS_CREDENTIALS_FILE "
        "or CO2_SHEETS_CREDENTIALS_JSON to be set."
    )


def _rows_to_dataframe(rows: List[List[str]]) -> pd.DataFrame:
    """Convert the matrix returned by ``ws.get_all_values()`` into a DF.

    Treats the first row as the header. Empty cells become NaN. Type drift
    is handled downstream (validation uses ``pd.to_numeric(errors="coerce")``,
    diff uses ``normalize_tree_id``).
    """
    if not rows:
        return pd.DataFrame()
    header = [c.strip() for c in rows[0]]
    body = rows[1:]
    df = pd.DataFrame(body, columns=header)
    df = df.replace({"": pd.NA})
    # Drop fully-blank trailing rows that Sheets sometimes emits.
    df = df.dropna(how="all")
    return df


# ---------------------------------------------------------------------------
# Public-CSV fallback mode
# ---------------------------------------------------------------------------


def _read_via_public_csv(config: SheetsConfig) -> Dict[str, pd.DataFrame]:
    workbook: Dict[str, pd.DataFrame] = {}
    for plot in CANONICAL_PLOTS:
        tab = config.tab_names.get(plot, plot)
        url = _public_csv_url(config.spreadsheet_id, tab)
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:  # noqa: S310
                body = resp.read().decode("utf-8")
        except Exception as e:  # noqa: BLE001
            raise SheetsFetchError(
                f"Failed to fetch public CSV for tab '{tab}' (plot {plot}): {e}"
            ) from e
        try:
            df = pd.read_csv(io.StringIO(body))
        except Exception as e:  # noqa: BLE001
            raise SheetsFetchError(
                f"Failed to parse CSV for tab '{tab}' (plot {plot}): {e}"
            ) from e
        workbook[plot] = df
    return workbook


def _public_csv_url(spreadsheet_id: str, tab: str) -> str:
    return (
        f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}"
        f"/gviz/tq?tqx=out:csv&sheet={urllib.parse.quote(tab)}"
    )


# ---------------------------------------------------------------------------
# Light post-read normalization
# ---------------------------------------------------------------------------


def normalize_workbook_ids(
    workbook: Dict[str, pd.DataFrame],
) -> Dict[str, pd.DataFrame]:
    """Cast detected Tree ID columns to canonical string form.

    Sheets often returns integer ids as ``"1.0"`` and other surprises. This
    keeps the staged CSVs human-readable.
    """
    from .validate_inventory import detect_id_column

    normalized: Dict[str, pd.DataFrame] = {}
    for plot, df in workbook.items():
        if df is None or df.empty:
            normalized[plot] = df
            continue
        id_col = detect_id_column(list(df.columns))
        if id_col is None:
            normalized[plot] = df
            continue
        df = df.copy()
        df[id_col] = df[id_col].map(normalize_tree_id)
        normalized[plot] = df
    return normalized
