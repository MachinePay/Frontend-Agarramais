// Reconcilia o faturamento "de verdade" de cada máquina num período,
// priorizando o dinheiro que a Machine Pay efetivamente recebeu sobre o
// cálculo histórico (fichas × valor da ficha na época da coleta). Usado
// tanto no Ranking de Máquinas quanto no Dashboard, para os dois lugares
// nunca saírem de réguas diferentes.
//
// Prioridade: Machine Pay (dinheiro recebido de fato) > valor registrado
// manualmente no sistema (Registrar Dinheiro, quando a Machine Pay já
// fechou o mês e zerou o valor) > fichas × valor da ficha (fallback
// histórico, calculado pelo backend com o valorFicha vigente em cada
// coleta).

const toN = (v) => Number(v || 0);

const parseDataSegura = (valor) => {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
};

const temIntersecaoPeriodo = (inicioA, fimA, inicioB, fimB) => {
  if (!inicioA || !fimA || !inicioB || !fimB) return false;
  return inicioA <= fimB && fimA >= inicioB;
};

// Monta um Map<maquinaId, {valor, criadoEm}> a partir dos registros de
// "Registrar Dinheiro" que se sobrepõem ao período informado.
export const construirMapaValorRegistrado = (
  registros,
  periodoInicio,
  periodoFim,
) => {
  const mapa = new Map();
  const periodoInicioData = new Date(`${periodoInicio}T00:00:00`);
  const periodoFimData = new Date(`${periodoFim}T23:59:59`);

  (registros || []).forEach((registro) => {
    if (!registro.maquinaId) return;

    const inicioRegistro = parseDataSegura(registro.inicio);
    const fimRegistro = parseDataSegura(registro.fim);
    if (
      !temIntersecaoPeriodo(
        inicioRegistro,
        fimRegistro,
        periodoInicioData,
        periodoFimData,
      )
    ) {
      return;
    }

    const valor =
      Number(registro.valorDinheiro || 0) + Number(registro.valorCartaoPix || 0);
    const criadoEm = parseDataSegura(registro.createdAt)?.getTime() || 0;

    const chave = String(registro.maquinaId);
    const atual = mapa.get(chave);
    mapa.set(chave, {
      valor: (atual?.valor || 0) + valor,
      criadoEm: Math.max(atual?.criadoEm || 0, criadoEm),
    });
  });

  return mapa;
};

// Monta um Map<maquinaId, valor> a partir da resposta de
// /registro-dinheiro/machine-pay-total.
export const construirMapaMachinePay = (machinePayTotalData) => {
  const mapa = new Map();
  (machinePayTotalData?.maquinas || []).forEach((item) => {
    mapa.set(String(item.maquinaId), toN(item.brutoComTaxasMp));
  });
  return mapa;
};

// Para um item de /relatorios/performance-maquinas, retorna a fonte e o
// valor reconciliado dessa máquina no período.
export const obterValorReconciliadoMaquina = (
  performanceItem,
  machinePayMapa,
  registradoMapa,
) => {
  const maquinaId = String(performanceItem.maquina?.id);
  const totalFaturamentoHistorico = toN(
    performanceItem.metricas?.totalFaturamento,
  );
  const valorMachinePay = machinePayMapa.get(maquinaId);
  const registrado = registradoMapa.get(maquinaId);

  if (valorMachinePay !== undefined && valorMachinePay > 0) {
    return { fonte: "machinePay", valor: valorMachinePay };
  }

  if (registrado && registrado.valor > 0) {
    return { fonte: "registrado", valor: registrado.valor };
  }

  return { fonte: "fichas", valor: totalFaturamentoHistorico };
};

// Soma o valor reconciliado de todas as máquinas de uma lista de
// /relatorios/performance-maquinas.
export const somarFaturamentoReconciliado = (
  performanceList,
  machinePayMapa,
  registradoMapa,
) =>
  (performanceList || []).reduce((soma, item) => {
    const { valor } = obterValorReconciliadoMaquina(
      item,
      machinePayMapa,
      registradoMapa,
    );
    return soma + valor;
  }, 0);

// Soma "dinheiro de verdade" (Machine Pay > registrado), SEM cair para
// fichas × valor da ficha. Útil pra comparar um mês já fechado — a Machine
// Pay zera o valor dele, então olhar só o bruto da Machine Pay do mês
// anterior não é representativo; olhando máquina por máquina, quando não
// tem Machine Pay usamos o valor que a própria máquina teve registrado
// manualmente (Registrar Dinheiro) naquele período.
export const somarValorComRegistradoFallback = (
  performanceList,
  machinePayMapa,
  registradoMapa,
) =>
  (performanceList || []).reduce((soma, item) => {
    const maquinaId = String(item.maquina?.id);
    const valorMachinePay = machinePayMapa.get(maquinaId);
    const registrado = registradoMapa.get(maquinaId);

    if (valorMachinePay !== undefined && valorMachinePay > 0) {
      return soma + valorMachinePay;
    }

    if (registrado && registrado.valor > 0) {
      return soma + registrado.valor;
    }

    return soma;
  }, 0);

// Faturamento "estilo Relatório" (mesma fórmula de valorBrutoConsolidado-
// LojaMaquinas em relatorioController.js): soma dinheiro + cartão/pix
// BRUTO de todos os registros de "Registrar Dinheiro" que se sobrepõem ao
// período — tanto os por máquina quanto os marcados como "total da loja"
// (fechamento de caixa da loja inteira, sem máquina associada). Não usa
// Machine Pay nem fallback de fichas: é o dinheiro fisicamente registrado.
// Validado direto no banco contra o Relatório para julho/2026 (R$
// 364.344,60) e agosto/2026 (R$ 362.106,45) — bateu exato nos dois.
//
// Só faz sentido pra um mês JÁ FECHADO: a Machine Pay zera meses passados
// e o fallback por fichas é só estimativa, mas o valor registrado
// manualmente reflete o que foi conferido no caixa. Para o mês em
// andamento, o registro ainda está incompleto, então continue usando
// somarFaturamentoReconciliado/somarValorComRegistradoFallback.
export const somarValorRegistradoConsolidado = (
  registros,
  periodoInicio,
  periodoFim,
  lojaId,
) => {
  const periodoInicioData = new Date(`${periodoInicio}T00:00:00`);
  const periodoFimData = new Date(`${periodoFim}T23:59:59`);

  return (registros || []).reduce((soma, registro) => {
    if (lojaId && String(registro.lojaId) !== String(lojaId)) {
      return soma;
    }

    const inicioRegistro = parseDataSegura(registro.inicio);
    const fimRegistro = parseDataSegura(registro.fim);
    if (
      !temIntersecaoPeriodo(
        inicioRegistro,
        fimRegistro,
        periodoInicioData,
        periodoFimData,
      )
    ) {
      return soma;
    }

    return (
      soma +
      Number(registro.valorDinheiro || 0) +
      Number(registro.valorCartaoPix || 0)
    );
  }, 0);
};

// Máquinas que têm faturamento real (Machine Pay ou registrado) no período
// mas não aparecem em /relatorios/performance-maquinas por não terem
// nenhuma coleta (Movimentação) registrada ainda — ex.: "poltronas" e
// outras máquinas que só recebem por cartão/pix e não têm contagem manual
// de fichas no período. Sem isso, o dinheiro delas some do Ranking e do
// KPI "Valor Machine Pay", mesmo já tendo entrado de verdade na Machine
// Pay. Devolve a lista de performance original + um item sintético (fichas
// zeradas) para cada uma dessas máquinas, filtrado pela loja selecionada.
export const complementarPerformanceComMachinePay = (
  performanceList,
  machinePayTotalData,
  registradoMapa,
  lojaId,
) => {
  const idsComPerformance = new Set(
    (performanceList || []).map((p) => String(p.maquina?.id)),
  );

  const extras = (machinePayTotalData?.maquinas || [])
    .filter((item) => !idsComPerformance.has(String(item.maquinaId)))
    .filter((item) => !lojaId || String(item.lojaId) === String(lojaId))
    .filter((item) => {
      const valorMachinePay = toN(item.brutoComTaxasMp);
      const registrado = registradoMapa?.get(String(item.maquinaId));
      return valorMachinePay > 0 || (registrado && registrado.valor > 0);
    })
    .map((item) => ({
      maquina: {
        id: item.maquinaId,
        codigo: item.codigo,
        nome: item.nome || item.codigo,
        valorFicha: toN(item.valorFicha),
        loja: item.loja || "-",
        lojaId: item.lojaId,
      },
      metricas: {
        totalMovimentacoes: 0,
        totalFichas: 0,
        totalFaturamento: 0,
        totalSairam: 0,
        mediaFichasPremio: "0.00",
      },
      produtoPrincipal: null,
    }));

  return [...(performanceList || []), ...extras];
};

// Um período (dataInicio "YYYY-MM-DD") é o mês corrente de verdade quando
// cai no mesmo mês/ano de hoje. Usado para decidir qual fórmula de
// faturamento usar: mês em andamento -> reconciliado (Machine Pay/
// registrado/fichas); mês já fechado -> registrado consolidado (estilo
// Relatório).
export const ehMesAtualReal = (dataInicioISO) => {
  if (!dataInicioISO) return false;
  const [ano, mes] = String(dataInicioISO).split("-").map(Number);
  if (!ano || !mes) return false;
  const hoje = new Date();
  return ano === hoje.getFullYear() && mes === hoje.getMonth() + 1;
};
