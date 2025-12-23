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
  const [filtroLojaForm, setFiltroLojaForm] = useState("");
  const [filtroLojaListagem, setFiltroLojaListagem] = useState("");

  const [formData, setFormData] = useState({
    maquina_id: "",
    produto_id: "",
    quantidadeEntrada: "",
    quantidadeSaida: "",
    fichas: "",
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
      console.log("Movimentações recebidas:", movRes.data);
      console.log("Máquinas recebidas:", maqRes.data);
      console.log("Produtos recebidos:", prodRes.data);

      // Debug: Mostrar estrutura da primeira movimentação
      if (movRes.data.length > 0) {
        console.log("Estrutura da movimentação:", movRes.data[0]);
      }

      setMovimentacoes(movRes.data);
      setMaquinas(maqRes.data); // Backend já retorna apenas ativas
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
      // Validação
      if (!formData.maquina_id) {
        setError("Por favor, selecione uma máquina");
        return;
      }

      if (!formData.produto_id) {
        setError("Por favor, selecione um produto");
        return;
      }

      const quantidadeEntrada = parseInt(formData.quantidadeEntrada, 10) || 0;
      const quantidadeSaida = parseInt(formData.quantidadeSaida, 10) || 0;
      const fichas = parseInt(formData.fichas, 10) || 0;

      // Ao menos uma quantidade deve ser informada
      if (quantidadeEntrada === 0 && quantidadeSaida === 0) {
        setError(
          "Por favor, informe ao menos uma quantidade (entrada ou saída)"
        );
        return;
      }

      // Buscar estoque atual da máquina
      console.log("Buscando estoque da máquina:", formData.maquina_id);
      const estoqueRes = await api.get(
        `/maquinas/${formData.maquina_id}/estoque`
      );

      console.log("Resposta completa do estoque:", estoqueRes.data);

      const estoqueAtual = estoqueRes.data.estoqueAtual || 0;

      console.log("Estoque atual da máquina:", estoqueAtual);

      // Transformar para o formato do backend
      const data = {
        maquinaId: formData.maquina_id,
        totalPre: estoqueAtual,
        sairam: quantidadeSaida,
        abastecidas: quantidadeEntrada,
        fichas: fichas,
        contadorMaquina: null,
        observacoes: formData.observacao?.trim() || null,
        produtos: [
          {
            produtoId: formData.produto_id,
            quantidadeSaiu: quantidadeSaida,
            quantidadeAbastecida: quantidadeEntrada,
          },
        ],
      };

      console.log(
        "Dados da movimentação enviados:",
        JSON.stringify(data, null, 2)
      );

      await api.post("/movimentacoes", data);
      setSuccess("Movimentação registrada com sucesso!");
      setFormData({
        maquina_id: "",
        produto_id: "",
        quantidadeEntrada: "",
        quantidadeSaida: "",
        fichas: "",
        observacao: "",
      });
      setFiltroLojaForm("");
      setShowForm(false);
      carregarDados();
    } catch (error) {
      console.error("Erro ao registrar movimentação:", error);
      setError(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Erro ao registrar movimentação"
      );
    }
  };

  // Estatísticas - Calcular baseado em abastecidas/sairam
  const entradas = movimentacoes.filter((m) => m.abastecidas > 0);
  const saidas = movimentacoes.filter((m) => m.sairam > 0);
  const totalEntradas = entradas.reduce(
    (sum, m) => sum + (m.abastecidas || 0),
    0
  );
  const totalSaidas = saidas.reduce((sum, m) => sum + (m.sairam || 0), 0);

  // Filtrar movimentações por loja
  const movimentacoesFiltradas = filtroLojaListagem
    ? movimentacoes.filter((mov) => {
        const maquina = maquinas.find((m) => m.id === mov.maquinaId);
        return maquina?.lojaId === filtroLojaListagem;
      })
    : movimentacoes;

  const stats = [
    {
      label: "Total de Entradas",
      value: totalEntradas,
      icon: "📥",
      gradient: "bg-gradient-to-br from-green-500 to-green-600",
      subtitle: "Produtos abastecidos",
    },
    {
      label: "Total de Saídas",
      value: totalSaidas,
      icon: "📤",
      gradient: "bg-gradient-to-br from-red-500 to-red-600",
      subtitle: "Produtos vendidos",
    },
    {
      label: "Saldo",
      value: totalEntradas - totalSaidas,
      icon: "📊",
      gradient: "bg-gradient-to-br from-blue-500 to-blue-600",
      subtitle: "Diferença entrada/saída",
    },
    {
      label: "Movimentações",
      value: movimentacoes.length,
      icon: "🔄",
      gradient: "bg-gradient-to-br from-purple-500 to-purple-600",
      subtitle: "Total de registros",
    },
  ];

  const columns = [
    {
      key: "data",
      label: "Data/Hora",
      render: (mov) => {
        const data = new Date(mov.dataColeta || mov.createdAt);
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
      render: (mov) => {
        const isEntrada = mov.abastecidas > 0;
        return (
          <Badge variant={isEntrada ? "success" : "danger"}>
            {isEntrada ? "📥 Entrada" : "📤 Saída"}
          </Badge>
        );
      },
    },
    {
      key: "produto",
      label: "Produto",
      render: (mov) => {
        // Buscar produto do detalhesProdutos
        const produtoId = mov.detalhesProdutos?.[0]?.produtoId;
        const produto = produtos.find((p) => p.id === produtoId);
        return produto ? (
          <div className="flex items-center gap-2">
            <span className="text-xl">{produto.emoji || "🧸"}</span>
            <span>{produto.nome}</span>
          </div>
        ) : (
          `N/A (ID: ${produtoId || "undefined"})`
        );
      },
    },
    {
      key: "maquina",
      label: "Máquina",
      render: (mov) => {
        const maquina =
          mov.maquina || maquinas.find((m) => m.id === mov.maquinaId);
        if (!maquina) return `N/A (ID: ${mov.maquinaId})`;

        const loja = lojas.find((l) => l.id === maquina.lojaId);
        return (
          <div>
            <div className="font-semibold">
              {maquina.codigo}
              <span className="text-gray-500 text-xs ml-1">
                - {maquina.nome}
              </span>
            </div>
            <div className="text-xs text-gray-500">{loja?.nome || "N/A"}</div>
          </div>
        );
      },
    },
    {
      key: "entrada",
      label: "Entrada",
      render: (mov) => (
        <div className="flex items-center gap-1">
          <span className="text-lg">📥</span>
          <span className="font-bold text-green-600">
            {mov.abastecidas > 0 ? `+${mov.abastecidas}` : "-"}
          </span>
        </div>
      ),
    },
    {
      key: "saida",
      label: "Saída",
      render: (mov) => (
        <div className="flex items-center gap-1">
          <span className="text-lg">📤</span>
          <span className="font-bold text-red-600">
            {mov.sairam > 0 ? `-${mov.sairam}` : "-"}
          </span>
        </div>
      ),
    },
    {
      key: "fichas",
      label: "Fichas",
      render: (mov) => (
        <div className="flex items-center gap-1">
          <span className="text-lg">🎫</span>
          <span className="font-semibold text-blue-600">{mov.fichas || 0}</span>
        </div>
      ),
    },
    {
      key: "observacao",
      label: "Observação",
      render: (mov) => (
        <span className="text-sm text-gray-600">{mov.observacoes || "-"}</span>
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

        {/* Filtro por Loja */}
        <div className="card-gradient mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">🔍</span>
            Filtrar Movimentações
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🏪 Filtrar por Loja
              </label>
              <select
                value={filtroLojaListagem}
                onChange={(e) => setFiltroLojaListagem(e.target.value)}
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
          </div>
        </div>

        {showForm && (
          <div className="card-gradient mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">📝</span>
              Registrar Movimentação
            </h3>

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 flex items-center gap-2">
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <strong>Passo 1:</strong> Selecione a loja →{" "}
                <strong>Passo 2:</strong> Escolha a máquina →{" "}
                <strong>Passo 3:</strong> Adicione o produto
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📥 Quantidade Entrada
                  </label>
                  <input
                    type="number"
                    name="quantidadeEntrada"
                    value={formData.quantidadeEntrada}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Produtos abastecidos na máquina
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📤 Quantidade Saída
                  </label>
                  <input
                    type="number"
                    name="quantidadeSaida"
                    value={formData.quantidadeSaida}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Produtos que saíram (vendidos/ganhos)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    🎫 Quantidade de Fichas
                  </label>
                  <input
                    type="number"
                    name="fichas"
                    value={formData.fichas}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Fichas coletadas da máquina
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Loja *
                  </label>
                  <select
                    value={filtroLojaForm}
                    onChange={(e) => {
                      setFiltroLojaForm(e.target.value);
                      setFormData({ ...formData, maquina_id: "" });
                    }}
                    className="select-field"
                    required
                  >
                    <option value="">Selecione uma loja...</option>
                    {lojas
                      .filter((l) => l.ativo)
                      .map((loja) => (
                        <option key={loja.id} value={loja.id}>
                          {loja.nome}
                        </option>
                      ))}
                  </select>
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
                    disabled={!filtroLojaForm}
                  >
                    <option value="">
                      {filtroLojaForm
                        ? "Selecione uma máquina..."
                        : "Primeiro selecione uma loja"}
                    </option>
                    {maquinas
                      .filter(
                        (m) => !filtroLojaForm || m.lojaId === filtroLojaForm
                      )
                      .map((maquina) => (
                        <option key={maquina.id} value={maquina.id}>
                          {maquina.nome} - {maquina.codigo}
                        </option>
                      ))}
                  </select>
                  {filtroLojaForm && (
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Mostrando apenas máquinas da loja selecionada
                    </p>
                  )}
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
                  onClick={() => {
                    setShowForm(false);
                    setFiltroLojaForm("");
                  }}
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
            {filtroLojaListagem && (
              <span className="text-sm text-gray-600 font-normal">
                ({movimentacoesFiltradas.length} de {movimentacoes.length}{" "}
                registros)
              </span>
            )}
          </h3>

          {movimentacoesFiltradas.length > 0 ? (
            <DataTable headers={columns} data={movimentacoesFiltradas} />
          ) : (
            <EmptyState
              icon="🔄"
              title={
                filtroLojaListagem
                  ? "Nenhuma movimentação encontrada"
                  : "Nenhuma movimentação registrada"
              }
              message={
                filtroLojaListagem
                  ? "Não há movimentações para a loja selecionada."
                  : "Registre sua primeira movimentação para começar o controle de estoque!"
              }
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
