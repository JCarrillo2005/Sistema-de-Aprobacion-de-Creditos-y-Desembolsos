# AGENTS.md

Guía para agentes de programación (Cursor, Copilot, Claude Code, Windsurf, etc.) que trabajen en este repositorio.
Léela completa antes de modificar código.

## 1. Resumen del proyecto

Sistema de Aprobación de Créditos y Desembolsos (prueba técnica Full-Stack, nivel mid-senior).
Permite a **Solicitantes** registrar solicitudes de crédito y a **Analistas** revisarlas, aprobarlas o rechazarlas,
con control de presupuesto global, consulta a un buró crediticio simulado (con fallos aleatorios) y un
registro de auditoría inmutable.

Lo que se evalúa: criterio arquitectónico, calidad de código, concurrencia, seguridad y resiliencia.
No se evalúa la velocidad de escritura de código repetitivo.

## 2. Stack

| Capa         | Tecnología                                                                 |
| ------------ | -------------------------------------------------------------------------- |
| Frontend     | React + TypeScript estricto (Vite), React Router, TanStack Query           |
| Backend      | Node.js 22 + Express 4 + TypeScript estricto                               |
| Validación   | Zod (backend y frontend; las reglas del frontend replican las del backend) |
| Persistencia | PostgreSQL 16 (Docker) con driver `pg` (SQL directo, sin ORM)              |
| Pruebas      | Vitest + Supertest (backend)                                               |
| Despliegue   | Docker Compose (`db`, `backend`, `frontend` con nginx como proxy a `/api`) |

## 3. Estructura del repositorio

```
credit-app/
├── docker-compose.yml
├── AGENTS.md
├── README.md
├── db/init/01-create-test-db.sql      # crea la base credit_test
├── backend/
│   ├── Dockerfile
│   ├── src/
│   │   ├── app.ts                      # createApp() sin listen (testeable)
│   │   ├── server.ts                   # arranque, migración, shutdown
│   │   ├── config.ts
│   │   ├── db/                         # pool.ts, schema.ts, migrate.ts
│   │   ├── domain/                     # reglas puras: types, errors, rules, amortization
│   │   ├── http/                       # middlewares: auth, validate, errorHandler, asyncHandler
│   │   └── modules/                    # auth, requests, audit, budget, bureau
│   └── tests/                          # domain, bureau.client, credit.integration
└── frontend/
    ├── Dockerfile
    ├── nginx.conf                      # SPA + proxy /api; bloquea /internal
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx, App.tsx, styles.css
        ├── api/                        # types, client, endpoints, hooks
        ├── auth/                       # AuthContext, ProtectedRoute
        ├── lib/                        # rules, amortization, format, routes
        ├── components/                 # Layout, StatusBadge, AmortizationTable, BureauPanel
        └── pages/                      # Login, MyRequests, NewRequest, RequestDetail,
                                        # AnalystDashboard, Audit
```

Separación de responsabilidades:

- **`domain/`**: lógica y reglas de negocio puras, sin Express ni acceso a BD. Aquí viven las validaciones Zod
  y el cálculo de amortización.
- **`modules/*/*.routes.ts`**: solo HTTP (parseo, llamada al servicio, respuesta).
- **`modules/*/*.service.ts`**: casos de uso y SQL. Toda transacción vive aquí.
- **`http/`**: preocupaciones transversales (autenticación, errores, validación).
- **`frontend/src/api/`**: tipos de la API y hooks de TanStack Query; el cliente HTTP es el único que
  conoce el token.
- **`frontend/src/lib/`**: reglas y amortización que replican el backend para dar feedback inmediato,
  más formato y rutas.
- **`frontend/src/pages/`**: vistas por ruta; la lógica de negocio real permanece en el backend.

## 4. Comandos

```bash
# Base de datos (crea 'credit' y 'credit_test')
docker compose up -d db

# Backend
cd backend
npm install
npm run dev          # API en http://localhost:3000
npm run typecheck    # tsc --noEmit, debe pasar sin errores
npm test             # requiere la base credit_test arriba
npm run build

# Frontend
cd frontend
npm install
npm run dev          # UI en http://localhost:5173 (proxy /api -> localhost:3000)
npm run typecheck
npm run build

# Todo en contenedores (un solo origen en http://localhost:8080)
docker compose up --build
```

Si `credit_test` no existe porque el volumen de Postgres es anterior a `db/init`:
`docker compose down -v` y volver a levantar.

## 5. Reglas de negocio (NO romper)

1. **Campos**: nombre, documento de identidad, ingreso mensual, monto, plazo (6, 12, 24 o 36 meses).
2. **Límite de endeudamiento**: monto ≤ 40 % del ingreso mensual declarado.
3. **Historial reciente**: si el mismo documento tiene una solicitud `CREADA`/`EN_REVISION` ("pendiente") o
   `RECHAZADA` creada en los últimos 30 días, se bloquea la creación (HTTP 409) con el motivo exacto.
   La creación se serializa por documento con `pg_advisory_xact_lock`.
4. **Amortización**: interés fijo mensual de 1,5 % (sistema francés). El frontend la calcula y muestra antes de enviar.
5. **Validación doble**: toda regla se valida en frontend (UX) **y** backend (seguridad). El backend es la fuente de verdad.
6. **Buró crediticio simulado** (`/internal/bureau/:documentId`): latencia de 2–4 s y ~30 % de respuestas 503.
   El cliente reintenta con espera progresiva (backoff exponencial + jitter, 4 intentos). Los 4xx no se reintentan.
7. **Ciclo de estados**: `CREADA → EN_REVISION → APROBADA | RECHAZADA`. Sin saltos ni reversiones (HTTP 409).
8. **Presupuesto global**: inicia en 50 000,00 USD. Al aprobar se descuenta en la misma transacción con
   `UPDATE budget ... WHERE available >= monto`. Si no alcanza: HTTP 422 y la solicitud sigue en `EN_REVISION`.
9. **Idempotencia y concurrencia**: la transición usa `SELECT ... FOR UPDATE` sobre la solicitud. Una segunda
   aprobación sobre una solicitud ya `APROBADA` devuelve 200 con `idempotent: true` y **no descuenta de nuevo**.
10. **Rechazo**: exige comentario de al menos 15 caracteres (se valida en Zod y con `CHECK` en la BD).
11. **Auditoría inmutable**: cada transición inserta en `audit_log` (solicitud, usuario/rol, timestamp ISO 8601,
    estado anterior, estado nuevo, comentario). Un trigger de PostgreSQL bloquea `UPDATE` y `DELETE`.
12. **Roles**:
    - `SOLICITANTE`: crea y consulta **solo sus** solicitudes.
    - `ANALISTA`: revisa, aprueba, rechaza, consulta presupuesto y auditoría.

## 6. Seguridad

- Los permisos se verifican **siempre en el servidor** (`authenticate` + `requireRole`). Ocultar botones en la UI
  no cuenta como control de acceso.
- El rol se lee de la base de datos en cada petición; **nunca** se confía en el rol que venga en el JWT ni en el cliente.
- Un solicitante que pide una solicitud ajena recibe **404**, no 403 (no revela existencia).
- El mock del buró vive en `/internal/*` y **no debe exponerse** por el proxy de nginx del frontend.
- La autenticación actual es de demostración (selector de usuarios sembrados: `sol-1`, `sol-2`, `ana-1`).
  No añadir contraseñas ni secretos reales al repositorio. `JWT_SECRET` se toma del entorno.
- Todas las consultas SQL usan parámetros (`$1, $2...`). **Prohibido** concatenar entrada del usuario en SQL.

## 7. Convenciones de código

### General

- TypeScript con `strict: true`. **Prohibido `any`** sin justificación explícita en un comentario.
  Preferir `unknown` + validación con Zod.
- Nombres de código en inglés; mensajes al usuario, errores de API y comentarios en español.
- Dinero: en BD `NUMERIC(14,2)`. En el backend se convierte con `Number(...)` solo en la capa de mapeo;
  nunca hacer aritmética de dinero con strings. Redondear a 2 decimales con `Math.round(x * 100) / 100`.
- Fechas: `TIMESTAMPTZ` en BD y ISO 8601 (`toISOString()`) en la API.
- No agregar dependencias sin necesidad real. Si se agrega una, justificarla en el README.

### Backend

- Los handlers async se envuelven con `asyncHandler`; los errores esperados se lanzan como `AppError(status, code, message)`.
- Formato de error uniforme: `{ "error": { "code", "message", "details?" } }`.
- Toda operación que modifique varias tablas va dentro de `withTransaction`.
- Los códigos de estado: 400 validación, 401 sin autenticar, 403 sin permiso, 404 no encontrado,
  409 conflicto (historial / transición inválida), 422 presupuesto insuficiente, 503 buró no disponible.
- Los cambios de esquema se hacen en `db/schema.ts` de forma idempotente (`IF NOT EXISTS`, `ON CONFLICT`).

### Frontend

- Estado de servidor con TanStack Query; no duplicarlo en estado local.
- Formularios con validación en vivo reutilizando las mismas reglas que el backend.
- La consulta al buró debe mostrar estados de carga claros (`loading`, reintentando, error) **sin bloquear la
  navegación general**; no usar overlays globales ni bloquear el router.
- Deshabilitar el botón de aprobar/rechazar mientras la mutación está en curso (defensa extra; la protección real
  es la del servidor).
- La vista de auditoría se actualiza por polling cada pocos segundos.
- Componentes pequeños y tipados; los tipos de la API se definen una vez y se comparten en el módulo de cliente HTTP.

## 8. Pruebas

Mínimo exigido: 3 pruebas que cubran reglas críticas y doble aprobación concurrente. Actualmente hay más:

- `tests/domain.test.ts`: validación Zod y amortización.
- `tests/bureau.client.test.ts`: reintentos y agotamiento (con `fetch` simulado, sin esperas reales).
- `tests/credit.integration.test.ts`: contra PostgreSQL real (`credit_test`): ventana de 30 días, transiciones inválidas,
  motivo de rechazo, presupuesto insuficiente, **8 aprobaciones simultáneas descuentan una sola vez**,
  permisos por rol e inmutabilidad del audit log.

Reglas para tocar pruebas:

- Toda regla de negocio nueva o modificada necesita su prueba.
- Las pruebas de integración usan `TRUNCATE` y **solo** deben apuntar a `credit_test`, nunca a `credit`.
- No usar `setTimeout` reales largos en pruebas: parametrizar los tiempos (`baseDelayMs`).
- Antes de dar una tarea por terminada: `npm run typecheck && npm test` en backend y, si se tocó el
  frontend, `npm run typecheck && npm run build` en `frontend/`.
- El frontend no tiene pruebas automatizadas; su lógica crítica de negocio está cubierta por las
  pruebas del backend.

## 8.1 Definición de "terminado"

- [ ] `npm run typecheck` sin errores en backend.
- [ ] `npm test` en verde.
- [ ] Si se tocó el frontend: `npm run typecheck && npm run build` en `frontend/`.
- [ ] Las reglas nuevas se validan en frontend **y** backend.
- [ ] Ninguna ruta nueva carece de `authenticate`/`requireRole` cuando corresponde.
- [ ] `docker compose up --build` levanta todo desde cero.
- [ ] README actualizado si cambió algo del arranque o de las decisiones técnicas.

## 9. Cosas que NO debes hacer

- No mover la lógica de negocio a los controladores o al frontend.
- No saltarse el `FOR UPDATE` ni el descuento condicional del presupuesto "por simplicidad".
- No permitir `UPDATE`/`DELETE` sobre `audit_log` ni quitar su trigger.
- No leer el rol del usuario desde el cuerpo de la petición, query string, headers personalizados o `localStorage`.
- No exponer `/internal/*` fuera de la red de Docker.
- No hacer reintentos infinitos ni sin espera contra el buró.
- No subir `.env`, claves ni datos reales de personas.
- No introducir un ORM ni reescribir la capa de datos sin pedirlo.

## 10. Variables de entorno

| Variable                                      | Por defecto                                      | Descripción                                            |
| --------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| `PORT`                                        | `3000`                                           | Puerto del API                                         |
| `DATABASE_URL`                                | `postgres://credit:credit@localhost:5432/credit` | Conexión a PostgreSQL                                  |
| `JWT_SECRET`                                  | `dev-secret-cambiar`                             | Secreto de firma del JWT (cambiar fuera de desarrollo) |
| `BUREAU_BASE_URL`                             | `http://localhost:$PORT`                         | URL base del buró simulado                             |
| `BUREAU_MIN_DELAY_MS` / `BUREAU_MAX_DELAY_MS` | `2000` / `4000`                                  | Latencia artificial                                    |
| `BUREAU_FAILURE_RATE`                         | `0.3`                                            | Probabilidad de respuesta 503                          |
| `TEST_DATABASE_URL`                           | `.../credit_test`                                | Base usada por las pruebas                             |
| `DB_PORT`                                     | `5432`                                           | Puerto publicado de PostgreSQL en Compose (host)       |
| `VITE_PROXY_TARGET`                           | `http://localhost:3000`                          | Backend al que Vite proxea `/api` en desarrollo        |

## 11. Decisiones de diseño relevantes

- **"PENDIENTE"** se interpreta como solicitud sin resolver: `CREADA` o `EN_REVISION`.
- La ventana de 30 días se cuenta desde `created_at` de la solicitud previa.
- La consulta al buró **no es obligatoria** para aprobar (decisión abierta; si se cambia, actualizar este archivo y las pruebas).
- La autenticación es de demo; en producción se reemplazaría por credenciales reales o SSO.
