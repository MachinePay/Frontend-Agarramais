import { useState } from "react";
import api from "../../services/api";

export function MovimentacaoModal({ item, tipo, onClose, onSuccess }) {
  const [quantidade, setQuantidade] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const isEntrada = tipo === "ENTRADA";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro("");

    const qtd = Number(quantidade);
    if (!qtd || qtd <= 0) {
      setErro("Informe uma quantidade válida (maior que zero).");
      return;
    }
    if (!motivo.trim()) {
      setErro("Informe o motivo da movimentação.");
      return;
    }

    try {
      setEnviando(true);
      await api.post("/suporte-tecnico/movimentacoes", {
        itemId: item.id,
        tipo,
        quantidade: qtd,
        motivo: motivo.trim(),
      });
      onSuccess();
    } catch (error) {
      setErro(
        error.response?.data?.error ||
          "Erro ao registrar a movimentação. Tente novamente.",
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-slate-900 border border-cyan-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            {isEntrada ? "➕ Entrada" : "➖ Saída"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Fechar"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4 bg-slate-800/60 rounded-lg p-3 border border-slate-700">
          <p className="text-sm text-slate-300">
            {item.tipo === "PECA" ? "🔧" : "📦"}{" "}
            <span className="font-semibold text-white">{item.nome}</span>
            {item.codigo && (
              <span className="text-slate-400"> · {item.codigo}</span>
            )}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Quantidade atual: <span className="font-semibold text-cyan-300">{item.quantidade}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Quantidade
            </label>
            <input
              type="number"
              min="1"
              step="1"
              autoFocus
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white outline-none focus:border-cyan-500 transition-colors"
              placeholder="Ex: 2"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Motivo
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white outline-none focus:border-cyan-500 transition-colors resize-none"
              placeholder={
                isEntrada
                  ? "Ex: Reposição de estoque"
                  : "Ex: Usado na manutenção da máquina 12 da Loja Shopping"
              }
            />
          </div>

          {erro && (
            <div className="mb-4 bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-lg p-3">
              {erro}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={enviando}
              className="px-5 py-2.5 rounded-xl font-semibold text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className={`px-5 py-2.5 rounded-xl font-semibold text-white shadow-lg transition-colors disabled:opacity-50 ${
                isEntrada
                  ? "bg-green-600 hover:bg-green-500"
                  : "bg-red-600 hover:bg-red-500"
              }`}
            >
              {enviando ? "Salvando..." : "Confirmar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
