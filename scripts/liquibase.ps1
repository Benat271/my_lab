param(
    [Parameter(Position = 0)]
    [string]$Command = "validate",

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ExtraArgs = @()
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$defaultsFile = Join-Path $projectRoot "database/liquibase.properties"
$localLiquibase = Join-Path $projectRoot "tools/liquibase/4.31.1/liquibase.bat"

if (-not (Test-Path $defaultsFile)) {
    Write-Error "No se encontro el archivo de configuracion: $defaultsFile"
}

if (Test-Path $localLiquibase) {
    $liquibaseCmd = $localLiquibase
} else {
    $liquibaseCmd = Get-Command liquibase -ErrorAction SilentlyContinue
}

if (-not $liquibaseCmd) {
    Write-Error "No se encontro Liquibase. Instala el CLI o extrae la distribucion local en tools/liquibase/4.31.1."
}

& $liquibaseCmd "--defaults-file=$defaultsFile" $Command @ExtraArgs
