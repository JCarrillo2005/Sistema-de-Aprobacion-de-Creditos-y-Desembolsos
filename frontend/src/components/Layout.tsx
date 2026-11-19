import { useMutationState } from "@tanstack/react-query";
import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useUsers } from "../api/hooks";
import { useAuth } from "../auth/AuthContext";
import { homePathFor } from "../lib/routes";
import { BudgetWidget } from "./BudgetWidget";

interface NavItem {
  to: string;
  label: string;
  index: string;
  end?: boolean;
}

function sectionLabel(pathname: string): string {
  if (pathname.startsWith("/analyst")) {
    return "Estación de analista";
  }
  if (pathname.startsWith("/audit")) {
    return "Bitácora de auditoría";
  }
  if (pathname === "/requests/new") {
    return "Nueva solicitud";
  }
  if (pathname.startsWith("/requests/")) {
    return "Detalle de solicitud";
  }
  if (pathname.startsWith("/requests")) {
    return "Mis solicitudes";
  }
  return "Consola";
}

export function Layout() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const usersQuery = useUsers();
  const [switching, setSwitching] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);

  // Las consultas al buró viven en el caché global: el usuario puede navegar mientras tanto.
  const pendingBureau = useMutationState({
    filters: { mutationKey: ["bureau"], status: "pending" },
    select: (mutation) => mutation.state.variables as number | undefined,
  });

  // La identidad y el rol del usuario nunca se leen del cliente: login() vuelve
  // a consultar /auth/me en el servidor antes de cambiar la sesión.
  async function handleSwitch(userId: string) {
    setSwitching(userId);
    setSwitchError(null);
    try {
      const next = await login(userId);
      navigate(homePathFor(next.role), { replace: true });
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : "No se pudo cambiar de sesión");
    } finally {
      setSwitching(null);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  if (!user) {
    return null;
  }

  const isAnalyst = user.role === "ANALISTA";
  const links: NavItem[] = isAnalyst
    ? [
        { to: "/analyst", label: "Bandeja de revisión", index: "01", end: true },
        { to: "/audit", label: "Bitácora forense", index: "02" },
      ]
    : [
        { to: "/requests", label: "Mis solicitudes", index: "01", end: true },
        { to: "/requests/new", label: "Nueva solicitud", index: "02" },
      ];

  const sessionOptions = usersQuery.data ?? (user ? [user] : []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <strong>Créditos &amp; Desembolsos</strong>
          <span className="eyebrow">LEDGER OPERATIVO · DEMO</span>
        </div>

        <nav className="side-nav" aria-label="Navegación principal">
          <span className="side-nav-title eyebrow">Navegación</span>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                isActive ? "side-nav-link active" : "side-nav-link"
              }
            >
              <span className="side-nav-index mono">{link.index}</span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          {isAnalyst && <BudgetWidget />}

          <section className="session-card" aria-label="Sesión de demostración">
            <div className="session-card-head">
              <span className="eyebrow">Sesión demo</span>
              <span className={`role-badge role-${user.role.toLowerCase()}`}>
                {user.role}
              </span>
            </div>
            <select
              className="session-select mono"
              aria-label="Cambiar usuario de demostración"
              value={user.id}
              disabled={switching !== null}
              onChange={(event) => void handleSwitch(event.target.value)}
            >
              {sessionOptions.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.id} · {candidate.role}
                </option>
              ))}
            </select>
            {switchError && (
              <p className="session-error" role="alert">
                {switchError}
              </p>
            )}
            <button type="button" className="link-button" onClick={handleLogout}>
              Cerrar sesión
            </button>
          </section>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="topbar-context">
            <span className="eyebrow">Módulo activo</span>
            <strong>{sectionLabel(location.pathname)}</strong>
          </div>

          {pendingBureau.length > 0 && (
            <span className="bureau-ticker" role="status">
              <span className="spinner" aria-hidden="true" />
              Buró en consulta · solicitud #{pendingBureau[0] ?? "—"}
            </span>
          )}

          {isAnalyst && <BudgetWidget variant="chip" />}

          <div className="topbar-user">
            <span className="mono">{user.id}</span>
            <span className="topbar-user-name">{user.name}</span>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
