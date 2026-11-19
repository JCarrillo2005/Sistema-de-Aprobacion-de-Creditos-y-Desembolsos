import { useMutationState } from "@tanstack/react-query";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Consultas al buró en curso (en cualquier página): el usuario puede seguir navegando.
  const pendingBureau = useMutationState({
    filters: { mutationKey: ["bureau"], status: "pending" },
    select: (mutation) => mutation.state.variables as number | undefined,
  });

  if (!user) {
    return null;
  }

  const links: NavItem[] =
    user.role === "ANALISTA"
      ? [
          { to: "/analyst", label: "Panel de analista" },
          { to: "/audit", label: "Auditoría" },
        ]
      : [
          { to: "/requests", label: "Mis solicitudes", end: true },
          { to: "/requests/new", label: "Nueva solicitud" },
        ];

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <span className="brand">Créditos y Desembolsos</span>
          <nav className="nav" aria-label="Navegación principal">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="header-right">
            {pendingBureau.length > 0 && (
              <span className="pill pill-info" role="status">
                <span className="spinner" aria-hidden="true" />
                Consultando buró ({pendingBureau.length})
              </span>
            )}
            <span className="user-chip">
              {user.name}
              <span className={`role-badge role-${user.role.toLowerCase()}`}>
                {user.role}
              </span>
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleLogout}
            >
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
