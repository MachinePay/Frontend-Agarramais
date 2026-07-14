import { useEffect, useState } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, DataTable, AlertBox } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import LancarGastoVariavel from "../components/LancarGastoVariavel";

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${date.toLocaleDateString("pt-BR")} ${date.toLocaleTimeString(
    "pt-BR",
    { hour: "2-digit", minute: "2-digit" },
  )}`;
};

export function GastosVariaveis() {
  const [lojas, setLojas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modalAberto, setModalAberto] = useState(false);

  const [filtroLojaId, setFiltroLojaId] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");

  const carregarGastos = async () => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (filtroLojaId) params.lojaId = filtroLojaId;
      if (filtroCategoria) params.nome = filtroCategoria;
      if (filtroDataInicio) params.dataInicio = filtroDataInicio;
      if (filtroDataFim) params.dataFim = filtroDataFim;

      const response = await api.get("/gastos-variaveis", { params });
      setGastos(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Erro ao carregar gastos variáveis:", err);
      setError("Erro ao carregar gastos variáveis.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const carregarBase = async () => {
      try {
        const [lojasRes, veiculosRes] = await Promise.all([
          api.get("/lojas"),
          api.get("/veiculos"),
        ]);
        setLojas(lojasRes.data || []);
        setVeiculos(veiculosRes.data || []);
      } catch (err) {
        console.error("Erro ao carregar lojas/veículos:", err);
      }
    };
    carregarBase();
    carregarGastos();
  }, []);

  const handleFiltrar = (event) => {
    event.preventDefault();
    carregarGastos();
  };

  const handleLimparFiltros = () => {
    setFiltroLojaId("");
    setFiltroCategoria("");
    setFiltroDataInicio("");
    setFiltroDataFim("");
    setTimeout(carregarGastos, 0);
  };

  const totalFiltrado = gastos.reduce(
    (acc, gasto) => acc + Number(gasto.valor || 0),
    0,
  );

  const headers = [
    { key: "data", label: "Data", render: (g) => formatDateTime(g.dataInicio) },
    { key: "nome", label: "Categoria" },
    {
      key: "loja",
      label: "Loja",
      render: (g) => g.loja?.nome || lojas.find((l) => l.id === g.lojaId)?.nome || "-",
    },
    { key: "usuario", label: "Usuário", render: (g) => g.usuario?.nome || "-" },
    { key: "veiculo", label: "Veículo", render: (g) => g.veiculo?.nome || "-" },
    {
      key: "valor",
      label: "Valor",
      render: (g) => `R$ ${formatCurrency(g.valor)}`,
    },
    { key: "observacao", label: "Observação", render: (g) => g.observacao || "-" },
  ];

  if (loading && gastos.length === 0) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Gastos Variáveis"
          subtitle="Gasolina, estacionamento e outros gastos avulsos"
          icon="🧾"
          action={{
            label: "Lançar Gasto Variável",
            onClick: () => setModalAberto(true),
          }}
        />

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}
        {success && (
          <AlertBox
            type="success"
            message={success}
            onClose={() => setSuccess("")}
          />
        )}

        {modalAberto && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 shadow-lg relative">
              <button
                onClick={() => setModalAberto(false)}
                style={{
                  position: "absolute",
                  top: 12,
                  right: 16,
                  fontSize: 22,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#888",
                }}
                aria-label="Fechar"
              >
                ×
              </button>
              <LancarGastoVariavel
                lojas={lojas}
                veiculos={veiculos}
                onClose={() => setModalAberto(false)}
                onSuccess={() => {
                  setSuccess("Gasto variável lançado com sucesso!");
                  carregarGastos();
                }}
              />
            </div>
          </div>
        )}

        <form
          onSubmit={handleFiltrar}
          className="card-gradient mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
        >
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Loja
            </label>
            <select
              value={filtroLojaId}
              onChange={(e) => setFiltroLojaId(e.target.value)}
              className="input-field"
            >
              <option value="">Todas as lojas</option>
              {lojas.map((loja) => (
                <option key={loja.id} value={loja.id}>
                  {loja.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Categoria
            </label>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="input-field"
            >
              <option value="">Todas</option>
              <option value="Gasolina">Gasolina</option>
              <option value="Estacionamento">Estacionamento</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              De
            </label>
            <input
              type="date"
              value={filtroDataInicio}
              onChange={(e) => setFiltroDataInicio(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Até
            </label>
            <input
              type="date"
              value={filtroDataFim}
              onChange={(e) => setFiltroDataFim(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="md:col-span-4 flex gap-3">
            <button type="submit" className="btn-primary">
              Filtrar
            </button>
            <button
              type="button"
              onClick={handleLimparFiltros}
              className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-100"
            >
              Limpar filtro
            </button>
          </div>
        </form>

        <div className="card-gradient mb-6">
          <p className="text-sm font-semibold text-gray-700">
            Total no período filtrado
          </p>
          <p className="text-3xl font-bold text-gray-900">
            R$ {formatCurrency(totalFiltrado)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {gastos.length} registro(s) encontrado(s)
          </p>
        </div>

        <DataTable
          headers={headers}
          data={gastos}
          emptyMessage="Nenhum gasto variável encontrado no período."
        />
      </div>
      <Footer />
    </div>
  );
}

export default GastosVariaveis;
