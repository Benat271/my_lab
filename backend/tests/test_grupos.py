import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_list_grupos_unauthorized():
    """Debe fallar si no hay token."""
    response = client.get("/api/grupos")
    assert response.status_code == 401

def test_create_grupo_success(client, auth_headers, stub_connection):
    """Validar que la creacion de un grupo funciona con datos correctos."""
    payload = {
        "grupo_codigo": 101,
        "nombre_grupo": "Grupo de Prueba",
        "descripcion": "Una descripcion",
        "color_hex": "#ff0000",
        "canal_teams": "teams-link",
        "responsable_senior_id": 7,
        "activo": True
    }

    def handler(sql, params, cursor):
        assert "insert into grupo" in sql
        cursor._fetchone = {"id": 1, **payload}

    stub_connection(handler)

    response = client.post("/api/grupos", headers=auth_headers, json=payload)
    assert response.status_code == 201
    assert response.json()["nombre_grupo"] == "Grupo de Prueba"

@pytest.mark.parametrize("color", ["#ZZZ123", "blue", "#12345"])
def test_invalid_colors(color):
    """Prueba que Pydantic rechaza colores invalidos."""
    from backend.main import GrupoCreate
    with pytest.raises(ValueError):
        GrupoCreate(
            grupo_codigo=101,
            nombre_grupo="Test",
            color_hex=color,
            responsable_senior_id=1
        )