# Dashboard con login y SQLite (Node.js + Render)

Aplicación Express mínima: autenticación por sesión firmada en cookie, SQLite (`better-sqlite3`) y panel con datos de ejemplo.

## Estructura
- `server.js`: rutas, acceso a SQLite, siembra inicial (`initDb`), CSRF.
- `views/`: `login.ejs`, `dashboard.ejs`.
- `public/style.css`: estilos.
- `test.js`: prueba de humo (`npm test`).
- `render.yaml`: Blueprint de Render.

## Ejecución local
```bash
npm install
npm test
npm start   # http://localhost:3000
```
Credenciales por defecto: `admin` / `admin123`.

## Variables de entorno
| Variable | Descripción | Por defecto |
|---|---|---|
| `SECRET_KEY` | Clave de firma de la cookie de sesión | `dev-only-change-me` |
| `ADMIN_USER` | Usuario inicial | `admin` |
| `ADMIN_PASSWORD` | Contraseña inicial | `admin123` |
| `DATABASE_PATH` | Ruta del archivo SQLite | `data/app.db` |
| `NODE_ENV` | `production` activa cookie `secure` | — |

## Despliegue en Render
1. Subir el repositorio a GitHub.
2. Render → **New** → **Blueprint** → seleccionar el repositorio (usa `render.yaml`).
3. Consultar la contraseña generada en **Environment** → `ADMIN_PASSWORD`.
4. Abrir la URL del servicio e iniciar sesión.

## Persistencia
El plan `free` de Render tiene sistema de archivos efímero: SQLite se recrea y resiembra en cada reinicio o despliegue.
Para persistir datos: plan de pago + disco (`disk` con `mountPath: /var/data`) y `DATABASE_PATH=/var/data/app.db`.
