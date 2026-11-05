import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, AlertBox, ConfirmDialog } from "../components/UIComponents";

// Notificações de mudança: pedidos vindos do chão de loja para o admin
// aprovar. Hoje só existe TROCA_PRODUTO (operador trocou o produto padrão da
// máquina na movimentação e sugeriu um novo padrão de capacidade).

const ABAS = [
  { id: "PENDENTE", label: "Pendentes", icon: "⏳" },
  { id: "APLICADA", label: "Aplicadas", icon: "✅" },
  { id: "RECUSADA", label: "Recusadas", icon: "🚫" },
];

const TIPOS = {
  TROCA_PRODUTO: { icon: "🔁", titulo: "Troca de produto" },
};

const tempoRelativo = (valor) => {
  if (!valor) return "-";
  const minutos = Math.round((Date.now() - new Date(valor).getTime()) / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.round(horas / 24);
  return dias === 1 ? "ontem" : `há ${dias} dias`;
};

const dataHoraCompleta = (valor) =>
  valor ? new Date(valor).toLocaleString("pt-BR") : "";

const normalizar = (texto) =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function Produto({ produto, riscado = false }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 text-xl">
        {produto?.emoji || "🧸"}
      </span>
      <span
        className={`text-sm font-semibold truncate ${
          riscado ? "text-slate-400 line-through" : "text-slate-800"
        }`}
      >
        {produto?.nome || "Sem produto"}
      </span>
    </div>
  );
}

function Seta() {
  return (
    <svg
      className="w-5 h-5 shrink-0 text-slate-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 7l5 5m0 0l-5 5m5-5H6"
      />
    </svg>
  );
}

function CartaoNotificacao({
  notificacao,
  selecionada,
  onSelecionar,
  onAplicar,
  onRecusar,
  enviando,
}) {
  const [capacidade, setCapacidade] = useState(
    notificacao.capacidadeSugerida ?? "",
  );
  const tipo = TIPOS[notificacao.tipo] || {
    icon: "🔔",
    titulo: notificacao.tipo,
  };
  const pendente = notificacao.status === "PENDENTE";
  const anterior = notificacao.capacidadeAnterior;
  const atualHoje = notificacao.maquina?.capacidadePadrao ?? anterior;
  const novo = pendente
    ? parseInt(capacidade)
    : notificacao.status === "APLICADA"
      ? notificacao.capacidadeAplicada
      : notificacao.capacidadeSugerida;
  // Pendente compara com o padrão de hoje; resolvida, com o de quando foi
  // pedida (depois de aplicada, o de hoje já é o novo).
  const de = pendente ? atualHoje : anterior;
  const diferenca =
    Number.isFinite(novo) && Number.isFinite(de) ? novo - de : null;
  const mudouDesdePedido = pendente && atualHoje !== anterior;
  const valido = parseInt(capacidade) > 0;

  const aplicar = () => valido && onAplicar(notificacao, parseInt(capacidade));

  return (
    <div
      className={`rounded-2xl border bg-white shadow-sm transition-all ${
        selecionada
          ? "border-indigo-400 ring-2 ring-indigo-200"
          : "border-slate-200"
      } ${enviando ? "opacity-60 pointer-events-none" : ""}`}
    >
      {/* Cabeçalho */}
      <div className="flex items-start gap-3 px-4 sm:px-5 pt-4">
        {pendente && (
          <input
            type="checkbox"
            checked={selecionada}
            onChange={() => onSelecionar(notificacao.id)}
            className="mt-1.5 h-5 w-5 rounded border-slate-300 text-indigo-600 cursor-pointer"
            aria-label="Selecionar notificação"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
              {tipo.icon} {tipo.titulo}
            </span>
            <span
              className="text-xs text-slate-400"
              title={dataHoraCompleta(notificacao.createdAt)}
            >
              {tempoRelativo(notificacao.createdAt)}
            </span>
          </div>
          <h3 className="mt-1 text-base sm:text-lg font-bold text-slate-900 truncate">
            {notificacao.maquina?.nome || "Máquina removida"}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 truncate">
            🏪 {notificacao.loja?.nome || "-"} · pedido por{" "}
            <strong className="font-semibold text-slate-700">
              {notificacao.usuario?.nome || "-"}
            </strong>
          </p>
        </div>
        {notificacao.maquina?.id && (
          <Link
            to={`/maquinas/${notificacao.maquina.id}`}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            title="Abrir máquina"
          >
            Ver máquina ↗
          </Link>
        )}
      </div>

      {/* Antes → depois */}
      <div className="mx-4 sm:mx-5 mt-3 rounded-xl bg-slate-50 border border-slate-100 p-3 grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <Produto produto={notificacao.produtoAnterior} riscado />
          </div>
          <Seta />
          <div className="min-w-0 flex-1">
            <Produto produto={notificacao.produtoNovo} />
          </div>
        </div>

        <div className="flex items-center gap-3 md:border-l md:border-slate-200 md:pl-4">
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Padrão
            </p>
            <p className="text-lg font-bold text-slate-400 tabular-nums line-through">
              {de ?? "-"}
            </p>
          </div>
          <Seta />
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {pendente ? "Sugerido" : "Novo"}
            </p>
            <p className="text-lg font-bold text-indigo-700 tabular-nums">
              {Number.isFinite(novo) ? novo : "-"}
            </p>
          </div>
          {diferenca !== null && diferenca !== 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                diferenca > 0
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {diferenca > 0 ? `+${diferenca}` : diferenca}
            </span>
          )}
        </div>
      </div>

      {mudouDesdePedido && (
        <p className="mx-4 sm:mx-5 mt-2 text-xs font-semibold text-amber-700">
          ⚠️ O padrão mudou desde o pedido (era {anterior ?? "-"} quando foi
          pedido, hoje é {atualHoje}).
        </p>
      )}
      {notificacao.observacao && (
        <p className="mx-4 sm:mx-5 mt-2 text-sm text-slate-600">
          💬 {notificacao.observacao}
        </p>
      )}

      {/* Ações / resultado */}
      {pendente ? (
        <div className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="whitespace-nowrap">Aplicar padrão</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={capacidade}
              onChange={(e) => setCapacidade(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && aplicar()}
              className="w-24 rounded-lg border-2 border-slate-200 px-3 py-2 text-base font-bold tabular-nums focus:border-indigo-400 focus:outline-none"
            />
          </label>
          <div className="flex gap-2 sm:ml-auto">
            <button
              type="button"
              onClick={() => onRecusar(notificacao)}
              className="flex-1 sm:flex-none rounded-xl border-2 border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 transition-colors"
            >
              Recusar
            </button>
            <button
              type="button"
              onClick={aplicar}
              disabled={!valido}
              className="flex-1 sm:flex-none rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {enviando ? "Aplicando..." : "✓ Aplicar"}
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 sm:px-5 py-3 mt-3 border-t border-slate-100 text-xs text-slate-500">
          {notificacao.status === "APLICADA" ? "✅ Aplicada" : "🚫 Recusada"}{" "}
          por{" "}
          <strong className="text-slate-700">
            {notificacao.resolvidoPor?.nome || "-"}
          </strong>{" "}
          <span title={dataHoraCompleta(notificacao.resolvidoEm)}>
            {tempoRelativo(notificacao.resolvidoEm)}
          </span>
        </div>
      )}
    </div>
  );
}

function Esqueleto() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200 bg-white p-5 animate-pulse"
        >
          <div className="h-3 w-28 rounded bg-slate-200" />
          <div className="mt-3 h-5 w-56 rounded bg-slate-200" />
          <div className="mt-2 h-3 w-40 rounded bg-slate-100" />
          <div className="mt-4 h-16 rounded-xl bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function Notificacoes() {
  const [aba, setAba] = useState("PENDENTE");
  const [notificacoes, setNotificacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [enviandoIds, setEnviandoIds] = useState(() => new Set());
  const [selecionadas, setSelecionadas] = useState(() => new Set());
  const [recusando, setRecusando] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtroLoja, setFiltroLoja] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Carrega todas de uma vez: as abas mostram a contagem de cada status.
  const carregar = async () => {
    try {
      setCarregando(true);
      const res = await api.get("/notificacoes-mudanca");
      setNotificacoes(res.data || []);
    } catch (err) {
      console.error("Erro ao carregar notificações:", err);
      setError("Erro ao carregar notificações.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const contagem = useMemo(() => {
    const c = { PENDENTE: 0, APLICADA: 0, RECUSADA: 0 };
    notificacoes.forEach((n) => (c[n.status] = (c[n.status] || 0) + 1));
    return c;
  }, [notificacoes]);

  const lojas = useMemo(() => {
    const mapa = new Map();
    notificacoes.forEach((n) => n.loja && mapa.set(n.loja.id, n.loja.nome));
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [notificacoes]);

  const visiveis = useMemo(() => {
    const termo = normalizar(busca);
    return notificacoes
      .filter((n) => n.status === aba)
      .filter((n) => !filtroLoja || n.loja?.id === filtroLoja)
      .filter(
        (n) =>
          !termo ||
          normalizar(
            [
              n.maquina?.nome,
              n.loja?.nome,
              n.usuario?.nome,
              n.produtoAnterior?.nome,
              n.produtoNovo?.nome,
            ].join(" "),
          ).includes(termo),
      )
      // Pendentes: mais antigas primeiro (fila); resolvidas: mais recentes.
      .sort((a, b) =>
        aba === "PENDENTE"
          ? new Date(a.createdAt) - new Date(b.createdAt)
          : new Date(b.resolvidoEm || b.createdAt) -
            new Date(a.resolvidoEm || a.createdAt),
      );
  }, [notificacoes, aba, filtroLoja, busca]);

  const pendentesVisiveis = aba === "PENDENTE" ? visiveis : [];
  const selecionadasVisiveis = pendentesVisiveis.filter((n) =>
    selecionadas.has(n.id),
  );
  const todasSelecionadas =
    pendentesVisiveis.length > 0 &&
    selecionadasVisiveis.length === pendentesVisiveis.length;
  const maisAntiga = notificacoes
    .filter((n) => n.status === "PENDENTE")
    .reduce(
      (antiga, n) =>
        !antiga || new Date(n.createdAt) < new Date(antiga.createdAt)
          ? n
          : antiga,
      null,
    );

  const marcarEnviando = (ids, ligado) =>
    setEnviandoIds((prev) => {
      const novo = new Set(prev);
      ids.forEach((id) => (ligado ? novo.add(id) : novo.delete(id)));
      return novo;
    });

  const substituir = (atualizada) =>
    setNotificacoes((prev) =>
      prev.map((n) => (n.id === atualizada.id ? atualizada : n)),
    );

  const alternarSelecao = (id) =>
    setSelecionadas((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const alternarTodas = () =>
    setSelecionadas(
      todasSelecionadas ? new Set() : new Set(pendentesVisiveis.map((n) => n.id)),
    );

  const aplicarUma = async (notificacao, capacidade) => {
    const res = await api.patch(
      `/notificacoes-mudanca/${notificacao.id}/aplicar`,
      { capacidade },
    );
    substituir(res.data);
  };

  const aplicar = async (notificacao, capacidade) => {
    setError("");
    marcarEnviando([notificacao.id], true);
    try {
      await aplicarUma(notificacao, capacidade);
      setSuccess(
        `✅ ${notificacao.maquina?.nome || "Máquina"}: padrão agora é ${capacidade}.`,
      );
      setSelecionadas((prev) => {
        const novo = new Set(prev);
        novo.delete(notificacao.id);
        return novo;
      });
    } catch (err) {
      setError(err?.response?.data?.error || "Erro ao aplicar notificação.");
    } finally {
      marcarEnviando([notificacao.id], false);
    }
  };

  // Aplica as selecionadas com o padrão sugerido de cada uma.
  const aplicarSelecionadas = async () => {
    const lote = selecionadasVisiveis.filter((n) => n.capacidadeSugerida > 0);
    if (lote.length === 0) return;
    setError("");
    marcarEnviando(
      lote.map((n) => n.id),
      true,
    );
    let ok = 0;
    const falhas = [];
    for (const n of lote) {
      try {
        await aplicarUma(n, n.capacidadeSugerida);
        ok += 1;
      } catch {
        falhas.push(n.maquina?.nome || n.id);
      }
    }
    marcarEnviando(
      lote.map((n) => n.id),
      false,
    );
    setSelecionadas(new Set());
    if (ok) setSuccess(`✅ ${ok} notificação(ões) aplicada(s).`);
    if (falhas.length) setError(`Não deu para aplicar: ${falhas.join(", ")}.`);
  };

  const recusar = async () => {
    const notificacao = recusando;
    if (!notificacao) return;
    setError("");
    marcarEnviando([notificacao.id], true);
    try {
      const res = await api.patch(
        `/notificacoes-mudanca/${notificacao.id}/recusar`,
      );
      substituir(res.data);
      setSuccess(
        `🚫 Recusada. ${notificacao.maquina?.nome || "A máquina"} continua com o padrão atual.`,
      );
    } catch (err) {
      setError(err?.response?.data?.error || "Erro ao recusar notificação.");
    } finally {
      marcarEnviando([notificacao.id], false);
    }
  };

  const filtrando = !!busca || !!filtroLoja;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Notificações"
          subtitle="Mudanças pedidas pela equipe, esperando sua decisão"
          icon="🔔"
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

        {/* Resumo */}
        {!carregando && contagem.PENDENTE > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-linear-to-r from-indigo-600 to-blue-700 px-5 py-4 text-white shadow-md">
            <p className="text-2xl font-bold tabular-nums">
              {contagem.PENDENTE}
            </p>
            <p className="text-sm opacity-90">
              {contagem.PENDENTE === 1
                ? "mudança esperando sua aprovação"
                : "mudanças esperando sua aprovação"}
            </p>
            {maisAntiga && (
              <p className="text-xs opacity-75 sm:ml-auto">
                A mais antiga chegou {tempoRelativo(maisAntiga.createdAt)}
              </p>
            )}
          </div>
        )}

        {/* Abas */}
        <div className="mb-4 flex overflow-x-auto rounded-2xl bg-white p-1 shadow-sm border border-slate-200 w-full sm:w-fit">
          {ABAS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setAba(item.id);
                setSelecionadas(new Set());
              }}
              className={`flex-1 sm:flex-none whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                aba === item.id
                  ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.icon} {item.label}
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-xs tabular-nums ${
                  aba === item.id ? "bg-white/25" : "bg-slate-100"
                }`}
              >
                {contagem[item.id] || 0}
              </span>
            </button>
          ))}
        </div>

        {/* Filtros */}
        {notificacoes.length > 0 && (
          <div className="mb-4 grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-2">
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="🔎 Buscar máquina, produto ou pessoa..."
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
            />
            <select
              value={filtroLoja}
              onChange={(e) => setFiltroLoja(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
              aria-label="Loja"
            >
              <option value="">🏪 Todas as lojas</option>
              {lojas.map(([id, nome]) => (
                <option key={id} value={id}>
                  {nome}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Ações em lote */}
        {aba === "PENDENTE" && pendentesVisiveis.length > 1 && (
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-white border border-slate-200 px-4 py-2.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={todasSelecionadas}
                onChange={alternarTodas}
                className="h-4 w-4 rounded border-slate-300"
              />
              Selecionar todas
            </label>
            {selecionadasVisiveis.length > 0 && (
              <button
                type="button"
                onClick={aplicarSelecionadas}
                disabled={enviandoIds.size > 0}
                className="ml-auto rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
              >
                ✓ Aplicar {selecionadasVisiveis.length} com o padrão sugerido
              </button>
            )}
          </div>
        )}

        {/* Lista */}
        {carregando ? (
          <Esqueleto />
        ) : visiveis.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center px-4">
            <div className="text-5xl mb-3">
              {filtrando ? "🔍" : aba === "PENDENTE" ? "🎉" : "📭"}
            </div>
            <p className="font-semibold text-slate-700">
              {filtrando
                ? "Nada encontrado com esses filtros"
                : aba === "PENDENTE"
                  ? "Tudo em dia! Nenhuma mudança esperando você."
                  : aba === "APLICADA"
                    ? "Nenhuma mudança aplicada ainda"
                    : "Nenhuma mudança recusada"}
            </p>
            {!filtrando && aba === "PENDENTE" && (
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Quando alguém trocar o produto padrão de uma máquina numa
                movimentação, o pedido de novo padrão aparece aqui.
              </p>
            )}
            {filtrando && (
              <button
                type="button"
                onClick={() => {
                  setBusca("");
                  setFiltroLoja("");
                }}
                className="mt-3 text-sm font-semibold text-blue-700 hover:text-blue-800"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {visiveis.map((n) => (
              <CartaoNotificacao
                key={n.id}
                notificacao={n}
                selecionada={selecionadas.has(n.id)}
                onSelecionar={alternarSelecao}
                enviando={enviandoIds.has(n.id)}
                onAplicar={aplicar}
                onRecusar={setRecusando}
              />
            ))}
          </div>
        )}
      </main>

      <ConfirmDialog
        isOpen={!!recusando}
        onClose={() => setRecusando(null)}
        onConfirm={recusar}
        title="Recusar esta mudança?"
        message={`${recusando?.maquina?.nome || "A máquina"} continua com o padrão ${recusando?.maquina?.capacidadePadrao ?? recusando?.capacidadeAnterior ?? "atual"}. A notificação vai para a aba Recusadas.`}
        confirmText="Sim, recusar"
      />

      <Footer />
    </div>
  );
}
