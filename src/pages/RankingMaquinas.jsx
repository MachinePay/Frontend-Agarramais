import { useState, useEffect, useCallback, useMemo } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader } from "../components/UIComponents";
import {
  construirMapaValorRegistrado,
  construirMapaMachinePay,
  obterValorReconciliadoMaquina,
  somarValorComRegistradoFallback,
  somarValorRegistradoConsolidado,
  ehMesAtualReal,
} from "../utils/faturamentoReconciliado";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const toN = (v) => Number(v || 0);

const MESES_NOMES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

// Quando a Machine Pay já fez o fechamento do mês, o valor lá fica zerado.
// Nesse caso usamos o último valor registrado no nosso sistema (Registrar
// Dinheiro) para aquela máquina no período, em vez de mostrar R$ 0,00 (ver
// obterValorReconciliadoMaquina em utils/faturamentoReconciliado.js).
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

// Calcula o período equivalente no mês anterior, para o comparativo do KPI.
// Quando o período selecionado é um mês cheio (caso comum, vindo do seletor
// "Mês"), usa o mês calendário anterior inteiro. Para um range customizado
// (Data Inicial/Data Final editados manualmente), desloca cada ponta um mês
// para trás mantendo o mesmo dia (melhor esforço).
const obterPeriodoMesAnterior = (dataInicioTexto, dataFimTexto) => {
  if (!dataInicioTexto || !dataFimTexto) return null;

  const [anoI, mesI, diaI] = dataInicioTexto.split("-").map(Number);
  const [anoF, mesF, diaF] = dataFimTexto.split("-").map(Number);

  if (!anoI || !mesI || !diaI || !anoF || !mesF || !diaF) return null;

  const ultimoDiaDoMesInicio = new Date(anoI, mesI, 0).getDate();
  const ehMesCheio =
    diaI === 1 &&
    anoI === anoF &&
    mesI === mesF &&
    diaF === ultimoDiaDoMesInicio;

  if (ehMesCheio) {
    const mesAnteriorData = new Date(anoI, mesI - 2, 1);
    const mesAnteriorTexto = `${mesAnteriorData.getFullYear()}-${String(
      mesAnteriorData.getMonth() + 1,
    ).padStart(2, "0")}`;
    return obterPeriodoDoMes(mesAnteriorTexto);
  }

  const deslocarUmMes = (ano, mes, dia) => {
    const data = new Date(ano, mes - 2, dia);
    const anoData = data.getFullYear();
    const mesData = String(data.getMonth() + 1).padStart(2, "0");
    const diaData = String(data.getDate()).padStart(2, "0");
    return `${anoData}-${mesData}-${diaData}`;
  };

  return {
    dataInicio: deslocarUmMes(anoI, mesI, diaI),
    dataFim: deslocarUmMes(anoF, mesF, diaF),
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
  const [valorRegistradoPorMaquina, setValorRegistradoPorMaquina] = useState(
    new Map(),
  );
  // Lista bruta de /registro-dinheiro (todas as lojas/máquinas, sem filtro
  // de data) — usada por somarValorRegistradoConsolidado para meses já
  // fechados, que soma diretamente sobre os registros brutos em vez de um
  // Map por máquina.
  const [registrosDinheiroTodos, setRegistrosDinheiroTodos] = useState([]);

  // Comparativo "mês passado" do KPI de Faturamento Total
  const [periodoAnterior, setPeriodoAnterior] = useState(null);
  const [performanceAnterior, setPerformanceAnterior] = useState([]);
  const [machinePayTotalAnterior, setMachinePayTotalAnterior] = useState(null);
  const [
    valorRegistradoAnteriorPorMaquina,
    setValorRegistradoAnteriorPorMaquina,
  ] = useState(new Map());

  const carregarDados = useCallback(async () => {
    if (!dataInicio || !dataFim) return;

    setLoading(true);
    setErro("");
    try {
      const params = { dataInicio, dataFim };
      if (lojaSelecionada) params.lojaId = lojaSelecionada;

      const periodoAnteriorCalculado = obterPeriodoMesAnterior(
        dataInicio,
        dataFim,
      );
      const paramsAnterior = periodoAnteriorCalculado
        ? {
            dataInicio: periodoAnteriorCalculado.dataInicio,
            dataFim: periodoAnteriorCalculado.dataFim,
            ...(lojaSelecionada ? { lojaId: lojaSelecionada } : {}),
          }
        : null;

      const [
        dashboardRes,
        performanceRes,
        machinePayRes,
        registrosRes,
        performanceAnteriorRes,
        machinePayAnteriorRes,
      ] = await Promise.all([
        api.get("/relatorios/dashboard", { params }),
        api.get("/relatorios/performance-maquinas", { params }),
        api
          .get("/registro-dinheiro/machine-pay-total", {
            params: { inicio: dataInicio, fim: `${dataFim}T23:59` },
          })
          .catch(() => ({ data: { maquinas: [] } })),
        api.get("/registro-dinheiro").catch(() => ({ data: [] })),
        paramsAnterior
          ? api
              .get("/relatorios/performance-maquinas", {
                params: paramsAnterior,
              })
              .catch(() => ({ data: { performance: [] } }))
          : Promise.resolve({ data: { performance: [] } }),
        paramsAnterior
          ? api
              .get("/registro-dinheiro/machine-pay-total", {
                params: {
                  inicio: paramsAnterior.dataInicio,
                  fim: `${paramsAnterior.dataFim}T23:59`,
                },
              })
              .catch(() => ({ data: { maquinas: [] } }))
          : Promise.resolve({ data: { maquinas: [] } }),
      ]);

      setDados(dashboardRes.data);
      setPerformance(performanceRes.data?.performance || []);
      setMachinePayTotal(machinePayRes.data || null);
      setValorRegistradoPorMaquina(
        construirMapaValorRegistrado(registrosRes.data, dataInicio, dataFim),
      );
      setRegistrosDinheiroTodos(
        Array.isArray(registrosRes.data) ? registrosRes.data : [],
      );

      setPeriodoAnterior(periodoAnteriorCalculado);
      setPerformanceAnterior(performanceAnteriorRes.data?.performance || []);
      setMachinePayTotalAnterior(machinePayAnteriorRes.data || null);
      setValorRegistradoAnteriorPorMaquina(
        periodoAnteriorCalculado
          ? construirMapaValorRegistrado(
              registrosRes.data,
              periodoAnteriorCalculado.dataInicio,
              periodoAnteriorCalculado.dataFim,
            )
          : new Map(),
      );
    } catch (err) {
      console.error("[RankingMaquinas] Erro ao carregar dados:", err);
      setErro("Não foi possível carregar o ranking de máquinas.");
      setDados(null);
      setPerformance([]);
      setMachinePayTotal(null);
      setValorRegistradoPorMaquina(new Map());
      setRegistrosDinheiroTodos([]);
      setPeriodoAnterior(null);
      setPerformanceAnterior([]);
      setMachinePayTotalAnterior(null);
      setValorRegistradoAnteriorPorMaquina(new Map());
    } finally {
      setLoading(false);
    }
  }, [lojaSelecionada, dataInicio, dataFim]);

  useEffect(() => {
    if (dataInicio && dataFim) carregarDados();
  }, [dataInicio, dataFim, carregarDados]);

  const machinePayPorMaquina = useMemo(
    () => construirMapaMachinePay(machinePayTotal),
    [machinePayTotal],
  );

  const machinePayPorMaquinaAnterior = useMemo(
    () => construirMapaMachinePay(machinePayTotalAnterior),
    [machinePayTotalAnterior],
  );

  // O mês anterior (comparação) é sempre um mês já fechado, então usa a
  // mesma fórmula do Relatório (dinheiro + cartão/pix registrados, por
  // máquina e total da loja) em vez de reconciliar com Machine Pay/fichas.
  const faturamentoTotalMesAnterior = useMemo(
    () =>
      periodoAnterior
        ? somarValorRegistradoConsolidado(
            registrosDinheiroTodos,
            periodoAnterior.dataInicio,
            periodoAnterior.dataFim,
            lojaSelecionada,
          )
        : 0,
    [registrosDinheiroTodos, periodoAnterior, lojaSelecionada],
  );

  const [mostrarTodasMaquinas, setMostrarTodasMaquinas] = useState(false);

  const maquinasRanking = useMemo(() => {
    const itens = performance.map((p) => {
      const maquinaId = String(p.maquina?.id);
      const fichas = toN(p.metricas?.totalFichas);

      const base = {
        maquinaId,
        nome: p.maquina?.nome || "-",
        loja: p.maquina?.loja || "-",
        fichas,
        // valor da ficha cadastrado na máquina (não a média entre
        // fichas + notas + pix do totalFaturamento histórico)
        valorFicha: toN(p.maquina?.valorFicha),
        produtoPrincipal: p.produtoPrincipal || null,
      };

      const { fonte, valor } = obterValorReconciliadoMaquina(
        p,
        machinePayPorMaquina,
        valorRegistradoPorMaquina,
      );

      return { ...base, fonte, valor };
    });

    return itens.sort((a, b) => b.valor - a.valor);
  }, [performance, machinePayPorMaquina, valorRegistradoPorMaquina]);

  const maquinasExibidas = mostrarTodasMaquinas
    ? maquinasRanking
    : maquinasRanking.slice(0, 10);

  const topProdutos = useMemo(
    () => (Array.isArray(dados?.rankingProdutos) ? dados.rankingProdutos : []),
    [dados],
  );

  const totais = dados?.totais || {};

  // Faturamento Total do KPI: se o período selecionado é o mês em
  // andamento de verdade, reconcilia por máquina (Machine Pay > registrado
  // > fichas), igual ao ranking abaixo. Se é um mês já fechado (o usuário
  // pode filtrar qualquer mês passado, não só o atual), usa a fórmula do
  // Relatório — dinheiro/cartão registrado, por máquina e total da loja —
  // porque a Machine Pay já zerou nesse caso.
  const faturamentoTotalReconciliado = useMemo(() => {
    if (ehMesAtualReal(dataInicio)) {
      return maquinasRanking.reduce((soma, m) => soma + toN(m.valor), 0);
    }

    return somarValorRegistradoConsolidado(
      registrosDinheiroTodos,
      dataInicio,
      dataFim,
      lojaSelecionada,
    );
  }, [
    dataInicio,
    dataFim,
    maquinasRanking,
    registrosDinheiroTodos,
    lojaSelecionada,
  ]);

  // Valor "só Machine Pay": o que a Machine Pay realmente recebeu no
  // período, com fallback pro valor registrado manualmente quando a
  // Machine Pay está zerada — o que acontece sempre que o período
  // selecionado é um mês já fechado, seja ele o "atual" (o usuário pode
  // filtrar por qualquer mês passado, não só o em andamento) ou o
  // anterior usado na comparação. Só as máquinas com Machine Pay têm
  // Registrar Dinheiro lançado; as demais (só fichas) não entram aqui e
  // não têm registrado, então contribuem 0 sem distorcer o total.
  const valorMachinePaySoAtual = useMemo(
    () =>
      somarValorComRegistradoFallback(
        performance,
        machinePayPorMaquina,
        valorRegistradoPorMaquina,
      ),
    [performance, machinePayPorMaquina, valorRegistradoPorMaquina],
  );
  const valorMachinePaySoAnterior = useMemo(
    () =>
      somarValorComRegistradoFallback(
        performanceAnterior,
        machinePayPorMaquinaAnterior,
        valorRegistradoAnteriorPorMaquina,
      ),
    [
      performanceAnterior,
      machinePayPorMaquinaAnterior,
      valorRegistradoAnteriorPorMaquina,
    ],
  );

  // Valor "só fichas": fichas × valor da ficha vigente em cada coleta,
  // ignorando Machine Pay e valor registrado manualmente.
  const valorFichasSoAtual = useMemo(
    () =>
      performance.reduce(
        (soma, p) => soma + toN(p.metricas?.totalFaturamento),
        0,
      ),
    [performance],
  );
  const valorFichasSoAnterior = useMemo(
    () =>
      performanceAnterior.reduce(
        (soma, p) => soma + toN(p.metricas?.totalFaturamento),
        0,
      ),
    [performanceAnterior],
  );

  // Contagem de fichas e de prêmios saídos do mês anterior (para o
  // comparativo de "Total de Fichas" e "Prêmios Saídos").
  const totalFichasMesAnterior = useMemo(
    () =>
      performanceAnterior.reduce(
        (soma, p) => soma + toN(p.metricas?.totalFichas),
        0,
      ),
    [performanceAnterior],
  );
  const totalSaidasMesAnterior = useMemo(
    () =>
      performanceAnterior.reduce(
        (soma, p) => soma + toN(p.metricas?.totalSairam),
        0,
      ),
    [performanceAnterior],
  );

  const formatMoney = (val) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val || 0);

  const formatNumero = (val) => Math.round(toN(val)).toLocaleString("pt-BR");

  // Comparativo com o mês anterior, normalizado por média diária: mês cheio
  // de 31 dias vs mês em andamento com só 10 dias (ou vs fevereiro com 28)
  // não pode ser comparado ponta a ponta, senão o percentual não reflete a
  // realidade. Em vez disso: pega a média diária do mês anterior inteiro
  // (total ÷ dias daquele mês) e projeta essa média para a mesma
  // quantidade de dias já cobertos no período atual. Reaproveitado pelos
  // três KPIs (Faturamento Total, só Machine Pay, só Fichas).
  const nomeMesAnteriorTexto = periodoAnterior?.dataInicio
    ? new Date(`${periodoAnterior.dataInicio}T00:00:00`).toLocaleDateString(
        "pt-BR",
        { month: "long", year: "numeric" },
      )
    : "";

  const diasNoMesAnterior = periodoAnterior
    ? (() => {
        const [ano, mes] = periodoAnterior.dataInicio.split("-").map(Number);
        return new Date(ano, mes, 0).getDate();
      })()
    : 0;

  const diasConsideradosMesAtual = (() => {
    if (!dataInicio || !dataFim) return 0;
    const hoje = new Date();
    const hojeSemHora = new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate(),
    );
    const inicioAtual = new Date(`${dataInicio}T00:00:00`);
    const fimSelecionado = new Date(`${dataFim}T00:00:00`);
    const fimEfetivo =
      fimSelecionado < hojeSemHora ? fimSelecionado : hojeSemHora;
    const diff =
      Math.round((fimEfetivo - inicioAtual) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(0, diff);
  })();

  const temPeriodoValidoParaComparar =
    !!periodoAnterior && diasNoMesAnterior > 0 && diasConsideradosMesAtual > 0;

  const temDadosMesAnterior =
    temPeriodoValidoParaComparar && performanceAnterior.length > 0;

  const construirComparativoNode = (
    valorAtual,
    valorTotalMesAnterior,
    formatarValor = formatMoney,
  ) => {
    if (!periodoAnterior) return null;

    if (!temDadosMesAnterior) {
      return (
        <p className="mt-2 text-[11px] font-semibold text-gray-400">
          Sem dados suficientes em {nomeMesAnteriorTexto || "mês anterior"}{" "}
          para comparar
        </p>
      );
    }

    const mediaDiariaMesAnterior = valorTotalMesAnterior / diasNoMesAnterior;
    // Valor que o mês anterior teria feito nos mesmos N dias já cobertos
    // pelo período atual, usando a média diária real dele.
    const valorEquivalenteMesAnterior =
      mediaDiariaMesAnterior * diasConsideradosMesAtual;
    const diferenca = valorAtual - valorEquivalenteMesAnterior;
    const percentual =
      valorEquivalenteMesAnterior > 0
        ? (diferenca / valorEquivalenteMesAnterior) * 100
        : null;
    const status =
      diferenca > 0 ? "acima" : diferenca < 0 ? "abaixo" : "igual";
    const badgeClass =
      status === "acima"
        ? "bg-green-100 text-green-700"
        : status === "abaixo"
          ? "bg-red-100 text-red-700"
          : "bg-gray-100 text-gray-600";

    return (
      <div
        className={`mt-2 inline-flex flex-wrap items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${badgeClass}`}
      >
        <span>
          {status === "acima" ? "▲" : status === "abaixo" ? "▼" : "="}
        </span>
        <span>
          {percentual !== null
            ? `${Math.abs(percentual).toFixed(1)}%`
            : "N/A"}{" "}
          vs mesmos {diasConsideradosMesAtual} dias em {nomeMesAnteriorTexto} (
          {formatarValor(valorEquivalenteMesAnterior)})
        </span>
      </div>
    );
  };

  const comparativoFaturamentoNode = construirComparativoNode(
    faturamentoTotalReconciliado,
    faturamentoTotalMesAnterior,
  );

  const comparativoMachinePayNode = construirComparativoNode(
    valorMachinePaySoAtual,
    valorMachinePaySoAnterior,
  );

  const comparativoFichasNode = construirComparativoNode(
    valorFichasSoAtual,
    valorFichasSoAnterior,
  );

  const comparativoTotalFichasNode = construirComparativoNode(
    toN(totais.fichas),
    totalFichasMesAnterior,
    formatNumero,
  );

  const comparativoPremiosSaidosNode = construirComparativoNode(
    toN(totais.saidas),
    totalSaidasMesAnterior,
    formatNumero,
  );

  // ─── Evolução mensal (máquinas e produtos) ─────────────────────────────
  const anoAtual = new Date().getFullYear();
  const [anoGraficos, setAnoGraficos] = useState(anoAtual);
  const [produtosCatalogo, setProdutosCatalogo] = useState([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [dadosMensais, setDadosMensais] = useState([]);
  const [loadingMensal, setLoadingMensal] = useState(false);

  const anosDisponiveis = useMemo(() => {
    const anos = [];
    for (let a = anoAtual; a >= anoAtual - 4; a--) anos.push(a);
    return anos;
  }, [anoAtual]);

  useEffect(() => {
    api
      .get("/produtos?incluirInativos=true")
      .then((res) => setProdutosCatalogo(res.data || []))
      .catch(() => {});
  }, []);

  const carregarDadosMensais = useCallback(async () => {
    setLoadingMensal(true);
    const isTodas = !lojaSelecionada;
    const mesAtualNoAno =
      anoGraficos === anoAtual ? new Date().getMonth() + 1 : 12;

    const periodos = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const ini = `${anoGraficos}-${String(mes).padStart(2, "0")}-01`;
      const diasNoMes = new Date(anoGraficos, mes, 0).getDate();
      const fim = `${anoGraficos}-${String(mes).padStart(2, "0")}-${String(
        diasNoMes,
      ).padStart(2, "0")}`;
      return { mes, ini, fim };
    });

    try {
      const resultados = await Promise.allSettled(
        periodos.map(({ ini, fim }) => {
          const params = { dataInicio: ini, dataFim: fim };
          if (isTodas) {
            return api.get("/relatorios/todas-lojas", { params });
          }
          return api.get("/relatorios/impressao", {
            params: { ...params, lojaId: lojaSelecionada },
          });
        }),
      );

      const serie = resultados.map((res, i) => {
        const mes = i + 1;
        const nome = MESES_NOMES[i];
        const isFuturo = anoGraficos === anoAtual && mes > mesAtualNoAno;

        if (res.status !== "fulfilled" || isFuturo) {
          return {
            mes,
            nome,
            faturamento: null,
            custo: null,
            lucro: null,
            produtosSairam: null,
            produtoQuantidade: null,
            variacaoMes: null,
            semDados: true,
          };
        }

        const data = res.value?.data;
        let faturamento = 0;
        let custo = 0;
        let lucro = 0;
        let produtosSairam = 0;
        let produtoQuantidade = null;

        if (isTodas) {
          faturamento = toN(data?.totais?.lucroBrutoTotal);
          custo = toN(data?.totais?.custoTotal);
          lucro = toN(data?.totais?.lucroLiquidoTotal);
          produtosSairam = toN(data?.totais?.produtosSairamTotal);
        } else {
          const t = data?.totais || {};
          faturamento = toN(t.valorBrutoConsolidadoLojaMaquinas);
          custo = toN(t.gastoTotalPeriodo);
          lucro = toN(t.valorLiquidoConsolidadoLojaMaquinas);
          produtosSairam = toN(t.produtosSairam);

          if (produtoSelecionado) {
            const produtoEncontrado = (data?.produtosSairam || []).find(
              (p) => String(p.id) === String(produtoSelecionado),
            );
            produtoQuantidade = produtoEncontrado
              ? toN(produtoEncontrado.quantidade)
              : 0;
          }
        }

        return {
          mes,
          nome,
          faturamento,
          custo,
          lucro,
          produtosSairam,
          produtoQuantidade,
          variacaoMes: null,
          semDados: false,
        };
      });

      for (let i = 1; i < serie.length; i++) {
        const anterior = serie[i - 1];
        const atual = serie[i];
        if (
          !anterior.semDados &&
          !atual.semDados &&
          anterior.faturamento > 0
        ) {
          atual.variacaoMes =
            ((atual.faturamento - anterior.faturamento) /
              anterior.faturamento) *
            100;
        }
      }

      setDadosMensais(serie);
    } catch (erroMensal) {
      console.error(
        "[RankingMaquinas] Erro ao carregar evolução mensal:",
        erroMensal,
      );
      setDadosMensais([]);
    } finally {
      setLoadingMensal(false);
    }
  }, [anoGraficos, anoAtual, lojaSelecionada, produtoSelecionado]);

  useEffect(() => {
    carregarDadosMensais();
  }, [carregarDadosMensais]);

  const dadosMensaisVisiveis = useMemo(
    () => dadosMensais.filter((d) => !d.semDados),
    [dadosMensais],
  );

  const formatMoneyShort = (val) => {
    const v = toN(val);
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
    return formatMoney(v);
  };

  const nomeLojaSelecionada = lojaSelecionada
    ? lojas.find((l) => String(l.id) === String(lojaSelecionada))?.nome ||
      "Loja"
    : "Todas as Lojas";

  const nomeProdutoSelecionado = produtoSelecionado
    ? produtosCatalogo.find((p) => String(p.id) === String(produtoSelecionado))
        ?.nome || "Produto"
    : null;

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <KpiCard
                titulo="Faturamento Total"
                valor={formatMoney(faturamentoTotalReconciliado)}
                icon="💰"
                cor="green"
                comparativo={comparativoFaturamentoNode}
              />
              <KpiCard
                titulo="Valor Machine Pay"
                valor={formatMoney(valorMachinePaySoAtual)}
                icon="💳"
                cor="blue"
                comparativo={comparativoMachinePayNode}
              />
              <KpiCard
                titulo="Valor por Fichas"
                valor={formatMoney(valorFichasSoAtual)}
                icon="🎟️"
                cor="purple"
                comparativo={comparativoFichasNode}
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
                comparativo={comparativoTotalFichasNode}
              />
              <KpiCard
                titulo="Prêmios Saídos"
                valor={toN(totais.saidas).toLocaleString("pt-BR")}
                icon="🧸"
                cor="orange"
                comparativo={comparativoPremiosSaidosNode}
              />
            </div>

            {/* Ranking detalhado */}
            {maquinasRanking.length > 0 ? (
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <span className="text-2xl">🏆</span>
                    {mostrarTodasMaquinas
                      ? "Ranking Detalhado (Todas)"
                      : "Ranking Detalhado (Top 10)"}
                  </h3>
                  {maquinasRanking.length > 10 && (
                    <button
                      type="button"
                      onClick={() =>
                        setMostrarTodasMaquinas((atual) => !atual)
                      }
                      className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
                    >
                      {mostrarTodasMaquinas
                        ? "Ver menos"
                        : `Ver tudo (${maquinasRanking.length})`}
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Valor recebido na Machine Pay no período; quando o valor lá
                  está zerado (mês já fechado), usa o último valor
                  registrado no sistema para a máquina; se nenhum dos dois
                  existir, usa a quantidade de fichas vezes o valor da ficha
                  cadastrado na loja.
                </p>
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
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Produto que mais saiu
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {maquinasExibidas.map((maquina, idx) => (
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
                              : maquina.fonte === "registrado"
                                ? "🗄️ Registrado no sistema"
                                : `🎟️ ${maquina.fichas.toLocaleString(
                                    "pt-BR",
                                  )} fichas × R$ ${maquina.valorFicha.toLocaleString(
                                    "pt-BR",
                                    { minimumFractionDigits: 2 },
                                  )}`}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {maquina.produtoPrincipal ? (
                              <>
                                {maquina.produtoPrincipal.emoji || "📦"}{" "}
                                {maquina.produtoPrincipal.nome}{" "}
                                <span className="text-xs text-gray-500">
                                  (
                                  {Number(
                                    maquina.produtoPrincipal.quantidade || 0,
                                  ).toLocaleString("pt-BR")}{" "}
                                  saíram)
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-lg shadow text-center text-gray-400 text-sm">
                Sem dados de máquinas para o período selecionado.
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

            {/* Evolução Mensal — Máquinas (financeiro) */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <span className="text-2xl">📈</span>
                  Evolução Mensal — Máquinas ({nomeLojaSelecionada})
                </h3>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-gray-600">
                    Ano:
                  </label>
                  <select
                    value={anoGraficos}
                    onChange={(e) => setAnoGraficos(Number(e.target.value))}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-800 font-bold px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {anosDisponiveis.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Faturamento, custo e lucro líquido mês a mês, para a loja
                escolhida no filtro do topo (ou todas as lojas).
              </p>

              {loadingMensal ? (
                <div className="flex items-center justify-center h-80 text-gray-400">
                  <div className="text-center">
                    <div className="inline-block w-8 h-8 border-4 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mb-3" />
                    <p className="text-sm">Carregando evolução mensal...</p>
                  </div>
                </div>
              ) : dadosMensaisVisiveis.length > 0 ? (
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={dadosMensaisVisiveis}
                      margin={{ top: 20, right: 40, left: 20, bottom: 10 }}
                    >
                      <CartesianGrid
                        strokeDasharray="4 4"
                        stroke="#f0f0f0"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="nome"
                        tick={{ fontSize: 13, fontWeight: 600, fill: "#374151" }}
                        axisLine={{ stroke: "#e5e7eb" }}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={formatMoneyShort}
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        axisLine={false}
                        tickLine={false}
                        width={72}
                      />
                      <YAxis
                        yAxisId="var"
                        orientation="right"
                        tickFormatter={(v) =>
                          v !== null ? `${v > 0 ? "+" : ""}${v?.toFixed(0)}%` : ""
                        }
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                        domain={[-100, 100]}
                        width={52}
                      />
                      <Tooltip
                        formatter={(v, name) =>
                          name === "Variação % (mês ant.)"
                            ? [`${v?.toFixed?.(1) ?? v}%`, name]
                            : [formatMoney(v), name]
                        }
                      />
                      <Legend wrapperStyle={{ paddingTop: "16px", fontSize: "13px" }} />

                      <Line
                        type="monotoneX"
                        dataKey="faturamento"
                        name="Faturamento"
                        stroke="#10B981"
                        strokeWidth={3.5}
                        dot={{ r: 5, fill: "#10B981", stroke: "#fff", strokeWidth: 2 }}
                        activeDot={{ r: 7, fill: "#10B981", stroke: "#fff", strokeWidth: 2 }}
                      />
                      <Line
                        type="monotoneX"
                        dataKey="custo"
                        name="Custo Total"
                        stroke="#EF4444"
                        strokeWidth={1.5}
                        strokeOpacity={0.6}
                        dot={false}
                      />
                      <Line
                        type="monotoneX"
                        dataKey="lucro"
                        name="Lucro Líquido"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        strokeDasharray="5 3"
                        dot={{ r: 3, fill: "#3B82F6", stroke: "#fff", strokeWidth: 1 }}
                      />
                      <Line
                        yAxisId="var"
                        type="monotoneX"
                        dataKey="variacaoMes"
                        name="Variação % (mês ant.)"
                        stroke="#8B5CF6"
                        strokeWidth={1.5}
                        strokeDasharray="5 3"
                        dot={{ r: 3, fill: "#8B5CF6", stroke: "#fff", strokeWidth: 1.5 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
                  Sem dados suficientes em {anoGraficos} para montar a
                  evolução mensal.
                </div>
              )}
            </div>

            {/* Evolução Mensal — Produtos */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <span className="text-2xl">🧸</span>
                  Evolução Mensal — Produtos ({nomeLojaSelecionada})
                </h3>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-gray-600">
                    Produto:
                  </label>
                  <select
                    value={produtoSelecionado}
                    onChange={(e) => setProdutoSelecionado(e.target.value)}
                    className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 font-bold px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 max-w-55"
                  >
                    <option value="">Todos os produtos</option>
                    {produtosCatalogo.map((produto) => (
                      <option key={produto.id} value={produto.id}>
                        {produto.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                {produtoSelecionado
                  ? !lojaSelecionada
                    ? "Selecione uma loja específica para acompanhar um produto — em \"Todas as lojas\" só o total geral fica disponível."
                    : `Quantidade de "${nomeProdutoSelecionado}" que saiu mês a mês, na loja escolhida no filtro do topo.`
                  : "Total de produtos que saíram mês a mês, para a loja escolhida no filtro do topo (ou todas as lojas)."}
              </p>

              {loadingMensal ? (
                <div className="flex items-center justify-center h-80 text-gray-400">
                  <div className="text-center">
                    <div className="inline-block w-8 h-8 border-4 border-amber-300 border-t-amber-600 rounded-full animate-spin mb-3" />
                    <p className="text-sm">Carregando evolução mensal...</p>
                  </div>
                </div>
              ) : dadosMensaisVisiveis.length > 0 &&
                !(produtoSelecionado && !lojaSelecionada) ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={dadosMensaisVisiveis}
                      margin={{ top: 20, right: 40, left: 20, bottom: 10 }}
                    >
                      <CartesianGrid
                        strokeDasharray="4 4"
                        stroke="#f0f0f0"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="nome"
                        tick={{ fontSize: 13, fontWeight: 600, fill: "#374151" }}
                        axisLine={{ stroke: "#e5e7eb" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        axisLine={false}
                        tickLine={false}
                        width={50}
                      />
                      <Tooltip
                        formatter={(v) => Number(v || 0).toLocaleString("pt-BR")}
                      />
                      <Legend wrapperStyle={{ paddingTop: "16px", fontSize: "13px" }} />
                      <Line
                        type="monotoneX"
                        dataKey={
                          produtoSelecionado ? "produtoQuantidade" : "produtosSairam"
                        }
                        name={
                          produtoSelecionado
                            ? `${nomeProdutoSelecionado} (saíram)`
                            : "Total de produtos saíram"
                        }
                        stroke="#F59E0B"
                        strokeWidth={3.5}
                        dot={{ r: 5, fill: "#F59E0B", stroke: "#fff", strokeWidth: 2 }}
                        activeDot={{ r: 7, fill: "#F59E0B", stroke: "#fff", strokeWidth: 2 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
                  {produtoSelecionado && !lojaSelecionada
                    ? "Escolha uma loja específica no filtro do topo para ver a evolução de um produto."
                    : `Sem dados suficientes em ${anoGraficos} para montar a evolução de produtos.`}
                </div>
              )}
            </div>
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

function KpiCard({ titulo, valor, icon, cor, comparativo }) {
  const [border, bg, text] = (COR_MAP[cor] || COR_MAP.blue).split(" ");
  return (
    <div
      className={`bg-white p-6 rounded-lg shadow-md border-l-4 ${border} h-full`}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            {titulo}
          </p>
          <h3 className="text-2xl font-bold text-gray-900 mt-1">{valor}</h3>
          {comparativo}
        </div>
        <span className={`p-2 ${bg} ${text} rounded-lg text-xl`}>{icon}</span>
      </div>
    </div>
  );
}
