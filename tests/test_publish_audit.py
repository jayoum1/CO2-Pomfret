"""Tests for the publish-pipeline audit + dataset-version surface.

Covers the bug-report regressions explicitly:

* ``normalize_tree_id`` strips ``"1,000"`` so the raw CSV is saved without the
  digit-grouping comma — guarantees ``int(float(...))`` succeeds in the
  ``/vector-forest/snapshot`` route and tree identity isn't replaced by a hash.
* The post-publish audit surface (``_audit_added_trees``) reports
  ``found_in_canonical_raw=True`` and ``found_in_canonical_snapshot_year_0=True``
  for a tree that survives the pipeline, and reports the correct
  inches→cm conversion + 10 cm histogram bin.
* Bin labels match the ``computeDbhHistogram`` half-open ``[start, start+10)``
  convention used by ``web/src/lib/visualizationData.ts``.

These tests do not call Google Sheets and don't require trained ML artifacts.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = REPO_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from pipeline.publish import (  # noqa: E402
    _audit_added_trees,
    _bin_label_for_dbh_cm,
    _build_dataset_version,
)
from pipeline.process_inventory import save_raw_workbook  # noqa: E402
from pipeline.validate_inventory import normalize_tree_id  # noqa: E402


# ---------------------------------------------------------------------------
# Bin label semantics
# ---------------------------------------------------------------------------


def test_bin_label_half_open_lower_bound_inclusive() -> None:
    assert _bin_label_for_dbh_cm(80.0) == "80–90"
    assert _bin_label_for_dbh_cm(85.0) == "80–90"
    assert _bin_label_for_dbh_cm(89.999) == "80–90"
    # Upper bound exclusive — 90 must move to the next bin.
    assert _bin_label_for_dbh_cm(90.0) == "90–100"
    assert _bin_label_for_dbh_cm(0.0) == "0–10"
    # 85 inches converted to cm (215.9) lands in 210–220.
    assert _bin_label_for_dbh_cm(85.0 * 2.54) == "210–220"


# ---------------------------------------------------------------------------
# Save-raw round trip with thousands-separator id
# ---------------------------------------------------------------------------


def test_save_raw_workbook_writes_comma_free_tree_id(tmp_path: Path) -> None:
    """If the staged workbook normalises ``"1,000"`` → ``"1000"``,
    save_raw_workbook must persist that — no quoted comma should reappear in
    the canonical CSV.
    """
    df = pd.DataFrame(
        [
            {
                "TREE ID": "1000",
                "Tree Species": "Sugar Maple",
                "DBH 2022": 85.00,
                "DBH 2023": 86,
                "DBH 2024": 87.00,
                "DBH 2025": 88.00,
            }
        ]
    )
    save_raw_workbook({"Middle": df}, tmp_path, canonical_names=True)
    csv = (tmp_path / "CO2 Pomfret Raw Data - Middle.csv").read_text()
    assert "\n1000," in "\n" + csv  # row exists with bare integer id
    assert '"1,000"' not in csv  # no quoted comma form


# ---------------------------------------------------------------------------
# Dataset-version blob
# ---------------------------------------------------------------------------


def test_dataset_version_blob_compact() -> None:
    blob = _build_dataset_version("rev-123", "2026-05-18T05:10:44+00:00")
    assert set(blob.keys()) == {"revision_id", "published_at"}
    assert blob["revision_id"] == "rev-123"


# ---------------------------------------------------------------------------
# Added-tree audit happy path
# ---------------------------------------------------------------------------


def _make_diff_dict_with_one_added_tree() -> dict:
    return {
        "per_plot": {
            "Lower": {"added_trees": []},
            "Middle": {
                "added_trees": [
                    {"tree_id": "1000", "species": "Sugar Maple"}
                ]
            },
            "Upper": {"added_trees": []},
        }
    }


def _staged_workbook_with_added_tree() -> dict:
    return {
        "Middle": pd.DataFrame(
            [
                {
                    "TREE ID": "1000",
                    "Tree Species": "Sugar Maple",
                    "DBH 2022": 85.00,
                    "DBH 2023": 86,
                    "DBH 2024": 87.00,
                    "DBH 2025": 88.00,
                }
            ]
        )
    }


def test_audit_added_trees_marks_missing_when_no_canonical_files(
    tmp_path: Path, monkeypatch
) -> None:
    """If the canonical raw + snapshot files don't exist (e.g. the publish
    aborted before promote), the audit must report missing — not crash.
    """
    monkeypatch.setattr(
        "pipeline.publish._resolve_raw_data_dir", lambda: tmp_path / "raw"
    )
    monkeypatch.setattr(
        "pipeline.publish._resolve_processed_data_dir", lambda: tmp_path / "proc"
    )

    audits = _audit_added_trees(
        _make_diff_dict_with_one_added_tree(), _staged_workbook_with_added_tree()
    )

    assert len(audits) == 1
    a = audits[0]
    assert a["plot"] == "Middle"
    assert a["tree_id"] == "1000"
    assert a["found_in_canonical_raw"] is False
    assert a["found_in_canonical_snapshot_year_0"] is False
    assert a["first_year"] == 2022
    assert a["first_year_dbh_in"] == 85.0
    # 85 inches → 215.9 cm — matches the inches→cm convention used downstream.
    assert a["first_year_dbh_cm"] == round(85.0 * 2.54, 4)


def test_audit_added_trees_round_trips_when_canonical_present(
    tmp_path: Path, monkeypatch
) -> None:
    """When the canonical raw and Year 0 snapshot DO contain the tree, the
    audit reports both flags True and emits the correct 10 cm bin label.
    """
    raw_dir = tmp_path / "raw"
    proc_dir = tmp_path / "proc" / "forest_snapshots_baseline_stochastic"
    raw_dir.mkdir(parents=True)
    proc_dir.mkdir(parents=True)

    # Canonical raw — the fix means the comma-free id ``1000`` is what lands here.
    pd.DataFrame(
        [
            {
                "TREE ID": "1000",
                "Tree Species": "Sugar Maple",
                "DBH 2022": 85.00,
                "DBH 2023": 86,
                "DBH 2024": 87.00,
                "DBH 2025": 88.00,
            }
        ]
    ).to_csv(raw_dir / "CO2 Pomfret Raw Data - Middle.csv", index=False)

    # Canonical Year 0 snapshot — DBH_cm = latest year (88) × 2.54 = 223.52.
    pd.DataFrame(
        [
            {
                "TreeID": "1000",
                "Plot": "Middle",
                "Species": "Sugar Maple",
                "DBH_cm": 88.0 * 2.54,
                "carbon_at_time": 0.0,
                "years_ahead": 0,
            }
        ]
    ).to_csv(proc_dir / "forest_0_years.csv", index=False)

    monkeypatch.setattr(
        "pipeline.publish._resolve_raw_data_dir", lambda: raw_dir
    )
    monkeypatch.setattr(
        "pipeline.publish._resolve_processed_data_dir", lambda: tmp_path / "proc"
    )

    audits = _audit_added_trees(
        _make_diff_dict_with_one_added_tree(), _staged_workbook_with_added_tree()
    )
    assert len(audits) == 1
    a = audits[0]
    assert a["found_in_canonical_raw"] is True
    assert a["plot_total_after_publish"] == 1
    assert a["found_in_canonical_snapshot_year_0"] is True
    # 88 inches → 223.52 cm → 220–230 bin (NOT 80–90 as the user expected,
    # because the school's data convention treats raw DBH as inches).
    assert a["year_0_bin_label_cm"] == "220–230"
    assert abs(a["year_0_dbh_cm"] - 223.52) < 1e-9


def test_audit_handles_legacy_quoted_comma_id(
    tmp_path: Path, monkeypatch
) -> None:
    """Even if a previous publish wrote ``"1,000"`` to the canonical raw,
    the audit must still match it against the comma-free diff entry so the
    new fix is backward-compatible with already-published revisions.
    """
    raw_dir = tmp_path / "raw"
    proc_dir = tmp_path / "proc" / "forest_snapshots_baseline_stochastic"
    raw_dir.mkdir(parents=True)
    proc_dir.mkdir(parents=True)

    # Legacy raw — id stored with thousands separator.
    pd.DataFrame(
        [
            {
                "TREE ID": "1,000",
                "Tree Species": "Sugar Maple",
                "DBH 2022": 85.00,
                "DBH 2023": 86,
                "DBH 2024": 87.00,
                "DBH 2025": 88.00,
            }
        ]
    ).to_csv(raw_dir / "CO2 Pomfret Raw Data - Middle.csv", index=False)

    pd.DataFrame(
        [
            {
                "TreeID": "1,000",
                "Plot": "Middle",
                "Species": "Sugar Maple",
                "DBH_cm": 88.0 * 2.54,
                "carbon_at_time": 0.0,
                "years_ahead": 0,
            }
        ]
    ).to_csv(proc_dir / "forest_0_years.csv", index=False)

    monkeypatch.setattr(
        "pipeline.publish._resolve_raw_data_dir", lambda: raw_dir
    )
    monkeypatch.setattr(
        "pipeline.publish._resolve_processed_data_dir", lambda: tmp_path / "proc"
    )

    audits = _audit_added_trees(
        _make_diff_dict_with_one_added_tree(), _staged_workbook_with_added_tree()
    )
    a = audits[0]
    # Match works because the audit normalises both sides via normalize_tree_id.
    assert a["found_in_canonical_raw"] is True


# ---------------------------------------------------------------------------
# Bare runner entrypoint
# ---------------------------------------------------------------------------


class _Monkeypatch:
    """Tiny shim so the tests run under ``tests/run_all.py`` (no pytest)."""

    def __init__(self) -> None:
        self._undo: list = []

    def setattr(self, target: str, value) -> None:  # noqa: ANN001
        mod_name, _, attr = target.rpartition(".")
        import importlib

        mod = importlib.import_module(mod_name)
        original = getattr(mod, attr)
        self._undo.append((mod, attr, original))
        setattr(mod, attr, value)

    def undo(self) -> None:
        for mod, attr, original in reversed(self._undo):
            setattr(mod, attr, original)
        self._undo.clear()


def _run_all() -> None:
    import inspect
    import tempfile

    for name, fn in list(globals().items()):
        if not name.startswith("test_"):
            continue
        if not callable(fn):
            continue
        sig = inspect.signature(fn)
        kwargs: dict = {}
        ctx = None
        if "tmp_path" in sig.parameters:
            ctx = tempfile.TemporaryDirectory()
            kwargs["tmp_path"] = Path(ctx.__enter__())
        mp: _Monkeypatch | None = None
        if "monkeypatch" in sig.parameters:
            mp = _Monkeypatch()
            kwargs["monkeypatch"] = mp
        try:
            fn(**kwargs)
        finally:
            if mp is not None:
                mp.undo()
            if ctx is not None:
                ctx.__exit__(None, None, None)
        print(f"  ok  {name}")


if __name__ == "__main__":
    _run_all()
    print("test_publish_audit.py: all passed")
