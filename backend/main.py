from __future__ import annotations

import os
from contextlib import contextmanager
from datetime import date
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_validator
from psycopg import Connection
from psycopg.errors import Error as PsycopgError
from psycopg.errors import ForeignKeyViolation, UniqueViolation
from psycopg.rows import dict_row


BASE_DIR = Path(__file__).resolve().parent.parent
LIQUIBASE_PROPERTIES = BASE_DIR / "database" / "liquibase.properties"


def _strip_quotes(value: str) -> str:
    return value.strip().strip('"').strip("'")


def _split_origins(origins: str | None) -> list[str]:
    if not origins:
        return ["*"]
    parsed = [item.strip() for item in origins.split(",") if item.strip()]
    return parsed or ["*"]


def load_database_settings() -> dict[str, str]:
    settings: dict[str, str] = {}
    if not LIQUIBASE_PROPERTIES.exists():
        return settings

    for raw_line in LIQUIBASE_PROPERTIES.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        settings[key.strip()] = _strip_quotes(value)
    return settings


def build_connection_kwargs() -> dict[str, Any]:
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return {"conninfo": database_url, "row_factory": dict_row}

    settings = load_database_settings()
    jdbc_url = settings.get("url", "")
    if not jdbc_url.startswith("jdbc:postgresql://"):
        raise RuntimeError(
            "No se encontro DATABASE_URL y la URL JDBC local no tiene un formato PostgreSQL soportado."
        )

    parsed = urlparse(jdbc_url.replace("jdbc:", "", 1))
    query = parse_qs(parsed.query)

    return {
        "host": parsed.hostname,
        "port": parsed.port or 5432,
        "dbname": parsed.path.lstrip("/") or "postgres",
        "user": settings.get("username") or query.get("user", [None])[0],
        "password": settings.get("password") or query.get("password", [None])[0],
        "sslmode": query.get("sslmode", ["require"])[0],
        "row_factory": dict_row,
    }


@contextmanager
def get_connection() -> Connection[Any]:
    conn = Connection.connect(**build_connection_kwargs())
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


class SeniorBase(BaseModel):
    senior_codigo: int = Field(gt=0)
    nombre: str = Field(min_length=1, max_length=100)
    apellido1: str = Field(min_length=1, max_length=100)
    apellido2: str | None = Field(default=None, max_length=100)
    email_personal: str | None = Field(default=None, max_length=150)
    email_secot: str | None = Field(default=None, max_length=150)
    movil: str | None = Field(default=None, max_length=20)
    fecha_alta: date | None = None
    activo: bool = True

    @field_validator("nombre", "apellido1", "apellido2", "movil", mode="before")
    @classmethod
    def normalize_text(cls, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, str):
            normalized = value.strip()
            return normalized or None
        return value

    @field_validator("email_personal", "email_secot", mode="before")
    @classmethod
    def normalize_email(cls, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, str):
            normalized = value.strip().lower()
            return normalized or None
        return value

    @field_validator("email_personal", "email_secot")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if "@" not in value or "." not in value:
            raise ValueError("Debe tener formato de email valido.")
        return value

    @field_validator("fecha_alta")
    @classmethod
    def validate_fecha_alta(cls, value: date | None) -> date | None:
        if value is not None and value < date(2020, 1, 1):
            raise ValueError("FechaAlta debe ser igual o posterior a 2020-01-01.")
        return value


class SeniorCreate(SeniorBase):
    pass


class SeniorUpdate(SeniorBase):
    pass


class SeniorRead(SeniorBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class SeniorDeleteResponse(BaseModel):
    status: str


allowed_origins = _split_origins(os.getenv("ALLOWED_ORIGINS"))

app = FastAPI(title="SECOT Calendarios API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


def _database_error(exc: PsycopgError) -> HTTPException:
    if isinstance(exc, UniqueViolation):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un senior con ese codigo o email SECOT.",
        )
    if isinstance(exc, ForeignKeyViolation):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La operacion viola una relacion existente en la base de datos.",
        )
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Se produjo un error al acceder a la base de datos.",
    )


def fetch_senior_by_id(senior_id: int) -> dict[str, Any] | None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select
                    id,
                    senior_codigo,
                    nombre,
                    apellido1,
                    apellido2,
                    email_personal,
                    email_secot,
                    movil,
                    fecha_alta,
                    activo
                from senior
                where id = %s
                """,
                (senior_id,),
            )
            return cur.fetchone()


@app.get("/")
def root() -> dict[str, Any]:
    return {
        "service": "secot-calendarios-api",
        "status": "ok",
        "docs": "/docs",
        "cors_origins": allowed_origins,
    }


@app.get("/api/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/seniors", response_model=list[SeniorRead])
def list_seniors(q: str | None = Query(default=None, max_length=100)) -> list[dict[str, Any]]:
    search = f"%{q.strip()}%" if q and q.strip() else None
    sql = """
        select
            id,
            senior_codigo,
            nombre,
            apellido1,
            apellido2,
            email_personal,
            email_secot,
            movil,
            fecha_alta,
            activo
        from senior
    """
    params: tuple[Any, ...] = ()
    if search:
        sql += """
            where
                cast(senior_codigo as text) ilike %s
                or nombre ilike %s
                or apellido1 ilike %s
                or coalesce(apellido2, '') ilike %s
                or coalesce(email_secot, '') ilike %s
        """
        params = (search, search, search, search, search)

    sql += " order by senior_codigo asc"

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params)
                return cur.fetchall()
    except PsycopgError as exc:
        raise _database_error(exc) from exc


@app.get("/api/seniors/{senior_id}", response_model=SeniorRead)
def get_senior(senior_id: int) -> dict[str, Any]:
    try:
        senior = fetch_senior_by_id(senior_id)
    except PsycopgError as exc:
        raise _database_error(exc) from exc

    if senior is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Senior no encontrado.")
    return senior


@app.post("/api/seniors", response_model=SeniorRead, status_code=status.HTTP_201_CREATED)
def create_senior(payload: SeniorCreate) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    insert into senior (
                        senior_codigo,
                        nombre,
                        apellido1,
                        apellido2,
                        email_personal,
                        email_secot,
                        movil,
                        fecha_alta,
                        activo
                    ) values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    returning
                        id,
                        senior_codigo,
                        nombre,
                        apellido1,
                        apellido2,
                        email_personal,
                        email_secot,
                        movil,
                        fecha_alta,
                        activo
                    """,
                    (
                        payload.senior_codigo,
                        payload.nombre,
                        payload.apellido1,
                        payload.apellido2,
                        payload.email_personal,
                        payload.email_secot,
                        payload.movil,
                        payload.fecha_alta,
                        payload.activo,
                    ),
                )
                created = cur.fetchone()
                assert created is not None
                return created
    except PsycopgError as exc:
        raise _database_error(exc) from exc


@app.put("/api/seniors/{senior_id}", response_model=SeniorRead)
def update_senior(senior_id: int, payload: SeniorUpdate) -> dict[str, Any]:
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    update senior
                    set
                        senior_codigo = %s,
                        nombre = %s,
                        apellido1 = %s,
                        apellido2 = %s,
                        email_personal = %s,
                        email_secot = %s,
                        movil = %s,
                        fecha_alta = %s,
                        activo = %s
                    where id = %s
                    returning
                        id,
                        senior_codigo,
                        nombre,
                        apellido1,
                        apellido2,
                        email_personal,
                        email_secot,
                        movil,
                        fecha_alta,
                        activo
                    """,
                    (
                        payload.senior_codigo,
                        payload.nombre,
                        payload.apellido1,
                        payload.apellido2,
                        payload.email_personal,
                        payload.email_secot,
                        payload.movil,
                        payload.fecha_alta,
                        payload.activo,
                        senior_id,
                    ),
                )
                updated = cur.fetchone()
                if updated is None:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Senior no encontrado.")
                return updated
    except HTTPException:
        raise
    except PsycopgError as exc:
        raise _database_error(exc) from exc


@app.delete("/api/seniors/{senior_id}", response_model=SeniorDeleteResponse)
def delete_senior(senior_id: int) -> SeniorDeleteResponse:
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("delete from senior where id = %s", (senior_id,))
                if cur.rowcount == 0:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Senior no encontrado.")
    except HTTPException:
        raise
    except PsycopgError as exc:
        raise _database_error(exc) from exc

    return SeniorDeleteResponse(status="deleted")
