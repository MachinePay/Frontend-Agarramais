import api from "../services/api";

// Central de alertas: junta os alertas que antes ficavam espalhados
// (Manutenção, Alertas CompactPay, alertas de IN/OUT). Cada fonte é
// carregada à parte e normalizada para o mesmo formato, usado pela página
// /alertas e pelo painel do Dashboard.

export const CATEGORIAS = {
  in: {
    label: "Contador IN",
    icon: "📥",
    descricao: "IN não bate com as fichas",
    dica: "Confira se as fichas lançadas estão certas ou se o contador IN foi lido errado.",
    cor: "border-l-blue-500",
    chip: "bg-blue-50 text-blue-700",
  },
  out: {
    label: "Contador OUT",
    icon: "📤",
    descricao: "OUT não bate com a saída",
    dica: "Reconte a máquina ou confira o contador OUT: a saída de prêmios não bate.",
    cor: "border-l-violet-500",
    chip: "bg-violet-50 text-violet-700",
  },
  compactpay: {
    label: "CompactPay",
    icon: "📟",
    descricao: "Lançado ≠ contado pela placa",
    dica: "A placa CompactPay contou diferente do que foi lançado. Veja se foi erro de digitação ou de contagem.",
    cor: "border-l-teal-500",
    chip: "bg-teal-50 text-teal-700",
  },
  machinepay: {
    label: "Machine Pay",
    icon: "💳",
    descricao: "Total pré ≠ esperado pelos pagamentos",
    dica: "O operador confirmou um total diferente do que os pagamentos indicam. Pode ser pulso perdido ou contagem errada.",
    cor: "border-l-indigo-500",
    chip: "bg-indigo-50 text-indigo-700",
  },
  whatsapp: {
    label: "Só no WhatsApp",
    icon: "📲",
    descricao: "Movimentação não lançada",
    dica: "Avisaram pelo WhatsApp mas não registraram. Use “Lançar” para registrar com os dados que vieram.",
    cor: "border-l-green-500",
    chip: "bg-green-50 text-green-700",
  },
  abastecimento: {
    label: "Abastecimento",
    icon: "📦",
    descricao: "Máquina não ficou no padrão",
    dica: "A máquina foi abastecida abaixo do padrão. Veja se faltou produto na loja.",
    cor: "border-l-amber-500",
    chip: "bg-amber-50 text-amber-700",
  },
};

export const ORDEM_CATEGORIAS = [
  "in",
  "out",
  "compactpay",
  "machinepay",
  "whatsapp",
  "abastecimento",
];

export const tempoRelativo = (data) => {
  if (!data) return "-";
  const minutos = Math.round((Date.now() - data.getTime()) / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.round(horas / 24);
  return dias === 1 ? "ontem" : `há ${dias} dias`;
};

const paraData = (valor) => {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
};

export const formatarMoeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const comSinal = (n) => (n > 0 ? `+${n}` : `${n}`);

// --- Normalização: cada fonte vira { chave, categoria, subtipo, data,
// loja, maquinaId, maquina, usuario, numeros, peso, detalhe, original }.
// "peso" é o tamanho do problema, usado pra ordenar por gravidade. ---

const normalizarIn = (a) => {
  const andou = (a.contador_in || 0) - (a.contador_in_anterior || 0);
  const fichas = a.fichas || 0;
  return {
    chave: `in-${a.id}`,
    categoria: "in",
    data: paraData(a.dataMovimentacaoAtual || a.dataMovimentacao),
    loja: a.lojaNome,
    maquinaId: a.maquinaId,
    maquina: a.maquinaNome,
    usuario: a.usuarioAtual,
    numeros: [
      { label: "IN andou", valor: andou },
      { label: "Fichas lançadas", valor: fichas },
      { label: "Diferença", valor: comSinal(andou - fichas), destaque: true },
    ],
    peso: Math.abs(andou - fichas),
    detalhe: `Contador IN foi de ${a.contador_in_anterior ?? "-"} para ${a.contador_in ?? "-"}.`,
    original: a,
  };
};

const normalizarOut = (a) => {
  const andou = (a.contador_out || 0) - (a.contador_out_anterior || 0);
  const sairam = a.sairam || 0;
  return {
    chave: `out-${a.id}`,
    categoria: "out",
    data: paraData(a.dataMovimentacaoAtual || a.dataMovimentacao),
    loja: a.lojaNome,
    maquinaId: a.maquinaId,
    maquina: a.maquinaNome,
    usuario: a.usuarioAtual,
    numeros: [
      { label: "OUT andou", valor: andou },
      { label: "Saíram", valor: sairam },
      { label: "Diferença", valor: comSinal(andou - sairam), destaque: true },
    ],
    peso: Math.abs(andou - sairam),
    detalhe: `Contador OUT foi de ${a.contador_out_anterior ?? "-"} para ${a.contador_out ?? "-"}.`,
    original: a,
  };
};

const normalizarCompactPay = (a) => {
  const fichas = a.tipo === "fichas";
  return {
    chave: `cp-${a.id}`,
    categoria: "compactpay",
    subtipo: fichas ? "CompactPay · fichas" : "CompactPay · saída",
    data: paraData(a.criadoEm),
    loja: a.loja?.nome,
    maquinaId: a.maquina?.id,
    maquina: a.maquina?.nome,
    usuario: a.lancadoPor,
    numeros: [
      {
        label: fichas ? "Fichas lançadas" : "Saída lançada",
        valor: a.lancado ?? "-",
      },
      { label: "Placa contou", valor: a.compactPay?.quantidade ?? "-" },
      {
        label: "Diferença",
        valor:
          a.diferenca !== null && a.diferenca !== undefined
            ? comSinal(a.diferenca)
            : "-",
        destaque: true,
      },
      ...(a.diferencaValor
        ? [{ label: "Em R$", valor: formatarMoeda(a.diferencaValor) }]
        : []),
    ],
    peso: Math.abs(a.diferenca || 0),
    detalhe: a.descricao || a.titulo,
    original: a,
  };
};

const normalizarAlertaMovimentacao = (a) => {
  const dados = a.dadosAbastecimento || {};
  const ehDivergencia =
    dados.esperado !== undefined && dados.informado !== undefined;
  const base = {
    data: paraData(a.createdAt),
    loja: a.loja?.nome,
    maquinaId: a.maquina?.id,
    maquina: a.maquina?.nome,
    usuario: a.usuario?.nome,
    original: a,
  };

  if (ehDivergencia) {
    return {
      ...base,
      chave: `mp-${a.id}`,
      categoria: "machinepay",
      subtipo: /compactpay/i.test(a.observacao || "")
        ? "Pagamentos CompactPay"
        : "Pagamentos Machine Pay",
      numeros: [
        { label: "Esperado", valor: dados.esperado },
        { label: "Registrado", valor: dados.informado },
        {
          label: "Diferença",
          valor: comSinal(dados.diferenca ?? 0),
          destaque: true,
        },
        ...(dados.totalRecebidoMachinePay !== undefined
          ? [
              {
                label: "Recebido",
                valor: formatarMoeda(dados.totalRecebidoMachinePay),
              },
            ]
          : []),
      ],
      peso: Math.abs(dados.diferenca || 0),
      detalhe: a.observacao,
    };
  }

  return {
    ...base,
    chave: `wa-${a.id}`,
    categoria: "whatsapp",
    numeros: [
      ...(dados.quantidadeAtualMaquina
        ? [{ label: "Qtd. atual", valor: dados.quantidadeAtualMaquina }]
        : []),
      ...(dados.quantidadeAdicionada
        ? [{ label: "Abastecido", valor: dados.quantidadeAdicionada }]
        : []),
      ...(dados.fichas ? [{ label: "Fichas", valor: dados.fichas }] : []),
    ],
    // Movimentação que não existe no sistema: sempre importante.
    peso: 1000,
    detalhe: a.observacao ? `Motivo: ${a.observacao}` : null,
  };
};

const normalizarAbastecimento = (a) => {
  const faltou =
    a.capacidadePadrao != null && a.totalDepois != null
      ? Math.max(0, a.capacidadePadrao - a.totalDepois)
      : null;
  return {
    chave: `ab-${a.id}`,
    categoria: "abastecimento",
    data: paraData(a.dataMovimentacao),
    loja: a.lojaNome,
    maquinaId: a.maquinaId,
    maquina: a.maquinaNome,
    usuario: a.usuario,
    numeros: [
      { label: "Padrão", valor: a.capacidadePadrao ?? "-" },
      { label: "Ficou com", valor: a.totalDepois ?? "-" },
      { label: "Faltou", valor: faltou ?? "-", destaque: true },
    ],
    peso: faltou || 0,
    detalhe: `Tinha ${a.totalAntes ?? "-"} e abasteceu ${a.abastecido ?? "-"}.`,
    original: a,
  };
};

// Cada fonte: de onde carrega e como normaliza.
const FONTES = [
  {
    id: "in",
    carregar: () =>
      api
        .get("/relatorios/alertas-movimentacao-in")
        .then((r) => (r.data?.alertas || []).map(normalizarIn)),
  },
  {
    id: "out",
    carregar: () =>
      api
        .get("/relatorios/alertas-movimentacao-out")
        .then((r) => (r.data?.alertas || []).map(normalizarOut)),
  },
  {
    id: "compactpay",
    carregar: () =>
      api
        .get("/manutencoes/alertas-compactpay", {
          params: { status: "PENDENTE" },
        })
        .then((r) =>
          (Array.isArray(r.data) ? r.data : []).map(normalizarCompactPay),
        ),
  },
  {
    // Uma rota só traz Machine Pay e WhatsApp; a normalização separa.
    id: "alertas-movimentacao",
    categorias: ["machinepay", "whatsapp"],
    carregar: () =>
      api
        .get("/alertas-movimentacao")
        .then((r) =>
          (Array.isArray(r.data) ? r.data : []).map(
            normalizarAlertaMovimentacao,
          ),
        ),
  },
  {
    id: "abastecimento",
    carregar: () =>
      api
        .get("/relatorios/alertas-abastecimento-incompleto")
        .then((r) => (r.data?.alertas || []).map(normalizarAbastecimento)),
  },
];

// Carrega todas as fontes; uma que falhar não derruba as outras.
export async function buscarAlertas() {
  const resultados = await Promise.allSettled(FONTES.map((f) => f.carregar()));
  const lista = [];
  const erros = [];
  resultados.forEach((r, i) => {
    if (r.status === "fulfilled") lista.push(...r.value);
    else erros.push(...(FONTES[i].categorias || [FONTES[i].id]));
  });
  return { lista, erros };
}

export const resolverAlerta = (alerta) => {
  const o = alerta.original;
  switch (alerta.categoria) {
    case "compactpay":
      return api.patch(`/manutencoes/${o.id}/resolver`);
    case "machinepay":
    case "whatsapp":
      return api.patch(`/alertas-movimentacao/${o.id}/resolver`);
    default:
      // IN, OUT e abastecimento: ficam ignorados e não voltam.
      return api.delete(
        `/relatorios/alertas-movimentacao-inconsistente/${o.id}`,
        { data: { maquinaId: alerta.maquinaId } },
      );
  }
};

// Estado da movimentação pré-preenchida para lançar um alerta "só WhatsApp".
export const estadoLancarMovimentacao = (alerta) => {
  const o = alerta.original;
  const dados = o.dadosAbastecimento || {};
  return {
    abrirFormulario: true,
    modo: "nova_movimentacao",
    lojaId: o.loja?.id,
    maquinaId: o.maquina?.id,
    contadorIn: dados.contadorIn,
    contadorOut: dados.contadorOut,
    produtoId: dados.produtoId,
    quantidadeAtualMaquina: dados.quantidadeAtualMaquina,
    quantidadeAdicionada: dados.quantidadeAdicionada,
    fichas: dados.fichas,
    observacao: o.observacao,
    // A movimentação aconteceu quando o alerta foi gerado, não agora.
    dataColeta: o.createdAt,
    alertaId: o.id,
    origem: "AlertaMovimentacao",
  };
};

// Ranking de onde estão os alertas (lojas / máquinas), do maior pro menor.
export const rankingPor = (lista, chave, rotulo) => {
  const mapa = new Map();
  for (const a of lista) {
    const id = a[chave];
    if (!id) continue;
    const atual = mapa.get(id) || { id, nome: rotulo(a), total: 0 };
    atual.total += 1;
    mapa.set(id, atual);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
};
