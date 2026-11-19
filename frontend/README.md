# Frontend — Sistema de Aprobación de Créditos y Desembolsos

SPA en **React 18 + TypeScript estricto** con **Vite**, **React Router** y
**TanStack Query**. Se sirve con nginx, que además hace de proxy de `/api/`
hacia el backend y bloquea `/internal/*`.

## Desarrollo local

Requisitos: Node.js >= 22.9, el backend en `http://localhost:3000` y PostgreSQL
arriba (`docker compose up -d db` desde la raíz del repositorio).

```bash
npm install
npm run dev        # http://localhost:5173
```

Vite proxea `/api` a `http://localhost:3000`. Para apuntar a otro backend:

```bash
# Linux / macOS
VITE_PROXY_TARGET=http://localhost:4000 npm run dev

# PowerShell
$env:VITE_PROXY_TARGET="http://localhost:4000"; npm run dev
```

## Scripts

| Script              | Descripción                                      |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | Servidor de desarrollo con HMR                   |
| `npm run typecheck` | `tsc --noEmit` (incluye `vite.config.ts`)        |
| `npm run build`     | Typecheck + build de producción en `dist/`       |
| `npm run preview`   | Sirve `dist/` (el proxy de `/api` se mantiene)   |

## Docker

Desde la raíz del repositorio:

```bash
docker compose up --build
```

La aplicación queda en **http://localhost:8080**. El contenedor de nginx:

- Sirve el SPA y aplica el fallback a `index.html` para las rutas de React Router.
- Proxea `/api/` a `http://backend:3000` (timeout de 60 s para la consulta al buró).
- Responde `404` en `/internal/*`: el mock del buró nunca se expone al navegador.

## Estructura

```text
src/
├── main.tsx                 # QueryClient, AuthProvider, BrowserRouter
├── App.tsx                  # Rutas y protección por rol
├── api/                     # tipos, cliente HTTP, endpoints y hooks de TanStack Query
├── auth/                    # sesión (token + /auth/me) y ProtectedRoute
├── components/              # shell, presupuesto, estados, ciclo de vida, buró y simulador
├── lib/                     # reglas, amortización, formato y rutas
└── pages/                   # login, solicitudes, panel de analista y auditoría
```

## Diseño e interacción

La interfaz sigue una estética _Modern Institutional Ledger_: fondos neutros,
bordes de 1 px, sin sombras decorativas y sin dependencias de UI externas
(todo se resuelve en `styles.css` con tokens CSS). Los montos, tasas, plazos,
documentos y timestamps usan siempre tipografía monoespaciada con
`font-variant-numeric: tabular-nums`.

- **Shell:** barra lateral con navegación, selector rápido de sesión demo y
  widget de presupuesto global para analistas; la barra superior muestra el
  módulo activo, la sesión y un indicador compacto del presupuesto. El widget
  comparte la misma query de TanStack Query, sin copias en estado local.
- **Estados:** `StatusBadge` y `StatusCode` fijan la semántica de `CREADA`,
  `EN_REVISION`, `APROBADA` y `RECHAZADA`. El `LifecycleStepper` muestra el
  ciclo permitido sin reversiones.
- **Identificación:** el documento se normaliza a mayúsculas mientras se escribe
  y muestra su estado de formato en vivo (los mismos mensajes de `lib/rules.ts`),
  sin duplicar reglas ni bloquear el envío antes de tiempo.
- **Originación:** vista dividida con simulador sticky, medidor de capacidad
  en tiempo real (40 % del ingreso) y cronograma francés colapsable. Las
  reglas viven en `lib/rules.ts` y `lib/amortization.ts`.
- **Analista:** bandeja con filtros rápidos, antigüedad y ratio de
  endeudamiento; panel del buró con estados idle/carga/error/éxito sin
  bloquear la navegación; zona de dictamen con alerta preventiva de
  presupuesto (HTTP 422) y contador de 15 caracteres para el rechazo.
- **Auditoría:** bitácora densa con transiciones `ORIGEN → DESTINO`, actor,
  timestamp legible (ISO 8601 en `title`), distintivo de inmutabilidad y
  polling con indicador de sincronización.

No se añadieron dependencias: iconografía, skeleton, medidores y stepper se
resuelven con CSS y componentes ligeros propios.

## Notas

- El rol **nunca** se guarda ni se confía desde el cliente: se obtiene de
  `/api/auth/me`, que lo lee de la base de datos. Los permisos reales se aplican
  en el backend.
- La consulta al buró es una mutación global de TanStack Query: sigue en curso
  aunque el usuario navegue, y el header muestra un indicador mientras tanto.
- La validación del formulario replica las reglas del backend en `lib/rules.ts`.
  El backend sigue siendo la fuente de verdad.
- No hay pruebas automatizadas del frontend; la lógica crítica de negocio está
  cubierta por las pruebas del backend (`backend/tests`). El frontend se valida
  con `npm run typecheck` y `npm run build`.
