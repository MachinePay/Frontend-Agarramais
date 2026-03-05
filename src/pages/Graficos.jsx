import { useState, useEffect, useCallback, useMemo } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
} from "recharts";

export function Graficos() {
  const [loading, setLoading] = useState(false);
  const [lojas, setLojas] = useState([]);
  const [lojaSelecionada, setLojaSelecionada] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [dadosGraficos, setDadosGraficos] = useState(null);
  const [dadosDashboard, setDadosDashboard] = useState(null);
  const [dadosImpressao, setDadosImpressao] = useState(null);
  const [erro, setErro] = useState("");

  const totaisGerais = useMemo(
    () => dadosGraficos?.totaisGerais || {},
    [dadosGraficos],
  );

  const faturamentoTotal = useMemo(() => {
    return (
      Number(totaisGerais.dinheiro || 0) + Number(totaisGerais.cartaoPix || 0)
    );
  }, [totaisGerais]);

  const custoTotalPeriodo = useMemo(() => {
    return Number(totaisGerais.gastoTotal || 0);
  }, [totaisGerais]);

  const lucroLiquido = useMemo(() => {
    return faturamentoTotal - custoTotalPeriodo;
  }, [faturamentoTotal, custoTotalPeriodo]);

  const margemLucro = useMemo(() => {
    if (!faturamentoTotal) return 0;
    return (lucroLiquido / faturamentoTotal) * 100;
  }, [faturamentoTotal, lucroLiquido]);

  // Exemplo: pode adaptar para ticket médio se houver dados de saídas
  const ticketMedioPremio = useMemo(() => 0, []);

  const indiceCusto = useMemo(() => {
    if (!faturamentoTotal) return 0;
    return (custoTotalPeriodo / faturamentoTotal) * 100;
  }, [custoTotalPeriodo, faturamentoTotal]);

  const composicaoCustos = useMemo(
    () =>
      [
        {
          nome: "Produtos",
          valor: Number(totaisGerais.gastoProdutos || 0),
        },
        {
          nome: "Fixos",
          valor: Number(totaisGerais.gastoFixo || 0),
        },
        {
          nome: "Variáveis",
          valor: Number(totaisGerais.gastoVariavel || 0),
        },
      ].filter((item) => item.valor > 0),
    [totaisGerais],
  );

  const recebimentos = useMemo(() => {
    return [
      { metodo: "Dinheiro", valor: Number(totaisGerais.dinheiro || 0) },
      { metodo: "Cartão/Pix", valor: Number(totaisGerais.cartaoPix || 0) },
    ];
  }, [totaisGerais]);

  const fluxoProdutos = useMemo(() => {
    const mapa = new Map();

    (dadosImpressao?.produtosSairam || []).forEach((item) => {
      const chave = String(item.id || item.codigo || item.nome || "produto");
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          nome: item.nome,
          saiu: 0,
          entrou: 0,
        });
      }
      mapa.get(chave).saiu += Number(item.quantidade || 0);
    });

    (dadosImpressao?.produtosEntraram || []).forEach((item) => {
      const chave = String(item.id || item.codigo || item.nome || "produto");
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          nome: item.nome,
          saiu: 0,
          entrou: 0,
        });
      }
      mapa.get(chave).entrou += Number(item.quantidade || 0);
    });

    return Array.from(mapa.values())
      .sort((a, b) => Math.max(b.saiu, b.entrou) - Math.max(a.saiu, a.entrou))
      .slice(0, 10);
  }, [dadosImpressao]);

  const normalizarDataChave = (valor) => {
    if (!valor) return "";
    if (typeof valor === "string") {
      return valor.length >= 10 ? valor.slice(0, 10) : valor;
    }

    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return "";

    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  };

  const graficoFinanceiro = useMemo(() => {
    const base = Array.isArray(dadosDashboard?.graficoFinanceiro)
      ? dadosDashboard.graficoFinanceiro
      : [];

    if (!dataInicio || !dataFim) return [];

    const dataInicial = new Date(`${dataInicio}T00:00:00`);
    const dataFinal = new Date(`${dataFim}T00:00:00`);
    if (
      Number.isNaN(dataInicial.getTime()) ||
      Number.isNaN(dataFinal.getTime()) ||
      dataInicial > dataFinal
    ) {
      return [];
    }

    const mapaFaturamentoPorDia = new Map();
    const mapaCustoPorDia = new Map();
    const mapaLucroPorDia = new Map();

    base.forEach((item) => {
      const chave = normalizarDataChave(item.data);
      const faturamentoAtual = Number(item.faturamento || 0);
      const custoAtual = Number(item.custo || 0);
      const lucroAtual = Number(item.lucro || 0);

      if (!chave) return;

      mapaFaturamentoPorDia.set(
        chave,
        Number((mapaFaturamentoPorDia.get(chave) || 0) + faturamentoAtual),
      );

      mapaCustoPorDia.set(
        chave,
        Number((mapaCustoPorDia.get(chave) || 0) + custoAtual),
      );

      mapaLucroPorDia.set(
        chave,
        Number((mapaLucroPorDia.get(chave) || 0) + lucroAtual),
      );
    });

    const serieDiaria = [];
    const cursor = new Date(dataInicial);

    while (cursor <= dataFinal) {
      const chave = normalizarDataChave(cursor);
      const faturamentoDia = Number(mapaFaturamentoPorDia.get(chave) || 0);
      const custoDia = Number(mapaCustoPorDia.get(chave) || 0);
      const lucroDiaBackend = Number(mapaLucroPorDia.get(chave) || 0);
      const lucroDia =
        lucroDiaBackend !== 0 ? lucroDiaBackend : faturamentoDia - custoDia;

      serieDiaria.push({
        data: chave,
        faturamento: faturamentoDia,
        custoRateado: Number(custoDia.toFixed(2)),
        lucroRateado: Number(lucroDia.toFixed(2)),
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    return serieDiaria;
  }, [dadosDashboard, dataInicio, dataFim]);

  useEffect(() => {
    // Inicializa datas padrão (últimos 30 dias)
    const hoje = new Date();
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(hoje.getDate() - 30);
    setDataFim(hoje.toISOString().split("T")[0]);
    setDataInicio(trintaDiasAtras.toISOString().split("T")[0]);

    // Carregar lojas
    setLoading(true);
    api
      .get("/lojas")
      .then((res) => {
        setLojas(res.data || []);
        if (res.data && res.data.length > 0) {
          setLojaSelecionada(res.data[0].id);
        }
      })
      .catch(() => {
        setErro("Erro ao carregar lista de lojas.");
      })
      .finally(() => setLoading(false));
  }, []);

  // Removido: carregarLojas não é utilizado

  const carregarDados = useCallback(async () => {
    if (!lojaSelecionada || !dataInicio || !dataFim) return;

    setErro("");
    setLoading(true);

    try {
      const [dashboardResponse, impressaoResponse] = await Promise.all([
        api.get("/relatorios/dashboard", {
          params: {
            lojaId: lojaSelecionada,
            dataInicio,
            dataFim,
          },
        }),
        api.get("/relatorios/impressao", {
          params: {
            lojaId: lojaSelecionada,
            dataInicio,
            dataFim,
          },
        }),
      ]);

      setDadosDashboard(dashboardResponse.data || null);
      setDadosImpressao(impressaoResponse.data || null);
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
      setErro("Não foi possível carregar os dados do painel.");
      setDadosDashboard(null);
      setDadosImpressao(null);
    } finally {
      setLoading(false);
    }
  }, [lojaSelecionada, dataInicio, dataFim]);

  useEffect(() => {
    if (lojaSelecionada && dataInicio && dataFim) {
      if (new Date(dataInicio) > new Date(dataFim)) {
        setErro("A data inicial não pode ser maior que a data final.");
        setDadosDashboard(null);
        setDadosImpressao(null);
        return;
      }
      carregarDados();
    }
  }, [lojaSelecionada, dataInicio, dataFim, carregarDados]);

  const formatMoney = (val) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val || 0);

  const dadosDisponiveis = Boolean(
    dadosGraficos && lojaSelecionada && dataInicio && dataFim,
  );
  useEffect(() => {
    if (!lojaSelecionada || !dataInicio || !dataFim) return;
    setLoading(true);
    const token = localStorage.getItem("token");
    api
      .get("/graficos/dashboard", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        params: {
          lojaId: lojaSelecionada,
          dataInicio,
          dataFim,
        },
      })
      .then((res) => {
        setDadosGraficos(res.data);
        setErro("");
      })
      .catch(() => {
        setErro("Erro ao carregar dados dos gráficos");
      })
      .finally(() => setLoading(false));
  }, [lojaSelecionada, dataInicio, dataFim]);

  if (loading && !dadosDisponiveis) return <PageLoader />;

  return (
    <div className="min-h-screen bg-gray-50 bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Painel de Controle e Gráficos"
          subtitle="Visão estratégica do seu negócio"
          icon="📊"
        />

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-6 mb-8 border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Loja
              </label>
              <select
                value={lojaSelecionada}
                onChange={(e) => setLojaSelecionada(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
              >
                {lojas.map((loja) => (
                  <option key={loja.id} value={loja.id}>
                    {loja.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Data Inicial
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
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
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
              />
            </div>
          </div>
        </div>

        {erro && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 text-red-700">
            <p className="font-bold">Atenção</p>
            <p>{erro}</p>
          </div>
        )}

        {loading && (
          <div className="mb-6 bg-blue-50 border-l-4 border-blue-400 p-4 text-blue-700">
            Atualizando dados...
          </div>
        )}

        {dadosDisponiveis && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex flex-wrap gap-6">
              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Faturamento
                    </p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                      {formatMoney(faturamentoTotal)}
                    </h3>
                  </div>
                  <span className="p-2 bg-green-100 text-green-600 rounded-lg text-xl">
                    💰
                  </span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-yellow-500">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Dinheiro
                    </p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                      {formatMoney(recebimentos[0]?.valor || 0)}
                    </h3>
                  </div>
                  <span className="p-2 bg-yellow-100 text-yellow-600 rounded-lg text-xl">
                    💵
                  </span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-cyan-500">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Cartão/Pix
                    </p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                      {formatMoney(recebimentos[1]?.valor || 0)}
                    </h3>
                  </div>
                  <span className="p-2 bg-cyan-100 text-cyan-600 rounded-lg text-xl">
                    🟢
                  </span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Lucro Líquido
                    </p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                      {formatMoney(lucroLiquido)}
                    </h3>
                  </div>
                  <span className="p-2 bg-blue-100 text-blue-600 rounded-lg text-xl">
                    📈
                  </span>
                </div>
                <div className="mt-3 flex items-center">
                  <span className="text-sm font-semibold text-green-600">
                    {margemLucro.toFixed(1)}%
                  </span>
                  <span className="text-xs text-gray-500 ml-1">Margem</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-orange-500">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Prêmios Entregues
                    </p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                      {Number(totaisGerais?.saidas || 0)}
                    </h3>
                  </div>
                  <span className="p-2 bg-orange-100 text-orange-600 rounded-lg text-xl">
                    🧸
                  </span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-500">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Total Fichas
                    </p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                      {Number(totaisGerais?.fichas || 0)}
                    </h3>
                  </div>
                  <span className="p-2 bg-purple-100 text-purple-600 rounded-lg text-xl">
                    🎫
                  </span>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  Média:{" "}
                  {Number(totaisGerais?.saidas || 0) > 0
                    ? (
                        Number(totaisGerais?.fichas || 0) /
                        Number(totaisGerais?.saidas || 0)
                      ).toFixed(1)
                    : "0.0"}{" "}
                  fichas/prêmio
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-rose-500">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Custo Total
                    </p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                      {formatMoney(custoTotalPeriodo)}
                    </h3>
                  </div>
                  <span className="p-2 bg-rose-100 text-rose-600 rounded-lg text-xl">
                    🧾
                  </span>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  {indiceCusto.toFixed(1)}% do faturamento
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-indigo-500">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Ticket por Prêmio
                    </p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                      {formatMoney(ticketMedioPremio)}
                    </h3>
                  </div>
                  <span className="p-2 bg-indigo-100 text-indigo-600 rounded-lg text-xl">
                    🎯
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
                  <span className="bg-gray-100 p-1 rounded mr-2">📅</span>
                  Evolução Diária
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Custos fixos e variáveis são distribuídos por dia (rateio no
                  período).
                </p>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={graficoFinanceiro}>
                      <defs>
                        <linearGradient
                          id="colorFat"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#10B981"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="#10B981"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="data"
                        tickFormatter={(str) =>
                          new Date(str).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                          })
                        }
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) => formatMoney(value)}
                        labelFormatter={(label) =>
                          new Date(label).toLocaleDateString("pt-BR")
                        }
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="faturamento"
                        name="Faturamento"
                        stroke="#10B981"
                        fillOpacity={1}
                        fill="url(#colorFat)"
                      />
                      <Area
                        type="monotone"
                        dataKey="custoRateado"
                        name="Custo Rateado"
                        stroke="#EF4444"
                        fillOpacity={0.1}
                        fill="#EF4444"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
                  <span className="bg-gray-100 p-1 rounded mr-2">🤖</span>
                  Performance por Máquina
                </h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dadosDashboard?.performanceMaquinas || []}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="nome"
                        type="category"
                        width={100}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        cursor={{ fill: "transparent" }}
                        formatter={(value, name) => [
                          name === "faturamento"
                            ? formatMoney(value)
                            : `${value}%`,
                          name === "faturamento" ? "Faturamento" : "Ocupação",
                        ]}
                      />
                      <Legend />
                      <Bar
                        dataKey="faturamento"
                        name="Faturamento"
                        fill="#3B82F6"
                        radius={[0, 4, 4, 0]}
                        barSize={20}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <span className="bg-gray-100 p-1 rounded mr-2">🏆</span>
                  Top Produtos Vendidos
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
                      {(dadosDashboard?.rankingProdutos || []).map(
                        (prod, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                              {idx + 1}. {prod.nome}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 text-right">
                              {prod.quantidade}
                            </td>
                            <td className="px-4 py-3">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-indigo-600 h-2 rounded-full"
                                  style={{
                                    width: `${Math.min(
                                      (prod.quantidade /
                                        (dadosDashboard?.rankingProdutos?.[0]
                                          .quantidade || 1)) *
                                        100,
                                      100,
                                    )}%`,
                                  }}
                                ></div>
                              </div>
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
                  <span className="bg-gray-100 p-1 rounded mr-2">📦</span>
                  Nível de Estoque (%)
                </h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dadosDashboard?.performanceMaquinas || []}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="nome"
                        tick={{ fontSize: 10 }}
                        interval={0}
                      />
                      <YAxis domain={[0, 100]} />
                      <Tooltip formatter={(val) => `${val}%`} />
                      <Bar
                        dataKey="ocupacao"
                        name="Ocupação"
                        radius={[4, 4, 0, 0]}
                      >
                        {(dadosDashboard?.performanceMaquinas || []).map(
                          (entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                entry.ocupacao < 30
                                  ? "#EF4444" // Crítico
                                  : entry.ocupacao < 60
                                    ? "#F59E0B" // Atenção
                                    : "#10B981" // Bom
                              }
                            />
                          ),
                        )}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-lg shadow lg:col-span-1">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
                  <span className="bg-gray-100 p-1 rounded mr-2">🧩</span>
                  Composição de Custos
                </h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={composicaoCustos}
                        dataKey="valor"
                        nameKey="nome"
                        outerRadius={95}
                        label={({ nome, percent }) =>
                          `${nome} ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {composicaoCustos.map((_, index) => (
                          <Cell
                            key={`custo-${index}`}
                            fill={["#F97316", "#3B82F6", "#10B981"][index % 3]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatMoney(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow lg:col-span-1">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
                  <span className="bg-gray-100 p-1 rounded mr-2">💳</span>
                  Mix de Recebimentos
                </h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={recebimentos}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="metodo" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatMoney(value)} />
                      <Bar dataKey="valor" name="Valor" radius={[6, 6, 0, 0]}>
                        {recebimentos.map((entry, index) => (
                          <Cell
                            key={`receb-${index}`}
                            fill={
                              entry.metodo === "Dinheiro"
                                ? "#F59E0B"
                                : "#06B6D4"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow lg:col-span-1">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
                  <span className="bg-gray-100 p-1 rounded mr-2">📉</span>
                  Receita x Custo x Resultado
                </h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={graficoFinanceiro}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="data"
                        tickFormatter={(str) =>
                          new Date(str).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                          })
                        }
                      />
                      <YAxis />
                      <Tooltip
                        formatter={(value) => formatMoney(value)}
                        labelFormatter={(label) =>
                          new Date(label).toLocaleDateString("pt-BR")
                        }
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="faturamento"
                        name="Receita"
                        stroke="#10B981"
                        strokeWidth={3}
                      />
                      <Line
                        type="monotone"
                        dataKey="custoRateado"
                        name="Custo Rateado"
                        stroke="#EF4444"
                        strokeWidth={3}
                      />
                      <Line
                        type="monotone"
                        dataKey="lucroRateado"
                        name="Resultado Rateado"
                        stroke="#3B82F6"
                        strokeWidth={3}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
                <span className="bg-gray-100 p-1 rounded mr-2">🔁</span>
                Fluxo de Produtos (Entradas x Saídas)
              </h3>
              <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={fluxoProdutos}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="nome"
                      tick={{ fontSize: 10 }}
                      interval={0}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="entrou"
                      name="Entrou"
                      fill="#06B6D4"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="saiu"
                      name="Saiu"
                      fill="#F97316"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {!loading && !dadosDisponiveis && !erro && (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600 border border-gray-100">
            Selecione os filtros para visualizar os gráficos financeiros.
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
