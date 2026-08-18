import { Navigate } from "react-router-dom";
import { useAuth } from "../../state/auth-context";

/** Gates /admin to the admin role — mirrors App.tsx's ProtectedRoute pattern. */
export function AdminRoute({ children }: { children: React.ReactElement }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/encounters" replace />;
  return children;
}
