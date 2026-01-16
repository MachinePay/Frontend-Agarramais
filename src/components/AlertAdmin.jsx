import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { AlertBox, Modal } from "./UIComponents";

// Componente de alerta para administradores
export default function AlertAdmin() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertaSelecionado, setAlertaSelecionado] = useState(null);
  const [removendo, setRemovendo] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (usuario?.role === "ADMIN") {
      carregarAlertas();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line
  }, [usuario]);

  // Busca alertas de inconsistência de movimentação e de abastecimento incompleto
  const carregarAlertas = async () => {
    setLoading(true);
    setErro("");
    try {
      const res = await api.get(
        "/relatorios/alertas-movimentacao-inconsistente",
      );
      let alertasInconsistencia = res.data?.alertas || [];

      // Buscar alertas de abastecimento incompleto
      const resAbastecimento = await api.get(
        "/relatorios/alertas-abastecimento-incompleto",
      );
      let alertasAbastecimento = resAbastecimento.data?.alertas || [];

      // Junta os dois tipos de alerta
      setAlertas([...alertasInconsistencia, ...alertasAbastecimento]);
    } catch (error) {
      setErro("Erro ao buscar alertas de movimentação.", error);
      setAlertas([]);
    } finally {
      setLoading(false);
    }
  };

  // Remove alerta após correção
  const corrigirAlerta = async (alertaId, maquinaId) => {
    setRemovendo(true);
    setErro("");
    try {
      await api.delete(
        `/relatorios/alertas-movimentacao-inconsistente/${alertaId}`,
        { data: { maquinaId } },
      );
      // Recarrega alertas para garantir atualização
      await carregarAlertas();
    } catch (error) {
      setErro("Erro ao remover alerta. Tente novamente.", error);
    } finally {
      setRemovendo(false);
    }
  };

  // Navega para a máquina e suas movimentações
  const irParaMaquina = (maquinaId) => {
    navigate(`/maquinas/${maquinaId}`);
  };

  if (loading) {
    return <div className="p-8 text-center">Carregando alertas...</div>;
  }

  if (usuario?.role !== "ADMIN") {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <span className="text-yellow-500">⚠️</span> Alertas de Movimentação
        Inconsistente
      </h2>
      {erro && <AlertBox type="error" message={erro} />}
      {alertas.length === 0 ? (
        <AlertBox
          type="success"
          message="Nenhum alerta de inconsistência encontrado!"
        />
      ) : (
        <div className="space-y-4">
          {alertas.map((alerta) => (
            <div
              key={alerta.id}
              className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span className="text-yellow-600 text-2xl">⚠️</span>
                <div className="flex-1">
                  {/* Cabeçalho com máquina e data */}
                  <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
                    <div>
                      <p className="text-sm font-bold text-yellow-800">
                        Máquina:{" "}
                        <button
                          className="underline hover:text-yellow-600"
                          onClick={() => irParaMaquina(alerta.maquinaId)}
                        >
                          {alerta.maquinaNome || alerta.maquinaId}
                        </button>
                      </p>
                      <p className="text-xs text-yellow-700">
                        {alerta.dataMovimentacao
                          ? new Date(alerta.dataMovimentacao).toLocaleString(
                              "pt-BR",
                            )
                          : "-"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        onClick={() =>
                          navigate(`/maquinas/${alerta.maquinaId}`)
                        }
                      >
                        Ver Movimentações
                      </button>
                      <button
                        className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                        disabled={removendo}
                        onClick={() =>
                          corrigirAlerta(alerta.id, alerta.maquinaId)
                        }
                        title="Marcar este alerta como corrigido"
                      >
                        {removendo ? "..." : "Corrigido"}
                      </button>
                    </div>
                  </div>

                  {/* Conteúdo do alerta */}
                  <p className="text-xs font-bold text-yellow-800 mb-2">
                    {alerta.mensagem
                      ? "⚠️ " + alerta.mensagem.split(":")[0] + ":"
                      : "⚠️ Inconsistência Detectada:"}
                  </p>

                  {/* Detalhes baseados no tipo de alerta */}
                  {alerta.tipo === "abastecimento_incompleto" ? (
                    <>
                      <p className="text-xs text-yellow-700 mt-1">
                        Capacidade padrão:{" "}
                        <strong>
                          {alerta.capacidadePadrao || alerta.padrao}
                        </strong>{" "}
                        unidades
                      </p>
                      <p className="text-xs text-yellow-700 mt-1">
                        Total antes:{" "}
                        <strong>{alerta.totalAntes || alerta.anterior}</strong>{" "}
                        → Abasteceu: <strong>{alerta.abastecido}</strong> →
                        Ficou com: <strong>{alerta.totalDepois}</strong>
                      </p>
                      <p className="text-xs text-yellow-700 mt-1">
                        Observação:{" "}
                        <strong>{alerta.observacao || "Não informada"}</strong>
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-yellow-700 mt-1">
                        Contador OUT:{" "}
                        <strong>{alerta.contador_out ?? "-"}</strong> | Contador
                        IN: <strong>{alerta.contador_in ?? "-"}</strong>
                      </p>
                      <p className="text-xs text-yellow-700 mt-1">
                        Fichas registradas:{" "}
                        <strong>{alerta.fichas ?? "-"}</strong> | Saída
                        registrada: <strong>{alerta.sairam ?? "-"}</strong>
                      </p>
                      {alerta.mensagem && (
                        <p className="text-xs text-yellow-700 mt-1">
                          {alerta.mensagem.split(":").slice(1).join(":")}
                        </p>
                      )}
                    </>
                  )}

                  <p className="text-xs text-yellow-600 font-semibold mt-3">
                    👉 Verifique a movimentação e corrija se necessário!
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Modal de detalhes se quiser expandir no futuro */}
      <Modal
        isOpen={!!alertaSelecionado}
        onClose={() => setAlertaSelecionado(null)}
        title="Detalhes do Alerta"
      >
        {/* Conteúdo detalhado do alerta */}
        {alertaSelecionado && (
          <div>
            <div className="mb-2 font-bold">
              Máquina:{" "}
              {alertaSelecionado.maquinaNome || alertaSelecionado.maquinaId}
            </div>
            <div className="mb-2">
              Data:{" "}
              {alertaSelecionado.dataMovimentacao
                ? new Date(alertaSelecionado.dataMovimentacao).toLocaleString(
                    "pt-BR",
                  )
                : "-"}
            </div>
            <div className="mb-2">Mensagem: {alertaSelecionado.mensagem}</div>
            <div className="mb-2">
              OUT registrado: {alertaSelecionado.contador_out}
            </div>
            <div className="mb-2">
              IN registrado: {alertaSelecionado.contador_in}
            </div>
            <div className="mb-2">Fichas: {alertaSelecionado.fichas}</div>
            <div className="mb-2">
              Saída registrada: {alertaSelecionado.sairam ?? "-"}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
