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
        "/relatorios/alertas-movimentacao-inconsistente"
      );
      let alertasInconsistencia = res.data?.alertas || [];

      // Buscar alertas de abastecimento incompleto
      const resAbastecimento = await api.get(
        "/relatorios/alertas-abastecimento-incompleto"
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
        { data: { maquinaId } }
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
              className="border border-yellow-400 bg-yellow-50 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm"
            >
              <div className="flex-1">
                <div className="font-semibold text-yellow-800 mb-1">
                  Máquina:{" "}
                  <button
                    className="underline hover:text-yellow-600"
                    onClick={() => irParaMaquina(alerta.maquinaId)}
                  >
                    {alerta.maquinaNome || alerta.maquinaId}
                  </button>
                </div>
                <div className="text-sm text-gray-700 mb-1">
                  <span className="font-bold">Data:</span>{" "}
                  {alerta.dataMovimentacao
                    ? new Date(alerta.dataMovimentacao).toLocaleString("pt-BR")
                    : "-"}
                </div>
                <div className="text-sm text-gray-700 mb-1">
                  <span className="font-bold">Detalhe:</span>{" "}
                  {alerta.mensagem ||
                    (alerta.tipo === "abastecimento_incompleto"
                      ? `Abastecimento incompleto: padrão ${
                          alerta.padrao
                        }, tinha ${alerta.anterior}, abastecido ${
                          alerta.abastecido
                        }. Motivo: ${alerta.observacao || "-"}`
                      : `Inconsistência detectada: OUT (${alerta.contador_out})/IN (${alerta.contador_in}) não bate com fichas (${alerta.fichas}).`)}
                </div>
                <div className="text-xs text-gray-500">
                  <span className="font-bold">OUT registrado:</span>{" "}
                  {alerta.contador_out} |{" "}
                  <span className="font-bold">IN registrado:</span>{" "}
                  {alerta.contador_in} |{" "}
                  <span className="font-bold">Fichas:</span> {alerta.fichas} |{" "}
                  <span className="font-bold">Saída registrada:</span>{" "}
                  {alerta.sairam ?? "-"}
                </div>
              </div>
              <div className="flex flex-col gap-2 min-w:[120px]">
                <button
                  className="btn-primary btn-sm"
                  onClick={() => navigate(`/maquinas/${alerta.maquinaId}`)}
                >
                  Ver Movimentações
                </button>
                <button
                  className="btn-danger btn-sm"
                  disabled={removendo}
                  onClick={() => corrigirAlerta(alerta.id, alerta.maquinaId)}
                  title="Marcar este alerta como corrigido"
                >
                  {removendo ? "Removendo..." : "Corrigido"}
                </button>
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
                    "pt-BR"
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
