"""Tests for admin route token dependency and local auth bypass."""

from __future__ import annotations

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = REPO_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))


_ENV_KEYS = ("CO2_ADMIN_TOKEN", "CO2_DISABLE_ADMIN_AUTH")


def _snapshot(keys: tuple[str, ...]) -> dict[str, str | None]:
    return {k: os.environ.get(k) for k in keys}


def _restore(snapshot: dict[str, str | None]) -> None:
    for k, v in snapshot.items():
        if v is None:
            os.environ.pop(k, None)
        else:
            os.environ[k] = v


def test_require_token_missing_when_auth_enabled_401():
    snap = _snapshot(_ENV_KEYS)
    try:
        os.environ["CO2_ADMIN_TOKEN"] = "secret"
        os.environ.pop("CO2_DISABLE_ADMIN_AUTH", None)
        from fastapi import HTTPException

        from api.admin_routes import require_admin_token

        try:
            require_admin_token(x_admin_token=None)
            assert False, "expected HTTPException"
        except HTTPException as e:
            assert e.status_code == 401
    finally:
        _restore(snap)


def test_require_token_wrong_when_auth_enabled_401():
    snap = _snapshot(_ENV_KEYS)
    try:
        os.environ["CO2_ADMIN_TOKEN"] = "correct"
        os.environ.pop("CO2_DISABLE_ADMIN_AUTH", None)
        from fastapi import HTTPException

        from api.admin_routes import require_admin_token

        try:
            require_admin_token(x_admin_token="wrong")
            assert False, "expected HTTPException"
        except HTTPException as e:
            assert e.status_code == 401
    finally:
        _restore(snap)


def test_require_token_correct_when_auth_enabled_ok():
    snap = _snapshot(_ENV_KEYS)
    try:
        os.environ["CO2_ADMIN_TOKEN"] = "good-token"
        os.environ.pop("CO2_DISABLE_ADMIN_AUTH", None)
        from api.admin_routes import require_admin_token

        require_admin_token(x_admin_token="good-token")
    finally:
        _restore(snap)


def test_require_token_disabled_without_server_token_ok():
    snap = _snapshot(_ENV_KEYS)
    try:
        os.environ["CO2_DISABLE_ADMIN_AUTH"] = "true"
        os.environ.pop("CO2_ADMIN_TOKEN", None)
        from api.admin_routes import require_admin_token

        require_admin_token(x_admin_token=None)
    finally:
        _restore(snap)


def test_health_http_auth_disabled_no_header_ok():
    snap = _snapshot(_ENV_KEYS)
    try:
        os.environ["CO2_DISABLE_ADMIN_AUTH"] = "true"
        os.environ.pop("CO2_ADMIN_TOKEN", None)
        from fastapi.testclient import TestClient

        from api.app import app

        client = TestClient(app)
        r = client.get("/admin/health")
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("admin_auth_disabled") is True
        assert j.get("warning")
        assert "local" in j["warning"].lower() or "development" in j["warning"].lower()
    finally:
        _restore(snap)


def test_health_http_auth_enabled_no_header_401():
    snap = _snapshot(_ENV_KEYS)
    try:
        os.environ.pop("CO2_DISABLE_ADMIN_AUTH", None)
        os.environ["CO2_ADMIN_TOKEN"] = "server-secret"
        from fastapi.testclient import TestClient

        from api.app import app

        client = TestClient(app)
        r = client.get("/admin/health")
        assert r.status_code == 401
    finally:
        _restore(snap)


def test_health_http_auth_enabled_correct_header_ok():
    snap = _snapshot(_ENV_KEYS)
    try:
        os.environ.pop("CO2_DISABLE_ADMIN_AUTH", None)
        os.environ["CO2_ADMIN_TOKEN"] = "server-secret"
        from fastapi.testclient import TestClient

        from api.app import app

        client = TestClient(app)
        r = client.get("/admin/health", headers={"X-Admin-Token": "server-secret"})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("admin_auth_disabled") is not True
    finally:
        _restore(snap)


def test_health_http_no_token_and_no_bypass_503():
    snap = _snapshot(_ENV_KEYS)
    try:
        os.environ.pop("CO2_DISABLE_ADMIN_AUTH", None)
        os.environ.pop("CO2_ADMIN_TOKEN", None)
        from fastapi.testclient import TestClient

        from api.app import app

        client = TestClient(app)
        r = client.get("/admin/health")
        assert r.status_code == 503
    finally:
        _restore(snap)
