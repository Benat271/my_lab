# SECOT Calendarios

Monorepo del MVP de calendarios con:

- `backend/`: API FastAPI desplegable en Render
- `frontend/`: app React + Vite desplegable en Vercel
- `database/`: changelog y utilidades Liquibase para Supabase

## Estado actual

- Liquibase configurado y primera migracion del esquema MVP aplicada en Supabase.
- CRUD de `Senior` implementado en backend y frontend.
- Backend preparado para funcionar:
  - en local con `database/liquibase.properties`
  - en Render con `DATABASE_URL`
- Frontend preparado para consumir la API con `VITE_API_BASE_URL`.

## Variables de entorno

### Backend

Usa [backend/.env.example](/abs/path/c:/Users/garci/Desktop/my_lab/backend/.env.example:1) como referencia:

- `DATABASE_URL`: cadena de conexion PostgreSQL de Supabase
- `ALLOWED_ORIGINS`: lista separada por comas con los orígenes del frontend

### Frontend

Usa [frontend/.env.example](/abs/path/c:/Users/garci/Desktop/my_lab/frontend/.env.example:1):

- `VITE_API_BASE_URL`: URL publica del backend FastAPI

## Desarrollo local

### Backend

```powershell
cd C:\Users\garci\Desktop\my_lab
.\backend\venv\Scripts\uvicorn.exe backend.main:app --reload
```

### Frontend

Requiere Node.js instalado.

```powershell
cd C:\Users\garci\Desktop\my_lab\frontend
npm install
npm run dev
```

## Git local -> GitHub

Comandos basicos:

```powershell
git status
git add .
git commit -m "feat: primer crud senior"
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git branch -M main
git push -u origin main
```

Si el remoto ya existe:

```powershell
git remote -v
git push origin main
```

## Despliegue

### Render

Segun la documentacion oficial de Render:

- los monorepos se configuran con `rootDir`
- FastAPI en Python usa build `pip install -r requirements.txt`
- start `uvicorn main:app --host 0.0.0.0 --port $PORT`

El archivo [render.yaml](/abs/path/c:/Users/garci/Desktop/my_lab/render.yaml:1) ya deja eso preparado para el backend.

### Vercel

Segun la documentacion oficial de Vercel:

- en monorepos se importa cada proyecto con su `Root Directory`
- Vite se despliega como proyecto independiente

Para este repo, el proyecto de Vercel debe apuntar a `frontend/`.

## Flujo recomendado

1. Subir el repo a GitHub.
2. Crear en Render el servicio del backend usando el repo y `rootDir=backend`.
3. Crear en Vercel el proyecto del frontend usando el mismo repo y `rootDir=frontend`.
4. Configurar variables:
   - Render: `DATABASE_URL`, `ALLOWED_ORIGINS`
   - Vercel: `VITE_API_BASE_URL`
5. Cada commit a `main` disparara nuevos despliegues en ambos servicios.
