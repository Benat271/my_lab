from __future__ import annotations

from collections.abc import Callable
from contextlib import contextmanager
from typing import Any

import pytest
from fastapi.testclient import TestClient

from backend import main


class FakeCursor:
    def __init__(self, handler: Callable[[str, tuple[Any, ...], "FakeCursor"], None]) -> None:
        self._handler = handler
        self._fetchone: Any = None
        self._fetchall: list[Any] = []
        self.rowcount = 0
        self.executed: list[tuple[str, tuple[Any, ...]]] = []

    def __enter__(self) -> "FakeCursor":
        return self

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> bool:
        return False

    def execute(self, sql: str, params: tuple[Any, ...] = ()) -> None:
        self.executed.append((sql, params))
        self._handler(sql, params, self)

    def fetchone(self) -> Any:
        return self._fetchone

    def fetchall(self) -> list[Any]:
        return self._fetchall


class FakeConnection:
    def __init__(self, handler: Callable[[str, tuple[Any, ...], FakeCursor], None]) -> None:
        self.cursor_instance = FakeCursor(handler)

    def __enter__(self) -> "FakeConnection":
        return self

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> bool:
        return False

    def cursor(self) -> FakeCursor:
        return self.cursor_instance

    def commit(self) -> None:
        return None

    def rollback(self) -> None:
        return None

    def close(self) -> None:
        return None


@pytest.fixture
def client() -> TestClient:
    return TestClient(main.app)


@pytest.fixture
def auth_token(monkeypatch: pytest.MonkeyPatch) -> str:
    monkeypatch.setenv("JWT_SECRET", "pytest-secret")
    return main.create_jwt({"sub": "admin", "uid": 1, "exp": 4102444800})


@pytest.fixture
def auth_headers(auth_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
def senior_payload() -> dict[str, Any]:
    return {
        "senior_codigo": 1001,
        "nombre": "Ada",
        "apellido1": "Lovelace",
        "apellido2": "Test",
        "email_personal": "ada@example.com",
        "email_secot": "ada@secot.org",
        "movil": "600123123",
        "fecha_alta": "2024-01-15",
        "activo": True,
    }


@pytest.fixture
def user_record() -> dict[str, Any]:
    salt = b"0123456789abcdef"
    password_hash = main._pbkdf2_hash("admin123", salt)
    return {
        "id": 1,
        "username": "admin",
        "password_salt_b64": main.base64.b64encode(salt).decode("ascii"),
        "password_hash_b64": main.base64.b64encode(password_hash).decode("ascii"),
        "is_active": True,
    }


@pytest.fixture
def stub_connection(monkeypatch: pytest.MonkeyPatch) -> Callable[[Callable[[str, tuple[Any, ...], FakeCursor], None]], FakeConnection]:
    def _factory(handler: Callable[[str, tuple[Any, ...], FakeCursor], None]) -> FakeConnection:
        connection = FakeConnection(handler)

        @contextmanager
        def _fake_get_connection() -> Any:
            yield connection

        monkeypatch.setattr(main, "get_connection", _fake_get_connection)
        return connection

    return _factory
