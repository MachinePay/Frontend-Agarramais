import React, { useState, useContext } from "react";
import Swal from "sweetalert2";
import { AuthContext } from "../contexts/AuthContext";

const emojiVeiculo = (tipo, emoji) => emoji || (tipo === "moto" ? "🏍️" : "🚗");

export default function ControleVeiculos({
  veiculos = [],
  onRefresh,
  loading,
}) {
  const { usuario } = useContext(AuthContext);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalFinalizarAberto, setModalFinalizarAberto] = useState(false);
  const [veiculoSelecionado, setVeiculoSelecionado] = useState(null);
  const [form, setForm] = useState({
    estado: "Bom",
    obs: "",
    km: "",
    modo: "trabalho",
    combustivel: "5",
    limpeza: "esta limpo",
  });
  const [formFinalizar, setFormFinalizar] = useState({
    estado: "Bom",
    obs: "",
    km: "",
    combustivel: "5",
    limpeza: "esta limpo",
  });

  const abrirModal = (veiculo) => {
    setVeiculoSelecionado(veiculo);
    setForm({
      estado: veiculo.estado,
      obs: "",
      km: veiculo.km,
      modo: "trabalho",
      combustivel: "5",
      limpeza: "esta limpo",
    });
    setModalAberto(true);
  };

  const abrirModalFinalizar = (veiculo) => {
    setVeiculoSelecionado(veiculo);
    setFormFinalizar({
      estado: veiculo.estado,
      obs: "",
      km: veiculo.km,
      combustivel: "5",
      limpeza: "esta limpo",
    });
    setModalFinalizarAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setVeiculoSelecionado(null);
  };
  const fecharModalFinalizar = () => {
    setModalFinalizarAberto(false);
    setVeiculoSelecionado(null);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };
  const handleFormFinalizarChange = (e) => {
    const { name, value } = e.target;
    setFormFinalizar((prev) => ({ ...prev, [name]: value }));
  };

  // Exemplo: para atualizar o status do veículo na API, use fetch/axios e depois onRefresh()
  const pilotarVeiculo = async () => {
    if (!veiculoSelecionado) return;
    try {
      await fetch(`/api/veiculos/${veiculoSelecionado.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...veiculoSelecionado, emUso: true }),
      });
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error("Erro ao pilotar:", error);
      Swal.fire("Erro", "Não foi possível iniciar o uso do veículo.", "error");
    }
    fecharModal();
  };

  const finalizarVeiculo = async () => {
    if (!veiculoSelecionado) return;
    try {
      await fetch(`/api/veiculos/${veiculoSelecionado.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...veiculoSelecionado,
          emUso: false,
          nivelCombustivel: getCombustivelLabel(formFinalizar.combustivel),
        }),
      });
      if (onRefresh) onRefresh();
      
      // Movemos o alerta de sucesso para dentro do try para só aparecer se der certo
      Swal.fire({
        icon: "success",
        title: `${usuario?.nome || "Funcionário"} emburacou ${veiculoSelecionado?.nome}`,
        showConfirmButton: true,
        confirmButtonText: "OK",
      });
    } catch (error) {
      console.error("Erro ao finalizar:", error);
      Swal.fire("Erro", "Não foi possível finalizar o veículo.", "error");
    }
    fecharModalFinalizar();
  };

  // Função para exibir o texto do combustível
  function getCombustivelLabel(valor) {
    switch (valor) {
      case "5":
        return "5 palzinhos";
      case "4":
        return "4 palzinhos";
      case "3":
        return "3 palzinhos";
      case "2":
        return "2 palzinhos";
      case "1":
        return "1 palzinho";
      case "0":
        return "Vazio";
      default:
        return valor;
    }
  }

  if (loading) return <div className="p-6">Carregando veículos...</div>;

  return (
    <div className="flex flex-wrap gap-6 p-6">
      {veiculos.map((veiculo) => (
        <div
          key={veiculo.id}
          className={`rounded-lg shadow-md p-4 w-64 transition-all relative ${
            veiculo.emUso ? "filter grayscale opacity-70" : "bg-white"
          }`}
        >
          <div className="flex items-center gap-2 text-2xl mb-2">
            <span>{emojiVeiculo(veiculo.tipo, veiculo.emoji)}</span>
            <span className="font-bold text-lg">{veiculo.nome}</span>
          </div>
          <div className="text-gray-600 text-sm mb-2">
            Modelo: {veiculo.modelo}
          </div>
          <div className="flex gap-4 mb-2">
            <div>
              <div className="text-xs text-gray-500">Estado</div>
              <div>{veiculo.estado}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Km</div>
              <div>{veiculo.km}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Gasolina</div>
              <div>
                {veiculo.nivelCombustivel || veiculo.combustivel || "-"}
              </div>
            </div>
          </div>
          {!veiculo.emUso ? (
            <button
              className="mt-2 px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              onClick={() => abrirModal(veiculo)}
              disabled={veiculo.emUso}
            >
              Pilotar
            </button>
          ) : (
            <>
              <div className="absolute top-2 right-2 bg-black text-white text-xs px-2 py-1 rounded">
                Em uso
              </div>
              {/* Simulando que o usuário atual é o responsável pelo uso, então mostra o botão finalizar */}
              <button
                className="mt-2 px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                onClick={() => abrirModalFinalizar(veiculo)}
              >
                Finalizar
              </button>
            </>
          )}
        </div>
      ))}
      {/* Modal Finalizar */}
      {modalFinalizarAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-lg relative">
            <h2 className="text-lg font-bold mb-4">
              Finalizar uso de {veiculoSelecionado?.nome}
            </h2>
            <div className="mb-3">
              <label className="block text-sm font-medium">
                Estado da moto
              </label>
              <select
                name="estado"
                value={formFinalizar.estado}
                onChange={handleFormFinalizarChange}
                className="w-full border rounded p-1"
              >
                <option value="Bom">Bom</option>
                <option value="Ruim">Ruim</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">Obs:</label>
              <input
                name="obs"
                value={formFinalizar.obs}
                onChange={handleFormFinalizarChange}
                className="w-full border rounded p-1"
                placeholder="Descreva o problema (opcional)"
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">Km final</label>
              <input
                name="km"
                type="number"
                value={formFinalizar.km}
                onChange={handleFormFinalizarChange}
                className="w-full border rounded p-1"
                min="0"
                onWheel={(e) => e.target.blur()}
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">
                Nível de combustível
              </label>
              <select
                name="combustivel"
                value={formFinalizar.combustivel}
                onChange={handleFormFinalizarChange}
                className="w-full border rounded p-1"
              >
                <option value="5">5 palzinhos</option>
                <option value="4">4 palzinhos</option>
                <option value="3">3 palzinhos</option>
                <option value="2">2 palzinhos</option>
                <option value="1">1 palzinho</option>
                <option value="0">Vazio</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium">
                Nível de limpeza
              </label>
              <select
                name="limpeza"
                value={formFinalizar.limpeza}
                onChange={handleFormFinalizarChange}
                className="w-full border rounded p-1"
              >
                <option value="esta limpo">Está limpo</option>
                <option value="precisa limpar">Precisa limpar</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-1 bg-gray-300 rounded hover:bg-gray-400"
                onClick={fecharModalFinalizar}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                onClick={finalizarVeiculo}
              >
                Finalizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-lg relative">
            <h2 className="text-lg font-bold mb-4">
              Pilotar {veiculoSelecionado?.nome}
            </h2>
            <div className="mb-3">
              <label className="block text-sm font-medium">
                Estado da moto
              </label>
              <select
                name="estado"
                value={form.estado}
                onChange={handleFormChange}
                className="w-full border rounded p-1"
              >
                <option value="Bom">Bom</option>
                <option value="Ruim">Ruim</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">Obs:</label>
              <input
                name="obs"
                value={form.obs}
                onChange={handleFormChange}
                className="w-full border rounded p-1"
                placeholder="Descreva o problema (opcional)"
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">Km inicial</label>
              <input
                name="km"
                type="number"
                value={form.km}
                onChange={handleFormChange}
                className="w-full border rounded p-1"
                min="0"
                onWheel={(e) => e.target.blur()}
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">Modo</label>
              <select
                name="modo"
                value={form.modo}
                onChange={handleFormChange}
                className="w-full border rounded p-1"
              >
                <option value="trabalho">Trabalho</option>
                <option value="emprestado">Emprestado</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium">
                Nível de combustível
              </label>
              <select
                name="combustivel"
                value={form.combustivel}
                onChange={handleFormChange}
                className="w-full border rounded p-1"
              >
                <option value="5">5 palzinhos</option>
                <option value="4">4 palzinhos</option>
                <option value="3">3 palzinhos</option>
                <option value="2">2 palzinhos</option>
                <option value="1">1 palzinho</option>
                <option value="0">Vazio</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium">
                Nível de limpeza
              </label>
              <select
                name="limpeza"
                value={form.limpeza}
                onChange={handleFormChange}
                className="w-full border rounded p-1"
              >
                <option value="esta limpo">Está limpo</option>
                <option value="precisa limpar">Precisa limpar</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-1 bg-gray-300 rounded hover:bg-gray-400"
                onClick={fecharModal}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={pilotarVeiculo}
              >
                Pilotar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
