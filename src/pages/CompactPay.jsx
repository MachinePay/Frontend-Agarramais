import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { AlertBox, Modal, PageHeader } from "../components/UIComponents";
import { LoadingSpinner } from "../components/Loading";
import { useAuth } from "../contexts/AuthContext";

// ---------------------------------------------------------------------------
// Constantes e formatação
// ---------------------------------------------------------------------------

const FUSO = "America/Sao_Paulo";
const TAMANHO_PAGINA = 50;
const ATUALIZAR_A_CADA_MS = 60 * 1000;

const STATUS_INFO = {
  online: { label: "Online", icone: "🟢", className: "border-green-300 bg-green-100 text-green-800" },
  atencao: { label: "Atenção", icone: "🟡", className: "border-yellow-300 bg-yellow-100 text-yellow-900" },
  offline: { label: "Offline", icone: "🔴", className: "border-red-300 bg-red-100 text-red-800" },
  nao_encontrada: {
    label: "Não encontrada",
    icone: "⚪",
    className: "border-gray-300 bg-gray-100 text-gray-600",
  },
};

const WIFI_INFO = {
  otimo: { label: "Ótimo", className: "border-green-300 bg-green-100 text-green-800", cor: "#22c55e", peso: 2 },
  bom: { label: "Bom", className: "border-lime-300 bg-lime-100 text-lime-800", cor: "#84cc16", peso: 1 },
  ruim: { label: "Ruim", className: "border-red-300 bg-red-100 text-red-800", cor: "#ef4444", peso: 0 },
  sem_leitura: { label: "Sem leitura", className: "border-gray-300 bg-gray-100 text-gray-600", cor: "#9ca3af", peso: 3 },
};

const SEVERIDADE_INFO = {
  critico: { label: "Crítico", icone: "🚨", className: "border-red-300 bg-red-100 text-red-800", ordem: 0 },
  aviso: { label: "Aviso", icone: "⚠️", className: "border-orange-300 bg-orange-100 text-orange-800", ordem: 1 },
  info: { label: "Info", icone: "ℹ️", className: "border-blue-300 bg-blue-100 text-blue-800", ordem: 2 },
};

const TIPO_ALERTA = {
  offline: "Offline",
  wifi_ruim: "Wi-Fi ruim",
  pulso_ausente: "Pulso com falha",
  firmware: "Firmware",
  sem_pagamento_recente: "Sem pagamento recente",
  ruido_contador: "Ruído no contador",
  quedas_frequentes: "Quedas frequentes",
};

// Categorias do diagnóstico de quedas que o CompactPay devolve.
const CATEGORIA_INFO = {
  energia: { icone: "🔌", cor: "#dc2626" },
  tensao: { icone: "⚡", cor: "#ea580c" },
  travamento: { icone: "🧊", cor: "#7c3aed" },
  reinicio_forcado: { icone: "🔁", cor: "#a855f7" },
  reinicio: { icone: "🔄", cor: "#c084fc" },
  atualizacao: { icone: "⬆️", cor: "#0ea5e9" },
  configuracao: { icone: "⚙️", cor: "#64748b" },
  wifi: { icone: "📶", cor: "#f97316" },
  internet: { icone: "🌐", cor: "#eab308" },
  id_duplicado: { icone: "👯", cor: "#be185d" },
  oscilacao: { icone: "〰️", cor: "#14b8a6" },
  offline: { icone: "🔴", cor: "#ef4444" },
  desconhecido: { icone: "❔", cor: "#9ca3af" },
};

const infoCategoria = (categoria) => CATEGORIA_INFO[categoria] || CATEGORIA_INFO.desconhecido;

const nivelQuedas = (quedas) => {
  if (quedas >= 5) return { label: "Crítico", className: "bg-red-600 text-white" };
  if (quedas >= 3) return { label: "Instável", className: "bg-orange-500 text-white" };
  if (quedas >= 1) return { label: "Atenção", className: "bg-yellow-300 text-yellow-900" };
  return { label: "Estável", className: "bg-green-500 text-white" };
};

const dataBrasil = (data = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(data);

const horaBrasil = (valor) =>
  Number(
    new Intl.DateTimeFormat("en-US", { timeZone: FUSO, hour: "2-digit", hourCycle: "h23" }).format(
      new Date(valor),
    ),
  );

const somarDias = (dataIso, dias) =>
  dataBrasil(new Date(new Date(`${dataIso}T12:00:00Z`).getTime() + dias * 86400000));

const formatarMoeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatarDataCurta = (dataIso) => {
  if (!dataIso) return "-";
  const [ano, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}${ano !== String(new Date().getFullYear()) ? `/${ano.slice(2)}` : ""}`;
};

const formatarDataHora = (valor) =>
  valor
    ? new Date(valor).toLocaleString("pt-BR", {
        timeZone: FUSO,
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

const formatarDuracao = (minutos) => {
  if (minutos === null || minutos === undefined) return "-";
  if (minutos < 1) return "menos de 1 min";
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas}h${minutos % 60 ? ` ${minutos % 60}min` : ""}`;
  const dias = Math.floor(horas / 24);
  return `${dias}d${horas % 24 ? ` ${horas % 24}h` : ""}`;
};

const formatarSegundos = (segundos) =>
  segundos === null || segundos === undefined ? "-" : formatarDuracao(Math.round(segundos / 60));

const tempoDesde = (valor) =>
  valor ? formatarDuracao(Math.round((Date.now() - new Date(valor).getTime()) / 60000)) : null;

const textoUltimoPagamento = (m) =>
  m.ultimoPagamento?.data
    ? `${formatarDataHora(m.ultimoPagamento.data)} · ${formatarMoeda(m.ultimoPagamento.valor)}`
    : "Sem registro";

const nomeMaquina = (m) => m?.nome || m?.codigo || m?.nomeCompactPay || `Placa ${m?.compactPayId}`;

const mensagemErro = (error, padrao) =>
  error?.response?.data?.error || error?.message || padrao;

// GET com cancelamento: refaz a consulta quando url/params mudam. "loading" é
// derivado (última resposta não corresponde à consulta atual), sem setState no efeito.
function useConsulta(url, params) {
  const chave = url ? `${url}?${JSON.stringify(params)}` : null;
  const [estado, setEstado] = useState({ chave: null, dados: null, erro: "" });

  useEffect(() => {
    if (!chave) return undefined;
    let cancelado = false;
    api
      .get(url, { params })
      .then((res) => !cancelado && setEstado({ chave, dados: res.data, erro: "" }))
      .catch(
        (error) =>
          !cancelado &&
          setEstado((anterior) => ({
            chave,
            dados: anterior.dados,
            erro: mensagemErro(error, "Erro ao carregar dados"),
          })),
      );
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- url e params já estão em "chave"
  }, [chave]);

  return {
    dados: estado.dados,
    erro: estado.erro,
    loading: Boolean(chave) && estado.chave !== chave,
  };
}

// Página atual que volta para 1 sempre que "chaveFiltros" muda.
function usePagina(chaveFiltros) {
  const [estado, setEstado] = useState({ chave: chaveFiltros, page: 1 });
  const page = estado.chave === chaveFiltros ? estado.page : 1;
  const setPage = (novaPagina) => setEstado({ chave: chaveFiltros, page: novaPagina });
  return [page, setPage];
}

// Quedas por placa no período: total exato vem de totalPorMaquina (a lista
// em si pode vir cortada em 500 por placa).
function agruparQuedas(dados, ids) {
  const porId = new Map();
  for (const id of ids) {
    porId.set(id, {
      quedas: dados?.totalPorMaquina?.[id] || 0,
      segundosOffline: 0,
      dias: new Set(),
      categorias: {},
      ultima: null,
    });
  }
  for (const q of dados?.quedas || []) {
    const item = porId.get(q.compactPayId);
    if (!item) continue;
    item.segundosOffline += q.duracaoOfflineSegundos || 0;
    item.dias.add(dataBrasil(new Date(q.data)));
    item.categorias[q.categoria] = (item.categorias[q.categoria] || 0) + 1;
    if (!item.ultima || new Date(q.data) > new Date(item.ultima.data)) item.ultima = q;
  }
  return porId;
}

const categoriaPrincipal = (categorias, labels) => {
  const [categoria] = Object.entries(categorias).sort((a, b) => b[1] - a[1])[0] || [];
  return categoria ? { categoria, label: labels[categoria] || categoria } : null;
};

// ---------------------------------------------------------------------------
// Componentes pequenos
// ---------------------------------------------------------------------------

function Pill({ className = "", children, title }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function StatusPill({ status }) {
  const info = STATUS_INFO[status] || STATUS_INFO.nao_encontrada;
  return (
    <Pill className={info.className}>
      {info.icone} {info.label}
    </Pill>
  );
}

function WifiPill({ maquina }) {
  const info = WIFI_INFO[maquina.wifiStatus] || WIFI_INFO.sem_leitura;
  return (
    <Pill
      className={info.className}
      title={maquina.wifiRssi !== null ? `${maquina.wifiRssi} dBm` : undefined}
    >
      📶 {maquina.wifiQualidade !== null ? `${maquina.wifiQualidade}%` : info.label}
    </Pill>
  );
}

function QuedasPill({ quedas }) {
  const nivel = nivelQuedas(quedas);
  return (
    <span
      title={`${nivel.label}: caiu ${quedas}x`}
      className={`inline-flex min-w-[3rem] items-center justify-center rounded-full px-2 py-0.5 text-sm font-bold ${nivel.className}`}
    >
      {quedas}x
    </span>
  );
}

function CategoriaPill({ queda }) {
  const info = infoCategoria(queda.categoria);
  return (
    <Pill className="border-gray-200 bg-white text-gray-800" title={queda.motivo}>
      <span style={{ color: info.cor }}>{info.icone}</span> {queda.categoriaLabel}
    </Pill>
  );
}

function KpiCard({ titulo, valor, detalhe, icone, cor, onClick, ativo }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-2xl border-2 bg-white p-4 text-left shadow-sm transition-all ${
        onClick ? "hover:-translate-y-0.5 hover:shadow-md" : "cursor-default"
      } ${ativo ? "border-primary ring-2 ring-primary/30" : "border-gray-100"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{titulo}</p>
        <span className="text-xl">{icone}</span>
      </div>
      <p className={`mt-1 break-words text-2xl font-extrabold sm:text-3xl ${cor || "text-gray-900"}`}>{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-gray-500">{detalhe}</p>}
    </button>
  );
}

function Secao({ titulo, descricao, children, acao }) {
  return (
    <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{titulo}</h2>
          {descricao && <p className="text-sm text-gray-500">{descricao}</p>}
        </div>
        {acao}
      </div>
      {children}
    </section>
  );
}

function Vazio({ icone = "📭", mensagem }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
      <div className="mb-2 text-4xl">{icone}</div>
      <p className="font-medium text-gray-600">{mensagem}</p>
    </div>
  );
}

function Paginacao({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      <button
        className="btn-secondary px-3 py-1 text-sm disabled:opacity-40"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        ← Anterior
      </button>
      <span className="text-sm text-gray-600">
        Página {page} de {totalPages}
      </span>
      <button
        className="btn-secondary px-3 py-1 text-sm disabled:opacity-40"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Próxima →
      </button>
    </div>
  );
}

function Grupos({ opcoes, valor, onChange }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-gray-200">
      {opcoes.map(([chave, label]) => (
        <button
          key={chave}
          onClick={() => onChange(chave)}
          className={`px-3 py-1.5 text-sm font-medium ${
            valor === chave ? "bg-primary text-white" : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function NomeMaquina({ maquina, onAbrir }) {
  return (
    <button type="button" onClick={onAbrir} className="text-left hover:underline">
      <span className="block font-semibold text-gray-900">
        {maquina.codigo}
        {maquina.nome ? ` · ${maquina.nome}` : ""}
      </span>
      <span className="block text-xs text-gray-500">
        Placa {maquina.compactPayId}
        {maquina.lojaNome && <span className="text-amber-700"> · {maquina.lojaNome}</span>}
      </span>
    </button>
  );
}

function DetalhesQueda({ queda }) {
  if (!queda.detalhes?.length && !queda.motivoTecnico) return null;
  return (
    <ul className="mt-1 list-inside list-disc text-xs text-gray-500">
      {(queda.detalhes || []).map((d) => (
        <li key={d}>{d}</li>
      ))}
      {queda.motivoTecnico && <li className="font-mono">{queda.motivoTecnico}</li>}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Aba: Máquinas
// ---------------------------------------------------------------------------

const ORDENACOES = {
  padrao: (a, b) =>
    (STATUS_ORDEM[a.status] ?? 9) - (STATUS_ORDEM[b.status] ?? 9) ||
    b.quedasHoje - a.quedasHoje,
  offline: (a, b) => (b.offlineHaMinutos ?? -1) - (a.offlineHaMinutos ?? -1),
  quedas: (a, b) => b.quedasHoje - a.quedasHoje,
  wifi: (a, b) =>
    (WIFI_INFO[a.wifiStatus]?.peso ?? 9) - (WIFI_INFO[b.wifiStatus]?.peso ?? 9) ||
    (a.wifiQualidade ?? 999) - (b.wifiQualidade ?? 999),
  faturamento: (a, b) => b.faturamentoHoje - a.faturamentoHoje,
  codigo: () => 0,
};

const STATUS_ORDEM = { offline: 0, nao_encontrada: 1, atencao: 2, online: 3 };

function AbaMaquinas({ maquinas, onAbrirMaquina, status, setStatus, comQueda, setComQueda }) {
  const [ordenar, setOrdenar] = useState("padrao");
  const [page, setPage] = usePagina(JSON.stringify([maquinas.length, status, comQueda, ordenar]));

  const lista = useMemo(() => {
    let resultado = maquinas;
    if (status === "problemas") resultado = resultado.filter((m) => m.status !== "online");
    if (status === "offline") resultado = resultado.filter((m) => !m.online);
    if (status === "online") resultado = resultado.filter((m) => m.status === "online");
    if (comQueda) resultado = resultado.filter((m) => m.quedasHoje > 0);
    return [...resultado].sort(
      (a, b) => ORDENACOES[ordenar](a, b) || String(a.codigo).localeCompare(String(b.codigo), "pt-BR", { numeric: true }),
    );
  }, [maquinas, status, comQueda, ordenar]);

  const totalPages = Math.max(Math.ceil(lista.length / TAMANHO_PAGINA), 1);
  const titulos = {
    problemas: "🛠️ Máquinas com problema agora",
    offline: "🔴 Máquinas offline",
    online: "🟢 Máquinas 100% ok",
    todas: "📋 Todas as máquinas",
  };

  return (
    <Secao
      titulo={titulos[status]}
      descricao={
        status === "problemas"
          ? "Offline, em atenção (Wi-Fi ruim, firmware ou pulso com falha) ou com placa não encontrada no CompactPay."
          : "Clique na máquina para ver o histórico completo e as ações."
      }
      acao={
        <div className="flex flex-wrap gap-2">
          <Grupos
            valor={status}
            onChange={setStatus}
            opcoes={[
              ["problemas", "🛠️ Com problema"],
              ["offline", "🔴 Offline"],
              ["online", "🟢 Ok"],
              ["todas", "Todas"],
            ]}
          />
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm">
            <input type="checkbox" checked={comQueda} onChange={(e) => setComQueda(e.target.checked)} />
            Só com queda hoje
          </label>
          <select
            className="input-field w-auto py-1.5 text-sm"
            value={ordenar}
            onChange={(e) => setOrdenar(e.target.value)}
          >
            <option value="padrao">Ordem padrão</option>
            <option value="offline">Offline há mais tempo</option>
            <option value="quedas">Mais quedas hoje</option>
            <option value="wifi">Pior Wi-Fi primeiro</option>
            <option value="faturamento">Maior faturamento hoje</option>
            <option value="codigo">Código da máquina</option>
          </select>
        </div>
      }
    >
      {lista.length === 0 ? (
        <Vazio
          icone={status === "problemas" || status === "offline" ? "🎉" : "📭"}
          mensagem={
            status === "problemas" || status === "offline"
              ? "Nenhuma máquina com problema com esses filtros. Tudo no ar!"
              : "Nenhuma máquina encontrada com esses filtros."
          }
        />
      ) : (
        <>
          <p className="mb-2 text-sm text-gray-500">
            {lista.length} máquina{lista.length === 1 ? "" : "s"}
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <th className="px-3 py-2">Máquina / Placa</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Offline há / Quedas hoje</th>
                  <th className="px-3 py-2">Último pagamento</th>
                  <th className="px-3 py-2">Wi-Fi</th>
                  <th className="px-3 py-2">Firmware</th>
                  <th className="px-3 py-2 text-right">Faturamento hoje</th>
                </tr>
              </thead>
              <tbody>
                {lista.slice((page - 1) * TAMANHO_PAGINA, page * TAMANHO_PAGINA).map((m) => (
                  <tr
                    key={m.maquinaId}
                    className={`border-b align-top hover:bg-gray-50 ${m.online ? "" : "bg-red-50/40"}`}
                  >
                    <td className="px-3 py-2">
                      <NomeMaquina maquina={m} onAbrir={() => onAbrirMaquina(m.maquinaId)} />
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill status={m.status} />
                      {m.alertas.length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {m.alertas
                            .filter((t) => t !== "offline")
                            .map((t) => (
                              <Pill key={t} className="border-orange-200 bg-orange-50 text-orange-800">
                                {TIPO_ALERTA[t] || t}
                              </Pill>
                            ))}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {!m.online && m.encontrada && (
                        <span className="mb-1 block">
                          <span className="font-semibold text-red-700">
                            {m.offlineHaMinutos !== null ? formatarDuracao(m.offlineHaMinutos) : "Sem sinal registrado"}
                          </span>
                          {m.ultimoSinal && (
                            <span className="block text-xs text-gray-500">
                              último sinal {formatarDataHora(m.ultimoSinal)}
                            </span>
                          )}
                        </span>
                      )}
                      <QuedasPill quedas={m.quedasHoje} />
                    </td>
                    <td className="px-3 py-2 text-gray-700">{textoUltimoPagamento(m)}</td>
                    <td className="px-3 py-2">
                      <WifiPill maquina={m} />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      <span className="font-semibold">{m.firmwareVersao ? `v${m.firmwareVersao}` : "-"}</span>
                      {m.firmwareAlerta && (
                        <span className="block text-orange-700">
                          → {m.firmwareAlvo || "?"} ({m.firmwareStatus || "pendente"})
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">{formatarMoeda(m.faturamentoHoje)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacao page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </Secao>
  );
}

// ---------------------------------------------------------------------------
// Aba: Alertas
// ---------------------------------------------------------------------------

function AbaAlertas({ alertas, maquinasPorPlaca, onAbrirMaquina }) {
  const [severidade, setSeveridade] = useState("todos");

  const lista = useMemo(
    () =>
      alertas
        .filter((a) => maquinasPorPlaca.has(a.compactPayId))
        .filter((a) => severidade === "todos" || a.severidade === severidade)
        .sort(
          (a, b) =>
            (SEVERIDADE_INFO[a.severidade]?.ordem ?? 9) - (SEVERIDADE_INFO[b.severidade]?.ordem ?? 9) ||
            new Date(b.detectadoEm || 0) - new Date(a.detectadoEm || 0),
        ),
    [alertas, maquinasPorPlaca, severidade],
  );

  return (
    <Secao
      titulo="🚨 Alertas ativos"
      descricao="Calculados pelo CompactPay agora: offline, Wi-Fi ruim, pulso com falha, firmware, quedas frequentes, ruído no contador e sem pagamento recente."
      acao={
        <Grupos
          valor={severidade}
          onChange={setSeveridade}
          opcoes={[
            ["todos", "Todos"],
            ["critico", "🚨 Críticos"],
            ["aviso", "⚠️ Avisos"],
            ["info", "ℹ️ Info"],
          ]}
        />
      }
    >
      {!lista.length ? (
        <Vazio icone="🎉" mensagem="Nenhum alerta ativo com esses filtros." />
      ) : (
        <ul className="divide-y">
          {lista.map((a) => {
            const info = SEVERIDADE_INFO[a.severidade] || SEVERIDADE_INFO.info;
            const maquina = maquinasPorPlaca.get(a.compactPayId);
            return (
              <li key={a.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-4">
                <Pill className={info.className}>
                  {info.icone} {info.label}
                </Pill>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onAbrirMaquina(maquina.maquinaId)}
                    className="text-left font-semibold text-gray-900 hover:underline"
                  >
                    {a.titulo} · {nomeMaquina(maquina)}
                  </button>
                  <p className="text-sm text-gray-600">{a.mensagem}</p>
                </div>
                <span className="shrink-0 font-mono text-xs text-gray-500">{formatarDataHora(a.detectadoEm)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Secao>
  );
}

// ---------------------------------------------------------------------------
// Aba: Ranking de quedas
// ---------------------------------------------------------------------------

function AbaRanking({ maquinas, periodo, onAbrirMaquina }) {
  const [ordem, setOrdem] = useState("pior");
  const [paginasVisiveis, setPaginasVisiveis] = usePagina(JSON.stringify([periodo, maquinas.length]));
  const mostrar = paginasVisiveis * TAMANHO_PAGINA;
  const { dados, loading, erro } = useConsulta("/compact-pay/monitor/quedas", {
    dataInicio: periodo.inicio,
    dataFim: periodo.fim,
  });

  const { ranking, labels } = useMemo(() => {
    const labelsCategoria = {};
    for (const q of dados?.quedas || []) labelsCategoria[q.categoria] = q.categoriaLabel;
    const porId = agruparQuedas(dados, maquinas.map((m) => m.compactPayId));
    const lista = maquinas
      .map((m) => {
        const q = porId.get(m.compactPayId);
        return {
          maquina: m,
          quedas: q.quedas,
          segundosOffline: q.segundosOffline,
          diasComQueda: q.dias.size,
          principal: categoriaPrincipal(q.categorias, labelsCategoria),
          ultima: q.ultima,
        };
      })
      .sort((a, b) => b.quedas - a.quedas || b.segundosOffline - a.segundosOffline)
      .map((item, indice) => ({ posicao: indice + 1, ...item }));
    return { ranking: ordem === "pior" ? lista : [...lista].reverse(), labels: labelsCategoria };
  }, [dados, maquinas, ordem]);

  const totalQuedas = ranking.reduce((acc, r) => acc + r.quedas, 0);
  const maiorQueda = Math.max(1, ...ranking.map((r) => r.quedas));
  const causas = {};
  for (const q of dados?.quedas || []) causas[q.categoria] = (causas[q.categoria] || 0) + 1;
  const causaPrincipal = categoriaPrincipal(causas, labels);
  const umDia = periodo.inicio === periodo.fim;

  return (
    <Secao
      titulo="🏆 Ranking de quedas"
      descricao={`Quantas vezes cada placa caiu ou reiniciou sozinha ${
        umDia
          ? `em ${formatarDataCurta(periodo.inicio)}`
          : `de ${formatarDataCurta(periodo.inicio)} a ${formatarDataCurta(periodo.fim)}`
      }. Empate é desempatado pelo tempo offline.`}
      acao={
        <Grupos
          valor={ordem}
          onChange={setOrdem}
          opcoes={[
            ["pior", "😟 Pior → melhor"],
            ["melhor", "😄 Melhor → pior"],
          ]}
        />
      }
    >
      {erro && <AlertBox type="error" message={erro} />}
      {dados?.incompleto && (
        <AlertBox
          type="info"
          message="Alguma placa teve mais de 500 quedas no período: a contagem está certa, mas tempo offline e motivos consideram só as 500 mais recentes."
        />
      )}
      {loading && !dados ? (
        <LoadingSpinner message="Montando ranking..." />
      ) : !ranking.length ? (
        <Vazio mensagem="Nenhuma máquina com esses filtros." />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard titulo="Total de quedas" valor={totalQuedas} icone="⚡" cor="text-orange-600" />
            <KpiCard
              titulo="Máquinas que caíram"
              valor={ranking.filter((r) => r.quedas > 0).length}
              icone="📉"
              cor="text-red-600"
            />
            <KpiCard
              titulo="Sem nenhuma queda"
              valor={ranking.filter((r) => r.quedas === 0).length}
              icone="✅"
              cor="text-green-600"
            />
            <KpiCard
              titulo="Causa mais comum"
              valor={causaPrincipal ? `${infoCategoria(causaPrincipal.categoria).icone} ${causaPrincipal.label}` : "-"}
              icone="🔎"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Máquina / Placa</th>
                  <th className="px-3 py-2">Quedas</th>
                  {!umDia && <th className="px-3 py-2">Dias com queda</th>}
                  <th className="px-3 py-2">Ficou offline</th>
                  <th className="px-3 py-2">Motivo mais comum</th>
                  <th className="px-3 py-2">Agora</th>
                </tr>
              </thead>
              <tbody>
                {ranking.slice(0, mostrar).map((r) => (
                  <tr key={r.maquina.maquinaId} className="border-b align-top hover:bg-gray-50">
                    <td className="px-3 py-2 font-bold text-gray-500">
                      {r.posicao <= 3 && ordem === "pior" && r.quedas > 0
                        ? ["🥇", "🥈", "🥉"][r.posicao - 1]
                        : `${r.posicao}º`}
                    </td>
                    <td className="px-3 py-2">
                      <NomeMaquina maquina={r.maquina} onAbrir={() => onAbrirMaquina(r.maquina.maquinaId)} />
                    </td>
                    <td className="min-w-[180px] px-3 py-2">
                      <div className="flex items-center gap-2">
                        <QuedasPill quedas={r.quedas} />
                        <div className="h-2 flex-1 rounded-full bg-gray-100">
                          <div
                            className={`h-2 rounded-full ${nivelQuedas(r.quedas).className.split(" ")[0]}`}
                            style={{ width: `${(r.quedas / maiorQueda) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    {!umDia && <td className="px-3 py-2">{r.diasComQueda}</td>}
                    <td className="px-3 py-2">
                      {r.segundosOffline > 0 ? (
                        formatarSegundos(r.segundosOffline)
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.principal ? (
                        <CategoriaPill queda={{ categoria: r.principal.categoria, categoriaLabel: r.principal.label }} />
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        <StatusPill status={r.maquina.status} />
                        <WifiPill maquina={r.maquina} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ranking.length > mostrar && (
            <div className="mt-4 text-center">
              <button className="btn-secondary" onClick={() => setPaginasVisiveis(paginasVisiveis + 1)}>
                Mostrar mais ({ranking.length - mostrar} restantes)
              </button>
            </div>
          )}
        </>
      )}
    </Secao>
  );
}

// ---------------------------------------------------------------------------
// Aba: Gráficos
// ---------------------------------------------------------------------------

function AbaGraficos({ maquinas, periodo }) {
  // Um gráfico de um dia só não diz nada: expande para os 14 dias até a data final.
  const periodoGrafico =
    periodo.inicio === periodo.fim
      ? { inicio: somarDias(periodo.fim, -13), fim: periodo.fim, expandido: true }
      : periodo;

  const { dados, loading, erro } = useConsulta("/compact-pay/monitor/quedas", {
    dataInicio: periodoGrafico.inicio,
    dataFim: periodoGrafico.fim,
  });

  const ids = useMemo(() => new Set(maquinas.map((m) => m.compactPayId)), [maquinas]);
  const quedas = useMemo(() => (dados?.quedas || []).filter((q) => ids.has(q.compactPayId)), [dados, ids]);

  const serie = useMemo(() => {
    const porDia = new Map();
    for (let dia = periodoGrafico.inicio; dia <= periodoGrafico.fim; dia = somarDias(dia, 1)) {
      porDia.set(dia, { data: dia, dia: formatarDataCurta(dia), quedas: 0, maquinas: new Set(), horasOffline: 0 });
    }
    for (const q of quedas) {
      const item = porDia.get(dataBrasil(new Date(q.data)));
      if (!item) continue;
      item.quedas += 1;
      item.maquinas.add(q.compactPayId);
      item.horasOffline += (q.duracaoOfflineSegundos || 0) / 3600;
    }
    return [...porDia.values()].map((d) => ({
      ...d,
      maquinasComQueda: d.maquinas.size,
      horasOffline: Number(d.horasOffline.toFixed(1)),
    }));
  }, [quedas, periodoGrafico.inicio, periodoGrafico.fim]);

  const porHora = useMemo(() => {
    const horas = Array.from({ length: 24 }, (_, hora) => ({ hora: `${String(hora).padStart(2, "0")}h`, quedas: 0 }));
    for (const q of quedas) horas[horaBrasil(q.data)].quedas += 1;
    return horas;
  }, [quedas]);

  const porCategoria = useMemo(() => {
    const mapa = {};
    for (const q of quedas) {
      mapa[q.categoria] ||= { categoria: q.categoria, label: q.categoriaLabel, total: 0 };
      mapa[q.categoria].total += 1;
    }
    return Object.values(mapa).sort((a, b) => b.total - a.total);
  }, [quedas]);

  const wifi = Object.entries(WIFI_INFO).map(([chave, info]) => ({
    chave,
    label: info.label,
    total: maquinas.filter((m) => m.wifiStatus === chave).length,
  }));

  const porFirmware = useMemo(() => {
    const mapa = {};
    for (const m of maquinas) {
      const chave = m.firmwareVersao ? `v${m.firmwareVersao}` : "Desconhecida";
      mapa[chave] ||= { versao: chave, total: 0, offline: 0, quedas: 0 };
      mapa[chave].total += 1;
      mapa[chave].offline += m.online ? 0 : 1;
      mapa[chave].quedas += m.quedasHoje;
    }
    return Object.values(mapa).sort((a, b) => b.total - a.total);
  }, [maquinas]);

  return (
    <>
      {erro && <AlertBox type="error" message={erro} />}
      <Secao
        titulo="📈 Quedas por dia"
        descricao={`Soma das quedas das máquinas filtradas${
          periodoGrafico.expandido ? " (últimos 14 dias — escolha um período para mudar)" : ""
        }.`}
      >
        {loading && !dados ? (
          <LoadingSpinner />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={serie}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="dia" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="quedas" name="Quedas" fill="#f97316" radius={[4, 4, 0, 0]} />
              <Bar dataKey="maquinasComQueda" name="Máquinas que caíram" fill="#334155" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Secao>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Secao titulo="🔎 Por que caíram" descricao="Diagnóstico do CompactPay para cada queda do período.">
          {!porCategoria.length ? (
            <Vazio icone="🎉" mensagem="Nenhuma queda no período." />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, porCategoria.length * 36)}>
              <BarChart data={porCategoria} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis type="number" allowDecimals={false} fontSize={12} />
                <YAxis type="category" dataKey="label" width={150} fontSize={12} />
                <Tooltip />
                <Bar dataKey="total" name="Quedas" radius={[0, 4, 4, 0]}>
                  {porCategoria.map((c) => (
                    <Cell key={c.categoria} fill={infoCategoria(c.categoria).cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Secao>
        <Secao titulo="⏰ Quedas por hora" descricao="Em que horário as placas mais caem no período.">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={porHora}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="hora" fontSize={11} interval={1} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Bar dataKey="quedas" name="Quedas" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Secao>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Secao titulo="⏱️ Horas offline por dia" descricao="Tempo somado que as placas ficaram fora do ar depois de cair.">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={serie}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="dia" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="horasOffline" name="Horas offline" fill="#a855f7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Secao>
        <Secao titulo="📶 Qualidade do Wi-Fi agora" descricao="Ótimo ≥ 70% · Bom ≥ 40% · Ruim abaixo disso.">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={wifi} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis type="number" allowDecimals={false} fontSize={12} />
              <YAxis type="category" dataKey="label" width={100} fontSize={12} />
              <Tooltip />
              <Bar dataKey="total" name="Máquinas" radius={[0, 4, 4, 0]}>
                {wifi.map((w) => (
                  <Cell key={w.chave} fill={WIFI_INFO[w.chave].cor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Secao>
      </div>

      <Secao titulo="🧩 Por versão de firmware" descricao="Ajuda a ver se alguma versão cai mais que as outras.">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                <th className="px-3 py-2">Versão</th>
                <th className="px-3 py-2 text-right">Máquinas</th>
                <th className="px-3 py-2 text-right">Offline agora</th>
                <th className="px-3 py-2 text-right">Quedas hoje</th>
                <th className="px-3 py-2 text-right">Quedas por máquina</th>
              </tr>
            </thead>
            <tbody>
              {porFirmware.map((v) => (
                <tr key={v.versao} className="border-b">
                  <td className="px-3 py-2 font-semibold">{v.versao}</td>
                  <td className="px-3 py-2 text-right">{v.total}</td>
                  <td className="px-3 py-2 text-right text-red-600">{v.offline}</td>
                  <td className="px-3 py-2 text-right text-orange-600">{v.quedas}</td>
                  <td className="px-3 py-2 text-right">{(v.quedas / v.total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>
    </>
  );
}

// ---------------------------------------------------------------------------
// Aba: Histórico de quedas
// ---------------------------------------------------------------------------

function AbaHistorico({ maquinasPorPlaca, periodo, onAbrirMaquina }) {
  const [categoria, setCategoria] = useState("");
  const [page, setPage] = usePagina(JSON.stringify([periodo, categoria, maquinasPorPlaca.size]));
  const { dados, loading, erro } = useConsulta("/compact-pay/monitor/quedas", {
    dataInicio: periodo.inicio,
    dataFim: periodo.fim,
  });

  const todas = useMemo(
    () => (dados?.quedas || []).filter((q) => maquinasPorPlaca.has(q.compactPayId)),
    [dados, maquinasPorPlaca],
  );
  const categorias = useMemo(() => {
    const mapa = new Map();
    for (const q of todas) mapa.set(q.categoria, q.categoriaLabel);
    return [...mapa];
  }, [todas]);
  const lista = categoria ? todas.filter((q) => q.categoria === categoria) : todas;
  const totalPages = Math.max(Math.ceil(lista.length / TAMANHO_PAGINA), 1);

  return (
    <Secao
      titulo="🕒 Histórico de quedas"
      descricao="Cada queda de conexão ou reinício sozinho da placa, com o motivo que o CompactPay identificou. Mais recentes primeiro."
      acao={
        <select className="input-field w-auto py-1.5 text-sm" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todos os motivos</option>
          {categorias.map(([chave, label]) => (
            <option key={chave} value={chave}>
              {infoCategoria(chave).icone} {label}
            </option>
          ))}
        </select>
      }
    >
      {erro && <AlertBox type="error" message={erro} />}
      {loading && !dados ? (
        <LoadingSpinner />
      ) : !lista.length ? (
        <Vazio icone="🎉" mensagem="Nenhuma queda neste período." />
      ) : (
        <>
          <p className="mb-2 text-sm text-gray-500">{lista.length} quedas</p>
          <ul className="divide-y">
            {lista.slice((page - 1) * TAMANHO_PAGINA, page * TAMANHO_PAGINA).map((q) => {
              const maquina = maquinasPorPlaca.get(q.compactPayId);
              return (
                <li key={q.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-4">
                  <span className="w-28 shrink-0 font-mono text-xs text-gray-500">{formatarDataHora(q.data)}</span>
                  <CategoriaPill queda={q} />
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onAbrirMaquina(maquina.maquinaId)}
                      className="text-left font-medium text-gray-900 hover:underline"
                    >
                      {nomeMaquina(maquina)}
                    </button>
                    <p className="text-sm text-gray-600">{q.motivo}</p>
                    <DetalhesQueda queda={q} />
                  </div>
                  <span className="shrink-0 text-xs text-gray-500">
                    {q.reconectouEm
                      ? `ficou ${formatarSegundos(q.duracaoOfflineSegundos)} fora`
                      : "ainda não voltou"}
                  </span>
                </li>
              );
            })}
          </ul>
          <Paginacao page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </Secao>
  );
}

// ---------------------------------------------------------------------------
// Aba: Como ler esta página
// ---------------------------------------------------------------------------

function AbaAjuda() {
  const itens = [
    ["🟢 Online · 🟡 Atenção · 🔴 Offline", "Online = placa mandando sinal e tudo certo. Atenção = no ar, mas com Wi-Fi ruim, firmware pendente ou o último pulso falhou. Offline = sem sinal agora (não recebe Pix/cartão)."],
    ["⚪ Não encontrada", "A máquina tem ID CompactPay no cadastro, mas a placa não aparece para o usuário de integração. Confira o ID no cadastro da máquina."],
    ["⚡ Quedas (Nx)", "Quantas vezes a placa perdeu a conexão ou reiniciou sozinha no dia. 0 = estável · 1 a 2 = atenção · 3 a 4 = instável · 5 ou mais = crítico."],
    ["🔎 Motivo da queda", "O CompactPay analisa o que a placa mandou antes e depois de cair: falta de energia, queda de tensão, Wi-Fi, internet do local, travamento, atualização de firmware, ID duplicado etc."],
    ["Ficou offline", "Tempo entre a placa parar de falar e reconectar. \"Ainda não voltou\" = continua fora do ar."],
    ["📶 Wi-Fi", "Qualidade do sinal em % (e dBm no tooltip), informada pela placa. Ótimo ≥ 70%, Bom ≥ 40%, Ruim abaixo disso."],
    ["Firmware", "Versão instalada. Quando aparece \"→ versão (status)\" há uma atualização pendente, em andamento ou que falhou."],
    ["Pulso com falha", "O último pagamento/crédito não confirmou o pulso na máquina — vale testar se ela está liberando a jogada."],
    ["🚨 Alertas", "Calculados pelo CompactPay na hora: offline há mais de 5 min, Wi-Fi ruim, pulso com falha, firmware, 3+ quedas em 2h, ruído no contador (10+ pulsos curtos em 24h) e 7+ dias sem pagamento."],
    ["Histórico", "Fica guardado no próprio CompactPay — não depende de coleta da Agarramais. Só aparecem as máquinas da Agarramais com ID CompactPay cadastrado."],
    ["Ações", "Ao abrir uma máquina: verificar a placa (ping na hora), enviar crédito (fica como teste, não entra no faturamento), ver transações e devolver pagamentos."],
  ];
  return (
    <Secao titulo="❓ Como ler esta página" descricao="Glossário rápido para quem cuida do suporte.">
      <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {itens.map(([termo, explicacao]) => (
          <div key={termo} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <dt className="font-bold text-gray-900">{termo}</dt>
            <dd className="mt-1 text-sm text-gray-600">{explicacao}</dd>
          </div>
        ))}
      </dl>
    </Secao>
  );
}

// ---------------------------------------------------------------------------
// Ações na placa: verificar, crédito, transações e devolução
// ---------------------------------------------------------------------------

const VALORES_RAPIDOS_CREDITO = [2, 5, 10, 20, 50, 100];

const parseValorCredito = (valor) => {
  const numero = Number(String(valor || "").trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) ? numero : 0;
};

const formatarValorInput = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const classesStatusVenda = (status) => {
  const texto = String(status || "").toLowerCase();
  if (texto.includes("extorn") || texto.includes("devolv")) return "border-red-300 bg-red-100 text-red-800";
  if (texto.includes("aprova") || texto.includes("fisico")) return "border-green-300 bg-green-100 text-green-800";
  if (texto.includes("teste")) return "border-blue-300 bg-blue-100 text-blue-800";
  return "border-gray-300 bg-gray-100 text-gray-700";
};

// pulse_status do CompactPay: liberado / pulso_confirmado / fisico = ok,
// falha_* = erro, pendente / comando_enviado = aguardando.
const descreverPulso = (pulsoStatus) => {
  const texto = String(pulsoStatus || "");
  if (/^(liberado|pulso_confirmado|fisico)$/.test(texto)) {
    return { label: texto === "fisico" ? "Físico" : "Confirmado", className: "border-green-300 bg-green-100 text-green-800" };
  }
  if (texto.startsWith("falha")) return { label: "Falha", className: "border-red-300 bg-red-100 text-red-800" };
  if (texto === "teste") return { label: "Teste", className: "border-blue-300 bg-blue-100 text-blue-800" };
  return { label: "Aguardando", className: "border-yellow-300 bg-yellow-100 text-yellow-900" };
};

function AcoesCompactPay({ maquina }) {
  const { isAdmin } = useAuth();
  const admin = isAdmin();
  const hoje = dataBrasil();

  const [verificando, setVerificando] = useState(false);
  const [resultadoPing, setResultadoPing] = useState(null);

  const [valorCredito, setValorCredito] = useState("2,00");
  const [enviandoCredito, setEnviandoCredito] = useState(false);
  const [mensagemCredito, setMensagemCredito] = useState(null);

  const [periodo, setPeriodo] = useState({ inicio: hoje, fim: hoje });
  const [transacoes, setTransacoes] = useState(null);
  const [buscandoTransacoes, setBuscandoTransacoes] = useState(false);
  const [devolvendoId, setDevolvendoId] = useState("");
  const [erro, setErro] = useState("");

  const verificarPlaca = async () => {
    setVerificando(true);
    setResultadoPing(null);
    try {
      const res = await api.post(`/compact-pay/maquinas/${maquina.maquinaId}/verificar-online`);
      const status = res.data?.status;
      setResultadoPing({
        ok: Boolean(status?.online),
        texto: status?.online ? "A placa respondeu: está online." : status?.mensagem || "A placa não respondeu.",
      });
    } catch (error) {
      setResultadoPing({ ok: false, texto: mensagemErro(error, "Não foi possível verificar a placa.") });
    } finally {
      setVerificando(false);
    }
  };

  const enviarCredito = async () => {
    const valor = parseValorCredito(valorCredito);
    if (valor <= 0) {
      setMensagemCredito({ ok: false, texto: "Informe um valor maior que zero." });
      return;
    }
    setEnviandoCredito(true);
    setMensagemCredito(null);
    try {
      const res = await api.post(`/compact-pay/maquinas/${maquina.maquinaId}/credito`, { valor });
      setMensagemCredito({
        ok: true,
        texto:
          res.data?.commandStatus === "na_fila"
            ? "Enviado! A placa estava ocupada, o crédito entrou na fila."
            : "Enviado para a placa!",
      });
    } catch (error) {
      setMensagemCredito({ ok: false, texto: mensagemErro(error, "Não foi possível enviar crédito.") });
    } finally {
      setEnviandoCredito(false);
    }
  };

  const buscarTransacoes = async () => {
    setBuscandoTransacoes(true);
    setErro("");
    try {
      const params = admin ? { inicio: periodo.inicio, fim: periodo.fim } : {};
      const res = await api.get(`/compact-pay/maquinas/${maquina.maquinaId}/transacoes`, { params });
      setTransacoes(res.data);
    } catch (error) {
      setErro(mensagemErro(error, "Não foi possível buscar as transações."));
    } finally {
      setBuscandoTransacoes(false);
    }
  };

  const devolver = async (transacao) => {
    if (!transacao.historicoId) return;
    if (!window.confirm(`Confirma a devolução do pagamento de ${formatarMoeda(transacao.valor)}?`)) return;
    setDevolvendoId(transacao.id);
    setErro("");
    try {
      await api.post(`/compact-pay/maquinas/${maquina.maquinaId}/pagamentos/${transacao.historicoId}/devolver`);
      setTransacoes((atual) => ({
        ...atual,
        total: Number((atual.total - transacao.valor).toFixed(2)),
        quantidade: Math.max(0, atual.quantidade - 1),
        transacoes: atual.transacoes.map((t) =>
          t.id === transacao.id ? { ...t, status: "Extornado", jaDevolvido: true, podeDevolver: false } : t,
        ),
      }));
    } catch (error) {
      setErro(mensagemErro(error, "Não foi possível devolver o pagamento."));
    } finally {
      setDevolvendoId("");
    }
  };

  return (
    <div className="space-y-4">
      {erro && <AlertBox type="error" message={erro} onClose={() => setErro("")} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <h4 className="mb-1 font-bold text-gray-900">📡 Verificar placa</h4>
          <p className="mb-3 text-xs text-gray-500">Manda um ping e espera a resposta (até ~6s).</p>
          <button
            type="button"
            className="btn-secondary px-4 py-1.5 text-sm disabled:opacity-60"
            onClick={verificarPlaca}
            disabled={verificando}
          >
            {verificando ? "Verificando..." : "Verificar agora"}
          </button>
          {resultadoPing && (
            <p className={`mt-2 text-sm font-semibold ${resultadoPing.ok ? "text-green-700" : "text-red-600"}`}>
              {resultadoPing.texto}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <h4 className="mb-1 font-bold text-gray-900">💸 Enviar crédito</h4>
          <p className="mb-3 text-xs text-gray-500">Fica como teste no CompactPay (não entra no faturamento).</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              className="input-field w-24 py-1.5 text-center"
              value={valorCredito}
              onChange={(e) => setValorCredito(e.target.value)}
              onBlur={() => {
                const valor = parseValorCredito(valorCredito);
                setValorCredito(formatarValorInput(valor > 0 ? valor : 2));
              }}
            />
            {VALORES_RAPIDOS_CREDITO.map((valor) => (
              <button
                key={valor}
                type="button"
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                onClick={() => setValorCredito(formatarValorInput(valor))}
              >
                R$ {valor}
              </button>
            ))}
            <button
              type="button"
              className="btn-primary px-4 py-1.5 text-sm disabled:opacity-60"
              onClick={enviarCredito}
              disabled={enviandoCredito}
            >
              {enviandoCredito ? "Enviando..." : "Enviar"}
            </button>
          </div>
          {mensagemCredito && (
            <p className={`mt-2 text-sm font-semibold ${mensagemCredito.ok ? "text-green-700" : "text-red-600"}`}>
              {mensagemCredito.texto}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h4 className="font-bold text-gray-900">🧾 {admin ? "Transações por período" : "Transações de hoje"}</h4>
            <p className="text-xs text-gray-500">Consulta o CompactPay só quando você clicar.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {admin && (
              <>
                <input
                  type="date"
                  className="input-field w-auto py-1.5 text-sm"
                  value={periodo.inicio}
                  max={periodo.fim}
                  onChange={(e) => e.target.value && setPeriodo((p) => ({ ...p, inicio: e.target.value }))}
                />
                <span className="text-gray-400">até</span>
                <input
                  type="date"
                  className="input-field w-auto py-1.5 text-sm"
                  value={periodo.fim}
                  min={periodo.inicio}
                  max={hoje}
                  onChange={(e) => e.target.value && setPeriodo((p) => ({ ...p, fim: e.target.value }))}
                />
              </>
            )}
            <button
              type="button"
              className="btn-secondary px-4 py-1.5 text-sm disabled:opacity-60"
              onClick={buscarTransacoes}
              disabled={buscandoTransacoes}
            >
              {buscandoTransacoes ? "Buscando..." : "Buscar transações"}
            </button>
          </div>
        </div>

        {transacoes && (
          <>
            <div className="mb-3 flex flex-wrap gap-2 text-sm">
              <Pill className="border-gray-200 bg-white text-gray-800">
                {transacoes.quantidade} pagamentos · {formatarMoeda(transacoes.total)}
              </Pill>
              <Pill className="border-gray-200 bg-white text-gray-600">Pix {formatarMoeda(transacoes.totalPix)}</Pill>
              <Pill className="border-gray-200 bg-white text-gray-600">Cartão {formatarMoeda(transacoes.totalCartao)}</Pill>
              <Pill className="border-gray-200 bg-white text-gray-600">Físico {formatarMoeda(transacoes.totalFisico)}</Pill>
              <Pill className="border-gray-200 bg-white text-gray-600">App {formatarMoeda(transacoes.totalApp)}</Pill>
            </div>
            {!transacoes.transacoes?.length ? (
              <p className="text-sm text-gray-500">Nenhuma transação no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <th className="px-3 py-2">Data</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Pulso</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                      <th className="px-3 py-2 text-center">Devolução</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transacoes.transacoes.map((t) => {
                      const pulso = descreverPulso(t.pulsoStatus);
                      return (
                        <tr key={t.id} className="border-b align-top">
                          <td className="px-3 py-2 font-mono text-xs text-gray-600">{formatarDataHora(t.data)}</td>
                          <td className="px-3 py-2">{t.tipo}</td>
                          <td className="px-3 py-2">
                            <Pill className={classesStatusVenda(t.status)}>{t.status || "-"}</Pill>
                          </td>
                          <td className="px-3 py-2">
                            <Pill className={pulso.className}>{pulso.label}</Pill>
                            {pulso.label === "Falha" && (
                              <span className="mt-1 block text-xs text-gray-500">{t.pulsoStatus}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">{formatarMoeda(t.valor)}</td>
                          <td className="px-3 py-2 text-center">
                            {t.podeDevolver ? (
                              <button
                                type="button"
                                className="rounded-lg bg-red-500 px-3 py-1 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-60"
                                onClick={() => devolver(t)}
                                disabled={devolvendoId === t.id}
                              >
                                {devolvendoId === t.id ? "Devolvendo..." : "Devolver"}
                              </button>
                            ) : t.jaDevolvido ? (
                              <Pill className="border-red-300 bg-red-100 text-red-800">Devolvido</Pill>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Diagnóstico técnico da placa (log que ela manda por MQTT)
// ---------------------------------------------------------------------------

function DiagnosticoPlaca({ compactPayId }) {
  const [aberto, setAberto] = useState(false);
  const { dados, loading, erro } = useConsulta(
    aberto ? `/compact-pay/monitor/maquinas/${compactPayId}/eventos` : null,
    {},
  );

  if (!aberto) {
    return (
      <button type="button" className="btn-secondary px-4 py-1.5 text-sm" onClick={() => setAberto(true)}>
        🔧 Ver diagnóstico da placa
      </button>
    );
  }

  return (
    <div>
      <h4 className="mb-2 font-bold text-gray-900">🔧 Diagnóstico da placa</h4>
      {erro && (
        <AlertBox
          type="warning"
          message={`${erro} (no CompactPay esse log é só para administradores — o usuário de integração precisa ser admin).`}
        />
      )}
      {loading && !dados ? (
        <LoadingSpinner />
      ) : dados?.eventos?.length ? (
        <ul className="max-h-72 divide-y overflow-y-auto rounded-xl border font-mono text-xs">
          {dados.eventos.map((e) => (
            <li key={e.id} className="flex gap-3 px-3 py-1.5">
              <span className="shrink-0 text-gray-500">{formatarDataHora(e.data)}</span>
              <span className="break-all text-gray-800">{e.descricao}</span>
            </li>
          ))}
        </ul>
      ) : (
        !erro && <p className="text-sm text-gray-500">Nenhum evento registrado.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal: detalhe de uma máquina
// ---------------------------------------------------------------------------

function DetalheMaquina({ maquina: m, onClose }) {
  const [dias, setDias] = useState(30);
  const fim = dataBrasil();
  const { dados, loading, erro } = useConsulta(m ? "/compact-pay/monitor/quedas" : null, {
    compactPayId: m?.compactPayId,
    dataInicio: somarDias(fim, -(dias - 1)),
    dataFim: fim,
  });

  const quedas = useMemo(() => dados?.quedas || [], [dados]);
  const totalQuedas = dados?.totalPorMaquina?.[m?.compactPayId] || 0;
  const serie = useMemo(() => {
    const porDia = new Map();
    for (let dia = somarDias(fim, -(dias - 1)); dia <= fim; dia = somarDias(dia, 1)) {
      porDia.set(dia, { data: dia, dia: formatarDataCurta(dia), quedas: 0 });
    }
    for (const q of quedas) {
      const item = porDia.get(dataBrasil(new Date(q.data)));
      if (item) item.quedas += 1;
    }
    return [...porDia.values()];
  }, [quedas, dias, fim]);
  const piorDia = serie.reduce((pior, d) => (!pior || d.quedas > pior.quedas ? d : pior), null);
  const segundosOffline = quedas.reduce((acc, q) => acc + (q.duracaoOfflineSegundos || 0), 0);
  const maiorOffline = quedas.reduce((maior, q) => Math.max(maior, q.duracaoOfflineSegundos || 0), 0);

  if (!m) return null;

  return (
    <Modal isOpen onClose={onClose} title={`${m.codigo}${m.nome ? ` · ${m.nome}` : ""}`} size="xl">
      <div className="max-h-[75vh] space-y-5 overflow-y-auto pr-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={m.status} />
          <QuedasPill quedas={m.quedasHoje} />
          <WifiPill maquina={m} />
          {m.firmwareVersao && (
            <Pill className="border-blue-200 bg-blue-50 text-blue-800">Firmware v{m.firmwareVersao}</Pill>
          )}
          <Pill className="border-gray-200 bg-gray-50 text-gray-700">Placa {m.compactPayId}</Pill>
          {m.lojaNome && <Pill className="border-primary/30 bg-primary/10 text-amber-800">{m.lojaNome}</Pill>}
          {m.nomeCompactPay && m.nomeCompactPay !== m.nome && (
            <Pill className="border-gray-200 bg-gray-50 text-gray-600">No CompactPay: {m.nomeCompactPay}</Pill>
          )}
        </div>

        {!m.encontrada && (
          <AlertBox
            type="warning"
            message="Esta placa não aparece no CompactPay para o usuário de integração. Confira o ID CompactPay no cadastro da máquina."
          />
        )}
        {m.alertas.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {m.alertas.map((t) => (
              <Pill key={t} className="border-orange-300 bg-orange-100 text-orange-800">
                ⚠️ {TIPO_ALERTA[t] || t}
              </Pill>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            titulo={m.online ? "Situação" : "Offline há"}
            valor={m.online ? "No ar" : m.offlineHaMinutos !== null ? formatarDuracao(m.offlineHaMinutos) : "?"}
            detalhe={m.ultimoSinal ? `Último sinal ${formatarDataHora(m.ultimoSinal)}` : "Sem sinal registrado"}
            icone={STATUS_INFO[m.status]?.icone}
          />
          <KpiCard
            titulo="Último pagamento"
            valor={m.ultimoPagamento?.data ? formatarDataHora(m.ultimoPagamento.data) : "Sem registro"}
            detalhe={m.ultimoPagamento ? `${formatarMoeda(m.ultimoPagamento.valor)} · ${m.ultimoPagamento.tipo}` : null}
            icone="🧾"
          />
          <KpiCard titulo="Faturamento hoje" valor={formatarMoeda(m.faturamentoHoje)} icone="💰" />
          <KpiCard
            titulo="Wi-Fi"
            valor={m.wifiQualidade !== null ? `${m.wifiQualidade}%` : "-"}
            detalhe={m.wifiRssi !== null ? `${m.wifiRssi} dBm · ${WIFI_INFO[m.wifiStatus]?.label}` : null}
            icone="📶"
          />
        </div>

        <div className="grid grid-cols-1 gap-2 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <span>
            <b>Firmware:</b> {m.firmwareVersao ? `v${m.firmwareVersao}` : "-"}
            {m.firmwareAlerta && ` → ${m.firmwareAlvo || "?"} (${m.firmwareStatus || "pendente"})`}
          </span>
          <span>
            <b>Ligada há:</b> {formatarSegundos(m.uptimeSegundos)}
          </span>
          <span>
            <b>Último reset:</b> {m.ultimoReset || "-"}
          </span>
          <span>
            <b>Reconexões:</b> Wi-Fi {m.reconexoesWifi ?? "-"} · MQTT {m.reconexoesMqtt ?? "-"}
          </span>
          <span>
            <b>Desconexões Wi-Fi:</b> {m.desconexoesWifi ?? "-"}
            {m.motivoDesconexaoWifi !== null && ` (código ${m.motivoDesconexaoWifi})`}
          </span>
          <span>
            <b>Memória livre:</b> {m.memoriaLivre !== null ? `${Math.round(m.memoriaLivre / 1024)} KB` : "-"}
          </span>
          <span>
            <b>Último pulso:</b>{" "}
            {m.ultimoPulso ? `${descreverPulso(m.ultimoPulso.status).label} · ${formatarDataHora(m.ultimoPulso.data)}` : "-"}
          </span>
          <span>
            <b>Pulsos curtos:</b> {m.pulsosCurtos ?? "-"}
          </span>
          <span>
            <b>Último reinício automático:</b>{" "}
            {m.ultimoReinicioForcado
              ? `${m.ultimoReinicioForcado.motivo} · ${formatarDataHora(m.ultimoReinicioForcado.data)}`
              : "-"}
          </span>
        </div>

        <AcoesCompactPay maquina={m} />

        <div className="flex items-center justify-between">
          <h4 className="font-bold text-gray-900">Histórico de quedas</h4>
          <select className="input-field w-auto py-1 text-sm" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>
        </div>

        {erro && <AlertBox type="error" message={erro} />}
        {loading && !dados ? (
          <LoadingSpinner />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiCard titulo="Quedas no período" valor={totalQuedas} icone="⚡" cor="text-orange-600" />
              <KpiCard
                titulo="Dias com queda"
                valor={`${serie.filter((d) => d.quedas > 0).length}/${serie.length}`}
                icone="📅"
              />
              <KpiCard
                titulo="Pior dia"
                valor={piorDia?.quedas ? `${piorDia.quedas}x` : "-"}
                detalhe={piorDia?.quedas ? formatarDataCurta(piorDia.data) : null}
                icone="😟"
              />
              <KpiCard
                titulo="Tempo offline"
                valor={formatarSegundos(segundosOffline)}
                detalhe={`maior: ${formatarSegundos(maiorOffline)}`}
                icone="⏱️"
              />
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={serie}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="dia" fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Bar dataKey="quedas" name="Quedas" radius={[4, 4, 0, 0]}>
                  {serie.map((d) => (
                    <Cell
                      key={d.data}
                      fill={d.quedas >= 5 ? "#dc2626" : d.quedas >= 3 ? "#f97316" : d.quedas >= 1 ? "#facc15" : "#22c55e"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {!quedas.length ? (
              <p className="text-sm text-gray-500">Nenhuma queda neste período. 🎉</p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {quedas.map((q) => (
                  <li key={q.id} className="flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:items-start sm:gap-3">
                    <span className="w-28 shrink-0 font-mono text-xs text-gray-500">{formatarDataHora(q.data)}</span>
                    <CategoriaPill queda={q} />
                    <div className="min-w-0 flex-1">
                      <p className="text-gray-700">{q.motivo}</p>
                      <DetalhesQueda queda={q} />
                    </div>
                    <span className="shrink-0 text-xs text-gray-500">
                      {q.reconectouEm ? `${formatarSegundos(q.duracaoOfflineSegundos)} fora` : "ainda não voltou"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <DiagnosticoPlaca compactPayId={m.compactPayId} />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

const ABAS = [
  ["maquinas", "🛠️ Máquinas"],
  ["alertas", "🚨 Alertas"],
  ["ranking", "🏆 Ranking de quedas"],
  ["graficos", "📊 Gráficos"],
  ["historico", "🕒 Histórico de quedas"],
  ["ajuda", "❓ Como ler"],
];

export function CompactPay() {
  const hoje = dataBrasil();
  const [aba, setAba] = useState("maquinas");
  const [statusMaquinas, setStatusMaquinas] = useState("problemas");
  const [comQuedaMaquinas, setComQuedaMaquinas] = useState(false);

  const [busca, setBusca] = useState("");
  const [lojaId, setLojaId] = useState("");
  const [wifi, setWifi] = useState("");
  const [periodo, setPeriodo] = useState({ inicio: hoje, fim: hoje });

  const [lojas, setLojas] = useState([]);
  const [painel, setPainel] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erroPainel, setErroPainel] = useState("");
  const [maquinaAbertaId, setMaquinaAbertaId] = useState(null);

  useEffect(() => {
    api
      .get("/lojas")
      .then((res) => setLojas(Array.isArray(res.data) ? res.data : res.data?.lojas || []))
      .catch(() => setLojas([]));
  }, []);

  const carregarPainel = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      const res = await api.get("/compact-pay/monitor/painel");
      setPainel(res.data);
      setErroPainel("");
    } catch (error) {
      setErroPainel(mensagemErro(error, "Erro ao consultar o CompactPay"));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarPainel();
    const timer = setInterval(() => carregarPainel(true), ATUALIZAR_A_CADA_MS);
    return () => clearInterval(timer);
  }, [carregarPainel]);

  const maquinas = useMemo(() => {
    const termo = busca
      .trim()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
    return (painel?.maquinas || []).filter((m) => {
      if (lojaId && String(m.lojaId) !== String(lojaId)) return false;
      if (wifi && m.wifiStatus !== wifi) return false;
      if (termo) {
        const alvo = [m.codigo, m.nome, m.nomeCompactPay, m.compactPayId, m.lojaNome, m.localizacao]
          .join(" ")
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [painel, busca, lojaId, wifi]);

  const maquinasPorPlaca = useMemo(() => new Map(maquinas.map((m) => [m.compactPayId, m])), [maquinas]);
  const maquinaAberta = (painel?.maquinas || []).find((m) => m.maquinaId === maquinaAbertaId) || null;
  const alertasFiltrados = (painel?.alertas || []).filter((a) => maquinasPorPlaca.has(a.compactPayId));

  const contar = (fn) => maquinas.filter(fn).length;
  const somar = (campo) => maquinas.reduce((acc, m) => acc + (m[campo] || 0), 0);
  const pioresHoje = [...maquinas].filter((m) => m.quedasHoje > 0).sort((a, b) => b.quedasHoje - a.quedasHoje).slice(0, 5);

  const irParaMaquinas = (status, comQueda = false) => {
    setStatusMaquinas(status);
    setComQuedaMaquinas(comQueda);
    setAba("maquinas");
  };

  const presetsPeriodo = [
    ["Hoje", hoje, hoje],
    ["Ontem", somarDias(hoje, -1), somarDias(hoje, -1)],
    ["7 dias", somarDias(hoje, -6), hoje],
    ["30 dias", somarDias(hoje, -29), hoje],
  ];
  const temFiltros = busca || lojaId || wifi;
  const lojasComPlaca = lojas.filter((l) => (painel?.maquinas || []).some((m) => String(m.lojaId) === String(l.id)));

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="CompactPay"
          subtitle="Saúde das placas: quem está offline, por que caiu, Wi-Fi, firmware e o histórico de cada máquina."
          icon="📟"
          action={
            <div className="flex flex-col items-stretch gap-1 sm:items-end">
              <button
                onClick={() => carregarPainel()}
                disabled={carregando}
                className="btn-primary flex items-center justify-center gap-2 disabled:opacity-70"
              >
                <span className={carregando ? "animate-spin" : ""}>🔄</span>
                {carregando ? "Consultando..." : "Atualizar agora"}
              </button>
              <span className="text-xs text-gray-500">
                {painel?.atualizadoEm
                  ? `Atualizado há ${tempoDesde(painel.atualizadoEm)} · automático a cada minuto`
                  : "Consultando o CompactPay..."}
              </span>
            </div>
          }
        />

        {erroPainel && (
          <AlertBox type="error" title="Problema" message={erroPainel} onClose={() => setErroPainel("")} />
        )}

        {painel && !painel.maquinas.length ? (
          <Vazio
            icone="📟"
            mensagem="Nenhuma máquina com ID CompactPay. Cadastre o ID da placa no formulário da máquina."
          />
        ) : (
          <>
            {/* Filtros */}
            <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600 lg:col-span-2">
                  🔎 Buscar máquina, placa ou loja
                  <input
                    className="input-field"
                    placeholder="Ex: M01, 1000, nome da loja..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
                  🏪 Loja
                  <select className="input-field" value={lojaId} onChange={(e) => setLojaId(e.target.value)}>
                    <option value="">Todas as lojas</option>
                    {lojasComPlaca.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
                  📶 Wi-Fi
                  <select className="input-field" value={wifi} onChange={(e) => setWifi(e.target.value)}>
                    <option value="">Qualquer sinal</option>
                    {Object.entries(WIFI_INFO).map(([valor, info]) => (
                      <option key={valor} value={valor}>
                        {info.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-col gap-1 text-xs font-semibold text-gray-600 lg:col-span-3">
                  📅 Período (ranking, gráficos e histórico)
                  <div className="flex flex-wrap items-center gap-2">
                    {presetsPeriodo.map(([label, inicio, fim]) => (
                      <button
                        key={label}
                        onClick={() => setPeriodo({ inicio, fim })}
                        className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                          periodo.inicio === inicio && periodo.fim === fim
                            ? "border-primary bg-primary text-white"
                            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                    <input
                      type="date"
                      className="input-field w-auto py-1.5 text-sm"
                      value={periodo.inicio}
                      max={periodo.fim}
                      onChange={(e) => e.target.value && setPeriodo((p) => ({ ...p, inicio: e.target.value }))}
                    />
                    <span className="text-gray-400">até</span>
                    <input
                      type="date"
                      className="input-field w-auto py-1.5 text-sm"
                      value={periodo.fim}
                      min={periodo.inicio}
                      max={hoje}
                      onChange={(e) => e.target.value && setPeriodo((p) => ({ ...p, fim: e.target.value }))}
                    />
                  </div>
                </div>
                {temFiltros && (
                  <div className="flex items-end">
                    <button
                      className="text-sm font-medium text-amber-700 hover:underline"
                      onClick={() => {
                        setBusca("");
                        setLojaId("");
                        setWifi("");
                      }}
                    >
                      Limpar filtros
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* Indicadores */}
            {!painel ? (
              <LoadingSpinner message="Consultando as placas..." />
            ) : (
              <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                <KpiCard
                  titulo="Máquinas"
                  valor={maquinas.length}
                  detalhe={`${contar((m) => !m.encontrada)} não encontradas no CompactPay`}
                  icone="📟"
                  onClick={() => irParaMaquinas("todas")}
                  ativo={aba === "maquinas" && statusMaquinas === "todas" && !comQuedaMaquinas}
                />
                <KpiCard
                  titulo="Online"
                  valor={contar((m) => m.online)}
                  detalhe={
                    maquinas.length ? `${Math.round((contar((m) => m.online) / maquinas.length) * 100)}% no ar` : null
                  }
                  icone="🟢"
                  cor="text-green-600"
                  onClick={() => irParaMaquinas("online")}
                  ativo={aba === "maquinas" && statusMaquinas === "online" && !comQuedaMaquinas}
                />
                <KpiCard
                  titulo="Atenção"
                  valor={contar((m) => m.status === "atencao")}
                  detalhe="No ar, mas com Wi-Fi, firmware ou pulso"
                  icone="🟡"
                  cor="text-yellow-600"
                  onClick={() => irParaMaquinas("problemas")}
                  ativo={aba === "maquinas" && statusMaquinas === "problemas" && !comQuedaMaquinas}
                />
                <KpiCard
                  titulo="Offline agora"
                  valor={contar((m) => !m.online)}
                  detalhe="Clique para ver a lista"
                  icone="🔴"
                  cor="text-red-600"
                  onClick={() => irParaMaquinas("offline")}
                  ativo={aba === "maquinas" && statusMaquinas === "offline" && !comQuedaMaquinas}
                />
                <KpiCard
                  titulo="Quedas hoje"
                  valor={somar("quedasHoje")}
                  detalhe={`${contar((m) => m.quedasHoje > 0)} máquinas caíram`}
                  icone="⚡"
                  cor="text-orange-600"
                  onClick={() => irParaMaquinas("todas", true)}
                  ativo={aba === "maquinas" && comQuedaMaquinas}
                />
                <KpiCard
                  titulo="Alertas críticos"
                  valor={alertasFiltrados.filter((a) => a.severidade === "critico").length}
                  detalhe={`${alertasFiltrados.length} alertas no total`}
                  icone="🚨"
                  cor="text-red-700"
                  onClick={() => setAba("alertas")}
                  ativo={aba === "alertas"}
                />
                <KpiCard
                  titulo="Wi-Fi ruim"
                  valor={contar((m) => m.wifiStatus === "ruim")}
                  detalhe="Clique para filtrar"
                  icone="📶"
                  cor="text-orange-600"
                  onClick={() => {
                    setWifi("ruim");
                    irParaMaquinas("todas");
                  }}
                />
                <KpiCard
                  titulo="Faturamento hoje"
                  valor={formatarMoeda(somar("faturamentoHoje"))}
                  detalhe={`${contar((m) => m.pulsoAlerta)} com pulso falhando · ${contar((m) => m.firmwareAlerta)} firmware pendente`}
                  icone="💰"
                  cor="text-amber-700"
                />
              </div>
            )}

            {pioresHoje.length > 0 && aba !== "ranking" && (
              <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                <p className="mb-2 text-sm font-bold text-orange-900">⚠️ Quem mais caiu hoje</p>
                <div className="flex flex-wrap gap-2">
                  {pioresHoje.map((m) => (
                    <button
                      key={m.maquinaId}
                      onClick={() => setMaquinaAbertaId(m.maquinaId)}
                      className="flex items-center gap-2 rounded-full border border-orange-200 bg-white px-3 py-1 text-sm hover:shadow"
                    >
                      <QuedasPill quedas={m.quedasHoje} />
                      <span className="max-w-[220px] truncate">{nomeMaquina(m)}</span>
                      {!m.online && <span title="Offline agora">🔴</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Abas */}
            <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
              {ABAS.map(([valor, label]) => (
                <button
                  key={valor}
                  onClick={() => setAba(valor)}
                  className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                    aba === valor ? "bg-primary text-white shadow" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {label}
                  {valor === "alertas" && alertasFiltrados.length > 0 && (
                    <span className="ml-1 rounded-full bg-red-600 px-1.5 text-xs text-white">{alertasFiltrados.length}</span>
                  )}
                </button>
              ))}
            </div>

            {painel && aba === "maquinas" && (
              <AbaMaquinas
                maquinas={maquinas}
                onAbrirMaquina={setMaquinaAbertaId}
                status={statusMaquinas}
                setStatus={setStatusMaquinas}
                comQueda={comQuedaMaquinas}
                setComQueda={setComQuedaMaquinas}
              />
            )}
            {painel && aba === "alertas" && (
              <AbaAlertas
                alertas={painel.alertas}
                maquinasPorPlaca={maquinasPorPlaca}
                onAbrirMaquina={setMaquinaAbertaId}
              />
            )}
            {painel && aba === "ranking" && (
              <AbaRanking maquinas={maquinas} periodo={periodo} onAbrirMaquina={setMaquinaAbertaId} />
            )}
            {painel && aba === "graficos" && <AbaGraficos maquinas={maquinas} periodo={periodo} />}
            {painel && aba === "historico" && (
              <AbaHistorico maquinasPorPlaca={maquinasPorPlaca} periodo={periodo} onAbrirMaquina={setMaquinaAbertaId} />
            )}
            {aba === "ajuda" && <AbaAjuda />}
          </>
        )}
      </main>

      <DetalheMaquina key={maquinaAbertaId} maquina={maquinaAberta} onClose={() => setMaquinaAbertaId(null)} />

      <Footer />
    </div>
  );
}

export default CompactPay;
