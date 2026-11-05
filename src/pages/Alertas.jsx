import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, AlertBox, ConfirmDialog } from "../components/UIComponents";
import { useAuth } from "../contexts/AuthContext";
import {
  CATEGORIAS,
  ORDEM_CATEGORIAS,
  buscarAlertas,
  estadoLancarMovimentacao,
  resolverAlerta,
  tempoRelativo,
} from "../utils/alertasCentral";

// Filtros ficam na URL (?categoria=&loja=&maquina=...): dá pra chegar aqui
// já filtrado vindo do Dashboard, voltar com o botão do navegador e mandar
// o link pra alguém.

const PERIODOS = [
  { id: "todos", label: "Tudo", dias: null },
  { id: "hoje", label: "Hoje", dias: 0 },
  { id: "7d", label: "7 dias", dias: 6 },
  { id: "30d", label: "30 dias", dias: 29 },
];

const ORDENS = [
  { id: "recentes", label: "Mais recentes" },
  { id: "antigos", label: "Mais antigos" },
  { id: "gravidade", label: "Maior diferença" },
];

const PADROES = {
  categoria: "todas",
  loja: "",
  maquina: "",
  pessoa: "",
  periodo: "todos",
  ordem: "recentes",
  q: "",
  agrupar: "",
};

const normalizarTexto = (texto) =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function Numeros({ numeros }) {
  if (!numeros.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {numeros.map((n) => (
        <div
          key={n.label}
          className={`rounded-xl px-3 py-1.5 text-center ${
            n.destaque
              ? "bg-red-50 border border-red-200"
              : "bg-slate-50 border border-slate-100"
          }`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {n.label}
          </p>
          <p
            className={`text-base font-bold tabular-nums ${
              n.destaque ? "text-red-600" : "text-slate-800"
            }`}
          >
            {n.valor}
          </p>
        </div>
      ))}
    </div>
  );
}

function CartaoAlerta({
  alerta,
  selecionado,
  onSelecionar,
  onResolver,
  onLancar,
  onFiltrarMaquina,
  onFiltrarLoja,
  resolvendo,
  compacto = false,
}) {
  const [aberto, setAberto] = useState(false);
  const cat = CATEGORIAS[alerta.categoria];

  return (
    <div
      className={`rounded-2xl border border-slate-200 border-l-4 ${cat.cor} bg-white shadow-sm transition-all hover:shadow-md ${
        selecionado ? "ring-2 ring-amber-300" : ""
      } ${resolvendo ? "opacity-40 pointer-events-none scale-[0.99]" : ""}`}
    >
      <div className="flex items-start gap-3 p-4">
        <input
          type="checkbox"
          checked={selecionado}
          onChange={() => onSelecionar(alerta.chave)}
          className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 cursor-pointer"
          aria-label="Selecionar alerta"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${cat.chip}`}
            >
              {cat.icon} {alerta.subtipo || cat.label}
            </span>
            <span
              className="text-xs text-slate-400"
              title={alerta.data ? alerta.data.toLocaleString("pt-BR") : ""}
            >
              {tempoRelativo(alerta.data)}
            </span>
          </div>

          {compacto ? (
            <p className="mt-1 text-xs text-slate-500 truncate">
              👤 {alerta.usuario || "-"}
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onFiltrarMaquina(alerta)}
                className="mt-1 block max-w-full text-left font-bold text-slate-900 truncate hover:text-amber-700"
                title="Ver só os alertas desta máquina"
              >
                {alerta.maquina || "Máquina"}
              </button>
              <p className="text-xs text-slate-500 truncate">
                <button
                  type="button"
                  onClick={() => onFiltrarLoja(alerta)}
                  className="hover:text-amber-700"
                  title="Ver só os alertas desta loja"
                >
                  🏪 {alerta.loja || "-"}
                </button>{" "}
                · 👤 {alerta.usuario || "-"}
              </p>
            </>
          )}

          <Numeros numeros={alerta.numeros} />

          {/* Só no WhatsApp: a observação e o motivo são o principal do
              alerta, então ficam sempre à vista. */}
          {alerta.categoria === "whatsapp" && alerta.detalhe && (
            <p className="mt-3 rounded-xl border border-green-100 bg-green-50/60 px-3 py-2 text-sm text-slate-700 whitespace-pre-line">
              {alerta.detalhe}
            </p>
          )}

          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="mt-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
            aria-expanded={aberto}
          >
            {aberto ? "▾ Menos detalhes" : "▸ Detalhes e o que fazer"}
          </button>
          {aberto && (
            <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
              {alerta.detalhe && alerta.categoria !== "whatsapp" && (
                <p className="text-slate-700 whitespace-pre-line">
                  {alerta.detalhe}
                </p>
              )}
              <p className="text-slate-600">
                💡 <strong>O que fazer:</strong> {cat.dica}
              </p>
              {alerta.data && (
                <p className="text-xs text-slate-400">
                  {alerta.data.toLocaleString("pt-BR")}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2">
          {alerta.categoria === "whatsapp" && (
            <button
              type="button"
              onClick={() => onLancar(alerta)}
              className="rounded-xl bg-green-500 px-3 py-2 text-xs sm:text-sm font-bold text-white hover:bg-green-600"
            >
              Lançar
            </button>
          )}
          <button
            type="button"
            onClick={() => onResolver(alerta)}
            className="rounded-xl border-2 border-slate-200 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
          >
            ✓ Resolvido
          </button>
          {alerta.maquinaId && !compacto && (
            <Link
              to={`/maquinas/${alerta.maquinaId}`}
              className="text-center text-[11px] font-semibold text-slate-400 hover:text-slate-600"
            >
              Ver máquina ↗
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function ChipFiltro({ children, onRemover }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 pl-3 pr-1 py-1 text-xs font-semibold text-amber-800">
      {children}
      <button
        type="button"
        onClick={onRemover}
        className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-amber-200"
        aria-label="Remover filtro"
      >
        ×
      </button>
    </span>
  );
}

export default function Alertas() {
  const navigate = useNavigate();
  const { atualizarAlertasManutencaoCount, setAlertasCompactPayCount } =
    useAuth();
  const [params, setParams] = useSearchParams();

  const filtro = Object.fromEntries(
    Object.entries(PADROES).map(([k, padrao]) => [k, params.get(k) ?? padrao]),
  );
  const mudarFiltro = (mudancas) =>
    setParams(
      (prev) => {
        const novo = new URLSearchParams(prev);
        Object.entries(mudancas).forEach(([k, v]) => {
          if (!v || v === PADROES[k]) novo.delete(k);
          else novo.set(k, v);
        });
        return novo;
      },
      { replace: true },
    );

  const [alertas, setAlertas] = useState([]);
  const [errosFonte, setErrosFonte] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [resolvendo, setResolvendo] = useState(() => new Set());
  const [confirmarLote, setConfirmarLote] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const aplicarResultado = ({ lista, erros }) => {
    setAlertas(lista);
    setErrosFonte(erros);
    setAtualizadoEm(new Date());
    setCarregando(false);
  };

  useEffect(() => {
    let cancelado = false;
    buscarAlertas().then((resultado) => {
      if (!cancelado) aplicarResultado(resultado);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  const atualizar = () => {
    setCarregando(true);
    buscarAlertas().then(aplicarResultado);
  };

  // --- Opções dos filtros (só o que tem alerta, com a contagem) ---

  const opcoesLoja = useMemo(() => {
    const mapa = new Map();
    alertas.forEach(
      (a) => a.loja && mapa.set(a.loja, (mapa.get(a.loja) || 0) + 1),
    );
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [alertas]);

  const opcoesMaquina = useMemo(() => {
    const mapa = new Map();
    alertas
      .filter((a) => !filtro.loja || a.loja === filtro.loja)
      .forEach((a) => {
        if (!a.maquinaId) return;
        const item = mapa.get(a.maquinaId) || {
          id: a.maquinaId,
          nome: a.maquina || "Máquina",
          loja: a.loja,
          total: 0,
        };
        item.total += 1;
        mapa.set(a.maquinaId, item);
      });
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  }, [alertas, filtro.loja]);

  const opcoesPessoa = useMemo(
    () => [...new Set(alertas.map((a) => a.usuario).filter(Boolean))].sort(),
    [alertas],
  );

  // --- Filtragem ---

  const filtradosSemCategoria = useMemo(() => {
    const termo = normalizarTexto(filtro.q);
    const dias = PERIODOS.find((p) => p.id === filtro.periodo)?.dias;
    let limite = null;
    if (dias !== null && dias !== undefined) {
      limite = new Date();
      limite.setHours(0, 0, 0, 0);
      limite.setDate(limite.getDate() - dias);
    }
    return alertas.filter(
      (a) =>
        (!filtro.loja || a.loja === filtro.loja) &&
        (!filtro.maquina || String(a.maquinaId) === filtro.maquina) &&
        (!filtro.pessoa || a.usuario === filtro.pessoa) &&
        (!limite || (a.data && a.data >= limite)) &&
        (!termo ||
          normalizarTexto(
            [a.maquina, a.loja, a.usuario, a.detalhe, a.subtipo].join(" "),
          ).includes(termo)),
    );
  }, [
    alertas,
    filtro.q,
    filtro.loja,
    filtro.maquina,
    filtro.pessoa,
    filtro.periodo,
  ]);

  const contagem = useMemo(() => {
    const c = Object.fromEntries(ORDEM_CATEGORIAS.map((k) => [k, 0]));
    filtradosSemCategoria.forEach((a) => (c[a.categoria] += 1));
    return c;
  }, [filtradosSemCategoria]);

  const visiveis = useMemo(() => {
    const lista = filtradosSemCategoria.filter(
      (a) => filtro.categoria === "todas" || a.categoria === filtro.categoria,
    );
    return lista.sort((a, b) => {
      if (filtro.ordem === "gravidade") return (b.peso || 0) - (a.peso || 0);
      const da = a.data?.getTime() || 0;
      const db = b.data?.getTime() || 0;
      return filtro.ordem === "antigos" ? da - db : db - da;
    });
  }, [filtradosSemCategoria, filtro.categoria, filtro.ordem]);

  // Visão "por máquina": máquinas com mais alertas primeiro.
  const grupos = useMemo(() => {
    if (!filtro.agrupar) return null;
    const mapa = new Map();
    visiveis.forEach((a) => {
      const id = a.maquinaId || `sem-${a.maquina}`;
      if (!mapa.has(id))
        mapa.set(id, {
          id,
          maquinaId: a.maquinaId,
          maquina: a.maquina,
          loja: a.loja,
          itens: [],
        });
      mapa.get(id).itens.push(a);
    });
    return [...mapa.values()].sort((a, b) => b.itens.length - a.itens.length);
  }, [visiveis, filtro.agrupar]);

  const selecionadosVisiveis = visiveis.filter((a) =>
    selecionados.has(a.chave),
  );
  const todosSelecionados =
    visiveis.length > 0 && selecionadosVisiveis.length === visiveis.length;

  const nomeMaquinaFiltro =
    alertas.find((a) => String(a.maquinaId) === filtro.maquina)?.maquina ||
    "Máquina";
  const chipsAtivos = [
    filtro.loja && {
      k: "loja",
      label: `🏪 ${filtro.loja}`,
      limpar: { loja: "", maquina: "" },
    },
    filtro.maquina && {
      k: "maquina",
      label: `🎮 ${nomeMaquinaFiltro}`,
      limpar: { maquina: "" },
    },
    filtro.pessoa && {
      k: "pessoa",
      label: `👤 ${filtro.pessoa}`,
      limpar: { pessoa: "" },
    },
    filtro.periodo !== "todos" && {
      k: "periodo",
      label: `📅 ${PERIODOS.find((p) => p.id === filtro.periodo)?.label}`,
      limpar: { periodo: "" },
    },
    filtro.q && { k: "q", label: `🔎 “${filtro.q}”`, limpar: { q: "" } },
  ].filter(Boolean);
  const filtrosAtivos = chipsAtivos.length > 0;

  const limparFiltros = () =>
    mudarFiltro({ loja: "", maquina: "", pessoa: "", periodo: "", q: "" });

  // --- Ações ---

  const alternarSelecao = (chave) =>
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });

  const atualizarContadoresMenu = (resolvidos) => {
    if (
      resolvidos.some((a) => ["machinepay", "whatsapp"].includes(a.categoria))
    )
      atualizarAlertasManutencaoCount?.();
    const cp = resolvidos.filter((a) => a.categoria === "compactpay").length;
    if (cp) setAlertasCompactPayCount?.((n) => Math.max(0, n - cp));
  };

  const resolver = async (lista) => {
    if (lista.length === 0) return;
    setError("");
    setSuccess("");
    const chaves = lista.map((a) => a.chave);
    setResolvendo((prev) => new Set([...prev, ...chaves]));

    const resultados = await Promise.allSettled(lista.map(resolverAlerta));
    const ok = lista.filter((_, i) => resultados[i].status === "fulfilled");
    const falhas = lista.filter((_, i) => resultados[i].status === "rejected");

    const chavesOk = new Set(ok.map((a) => a.chave));
    setAlertas((prev) => prev.filter((a) => !chavesOk.has(a.chave)));
    setSelecionados(
      (prev) => new Set([...prev].filter((c) => !chavesOk.has(c))),
    );
    setResolvendo(
      (prev) => new Set([...prev].filter((c) => !chaves.includes(c))),
    );
    atualizarContadoresMenu(ok);

    if (ok.length)
      setSuccess(
        ok.length === 1
          ? `✓ Alerta de ${ok[0].maquina || "máquina"} resolvido.`
          : `✓ ${ok.length} alertas resolvidos.`,
      );
    if (falhas.length)
      setError(
        `Não deu para resolver ${falhas.length} alerta(s): ${falhas
          .map((a) => a.maquina)
          .join(", ")}. Tente de novo.`,
      );
  };

  const lancarMovimentacao = (alerta) =>
    navigate("/movimentacoes?abrirFormulario=true&modo=nova_movimentacao", {
      state: estadoLancarMovimentacao(alerta),
    });

  const propsCartao = (a) => ({
    alerta: a,
    selecionado: selecionados.has(a.chave),
    onSelecionar: alternarSelecao,
    onResolver: (alerta) => resolver([alerta]),
    onLancar: lancarMovimentacao,
    onFiltrarMaquina: (alerta) =>
      mudarFiltro({
        maquina: String(alerta.maquinaId || ""),
        loja: alerta.loja || "",
      }),
    onFiltrarLoja: (alerta) =>
      mudarFiltro({ loja: alerta.loja || "", maquina: "" }),
    resolvendo: resolvendo.has(a.chave),
  });

  const total = filtradosSemCategoria.length;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Alertas"
          subtitle="Tudo o que precisa da sua atenção, num lugar só"
          icon="🚨"
          action={
            <button
              type="button"
              onClick={atualizar}
              disabled={carregando}
              className="btn-secondary disabled:opacity-50"
            >
              {carregando ? "Atualizando..." : "↻ Atualizar"}
            </button>
          }
        />

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}
        {success && (
          <AlertBox
            type="success"
            message={success}
            onClose={() => setSuccess("")}
          />
        )}
        {errosFonte.length > 0 && !carregando && (
          <AlertBox
            type="warning"
            message={`Não foi possível carregar: ${errosFonte
              .map((c) => CATEGORIAS[c]?.label || c)
              .join(", ")}. Os outros alertas estão abaixo.`}
          />
        )}

        {/* Categorias */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
          <button
            type="button"
            onClick={() => mudarFiltro({ categoria: "" })}
            className={`rounded-2xl border p-3 text-left transition-all ${
              filtro.categoria === "todas"
                ? "border-slate-800 bg-slate-800 text-white shadow-md"
                : "border-slate-200 bg-white hover:shadow-sm"
            }`}
          >
            <p className="text-xs font-semibold opacity-80">🚨 Todos</p>
            <p className="text-2xl font-bold tabular-nums">
              {carregando ? "…" : total}
            </p>
            <p className="text-[10px] opacity-60">pendentes</p>
          </button>
          {ORDEM_CATEGORIAS.map((id) => {
            const cat = CATEGORIAS[id];
            const ativo = filtro.categoria === id;
            const comErro = errosFonte.includes(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => mudarFiltro({ categoria: ativo ? "" : id })}
                className={`rounded-2xl border p-3 text-left transition-all ${
                  ativo
                    ? "border-amber-400 bg-amber-50 shadow-md ring-2 ring-amber-200"
                    : "border-slate-200 bg-white hover:shadow-sm"
                } ${!carregando && contagem[id] === 0 && !ativo ? "opacity-55" : ""}`}
                title={cat.descricao}
              >
                <p className="text-xs font-semibold text-slate-600 truncate">
                  {cat.icon} {cat.label}
                </p>
                <p
                  className={`text-2xl font-bold tabular-nums ${
                    contagem[id] > 0 ? "text-slate-900" : "text-slate-300"
                  }`}
                >
                  {carregando ? "…" : comErro ? "!" : contagem[id]}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {cat.descricao}
                </p>
              </button>
            );
          })}
        </div>

        {/* Filtros (fixos no topo ao rolar) */}
        <div className="sticky top-0 z-20 -mx-4 sm:mx-0 mb-4 px-4 sm:px-0 py-2 bg-[#f2f2f2]/90 backdrop-blur-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <input
                type="search"
                value={filtro.q}
                onChange={(e) => mudarFiltro({ q: e.target.value })}
                placeholder="🔎 Buscar máquina, pessoa ou texto..."
                className="w-full min-w-0 rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
              <select
                value={filtro.loja}
                onChange={(e) =>
                  mudarFiltro({ loja: e.target.value, maquina: "" })
                }
                className="w-full min-w-0 truncate rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                aria-label="Loja"
              >
                <option value="">🏪 Todas as lojas</option>
                {opcoesLoja.map(([nome, n]) => (
                  <option key={nome} value={nome}>
                    {nome} ({n})
                  </option>
                ))}
              </select>
              <select
                value={filtro.maquina}
                onChange={(e) => {
                  const m = opcoesMaquina.find(
                    (x) => String(x.id) === e.target.value,
                  );
                  mudarFiltro({
                    maquina: e.target.value,
                    ...(m && !filtro.loja ? { loja: m.loja } : {}),
                  });
                }}
                className="w-full min-w-0 truncate rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                aria-label="Máquina"
              >
                <option value="">
                  🎮{" "}
                  {filtro.loja
                    ? "Todas as máquinas da loja"
                    : "Todas as máquinas"}
                </option>
                {opcoesMaquina.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                    {!filtro.loja && m.loja ? ` · ${m.loja}` : ""} ({m.total})
                  </option>
                ))}
              </select>
              <select
                value={filtro.pessoa}
                onChange={(e) => mudarFiltro({ pessoa: e.target.value })}
                className="w-full min-w-0 truncate rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                aria-label="Quem lançou"
              >
                <option value="">👤 Todas as pessoas</option>
                {opcoesPessoa.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {PERIODOS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => mudarFiltro({ periodo: p.id })}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    filtro.periodo === p.id
                      ? "bg-amber-50 border-amber-400 text-amber-700"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-slate-200" />
              <div className="inline-flex rounded-full border border-slate-200 p-0.5">
                {[
                  { id: "", label: "☰ Lista" },
                  { id: "maquina", label: "🎮 Por máquina" },
                ].map((v) => (
                  <button
                    key={v.id || "lista"}
                    type="button"
                    onClick={() => mudarFiltro({ agrupar: v.id })}
                    className={`px-3 py-0.5 rounded-full text-xs font-semibold ${
                      filtro.agrupar === v.id
                        ? "bg-slate-800 text-white"
                        : "text-slate-600"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <select
                value={filtro.ordem}
                onChange={(e) => mudarFiltro({ ordem: e.target.value })}
                className="ml-auto rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                aria-label="Ordenar"
              >
                {ORDENS.map((o) => (
                  <option key={o.id} value={o.id}>
                    ↕ {o.label}
                  </option>
                ))}
              </select>
            </div>

            {filtrosAtivos && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {chipsAtivos.map((c) => (
                  <ChipFiltro
                    key={c.k}
                    onRemover={() => mudarFiltro(c.limpar)}
                  >
                    {c.label}
                  </ChipFiltro>
                ))}
                <button
                  type="button"
                  onClick={limparFiltros}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-800"
                >
                  Limpar tudo
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Barra de seleção */}
        {!carregando && visiveis.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-3 px-1">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={todosSelecionados}
                onChange={() =>
                  setSelecionados(
                    todosSelecionados
                      ? new Set()
                      : new Set(visiveis.map((a) => a.chave)),
                  )
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              {visiveis.length === 1
                ? "Selecionar o alerta"
                : `Selecionar os ${visiveis.length}`}
            </label>
            {selecionadosVisiveis.length > 0 ? (
              <button
                type="button"
                onClick={() => setConfirmarLote(selecionadosVisiveis)}
                className="ml-auto rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-emerald-700"
              >
                ✓ Marcar {selecionadosVisiveis.length} como resolvido
              </button>
            ) : (
              atualizadoEm && (
                <span className="ml-auto text-xs text-slate-400">
                  Atualizado às{" "}
                  {atualizadoEm.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )
            )}
          </div>
        )}

        {/* Lista */}
        {carregando ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 rounded-2xl border border-slate-200 bg-white animate-pulse"
              />
            ))}
          </div>
        ) : visiveis.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center px-4">
            <div className="text-5xl mb-3">{filtrosAtivos ? "🔍" : "🎉"}</div>
            <p className="font-semibold text-slate-700">
              {filtrosAtivos
                ? "Nenhum alerta com esses filtros"
                : filtro.categoria === "todas"
                  ? "Tudo certo! Nenhum alerta pendente."
                  : `Nenhum alerta de ${CATEGORIAS[filtro.categoria]?.label}.`}
            </p>
            {filtrosAtivos && (
              <button
                type="button"
                onClick={limparFiltros}
                className="mt-3 text-sm font-semibold text-blue-700 hover:text-blue-800"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : grupos ? (
          <div className="space-y-5">
            {grupos.map((g) => (
              <section
                key={g.id}
                className="rounded-3xl border border-slate-200 bg-white/60 p-3"
              >
                <div className="flex flex-wrap items-center gap-2 px-1 pb-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900 truncate">
                      🎮 {g.maquina || "Máquina"}
                    </h3>
                    <p className="text-xs text-slate-500">
                      🏪 {g.loja || "-"} · {g.itens.length} alerta(s) ·{" "}
                      {[
                        ...new Set(
                          g.itens.map((a) => CATEGORIAS[a.categoria].icon),
                        ),
                      ].join(" ")}
                    </p>
                  </div>
                  {g.maquinaId && (
                    <Link
                      to={`/maquinas/${g.maquinaId}`}
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                    >
                      Ver máquina ↗
                    </Link>
                  )}
                  {g.itens.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setConfirmarLote(g.itens)}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                    >
                      ✓ Resolver os {g.itens.length}
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {g.itens.map((a) => (
                    <CartaoAlerta key={a.chave} {...propsCartao(a)} compacto />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {visiveis.map((a) => (
              <CartaoAlerta key={a.chave} {...propsCartao(a)} />
            ))}
          </div>
        )}
      </main>

      <ConfirmDialog
        isOpen={!!confirmarLote}
        onClose={() => setConfirmarLote(null)}
        onConfirm={() => resolver(confirmarLote || [])}
        title="Marcar como resolvidos?"
        message={`${confirmarLote?.length || 0} alerta(s) saem da lista. Alertas de IN, OUT e abastecimento ficam ignorados e não voltam.`}
        confirmText="Sim, resolver"
        type="primary"
      />

      <Footer />
    </div>
  );
}
