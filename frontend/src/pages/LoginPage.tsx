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
    <div className="login-shell">
      <section className="login-aside" aria-label="Acerca del sistema">
        <div>
          <span className="eyebrow">Consola de crédito · entorno de prueba</span>
          <h1>Aprobación de créditos y desembolsos</h1>
          <p className="login-lede">
            Una bitácora operativa para originar, evaluar y comprometer
            desembolsos con trazabilidad completa.
          </p>
        </div>
        <dl className="login-facts">
          <div>
            <dt>Regla de capacidad</dt>
            <dd className="mono">40 % del ingreso mensual</dd>
          </div>
          <div>
            <dt>Presupuesto global</dt>
            <dd className="mono">$50,000.00 USD</dd>
          </div>
          <div>
            <dt>Auditoría</dt>
            <dd className="mono">Solo inserción · inmutable</dd>
          </div>
        </dl>
        <p className="fineprint">
          Selector de usuarios sembrados. En producción se sustituiría por
          credenciales reales o SSO.
        </p>
      </section>

      <main className="login-main">
        <div className="panel login-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Acceso</span>
              <h2>Selecciona una sesión</h2>
            </div>
            <span className="immutable-badge mono">DEMO</span>
          </div>

          {usersQuery.isLoading && (
            <div className="page-state" role="status">
              <span className="spinner" aria-hidden="true" />
              Cargando usuarios…
            </div>
          )}
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
                  <span className="login-option-id mono">{candidate.id}</span>
                  <span className="login-option-name">{candidate.name}</span>
                  <span
                    className={`role-badge role-${candidate.role.toLowerCase()}`}
                  >
                    {candidate.role}
                  </span>
                  {pendingId === candidate.id && (
                    <span className="spinner" aria-hidden="true" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
