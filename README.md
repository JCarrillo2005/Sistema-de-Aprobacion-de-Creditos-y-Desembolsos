# Sistema de Aprobación de Créditos y Desembolsos

Prueba técnica Full-Stack (mid-senior). Backend completo (Fase 1): reglas de
negocio, control de concurrencia, presupuesto global, buró simulado con
reintentos, auditoría inmutable y pruebas automatizadas. El frontend (Fase 2)
se apoyará en estos endpoints.

## Stack

| Capa | Tecnología |
| --- | --- |
| Backend | Node.js 22 + Express 4 + TypeScript estricto |
| Validación | Zod |
| Persistencia | PostgreSQL 16 (Docker) con `pg`, SQL directo sin ORM |
| Pruebas | Vitest + Supertest |
| Despliegue | Docker Compose |

## Puesta en marcha

Requisitos: Node.js >= 22.9, npm y Docker.

```bash
# 1. Base de datos (crea 'credit' y 'credit_test' en un volumen nuevo)
docker compose up -d db

# 2. Backend
cd backend
npm install
cp .env.example .env      # ajusta DATABASE_URL si usas otro puerto
npm run db:migrate        # opcional: el servidor migra al arrancar
npm run dev               # API en http://localhost:3000
```

Todo en contenedores:

```bash
docker compose up --build db backend
```

Si el puerto `5432` está ocupado por otro PostgreSQL, usa `DB_PORT` (el
`.env` raíz de este repo ya apunta a `5433` en esa situación):

```bash
DB_PORT=5433 docker compose up -d db
# backend/.env -> DATABASE_URL=postgres://credit:credit@localhost:5433/credit
```

Si `credit_test` no existe porque el volumen de Postgres es anterior a
`db/init`: `docker compose down -v` y volver a levantar.

## Scripts (backend)

| Script | Descripción |
| --- | --- |
| `npm run dev` | API en modo watch |
| `npm run build` | Compila a `dist/` (`tsconfig.build.json`) |
| `npm start` | Ejecuta `dist/server.js` |
| `npm run typecheck` | `tsc --noEmit` (incluye `tests/`) |
| `npm test` | Vitest + Supertest (requiere `credit_test`) |
| `npm run db:migrate` | Aplica esquema y semillas (idempotente) |

## Usuarios de prueba

Autenticación de demostración con selector de usuarios sembrados. No hay
contraseñas:

| Usuario | Rol |
| --- | --- |
| `sol-1`, `sol-2` | SOLICITANTE |
| `ana-1` | ANALISTA |

```bash
curl -s -X POST localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' -d '{"userId":"ana-1"}'
```

## Endpoints

| Método | Ruta | Rol | Descripción |
| --- | --- | --- | --- |
| GET | `/health` | — | Liveness |
| GET | `/api/auth/users` | — | Selector de usuarios demo |
| POST | `/api/auth/login` | — | Devuelve JWT |
| GET | `/api/auth/me` | ambos | Usuario autenticado |
| POST | `/api/requests` | SOLICITANTE | Crear solicitud |
| GET | `/api/requests` | ambos | Propias o todas (según rol) |
| GET | `/api/requests/:id` | ambos | Detalle |
| POST | `/api/requests/:id/start-review` | ANALISTA | CREADA → EN_REVISION |
| POST | `/api/requests/:id/approve` | ANALISTA | EN_REVISION → APROBADA |
| POST | `/api/requests/:id/reject` | ANALISTA | EN_REVISION → RECHAZADA |
| POST | `/api/requests/:id/bureau-check` | ambos | Consulta al buró |
| GET | `/api/budget` | ANALISTA | Presupuesto disponible |
| GET | `/api/audit` | ANALISTA | Auditoría (`requestId`, `afterId`, `limit`) |
| GET | `/internal/bureau/:documentId` | — | Mock del buró (2–4 s, ~30 % 503) |

## Reglas de negocio implementadas

1. Monto ≤ 40 % del ingreso mensual (Zod + `CHECK` en PostgreSQL).
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

- **"PENDIENTE"** = solicitud sin resolver (`CREADA` o `EN_REVISION`).
- **Ventana de 30 días** contada desde `created_at` de la solicitud previa.
- **Consulta al buró** no obligatoria para aprobar (decisión abierta).
- **Dinero** en `NUMERIC(14,2)`; se convierte a `number` solo al mapear.
- **Config validada con Zod** al arrancar: un `PORT=abc` o una tasa de fallo
  fuera de rango detienen el proceso con un mensaje claro.
- **`.env` sin `dotenv`**: se carga con `--env-file-if-exists` de Node.
- **Migración automática** en el arranque porque el esquema es idempotente;
  en producción sería un paso de despliegue.

## Pruebas

- `tests/domain.test.ts`: regla del 40 %, plazos y amortización.
- `tests/bureau.client.test.ts`: reintentos con `fetch` simulado (sin esperas).
- `tests/credit.integration.test.ts` (PostgreSQL real, `credit_test`):
  ventana de 30 días, transiciones inválidas, motivo de rechazo, presupuesto
  insuficiente, **8 aprobaciones simultáneas descuentan una sola vez**,
  permisos por rol e inmutabilidad del audit log.
- `tests/health.test.ts`: humo de `/health` y formato de error 404.

```bash
cd backend
npm run typecheck && npm test
```

## Estructura

```text
backend/
├── Dockerfile
├── src/
│   ├── app.ts                  # createApp() sin listen (testeable)
│   ├── server.ts               # arranque, migración y shutdown
│   ├── config.ts               # variables de entorno validadas con Zod
│   ├── db/                     # pool.ts, schema.ts, migrate.ts
│   ├── domain/                 # types, errors, rules, amortization
│   ├── http/                   # asyncHandler, validate, errorHandler, auth
│   └── modules/                # auth, requests, audit, budget, bureau
└── tests/
```

## Fase 2 (pendiente)

Vite + React + TypeScript estricto, React Router y TanStack Query: selector de
usuario, formulario con amortización, panel de analista, auditoría con polling
y estados de carga del buró sin bloquear la navegación. Dockerfile con nginx
como proxy a `/api` (sin exponer `/internal`).
