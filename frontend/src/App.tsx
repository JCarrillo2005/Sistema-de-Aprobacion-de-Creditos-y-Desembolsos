import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { Layout } from "./components/Layout";
import { homePathFor } from "./lib/routes";
import AnalystDashboardPage from "./pages/AnalystDashboardPage";
import AuditPage from "./pages/AuditPage";
import LoginPage from "./pages/LoginPage";
import MyRequestsPage from "./pages/MyRequestsPage";
import NewRequestPage from "./pages/NewRequestPage";
import RequestDetailPage from "./pages/RequestDetailPage";

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? homePathFor(user.role) : "/login"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<HomeRedirect />} />
          <Route path="requests/:id" element={<RequestDetailPage />} />

          <Route element={<ProtectedRoute roles={["SOLICITANTE"]} />}>
            <Route path="requests" element={<MyRequestsPage />} />
            <Route path="requests/new" element={<NewRequestPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={["ANALISTA"]} />}>
            <Route path="analyst" element={<AnalystDashboardPage />} />
            <Route path="audit" element={<AuditPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
