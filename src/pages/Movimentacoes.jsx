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
import { useAuth } from "../contexts/AuthContext";

export function Movimentacoes() {
  const { usuario } = useAuth();
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
  const [editandoMovimentacao, setEditandoMovimentacao] = useState(null);
  const [formEdicao, setFormEdicao] = useState({
    fichas: "",
    abastecidas: "",
    quantidade_notas_entrada: "",
    valor_entrada_maquininha_pix: "",
  });

  const [formData, setFormData] = useState({
    maquina_id: "",
    produto_id: "",
    quantidadeAtualMaquina: "",
    quantidadeAdicionada: "",
    fichas: "",
    contadorIn: "",
    contadorOut: "",
    quantidade_notas_entrada: "",
    valor_entrada_maquininha_pix: "",
    observacao: "",
    retiradaEstoque: false,
  });

  // Estados auxiliares para exibir cálculos
  const [estoqueAnterior, setEstoqueAnterior] = useState(0);

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
    const { name, value, type, checked } = e.target;
    const newValue = type === "checkbox" ? checked : value;

    // Se marcar retirada de estoque, zerar fichas
    if (name === "retiradaEstoque" && checked) {
      setFormData({ ...formData, [name]: newValue, fichas: "0" });
    } else {
      setFormData({ ...formData, [name]: newValue });
    }

    // Quando selecionar máquina, buscar estoque atual
    if (name === "maquina_id" && value) {
      buscarEstoqueAtual(value);
    }
  };

  const buscarEstoqueAtual = async (maquinaId) => {
    try {
      console.log("🔍 [Frontend] Buscando estoque para máquina:", maquinaId);

      const estoqueRes = await api.get(`/maquinas/${maquinaId}/estoque`);

      console.log(
        "📦 [Frontend] Resposta completa do backend:",
        estoqueRes.data
      );

      const estoqueAtual = estoqueRes.data.estoqueAtual || 0;

      console.log("✅ [Frontend] Estoque definido:", estoqueAtual);

      setEstoqueAnterior(estoqueAtual);
    } catch (error) {
      console.error("❌ [Frontend] Erro ao buscar estoque:", error);
      console.error("Detalhes do erro:", error.response?.data);
      setEstoqueAnterior(0);
    }
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

      const quantidadeAtual =
        parseInt(formData.quantidadeAtualMaquina, 10) || 0;
      const quantidadeAdicionada =
        parseInt(formData.quantidadeAdicionada, 10) || 0;
      // Se for retirada de estoque, fichas = 0
      const fichas = formData.retiradaEstoque
        ? 0
        : parseInt(formData.fichas, 10) || 0;

      // Validação: deve informar pelo menos a quantidade atual
      if (quantidadeAtual === 0 && quantidadeAdicionada === 0) {
        setError(
          "Por favor, informe a quantidade atual na máquina ou a quantidade adicionada"
        );
        return;
      }

      // Calcular quantidades baseado na lógica:
      // quantidadeSaiu = estoqueAnterior - quantidadeAtual
      // novoEstoque = quantidadeAtual + quantidadeAdicionada

      const quantidadeSaiu = Math.max(0, estoqueAnterior - quantidadeAtual);
      const novoEstoque = quantidadeAtual + quantidadeAdicionada;

      console.log("📊 [handleSubmit] Cálculos da movimentação:");
      console.log("  📌 Estoque anterior (totalPre):", estoqueAnterior);
      console.log("  📌 Quantidade atual informada:", quantidadeAtual);
      console.log(
        "  📌 Quantidade adicionada (abastecidas):",
        quantidadeAdicionada
      );
      console.log("  📌 Calculado que saiu (sairam):", quantidadeSaiu);
      console.log("  📌 Novo estoque (totalPos):", novoEstoque);
      console.log("  🧮 Fórmula: totalPos = totalPre - sairam + abastecidas");
      console.log(
        "  🧮 Verificação:",
        estoqueAnterior,
        "-",
        quantidadeSaiu,
        "+",
        quantidadeAdicionada,
        "=",
        novoEstoque
      );

      // Preparar observação - se for retirada de estoque, adicionar nota automática
      let observacaoFinal = formData.observacao?.trim() || "";
      if (formData.retiradaEstoque) {
        const notaRetirada = "⚠️ RETIRADA DE ESTOQUE - NÃO É VENDA";
        observacaoFinal = observacaoFinal
          ? `${notaRetirada}. ${observacaoFinal}`
          : notaRetirada;
      }

      // Transformar para o formato do backend
      const data = {
        maquinaId: formData.maquina_id,
        totalPre: estoqueAnterior,
        sairam: quantidadeSaiu,
        abastecidas: quantidadeAdicionada,
        fichas: fichas,
        contadorIn: parseInt(formData.contadorIn) || null,
        contadorOut: parseInt(formData.contadorOut) || null,
        quantidade_notas_entrada: formData.quantidade_notas_entrada
          ? parseFloat(formData.quantidade_notas_entrada)
          : null,
        valor_entrada_maquininha_pix: formData.valor_entrada_maquininha_pix
          ? parseFloat(formData.valor_entrada_maquininha_pix)
          : null,
        retiradaEstoque: formData.retiradaEstoque,
        contadorMaquina: null,
        observacoes: observacaoFinal || null,
        produtos: [
          {
            produtoId: formData.produto_id,
            quantidadeSaiu: quantidadeSaiu,
            quantidadeAbastecida: quantidadeAdicionada,
          },
        ],
      };

      console.log(
        "📤 [handleSubmit] Dados da movimentação enviados:",
        JSON.stringify(data, null, 2)
      );

      const response = await api.post("/movimentacoes", data);

      console.log(
        "✅ [handleSubmit] Movimentação criada com sucesso:",
        response.data
      );
      console.log(
        "  📊 Verifique se totalPos está correto:",
        response.data.totalPos
      );

      setSuccess("Movimentação registrada com sucesso!");
      setFormData({
        maquina_id: "",
        produto_id: "",
        quantidadeAtualMaquina: "",
        quantidadeAdicionada: "",
        fichas: "",
        contadorIn: "",
        contadorOut: "",
        observacao: "",
        retiradaEstoque: false,
      });
      setEstoqueAnterior(0);
      setFiltroLojaForm("");
      setShowForm(false);
      carregarDados();
    } catch (error) {
      console.error("❌ [handleSubmit] Erro ao registrar movimentação:", error);
      console.error("  📋 Detalhes do erro:", {
        mensagem: error.message,
        status: error.response?.status,
        dados: error.response?.data,
        config: error.config,
      });
      setError(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Erro ao registrar movimentação"
      );
    }
  };

  const iniciarEdicao = (movimentacao) => {
    setEditandoMovimentacao(movimentacao);
    setFormEdicao({
      fichas: movimentacao.fichas || 0,
      abastecidas: movimentacao.abastecidas || 0,
      quantidade_notas_entrada: movimentacao.quantidade_notas_entrada || "",
      valor_entrada_maquininha_pix:
        movimentacao.valor_entrada_maquininha_pix || "",
    });
  };

  const cancelarEdicao = () => {
    setEditandoMovimentacao(null);
    setFormEdicao({
      fichas: "",
      abastecidas: "",
      quantidade_notas_entrada: "",
      valor_entrada_maquininha_pix: "",
    });
  };

  const salvarEdicao = async () => {
    try {
      await api.put(`/movimentacoes/${editandoMovimentacao.id}`, {
        fichas: parseInt(formEdicao.fichas) || 0,
        abastecidas: parseInt(formEdicao.abastecidas) || 0,
        quantidade_notas_entrada:
          formEdicao.quantidade_notas_entrada !== ""
            ? parseFloat(formEdicao.quantidade_notas_entrada)
            : null,
        valor_entrada_maquininha_pix:
          formEdicao.valor_entrada_maquininha_pix !== ""
            ? parseFloat(formEdicao.valor_entrada_maquininha_pix)
            : null,
      });
      setSuccess("Movimentação atualizada com sucesso!");
      cancelarEdicao();
      carregarDados();
    } catch (error) {
      console.error("Erro ao atualizar movimentação:", error);
      setError(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Erro ao atualizar movimentação"
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

  // Adicionar coluna de ações apenas para ADMIN
  if (usuario?.role === "ADMIN") {
    columns.push({
      key: "acoes",
      label: "Ações",
      render: (mov) => (
        <button
          onClick={() => iniciarEdicao(mov)}
          className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
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
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          Editar
        </button>
      ),
    });
  }

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

        {usuario?.role === "ADMIN" && <StatsGrid stats={stats} />}

        {/* Filtro por Loja - Apenas para ADMIN */}
        {usuario?.role === "ADMIN" && (
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
        )}

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
                <strong>Como funciona:</strong> Informe quantos produtos tem
                AGORA na máquina (o sistema calcula o que saiu). Se abastecer,
                informe quantos foram adicionados.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Indicador de Estoque Anterior */}
              {formData.maquina_id && (
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-blue-900">
                        📊 Estoque Anterior da Máquina
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        Última contagem registrada no sistema
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-blue-900">
                        {estoqueAnterior}
                      </p>
                      <p className="text-xs text-blue-600">unidades</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📦 Quantidade Atual na Máquina *
                  </label>
                  <input
                    type="number"
                    name="quantidadeAtualMaquina"
                    value={formData.quantidadeAtualMaquina}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Quantos produtos tem agora
                  </p>
                  {formData.quantidadeAtualMaquina && estoqueAnterior > 0 && (
                    <p className="text-xs font-semibold text-red-600 mt-1">
                      🔻 Saíram:{" "}
                      {Math.max(
                        0,
                        estoqueAnterior -
                          parseInt(formData.quantidadeAtualMaquina || 0)
                      )}{" "}
                      unidades
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📥 Quantidade Adicionada
                  </label>
                  <input
                    type="number"
                    name="quantidadeAdicionada"
                    value={formData.quantidadeAdicionada}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Quantos produtos foram adicionados
                  </p>
                  {formData.quantidadeAdicionada &&
                    formData.quantidadeAtualMaquina && (
                      <p className="text-xs font-semibold text-green-600 mt-1">
                        ✅ Novo total:{" "}
                        {parseInt(formData.quantidadeAtualMaquina || 0) +
                          parseInt(formData.quantidadeAdicionada || 0)}{" "}
                        unidades
                      </p>
                    )}
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
                    disabled={formData.retiradaEstoque}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Fichas coletadas da máquina
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    💵 Valor em Notas (R$)
                  </label>
                  <input
                    type="number"
                    name="quantidade_notas_entrada"
                    value={formData.quantidade_notas_entrada}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Valor total em dinheiro (notas) inserido na máquina
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    💳 Valor Digital (Pix/Maquininha) (R$)
                  </label>
                  <input
                    type="number"
                    name="valor_entrada_maquininha_pix"
                    value={formData.valor_entrada_maquininha_pix}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Valor total recebido via pagamento digital (Pix/Maquininha)
                  </p>
                </div>
              </div>

              {/* Contadores da Máquina */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📥 Contador IN (Entrada)
                  </label>
                  <input
                    type="number"
                    name="contadorIn"
                    value={formData.contadorIn}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Número do contador IN da máquina
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📤 Contador OUT (Saída)
                  </label>
                  <input
                    type="number"
                    name="contadorOut"
                    value={formData.contadorOut}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="0"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Número do contador OUT da máquina
                  </p>
                </div>
              </div>

              {/* Checkbox de Retirada de Estoque */}
              <div className="p-4 bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-lg">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="retiradaEstoque"
                    checked={formData.retiradaEstoque}
                    onChange={handleChange}
                    className="w-5 h-5 text-orange-600 bg-gray-100 border-gray-300 rounded focus:ring-orange-500 focus:ring-2 cursor-pointer"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-bold text-orange-900">
                      📦 Retirada de Estoque (não conta como dinheiro)
                    </span>
                    <p className="text-xs text-orange-700 mt-1">
                      Marque esta opção quando estiver retirando produtos da
                      máquina sem que seja uma venda (exemplo: produtos
                      danificados, devolução, transferência). As fichas serão
                      automaticamente zeradas.
                    </p>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4"></div>

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

        {/* Histórico de Movimentações - Apenas para ADMIN */}
        {usuario?.role === "ADMIN" && (
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
        )}
      </div>

      {/* Modal de Edição */}
      {editandoMovimentacao && usuario?.role === "ADMIN" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span className="text-2xl">✏️</span>
                Editar Movimentação
              </h3>
              <button
                onClick={cancelarEdicao}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Data:</strong>{" "}
                  {new Date(
                    editandoMovimentacao.dataColeta ||
                      editandoMovimentacao.createdAt
                  ).toLocaleString("pt-BR")}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  <strong>Máquina:</strong>{" "}
                  {maquinas.find((m) => m.id === editandoMovimentacao.maquinaId)
                    ?.codigo || "N/A"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  🎫 Quantidade de Fichas
                </label>
                <input
                  type="number"
                  min="0"
                  value={formEdicao.fichas}
                  onChange={(e) =>
                    setFormEdicao({ ...formEdicao, fichas: e.target.value })
                  }
                  className="input-field"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📦 Quantidade Abastecida
                </label>
                <input
                  type="number"
                  min="0"
                  value={formEdicao.abastecidas}
                  onChange={(e) =>
                    setFormEdicao({
                      ...formEdicao,
                      abastecidas: e.target.value,
                    })
                  }
                  className="input-field"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  💵 Quantidade de Notas
                </label>
                <input
                  type="number"
                  min="0"
                  value={formEdicao.quantidade_notas_entrada}
                  onChange={(e) =>
                    setFormEdicao({
                      ...formEdicao,
                      quantidade_notas_entrada: e.target.value,
                    })
                  }
                  className="input-field"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  💳 Valor Digital (Pix/Maquininha) (R$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formEdicao.valor_entrada_maquininha_pix}
                  onChange={(e) =>
                    setFormEdicao({
                      ...formEdicao,
                      valor_entrada_maquininha_pix: e.target.value,
                    })
                  }
                  className="input-field"
                  placeholder="0.00"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={cancelarEdicao}
                  className="flex-1 btn-secondary"
                >
                  Cancelar
                </button>
                <button onClick={salvarEdicao} className="flex-1 btn-primary">
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
