import { useState, useEffect } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";

export function Relatorios() {
  const [lojas, setLojas] = useState([]);
  const [lojaSelecionada, setLojaSelecionada] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLojas, setLoadingLojas] = useState(true);
  const [relatorio, setRelatorio] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    carregarLojas();
    definirDatasDefault();
  }, []);

  const definirDatasDefault = () => {
    const hoje = new Date();
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(hoje.getDate() - 7);

    setDataFim(hoje.toISOString().split("T")[0]);
    setDataInicio(seteDiasAtras.toISOString().split("T")[0]);
  };

  const carregarLojas = async () => {
    try {
      setLoadingLojas(true);
      const response = await api.get("/lojas");
      setLojas(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar lojas:", error);
      setError("Erro ao carregar lojas");
    } finally {
      setLoadingLojas(false);
    }
  };

  const gerarRelatorio = async () => {
    if (!lojaSelecionada || !dataInicio || !dataFim) {
      setError("Por favor, preencha todos os campos");
      return;
    }

    // Validar datas
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);

    if (fim < inicio) {
      setError("A data final não pode ser anterior à data inicial");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setRelatorio(null); // Limpar relatório anterior

      const response = await api.get("/relatorios/impressao", {
        params: {
          lojaId: lojaSelecionada,
          dataInicio,
          dataFim,
        },
      });

      setRelatorio(response.data);
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      console.error("Detalhes do erro:", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });

      let errorMessage = "Erro ao gerar relatório. Tente novamente.";

      if (error.response?.status === 404) {
        errorMessage =
          "⚠️ Endpoint não encontrado. O servidor pode estar atualizando. Aguarde alguns minutos e tente novamente.";
      } else if (error.response?.status === 500) {
        errorMessage = `⚠️ Erro no servidor: ${
          error.response?.data?.error || "Erro interno no servidor"
        }. Verifique se a loja existe e se há dados para o período selecionado.`;
      } else if (error.response?.status === 400) {
        errorMessage = `⚠️ Requisição inválida: ${
          error.response?.data?.error || "Verifique os campos preenchidos"
        }`;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message === "Network Error") {
        errorMessage = "⚠️ Erro de conexão. Verifique sua internet.";
      }

      setError(errorMessage);
      setRelatorio(null);
    } finally {
      setLoading(false);
    }
  };

  const handleImprimir = () => {
    window.print();
  };

  if (loadingLojas) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="📄 Relatório de Impressão"
          subtitle="Gere relatórios detalhados de movimentações por loja"
          icon="📊"
        />

        {/* Formulário de Filtros */}
        <div className="card mb-6 no-print">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Filtros</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🏪 Loja *
              </label>
              <select
                value={lojaSelecionada}
                onChange={(e) => setLojaSelecionada(e.target.value)}
                className="input-field w-full"
              >
                <option value="">Selecione uma loja</option>
                {lojas.map((loja) => (
                  <option key={loja.id} value={loja.id}>
                    {loja.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Data Inicial *
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Data Final *
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="input-field w-full"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">⚠️ {error}</p>
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <button
              onClick={gerarRelatorio}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? "⏳ Gerando..." : "📊 Gerar Relatório"}
            </button>
            <button
              onClick={handleImprimir}
              disabled={!relatorio}
              className="btn-secondary"
            >
              🖨️ Imprimir
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-gray-600 mt-4">Gerando relatório...</p>
          </div>
        )}

        {/* Relatório */}
        {relatorio && !loading && (
          <div className="space-y-6">
            {/* Header do Relatório */}
            <div className="card bg-gradient-to-br from-primary to-secondary text-white print-header">
              <div className="text-center">
                <h2 className="text-3xl font-bold mb-2">
                  {relatorio.loja?.nome || "Relatório"}
                </h2>
                {relatorio.loja?.endereco && (
                  <p className="text-sm opacity-90 mb-3">
                    📍 {relatorio.loja.endereco}
                  </p>
                )}
                <p className="text-lg font-medium">
                  Período:{" "}
                  {new Date(relatorio.periodo.inicio).toLocaleDateString(
                    "pt-BR"
                  )}{" "}
                  até{" "}
                  {new Date(relatorio.periodo.fim).toLocaleDateString("pt-BR")}
                </p>
                <p className="text-sm opacity-90 mt-2">
                  🎰 Total de Máquinas: {relatorio.maquinas?.length || 0}
                </p>
              </div>
            </div>

            {/* Cards de Totais Gerais */}
            <div className="card bg-gradient-to-r from-purple-50 to-purple-100 border-2 border-purple-300">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-3xl">📊</span>
                Resumo Geral da Loja
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                  <div className="text-3xl mb-2">🎫</div>
                  <div className="text-2xl font-bold">
                    {(relatorio.totais?.fichas || 0).toLocaleString("pt-BR")}
                  </div>
                  <div className="text-sm opacity-90">Total de Fichas</div>
                </div>

                <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
                  <div className="text-3xl mb-2">📤</div>
                  <div className="text-2xl font-bold">
                    {(relatorio.totais?.produtosSairam || 0).toLocaleString(
                      "pt-BR"
                    )}
                  </div>
                  <div className="text-sm opacity-90">Produtos Saíram</div>
                </div>

                <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
                  <div className="text-3xl mb-2">📥</div>
                  <div className="text-2xl font-bold">
                    {(relatorio.totais?.produtosEntraram || 0).toLocaleString(
                      "pt-BR"
                    )}
                  </div>
                  <div className="text-sm opacity-90">Produtos Entraram</div>
                </div>

                <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                  <div className="text-3xl mb-2">🔄</div>
                  <div className="text-2xl font-bold">
                    {(relatorio.totais?.movimentacoes || 0).toLocaleString(
                      "pt-BR"
                    )}
                  </div>
                  <div className="text-sm opacity-90">
                    Total de Movimentações
                  </div>
                </div>
              </div>
            </div>

            {/* DETALHAMENTO POR MÁQUINA - PRINCIPAL */}
            {relatorio.maquinas && relatorio.maquinas.length > 0 && (
              <div className="space-y-6">
                <div className="card bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                  <h2 className="text-3xl font-bold flex items-center gap-3">
                    <span className="text-4xl">🎰</span>
                    RELATÓRIO DETALHADO POR MÁQUINA
                  </h2>
                  <p className="text-sm opacity-90 mt-2">
                    Visualize abaixo as informações detalhadas de cada máquina
                    desta loja no período selecionado
                  </p>
                </div>

                {relatorio.maquinas.map((maquina, index) => (
                  <div
                    key={maquina.maquina.id}
                    className="card border-4 border-indigo-300 shadow-2xl page-break-before"
                  >
                    {/* Header da Máquina com destaque */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-xl mb-6 shadow-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-3xl font-bold mb-2">
                            🎰 {maquina.maquina.nome || `Máquina ${index + 1}`}
                          </h3>
                          <p className="text-lg opacity-90">
                            📋 Código:{" "}
                            <span className="font-mono font-bold">
                              {maquina.maquina.codigo}
                            </span>
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
                            <div className="text-sm opacity-90">Máquina</div>
                            <div className="text-3xl font-bold">
                              {index + 1}/{relatorio.maquinas.length}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Totais da Máquina em destaque */}
                    <div className="mb-6">
                      <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="text-2xl">📊</span>
                        Resumo de Movimentações desta Máquina
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-5 rounded-xl shadow-lg">
                          <div className="text-4xl mb-2 text-center">🎫</div>
                          <div className="text-3xl font-bold text-center">
                            {maquina.totais.fichas.toLocaleString("pt-BR")}
                          </div>
                          <div className="text-sm text-center mt-2 opacity-90">
                            Total de Fichas
                          </div>
                        </div>
                        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white p-5 rounded-xl shadow-lg">
                          <div className="text-4xl mb-2 text-center">📤</div>
                          <div className="text-3xl font-bold text-center">
                            {maquina.totais.produtosSairam.toLocaleString(
                              "pt-BR"
                            )}
                          </div>
                          <div className="text-sm text-center mt-2 opacity-90">
                            Produtos Saíram
                          </div>
                        </div>
                        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-5 rounded-xl shadow-lg">
                          <div className="text-4xl mb-2 text-center">📥</div>
                          <div className="text-3xl font-bold text-center">
                            {maquina.totais.produtosEntraram.toLocaleString(
                              "pt-BR"
                            )}
                          </div>
                          <div className="text-sm text-center mt-2 opacity-90">
                            Produtos Entraram
                          </div>
                        </div>
                        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-5 rounded-xl shadow-lg">
                          <div className="text-4xl mb-2 text-center">🔄</div>
                          <div className="text-3xl font-bold text-center">
                            {maquina.totais.movimentacoes}
                          </div>
                          <div className="text-sm text-center mt-2 opacity-90">
                            Movimentações
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Produtos da Máquina */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Produtos que Saíram */}
                      <div className="bg-red-50 p-5 rounded-xl border-2 border-red-200">
                        <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2 bg-red-500 text-white p-3 rounded-lg">
                          <span className="text-2xl">📤</span>
                          Produtos que SAÍRAM
                          <span className="ml-auto bg-white text-red-500 px-3 py-1 rounded-full text-sm font-bold">
                            {maquina.totais.produtosSairam}
                          </span>
                        </h4>
                        {maquina.produtosSairam &&
                        maquina.produtosSairam.length > 0 ? (
                          <div className="space-y-3">
                            {maquina.produtosSairam
                              .sort((a, b) => b.quantidade - a.quantidade)
                              .map((produto) => (
                                <div
                                  key={produto.id}
                                  className="bg-white p-4 rounded-lg border-2 border-red-300 shadow-md"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1">
                                      <span className="text-4xl">
                                        {produto.emoji || "📦"}
                                      </span>
                                      <div className="flex-1">
                                        <div className="font-bold text-lg text-gray-900">
                                          {produto.nome}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                          📋 Cód:{" "}
                                          <span className="font-mono">
                                            {produto.codigo || "S/C"}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="bg-red-500 text-white px-5 py-3 rounded-xl font-bold text-xl">
                                      {produto.quantidade.toLocaleString(
                                        "pt-BR"
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 bg-white rounded-lg">
                            <p className="text-6xl mb-2">📭</p>
                            <p className="text-gray-500 font-medium">
                              Nenhum produto saiu
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Produtos que Entraram */}
                      <div className="bg-green-50 p-5 rounded-xl border-2 border-green-200">
                        <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2 bg-green-500 text-white p-3 rounded-lg">
                          <span className="text-2xl">📥</span>
                          Produtos que ENTRARAM
                          <span className="ml-auto bg-white text-green-500 px-3 py-1 rounded-full text-sm font-bold">
                            {maquina.totais.produtosEntraram}
                          </span>
                        </h4>
                        {maquina.produtosEntraram &&
                        maquina.produtosEntraram.length > 0 ? (
                          <div className="space-y-3">
                            {maquina.produtosEntraram
                              .sort((a, b) => b.quantidade - a.quantidade)
                              .map((produto) => (
                                <div
                                  key={produto.id}
                                  className="bg-white p-4 rounded-lg border-2 border-green-300 shadow-md"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1">
                                      <span className="text-4xl">
                                        {produto.emoji || "📦"}
                                      </span>
                                      <div className="flex-1">
                                        <div className="font-bold text-lg text-gray-900">
                                          {produto.nome}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                          📋 Cód:{" "}
                                          <span className="font-mono">
                                            {produto.codigo || "S/C"}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="bg-green-500 text-white px-5 py-3 rounded-xl font-bold text-xl">
                                      {produto.quantidade.toLocaleString(
                                        "pt-BR"
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 bg-white rounded-lg">
                            <p className="text-6xl mb-2">📭</p>
                            <p className="text-gray-500 font-medium">
                              Nenhum produto entrou
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Separador entre máquinas */}
                    {index < relatorio.maquinas.length - 1 && (
                      <div className="mt-8 pt-6 border-t-4 border-dashed border-gray-300">
                        <p className="text-center text-gray-500 text-sm font-medium">
                          ⬇️ Próxima Máquina ⬇️
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Consolidado Geral de Produtos */}
            <div className="card bg-gradient-to-r from-amber-50 to-orange-100 border-2 border-orange-300">
              <h3 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <span className="text-3xl">📊</span>
                Consolidado Geral de Produtos
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Resumo de todos os produtos (todas as máquinas somadas)
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Produtos que Saíram - Consolidado */}
                <div>
                  <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">📤</span>
                    Produtos que Saíram (Total Geral)
                  </h4>
                  {relatorio.produtosSairam &&
                  relatorio.produtosSairam.length > 0 ? (
                    <div className="space-y-2">
                      {relatorio.produtosSairam
                        .sort((a, b) => b.quantidade - a.quantidade)
                        .map((produto) => (
                          <div
                            key={produto.id}
                            className="p-3 bg-white border-2 border-red-200 rounded-lg"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">
                                  {produto.emoji || "📦"}
                                </span>
                                <div>
                                  <div className="font-bold text-gray-900">
                                    {produto.nome}
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    Cód: {produto.codigo || "S/C"}
                                  </div>
                                </div>
                              </div>
                              <span className="bg-red-500 text-white px-3 py-1 rounded-full font-bold">
                                {produto.quantidade.toLocaleString("pt-BR")}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-4xl mb-2">📭</p>
                      <p className="text-gray-600">Nenhum produto saiu</p>
                    </div>
                  )}
                </div>

                {/* Produtos que Entraram - Consolidado */}
                <div>
                  <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">📥</span>
                    Produtos que Entraram (Total Geral)
                  </h4>
                  {relatorio.produtosEntraram &&
                  relatorio.produtosEntraram.length > 0 ? (
                    <div className="space-y-2">
                      {relatorio.produtosEntraram
                        .sort((a, b) => b.quantidade - a.quantidade)
                        .map((produto) => (
                          <div
                            key={produto.id}
                            className="p-3 bg-white border-2 border-green-200 rounded-lg"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">
                                  {produto.emoji || "📦"}
                                </span>
                                <div>
                                  <div className="font-bold text-gray-900">
                                    {produto.nome}
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    Cód: {produto.codigo || "S/C"}
                                  </div>
                                </div>
                              </div>
                              <span className="bg-green-500 text-white px-3 py-1 rounded-full font-bold">
                                {produto.quantidade.toLocaleString("pt-BR")}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-4xl mb-2">📭</p>
                      <p className="text-gray-600">Nenhum produto entrou</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Estado Vazio */}
        {!relatorio && !loading && !error && (
          <div className="text-center py-12 card">
            <p className="text-6xl mb-4">📄</p>
            <p className="text-gray-600 text-lg">
              Selecione uma loja e o período para gerar o relatório
            </p>
          </div>
        )}
      </div>

      <Footer />

      {/* Estilos de Impressão */}
      <style>{`
        @media print {
          .no-print, nav, footer {
            display: none !important;
          }
          
          body {
            background: white !important;
          }
          
          .card {
            page-break-inside: avoid;
            box-shadow: none !important;
            border: 1px solid #e5e7eb;
          }
          
          .page-break-before {
            page-break-before: always;
          }
          
          .print-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color: white !important;
          }
          
          .bg-gradient-to-br, .bg-gradient-to-r {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .from-blue-500, .to-blue-600,
          .from-red-500, .to-red-600,
          .from-green-500, .to-green-600,
          .from-purple-500, .to-purple-600,
          .from-indigo-500, .to-indigo-500 {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .bg-blue-50, .bg-red-50, .bg-green-50, .bg-purple-50, .bg-gray-50 {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .border-blue-200, .border-red-200, .border-green-200, .border-purple-200 {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          @page {
            margin: 1.5cm;
            size: A4;
          }
          
          h1, h2, h3, h4 {
            page-break-after: avoid;
          }
          
          .grid {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
