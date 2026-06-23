import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({ roles, children }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm font-mono text-muted-foreground">
        Loading workspace…
      </div>
    );
  }
  if (user === false) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
