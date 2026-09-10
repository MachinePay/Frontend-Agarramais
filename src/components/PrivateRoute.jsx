import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function PrivateRoute({ children, adminOnly = false, roles = [] }) {
  const { signed, loading, isAdmin, hasRole, usuario } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!signed) {
    return <Navigate to="/login" />;
  }

  if (adminOnly && !isAdmin()) {
    return <Navigate to="/" />;
  }

  if (roles.length > 0 && !hasRole(...roles)) {
    return <Navigate to="/" />;
  }

  // Funcionário comercial tem acesso apenas às rotas que explicitamente permitem o role COMERCIAL
  if (usuario?.role === "COMERCIAL" && !roles.includes("COMERCIAL")) {
    return <Navigate to="/transportadoras" />;
  }

  return children;
}
