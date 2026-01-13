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
import AvisosMaquinasFaltam from "../components/AvisosMaquinasFaltam";
import TabelaMovimentacoesEstoqueDeLoja from "../components/TabelaMovimentacoesEstoqueDeLoja";

export function Movimentacoes() {
  const { usuario } = useAuth();

  // --- ESTADOS ---
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [movimentacoesEstoqueLoja, setMovimentacoesEstoqueLoja] = useState([]);

  // Filtros Estoque Loja
  const [filtroLojaEstoque, setFiltroLojaEstoque] = useState("");
  const [filtroDataEstoque, setFiltroDataEstoque] = useState("");
  const [filtroResponsavelEstoque, setFiltroResponsavelEstoque] = useState("");

  // Ações Estoque Loja
  const [editandoEstoqueLoja, setEditandoEstoqueLoja] = useState(null);
  const [excluindoEstoqueLoja, setExcluindoEstoqueLoja] = useState(null);

  // Dados Gerais
  const [maquinas, setMaquinas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [lojas, setLojas] = useState([]);

  // UI States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [salvandoMovimentacao, setSalvandoMovimentacao] = useState(false);

  // Filtros Movimentações
  const [filtroLojaForm, setFiltroLojaForm] = useState("");
  const [filtroLojaListagem, setFiltroLojaListagem] = useState("");

  // Edição
  const [editandoMovimentacao, setEditandoMovimentacao] = useState(null);
  const [formEdicao, setFormEdicao] = useState({
    fichas: "",
    abastecidas: "",
    quantidade_notas_entrada: "",
    valor_entrada_maquininha_pix: "",
  });

  // Formulário Nova Movimentação
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

  // Estados auxiliares
  const [estoqueAnterior, setEstoqueAnterior] = useState(0);

  // --- EFEITOS ---
  useEffect(() => {
    carregarDados();
    carregarMovimentacoesEstoqueLoja();
  }, []);

  // Atualizar estoque anterior quando seleciona máquina
  useEffect(() => {
    if (formData.maquina_id) {
      const maquina = maquinas.find((m) => m.id === formData.maquina_id);
      if (maquina) {
        setEstoqueAnterior(maquina.estoqueAtual || 0);
      }
    }
  }, [formData.maquina_id, maquinas]);

  // --- FUNÇÕES DE CARREGAMENTO ---
  const carregarDados = async () => {
    try {
      setLoading(true);
      const [movRes, maqRes, prodRes, lojasRes] = await Promise.all([
        api.get("/movimentacoes"),
        api.get("/maquinas"),
        api.get("/produtos"),
        api.get("/lojas"),
      ]);

      setMovimentacoes(movRes.data || []);
      setMaquinas(maqRes.data || []);
      setProdutos(prodRes.data || []);
      setLojas(lojasRes.data || []);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
      setError("Erro ao carregar dados iniciais.");
    } finally {
      setLoading(false);
    }
  };

  const carregarMovimentacoesEstoqueLoja = async () => {
    try {
      const res = await api.get("/movimentacao-estoque-loja");
      setMovimentacoesEstoqueLoja(res.data || []);
    } catch (error) {
      console.error(
        "Erro ao carregar movimentações de estoque de loja:",
        error
      );
      setMovimentacoesEstoqueLoja([]);
    }
  };

  // --- HANDLERS ---
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // --- CORREÇÃO AQUI: Função handleSubmit recriada com o TRY ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSalvandoMovimentacao(true);
    setError("");
    setSuccess("");

    try {
      // Converter valores do formulário
      const totalPre = parseInt(formData.quantidadeAtualMaquina) || 0; // valor digitado pelo usuário
      const quantidadeAdicionada = parseInt(formData.quantidadeAdicionada) || 0;
      const fichas = parseInt(formData.fichas) || 0;

      // totalPos = totalPre + abastecidas
      const totalPos = totalPre + quantidadeAdicionada;

      // Buscar a última movimentação da máquina selecionada para pegar o totalPos anterior
      let ultimoTotalPos = 0;
      let movimentacoesMaquina = movimentacoes
        .filter((m) => {
          // Considera tanto maquinaId quanto maquina_id
          return (
            m.maquinaId === formData.maquina_id ||
            m.maquina_id === formData.maquina_id
          );
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      if (movimentacoesMaquina.length > 0) {
        ultimoTotalPos =
          movimentacoesMaquina[0].totalPos ||
          movimentacoesMaquina[0].totalPos ||
          0;
      }

      // sairam = totalPos da movimentação anterior - totalPre da atual
      const quantidadeSaiu = Math.max(0, ultimoTotalPos - totalPre);

      console.log("📊 [handleSubmit] Cálculos da movimentação:");
      console.log("   📌 totalPos anterior:", ultimoTotalPos);
      console.log("   📌 Quantidade atual informada (totalPre):", totalPre);
      console.log(
        "   📌 Quantidade adicionada (abastecidas):",
        quantidadeAdicionada
      );
      console.log("   📌 Calculado que saiu (sairam):", quantidadeSaiu);
      console.log("   📌 Novo total (totalPos):", totalPos);

      // Preparar observação
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
        totalPre: totalPre,
        sairam: quantidadeSaiu,
        abastecidas: quantidadeAdicionada,
        totalPos: totalPos,
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
      await api.post("/movimentacoes", data);

      // Logs para depuração do filtro
      console.log("Todas movimentações:", movimentacoes);
      console.log(
        "ID da máquina selecionada:",
        formData.maquina_id,
        "(tipo:",
        typeof formData.maquina_id,
        ")"
      );
      movimentacoesMaquina = movimentacoes
        .filter((m) => {
          const id1 = m.maquinaId !== undefined ? m.maquinaId : m.maquina_id;
          console.log(
            "Comparando:",
            id1,
            "(tipo:",
            typeof id1,
            ") com",
            formData.maquina_id,
            "(tipo:",
            typeof formData.maquina_id,
            ")"
          );
          return id1 === formData.maquina_id;
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      console.log("Movimentações filtradas:", movimentacoesMaquina);
      ultimoTotalPos = 0;
      if (movimentacoesMaquina.length > 0) {
        ultimoTotalPos = movimentacoesMaquina[0].totalPos || 0;
      }
      console.log("Último totalPos encontrado:", ultimoTotalPos);

      setFormData({
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
      setEstoqueAnterior(0);
      setFiltroLojaForm("");
      setShowForm(false);

      // Recarregar dados
      carregarDados();
    } catch (error) {
      console.error("❌ [handleSubmit] Erro:", error);
      setError(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Erro ao registrar movimentação"
      );
    } finally {
      setSalvandoMovimentacao(false);
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
      console.error("Erro ao atualizar:", error);
      setError("Erro ao atualizar movimentação");
    }
  };
  const confirmarExclusaoLoja = async () => {
    if (!excluindoEstoqueLoja) return;

    try {
      await api.delete(`/movimentacao-estoque-loja/${excluindoEstoqueLoja.id}`);
      setSuccess("Movimentação de estoque de loja excluída com sucesso!");
      carregarMovimentacoesEstoqueLoja(); // Recarrega a lista
    } catch (err) {
      console.error("Erro ao excluir:", err);
      setError("Erro ao excluir movimentação de loja.");
    } finally {
      setExcluindoEstoqueLoja(null); // Fecha o modal
    }
  };

  // Função para salvar edição de loja (Exemplo editando o Responsável)
  const salvarEdicaoLoja = async (e) => {
    e.preventDefault();
    if (!editandoEstoqueLoja) return;

    try {
      await api.put(`/movimentacao-estoque-loja/${editandoEstoqueLoja.id}`, {
        lojaId: editandoEstoqueLoja.loja?.id || editandoEstoqueLoja.lojaId,
        usuarioId: usuario.id,
        produtos: editandoEstoqueLoja.produtosEnviados.map((p) => ({
          produtoId: p.produto?.id || p.produtoId,
          quantidade: Number(p.quantidade),
          tipoMovimentacao: p.tipoMovimentacao || "saida",
        })),
      });

      setSuccess("Movimentação de loja atualizada!");
      carregarMovimentacoesEstoqueLoja();
      if (typeof carregarDados === "function") carregarDados();
      setEditandoEstoqueLoja(null);
    } catch (err) {
      console.error("Erro ao editar:", err);
      setError("Erro ao atualizar movimentação de loja.");
    }
  };

  // --- CÁLCULOS DE ESTATÍSTICAS ---
  const entradas = movimentacoes.filter((m) => m.abastecidas > 0);
  const saidas = movimentacoes.filter((m) => m.sairam > 0);
  const totalEntradas = entradas.reduce(
    (sum, m) => sum + (m.abastecidas || 0),
    0
  );
  const totalSaidas = saidas.reduce((sum, m) => sum + (m.sairam || 0), 0);

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
      key: "usuario",
      label: "Usuário",
      render: (mov) => (
        <div className="flex items-center gap-1">
          <span className="text-lg">👤</span>
          <span className="text-sm font-medium text-gray-700">
            {mov.usuario?.nome || "Não informado"}
          </span>
        </div>
      ),
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

        <AvisosMaquinasFaltam lojas={lojas} />

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
                  >
                    <option value="">Nenhum produto</option>
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
                  disabled={salvandoMovimentacao}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={salvandoMovimentacao}
                >
                  {salvandoMovimentacao ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="animate-spin h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Salvando...
                    </span>
                  ) : (
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
                  )}
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

        {/* Seção Movimentações de Estoque de Loja */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span className="text-3xl">🏪</span>
            Movimentações de Estoque de Loja
          </h2>
          {/* Filtros */}
          <div className="mb-4 flex flex-wrap gap-4">
            <select
              className="input-field"
              value={filtroLojaEstoque}
              onChange={(e) => setFiltroLojaEstoque(e.target.value)}
            >
              <option value="">Todas as lojas</option>
              {lojas.map((loja) => (
                <option key={loja.id} value={loja.id}>
                  {loja.nome}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="input-field"
              value={filtroDataEstoque}
              onChange={(e) => setFiltroDataEstoque(e.target.value)}
            />
            <input
              type="text"
              className="input-field"
              placeholder="Responsável"
              value={filtroResponsavelEstoque}
              onChange={(e) => setFiltroResponsavelEstoque(e.target.value)}
            />
          </div>
          <TabelaMovimentacoesEstoqueDeLoja
            movimentacoesEstoqueLoja={movimentacoesEstoqueLoja}
            lojas={lojas}
            filtroLojaEstoque={filtroLojaEstoque}
            filtroDataEstoque={filtroDataEstoque}
            filtroResponsavelEstoque={filtroResponsavelEstoque}
            setEditandoEstoqueLoja={setEditandoEstoqueLoja}
            setExcluindoEstoqueLoja={setExcluindoEstoqueLoja}
            onChangeEstoqueLoja={carregarDados}
          />
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
                    {maquinas.find(
                      (m) => m.id === editandoMovimentacao.maquinaId
                    )?.codigo || "N/A"}
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
      </div>
      {/* --- MODAL DE EXCLUSÃO DE ESTOQUE LOJA --- */}
      {excluindoEstoqueLoja && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">
                Excluir Movimentação?
              </h3>
              <p className="text-sm text-gray-500 mt-2">
                Tem certeza que deseja excluir esta movimentação de estoque da
                loja? Esta ação não pode ser desfeita.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <button
                  onClick={() => setExcluindoEstoqueLoja(null)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button onClick={confirmarExclusaoLoja} className="btn-danger">
                  Sim, Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DE EDIÇÃO DE ESTOQUE LOJA --- */}
      {editandoEstoqueLoja && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              ✏️ Editar Produtos Enviados
            </h3>
            <form onSubmit={salvarEdicaoLoja}>
              <div className="p-3 bg-gray-50 rounded mb-4">
                <p className="text-xs text-gray-500">
                  Data:{" "}
                  {editandoEstoqueLoja.data
                    ? new Date(editandoEstoqueLoja.data).toLocaleString("pt-BR")
                    : "-"}
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Produtos Enviados
                </label>
                {editandoEstoqueLoja.produtosEnviados &&
                editandoEstoqueLoja.produtosEnviados.length > 0 ? (
                  editandoEstoqueLoja.produtosEnviados.map((prod, idx) => (
                    <div
                      key={prod.id || idx}
                      className="flex gap-2 mb-2 items-center"
                    >
                      <span className="min-w-[120px]">
                        {prod.produto?.nome || prod.produtoId}
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={prod.quantidade}
                        onChange={(e) => {
                          const novaLista =
                            editandoEstoqueLoja.produtosEnviados.map((p, i) =>
                              i === idx
                                ? { ...p, quantidade: e.target.value }
                                : p
                            );
                          setEditandoEstoqueLoja({
                            ...editandoEstoqueLoja,
                            produtosEnviados: novaLista,
                          });
                        }}
                        className="input-field w-24"
                      />
                      <select
                        value={prod.tipoMovimentacao}
                        onChange={(e) => {
                          const novaLista =
                            editandoEstoqueLoja.produtosEnviados.map((p, i) =>
                              i === idx
                                ? { ...p, tipoMovimentacao: e.target.value }
                                : p
                            );
                          setEditandoEstoqueLoja({
                            ...editandoEstoqueLoja,
                            produtosEnviados: novaLista,
                          });
                        }}
                        className="input-field w-28"
                      >
                        <option value="entrada">Entrada</option>
                        <option value="saida">Saída</option>
                      </select>
                    </div>
                  ))
                ) : (
                  <span className="text-gray-500">Nenhum produto enviado</span>
                )}
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setEditandoEstoqueLoja(null)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}
