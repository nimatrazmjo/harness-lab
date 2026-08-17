import { Navigate, Route, Routes } from "react-router-dom";
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
      <Route path="*" element={<Navigate to="/encounters" replace />} />
    </Routes>
  );
}
