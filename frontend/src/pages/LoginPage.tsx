import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useUsers } from "../api/hooks";
import { useAuth } from "../auth/AuthContext";
import { initials, roleLabel } from "../lib/labels";
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
  const hasUsers = users.length > 0;

  return (
    <div className="login-shell">
      <section className="login-aside" aria-label="Acerca de Cauce">
        <div className="login-aside-top">
          <div className="login-brand">
            <span className="brand-mark brand-mark--lg" aria-hidden="true">
              C
            </span>
            <span className="eyebrow">Cauce · Mesa de crédito</span>
          </div>
          <h1>Originación y desembolsos bajo control.</h1>
          <p className="login-lede">
            Evalúa solicitudes, administra el presupuesto y conserva la
            trazabilidad de cada decisión.
          </p>
        </div>

        <div className="login-aside-bottom">
          <dl className="login-facts">
            <div>
              <dt>Acceso</dt>
              <dd>SSO corporativo</dd>
            </div>
            <div>
              <dt>Perfiles</dt>
              <dd>Operación y análisis</dd>
            </div>
            <div>
              <dt>Auditoría</dt>
              <dd>Registro inmutable</dd>
            </div>
          </dl>
          <p className="fineprint mono">Uso interno · © 2026 Cauce</p>
        </div>
      </section>

      <main className="login-main">
        <div className="panel login-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Acceso seguro</span>
              <h2>Inicia sesión</h2>
            </div>
            <span className="immutable-badge mono">SSO</span>
          </div>

          <p className="login-note">
            Selecciona tu cuenta corporativa para continuar.
          </p>

          {usersQuery.isLoading && (
            <div className="page-state" role="status">
              <span className="spinner" aria-hidden="true" />
              Cargando cuentas…
            </div>
          )}

          {usersQuery.isError && (
            <div className="alert alert-error" role="alert">
              <p>No pudimos cargar las cuentas corporativas.</p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void usersQuery.refetch()}
              >
                Reintentar
              </button>
            </div>
          )}

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          {!usersQuery.isLoading && !usersQuery.isError && !hasUsers && (
            <div className="empty-state empty-state--inline">
              <p className="muted">
                No hay cuentas habilitadas. Contacta a soporte de TI.
              </p>
            </div>
          )}

          {hasUsers && (
            <ul className="login-list">
              {users.map((candidate) => {
                const pending = pendingId === candidate.id;
                return (
                  <li key={candidate.id}>
                    <button
                      type="button"
                      className="login-option"
                      disabled={pendingId !== null}
                      aria-busy={pending}
                      aria-label={`Entrar como ${candidate.name}`}
                      onClick={() => void handleLogin(candidate.id)}
                    >
                      <span className="avatar" aria-hidden="true">
                        {initials(candidate.name)}
                      </span>
                      <span className="login-option-identity">
                        <span className="login-option-name">
                          {candidate.name}
                        </span>
                        <span className="login-option-email mono">
                          {candidate.email ?? "Cuenta corporativa"}
                        </span>
                      </span>
                      <span
                        className={`role-badge role-${candidate.role.toLowerCase()}`}
                      >
                        {roleLabel(candidate.role)}
                      </span>
                      <span className="login-option-action" aria-hidden="true">
                        {pending ? <span className="spinner" /> : "→"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="login-support">
            ¿Problemas para acceder? Contacta a soporte de TI.
          </p>
        </div>
      </main>
    </div>
  );
}
