import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useEffect, useRef, useState } from "react";

export function Navbar() {
  const { usuario, logout, hasRole, alertasManutencaoCount } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const temAlertaManutencao = alertasManutencaoCount > 0;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  const closeMenu = () => setIsMenuOpen(false);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  const linkClass = (path, alert = false) =>
    `flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
      alert
        ? "text-white animate-blink-alert"
        : isActive(path)
          ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg"
          : "text-gray-300 hover:bg-white/10 hover:text-white"
    }`;

  const links = [];
  if (usuario?.role !== "COMERCIAL") {
    links.push({ to: "/", label: "📊 Dashboard" });
    links.push({ to: "/movimentacoes", label: "📦 Movimentações" });
    links.push({
      to: "/manutencao",
      label: "🛠️ Manutenção",
      alert: temAlertaManutencao,
      badge: temAlertaManutencao ? alertasManutencaoCount : null,
    });
    if (usuario?.role !== "FUNCIONARIO") {
      links.push({ to: "/maquinas", label: "🎮 Máquinas" });
      links.push({ to: "/lojas", label: "🏪 Lojas" });
      links.push({ to: "/produtos", label: "🧸 Produtos" });
      links.push({ to: "/produtos-a-comprar", label: "🛒 Carrinho" });
    }
    if (usuario?.role === "ADMIN") {
      links.push({ to: "/analise-estoque", label: "📋 Estoque Detalhado" });
      links.push({ to: "/graficos", label: "📈 Gráficos" });
      links.push({ to: "/relatorios", label: "📄 Relatórios" });
      links.push({ to: "/usuarios", label: "👥 Usuários" });
    }
    if (hasRole("ADMIN", "MACHINEPAY")) {
      links.push({ to: "/machine-pay", label: "💳 Machine Pay" });
    }
  }
  if (hasRole("COMERCIAL")) {
    links.push({ to: "/transportadoras", label: "🚚 Transportadoras" });
    links.push({
      to: "/calculadora-pedidos",
      label: "📦 Calculadora de Pedidos",
    });
  }

  return (
    <nav className="relative bg-linear-to-r from-black via-gray-800 to-gray-900 text-white shadow-2xl border-b-4 border-primary z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsMenuOpen((v) => !v)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors shrink-0"
              aria-label="Abrir menu"
              aria-expanded={isMenuOpen}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>

            <Link
              to="/"
              className="flex items-center group shrink-0"
              onClick={closeMenu}
            >
              <img
                src="https://res.cloudinary.com/docrd6tkk/image/upload/v1766765078/LogoAgarraMais_adqqlp.png"
                alt="Agarra Mais"
                className="h-12 sm:h-14 w-auto object-contain transition-transform duration-300 group-hover:scale-110"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            </Link>
          </div>

          {/* User Info e Logout */}
          <div className="flex items-center gap-3 shrink-0">
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
                ) : usuario?.role === "COMERCIAL" ? (
                  "Comercial"
                ) : (
                  "Funcionário"
                )}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="bg-linear-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 px-4 sm:px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
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
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </div>

      {/* Menu Dropdown (mobile e desktop) */}
      {isMenuOpen && (
        <div
          ref={menuRef}
          className="absolute left-0 right-0 top-full bg-gray-900 border-t border-white/10 shadow-2xl max-h-[calc(100vh-5rem)] overflow-y-auto"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={closeMenu}
                  className={linkClass(link.to, link.alert)}
                >
                  <span className="flex-1">{link.label}</span>
                  {link.badge != null && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-red-600 shadow">
                      {link.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>

            {/* User Info Mobile */}
            <div className="md:hidden mt-4 pt-4 border-t border-white/10">
              <div className="bg-white/5 px-4 py-3 rounded-lg border border-white/10">
                <div className="text-sm font-semibold text-white">
                  {usuario?.nome}
                </div>
                <div className="text-xs text-accent-cream flex items-center gap-1 mt-1">
                  {usuario?.role === "ADMIN"
                    ? "Administrador"
                    : usuario?.role === "COMERCIAL"
                      ? "Comercial"
                      : "Funcionário"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
