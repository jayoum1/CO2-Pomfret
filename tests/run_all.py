"""Zero-dependency test runner.

Usage::

    python tests/run_all.py

Used because the repo doesn't currently ship pytest. The same files also run
under pytest if it's installed: ``pytest tests/``.
"""

from __future__ import annotations

import importlib
import sys
import traceback
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = REPO_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

TEST_MODULES = [
    "tests.test_validate_inventory",
    "tests.test_diff_inventory",
    "tests.test_process_inventory",
]


def main() -> int:
    failed = 0
    for mod_name in TEST_MODULES:
        print(f"\n== {mod_name} ==")
        mod = importlib.import_module(mod_name)
        for name in dir(mod):
            if not name.startswith("test_"):
                continue
            fn = getattr(mod, name)
            if not callable(fn):
                continue
            try:
                fn()
                print(f"  ok  {name}")
            except Exception:  # noqa: BLE001
                failed += 1
                print(f"  FAIL {name}")
                traceback.print_exc()
    if failed:
        print(f"\n{failed} test(s) failed.")
        return 1
    print("\nAll tests passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
