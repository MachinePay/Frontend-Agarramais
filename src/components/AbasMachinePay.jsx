import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// Abas da área Machine Pay. "Criar Caixas" só aparece para ADMIN.
export function AbasMachinePay() {
  const { isAdmin } = useAuth();

  const abas = [
    { to: "/machine-pay", label: "📡 Máquinas", end: true },
    ...(isAdmin() ? [{ to: "/machine-pay/criar-caixas", label: "🏠 Criar Caixas" }] : []),
  ];

  if (abas.length < 2) return null;

  return (
    <nav className="mb-6 flex gap-2 border-b border-gray-200">
      {abas.map((aba) => (
        <NavLink
          key={aba.to}
          to={aba.to}
          end={aba.end}
          className={({ isActive }) =>
            `-mb-px rounded-t-lg border px-4 py-2 text-sm font-semibold transition-colors ${
              isActive
                ? "border-gray-200 border-b-white bg-white text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`
          }
        >
          {aba.label}
        </NavLink>
      ))}
    </nav>
  );
}
