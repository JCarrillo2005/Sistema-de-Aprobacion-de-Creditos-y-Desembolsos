import { Link } from "react-router-dom";
import { useRequests } from "../api/hooks";
import { StatusBadge } from "../components/StatusBadge";
import { formatDateTime, formatMoney } from "../lib/format";

export default function MyRequestsPage() {
  const { data, isLoading, isError, error } = useRequests({
    refetchInterval: 5000,
  });

  return (
    <>
      <div className="page-header">
        <h2>Mis solicitudes</h2>
        <Link to="/requests/new" className="btn btn-primary">
          Nueva solicitud
        </Link>
      </div>

      {isLoading && <p role="status">Cargando solicitudes…</p>}
      {isError && (
        <div className="alert alert-error" role="alert">
          {error.message}
        </div>
      )}

      {data && data.length === 0 && (
        <div className="card">
          <p>Aún no has registrado solicitudes.</p>
          <Link to="/requests/new">Crear la primera solicitud</Link>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="card table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Documento</th>
                <th className="num">Monto</th>
                <th className="num">Plazo</th>
                <th>Estado</th>
                <th>Creada</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.documentId}</td>
                  <td className="num">{formatMoney(item.amount)}</td>
                  <td className="num">{item.termMonths} meses</td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>{formatDateTime(item.createdAt)}</td>
                  <td>
                    <Link to={`/requests/${item.id}`}>Ver detalle</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
