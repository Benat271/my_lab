#!/usr/bin/env sh
set -eu

COMMAND="${1:-validate}"
if [ "$#" -gt 0 ]; then
  shift
fi

PROJECT_ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
DEFAULTS_FILE="$PROJECT_ROOT/database/liquibase.properties"
LOCAL_LIQUIBASE="$PROJECT_ROOT/tools/liquibase/4.31.1/liquibase"

if [ ! -f "$DEFAULTS_FILE" ]; then
  echo "No se encontro el archivo de configuracion: $DEFAULTS_FILE" >&2
  exit 1
fi

if [ -x "$LOCAL_LIQUIBASE" ]; then
  LIQUIBASE_CMD="$LOCAL_LIQUIBASE"
elif command -v liquibase >/dev/null 2>&1; then
  LIQUIBASE_CMD="liquibase"
else
  echo "No se encontro Liquibase. Instala el CLI o extrae la distribucion local en tools/liquibase/4.31.1." >&2
  exit 1
fi

"$LIQUIBASE_CMD" --defaults-file="$DEFAULTS_FILE" "$COMMAND" "$@"
