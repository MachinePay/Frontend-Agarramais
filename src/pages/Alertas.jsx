import AlertAdmin from "../components/AlertAdmin";
import { useAuth } from "../contexts/AuthContext";

export default function Alertas() {
  const { usuario } = useAuth();
  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern py-12 px-4">
      <h1 className="text-5xl font-extrabold text-yellow-700 mb-10 text-center drop-shadow-lg">
        ⚠️ Alertas de Movimentação Inconsistente
      </h1>
      {/* Seção detalhada dos alertas de movimentação inconsistentes */}
      {usuario?.role === "ADMIN" && (
        <div id="alertas-movimentacao-inconsistente" className="mb-8">
          <AlertAdmin />
        </div>
      )}
    </div>
  );
}
