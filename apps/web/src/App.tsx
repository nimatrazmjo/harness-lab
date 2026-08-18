import { Navigate, Route, Routes } from "react-router-dom";
import { AdminAuditLogPage } from "./features/admin/AdminAuditLogPage";
import { AdminEncountersPage } from "./features/admin/AdminEncountersPage";
import { AdminRosterPage } from "./features/admin/AdminRosterPage";
import { AdminRoute } from "./features/admin/AdminRoute";
import { AdminShell } from "./features/admin/AdminShell";
import { AdminTemplatesPage } from "./features/admin/AdminTemplatesPage";
import { LoginPage } from "./features/auth/LoginPage";
import { EncounterListPage } from "./features/encounter/EncounterListPage";
import { EncounterWorkspacePage } from "./features/encounter/EncounterWorkspacePage";
import { useAuth } from "./state/auth-context";

function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/encounters"
        element={
          <ProtectedRoute>
            <EncounterListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/encounters/:encounterId"
        element={
          <ProtectedRoute>
            <EncounterWorkspacePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminShell />
          </AdminRoute>
        }
      >
        <Route index element={<Navigate to="encounters" replace />} />
        <Route path="encounters" element={<AdminEncountersPage />} />
        <Route path="roster" element={<AdminRosterPage />} />
        <Route path="templates" element={<AdminTemplatesPage />} />
        <Route path="audit-log" element={<AdminAuditLogPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/encounters" replace />} />
    </Routes>
  );
}
