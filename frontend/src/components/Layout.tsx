import { useMutationState } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { initials, roleLabel } from "../lib/labels";
import { BudgetWidget } from "./BudgetWidget";

interface NavItem {
  to: string;
  label: string;
  index: string;
  end?: boolean;
}

function sectionLabel(pathname: string): string {
  if (pathname.startsWith("/analyst")) {
    return "Bandeja de revisión";
  }
  if (pathname.startsWith("/audit")) {
    return "Auditoría";
  }
  if (pathname === "/requests/new") {
    return "Nueva solicitud";
  }
  if (pathname.startsWith("/requests/")) {
    return "Expediente de crédito";
  }
  if (pathname.startsWith("/requests")) {
    return "Mis solicitudes";
  }
  return "Inicio";
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Las consultas al buró viven en el caché global: el usuario puede navegar mientras tanto.
  const pendingBureau = useMutationState({
    filters: { mutationKey: ["bureau"], status: "pending" },
    select: (mutation) => mutation.state.variables as number | undefined,
  });

  useEffect(() => {
    if (!profileOpen) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (
        profileRef.current &&
        event.target instanceof Node &&
        !profileRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileOpen]);

  function handleLogout() {
    setProfileOpen(false);
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
        { to: "/audit", label: "Auditoría", index: "02" },
      ]
    : [
        { to: "/requests", label: "Mis solicitudes", index: "01", end: true },
        { to: "/requests/new", label: "Nueva solicitud", index: "02" },
      ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">
            C
          </span>
          <div className="brand-lockup">
            <strong>Cauce</strong>
            <span className="eyebrow">Mesa de crédito</span>
          </div>
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

          <section className="session-card" aria-label="Sesión activa">
            <div className="session-profile">
              <span className="avatar" aria-hidden="true">
                {initials(user.name)}
              </span>
              <div className="session-identity">
                <strong className="session-name">{user.name}</strong>
                <span className="session-email mono">
                  {user.email ?? roleLabel(user.role)}
                </span>
              </div>
            </div>
            <div className="session-actions">
              <span className={`role-badge role-${user.role.toLowerCase()}`}>
                {roleLabel(user.role)}
              </span>
              <button type="button" className="link-button" onClick={handleLogout}>
                Cerrar sesión
              </button>
            </div>
          </section>

          <p className="sidebar-foot">Uso interno · © 2026 Cauce</p>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="topbar-context">
            <span className="eyebrow">Sección</span>
            <strong>{sectionLabel(location.pathname)}</strong>
          </div>

          {pendingBureau.length > 0 && (
            <span className="bureau-ticker" role="status">
              <span className="spinner" aria-hidden="true" />
              Buró de crédito en consulta · #{pendingBureau[0] ?? "—"}
            </span>
          )}

          {isAnalyst && <BudgetWidget variant="chip" />}

          <div className="topbar-user" ref={profileRef}>
            <button
              type="button"
              className="profile-trigger"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              aria-controls="profile-menu"
              onClick={() => setProfileOpen((open) => !open)}
            >
              <span className="topbar-user-identity">
                <strong className="topbar-user-name">{user.name}</strong>
                <span className="topbar-user-role">{roleLabel(user.role)}</span>
              </span>
              <span className="avatar avatar--sm" aria-hidden="true">
                {initials(user.name)}
              </span>
              <span className="profile-chevron" aria-hidden="true">
                ▾
              </span>
            </button>

            {profileOpen && (
              <div
                id="profile-menu"
                className="profile-dropdown"
                role="menu"
                aria-label="Cuenta"
              >
                <div className="profile-dropdown-head">
                  <span className="avatar" aria-hidden="true">
                    {initials(user.name)}
                  </span>
                  <div>
                    <strong>{user.name}</strong>
                    <span className="mono">
                      {user.email ?? roleLabel(user.role)}
                    </span>
                  </div>
                </div>
                <div className="profile-dropdown-role">
                  <span className={`role-badge role-${user.role.toLowerCase()}`}>
                    {roleLabel(user.role)}
                  </span>
                  <span className="muted">Sesión activa</span>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="profile-menu-item"
                  onClick={handleLogout}
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
