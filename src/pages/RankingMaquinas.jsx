import { useState, useEffect, useCallback, useMemo } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader } from "../components/UIComponents";
import {
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const toN = (v) => Number(v || 0);

const CORES_RANKING = [
  "#D97706",
  "#4F46E5",
  "#7C3AED",
  "#DB2777",
  "#DC2626",
  "#EA580C",
  "#65A30D",
  "#059669",
  "#0891B2",
  "#2563EB",
];

const formatarMesInput = (data) => {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
};

const obterPeriodoDoMes = (mesTexto) => {
  if (!mesTexto) return null;

  const [anoTexto, mesNumeroTexto] = String(mesTexto).split("-");
  const ano = Number(anoTexto);
  const mes = Number(mesNumeroTexto);

  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    return null;
  }

  const formatarDataISO = (data) => {
    const anoData = data.getFullYear();
    const mesData = String(data.getMonth() + 1).padStart(2, "0");
    const diaData = String(data.getDate()).padStart(2, "0");
    return `${anoData}-${mesData}-${diaData}`;
  };

  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 0);

  return {
    dataInicio: formatarDataISO(inicio),
    dataFim: formatarDataISO(fim),
  };
};

export function RankingMaquinas() {
  const [lojas, setLojas] = useState([]);
  const [lojaSelecionada, setLojaSelecionada] = useState("");
  const [mesReferencia, setMesReferencia] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [dados, setDados] = useState(null);

  useEffect(() => {
    const mesAtual = formatarMesInput(new Date());
    const periodoAtual = obterPeriodoDoMes(mesAtual);
    setMesReferencia(mesAtual);
    setDataInicio(periodoAtual?.dataInicio || "");
    setDataFim(periodoAtual?.dataFim || "");

    api
      .get("/lojas")
      .then((res) => setLojas(res.data || []))
      .catch(() => {});
  }, []);

  const handleMesReferenciaChange = (valorMes) => {
    setMesReferencia(valorMes);
    const periodo = obterPeriodoDoMes(valorMes);
    setDataInicio(periodo?.dataInicio || "");
    setDataFim(periodo?.dataFim || "");
  };

  const [performance, setPerformance] = useState([]);
  const [machinePayTotal, setMachinePayTotal] = useState(null);

  const carregarDados = useCallback(async () => {
    if (!dataInicio || !dataFim) return;

    setLoading(true);
    setErro("");
    try {
      const params = { dataInicio, dataFim };
      if (lojaSelecionada) params.lojaId = lojaSelecionada;

      const [dashboardRes, performanceRes, machinePayRes] = await Promise.all([
        api.get("/relatorios/dashboard", { params }),
        api.get("/relatorios/performance-maquinas", { params }),
        api
          .get("/registro-dinheiro/machine-pay-total", {
            params: { inicio: dataInicio, fim: `${dataFim}T23:59` },
          })
          .catch(() => ({ data: { maquinas: [] } })),
      ]);

      setDados(dashboardRes.data);
      setPerformance(performanceRes.data?.performance || []);
      setMachinePayTotal(machinePayRes.data || null);
    } catch (err) {
      console.error("[RankingMaquinas] Erro ao carregar dados:", err);
      setErro("Não foi possível carregar o ranking de máquinas.");
      setDados(null);
      setPerformance([]);
      setMachinePayTotal(null);
    } finally {
      setLoading(false);
    }
  }, [lojaSelecionada, dataInicio, dataFim]);

  useEffect(() => {
    if (dataInicio && dataFim) carregarDados();
  }, [dataInicio, dataFim, carregarDados]);

  const valorFichaPorLoja = useMemo(() => {
    const mapa = new Map();
    lojas.forEach((loja) => {
      mapa.set(String(loja.id), toN(loja.valorFichaPadrao) || 2.5);
    });
    return mapa;
  }, [lojas]);

  const machinePayPorMaquina = useMemo(() => {
    const mapa = new Map();
    (machinePayTotal?.maquinas || []).forEach((item) => {
      mapa.set(String(item.maquinaId), toN(item.brutoComTaxasMp));
    });
    return mapa;
  }, [machinePayTotal]);

  const top10Maquinas = useMemo(() => {
    const itens = performance.map((p) => {
      const maquinaId = String(p.maquina?.id);
      const fichas = toN(p.metricas?.totalFichas);
      const valorFicha = valorFichaPorLoja.get(String(p.maquina?.lojaId)) || 2.5;
      const valorMachinePay = machinePayPorMaquina.get(maquinaId);
      const temMachinePay = valorMachinePay !== undefined;

      return {
        maquinaId,
        nome: p.maquina?.nome || "-",
        loja: p.maquina?.loja || "-",
        fonte: temMachinePay ? "machinePay" : "fichas",
        valor: temMachinePay ? valorMachinePay : fichas * valorFicha,
        fichas,
        valorFicha,
      };
    });

    return itens.sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, [performance, valorFichaPorLoja, machinePayPorMaquina]);

  const topProdutos = useMemo(
    () => (Array.isArray(dados?.rankingProdutos) ? dados.rankingProdutos : []),
    [dados],
  );

  const totais = dados?.totais || {};

  const formatMoney = (val) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val || 0);

  return (
    <div className="min-h-screen bg-gray-50 bg-pattern teddy-pattern">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Ranking de Máquinas"
          subtitle="Top 10 máquinas por faturamento, com fichas, saídas e produtos mais retirados"
          icon="🏆"
        />

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow p-6 mb-8 border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
            Filtros do período
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Loja
              </label>
              <select
                value={lojaSelecionada}
                onChange={(e) => setLojaSelecionada(e.target.value)}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 border text-sm"
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
                Mês
              </label>
              <input
                type="month"
                value={mesReferencia}
                onChange={(e) => handleMesReferenciaChange(e.target.value)}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 border text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Data Inicial
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 border text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Data Final
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 border text-sm"
              />
            </div>
          </div>
        </div>

        {erro && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded-r-lg">
            {erro}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Carregando ranking...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* KPIs */}
            <div className="flex flex-wrap gap-6">
              <KpiCard
                titulo="Faturamento Total"
                valor={formatMoney(totais.faturamento)}
                icon="💰"
                cor="green"
              />
              <KpiCard
                titulo="Lucro Líquido"
                valor={formatMoney(totais.lucro)}
                icon="📈"
                cor="blue"
              />
              <KpiCard
                titulo="Total de Fichas"
                valor={toN(totais.fichas).toLocaleString("pt-BR")}
                icon="🎫"
                cor="purple"
              />
              <KpiCard
                titulo="Prêmios Saídos"
                valor={toN(totais.saidas).toLocaleString("pt-BR")}
                icon="🧸"
                cor="orange"
              />
            </div>

            {/* Gráfico Top 10 */}
            {top10Maquinas.length > 0 ? (
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-2xl">📊</span> Top 10 Máquinas
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  Valor recebido na Machine Pay no período; quando a máquina
                  não tem Machine Pay cadastrada, usa a quantidade de fichas
                  vezes o valor da ficha cadastrado na loja.
                </p>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={top10Maquinas}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis
                        type="number"
                        tickFormatter={formatMoney}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        dataKey="nome"
                        type="category"
                        width={140}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip formatter={(v) => formatMoney(v)} />
                      <Bar
                        dataKey="valor"
                        name="Valor"
                        radius={[0, 4, 4, 0]}
                        barSize={18}
                      >
                        {top10Maquinas.map((_, i) => (
                          <Cell
                            key={i}
                            fill={CORES_RANKING[i % CORES_RANKING.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-lg shadow text-center text-gray-400 text-sm">
                Sem dados de máquinas para o período selecionado.
              </div>
            )}

            {/* Ranking detalhado */}
            {top10Maquinas.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-2xl">🏆</span> Ranking Detalhado
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          #
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Máquina
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Loja
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Valor
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Fonte
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {top10Maquinas.map((maquina, idx) => (
                        <tr key={maquina.maquinaId || idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-bold text-gray-900">
                            {idx === 0
                              ? "🥇"
                              : idx === 1
                                ? "🥈"
                                : idx === 2
                                  ? "🥉"
                                  : idx + 1}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                            {maquina.nome}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {maquina.loja}
                          </td>
                          <td className="px-4 py-3 text-sm text-emerald-700 font-semibold text-right">
                            {formatMoney(maquina.valor)}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {maquina.fonte === "machinePay"
                              ? "💳 Machine Pay"
                              : `🎟️ ${maquina.fichas.toLocaleString(
                                  "pt-BR",
                                )} fichas × R$ ${maquina.valorFicha.toLocaleString(
                                  "pt-BR",
                                  { minimumFractionDigits: 2 },
                                )}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Produtos mais saídos */}
            {topProdutos.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-2xl">🧸</span> Produtos Mais Saídos
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Produto
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Qtd
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Popularidade
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {topProdutos.map((produto, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                            {idx + 1}. {produto.nome}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 text-right">
                            {toN(produto.quantidade).toLocaleString("pt-BR")}
                          </td>
                          <td className="px-4 py-3">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-indigo-600 h-2 rounded-full"
                                style={{
                                  width: `${Math.min(
                                    (toN(produto.quantidade) /
                                      toN(topProdutos[0]?.quantidade || 1)) *
                                      100,
                                    100,
                                  )}%`,
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

const COR_MAP = {
  green: "border-green-500 bg-green-100 text-green-600",
  blue: "border-blue-500 bg-blue-100 text-blue-600",
  purple: "border-purple-500 bg-purple-100 text-purple-600",
  orange: "border-orange-500 bg-orange-100 text-orange-600",
};

function KpiCard({ titulo, valor, icon, cor }) {
  const [border, bg, text] = (COR_MAP[cor] || COR_MAP.blue).split(" ");
  return (
    <div
      className={`bg-white p-6 rounded-lg shadow-md border-l-4 ${border} flex-1 min-w-[180px]`}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            {titulo}
          </p>
          <h3 className="text-2xl font-bold text-gray-900 mt-1">{valor}</h3>
        </div>
        <span className={`p-2 ${bg} ${text} rounded-lg text-xl`}>{icon}</span>
      </div>
    </div>
  );
}
