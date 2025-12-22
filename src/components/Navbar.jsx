import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function Navbar() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-gradient-to-r from-background-dark via-gray-900 to-background-dark text-white shadow-2xl border-b-4 border-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo e Brand */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent-yellow rounded-full blur-md opacity-75 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative bg-gradient-to-br from-primary to-accent-yellow p-3 rounded-full shadow-lg">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                  </svg>
                </div>
              </div>
              <div>
                <span className="text-2xl font-bold bg-gradient-to-r from-primary via-accent-yellow to-primary bg-clip-text text-transparent">
                  Agarra Mais
                </span>
                <p className="text-xs text-gray-400">
                  Sistema de Gestão de Pelúcias
                </p>
              </div>
            </Link>

            {/* Menu Desktop */}
            <div className="hidden lg:block ml-12">
              <div className="flex items-center space-x-2">
                <Link
                  to="/"
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive("/")
                      ? "bg-gradient-to-r from-primary to-accent-yellow text-white shadow-lg scale-105"
                      : "text-gray-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  📊 Dashboard
                </Link>
                <Link
                  to="/movimentacoes"
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive("/movimentacoes")
                      ? "bg-gradient-to-r from-primary to-accent-yellow text-white shadow-lg scale-105"
                      : "text-gray-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  📦 Movimentações
                </Link>
                <Link
                  to="/maquinas"
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive("/maquinas")
                      ? "bg-gradient-to-r from-primary to-accent-yellow text-white shadow-lg scale-105"
                      : "text-gray-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  🎮 Máquinas
                </Link>
                {usuario?.role === "ADMIN" && (
                  <>
                    <Link
                      to="/lojas"
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive("/lojas")
                          ? "bg-gradient-to-r from-primary to-accent-yellow text-white shadow-lg scale-105"
                          : "text-gray-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      🏪 Lojas
                    </Link>
                    <Link
                      to="/produtos"
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive("/produtos")
                          ? "bg-gradient-to-r from-primary to-accent-yellow text-white shadow-lg scale-105"
                          : "text-gray-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      🧸 Produtos
                    </Link>
                    <Link
                      to="/usuarios"
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive("/usuarios")
                          ? "bg-gradient-to-r from-primary to-accent-yellow text-white shadow-lg scale-105"
                          : "text-gray-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      👥 Usuários
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* User Info e Logout */}
          <div className="flex items-center space-x-4">
            <div className="hidden md:block text-right bg-white/5 px-4 py-2 rounded-lg border border-white/10">
              <div className="text-sm font-semibold text-white">
                {usuario?.nome}
              </div>
              <div className="text-xs text-accent-cream flex items-center justify-end gap-1">
                {usuario?.role === "ADMIN" ? (
                  <>
                    <svg
                      className="w-3 h-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Administrador
                  </>
                ) : (
                  "Funcionário"
                )}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sair
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
