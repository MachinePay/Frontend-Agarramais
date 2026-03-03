import { useState, useEffect } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import { RelatorioTodasLojas } from "../components/RelatorioTodasLojas";

const TODAS_LOJAS_VALUE = "__TODAS_AS_LOJAS__";

export function Relatorios() {
  const [dashboard, setDashboard] = useState(null);
  const [lojas, setLojas] = useState([]);
  const [lojaSelecionada, setLojaSelecionada] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLojas, setLoadingLojas] = useState(true);
  const [relatorio, setRelatorio] = useState(null);
  const [error, setError] = useState("");

  // Buscar dados do dashboard para fichas corretas
  const carregarDashboard = async (lojaId, dataInicio, dataFim) => {
    try {
      const response = await api.get("/relatorios/dashboard", {
        params: {
          lojaId,
          dataInicio,
          dataFim,
        },
      });
      setDashboard(response.data);
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
      setDashboard(null);
    }
  };

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
      setDashboard(null);

      if (lojaSelecionada === TODAS_LOJAS_VALUE) {
        const response = await api.get("/relatorios/todas-lojas", {
          params: {
            dataInicio,
            dataFim,
          },
        });

        setRelatorio(response.data);

        return;
      }

      const intervaloSelecionadoInicio = new Date(`${dataInicio}T00:00:00`);
      const intervaloSelecionadoFim = new Date(`${dataFim}T23:59:59`);

      const parseDataSegura = (valor) => {
        if (!valor) return null;
        const data = new Date(valor);
        return Number.isNaN(data.getTime()) ? null : data;
      };

      const temIntersecaoPeriodo = (inicioA, fimA, inicioB, fimB) => {
        if (!inicioA || !fimA || !inicioB || !fimB) return false;
        return inicioA <= fimB && fimA >= inicioB;
      };

      // Buscar dashboard para fichas corretas
      await carregarDashboard(lojaSelecionada, dataInicio, dataFim);

      // Usar a rota correta para relatório detalhado (produtos que saíram/entraram)
      const response = await api.get("/relatorios/impressao", {
        params: {
          lojaId: lojaSelecionada,
          dataInicio,
          dataFim,
        },
      });

      let gastoTotalDoRegistrar = null;
      try {
        const registrosResponse = await api.get("/registro-dinheiro");
        const registros = Array.isArray(registrosResponse.data)
          ? registrosResponse.data
          : [];

        const registrosFiltrados = registros.filter((registro) => {
          const lojaRegistro = String(
            registro.lojaId ?? registro.lojaid ?? registro.loja ?? "",
          );
          if (lojaRegistro !== String(lojaSelecionada)) return false;

          const inicioRegistro = parseDataSegura(
            registro.inicio ?? registro.dataInicio,
          );
          const fimRegistro = parseDataSegura(registro.fim ?? registro.dataFim);

          return temIntersecaoPeriodo(
            inicioRegistro,
            fimRegistro,
            intervaloSelecionadoInicio,
            intervaloSelecionadoFim,
          );
        });

        const registrosPreferidos = registrosFiltrados.filter(
          (registro) =>
            registro.registrarTotalLoja === true ||
            registro.registrar_total_loja === true,
        );

        const listaBase =
          registrosPreferidos.length > 0
            ? registrosPreferidos
            : registrosFiltrados;

        if (listaBase.length > 0) {
          const registroMaisRecente = [...listaBase].sort((a, b) => {
            const dataA =
              parseDataSegura(
                a.createdAt ?? a.created_at ?? a.updatedAt,
              )?.getTime() || 0;
            const dataB =
              parseDataSegura(
                b.createdAt ?? b.created_at ?? b.updatedAt,
              )?.getTime() || 0;
            return dataB - dataA;
          })[0];

          const valorRegistro = Number(
            registroMaisRecente.gastoTotalPeriodo ??
              registroMaisRecente.gasto_total_periodo ??
              0,
          );

          if (!Number.isNaN(valorRegistro)) {
            gastoTotalDoRegistrar = valorRegistro;
          }
        }
      } catch (erroRegistro) {
        console.warn(
          "Não foi possível buscar gasto total do Registrar Dinheiro:",
          erroRegistro,
        );
      }

      const gastoTotalFinal =
        gastoTotalDoRegistrar ??
        Number(response.data?.totais?.gastoTotalPeriodo || 0);

      setRelatorio({
        ...response.data,
        totais: {
          ...(response.data?.totais || {}),
          gastoTotalPeriodo: gastoTotalFinal,
        },
      });
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
      setDashboard(null);
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
                <option value={TODAS_LOJAS_VALUE}>Todas as lojas</option>
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
        {relatorio && !loading && relatorio.tipo === "todas-lojas" && (
          <RelatorioTodasLojas relatorio={relatorio} />
        )}

        {relatorio && !loading && relatorio.tipo !== "todas-lojas" && (
          <div className="space-y-6">
            {/* Aviso de diferença de fichas */}
            {relatorio.avisoFichas && (
              <div className="p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-900 rounded mb-4">
                <strong>Aviso:</strong> {relatorio.avisoFichas}
              </div>
            )}
            {/* Cards de Totais Gerais */}
            <div className="card bg-gradient-to-r from-purple-50 to-purple-100 border-2 border-purple-300">
              <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-2xl sm:text-3xl">📊</span>
                Resumo Geral da Loja
              </h3>
              <div className="flex flex-wrap gap-4 sm:gap-4">
                {/* Quantidade de Fichas (DASHBOARD) */}
                {/* Valor das Fichas (Dashboard) */}
                <div className="card bg-gradient-to-br from-blue-400 to-blue-600 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">🎟️</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    {dashboard && dashboard.totais
                      ? Number(dashboard.totais.fichas || 0).toLocaleString(
                          "pt-BR",
                        )
                      : "-"}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Quantidade de Fichas
                  </div>
                  <div className="text-2xl sm:text-3xl mb-2">💸</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    ${" "}
                    {(() => {
                      const totalFichas = relatorio.totais?.fichas || 0;
                      const valorFicha =
                        relatorio.loja?.valorFichaPadrao || 2.5;
                      return (totalFichas * valorFicha).toLocaleString(
                        "pt-BR",
                        { minimumFractionDigits: 2 },
                      );
                    })()}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Valor das Fichas (Dashboard)
                  </div>
                </div>

                {/* Valor Vindo da Trocadora */}
                {/* Dinheiro loja */}
                {/* Cartão/Pix loja */}
                <div className="flex flex-col card bg-gradient-to-br from-yellow-500 to-orange-600 text-white items-center justify-center">
                  <div className="text-2xl sm:text-3xl mb-2">🏪</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {(
                      Number(relatorio.totais?.valorDinheiroLoja || 0) +
                      Number(relatorio.totais?.valorCartaoPixLoja || 0)
                    ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Valor Vindo da Trocadora
                  </div>
                  <div className="flex gap-3 items-end">
                    <div className="flex flex-col items-center">
                      <div className="text-lg sm:text-xl mb-1">💵</div>
                      <div className="text-base sm:text-lg font-bold">
                        R${" "}
                        {Number(
                          relatorio.totais?.valorDinheiroLoja || 0,
                        ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] sm:text-xs opacity-80">
                        Dinheiro
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="text-lg sm:text-xl mb-1">🟢</div>
                      <div className="text-base sm:text-lg font-bold">
                        R${" "}
                        {Number(
                          relatorio.totais?.valorCartaoPixLoja || 0,
                        ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] sm:text-xs opacity-80">
                        Cartão / Pix (Bruto)
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="text-lg sm:text-xl mb-1">✅</div>
                      <div className="text-base sm:text-lg font-bold">
                        R${" "}
                        {Number(
                          relatorio.totais?.valorCartaoPixLiquidoLoja || 0,
                        ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] sm:text-xs opacity-80">
                        Cartão / Pix (Líquido)
                      </div>
                    </div>
                  </div>
                </div>
                {/* Produtos que saíram */}
                <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">📤</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    {(relatorio.totais?.produtosSairam || 0).toLocaleString(
                      "pt-BR",
                    )}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Produtos Saíram
                  </div>
                </div>
                {/* Produtos que entraram */}
                <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">📥</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    {(relatorio.totais?.produtosEntraram || 0).toLocaleString(
                      "pt-BR",
                    )}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Produtos Entraram
                  </div>
                </div>
                {/* Valor vindo das máquinas */}
                <div className="card bg-gradient-to-br from-yellow-300 to-yellow-600 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">🎰</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {(() => {
                      let dinheiroMaquinas = 0;
                      let cartaoPixMaquinas = 0;
                      if (relatorio.maquinas && relatorio.maquinas.length > 0) {
                        relatorio.maquinas.forEach((m) => {
                          dinheiroMaquinas += Number(m.totais?.dinheiro || 0);
                          cartaoPixMaquinas += Number(m.totais?.cartaoPix || 0);
                        });
                      }
                      return (
                        dinheiroMaquinas + cartaoPixMaquinas
                      ).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
                    })()}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Lucro Das máquinas <br /> (sem considerar fichas)
                  </div>
                </div>
                {/* Custo total de produtos */}
                <div className="card bg-gradient-to-br from-yellow-100 to-yellow-400 text-yellow-900 border-yellow-400 border-2">
                  <div className="text-2xl sm:text-3xl mb-2">💸</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {(() => {
                      let custoTotalProdutos = 0;
                      if (relatorio.maquinas && relatorio.maquinas.length > 0) {
                        relatorio.maquinas.forEach((m) => {
                          custoTotalProdutos += Number(
                            m.totais?.custoProdutosSairam || 0,
                          );
                        });
                      }
                      return custoTotalProdutos.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      });
                    })()}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Custo total de produtos
                  </div>
                </div>
                <div className="card bg-gradient-to-br from-fuchsia-500 to-purple-700 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">🧾</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {Number(
                      relatorio.totais?.gastoVariavelTotalPeriodo || 0,
                    ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Gastos Variáveis
                  </div>
                </div>
                <div className="card bg-gradient-to-br from-rose-500 to-red-700 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">🧮</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {Number(
                      relatorio.totais?.gastoTotalPeriodo || 0,
                    ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Gasto Total
                  </div>
                </div>
                <div className="card bg-gradient-to-br from-pink-500 to-fuchsia-700 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">💳</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    {Number(
                      relatorio.totais?.percentualTaxaCartaoMedia || 0,
                    ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    %
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Taxa Média de Cartão
                  </div>
                  <div className="text-[10px] sm:text-xs opacity-80 mt-1">
                    R${" "}
                    {Number(relatorio.totais?.taxaDeCartao || 0).toLocaleString(
                      "pt-BR",
                      { minimumFractionDigits: 2 },
                    )}
                  </div>
                </div>
                {/* Lucro Bruto da Loja */}
                <div className="card bg-gradient-to-br from-yellow-500 to-orange-600 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">💰</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {(() => {
                      const valorTrocadoraLiquido =
                        Number(relatorio.totais?.valorDinheiroLoja || 0) +
                        Number(
                          relatorio.totais?.valorCartaoPixLiquidoLoja || 0,
                        );
                      let dinheiroMaquinas = 0;
                      let cartaoPixMaquinas = 0;
                      if (relatorio.maquinas && relatorio.maquinas.length > 0) {
                        relatorio.maquinas.forEach((m) => {
                          dinheiroMaquinas += Number(m.totais?.dinheiro || 0);
                          cartaoPixMaquinas += Number(m.totais?.cartaoPix || 0);
                        });
                      }
                      const lucroMaquinas =
                        dinheiroMaquinas + cartaoPixMaquinas;
                      return (valorTrocadora + lucroMaquinas).toLocaleString(
                        "pt-BR",
                        { minimumFractionDigits: 2 },
                      );
                    })()}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Bruto Consolidado (Loja + Máquinas)
                  </div>
                </div>
                <div className="card bg-gradient-to-br from-emerald-600 to-green-800 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">📉</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {(() => {
                      const valorTrocadora =
                        Number(relatorio.totais?.valorDinheiroLoja || 0) +
                        Number(relatorio.totais?.valorCartaoPixLoja || 0);
                      let dinheiroMaquinas = 0;
                      let cartaoPixMaquinas = 0;
                      if (relatorio.maquinas && relatorio.maquinas.length > 0) {
                        relatorio.maquinas.forEach((m) => {
                          dinheiroMaquinas += Number(m.totais?.dinheiro || 0);
                          cartaoPixMaquinas += Number(m.totais?.cartaoPix || 0);
                        });
                      }
                      const lucroMaquinas =
                        dinheiroMaquinas + cartaoPixMaquinas;
                      const receitaLiquida =
                        valorTrocadoraLiquido + lucroMaquinas;
                      const gastoTotal = Number(
                        relatorio.totais?.gastoTotalPeriodo || 0,
                      );
                      return (receitaLiquida - gastoTotal).toLocaleString(
                        "pt-BR",
                        {
                          minimumFractionDigits: 2,
                        },
                      );
                    })()}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Lucro Líquido
                  </div>
                </div>
                <div className="card bg-gradient-to-br from-indigo-500 to-indigo-700 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">🎯</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {Number(
                      relatorio.totais?.ticketPorPremioTotal || 0,
                    ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Ticket por Prêmio (Total)
                  </div>
                  <div className="text-[10px] sm:text-xs opacity-80 mt-1">
                    Fórmula: Faturamento Bruto ÷ Produtos Saíram
                  </div>
                  <div className="text-[10px] sm:text-xs opacity-80 mt-1">
                    {`R$ ${Number(
                      relatorio.totais?.valorTotalLojaBruto || 0,
                    ).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })} / ${(relatorio.totais?.produtosSairam || 0).toLocaleString("pt-BR")} saídas`}
                  </div>
                </div>
              </div>
            </div>
            {/* Detalhamento por máquina */}
            {relatorio.maquinas && relatorio.maquinas.length > 0 && (
              <div className="space-y-6">
                <div className="card bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold flex items-center gap-2 sm:gap-3">
                    <span className="text-3xl sm:text-4xl">🎰</span>
                    <span className="break-words">
                      RELATÓRIO DETALHADO POR MÁQUINA
                    </span>
                  </h2>
                  <p className="text-xs sm:text-sm opacity-90 mt-2">
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
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 sm:p-6 rounded-xl mb-4 sm:mb-6 shadow-lg">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-1">
                          <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2">
                            🎰 {maquina.maquina.nome || `Máquina ${index + 1}`}
                          </h3>
                          <p className="text-sm sm:text-lg opacity-90">
                            📋 Código:{" "}
                            <span className="font-mono font-bold">
                              {maquina.maquina.codigo}
                            </span>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="bg-white/20 backdrop-blur-sm px-3 sm:px-4 py-2 rounded-lg">
                            <div className="text-xs sm:text-sm opacity-90">
                              Máquina
                            </div>
                            <div className="text-2xl sm:text-3xl font-bold">
                              {index + 1}/{relatorio.maquinas.length}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Totais da Máquina em destaque */}
                    <div className="mb-4 sm:mb-6">
                      <h4 className="text-base sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                        <span className="text-xl sm:text-2xl">📊</span>
                        <span className="text-sm sm:text-base">
                          Resumo de Movimentações desta Máquina
                        </span>
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2 sm:gap-4">
                        {/* Fichas */}
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            🎫
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            {maquina.totais.fichas.toLocaleString("pt-BR")}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Total de Fichas
                          </div>
                        </div>
                        {/* Dinheiro máquina */}
                        <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            💵
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            R${" "}
                            {Number(
                              maquina.totais.dinheiro || 0,
                            ).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Dinheiro
                          </div>
                        </div>
                        {/* Cartão/Pix máquina */}
                        <div className="bg-gradient-to-br from-cyan-400 to-cyan-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            🟢
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            R${" "}
                            {Number(
                              maquina.totais.cartaoPix || 0,
                            ).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Cartão / Pix
                          </div>
                        </div>
                        {/* Produtos que saíram */}
                        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            📤
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            {maquina.totais.produtosSairam.toLocaleString(
                              "pt-BR",
                            )}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Produtos Saíram
                          </div>
                        </div>
                        {/* Produtos que entraram */}
                        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            📥
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            {maquina.totais.produtosEntraram.toLocaleString(
                              "pt-BR",
                            )}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Produtos Entraram
                          </div>
                        </div>
                        {/* Movimentações
                        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            🔄
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            {maquina.totais.movimentacoes}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Total de Movimentações
                          </div>
                        </div> */}
                        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            ➖💸
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            {maquina.totais.custoProdutosSairam !==
                              undefined && (
                              <div className="text-xl sm:text-3xl font-bold text-center">
                                R${" "}
                                {Number(
                                  maquina.totais.custoProdutosSairam,
                                ).toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                })}
                              </div>
                            )}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Custo dos produtos que saíram
                          </div>
                        </div>
                        {/* Custo total das pelúcias */}

                        {/* Lucro da máquina */}
                        <div className="bg-gradient-to-br from-yellow-500 to-orange-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            💰
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            R${" "}
                            {(() => {
                              const fichas = maquina.totais.fichas || 0;
                              const valorFicha =
                                maquina.maquina.valorFicha || 2.5;
                              return (fichas * valorFicha).toFixed(2);
                            })()}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Lucro da Máquina
                          </div>
                        </div>
                        {/* Lucro Líquido da máquina */}
                        <div className="bg-gradient-to-br from-green-700 to-green-400 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            🟩
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            R${" "}
                            {Number(
                              maquina.totais.lucroLiquido || 0,
                            ).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Lucro Líquido da Máquina
                          </div>
                        </div>
                        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            🎯
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            R${" "}
                            {Number(
                              maquina.totais.ticketPorPremio || 0,
                            ).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Ticket por Prêmio
                          </div>
                          <div className="text-[10px] sm:text-xs text-center mt-1 opacity-80">
                            Faturamento Bruto ÷ Produtos Saíram
                          </div>
                          <div className="text-[10px] sm:text-xs text-center mt-1 opacity-80">
                            {`R$ ${Number(
                              maquina.totais.faturamentoBruto || 0,
                            ).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })} / ${Number(
                              maquina.totais.produtosSairam || 0,
                            ).toLocaleString("pt-BR")} saídas`}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Produtos da Máquina */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                      {/* Produtos que Saíram */}
                      <div className="bg-red-50 p-3 sm:p-5 rounded-xl border-2 border-red-200">
                        <h4 className="text-base sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2 bg-red-500 text-white p-2 sm:p-3 rounded-lg">
                          <span className="text-xl sm:text-2xl">📤</span>
                          <span className="text-sm sm:text-base">
                            Produtos que SAÍRAM
                          </span>
                          <span className="ml-auto bg-white text-red-500 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold">
                            {maquina.totais.produtosSairam}
                          </span>
                        </h4>
                        {maquina.produtosSairam &&
                        maquina.produtosSairam.length > 0 ? (
                          <div className="space-y-2 sm:space-y-3">
                            {maquina.produtosSairam
                              .sort((a, b) => b.quantidade - a.quantidade)
                              .map((produto) => (
                                <div
                                  key={produto.id}
                                  className="bg-white p-3 sm:p-4 rounded-lg border-2 border-red-300 shadow-md"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                      <span className="text-2xl sm:text-4xl shrink-0">
                                        {produto.emoji || "📦"}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <div className="font-bold text-sm sm:text-lg text-gray-900 truncate">
                                          {produto.nome}
                                        </div>
                                        <div className="text-xs sm:text-sm text-gray-600 truncate">
                                          📋 Cód:{" "}
                                          <span className="font-mono">
                                            {produto.codigo || "S/C"}
                                          </span>
                                        </div>
                                        {/* Custo unitário e total do produto */}
                                        {produto.custoUnitario !==
                                          undefined && (
                                          <div className="text-xs text-gray-700 mt-1">
                                            💲 Custo unitário: R${" "}
                                            {Number(
                                              produto.custoUnitario,
                                            ).toLocaleString("pt-BR", {
                                              minimumFractionDigits: 2,
                                            })}
                                            {produto.custoTotal !==
                                              undefined && (
                                              <>
                                                {" "}
                                                | Custo total:{" "}
                                                <span className="font-bold">
                                                  R${" "}
                                                  {Number(
                                                    produto.custoTotal,
                                                  ).toLocaleString("pt-BR", {
                                                    minimumFractionDigits: 2,
                                                  })}
                                                </span>
                                              </>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="bg-red-500 text-white px-3 sm:px-5 py-2 sm:py-3 rounded-xl font-bold text-base sm:text-xl shrink-0">
                                      {produto.quantidade.toLocaleString(
                                        "pt-BR",
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
                      <div className="bg-green-50 p-3 sm:p-5 rounded-xl border-2 border-green-200">
                        <h4 className="text-base sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2 bg-green-500 text-white p-2 sm:p-3 rounded-lg">
                          <span className="text-xl sm:text-2xl">📥</span>
                          <span className="text-sm sm:text-base">
                            Produtos que ENTRARAM
                          </span>
                          <span className="ml-auto bg-white text-green-500 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold">
                            {maquina.totais.produtosEntraram}
                          </span>
                        </h4>
                        {maquina.produtosEntraram &&
                        maquina.produtosEntraram.length > 0 ? (
                          <div className="space-y-2 sm:space-y-3">
                            {maquina.produtosEntraram
                              .sort((a, b) => b.quantidade - a.quantidade)
                              .map((produto) => (
                                <div
                                  key={produto.id}
                                  className="bg-white p-3 sm:p-4 rounded-lg border-2 border-green-300 shadow-md"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                      <span className="text-2xl sm:text-4xl shrink-0">
                                        {produto.emoji || "📦"}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <div className="font-bold text-sm sm:text-lg text-gray-900 truncate">
                                          {produto.nome}
                                        </div>
                                        <div className="text-xs sm:text-sm text-gray-600 truncate">
                                          📋 Cód:{" "}
                                          <span className="font-mono">
                                            {produto.codigo || "S/C"}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="bg-green-500 text-white px-3 sm:px-5 py-2 sm:py-3 rounded-xl font-bold text-base sm:text-xl shrink-0">
                                      {produto.quantidade.toLocaleString(
                                        "pt-BR",
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <div className="text-center py-6 sm:py-8 bg-white rounded-lg">
                            <p className="text-4xl sm:text-6xl mb-2">📭</p>
                            <p className="text-sm sm:text-base text-gray-500 font-medium">
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

            {/* Gráfico de saída por máquina */}
            {relatorio.graficoSaidaPorMaquina &&
              relatorio.graficoSaidaPorMaquina.length > 0 && (
                <div className="card bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 mt-8">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">📊</span>
                    Gráfico: Saída de Produtos por Máquina
                  </h3>
                  <div className="flex flex-wrap gap-4">
                    {relatorio.graficoSaidaPorMaquina.map((item) => (
                      <div
                        key={item.maquina}
                        className="flex flex-col items-center"
                      >
                        <div className="font-bold text-lg text-blue-700">
                          {item.maquina}
                        </div>
                        <div className="w-12 h-12 flex items-end">
                          <div
                            style={{
                              height: `${item.produtosSairam}px`,
                              background: "#1976d2",
                              width: "100%",
                              borderRadius: 4,
                            }}
                          ></div>
                        </div>
                        <div className="text-sm text-gray-700 mt-2">
                          {item.produtosSairam} saíram
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            {/* Gráfico de saída por produto */}
            {relatorio.graficoSaidaPorProduto &&
              relatorio.graficoSaidaPorProduto.length > 0 && (
                <div className="card bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300 mt-8">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">📦</span>
                    Gráfico: Saída de Produtos por Tipo
                  </h3>
                  <div className="flex flex-wrap gap-4">
                    {relatorio.graficoSaidaPorProduto.map((item) => (
                      <div
                        key={item.produto}
                        className="flex flex-col items-center"
                      >
                        <div className="font-bold text-lg text-green-700">
                          {item.produto}
                        </div>
                        <div className="w-12 h-12 flex items-end">
                          <div
                            style={{
                              height: `${item.quantidade}px`,
                              background: "#43a047",
                              width: "100%",
                              borderRadius: 4,
                            }}
                          ></div>
                        </div>
                        <div className="text-sm text-gray-700 mt-2">
                          {item.quantidade} saíram
                        </div>
                      </div>
                    ))}
                  </div>
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
              Selecione uma loja (ou todas as lojas) e o período para gerar o
              relatório
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
