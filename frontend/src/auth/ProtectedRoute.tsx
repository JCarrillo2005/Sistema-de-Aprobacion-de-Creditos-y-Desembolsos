import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Role } from "../api/types";
import { homePathFor } from "../lib/routes";
import { useAuth } from "./AuthContext";

// Ojo: esto es solo experiencia de usuario. Los permisos reales los aplica el servidor.
export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page-state" role="status">
        <span className="spinner" aria-hidden="true" /> Verificando sesión…
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }
  return <Outlet />;
}
