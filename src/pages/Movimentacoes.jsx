import { useState, useEffect } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import {
  PageHeader,
  StatsGrid,
  DataTable,
  Badge,
  AlertBox,
} from "../components/UIComponents";
import { PageLoader, EmptyState } from "../components/Loading";

export function Movimentacoes() {
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    maquina_id: "",
    produto_id: "",
    tipo: "entrada",
    quantidade: "",
    observacao: "",
  });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [movRes, maqRes, prodRes, lojasRes] = await Promise.all([
        api.get("/movimentacoes"),
        api.get("/maquinas"),
        api.get("/produtos"),
        api.get("/lojas"),
      ]);
      setMovimentacoes(movRes.data);
      setMaquinas(maqRes.data.filter((m) => m.ativo));
      setProdutos(prodRes.data.filter((p) => p.ativo));
      setLojas(lojasRes.data);
    } catch (error) {
      setError(
        "Erro ao carregar dados: " +
          (error.response?.data?.error || error.message)
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const data = {
        ...formData,
        maquina_id: parseInt(formData.maquina_id),
        produto_id: parseInt(formData.produto_id),
        quantidade: parseInt(formData.quantidade),
      };

      await api.post("/movimentacoes", data);
      setSuccess("Movimentação registrada com sucesso!");
      setFormData({
        maquina_id: "",
        produto_id: "",
        tipo: "entrada",
        quantidade: "",
        observacao: "",
      });
      setShowForm(false);
      carregarDados();
    } catch (error) {
      setError(error.response?.data?.error || "Erro ao registrar movimentação");
    }
  };

  const entradas = movimentacoes.filter((m) => m.tipo === "entrada");
  const saidas = movimentacoes.filter((m) => m.tipo === "saida");
  const totalEntradas = entradas.reduce(
    (sum, m) => sum + (m.quantidade || 0),
    0
  );
  const totalSaidas = saidas.reduce((sum, m) => sum + (m.quantidade || 0), 0);

  const stats = [
    {
      title: "Total de Entradas",
      value: totalEntradas,
      icon: "📥",
      color: "success",
    },
    {
      title: "Total de Saídas",
      value: totalSaidas,
      icon: "📤",
      color: "error",
    },
    {
      title: "Saldo",
      value: totalEntradas - totalSaidas,
      icon: "📊",
      color: "primary",
    },
    {
      title: "Movimentações",
      value: movimentacoes.length,
      icon: "🔄",
      color: "secondary",
    },
  ];

  const columns = [
    {
      key: "data",
      label: "Data/Hora",
      render: (mov) => {
        const data = new Date(mov.data_movimentacao || mov.createdAt);
        return (
          <div>
            <div className="font-semibold">
              {data.toLocaleDateString("pt-BR")}
            </div>
            <div className="text-xs text-gray-500">
              {data.toLocaleTimeString("pt-BR")}
            </div>
          </div>
        );
      },
    },
    {
      key: "tipo",
      label: "Tipo",
      render: (mov) => (
        <Badge type={mov.tipo === "entrada" ? "success" : "error"}>
          {mov.tipo === "entrada" ? "📥 Entrada" : "📤 Saída"}
        </Badge>
      ),
    },
    {
      key: "produto",
      label: "Produto",
      render: (mov) => {
        const produto = produtos.find((p) => p.id === mov.produto_id);
        return produto ? (
          <div className="flex items-center gap-2">
            <span className="text-xl">{produto.emoji || "🧸"}</span>
            <span>{produto.nome}</span>
          </div>
        ) : (
          "N/A"
        );
      },
    },
    {
      key: "maquina",
      label: "Máquina",
      render: (mov) => {
        const maquina = maquinas.find((m) => m.id === mov.maquina_id);
        if (!maquina) return "N/A";

        const loja = lojas.find((l) => l.id === maquina.loja_id);
        return (
          <div>
            <div className="font-semibold">{maquina.nome}</div>
            <div className="text-xs text-gray-500">{loja?.nome || "N/A"}</div>
          </div>
        );
      },
    },
    {
      key: "quantidade",
      label: "Quantidade",
      render: (mov) => (
        <span
          className={`font-bold ${
            mov.tipo === "entrada" ? "text-green-600" : "text-red-600"
          }`}
        >
          {mov.tipo === "entrada" ? "+" : "-"}
          {mov.quantidade}
        </span>
      ),
    },
    {
      key: "observacao",
      label: "Observação",
      render: (mov) => (
        <span className="text-sm text-gray-600">{mov.observacao || "-"}</span>
      ),
    },
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Movimentações"
          subtitle="Registre entradas e saídas de produtos nas máquinas"
          icon="🔄"
          action={{
            label: showForm ? "Cancelar" : "Nova Movimentação",
            onClick: () => setShowForm(!showForm),
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

        <StatsGrid stats={stats} />

        {showForm && (
          <div className="card-gradient mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">📝</span>
              Registrar Movimentação
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tipo de Movimentação *
                  </label>
                  <select
                    name="tipo"
                    value={formData.tipo}
                    onChange={handleChange}
                    className="select-field"
                    required
                  >
                    <option value="entrada">📥 Entrada (Abastecer)</option>
                    <option value="saida">📤 Saída (Venda/Retirada)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Quantidade *
                  </label>
                  <input
                    type="number"
                    name="quantidade"
                    value={formData.quantidade}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0"
                    min="1"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Máquina *
                  </label>
                  <select
                    name="maquina_id"
                    value={formData.maquina_id}
                    onChange={handleChange}
                    className="select-field"
                    required
                  >
                    <option value="">Selecione uma máquina...</option>
                    {maquinas.map((maquina) => {
                      const loja = lojas.find((l) => l.id === maquina.loja_id);
                      return (
                        <option key={maquina.id} value={maquina.id}>
                          {maquina.nome} - {loja?.nome || "N/A"}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Produto *
                  </label>
                  <select
                    name="produto_id"
                    value={formData.produto_id}
                    onChange={handleChange}
                    className="select-field"
                    required
                  >
                    <option value="">Selecione um produto...</option>
                    {produtos.map((produto) => (
                      <option key={produto.id} value={produto.id}>
                        {produto.emoji || "🧸"} {produto.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Observação
                  </label>
                  <textarea
                    name="observacao"
                    value={formData.observacao}
                    onChange={handleChange}
                    className="input-field"
                    rows="2"
                    placeholder="Informações adicionais sobre a movimentação..."
                  />
                </div>
              </div>

              <div className="flex gap-4 justify-end pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  <span className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Registrar Movimentação
                  </span>
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="card-gradient">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">📋</span>
            Histórico de Movimentações
          </h3>

          {movimentacoes.length > 0 ? (
            <DataTable columns={columns} data={movimentacoes} />
          ) : (
            <EmptyState
              icon="🔄"
              title="Nenhuma movimentação registrada"
              message="Registre sua primeira movimentação para começar o controle de estoque!"
              action={{
                label: "Nova Movimentação",
                onClick: () => setShowForm(true),
              }}
            />
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
