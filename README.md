# Sistema de Aprobación de Créditos y Desembolsos

[![CI](https://github.com/JCarrillo2005/Sistema-de-Aprobacion-de-Creditos-y-Desembolsos/actions/workflows/ci.yml/badge.svg)](https://github.com/JCarrillo2005/Sistema-de-Aprobacion-de-Creditos-y-Desembolsos/actions/workflows/ci.yml)

Aplicación Full-Stack para gestionar solicitudes internas de crédito: registro
con reglas de negocio estrictas, consulta a un buró crediticio simulado
(resiliente), flujo de aprobación con presupuesto global concurrente-seguro y
auditoría inmutable con control de roles en el servidor.

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | React 18 + TypeScript estricto, Vite, React Router, TanStack Query (servido por nginx) |
| Backend | Node.js 22 + Express 4 + TypeScript estricto, validación con Zod |
| Persistencia | PostgreSQL 16 (SQL directo con `pg`, sin ORM) |
| Pruebas | Vitest + Supertest (contra PostgreSQL real) |
| Despliegue | Docker Compose (`db`, `backend`, `frontend` con nginx como proxy a `/api`) |

## Puesta en marcha (un solo comando)

Requisitos: Docker y Docker Compose.

```bash
docker compose up --build
```

- Aplicación: **http://localhost:8080**
- La base de datos se migra y se siembra sola al arrancar el backend.
- El frontend espera a que el backend esté saludable antes de arrancar.
- Para reiniciar desde cero (borra datos): `docker compose down -v`

> Los Dockerfiles usan `npm ci`, por lo que `backend/package-lock.json` y
> `frontend/package-lock.json` deben estar versionados (se generan con
> `npm install` en cada carpeta).

### Si el puerto 5432 está ocupado

El compose publica PostgreSQL en `${DB_PORT:-5432}`. Si ya tienes otro
PostgreSQL local en 5432, crea un `.env` en la raíz (ignorado por git):

```bash
# .env
DB_PORT=5433
```

y ajusta el `.env` del backend para desarrollo local:

```bash
# backend/.env
DATABASE_URL=postgres://credit:credit@localhost:5433/credit
TEST_DATABASE_URL=postgres://credit:credit@localhost:5433/credit_test
```

El backend dentro de Docker sigue usando `db:5432` en la red interna; `DB_PORT`
solo cambia el puerto publicado en tu máquina. En el entorno de desarrollo
actual, el `.env` raíz local (ignorado por git) ya usa `DB_PORT=5433`.

## Desarrollo local (sin contenedores para la app)

```bash
docker compose up -d db          # PostgreSQL (crea 'credit' y 'credit_test')

cd backend
npm install
cp .env.example .env             # ajusta el puerto si usas DB_PORT=5433
npm run dev                      # API en http://localhost:3000

cd ../frontend
npm install
npm run dev                      # UI en http://localhost:5173 (proxy de /api al backend)
```

> En PowerShell, usa `Copy-Item .env.example .env` en lugar de `cp`.

Si `credit_test` no existe porque el volumen de Postgres es anterior a
`db/init`: `docker compose down -v` y volver a levantar.

## Usuarios de prueba

La pantalla de inicio es un selector de usuarios sembrados (autenticación de
demostración, sin contraseñas):

| Usuario | Rol | Puede |
| --- | --- | --- |
| `sol-1` Ana Solicitante | SOLICITANTE | Crear y consultar **sus** solicitudes |
| `sol-2` Luis Solicitante | SOLICITANTE | Ídem (para probar el aislamiento entre usuarios) |
| `ana-1` Carla Analista | ANALISTA | Revisar, aprobar, rechazar, ver presupuesto y auditoría |

```bash
# Con todo en contenedores
curl -s -X POST localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' -d '{"userId":"ana-1"}'

# Con el backend local
curl -s -X POST localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' -d '{"userId":"ana-1"}'
```

> En PowerShell: `Invoke-RestMethod -Uri http://localhost:8080/api/auth/login -Method Post -ContentType 'application/json' -Body '{"userId":"ana-1"}'`.

## Flujo de prueba sugerido

1. Entra como **Ana** y crea una solicitud (ej.: ingreso 2000, monto 800, 12
   meses). La tabla de amortización se calcula en vivo. Con monto 900 el
   formulario muestra el error del 40 %.
2. Al crear, se lanza la consulta al buró en segundo plano: puedes navegar
   mientras el header muestra el indicador de consulta en curso.
3. Intenta crear otra solicitud con el mismo documento: se bloquea con el
   motivo exacto y la fecha a partir de la cual puede volver a solicitar.
4. Entra como **Carla**: toma la solicitud para revisión, apruébala (el
   presupuesto baja de 50 000 a 49 200) o recházala con un motivo de 15+
   caracteres.
5. Revisa **Auditoría**: se actualiza sola cada 3 s. El detalle de la solicitud
   también se refresca para reflejar decisiones tomadas por otro analista.

## Scripts

### Backend

| Script | Descripción |
| --- | --- |
| `npm run dev` | API en modo watch |
| `npm run build` | Compila a `dist/` (`tsconfig.build.json`) |
| `npm start` | Ejecuta `dist/server.js` |
| `npm run typecheck` | `tsc --noEmit` (incluye `tests/`) |
| `npm test` | Vitest + Supertest (requiere `credit_test`) |
| `npm run db:migrate` | Aplica esquema y semillas (idempotente) |

### Frontend

| Script | Descripción |
| --- | --- |
| `npm run dev` | Vite en `http://localhost:5173` |
| `npm run typecheck` | `tsc --noEmit` (incluye `vite.config.ts`) |
| `npm run build` | Typecheck + build de producción en `dist/` |
| `npm run preview` | Sirve `dist/` (mantiene el proxy de `/api`) |

## Endpoints

| Método | Ruta | Rol | Descripción |
| --- | --- | --- | --- |
| GET | `/health` | — | Liveness (usado por el healthcheck de Docker) |
| GET | `/api/auth/users` | — | Selector de usuarios demo |
| POST | `/api/auth/login` | — | Devuelve JWT |
| GET | `/api/auth/me` | ambos | Usuario autenticado (rol leído de la BD) |
| POST | `/api/requests` | SOLICITANTE | Crear solicitud |
| GET | `/api/requests` | ambos | Propias o todas (según rol) |
| GET | `/api/requests/document-status` | ambos | ¿El documento tiene historial bloqueante? (`?documentId=`) |
| GET | `/api/requests/:id` | ambos | Detalle |
| POST | `/api/requests/:id/start-review` | ANALISTA | CREADA → EN_REVISION |
| POST | `/api/requests/:id/approve` | ANALISTA | EN_REVISION → APROBADA |
| POST | `/api/requests/:id/reject` | ANALISTA | EN_REVISION → RECHAZADA |
| POST | `/api/requests/:id/bureau-check` | ambos | Consulta al buró |
| GET | `/api/budget` | ANALISTA | Presupuesto disponible |
| GET | `/api/audit` | ANALISTA | Auditoría (`requestId`, `afterId`, `limit`) |
| GET | `/internal/bureau/:documentId` | — | Mock del buró (2–4 s, ~30 % 503); **no expuesto por nginx** |

## Reglas de negocio implementadas

1. Monto ≤ 40 % del ingreso mensual (Zod + `CHECK` en PostgreSQL). El máximo se
   trunca a centavos para no superar el `CHECK` exacto, y el dinero solo admite
   2 decimales (la UI los limita al escribir y el backend rechaza el resto).
2. Bloqueo si el mismo documento tiene una solicitud `CREADA`, `EN_REVISION` o
   `RECHAZADA` en los últimos 30 días (HTTP 409 con el motivo exacto).
3. La creación se serializa por documento con `pg_advisory_xact_lock`, así dos
   peticiones simultáneas no burlan la regla anterior.
4. Ciclo `CREADA → EN_REVISION → APROBADA | RECHAZADA`; saltos y reversiones
   devuelven 409.
5. Rechazo con justificación mínima de 15 caracteres (Zod + `CHECK`).
6. Presupuesto global de USD 50.000; al aprobar se descuenta en la misma
   transacción con `UPDATE ... WHERE available >= monto`. Si no alcanza: 422 y
   la solicitud sigue en `EN_REVISION`.
7. Idempotencia: `SELECT ... FOR UPDATE` sobre la solicitud. Ocho aprobaciones
   simultáneas descuentan una vez; las demás devuelven `idempotent: true`.
8. Auditoría inmutable: trigger que bloquea `UPDATE`/`DELETE` sobre `audit_log`.
9. Roles verificados en el servidor; el rol se relee de la BD en cada petición.

## Decisiones técnicas

### Arquitectura

- **Backend por capas:** `domain/` (reglas puras, sin Express ni BD) →
  `modules/*/service` (casos de uso y SQL) → `modules/*/routes` (solo HTTP) →
  `http/` (autenticación, validación, errores).
- **Un único origen:** nginx sirve el SPA y hace proxy de `/api/`. El backend
  usa `expose` (no publica el puerto 3000) y `/internal/*` se bloquea tanto en
  nginx como al no estar publicado. En Compose, el mock del buró solo es
  accesible desde la red de Docker.
- **Healthchecks:** PostgreSQL y backend tienen healthcheck; el frontend espera
  a que el backend esté saludable antes de arrancar.

### Observabilidad

- Cada petición genera un `X-Request-Id` y una línea de log con método, ruta,
  código de estado y duración. Los errores 500 incluyen el mismo id para
  correlacionar el reporte del frontend con el log del backend.
- Se omiten `/health` (healthcheck) y `/internal/*` (su URL puede contener el
  documento). Nunca se registran cuerpos, tokens ni datos personales.
- En `NODE_ENV=test` la salida se silencia; las pruebas del middleware inyectan
  su propio colector.

### Concurrencia e idempotencia

- Aprobar/rechazar corre en **una transacción** con `SELECT ... FOR UPDATE`
  sobre la solicitud: las peticiones simultáneas sobre la misma solicitud se
  serializan.
- El descuento es atómico y condicional:
  `UPDATE budget SET available = available - $1 WHERE available >= $1`. El
  presupuesto nunca queda negativo (además hay un `CHECK` en la tabla).
- Si la solicitud ya está en el estado destino, la respuesta es `200` con
  `idempotent: true` y **no se descuenta de nuevo** (doble clic, reintentos de
  red).
- La creación se serializa por documento con `pg_advisory_xact_lock`, para que
  dos creaciones simultáneas no burlen la regla de 30 días.
- En la UI, los botones se deshabilitan mientras la mutación está en curso
  (defensa adicional; la garantía real es la del servidor).

### Reglas y validación

- **"PENDIENTE"** no es un estado del ciclo; se interpreta como solicitud sin
  resolver (`CREADA` o `EN_REVISION`). La ventana de 30 días se cuenta desde
  `created_at` de la solicitud previa.
- Todas las reglas se validan en el frontend (`lib/rules.ts`, mismos mensajes) y
  en el backend (Zod + `CHECK` en PostgreSQL). El backend es la fuente de verdad.
- La consulta al buró **no es obligatoria** para aprobar (decisión de producto
  abierta).

### Resiliencia (buró crediticio)

- El mock responde con latencia de 2–4 s y ~30 % de `503`.
- El cliente reintenta hasta 4 veces con **espera exponencial + jitter**, con
  *timeout* por intento. Los `4xx` no se reintentan.
- En la UI la consulta es una mutación global de TanStack Query: el usuario
  sigue navegando, un indicador en el header muestra las consultas en curso y
  el panel recupera su estado de carga o error al volver a la solicitud.

### Seguridad

- Permisos con `authenticate` + `requireRole` en el servidor. El **rol se lee de
  la BD en cada petición**, no del token ni del cliente.
- Un solicitante que pide una solicitud ajena recibe `404` (no revela
  existencia).
- SQL siempre parametrizado.
- Auditoría de solo inserción: un trigger de PostgreSQL rechaza `UPDATE` y
  `DELETE` sobre `audit_log`.
- El token JWT se guarda en `localStorage`. Es aceptable para una demo; en
  producción se preferiría una cookie `HttpOnly`.

## Pruebas

```bash
docker compose up -d db
cd backend
npm run typecheck
npm test
```

Las pruebas de integración usan la base `credit_test` (hacen `TRUNCATE`, nunca
tocan `credit`). Cubren: límite del 40 %, ventana de 30 días (PENDIENTE y
RECHAZADA), transiciones inválidas, motivo de rechazo, presupuesto insuficiente,
**8 aprobaciones simultáneas que descuentan una sola vez**, permisos por rol en
el servidor, aislamiento entre solicitantes e inmutabilidad del audit log.
También hay pruebas unitarias del dominio (amortización, validaciones) y del
cliente con reintentos del buró.

El frontend no tiene pruebas automatizadas; su lógica crítica de negocio está
cubierta por el backend. Se valida con:

```bash
cd frontend
npm run typecheck
npm run build
```

## Integración continua

Cada push a `main` (y cada pull request) ejecuta `.github/workflows/ci.yml`:

- **Backend · typecheck + tests**: levanta PostgreSQL 16, aplica el esquema y
  corre las 26 pruebas con reporte *verbose* (se ve el nombre de cada prueba).
- **Frontend · typecheck + build**: valida tipos y genera el bundle de producción.

Para ver los resultados: pestaña **Actions** del repositorio → flujo **CI** →
última ejecución → job deseado → paso **Pruebas (Vitest + Supertest)**. El badge
del inicio de este README muestra el estado de la última ejecución en `main`.

## Estructura

```text
.
├── docker-compose.yml
├── db/init/01-create-test-db.sql      # crea la base credit_test
├── backend/
│   ├── Dockerfile
│   ├── src/
│   │   ├── app.ts                     # createApp() sin listen (testeable)
│   │   ├── server.ts                  # arranque, migración y shutdown
│   │   ├── config.ts                  # variables de entorno validadas con Zod
│   │   ├── db/                        # pool.ts, schema.ts, migrate.ts
│   │   ├── domain/                    # types, errors, rules, amortization
│   │   ├── http/                      # asyncHandler, validate, errorHandler, auth
│   │   └── modules/                   # auth, requests, audit, budget, bureau
│   └── tests/
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── src/
        ├── api/                       # tipos, cliente HTTP, endpoints y hooks
        ├── auth/                      # sesión y ProtectedRoute
        ├── components/                # Layout, badges, amortización, buró
        ├── lib/                       # reglas, amortización, formato, rutas
        └── pages/                     # login, solicitudes, analista, auditoría
```

## Limitaciones conocidas

- Autenticación de demostración (selector de usuarios, sin contraseñas). En
  producción: credenciales reales o SSO, y `JWT_SECRET` desde un gestor de
  secretos.
- La auditoría "en tiempo real" se implementa con *polling* (3 s); SSE o
  WebSockets serían la evolución natural.
- No hay pruebas automatizadas del frontend; la lógica crítica de negocio está
  cubierta en el backend.

## Variables de entorno

### Backend

| Variable | Por defecto | Descripción |
| --- | --- | --- |
| `PORT` | `3000` | Puerto del API |
| `DATABASE_URL` | `postgres://credit:credit@localhost:5432/credit` | Conexión a PostgreSQL |
| `TEST_DATABASE_URL` | `.../credit_test` | Base usada por las pruebas |
| `JWT_SECRET` | `dev-secret-cambiar` | Secreto de firma del JWT (cambiar fuera de desarrollo) |
| `CORS_ORIGIN` | `http://localhost:5173` | Orígenes permitidos, separados por coma |
| `BUREAU_BASE_URL` | `http://localhost:$PORT` | URL base del buró simulado |
| `BUREAU_MIN_DELAY_MS` / `BUREAU_MAX_DELAY_MS` | `2000` / `4000` | Latencia artificial |
| `BUREAU_FAILURE_RATE` | `0.3` | Probabilidad de respuesta 503 |
| `BUREAU_TIMEOUT_MS` | `8000` | Timeout por intento |
| `BUREAU_MAX_ATTEMPTS` | `4` | Intentos máximos |
| `BUREAU_BACKOFF_BASE_MS` | `500` | Base del backoff exponencial |

### Compose y frontend

| Variable | Por defecto | Descripción |
| --- | --- | --- |
| `DB_PORT` | `5432` | Puerto publicado de PostgreSQL en el host |
| `VITE_PROXY_TARGET` | `http://localhost:3000` | Backend al que Vite proxea `/api` en desarrollo |
