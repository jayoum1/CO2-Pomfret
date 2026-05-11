"""
Validation rules for wide-format plot inventories.

Mirrors the rules the existing pipeline (``src/preprocessing/transform.py``)
implicitly enforces, but exposed as **pure functions** returning structured
results — no logging, no prints, no filesystem.

A "workbook" here is a mapping ``{ canonical_plot_name -> pandas.DataFrame }``
where each DataFrame is the raw wide table (one row per tree; DBH columns
have a year embedded in the header, e.g. ``"DBH - 2025"``).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Mapping, Optional, Tuple

import pandas as pd

CANONICAL_PLOTS: Tuple[str, ...] = ("Lower", "Middle", "Upper")
YEAR_PATTERN = re.compile(r"(20\d{2})")  # same as transform_plot

# Reasonable DBH bounds, in cm. Outside this range is flagged but not fatal.
MIN_PLAUSIBLE_DBH_CM = 0.5
MAX_PLAUSIBLE_DBH_CM = 250.0


# ---------------------------------------------------------------------------
# Result shapes
# ---------------------------------------------------------------------------


@dataclass
class Finding:
    """A single validation finding.

    severity: ``"error"`` (blocks publish), ``"warning"`` (allow), ``"info"``.
    """

    severity: str
    code: str
    message: str
    context: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class PlotValidationResult:
    plot: str
    rows: int
    id_column: Optional[str]
    species_column: Optional[str]
    dbh_year_columns: Dict[int, str]  # year -> column name
    findings: List[Finding] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return not any(f.severity == "error" for f in self.findings)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "plot": self.plot,
            "rows": self.rows,
            "id_column": self.id_column,
            "species_column": self.species_column,
            "dbh_year_columns": self.dbh_year_columns,
            "is_valid": self.is_valid,
            "findings": [f.to_dict() for f in self.findings],
        }


@dataclass
class WorkbookValidationResult:
    per_plot: Dict[str, PlotValidationResult]
    findings: List[Finding] = field(default_factory=list)  # cross-plot

    @property
    def is_valid(self) -> bool:
        if any(f.severity == "error" for f in self.findings):
            return False
        return all(r.is_valid for r in self.per_plot.values())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "per_plot": {k: v.to_dict() for k, v in self.per_plot.items()},
            "findings": [f.to_dict() for f in self.findings],
            "summary": self.summary(),
        }

    def summary(self) -> Dict[str, int]:
        n_err = sum(1 for f in self.findings if f.severity == "error")
        n_warn = sum(1 for f in self.findings if f.severity == "warning")
        for r in self.per_plot.values():
            n_err += sum(1 for f in r.findings if f.severity == "error")
            n_warn += sum(1 for f in r.findings if f.severity == "warning")
        return {
            "errors": n_err,
            "warnings": n_warn,
            "plots": len(self.per_plot),
        }


# ---------------------------------------------------------------------------
# Public functions
# ---------------------------------------------------------------------------


def detect_id_column(columns: List[str]) -> Optional[str]:
    """Find the Tree ID column, matching ``transform_plot``'s heuristic."""
    for c in columns:
        lc = c.lower()
        if "tree" in lc and "id" in lc:
            return c
    return None


def detect_species_column(columns: List[str]) -> Optional[str]:
    for c in columns:
        if "species" in c.lower():
            return c
    return None


def detect_dbh_year_columns(columns: List[str]) -> Dict[int, str]:
    """Return ``{year: column_name}`` for every column with a 20xx year."""
    year_map: Dict[int, str] = {}
    for c in columns:
        if "dbh" not in c.lower():
            continue
        m = YEAR_PATTERN.search(c)
        if m:
            year_map[int(m.group(1))] = c
    return year_map


def normalize_tree_id(value: Any) -> str:
    """Normalize a tree id cell into the canonical string used downstream.

    Google Sheets often delivers integer ids as ``"1.0"``; this strips the
    trailing zero while preserving non-numeric forms like ``"416 (was 683)"``.
    """
    if value is None:
        return ""
    s = str(value).strip()
    if s == "" or s.lower() == "nan":
        return ""
    # Strip pandas-injected ".0" on otherwise-integer ids.
    if re.fullmatch(r"-?\d+\.0+", s):
        s = s.split(".")[0]
    return s


def validate_plot(df: pd.DataFrame, plot: str) -> PlotValidationResult:
    """Validate a single plot's wide DataFrame."""
    cols = list(df.columns)
    id_col = detect_id_column(cols)
    species_col = detect_species_column(cols)
    year_cols = detect_dbh_year_columns(cols)

    result = PlotValidationResult(
        plot=plot,
        rows=int(len(df)),
        id_column=id_col,
        species_column=species_col,
        dbh_year_columns=year_cols,
    )

    if id_col is None:
        result.findings.append(
            Finding(
                severity="error",
                code="missing_id_column",
                message="No Tree ID column found (header must contain 'tree' and 'id').",
            )
        )
    if species_col is None:
        result.findings.append(
            Finding(
                severity="error",
                code="missing_species_column",
                message="No Species column found (header must contain 'species').",
            )
        )
    if not year_cols:
        result.findings.append(
            Finding(
                severity="error",
                code="missing_dbh_year_columns",
                message="No DBH columns with a 4-digit 20xx year found "
                "(e.g. 'DBH - 2025').",
            )
        )

    # Empty workbook is a warning, not an error.
    if len(df) == 0:
        result.findings.append(
            Finding(
                severity="warning",
                code="empty_sheet",
                message="Plot tab is empty.",
            )
        )

    if id_col is not None:
        ids = df[id_col].map(normalize_tree_id)
        blank = ids.eq("").sum()
        if blank:
            result.findings.append(
                Finding(
                    severity="error",
                    code="blank_tree_ids",
                    message=f"{int(blank)} row(s) have a blank Tree ID.",
                    context={"count": int(blank)},
                )
            )
        dup_mask = ids.duplicated(keep=False) & ids.ne("")
        if dup_mask.any():
            dups = sorted(set(ids[dup_mask].tolist()))
            result.findings.append(
                Finding(
                    severity="error",
                    code="duplicate_tree_ids_within_plot",
                    message=f"{len(dups)} Tree ID(s) duplicated within plot.",
                    context={"sample": dups[:10], "count": len(dups)},
                )
            )

    if year_cols:
        for year, col in year_cols.items():
            if not (1900 <= year <= 2100):
                result.findings.append(
                    Finding(
                        severity="warning",
                        code="year_out_of_range",
                        message=f"Column '{col}' has implausible year {year}.",
                        context={"column": col, "year": year},
                    )
                )
            series = pd.to_numeric(df[col], errors="coerce")
            non_numeric = df[col].notna() & series.isna()
            if non_numeric.any():
                bad_values = (
                    df.loc[non_numeric, col].astype(str).unique().tolist()[:5]
                )
                result.findings.append(
                    Finding(
                        severity="warning",
                        code="non_numeric_dbh",
                        message=(
                            f"Column '{col}' has {int(non_numeric.sum())} "
                            f"non-numeric DBH value(s) that will be dropped."
                        ),
                        context={"column": col, "sample": bad_values},
                    )
                )
            out_of_range = series[
                series.notna()
                & ((series < MIN_PLAUSIBLE_DBH_CM) | (series > MAX_PLAUSIBLE_DBH_CM))
            ]
            if not out_of_range.empty:
                result.findings.append(
                    Finding(
                        severity="warning",
                        code="dbh_out_of_range",
                        message=(
                            f"Column '{col}' has {len(out_of_range)} DBH value(s) "
                            f"outside [{MIN_PLAUSIBLE_DBH_CM}, "
                            f"{MAX_PLAUSIBLE_DBH_CM}] cm."
                        ),
                        context={
                            "column": col,
                            "count": int(len(out_of_range)),
                            "min": float(out_of_range.min()),
                            "max": float(out_of_range.max()),
                        },
                    )
                )

    return result


def validate_workbook(
    workbook: Mapping[str, pd.DataFrame],
) -> WorkbookValidationResult:
    """Validate a multi-plot workbook.

    ``workbook`` keys must be canonical plot names; unknown keys are flagged
    as errors. Missing canonical plots are warnings (a partial workbook can
    still be previewed).
    """
    per_plot: Dict[str, PlotValidationResult] = {}
    cross: List[Finding] = []

    unknown = sorted(set(workbook.keys()) - set(CANONICAL_PLOTS))
    if unknown:
        cross.append(
            Finding(
                severity="error",
                code="unknown_plot_keys",
                message=(
                    f"Workbook contains non-canonical plot keys: {unknown}. "
                    f"Expected one of {list(CANONICAL_PLOTS)}."
                ),
                context={"keys": unknown},
            )
        )

    missing = [p for p in CANONICAL_PLOTS if p not in workbook]
    if missing:
        cross.append(
            Finding(
                severity="warning",
                code="missing_plots",
                message=f"Workbook is missing plots: {missing}.",
                context={"missing": missing},
            )
        )

    for plot, df in workbook.items():
        per_plot[plot] = validate_plot(df, plot)

    # Cross-plot duplicate Tree IDs are not necessarily errors (the existing
    # combined dataset uses (Plot, TreeID) as the key), but they are worth
    # surfacing so a teacher notices accidental copy/paste between tabs.
    cross_ids: Dict[str, List[str]] = {}
    for plot, df in workbook.items():
        id_col = per_plot[plot].id_column
        if id_col is None:
            continue
        for raw in df[id_col].map(normalize_tree_id).tolist():
            if not raw:
                continue
            cross_ids.setdefault(raw, []).append(plot)
    cross_dups = {
        tid: plots for tid, plots in cross_ids.items() if len(set(plots)) > 1
    }
    if cross_dups:
        sample = list(cross_dups.items())[:5]
        cross.append(
            Finding(
                severity="warning",
                code="tree_id_appears_in_multiple_plots",
                message=(
                    f"{len(cross_dups)} Tree ID(s) appear in more than one "
                    "plot. Verify this is intentional."
                ),
                context={"count": len(cross_dups), "sample": sample},
            )
        )

    return WorkbookValidationResult(per_plot=per_plot, findings=cross)
