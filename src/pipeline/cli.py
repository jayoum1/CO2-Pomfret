"""
Local CLI for the Sheets preview/publish pipeline.

Designed for **operator debugging**, not for production scheduling. The
admin HTTP routes are the primary interface; this CLI just wraps the
same service functions so you can run them without booting FastAPI.

Examples
--------
::

    # Preview (no changes to canonical data)
    python -m pipeline.cli preview

    # Manual publish (rebuilds processed data + snapshots)
    python -m pipeline.cli publish

    # List published revisions (newest first)
    python -m pipeline.cli revisions

    # Show the currently-active revision
    python -m pipeline.cli current

Environment variables (see ``docs/google_sheets_preview_pipeline.md``):

* ``CO2_SHEETS_SPREADSHEET_ID``    (required)
* ``CO2_SHEETS_TAB_LOWER`` / ``_MIDDLE`` / ``_UPPER``
* ``CO2_SHEETS_PUBLIC_CSV`` (``"1"`` to skip service-account auth)
* ``CO2_SHEETS_CREDENTIALS_FILE`` or ``CO2_SHEETS_CREDENTIALS_JSON``
* ``CO2_ADMIN_TOKEN`` (not consumed by the CLI, but reminds operators
  that the same workflow is admin-only via HTTP)
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict


_SRC = Path(__file__).resolve().parent.parent
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))


def _print_json(payload: Any) -> None:
    print(json.dumps(payload, indent=2, default=str))


def _cmd_preview(args: argparse.Namespace) -> int:
    from pipeline.diff_inventory import compute_workbook_diff, load_current_workbook
    from pipeline.sheets_reader import (
        SheetsConfig,
        SheetsConfigError,
        SheetsFetchError,
        normalize_workbook_ids,
        read_workbook,
    )
    from pipeline.staging import write_preview_payload, write_staging_workbook
    from pipeline.validate_inventory import validate_workbook

    try:
        config = SheetsConfig.from_env()
        workbook = read_workbook(config)
    except (SheetsConfigError, SheetsFetchError) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1

    workbook = normalize_workbook_ids(workbook)
    validation = validate_workbook(workbook)
    current = load_current_workbook()
    diff = compute_workbook_diff(workbook, current)

    staged = write_staging_workbook(
        workbook,
        source=config.source_metadata(),
        validation_summary=validation.summary(),
    )
    revision_id = staged["revision_id"]
    payload = {
        "revision_id": revision_id,
        "source": config.source_metadata(),
        "validation": validation.to_dict(),
        "diff": diff.to_dict(),
        "manifest": staged["manifest"],
    }
    write_preview_payload(revision_id, payload)
    _print_json(
        {
            "revision_id": revision_id,
            "valid": validation.is_valid,
            "validation_summary": validation.summary(),
            "diff_headline": diff.overall_summary().get("headline"),
        }
    )
    return 0 if validation.is_valid else 2


def _cmd_publish(args: argparse.Namespace) -> int:
    from pipeline.publish import PublishError, PublishOptions, publish_sheet_sync

    options = PublishOptions(include_nn_epsilon=args.include_nn_epsilon)
    cache_clearer = None
    if args.clear_caches:
        try:
            from api.app import clear_runtime_caches  # type: ignore

            cache_clearer = clear_runtime_caches
        except Exception as e:  # noqa: BLE001
            print(
                f"WARN: could not import api.app.clear_runtime_caches ({e}); "
                "publish will skip in-process cache invalidation.",
                file=sys.stderr,
            )

    try:
        manifest = publish_sheet_sync(options, cache_clearer=cache_clearer)
    except PublishError as e:
        print(f"ERROR: publish failed: {e}", file=sys.stderr)
        if e.detail:
            print(json.dumps(e.detail, indent=2, default=str), file=sys.stderr)
        return 3

    summary: Dict[str, Any] = {
        "revision_id": manifest.get("revision_id"),
        "status": manifest.get("status"),
        "published_at": manifest.get("published_at"),
        "tree_change_summary": manifest.get("tree_change_summary"),
        "promoted_file_count": len(manifest.get("promoted_files", [])),
        "cache_cleared": manifest.get("cache_cleared"),
    }
    _print_json(summary)
    return 0


def _cmd_revisions(args: argparse.Namespace) -> int:
    from pipeline.publish import list_revisions_summary

    _print_json(list_revisions_summary())
    return 0


def _cmd_current(args: argparse.Namespace) -> int:
    from pipeline.publish import current_revision_summary

    _print_json(current_revision_summary())
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="pipeline.cli",
        description="Preview / publish the CO2 Pomfret Google Sheets dataset.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("preview", help="Fetch & stage; do not touch canonical data.")

    pub = sub.add_parser(
        "publish",
        help="Run the full publish pipeline (rebuilds processed data + snapshots).",
    )
    pub.add_argument(
        "--include-nn-epsilon",
        action="store_true",
        help="Also regenerate the legacy NN epsilon snapshot directory (slower).",
    )
    pub.add_argument(
        "--no-clear-caches",
        dest="clear_caches",
        action="store_false",
        help="Skip invoking api.app.clear_runtime_caches after promote.",
    )
    pub.set_defaults(clear_caches=True)

    sub.add_parser("revisions", help="List all published revisions (newest first).")
    sub.add_parser("current", help="Show the currently-active revision summary.")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    handlers = {
        "preview": _cmd_preview,
        "publish": _cmd_publish,
        "revisions": _cmd_revisions,
        "current": _cmd_current,
    }
    handler = handlers[args.command]
    return handler(args)


if __name__ == "__main__":
    raise SystemExit(main())
