import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader } from "../components/UIComponents";
import { useAuth } from "../contexts/AuthContext";

// Alertas da conferência com a placa CompactPay: a cada movimentação o
// backend compara o que foi lançado (fichas / prêmios que saíram) com o que
// a placa contou desde a movimentação anterior. Quando não bate, vira um
// alerta aqui (gravado como manutenção ALERTA_FICHAS / ALERTA_SAIDA).

const TIPOS = {
  fichas: {
    rotulo: "Fichas",
    icone: "🪙",
    unidade: (n) => (Math.abs(n) === 1 ? "ficha" : "fichas"),
    lancadoRotulo: "Lançadas na movimentação",
    placaRotulo: "Contadas pela placa",
    faixa: "bg-amber-400",
    chip: "bg-amber-100 text-amber-800 border-amber-200",
    barra: "bg-amber-400",
  },
  saida: {
    rotulo: "Saída de prêmio",
    icone: "🧸",
    unidade: (n) => (Math.abs(n) === 1 ? "prêmio" : "prêmios"),
    lancadoRotulo: "Saíram pela movimentação",
    placaRotulo: "Sensor de saída da placa",
    faixa: "bg-violet-500",
    chip: "bg-violet-100 text-violet-800 border-violet-200",
    barra: "bg-violet-500",
  },
};

const formatarMoeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const formatarDataHora = (valor) => {
  if (!valor) return "—";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const tempoRelativo = (valor) => {
  if (!valor) return "";
  const minutos = Math.round((Date.now() - new Date(valor).getTime()) / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias < 30) return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
  const meses = Math.round(dias / 30);
  return `há ${meses} ${meses === 1 ? "mês" : "meses"}`;
};

const duracao = (inicio, fim) => {
  if (!inicio || !fim) return null;
  const horas = (new Date(fim) - new Date(inicio)) / 3600000;
  if (horas < 0) return null;
  if (horas < 24) return `${Math.max(1, Math.round(horas))} h`;
  const dias = Math.round(horas / 24);
  return `${dias} ${dias === 1 ? "dia" : "dias"}`;
};

// Frase que explica a divergência. diferenca = lançado − placa.
const explicar = (alerta) => {
  const tipo = TIPOS[alerta.tipo];
  const { diferenca } = alerta;
  if (diferenca === null || diferenca === undefined) {
    return {
      titulo: "Os números não batem",
      texto: "Abra os detalhes para ver o registro completo.",
      tom: "neutro",
    };
  }
  const qtd = Math.abs(diferenca);
  const un = tipo.unidade(qtd);
  if (alerta.tipo === "fichas") {
    return diferenca < 0
      ? {
          titulo: `Faltam ${qtd} ${un} no lançamento`,
          texto:
            "A placa contou mais fichas do que foram lançadas. Pode ser ficha que não foi recolhida ou contada, ou um erro de digitação.",
          tom: "falta",
        }
      : {
          titulo: `Sobram ${qtd} ${un} no lançamento`,
          texto:
            "Foram lançadas mais fichas do que a placa contou. Pode ser erro de digitação ou ficha que entrou sem a placa registrar.",
          tom: "sobra",
        };
  }
  return diferenca > 0
    ? {
        titulo: `Saíram ${qtd} ${un} a mais que o sensor viu`,
        texto:
          "O estoque caiu mais do que o sensor de saída registrou. Pode ser prêmio retirado por fora, contagem errada do estoque ou sensor falhando.",
        tom: "falta",
      }
    : {
        titulo: `O sensor viu ${qtd} ${un} a mais`,
        texto:
          "O sensor registrou mais saídas do que a contagem de estoque mostra. Pode ser sensor disparando à toa ou estoque contado errado.",
        tom: "sobra",
      };
};

const TONS = {
  falta: "bg-red-50 border-red-200 text-red-800",
  sobra: "bg-sky-50 border-sky-200 text-sky-800",
  neutro: "bg-gray-50 border-gray-200 text-gray-700",
};

const PILULA_TOM = {
  falta: "bg-red-600 text-white",
  sobra: "bg-sky-600 text-white",
  neutro: "bg-gray-500 text-white",
};

function LinhaComparacao({ rotulo, valor, cor, extra, maximo }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-xs font-medium text-gray-500">{rotulo}</span>
        <span className="text-xl font-bold text-gray-900 tabular-nums">
          {valor ?? "—"}
          {extra && (
            <span className="ml-1 text-xs font-medium text-gray-500">
              {extra}
            </span>
          )}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${cor} transition-all duration-500`}
          style={{ width: `${(Number(valor || 0) / maximo) * 100}%` }}
        />
      </div>
    </div>
  );
}

function Comparacao({ alerta }) {
  const tipo = TIPOS[alerta.tipo];
  const lancado = alerta.lancado;
  const placa = alerta.compactPay?.quantidade;
  const maximo = Math.max(Number(lancado || 0), Number(placa || 0), 1);

  return (
    <div className="space-y-3">
      <LinhaComparacao
        maximo={maximo}
        rotulo={tipo.lancadoRotulo}
        valor={lancado}
        cor="bg-gray-700"
      />
      <LinhaComparacao
        maximo={maximo}
        rotulo={tipo.placaRotulo}
        valor={placa}
        cor={tipo.barra}
        extra={
          alerta.compactPay?.valor !== null && alerta.compactPay?.valor !== undefined
            ? formatarMoeda(alerta.compactPay.valor)
            : null
        }
      />
    </div>
  );
}

function Periodo({ alerta }) {
  const { periodo, movimentacaoAnterior, movimentacao } = alerta;
  const tempo = duracao(periodo?.inicio, periodo?.fim);
  return (
    <div className="flex items-stretch gap-3 text-xs">
      <div className="flex flex-col items-center pt-1">
        <span className="h-2.5 w-2.5 rounded-full bg-gray-400" />
        <span className="w-px flex-1 bg-gray-300 my-1" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#F2A20C]" />
      </div>
      <div className="flex-1 space-y-2 min-w-0">
        <div>
          <p className="font-semibold text-gray-700">
            Movimentação anterior · {formatarDataHora(periodo?.inicio)}
          </p>
          {movimentacaoAnterior?.usuario && (
            <p className="text-gray-500 truncate">
              por {movimentacaoAnterior.usuario}
            </p>
          )}
        </div>
        {tempo && (
          <p className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
            {tempo} entre as duas
          </p>
        )}
        <div>
          <p className="font-semibold text-gray-700">
            Movimentação que gerou o alerta · {formatarDataHora(periodo?.fim)}
          </p>
          {(movimentacao?.usuario || alerta.lancadoPor) && (
            <p className="text-gray-500 truncate">
              por {movimentacao?.usuario || alerta.lancadoPor}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CartaoAlerta({ alerta, onResolver, resolvendo }) {
  const [aberto, setAberto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const tipo = TIPOS[alerta.tipo];
  const explicacao = explicar(alerta);
  const resolvido = alerta.status === "RESOLVIDA";
  const qtd = alerta.diferenca;

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200 hover:shadow-lg ${
        resolvido ? "border-gray-200 opacity-75" : "border-gray-200"
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-1.5 ${tipo.faixa}`} />

      <div className="p-5 pl-6">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tipo.chip}`}
              >
                {tipo.icone} {tipo.rotulo}
              </span>
              {resolvido ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                  ✓ Resolvido
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                  Pendente
                </span>
              )}
              <span
                className="text-xs text-gray-400"
                title={formatarDataHora(alerta.criadoEm)}
              >
                {tempoRelativo(alerta.criadoEm)}
              </span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 truncate">
              {alerta.maquina?.nome || "Máquina removida"}
            </h3>
            <p className="text-sm text-gray-500">
              🏪 {alerta.loja?.nome || "Sem loja"}
              {alerta.maquina?.compactPayId && (
                <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-600">
                  placa {alerta.maquina.compactPayId}
                </span>
              )}
            </p>
          </div>

          {qtd !== null && qtd !== undefined && (
            <div className="text-right">
              <span
                className={`inline-flex items-center rounded-xl px-3 py-1.5 text-lg font-extrabold tabular-nums shadow-sm ${PILULA_TOM[explicacao.tom]}`}
              >
                {qtd > 0 ? "+" : ""}
                {qtd} {tipo.unidade(qtd)}
              </span>
              {alerta.diferencaValor !== null &&
                alerta.diferencaValor !== undefined && (
                  <p className="mt-1 text-xs font-semibold text-gray-500 tabular-nums">
                    {alerta.diferencaValor > 0 ? "+" : ""}
                    {formatarMoeda(alerta.diferencaValor)}
                  </p>
                )}
            </div>
          )}
        </div>

        {/* Corpo */}
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div className="space-y-3">
            <Comparacao alerta={alerta} />
            <div className={`rounded-xl border px-3 py-2.5 ${TONS[explicacao.tom]}`}>
              <p className="text-sm font-semibold">{explicacao.titulo}</p>
              <p className="text-xs mt-0.5 opacity-90">{explicacao.texto}</p>
            </div>
          </div>
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
              Período conferido
            </p>
            <Periodo alerta={alerta} />
          </div>
        </div>

        {/* Detalhes */}
        {aberto && (
          <div className="mt-4 grid gap-4 rounded-xl border border-dashed border-gray-200 p-4 text-sm md:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Movimentação
              </p>
              {alerta.movimentacao ? (
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-gray-700">
                  <dt className="text-gray-500">Fichas</dt>
                  <dd className="tabular-nums">{alerta.movimentacao.fichas ?? "—"}</dd>
                  <dt className="text-gray-500">Total pré</dt>
                  <dd className="tabular-nums">{alerta.movimentacao.totalPre ?? "—"}</dd>
                  <dt className="text-gray-500">Saíram</dt>
                  <dd className="tabular-nums">{alerta.movimentacao.sairam ?? "—"}</dd>
                  <dt className="text-gray-500">Abastecidas</dt>
                  <dd className="tabular-nums">{alerta.movimentacao.abastecidas ?? "—"}</dd>
                  <dt className="text-gray-500">Total pós anterior</dt>
                  <dd className="tabular-nums">
                    {alerta.movimentacaoAnterior?.totalPos ?? "—"}
                  </dd>
                </dl>
              ) : (
                <p className="text-gray-500">Movimentação não encontrada.</p>
              )}
              {alerta.compactPay?.valorFicha ? (
                <p className="pt-1 text-xs text-gray-500">
                  Valor da ficha na placa: {formatarMoeda(alerta.compactPay.valorFicha)}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Registro original
              </p>
              <pre className="whitespace-pre-wrap break-words font-sans text-xs text-gray-600">
                {alerta.descricao}
              </pre>
              {resolvido && (
                <p className="text-xs text-green-700">
                  Resolvido {alerta.resolvidoPor ? `por ${alerta.resolvidoPor} ` : ""}
                  em {formatarDataHora(alerta.resolvidoEm)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAberto((v) => !v)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              {aberto ? "Ocultar detalhes ▲" : "Ver detalhes ▼"}
            </button>
            {alerta.maquina?.id && (
              <Link
                to={`/maquinas/${alerta.maquina.id}`}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Abrir máquina →
              </Link>
            )}
          </div>

          {!resolvido &&
            (confirmando ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Já conferiu?</span>
                <button
                  type="button"
                  onClick={() => setConfirmando(false)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={resolvendo}
                  onClick={() => onResolver(alerta)}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-green-700 disabled:opacity-60"
                >
                  {resolvendo ? "Salvando..." : "Sim, resolver"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmando(true)}
                className="rounded-lg border border-green-600 px-3 py-1.5 text-sm font-semibold text-green-700 hover:bg-green-50"
              >
                ✓ Marcar como resolvido
              </button>
            ))}
        </div>
      </div>
    </article>
  );
}

function Resumo({ rotulo, valor, detalhe, icone, destaque }) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        destaque
          ? "border-transparent bg-linear-to-br from-[#F2A20C] to-[#F2B705] text-white"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <p
          className={`text-xs font-semibold uppercase tracking-wider ${
            destaque ? "text-white/80" : "text-gray-400"
          }`}
        >
          {rotulo}
        </p>
        <span className="text-xl">{icone}</span>
      </div>
      <p className="mt-2 text-3xl font-extrabold tabular-nums">{valor}</p>
      {detalhe && (
        <p className={`text-xs ${destaque ? "text-white/80" : "text-gray-500"}`}>
          {detalhe}
        </p>
      )}
    </div>
  );
}

const FILTROS_STATUS = [
  { valor: "PENDENTE", rotulo: "Pendentes" },
  { valor: "RESOLVIDA", rotulo: "Resolvidos" },
  { valor: "TODAS", rotulo: "Todos" },
];

const FILTROS_TIPO = [
  { valor: "todos", rotulo: "Todos os tipos" },
  { valor: "fichas", rotulo: "🪙 Fichas" },
  { valor: "saida", rotulo: "🧸 Saída de prêmio" },
];

export function AlertasCompactPay() {
  const { setAlertasCompactPayCount } = useAuth();
  const [alertas, setAlertas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [status, setStatus] = useState("PENDENTE");
  const [tipo, setTipo] = useState("todos");
  const [lojaId, setLojaId] = useState("");
  const [maquinaId, setMaquinaId] = useState("");
  const [busca, setBusca] = useState("");
  const [resolvendoId, setResolvendoId] = useState(null);
  const [mostrarAjuda, setMostrarAjuda] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const response = await api.get("/manutencoes/alertas-compactpay", {
        params: { status: "TODAS" },
      });
      setAlertas(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setErro(
        error.response?.data?.error || "Não foi possível carregar os alertas.",
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const pendentes = useMemo(
    () => alertas.filter((a) => a.status === "PENDENTE"),
    [alertas],
  );

  useEffect(() => {
    if (!carregando && !erro) setAlertasCompactPayCount?.(pendentes.length);
  }, [carregando, erro, pendentes.length, setAlertasCompactPayCount]);

  const lojas = useMemo(() => {
    const mapa = new Map();
    alertas.forEach((a) => a.loja && mapa.set(a.loja.id, a.loja.nome));
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [alertas]);

  // Máquinas com mais alertas pendentes (atalho de filtro).
  const reincidentes = useMemo(() => {
    const mapa = new Map();
    pendentes.forEach((a) => {
      if (!a.maquina) return;
      const atual = mapa.get(a.maquina.id) || { ...a.maquina, total: 0 };
      atual.total += 1;
      mapa.set(a.maquina.id, atual);
    });
    return [...mapa.values()]
      .filter((m) => m.total > 1)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [pendentes]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return alertas.filter((a) => {
      if (status !== "TODAS" && a.status !== status) return false;
      if (tipo !== "todos" && a.tipo !== tipo) return false;
      if (lojaId && a.loja?.id !== lojaId) return false;
      if (maquinaId && a.maquina?.id !== maquinaId) return false;
      if (termo) {
        const texto = `${a.maquina?.nome || ""} ${a.maquina?.codigo || ""} ${
          a.loja?.nome || ""
        } ${a.maquina?.compactPayId || ""}`.toLowerCase();
        if (!texto.includes(termo)) return false;
      }
      return true;
    });
  }, [alertas, status, tipo, lojaId, maquinaId, busca]);

  const resumo = useMemo(() => {
    const fichas = pendentes.filter((a) => a.tipo === "fichas");
    const saidas = pendentes.filter((a) => a.tipo === "saida");
    const faltaValor = fichas.reduce(
      (soma, a) => soma + (a.diferencaValor < 0 ? -a.diferencaValor : 0),
      0,
    );
    const premiosSumidos = saidas.reduce(
      (soma, a) => soma + (a.diferenca > 0 ? a.diferenca : 0),
      0,
    );
    const maquinas = new Set(pendentes.map((a) => a.maquina?.id).filter(Boolean));
    return {
      fichas: fichas.length,
      saidas: saidas.length,
      faltaValor,
      premiosSumidos,
      maquinas: maquinas.size,
    };
  }, [pendentes]);

  const resolver = async (alerta) => {
    setResolvendoId(alerta.id);
    try {
      const response = await api.patch(`/manutencoes/${alerta.id}/resolver`);
      setAlertas((lista) =>
        lista.map((a) =>
          a.id === alerta.id
            ? {
                ...a,
                status: "RESOLVIDA",
                resolvidoEm: response.data?.resolvidoEm || new Date().toISOString(),
                resolvidoPor: response.data?.resolvidoPor?.nome || a.resolvidoPor,
              }
            : a,
        ),
      );
    } catch (error) {
      setErro(
        error.response?.data?.error || "Não foi possível resolver o alerta.",
      );
    } finally {
      setResolvendoId(null);
    }
  };

  const filtroAtivo = tipo !== "todos" || lojaId || maquinaId || busca;
  const limparFiltros = () => {
    setTipo("todos");
    setLojaId("");
    setMaquinaId("");
    setBusca("");
  };

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Alertas CompactPay"
          subtitle="Quando o que foi lançado na movimentação não bate com o que a placa contou"
          icon="🚨"
          action={
            <button
              type="button"
              onClick={carregar}
              disabled={carregando}
              className="btn-secondary"
            >
              {carregando ? "Atualizando..." : "↻ Atualizar"}
            </button>
          }
        />

        {/* Como funciona */}
        <div className="mb-6 rounded-2xl border border-[#F2DC99] bg-white/80 shadow-sm">
          <button
            type="button"
            onClick={() => setMostrarAjuda((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-3 text-left"
          >
            <span className="text-sm font-semibold text-gray-700">
              💡 Como funciona a conferência?
            </span>
            <span className="text-gray-400">{mostrarAjuda ? "▲" : "▼"}</span>
          </button>
          {mostrarAjuda && (
            <div className="grid gap-4 px-5 pb-5 text-sm text-gray-600 md:grid-cols-3">
              <div>
                <p className="font-semibold text-gray-800">1. Movimentação lançada</p>
                <p>
                  Quando alguém registra uma movimentação numa máquina com placa
                  CompactPay, o sistema olha o período desde a movimentação anterior.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-800">2. Placa confere</p>
                <p>
                  🪙 <b>Fichas:</b> compara as fichas lançadas com as que entraram na
                  placa. 🧸 <b>Saída:</b> compara os prêmios que saíram do estoque com
                  os que o sensor de saída viu.
                </p>
              </div>
              <div>
                <p className="font-semibold text-gray-800">3. Não bateu? Alerta</p>
                <p>
                  Qualquer diferença vira um alerta aqui. Depois de conferir na loja,
                  marque como resolvido. Só funciona nas máquinas com a conferência
                  ligada no cadastro.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Resumo */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Resumo
            rotulo="Pendentes"
            valor={pendentes.length}
            detalhe={`${resumo.maquinas} ${resumo.maquinas === 1 ? "máquina" : "máquinas"}`}
            icone="🚨"
            destaque
          />
          <Resumo
            rotulo="Fichas"
            valor={resumo.fichas}
            detalhe={
              resumo.faltaValor > 0
                ? `${formatarMoeda(resumo.faltaValor)} a menos lançado`
                : "pendentes"
            }
            icone="🪙"
          />
          <Resumo
            rotulo="Saída de prêmio"
            valor={resumo.saidas}
            detalhe={
              resumo.premiosSumidos > 0
                ? `${resumo.premiosSumidos} prêmio(s) sem registro do sensor`
                : "pendentes"
            }
            icone="🧸"
          />
          <Resumo
            rotulo="Resolvidos"
            valor={alertas.length - pendentes.length}
            detalhe="no histórico"
            icone="✅"
          />
        </div>

        {/* Reincidentes */}
        {reincidentes.length > 0 && (
          <div className="mb-6 rounded-2xl border border-red-100 bg-red-50/60 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-700">
              Máquinas com mais de um alerta pendente
            </p>
            <div className="flex flex-wrap gap-2">
              {reincidentes.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setMaquinaId(maquinaId === m.id ? "" : m.id);
                    setStatus("PENDENTE");
                  }}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition ${
                    maquinaId === m.id
                      ? "border-red-600 bg-red-600 text-white"
                      : "border-red-200 bg-white text-red-800 hover:border-red-400"
                  }`}
                >
                  {m.nome}
                  <span
                    className={`rounded-full px-1.5 text-xs font-bold ${
                      maquinaId === m.id ? "bg-white text-red-600" : "bg-red-100"
                    }`}
                  >
                    {m.total}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center">
          <div className="flex rounded-xl bg-gray-100 p-1">
            {FILTROS_STATUS.map((f) => (
              <button
                key={f.valor}
                type="button"
                onClick={() => setStatus(f.valor)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  status === f.valor
                    ? "bg-white text-gray-900 shadow"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {f.rotulo}
                {f.valor === "PENDENTE" && pendentes.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-[11px] text-white">
                    {pendentes.length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="select-field"
            >
              {FILTROS_TIPO.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.rotulo}
                </option>
              ))}
            </select>
            <select
              value={lojaId}
              onChange={(e) => setLojaId(e.target.value)}
              className="select-field"
            >
              <option value="">Todas as lojas</option>
              {lojas.map(([id, nome]) => (
                <option key={id} value={id}>
                  {nome}
                </option>
              ))}
            </select>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="🔎 Buscar máquina, código ou placa"
              className="input-field"
            />
          </div>
          {filtroAtivo && (
            <button
              type="button"
              onClick={limparFiltros}
              className="text-sm font-medium text-gray-500 hover:text-gray-800"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {erro && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erro}
          </div>
        )}

        {carregando && alertas.length === 0 ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-56 animate-pulse rounded-2xl border border-gray-200 bg-white"
              />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
            <p className="text-5xl mb-3">
              {status === "PENDENTE" && !filtroAtivo ? "🎉" : "🔍"}
            </p>
            <p className="text-lg font-bold text-gray-800">
              {status === "PENDENTE" && !filtroAtivo
                ? "Tudo conferido!"
                : "Nenhum alerta encontrado"}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {status === "PENDENTE" && !filtroAtivo
                ? "Nenhuma divergência pendente entre as movimentações e as placas CompactPay."
                : "Tente outro filtro."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              {filtrados.length} {filtrados.length === 1 ? "alerta" : "alertas"}
            </p>
            {filtrados.map((alerta) => (
              <CartaoAlerta
                key={alerta.id}
                alerta={alerta}
                onResolver={resolver}
                resolvendo={resolvendoId === alerta.id}
              />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
