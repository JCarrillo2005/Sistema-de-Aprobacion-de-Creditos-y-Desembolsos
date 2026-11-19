import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useUsers } from "../api/hooks";
import { useAuth } from "../auth/AuthContext";
import { homePathFor } from "../lib/routes";

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const usersQuery = useUsers();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (user) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }

  async function handleLogin(userId: string) {
    setPendingId(userId);
    setError(null);
    try {
      const logged = await login(userId);
      navigate(homePathFor(logged.role), { replace: true });
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "No se pudo iniciar sesión",
      );
      setPendingId(null);
    }
  }

  const users = usersQuery.data ?? [];

  return (
    <div className="login-page">
      <div className="card login-card">
        <h1>Créditos y Desembolsos</h1>
        <p className="muted">
          Selector de usuarios de prueba. En producción esto se reemplazaría por
          credenciales reales o SSO.
        </p>

        {usersQuery.isLoading && <p role="status">Cargando usuarios…</p>}
        {usersQuery.isError && (
          <div className="alert alert-error" role="alert">
            {usersQuery.error.message}
          </div>
        )}
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <ul className="login-list">
          {users.map((candidate) => (
            <li key={candidate.id}>
              <button
                type="button"
                className="login-option"
                disabled={pendingId !== null}
                onClick={() => void handleLogin(candidate.id)}
              >
                <span>
                  <strong>{candidate.name}</strong>
                  <small>{candidate.id}</small>
                </span>
                <span
                  className={`role-badge role-${candidate.role.toLowerCase()}`}
                >
                  {candidate.role}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
