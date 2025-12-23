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
              </div>
            </div>

            {/* Cards de Totais */}
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
                <div className="text-sm opacity-90">Total de Movimentações</div>
              </div>
            </div>

            {/* Produtos que Saíram */}
            <div className="card">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">📤</span>
                Produtos que Saíram
              </h3>
              {relatorio.produtosSairam &&
              relatorio.produtosSairam.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {relatorio.produtosSairam
                    .sort((a, b) => b.quantidade - a.quantidade)
                    .map((produto) => (
                      <div
                        key={produto.id}
                        className="p-4 bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 rounded-lg hover:shadow-lg transition-all"
                      >
                        <div className="text-4xl mb-2 text-center">
                          {produto.emoji || "📦"}
                        </div>
                        <h4 className="font-bold text-gray-900 text-center mb-1">
                          {produto.nome}
                        </h4>
                        <p className="text-sm text-gray-600 text-center mb-2">
                          Cód: {produto.codigo || "S/C"}
                        </p>
                        <div className="text-center">
                          <span className="inline-block px-3 py-1 bg-red-500 text-white font-bold rounded-full">
                            {produto.quantidade.toLocaleString("pt-BR")}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-4xl mb-2">📭</p>
                  <p className="text-gray-600">
                    Nenhum produto saiu no período selecionado
                  </p>
                </div>
              )}
            </div>

            {/* Produtos que Entraram */}
            <div className="card">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">📥</span>
                Produtos que Entraram
              </h3>
              {relatorio.produtosEntraram &&
              relatorio.produtosEntraram.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {relatorio.produtosEntraram
                    .sort((a, b) => b.quantidade - a.quantidade)
                    .map((produto) => (
                      <div
                        key={produto.id}
                        className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-lg hover:shadow-lg transition-all"
                      >
                        <div className="text-4xl mb-2 text-center">
                          {produto.emoji || "📦"}
                        </div>
                        <h4 className="font-bold text-gray-900 text-center mb-1">
                          {produto.nome}
                        </h4>
                        <p className="text-sm text-gray-600 text-center mb-2">
                          Cód: {produto.codigo || "S/C"}
                        </p>
                        <div className="text-center">
                          <span className="inline-block px-3 py-1 bg-green-500 text-white font-bold rounded-full">
                            {produto.quantidade.toLocaleString("pt-BR")}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-4xl mb-2">📭</p>
                  <p className="text-gray-600">
                    Nenhum produto entrou no período selecionado
                  </p>
                </div>
              )}
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
          
          .print-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color: white !important;
          }
          
          .bg-gradient-to-br {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .from-blue-500, .to-blue-600,
          .from-red-500, .to-red-600,
          .from-green-500, .to-green-600,
          .from-purple-500, .to-purple-600 {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          @page {
            margin: 1.5cm;
            size: A4;
          }
          
          h1, h2, h3 {
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
