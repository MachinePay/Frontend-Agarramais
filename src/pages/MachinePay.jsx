import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
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

const SINAL_INFO = {
  OTIMO: { label: "Ótimo", className: "bg-green-100 text-green-800 border-green-300", cor: "#22c55e" },
  BOM: { label: "Bom", className: "bg-lime-100 text-lime-800 border-lime-300", cor: "#84cc16" },
  FRACO: { label: "Fraco", className: "bg-orange-100 text-orange-800 border-orange-300", cor: "#f97316" },
  RUIM: { label: "Ruim", className: "bg-red-100 text-red-800 border-red-300", cor: "#ef4444" },
  SEM_SINAL: { label: "Não informado", className: "bg-gray-100 text-gray-600 border-gray-300", cor: "#9ca3af" },
};

const TIPOS_LEITOR = ["WEBSOCKET", "MQTT LITE", "MQTT Avançada"];

const MODO_RESPOSTA = {
  MQTT_INSTANTANEO: "MQTT Instantâneo",
  MQTT_CONFIRMADO: "MQTT Confirmado",
  SEM_RESPOSTA: "Sem resposta",
};

const TIPO_EVENTO = {
  QUEDA: { label: "Caiu e voltou", icone: "⚡", className: "bg-orange-100 text-orange-800 border-orange-300" },
  OFFLINE: { label: "Ficou offline", icone: "🔴", className: "bg-red-100 text-red-800 border-red-300" },
  ONLINE: { label: "Voltou online", icone: "🟢", className: "bg-green-100 text-green-800 border-green-300" },
};

const nivelQuedas = (quedas) => {
  if (quedas >= 5) return { label: "Crítico", className: "bg-red-600 text-white" };
  if (quedas >= 3) return { label: "Instável", className: "bg-orange-500 text-white" };
  if (quedas >= 1) return { label: "Atenção", className: "bg-yellow-300 text-yellow-900" };
  return { label: "Estável", className: "bg-green-500 text-white" };
};

const dataBrasil = (data = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(data);

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

const tempoDesde = (valor) =>
  valor ? formatarDuracao(Math.round((Date.now() - new Date(valor).getTime()) / 60000)) : null;

const textoUltimaVenda = (m) => {
  if (m.ultimaVendaHoje) return `Hoje às ${m.ultimaVendaHoje.hora}`;
  if (m.ultimaVendaOntem) return `Ontem às ${m.ultimaVendaOntem.hora}`;
  if (m.ultimaVendaAnterior)
    return `${m.ultimaVendaAnterior.data} às ${m.ultimaVendaAnterior.hora}`;
  return "Sem registro";
};

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

function StatusPill({ online }) {
  return online ? (
    <Pill className="border-green-300 bg-green-100 text-green-800">🟢 Online</Pill>
  ) : (
    <Pill className="border-red-300 bg-red-100 text-red-800">🔴 Offline</Pill>
  );
}

function SinalPill({ sinal }) {
  const info = SINAL_INFO[sinal] || SINAL_INFO.SEM_SINAL;
  return <Pill className={info.className}>📶 {info.label}</Pill>;
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

function NomePonto({ maquina, onAbrir }) {
  return (
    <button type="button" onClick={onAbrir} className="text-left hover:underline">
      <span className="block font-semibold text-gray-900">{maquina.nomePonto || "Sem nome"}</span>
      <span className="block text-xs text-gray-500">
        Caixa {maquina.posId}
        {maquina.vinculo && (
          <>
            {" · "}
            <span className="text-amber-700">
              {maquina.vinculo.codigo}
              {maquina.vinculo.lojaNome ? ` · ${maquina.vinculo.lojaNome}` : ""}
            </span>
          </>
        )}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Aba: Máquinas (offline por padrão)
// ---------------------------------------------------------------------------

function AbaMaquinas({ filtrosQuery, onAbrirMaquina, status, setStatus, comQueda, setComQueda }) {
  const [ordenar, setOrdenar] = useState("");
  const [page, setPage] = usePagina(JSON.stringify([filtrosQuery, status, comQueda, ordenar]));
  const { dados, loading, erro } = useConsulta("/machine-pay/monitor/maquinas", {
    ...filtrosQuery,
    status,
    comQueda: comQueda ? "true" : undefined,
    ordenar: ordenar || undefined,
    page,
    limit: TAMANHO_PAGINA,
  });

  const maquinas = dados?.maquinas || [];

  return (
    <Secao
      titulo={
        status === "offline"
          ? "🔴 Máquinas offline agora"
          : status === "online"
            ? "🟢 Máquinas online"
            : "📋 Todas as máquinas"
      }
      descricao={
        status === "offline"
          ? "Só as que estão fora do ar neste momento. As que estão offline há mais tempo aparecem primeiro."
          : "Clique no nome do ponto para ver o histórico completo da máquina."
      }
      acao={
        <div className="flex flex-wrap gap-2">
          <div className="flex overflow-hidden rounded-lg border border-gray-200">
            {[
              ["offline", "🔴 Offline"],
              ["online", "🟢 Online"],
              ["todas", "Todas"],
            ].map(([valor, label]) => (
              <button
                key={valor}
                onClick={() => setStatus(valor)}
                className={`px-3 py-1.5 text-sm font-medium ${
                  status === valor ? "bg-primary text-white" : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm">
            <input type="checkbox" checked={comQueda} onChange={(e) => setComQueda(e.target.checked)} />
            Só com queda hoje
          </label>
          <select
            className="input-field w-auto py-1.5 text-sm"
            value={ordenar}
            onChange={(e) => setOrdenar(e.target.value)}
          >
            <option value="">Ordem padrão</option>
            <option value="offline">Offline há mais tempo</option>
            <option value="quedas">Mais quedas hoje</option>
            <option value="sinal">Pior sinal primeiro</option>
            <option value="vendas">Mais vendas hoje</option>
            <option value="nome">Número da loja</option>
          </select>
        </div>
      }
    >
      {erro && <AlertBox type="error" message={erro} />}
      {loading && !dados ? (
        <LoadingSpinner message="Carregando máquinas..." />
      ) : maquinas.length === 0 ? (
        <Vazio
          icone={status === "offline" ? "🎉" : "📭"}
          mensagem={
            status === "offline"
              ? "Nenhuma máquina offline com esses filtros. Tudo no ar!"
              : "Nenhuma máquina encontrada com esses filtros."
          }
        />
      ) : (
        <>
          <p className="mb-2 text-sm text-gray-500">
            {dados.total} máquina{dados.total === 1 ? "" : "s"} {loading && "· atualizando..."}
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <th className="px-3 py-2">Ponto / Caixa</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">{status === "offline" ? "Offline há" : "Quedas hoje"}</th>
                  <th className="px-3 py-2">Última venda</th>
                  <th className="px-3 py-2">Sinal</th>
                  <th className="px-3 py-2">Versão</th>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2 text-right">Vendas hoje</th>
                </tr>
              </thead>
              <tbody>
                {maquinas.map((m) => (
                  <tr
                    key={m.posId}
                    className={`border-b align-top hover:bg-gray-50 ${m.online ? "" : "bg-red-50/40"}`}
                  >
                    <td className="px-3 py-2">
                      <NomePonto maquina={m} onAbrir={() => onAbrirMaquina(m.posId)} />
                      {m.desativada && (
                        <Pill className="mt-1 border-gray-300 bg-gray-100 text-gray-600">Desativado</Pill>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill online={m.online} />
                      {m.telemetria && m.telemetria !== "Consultado" && (
                        <span className="mt-1 block text-xs text-gray-500">{m.telemetria}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {status === "offline" ? (
                        <>
                          <span className="font-semibold text-red-700">
                            {m.offlineDesde
                              ? formatarDuracao(m.offlineHaMinutos)
                              : "Antes do monitoramento"}
                          </span>
                          {m.offlineDesde && (
                            <span className="block text-xs text-gray-500">
                              desde {formatarDataHora(m.offlineDesde)}
                            </span>
                          )}
                          {m.quedasHoje > 0 && (
                            <span className="mt-1 block">
                              <QuedasPill quedas={m.quedasHoje} />
                            </span>
                          )}
                        </>
                      ) : (
                        <QuedasPill quedas={m.quedasHoje} />
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{textoUltimaVenda(m)}</td>
                    <td className="px-3 py-2">
                      <SinalPill sinal={m.sinalWifi} />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      <span className="font-semibold">{m.tipoVersao || "?"}</span> v{m.versao}
                      <span className="block text-gray-500">{MODO_RESPOSTA[m.modoResposta]}</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-600">{m.ip || "-"}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="font-semibold">{formatarMoeda(m.vendasHojeValor)}</span>
                      <span className="block text-xs text-gray-500">{m.vendasHojeQtd} vendas</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacao page={dados.page} totalPages={dados.totalPages} onChange={setPage} />
        </>
      )}
    </Secao>
  );
}

// ---------------------------------------------------------------------------
// Aba: Ranking de quedas
// ---------------------------------------------------------------------------

function AbaRanking({ filtrosQuery, periodo, onAbrirMaquina }) {
  const [ordem, setOrdem] = useState("pior");
  const [paginasVisiveis, setPaginasVisiveis] = usePagina(JSON.stringify([filtrosQuery, periodo]));
  const mostrar = paginasVisiveis * TAMANHO_PAGINA;
  const { dados, loading, erro } = useConsulta("/machine-pay/monitor/ranking-quedas", {
    ...filtrosQuery,
    dataInicio: periodo.inicio,
    dataFim: periodo.fim,
  });

  const ranking = useMemo(() => {
    const lista = dados?.ranking || [];
    return ordem === "pior" ? lista : [...lista].reverse();
  }, [dados, ordem]);
  const maiorQueda = Math.max(1, ...ranking.map((r) => r.quedas));
  const umDia = periodo.inicio === periodo.fim;

  return (
    <Secao
      titulo="🏆 Ranking de quedas"
      descricao={`Quantas vezes cada máquina caiu ${
        umDia ? `em ${formatarDataCurta(periodo.inicio)}` : `de ${formatarDataCurta(periodo.inicio)} a ${formatarDataCurta(periodo.fim)}`
      }. Empate é desempatado pelo tempo que ficou offline.`}
      acao={
        <div className="flex overflow-hidden rounded-lg border border-gray-200">
          {[
            ["pior", "😟 Pior → melhor"],
            ["melhor", "😄 Melhor → pior"],
          ].map(([valor, label]) => (
            <button
              key={valor}
              onClick={() => setOrdem(valor)}
              className={`px-3 py-1.5 text-sm font-medium ${
                ordem === valor ? "bg-primary text-white" : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      {erro && <AlertBox type="error" message={erro} />}
      {loading && !dados ? (
        <LoadingSpinner message="Montando ranking..." />
      ) : !ranking.length ? (
        <Vazio mensagem="Ainda não há dados de quedas para este período. O histórico começa a ser gravado a partir do dia em que o monitoramento foi ligado." />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard titulo="Total de quedas" valor={dados.totalQuedas} icone="⚡" cor="text-orange-600" />
            <KpiCard titulo="Máquinas que caíram" valor={dados.maquinasComQueda} icone="📉" cor="text-red-600" />
            <KpiCard titulo="Sem nenhuma queda" valor={dados.maquinasSemQueda} icone="✅" cor="text-green-600" />
            <KpiCard titulo="Média por máquina" valor={dados.mediaQuedasPorMaquina} icone="➗" />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Ponto / Caixa</th>
                  <th className="px-3 py-2">Quedas</th>
                  {!umDia && <th className="px-3 py-2">Dias com queda</th>}
                  {!umDia && <th className="px-3 py-2">Pior dia</th>}
                  <th className="px-3 py-2">Ficou offline</th>
                  <th className="px-3 py-2">Agora</th>
                </tr>
              </thead>
              <tbody>
                {ranking.slice(0, mostrar).map((r) => (
                  <tr key={r.posId} className="border-b align-top hover:bg-gray-50">
                    <td className="px-3 py-2 font-bold text-gray-500">
                      {r.posicao <= 3 && ordem === "pior" ? ["🥇", "🥈", "🥉"][r.posicao - 1] : `${r.posicao}º`}
                    </td>
                    <td className="px-3 py-2">
                      <NomePonto maquina={r} onAbrir={() => onAbrirMaquina(r.posId)} />
                    </td>
                    <td className="min-w-[180px] px-3 py-2">
                      <div className="flex items-center gap-2">
                        <QuedasPill quedas={r.quedas} />
                        <div className="h-2 flex-1 rounded-full bg-gray-100">
                          <div
                            className={`h-2 rounded-full ${nivelQuedas(umDia ? r.quedas : r.maiorQuedasDia).className.split(" ")[0]}`}
                            style={{ width: `${(r.quedas / maiorQueda) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    {!umDia && (
                      <td className="px-3 py-2">
                        {r.diasComQueda} de {r.diasMonitorados}
                      </td>
                    )}
                    {!umDia && <td className="px-3 py-2">{r.maiorQuedasDia}x</td>}
                    <td className="px-3 py-2">
                      {r.vezesOffline > 0 ? (
                        <>
                          {r.vezesOffline}x
                          <span className="block text-xs text-gray-500">
                            {formatarDuracao(r.minutosOffline)} fora do ar
                          </span>
                        </>
                      ) : r.minutosOffline > 0 ? (
                        <span className="text-xs text-gray-600">{formatarDuracao(r.minutosOffline)} fora do ar</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.online === undefined ? (
                        <span className="text-xs text-gray-400">Removida do painel</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <StatusPill online={r.online} />
                          <SinalPill sinal={r.sinalWifi} />
                        </div>
                      )}
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

function AbaGraficos({ filtrosQuery, periodo, resumo }) {
  // Um gráfico de um dia só não diz nada: expande para os 14 dias até a data final.
  const periodoGrafico =
    periodo.inicio === periodo.fim
      ? { inicio: somarDias(periodo.fim, -13), fim: periodo.fim, expandido: true }
      : periodo;

  const { dados, loading, erro } = useConsulta("/machine-pay/monitor/serie-diaria", {
    ...filtrosQuery,
    dataInicio: periodoGrafico.inicio,
    dataFim: periodoGrafico.fim,
  });

  const serie = (dados?.serie || []).map((d) => ({
    ...d,
    dia: formatarDataCurta(d.data),
    horasOffline: Number((d.minutosOffline / 60).toFixed(1)),
  }));
  const quedasPorHora = (resumo?.quedasPorHoraHoje || []).map((q, hora) => ({
    hora: `${String(hora).padStart(2, "0")}h`,
    quedas: q,
  }));
  const sinais = Object.entries(resumo?.porSinal || {})
    .map(([sinal, total]) => ({ sinal, label: SINAL_INFO[sinal]?.label || sinal, total }))
    .sort((a, b) => Object.keys(SINAL_INFO).indexOf(a.sinal) - Object.keys(SINAL_INFO).indexOf(b.sinal));

  return (
    <>
      {erro && <AlertBox type="error" message={erro} />}
      {resumo?.monitor?.inicioHistorico && (
        <AlertBox
          type="info"
          message={`Histórico gravado pelo sistema desde ${formatarDataCurta(
            resumo.monitor.inicioHistorico,
          )}: dias antes disso aparecem vazios. A Machine Pay só mostra o dia atual, então os gráficos vão se completando com o tempo. Horários têm margem de ${
            resumo.monitor.intervaloMinutos
          } min (intervalo entre as leituras do painel).`}
        />
      )}
      <Secao
        titulo="📈 Quedas por dia"
        descricao={`Soma das quedas de todas as máquinas filtradas${
          periodoGrafico.expandido ? " (últimos 14 dias — escolha um período para mudar)" : ""
        }. Dias sem coleta aparecem zerados.`}
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

      <Secao
        titulo="🔴 Máquinas que ficaram offline por dia"
        descricao="Quantas máquinas passaram algum tempo fora do ar e o total de horas offline somadas."
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={serie}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="dia" fontSize={12} />
            <YAxis yAxisId="esq" allowDecimals={false} fontSize={12} />
            <YAxis yAxisId="dir" orientation="right" fontSize={12} />
            <Tooltip />
            <Legend />
            <Line yAxisId="esq" type="monotone" dataKey="maquinasQueFicaramOffline" name="Máquinas offline" stroke="#ef4444" strokeWidth={2} />
            <Line yAxisId="dir" type="monotone" dataKey="horasOffline" name="Horas offline (soma)" stroke="#a855f7" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Secao>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Secao titulo="⏰ Quedas por hora (hoje)" descricao="Em que horário as máquinas mais caem hoje.">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={quedasPorHora}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="hora" fontSize={11} interval={1} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Bar dataKey="quedas" name="Quedas" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Secao>
        <Secao titulo="📶 Qualidade do sinal Wi-Fi" descricao="Situação atual das máquinas filtradas.">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={sinais} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis type="number" allowDecimals={false} fontSize={12} />
              <YAxis type="category" dataKey="label" width={100} fontSize={12} />
              <Tooltip />
              <Bar dataKey="total" name="Máquinas" radius={[0, 4, 4, 0]}>
                {sinais.map((s) => (
                  <Cell key={s.sinal} fill={SINAL_INFO[s.sinal]?.cor || "#9ca3af"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Secao>
      </div>

      <Secao
        titulo="🧩 Por versão do leitor"
        descricao="Ajuda a ver se alguma versão de firmware cai mais que as outras."
      >
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
              {(resumo?.porVersao || []).map((v) => (
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
// Aba: Linha do tempo (eventos de conexão)
// ---------------------------------------------------------------------------

function AbaEventos({ filtrosQuery, periodo, onAbrirMaquina }) {
  const [tipo, setTipo] = useState("");
  const [page, setPage] = usePagina(JSON.stringify([filtrosQuery, periodo, tipo]));
  const { dados, loading, erro } = useConsulta("/machine-pay/monitor/eventos", {
    ...filtrosQuery,
    dataInicio: periodo.inicio,
    dataFim: periodo.fim,
    tipo: tipo || undefined,
    page,
    limit: TAMANHO_PAGINA,
  });

  return (
    <Secao
      titulo="🕒 Linha do tempo de conexão"
      descricao="Cada vez que uma máquina caiu, ficou offline ou voltou. Mais recentes primeiro."
      acao={
        <select className="input-field w-auto py-1.5 text-sm" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos os eventos</option>
          <option value="QUEDA">⚡ Só quedas</option>
          <option value="OFFLINE">🔴 Só quando ficou offline</option>
          <option value="ONLINE">🟢 Só quando voltou</option>
        </select>
      }
    >
      {erro && <AlertBox type="error" message={erro} />}
      {loading && !dados ? (
        <LoadingSpinner />
      ) : !dados?.eventos?.length ? (
        <Vazio mensagem="Nenhum evento neste período." />
      ) : (
        <>
          <p className="mb-2 text-sm text-gray-500">{dados.total} eventos</p>
          <ul className="divide-y">
            {dados.eventos.map((e) => {
              const info = TIPO_EVENTO[e.tipo];
              return (
                <li key={e.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:gap-4">
                  <span className="w-28 shrink-0 font-mono text-xs text-gray-500">
                    {formatarDataHora(e.dataHora)}
                  </span>
                  <Pill className={info.className}>
                    {info.icone} {info.label}
                  </Pill>
                  <button
                    type="button"
                    onClick={() => onAbrirMaquina(e.posId)}
                    className="text-left font-medium text-gray-900 hover:underline"
                  >
                    {e.nomePonto || `Caixa ${e.posId}`}
                  </button>
                  <span className="text-xs text-gray-500">
                    {e.tipo === "QUEDA" && `contador foi de ${e.quedasAntes}x para ${e.quedasDepois}x`}
                    {e.tipo === "ONLINE" &&
                      (e.duracaoMinutos !== null
                        ? `ficou ${formatarDuracao(e.duracaoMinutos)} fora do ar`
                        : "estava offline antes do monitoramento")}
                  </span>
                </li>
              );
            })}
          </ul>
          <Paginacao page={dados.page} totalPages={dados.totalPages} onChange={setPage} />
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
    ["⚡ Quedas (Nx)", "É o contador que o painel Machine Pay mostra ao lado do botão ON/OFF: quantas vezes o leitor perdeu a conexão e reconectou hoje. Zera à meia-noite."],
    ["🟢 Estável · 🟡 Atenção · 🟠 Instável · 🔴 Crítico", "0 quedas = estável · 1 a 2 = atenção · 3 a 4 = instável · 5 ou mais = crítico (vale ir ao ponto ou trocar o roteador/modem)."],
    ["🔴 Offline", "O leitor não está respondendo ao painel agora. Nesse estado ele não recebe pagamentos PIX ou cartão."],
    ["Offline há…", "Tempo desde que o monitoramento viu a máquina cair. \"Antes do monitoramento\" significa que ela já estava offline quando começamos a acompanhar — use a última venda como referência."],
    ["📶 Sinal Wi-Fi", "Ótimo / Bom / Fraco / Ruim, como informado pelo leitor. \"Não informado\" é normal em leitores WEBSOCKET, que não mandam o sinal."],
    ["MQTT Instantâneo / Confirmado", "Como o leitor recebe o crédito: Instantâneo (WEBSOCKET) ou com confirmação de pulso (MQTT). \"Sem resposta\" = leitor não respondeu a última consulta."],
    ["Desativado", "Pontos com \"DESATIVADO\" no nome ficam escondidos por padrão. Marque \"Incluir desativadas\" nos filtros para vê-los."],
    ["Ranking", "Soma das quedas no período. No empate, quem ficou mais tempo offline fica na frente. Use \"Melhor → pior\" para ver as mais estáveis."],
    ["Histórico", "O painel só mostra o dia de hoje. Este sistema lê o painel automaticamente a cada poucos minutos e guarda o histórico — por isso dias antes do início do monitoramento aparecem vazios."],
    ["Vínculo", "Quando a máquina do sistema tem o \"POS ID Machine Pay\" preenchido no cadastro, o código e a loja dela aparecem junto do ponto, e o filtro por loja passa a funcionar para ela."],
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
// Ações na máquina vinculada: crédito MQTT, transações e devolução
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
  if (texto.includes("devolv")) return "border-red-300 bg-red-100 text-red-800";
  if (texto.includes("aprova")) return "border-green-300 bg-green-100 text-green-800";
  return "border-gray-300 bg-gray-100 text-gray-700";
};

function AcoesMachinePay({ vinculo }) {
  const { isAdmin } = useAuth();
  const admin = isAdmin();
  const hoje = dataBrasil();

  const [valorCredito, setValorCredito] = useState("2,00");
  const [enviandoCredito, setEnviandoCredito] = useState(false);
  const [mensagemCredito, setMensagemCredito] = useState(null);

  const [periodo, setPeriodo] = useState({ inicio: hoje, fim: hoje });
  const [transacoes, setTransacoes] = useState(null);
  const [buscandoTransacoes, setBuscandoTransacoes] = useState(false);
  const [devolvendoId, setDevolvendoId] = useState("");
  const [erro, setErro] = useState("");

  if (!vinculo?.maquinaId) {
    return (
      <AlertBox
        type="info"
        message={'Para enviar crédito, ver transações ou devolver pagamentos, preencha o "POS ID Machine Pay" no cadastro da máquina.'}
      />
    );
  }

  const enviarCredito = async () => {
    const creditos = parseValorCredito(valorCredito);
    if (creditos <= 0) {
      setMensagemCredito({ ok: false, texto: "Informe um valor maior que zero." });
      return;
    }
    setEnviandoCredito(true);
    setMensagemCredito(null);
    try {
      const res = await api.post(`/machine-pay/maquinas/${vinculo.maquinaId}/mqtt-creditos`, { creditos });
      setMensagemCredito({
        ok: true,
        texto: res.data?.sucesso ? "Enviado e gravado no banco!" : "Solicitação enviada para a Machine Pay.",
      });
    } catch (error) {
      setMensagemCredito({ ok: false, texto: mensagemErro(error, "Não foi possível enviar crédito MQTT.") });
    } finally {
      setEnviandoCredito(false);
    }
  };

  const buscarTransacoes = async () => {
    setBuscandoTransacoes(true);
    setErro("");
    try {
      const params = admin ? { inicio: `${periodo.inicio}T00:00`, fim: `${periodo.fim}T23:59` } : {};
      const res = await api.get(`/machine-pay/maquinas/${vinculo.maquinaId}/transacoes-24h`, { params });
      setTransacoes(res.data);
    } catch (error) {
      setErro(mensagemErro(error, "Não foi possível buscar as transações."));
    } finally {
      setBuscandoTransacoes(false);
    }
  };

  const devolver = async (transacao) => {
    if (!transacao.idwebhook) return;
    if (!window.confirm(`Confirma a devolução do pagamento de ${formatarMoeda(transacao.valor)}?`)) return;
    setDevolvendoId(transacao.idwebhook);
    setErro("");
    try {
      await api.post(`/machine-pay/pagamentos/${transacao.idwebhook}/devolver`);
      setTransacoes((atual) => ({
        ...atual,
        transacoes: atual.transacoes.map((t) =>
          t.idwebhook === transacao.idwebhook ? { ...t, jaDevolvido: true, podeDevolver: false } : t,
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

      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
        <h4 className="mb-1 font-bold text-gray-900">💸 Enviar crédito MQTT</h4>
        <p className="mb-3 text-xs text-gray-500">
          Vai para a máquina {vinculo.codigo}
          {vinculo.lojaNome ? ` · ${vinculo.lojaNome}` : ""}.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            className="input-field w-28 py-1.5 text-center"
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
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
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
            {enviandoCredito ? "Enviando..." : "Enviar crédito"}
          </button>
        </div>
        {mensagemCredito && (
          <p className={`mt-2 text-sm font-semibold ${mensagemCredito.ok ? "text-green-700" : "text-red-600"}`}>
            {mensagemCredito.texto}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-gray-100 p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h4 className="font-bold text-gray-900">🧾 {admin ? "Transações por período" : "Transações das últimas 24h"}</h4>
            <p className="text-xs text-gray-500">Consulta a Machine Pay só quando você clicar.</p>
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
            <p className="mb-2 text-sm text-gray-600">
              <b>{transacoes.quantidade}</b> transações · total <b>{formatarMoeda(transacoes.total)}</b>
            </p>
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
                    {transacoes.transacoes.map((t) => (
                      <tr key={t.id} className="border-b align-top">
                        <td className="px-3 py-2 font-mono text-xs text-gray-600">{formatarDataHora(t.data)}</td>
                        <td className="px-3 py-2">{t.tipo}</td>
                        <td className="px-3 py-2">
                          <Pill className={classesStatusVenda(t.status)}>{t.status || "-"}</Pill>
                        </td>
                        <td className="px-3 py-2">
                          <Pill
                            className={
                              t.pulsoConsultado
                                ? "border-green-300 bg-green-100 text-green-800"
                                : "border-red-300 bg-red-100 text-red-800"
                            }
                          >
                            {t.pulsoConsultado ? "Consultado" : "Não consultado"}
                          </Pill>
                          {t.pulsoStatus && <span className="mt-1 block text-xs text-gray-500">{t.pulsoStatus}</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">{formatarMoeda(t.valor)}</td>
                        <td className="px-3 py-2 text-center">
                          {t.podeDevolver ? (
                            <button
                              type="button"
                              className="rounded-lg bg-red-500 px-3 py-1 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-60"
                              onClick={() => devolver(t)}
                              disabled={devolvendoId === t.idwebhook}
                            >
                              {devolvendoId === t.idwebhook ? "Devolvendo..." : "Devolver"}
                            </button>
                          ) : t.jaDevolvido ? (
                            <Pill className="border-red-300 bg-red-100 text-red-800">Devolvido</Pill>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
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
// Modal: detalhe de uma máquina
// ---------------------------------------------------------------------------

function DetalheMaquina({ posId, onClose }) {
  const [dias, setDias] = useState(30);
  const fim = dataBrasil();
  const { dados, loading, erro } = useConsulta(
    posId ? `/machine-pay/monitor/maquinas/${posId}` : null,
    { dataInicio: somarDias(fim, -(dias - 1)), dataFim: fim },
  );

  const m = dados?.maquina;
  const est = dados?.estatisticas;
  const serie = (dados?.dias || []).map((d) => ({ ...d, dia: formatarDataCurta(d.data) }));

  return (
    <Modal isOpen={Boolean(posId)} onClose={onClose} title={dados?.nomePonto || "Máquina"} size="xl">
      {erro && <AlertBox type="error" message={erro} />}
      {loading && !dados ? (
        <LoadingSpinner />
      ) : dados ? (
        <div className="max-h-[75vh] space-y-5 overflow-y-auto pr-1">
          {m ? (
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill online={m.online} />
              <QuedasPill quedas={m.quedasHoje} />
              <SinalPill sinal={m.sinalWifi} />
              <Pill className="border-blue-200 bg-blue-50 text-blue-800">
                {m.tipoVersao} v{m.versao}
              </Pill>
              <Pill className="border-gray-200 bg-gray-50 text-gray-700">Caixa {m.posId}</Pill>
              {m.serial && <Pill className="border-gray-200 bg-gray-50 text-gray-700">Serial {m.serial}</Pill>}
              {m.hibrido && <Pill className="border-green-200 bg-green-50 text-green-700">Híbrido</Pill>}
              {m.vinculo && (
                <Pill className="border-primary/30 bg-primary/10 text-amber-700">
                  {m.vinculo.codigo} · {m.vinculo.lojaNome}
                </Pill>
              )}
            </div>
          ) : (
            <AlertBox type="warning" message="Esta máquina não aparece mais no painel Machine Pay. Abaixo, o histórico guardado." />
          )}

          {m && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiCard
                titulo={m.online ? "Situação" : "Offline há"}
                valor={
                  m.online
                    ? "No ar"
                    : m.offlineDesde
                      ? formatarDuracao(m.offlineHaMinutos)
                      : "?"
                }
                detalhe={m.online ? `Última leitura ${formatarDataHora(m.coletadoEm)}` : m.offlineDesde ? `desde ${formatarDataHora(m.offlineDesde)}` : "Já estava offline no início do monitoramento"}
                icone={m.online ? "🟢" : "🔴"}
              />
              <KpiCard titulo="Última venda" valor={textoUltimaVenda(m)} icone="🧾" />
              <KpiCard
                titulo="Vendas hoje"
                valor={formatarMoeda(m.vendasHojeValor)}
                detalhe={`${m.vendasHojeQtd} vendas`}
                icone="💰"
              />
              <KpiCard
                titulo="Acumulado no painel"
                valor={formatarMoeda(m.totalValor)}
                detalhe={`PIX ${formatarMoeda(m.pix)} · Déb ${formatarMoeda(m.debito)} · Créd ${formatarMoeda(m.credito)}`}
                icone="🏦"
              />
            </div>
          )}

          {m && (
            <div className="grid grid-cols-1 gap-2 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <span><b>IP:</b> <span className="font-mono">{m.ip || "-"}</span></span>
              <span><b>Modo de crédito:</b> {MODO_RESPOSTA[m.modoResposta]}</span>
              <span><b>Telemetria:</b> {m.telemetria || "-"}</span>
              <span><b>Data no equipamento:</b> {m.dataEquipamento || "Não informada"}</span>
              <span><b>Plano:</b> {m.diasVencer !== null ? `${m.diasVencer} dias para vencer` : "-"}</span>
              <span><b>Gateway:</b> {m.gateway || "-"}{m.pagamentoTeste ? " (modo teste)" : ""}</span>
            </div>
          )}

          {m && <AcoesMachinePay vinculo={m.vinculo} />}

          <div className="flex items-center justify-between">
            <h4 className="font-bold text-gray-900">Histórico</h4>
            <select className="input-field w-auto py-1 text-sm" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
            </select>
          </div>

          {est && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiCard titulo="Quedas no período" valor={est.totalQuedas} icone="⚡" cor="text-orange-600" />
              <KpiCard titulo="Dias com queda" valor={`${est.diasComQueda}/${est.diasMonitorados}`} icone="📅" />
              <KpiCard
                titulo="Pior dia"
                valor={est.piorDia ? `${est.piorDia.quedas}x` : "-"}
                detalhe={est.piorDia ? formatarDataCurta(est.piorDia.data) : null}
                icone="😟"
              />
              <KpiCard
                titulo="Tempo offline"
                valor={formatarDuracao(est.minutosOffline)}
                detalhe={`${est.vezesOffline} vez(es) · maior: ${formatarDuracao(est.maiorTempoOfflineMinutos)}`}
                icone="⏱️"
              />
            </div>
          )}

          {serie.length > 0 && (
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
          )}

          <div>
            <h4 className="mb-2 font-bold text-gray-900">Eventos de conexão</h4>
            {!dados.eventos.length ? (
              <p className="text-sm text-gray-500">Nenhum evento registrado neste período.</p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {dados.eventos.map((e) => {
                  const info = TIPO_EVENTO[e.tipo];
                  return (
                    <li key={e.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                      <span className="font-mono text-xs text-gray-500">{formatarDataHora(e.dataHora)}</span>
                      <Pill className={info.className}>
                        {info.icone} {info.label}
                      </Pill>
                      <span className="text-xs text-gray-500">
                        {e.tipo === "QUEDA" && `${e.quedasAntes}x → ${e.quedasDepois}x`}
                        {e.tipo === "ONLINE" && e.duracaoMinutos !== null && `ficou ${formatarDuracao(e.duracaoMinutos)} fora`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

const ABAS = [
  ["maquinas", "🔴 Máquinas"],
  ["ranking", "🏆 Ranking de quedas"],
  ["graficos", "📊 Gráficos"],
  ["eventos", "🕒 Linha do tempo"],
  ["ajuda", "❓ Como ler"],
];

export function MachinePay() {
  const hoje = dataBrasil();
  const [aba, setAba] = useState("maquinas");
  const [statusMaquinas, setStatusMaquinas] = useState("offline");
  const [comQuedaMaquinas, setComQuedaMaquinas] = useState(false);

  const [buscaDigitada, setBuscaDigitada] = useState("");
  const [busca, setBusca] = useState("");
  const [lojaId, setLojaId] = useState("");
  const [sinal, setSinal] = useState("");
  const [tipoVersao, setTipoVersao] = useState("");
  const [incluirDesativadas, setIncluirDesativadas] = useState(false);
  const [periodo, setPeriodo] = useState({ inicio: hoje, fim: hoje });

  const [lojas, setLojas] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [loadingResumo, setLoadingResumo] = useState(false);
  const [erroResumo, setErroResumo] = useState("");
  const [coletando, setColetando] = useState(false);
  const [maquinaAberta, setMaquinaAberta] = useState(null);
  const [versaoDados, setVersaoDados] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setBusca(buscaDigitada.trim()), 400);
    return () => clearTimeout(timer);
  }, [buscaDigitada]);

  useEffect(() => {
    api
      .get("/lojas")
      .then((res) => setLojas(Array.isArray(res.data) ? res.data : res.data?.lojas || []))
      .catch(() => setLojas([]));
  }, []);

  // versaoDados força as abas a recarregarem depois de "Atualizar agora".
  const filtrosQuery = useMemo(
    () => ({
      busca: busca || undefined,
      lojaId: lojaId || undefined,
      sinal: sinal || undefined,
      tipoVersao: tipoVersao || undefined,
      incluirDesativadas: incluirDesativadas ? "true" : undefined,
      _v: versaoDados || undefined,
    }),
    [busca, lojaId, sinal, tipoVersao, incluirDesativadas, versaoDados],
  );

  const carregarResumo = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setLoadingResumo(true);
      try {
        const res = await api.get("/machine-pay/monitor/resumo", { params: filtrosQuery });
        setResumo(res.data);
        setErroResumo("");
      } catch (error) {
        setErroResumo(mensagemErro(error, "Erro ao carregar resumo da Machine Pay"));
      } finally {
        setLoadingResumo(false);
      }
    },
    [filtrosQuery],
  );

  useEffect(() => {
    carregarResumo();
    const timer = setInterval(() => carregarResumo(true), ATUALIZAR_A_CADA_MS);
    return () => clearInterval(timer);
  }, [carregarResumo]);

  const coletarAgora = async () => {
    setColetando(true);
    try {
      await api.post("/machine-pay/monitor/coletar");
      setVersaoDados((v) => v + 1);
    } catch (error) {
      setErroResumo(mensagemErro(error, "Erro ao ler o painel Machine Pay"));
    } finally {
      setColetando(false);
    }
  };

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

  const monitor = resumo?.monitor;
  const temFiltros = busca || lojaId || sinal || tipoVersao || incluirDesativadas;
  const minutosDesdeColeta = monitor?.ultimaColeta
    ? (Date.now() - new Date(monitor.ultimaColeta).getTime()) / 60000
    : null;
  const coletaAtrasada =
    minutosDesdeColeta !== null && minutosDesdeColeta > (monitor?.intervaloMinutos || 5) * 3;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Machine Pay"
          subtitle="Saúde dos leitores PIX/cartão: quem está offline, quem mais cai e o histórico de cada máquina."
          icon="📡"
          action={
            <div className="flex flex-col items-stretch gap-1 sm:items-end">
              <button
                onClick={coletarAgora}
                disabled={coletando}
                className="btn-primary flex items-center justify-center gap-2 disabled:opacity-70"
              >
                <span className={coletando ? "animate-spin" : ""}>🔄</span>
                {coletando ? "Lendo o painel..." : "Atualizar agora"}
              </button>
              <span className={`text-xs ${coletaAtrasada ? "font-semibold text-red-600" : "text-gray-500"}`}>
                {monitor?.ultimaColeta
                  ? `Última leitura do painel: há ${tempoDesde(monitor.ultimaColeta)}`
                  : "Painel ainda não foi lido"}
              </span>
            </div>
          }
        />

        {erroResumo && <AlertBox type="error" title="Problema" message={erroResumo} onClose={() => setErroResumo("")} />}
        {monitor && !monitor.configurado && (
          <AlertBox
            type="warning"
            title="Monitoramento não configurado"
            message="Faltam as credenciais da Machine Pay no servidor (MACHINE_PAY_LOGIN e MACHINE_PAY_PASSWORD)."
          />
        )}
        {monitor?.configurado && !monitor.ativo && (
          <AlertBox
            type="warning"
            title="Leitura automática desligada"
            message="MACHINE_PAY_MONITOR_ATIVO=false no servidor: os dados só mudam ao clicar em Atualizar agora."
          />
        )}
        {monitor?.ultimoErro && (
          <AlertBox
            type="error"
            title="A última leitura automática falhou"
            message={`${formatarDataHora(monitor.ultimoErro.em)} — ${monitor.ultimoErro.mensagem}`}
          />
        )}
        {coletaAtrasada && !monitor?.ultimoErro && (
          <AlertBox
            type="warning"
            message={`Os dados podem estar desatualizados: a última leitura do painel foi há ${tempoDesde(monitor.ultimaColeta)}.`}
          />
        )}

        {/* Filtros */}
        <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600 lg:col-span-2">
              🔎 Buscar ponto, caixa, IP ou máquina
              <input
                className="input-field"
                placeholder="Ex: nome do ponto, 104510802, M01..."
                value={buscaDigitada}
                onChange={(e) => setBuscaDigitada(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
              🏪 Loja (máquinas vinculadas)
              <select className="input-field" value={lojaId} onChange={(e) => setLojaId(e.target.value)}>
                <option value="">Todas as lojas</option>
                {lojas.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
              📶 Sinal Wi-Fi
              <select className="input-field" value={sinal} onChange={(e) => setSinal(e.target.value)}>
                <option value="">Qualquer sinal</option>
                <option value="RUIM,FRACO">Ruim ou fraco</option>
                {Object.entries(SINAL_INFO).map(([valor, info]) => (
                  <option key={valor} value={valor}>
                    {info.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
              🧩 Tipo de leitor
              <select className="input-field" value={tipoVersao} onChange={(e) => setTipoVersao(e.target.value)}>
                <option value="">Todos</option>
                {TIPOS_LEITOR.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-1 text-xs font-semibold text-gray-600 lg:col-span-2">
              📅 Período (ranking, gráficos e linha do tempo)
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
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={incluirDesativadas}
                  onChange={(e) => setIncluirDesativadas(e.target.checked)}
                />
                Incluir desativadas
                {!incluirDesativadas && resumo?.desativadasOcultas > 0 && (
                  <span className="text-xs text-gray-400">({resumo.desativadasOcultas} ocultas)</span>
                )}
              </label>
              {temFiltros && (
                <button
                  className="text-sm font-medium text-amber-700 hover:underline"
                  onClick={() => {
                    setBuscaDigitada("");
                    setLojaId("");
                    setSinal("");
                    setTipoVersao("");
                    setIncluirDesativadas(false);
                  }}
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
          {monitor?.inicioHistorico && (
            <p className="mt-3 text-xs text-gray-500">
              ℹ️ Histórico gravado desde {formatarDataCurta(monitor.inicioHistorico)}. Leitura automática a cada{" "}
              {monitor.intervaloMinutos} min.
            </p>
          )}
        </section>

        {/* Indicadores */}
        {loadingResumo && !resumo ? (
          <LoadingSpinner message="Lendo situação das máquinas..." />
        ) : resumo ? (
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
              titulo="Monitoradas"
              valor={resumo.total}
              detalhe={`${resumo.vinculadas} vinculadas ao sistema`}
              icone="📟"
              onClick={() => irParaMaquinas("todas")}
              ativo={aba === "maquinas" && statusMaquinas === "todas" && !comQuedaMaquinas}
            />
            <KpiCard
              titulo="Online"
              valor={resumo.online}
              detalhe={resumo.total ? `${Math.round((resumo.online / resumo.total) * 100)}% no ar` : null}
              icone="🟢"
              cor="text-green-600"
              onClick={() => irParaMaquinas("online")}
              ativo={aba === "maquinas" && statusMaquinas === "online" && !comQuedaMaquinas}
            />
            <KpiCard
              titulo="Offline agora"
              valor={resumo.offline}
              detalhe="Clique para ver a lista"
              icone="🔴"
              cor="text-red-600"
              onClick={() => irParaMaquinas("offline")}
              ativo={aba === "maquinas" && statusMaquinas === "offline" && !comQuedaMaquinas}
            />
            <KpiCard
              titulo="Quedas hoje"
              valor={resumo.quedasHoje}
              detalhe={`${resumo.maquinasComQuedaHoje} máquinas caíram`}
              icone="⚡"
              cor="text-orange-600"
              onClick={() => irParaMaquinas("todas", true)}
              ativo={aba === "maquinas" && comQuedaMaquinas}
            />
            <KpiCard
              titulo="Críticas hoje"
              valor={resumo.maquinasInstaveisHoje}
              detalhe="5 quedas ou mais"
              icone="🚨"
              cor="text-red-700"
              onClick={() => {
                setPeriodo({ inicio: hoje, fim: hoje });
                setAba("ranking");
              }}
            />
            <KpiCard
              titulo="Sinal fraco/ruim"
              valor={resumo.sinalRuimOuFraco}
              detalhe="Clique para filtrar"
              icone="📶"
              cor="text-orange-600"
              onClick={() => {
                setSinal("RUIM,FRACO");
                irParaMaquinas("todas");
              }}
            />
            <KpiCard
              titulo="Online sem venda hoje"
              valor={resumo.semVendaHoje}
              detalhe="Pode valer conferir"
              icone="🤔"
            />
            <KpiCard
              titulo="Vendas hoje"
              valor={formatarMoeda(resumo.vendasHojeValor)}
              detalhe={`${resumo.vendasHojeQtd} vendas · ${resumo.vencendoEm15Dias} planos vencendo`}
              icone="💰"
              cor="text-amber-700"
            />
          </div>
        ) : null}

        {resumo?.pioresHoje?.length > 0 && aba !== "ranking" && (
          <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 p-4">
            <p className="mb-2 text-sm font-bold text-orange-900">⚠️ Quem mais caiu hoje</p>
            <div className="flex flex-wrap gap-2">
              {resumo.pioresHoje.map((m) => (
                <button
                  key={m.posId}
                  onClick={() => setMaquinaAberta(m.posId)}
                  className="flex items-center gap-2 rounded-full border border-orange-200 bg-white px-3 py-1 text-sm hover:shadow"
                >
                  <QuedasPill quedas={m.quedasHoje} />
                  <span className="max-w-[220px] truncate">{m.nomePonto}</span>
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
            </button>
          ))}
        </div>

        {aba === "maquinas" && (
          <AbaMaquinas
            filtrosQuery={filtrosQuery}
            onAbrirMaquina={setMaquinaAberta}
            status={statusMaquinas}
            setStatus={setStatusMaquinas}
            comQueda={comQuedaMaquinas}
            setComQueda={setComQuedaMaquinas}
          />
        )}
        {aba === "ranking" && (
          <AbaRanking filtrosQuery={filtrosQuery} periodo={periodo} onAbrirMaquina={setMaquinaAberta} />
        )}
        {aba === "graficos" && <AbaGraficos filtrosQuery={filtrosQuery} periodo={periodo} resumo={resumo} />}
        {aba === "eventos" && (
          <AbaEventos filtrosQuery={filtrosQuery} periodo={periodo} onAbrirMaquina={setMaquinaAberta} />
        )}
        {aba === "ajuda" && <AbaAjuda />}
      </main>

      <DetalheMaquina key={maquinaAberta} posId={maquinaAberta} onClose={() => setMaquinaAberta(null)} />

      <Footer />
    </div>
  );
}

export default MachinePay;
