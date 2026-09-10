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
