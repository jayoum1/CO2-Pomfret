"""Zero-dependency test runner.

Usage::

    python tests/run_all.py

Used because the repo doesn't currently ship pytest. The same files also run
under pytest if it's installed: ``pytest tests/``.

The runner provides minimal pytest-compatible shims for the two fixtures used
in this repo — ``tmp_path`` and ``monkeypatch`` — so tests written against
the standard pytest signature run unchanged.
"""

from __future__ import annotations

import importlib
import inspect
import sys
import tempfile
import traceback
from pathlib import Path
from typing import Any, List, Tuple

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
    "tests.test_admin_auth",
    "tests.test_publish_audit",
]


class _Monkeypatch:
    """Minimal subset of pytest's ``monkeypatch`` fixture.

    Supports ``setattr("pkg.module.NAME", value)`` and undoes everything when
    ``undo()`` is called by the runner at end-of-test.
    """

    def __init__(self) -> None:
        self._undo: List[Tuple[Any, str, Any]] = []

    def setattr(self, target: str, value: Any) -> None:
        mod_name, _, attr = target.rpartition(".")
        mod = importlib.import_module(mod_name)
        original = getattr(mod, attr)
        self._undo.append((mod, attr, original))
        setattr(mod, attr, value)

    def undo(self) -> None:
        for mod, attr, original in reversed(self._undo):
            setattr(mod, attr, original)
        self._undo.clear()


def _invoke(fn) -> None:
    sig = inspect.signature(fn)
    kwargs: dict = {}
    tmp_ctx = None
    mp: _Monkeypatch | None = None
    if "tmp_path" in sig.parameters:
        tmp_ctx = tempfile.TemporaryDirectory()
        kwargs["tmp_path"] = Path(tmp_ctx.__enter__())
    if "monkeypatch" in sig.parameters:
        mp = _Monkeypatch()
        kwargs["monkeypatch"] = mp
    try:
        fn(**kwargs)
    finally:
        if mp is not None:
            mp.undo()
        if tmp_ctx is not None:
            tmp_ctx.__exit__(None, None, None)


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
                _invoke(fn)
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
