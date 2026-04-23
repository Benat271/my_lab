# Liquibase

Esta carpeta centraliza el versionado de la base de datos del proyecto.

## Estructura

- `changelog-root.xml`: changelog maestro que incluye el resto de migraciones.
- `changes/`: migraciones versionadas en formato SQL para Liquibase.
- `liquibase.properties.example`: plantilla compartible para configurar una conexion.
- `liquibase.local.properties`: archivo local real con credenciales. No se sube a Git.

## Flujo recomendado

1. Copiar `liquibase.properties.example` a `liquibase.local.properties`.
2. Rellenar la conexion JDBC de Supabase/Postgres.
3. Crear una nueva migracion en `changes/` usando el siguiente numero secuencial.
4. Anadir el `include` correspondiente en `changelog-root.xml`.
5. Ejecutar `liquibase --defaults-file=database/liquibase.local.properties validate`.
6. Ejecutar `liquibase --defaults-file=database/liquibase.local.properties update`.

## Ejemplo de comandos

```powershell
liquibase --defaults-file=database/liquibase.local.properties validate
liquibase --defaults-file=database/liquibase.local.properties status
liquibase --defaults-file=database/liquibase.local.properties update
liquibase --defaults-file=database/liquibase.local.properties history
```

## Notas

- El CLI de Liquibase y Java deben estar instalados en la maquina que ejecute migraciones.
- Para Supabase se usa una URL JDBC de PostgreSQL.
- El driver JDBC de PostgreSQL queda referenciado desde `database/drivers/postgresql-42.7.7.jar`.
