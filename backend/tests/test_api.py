from __future__ import annotations

from typing import Any

import pytest

from backend import main


def test_healthcheck_returns_ok(client: Any) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_login_returns_token_for_valid_credentials(
    client: Any, stub_connection: Any, user_record: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("JWT_SECRET", "pytest-secret")

    def handler(sql: str, params: tuple[Any, ...], cursor: Any) -> None:
        assert "from app_user" in sql
        assert params == ("admin",)
        cursor._fetchone = user_record

    stub_connection(handler)

    response = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert isinstance(body["access_token"], str)
    payload = main.decode_jwt(body["access_token"])
    assert payload["sub"] == "admin"


def test_login_rejects_invalid_credentials(
    client: Any, stub_connection: Any, user_record: dict[str, Any]
) -> None:
    def handler(sql: str, params: tuple[Any, ...], cursor: Any) -> None:
        cursor._fetchone = user_record

    stub_connection(handler)

    response = client.post("/api/auth/login", json={"username": "admin", "password": "bad-password"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Credenciales invalidas."


def test_list_seniors_requires_authentication(client: Any) -> None:
    response = client.get("/api/seniors")

    assert response.status_code == 401
    assert response.json()["detail"] == "No autenticado."


def test_list_seniors_returns_rows_for_authenticated_user(
    client: Any, auth_headers: dict[str, str], stub_connection: Any
) -> None:
    expected_rows = [
        {
            "id": 7,
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
    ]

    def handler(sql: str, params: tuple[Any, ...], cursor: Any) -> None:
        assert "from senior" in sql
        assert params == ()
        cursor._fetchall = expected_rows

    stub_connection(handler)

    response = client.get("/api/seniors", headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == expected_rows


def test_get_senior_returns_404_when_missing(
    client: Any, auth_headers: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(main, "fetch_senior_by_id", lambda senior_id: None)

    response = client.get("/api/seniors/9999", headers=auth_headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "Senior no encontrado."


def test_create_senior_returns_created_resource(
    client: Any, auth_headers: dict[str, str], senior_payload: dict[str, Any], stub_connection: Any
) -> None:
    def handler(sql: str, params: tuple[Any, ...], cursor: Any) -> None:
        assert "insert into senior" in sql
        cursor._fetchone = {"id": 10, **params_to_payload(params)}

    stub_connection(handler)

    response = client.post("/api/seniors", headers=auth_headers, json=senior_payload)

    assert response.status_code == 201
    assert response.json()["id"] == 10
    assert response.json()["email_secot"] == senior_payload["email_secot"]


def test_create_senior_returns_409_for_duplicate_data(
    client: Any, auth_headers: dict[str, str], senior_payload: dict[str, Any], stub_connection: Any
) -> None:
    def handler(sql: str, params: tuple[Any, ...], cursor: Any) -> None:
        raise main.UniqueViolation("duplicate senior")

    stub_connection(handler)

    response = client.post("/api/seniors", headers=auth_headers, json=senior_payload)

    assert response.status_code == 409
    assert response.json()["detail"] == "Ya existe un senior con ese codigo o email SECOT."


def test_update_senior_returns_404_when_target_is_missing(
    client: Any, auth_headers: dict[str, str], senior_payload: dict[str, Any], stub_connection: Any
) -> None:
    def handler(sql: str, params: tuple[Any, ...], cursor: Any) -> None:
        cursor._fetchone = None

    stub_connection(handler)

    response = client.put("/api/seniors/404", headers=auth_headers, json=senior_payload)

    assert response.status_code == 404
    assert response.json()["detail"] == "Senior no encontrado."


def test_delete_senior_returns_deleted_status(
    client: Any, auth_headers: dict[str, str], stub_connection: Any
) -> None:
    def handler(sql: str, params: tuple[Any, ...], cursor: Any) -> None:
        cursor.rowcount = 1

    stub_connection(handler)

    response = client.delete("/api/seniors/10", headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == {"status": "deleted"}


def params_to_payload(params: tuple[Any, ...]) -> dict[str, Any]:
    return {
        "senior_codigo": params[0],
        "nombre": params[1],
        "apellido1": params[2],
        "apellido2": params[3],
        "email_personal": params[4],
        "email_secot": params[5],
        "movil": params[6],
        "fecha_alta": params[7].isoformat() if params[7] is not None else None,
        "activo": params[8],
    }
