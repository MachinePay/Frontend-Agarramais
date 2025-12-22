import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function Navbar() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="bg-background-dark text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-primary">🎯</span>
              <span className="text-xl font-bold">Agarra Mais</span>
            </Link>

            <div className="hidden md:block ml-10">
              <div className="flex items-baseline space-x-4">
                <Link
                  to="/"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-primary/20 transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  to="/movimentacoes"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-primary/20 transition-colors"
                >
                  Movimentações
                </Link>
                <Link
                  to="/maquinas"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-primary/20 transition-colors"
                >
                  Máquinas
                </Link>
                {usuario?.role === "ADMIN" && (
                  <>
                    <Link
                      to="/lojas"
                      className="px-3 py-2 rounded-md text-sm font-medium hover:bg-primary/20 transition-colors"
                    >
                      Lojas
                    </Link>
                    <Link
                      to="/produtos"
                      className="px-3 py-2 rounded-md text-sm font-medium hover:bg-primary/20 transition-colors"
                    >
                      Produtos
                    </Link>{" "}
                    <Link
                      to="/usuarios"
                      className="px-3 py-2 rounded-md text-sm font-medium hover:bg-primary/20 transition-colors"
                    >
                      Usuários
                    </Link>{" "}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right hidden md:block">
              <div className="text-sm font-medium">{usuario?.nome}</div>
              <div className="text-xs text-gray-400">
                {usuario?.role === "ADMIN" ? "Administrador" : "Funcionário"}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
