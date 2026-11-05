import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import {
  PageHeader,
  AlertBox,
  Modal,
  ConfirmDialog,
} from "../components/UIComponents";
import { PageLoader, LoadingSpinner } from "../components/Loading";
import { useAuth } from "../contexts/AuthContext";
import { ehGestao } from "../utils/cargos";

// Histórico de movimentações das máquinas e do estoque das lojas. Antes ficava
// no fim da página de Movimentações (que agora é só pra registrar).

const PERIODOS = [
  { id: "hoje", label: "Hoje" },
  { id: "ontem", label: "Ontem" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "custom", label: "Personalizado" },
];

const FILTROS_TIPO_MAQUINA = [
  { id: "todos", label: "Todas" },
  { id: "abastecimento", label: "📥 Com abastecimento" },
  { id: "retirada", label: "📦 Retirada de estoque" },
  { id: "observacao", label: "💬 Com observação" },
];

const FILTROS_TIPO_ESTOQUE = [
  { id: "todos", label: "Todos" },
  { id: "entrada", label: "📥 Com entrada" },
  { id: "saida", label: "📤 Com saída" },
];

// YYYY-MM-DD no fuso local (toISOString usaria UTC e viraria o dia à noite).
const isoLocal = (data) => {
  const d = new Date(data);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const somarDias = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return isoLocal(d);
};

const intervaloDoPeriodo = (periodo, inicioCustom, fimCustom) => {
  const hoje = isoLocal(new Date());
  switch (periodo) {
    case "ontem":
      return { inicio: somarDias(-1), fim: somarDias(-1) };
    case "7d":
      return { inicio: somarDias(-6), fim: hoje };
    case "30d":
      return { inicio: somarDias(-29), fim: hoje };
    case "custom":
      return { inicio: inicioCustom || hoje, fim: fimCustom || hoje };
    default:
      return { inicio: hoje, fim: hoje };
  }
};

const rotuloDia = (diaIso) => {
  if (diaIso === isoLocal(new Date())) return "Hoje";
  if (diaIso === somarDias(-1)) return "Ontem";
  const data = new Date(`${diaIso}T12:00:00`);
  const semana = data.toLocaleDateString("pt-BR", { weekday: "long" });
  return semana.charAt(0).toUpperCase() + semana.slice(1);
};

const formatarDiaCompleto = (diaIso) =>
  new Date(`${diaIso}T12:00:00`).toLocaleDateString("pt-BR");

const formatarHora = (valor) =>
  new Date(valor).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

const formatarMoeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const numero = (valor) => Number(valor) || 0;

const normalizar = (texto) =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const dataMovMaquina = (mov) => mov.dataColeta || mov.createdAt;

const agruparPorDia = (itens, obterData) => {
  const grupos = new Map();
  for (const item of itens) {
    const dia = isoLocal(obterData(item));
    if (!grupos.has(dia)) grupos.set(dia, []);
    grupos.get(dia).push(item);
  }
  return [...grupos.entries()].map(([dia, lista]) => ({ dia, itens: lista }));
};

const baixarCsv = (nomeArquivo, cabecalho, linhas) => {
  const escapar = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const conteudo = [cabecalho, ...linhas]
    .map((linha) => linha.map(escapar).join(";"))
    .join("\n");
  const blob = new Blob([String.fromCharCode(0xfeff) + conteudo], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
};

// --- Componentes visuais pequenos ---

function Kpi({ icon, label, value, hint, tone = "slate" }) {
  const tones = {
    slate: "text-slate-900",
    red: "text-red-600",
    green: "text-emerald-600",
    blue: "text-blue-600",
    amber: "text-amber-600",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
        <span>{icon}</span>
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tones[tone]}`}>
        {value}
      </p>
      {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
    </div>
  );
}

function Metrica({ label, value, tone = "slate", destaque = false }) {
  const tones = {
    slate: "text-slate-800",
    red: "text-red-600",
    green: "text-emerald-600",
    blue: "text-blue-600",
    muted: "text-slate-400",
  };
  return (
    <div className="min-w-[64px] text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p
        className={`tabular-nums ${destaque ? "text-lg" : "text-base"} font-bold ${tones[tone]}`}
      >
        {value}
      </p>
    </div>
  );
}

function Detalhe({ label, value }) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="text-sm font-semibold text-slate-800 break-words">
        {value ?? "-"}
      </p>
    </div>
  );
}

function Chevron({ aberto }) {
  return (
    <svg
      className={`w-5 h-5 text-slate-400 transition-transform ${aberto ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

function CabecalhoDia({ dia, quantidade, resumo }) {
  return (
    <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-[#f2f2f2]/95 backdrop-blur-sm flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-sm font-bold text-slate-800">
        {rotuloDia(dia)}
        <span className="ml-2 font-medium text-slate-500">
          {formatarDiaCompleto(dia)}
        </span>
        <span className="ml-2 text-xs font-semibold text-slate-400">
          {quantidade} registro(s)
        </span>
      </h3>
      {resumo && <div className="text-xs text-slate-600">{resumo}</div>}
    </div>
  );
}

function Vazio({ titulo, mensagem }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
      <div className="text-5xl mb-3">🔍</div>
      <p className="font-semibold text-slate-700">{titulo}</p>
      <p className="text-sm text-slate-500 mt-1">{mensagem}</p>
    </div>
  );
}

// --- Página ---

export function HistoricoMovimentacoes() {
  const { usuario } = useAuth();
  // Admin e operador chefe corrigem lançamentos errados.
  const ehAdmin = ehGestao(usuario?.role);

  const [aba, setAba] = useState("maquinas");
  const [periodo, setPeriodo] = useState("hoje");
  const [inicioCustom, setInicioCustom] = useState("");
  const [fimCustom, setFimCustom] = useState("");
  const [filtroLoja, setFiltroLoja] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [expandidos, setExpandidos] = useState(() => new Set());

  const [lojas, setLojas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [movMaquinas, setMovMaquinas] = useState([]);
  const [movEstoque, setMovEstoque] = useState([]);

  const [carregandoInicial, setCarregandoInicial] = useState(true);
  const [carregandoMaquinas, setCarregandoMaquinas] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editandoMov, setEditandoMov] = useState(null);
  const [formEdicao, setFormEdicao] = useState({});
  const [editandoEstoque, setEditandoEstoque] = useState(null);
  const [excluindoEstoque, setExcluindoEstoque] = useState(null);

  const { inicio, fim } = intervaloDoPeriodo(periodo, inicioCustom, fimCustom);

  const lojaPorId = useMemo(
    () => Object.fromEntries(lojas.map((l) => [l.id, l])),
    [lojas],
  );
  const maquinaPorId = useMemo(
    () => Object.fromEntries(maquinas.map((m) => [m.id, m])),
    [maquinas],
  );
  const produtoPorId = useMemo(
    () => Object.fromEntries(produtos.map((p) => [String(p.id), p])),
    [produtos],
  );

  useEffect(() => {
    const carregar = async () => {
      try {
        const [lojasRes, maqRes, prodRes] = await Promise.all([
          api.get("/lojas"),
          api.get("/maquinas"),
          api.get("/produtos"),
        ]);
        setLojas(lojasRes.data || []);
        setMaquinas(maqRes.data || []);
        setProdutos(prodRes.data || []);
        await carregarEstoque();
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
        setError("Erro ao carregar dados iniciais.");
      } finally {
        setCarregandoInicial(false);
      }
    };
    carregar();
  }, []);

  // Movimentações de máquina são filtradas no backend (período e loja), já
  // que podem ser milhares; as de estoque de loja vêm todas e filtramos aqui.
  useEffect(() => {
    carregarMovMaquinas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicio, fim, filtroLoja]);

  const carregarMovMaquinas = async () => {
    try {
      setCarregandoMaquinas(true);
      const res = await api.get("/movimentacoes", {
        params: {
          dataInicio: new Date(`${inicio}T00:00:00`).toISOString(),
          dataFim: new Date(`${fim}T23:59:59.999`).toISOString(),
          lojaId: filtroLoja || undefined,
          limite: 5000,
        },
      });
      setMovMaquinas(res.data || []);
    } catch (err) {
      console.error("Erro ao carregar movimentações:", err);
      setError("Erro ao carregar movimentações das máquinas.");
    } finally {
      setCarregandoMaquinas(false);
    }
  };

  const carregarEstoque = async () => {
    try {
      const res = await api.get("/movimentacao-estoque-loja");
      setMovEstoque(res.data || []);
    } catch (err) {
      console.error("Erro ao carregar movimentações de estoque:", err);
      setMovEstoque([]);
    }
  };

  const alternarExpandido = (id) =>
    setExpandidos((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const trocarAba = (novaAba) => {
    setAba(novaAba);
    setFiltroTipo("todos");
  };

  const limparFiltros = () => {
    setPeriodo("hoje");
    setInicioCustom("");
    setFimCustom("");
    setFiltroLoja("");
    setBusca("");
    setFiltroTipo("todos");
  };

  const filtrosAtivos =
    periodo !== "hoje" || filtroLoja || busca || filtroTipo !== "todos";

  // --- Dados derivados: máquinas ---

  const infoMov = (mov) => {
    const maquina = mov.maquina || maquinaPorId[mov.maquinaId] || {};
    const loja = lojaPorId[maquina.lojaId];
    const produtoId = mov.detalhesProdutos?.[0]?.produtoId;
    const produto =
      produtoPorId[String(produtoId)] || mov.detalhesProdutos?.[0]?.produto;
    return { maquina, loja, produto };
  };

  const movMaquinasFiltradas = useMemo(() => {
    const termo = normalizar(busca);
    return movMaquinas.filter((mov) => {
      if (filtroTipo === "abastecimento" && !(numero(mov.abastecidas) > 0))
        return false;
      if (filtroTipo === "retirada" && !mov.retiradaEstoque) return false;
      if (filtroTipo === "observacao" && !mov.observacoes?.trim()) return false;
      if (!termo) return true;
      const { maquina, loja, produto } = infoMov(mov);
      return normalizar(
        [
          maquina.codigo,
          maquina.nome,
          loja?.nome,
          produto?.nome,
          mov.usuario?.nome,
          mov.observacoes,
        ].join(" "),
      ).includes(termo);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movMaquinas, busca, filtroTipo, maquinaPorId, lojaPorId, produtoPorId]);

  const totaisMaquinas = useMemo(() => {
    const t = {
      sairam: 0,
      abastecidas: 0,
      fichas: 0,
      digital: 0,
      faturado: 0,
      maquinas: new Set(),
    };
    for (const mov of movMaquinasFiltradas) {
      t.sairam += numero(mov.sairam);
      t.abastecidas += numero(mov.abastecidas);
      t.fichas += numero(mov.fichas);
      t.digital += numero(mov.valor_entrada_maquininha_pix);
      t.faturado += numero(mov.valorFaturado);
      t.maquinas.add(mov.maquinaId);
    }
    return t;
  }, [movMaquinasFiltradas]);

  // --- Dados derivados: estoque de loja ---

  const nomeProdutoEstoque = (item) => {
    const produto =
      produtoPorId[String(item.produtoId || item.produto_id)] || item.produto;
    return {
      nome: produto?.nome || "Produto desconhecido",
      emoji: produto?.emoji || "📦",
    };
  };

  const movEstoqueFiltradas = useMemo(() => {
    const termo = normalizar(busca);
    return movEstoque.filter((mov) => {
      const dia = mov.dataMovimentacao ? isoLocal(mov.dataMovimentacao) : "";
      if (!dia || dia < inicio || dia > fim) return false;
      if (filtroLoja && (mov.loja?.id || mov.lojaId) !== filtroLoja)
        return false;
      const itens = mov.produtosEnviados || [];
      if (
        filtroTipo !== "todos" &&
        !itens.some((p) => (p.tipoMovimentacao || "saida") === filtroTipo)
      )
        return false;
      if (!termo) return true;
      return normalizar(
        [
          mov.loja?.nome,
          mov.usuario?.nome,
          mov.observacao,
          ...itens.map((p) => nomeProdutoEstoque(p).nome),
        ].join(" "),
      ).includes(termo);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movEstoque, inicio, fim, filtroLoja, filtroTipo, busca, produtoPorId]);

  const somarItens = (itens, tipo) =>
    itens
      .filter((p) => (p.tipoMovimentacao || "saida") === tipo)
      .reduce((s, p) => s + numero(p.quantidade), 0);

  const totaisEstoque = useMemo(() => {
    const t = { entrada: 0, saida: 0, lojas: new Set(), produtos: new Set() };
    for (const mov of movEstoqueFiltradas) {
      const itens = mov.produtosEnviados || [];
      t.entrada += somarItens(itens, "entrada");
      t.saida += somarItens(itens, "saida");
      t.lojas.add(mov.loja?.id || mov.lojaId);
      itens.forEach((p) => t.produtos.add(p.produtoId || p.produto?.id));
    }
    return t;
  }, [movEstoqueFiltradas]);

  // --- Ações: máquinas ---

  const iniciarEdicao = (mov) => {
    setEditandoMov(mov);
    setFormEdicao({
      fichas: mov.fichas || 0,
      abastecidas: mov.abastecidas || 0,
      quantidade_notas_entrada: mov.quantidade_notas_entrada ?? "",
      valor_entrada_maquininha_pix: mov.valor_entrada_maquininha_pix ?? "",
    });
  };

  const salvarEdicao = async () => {
    try {
      await api.put(`/movimentacoes/${editandoMov.id}`, {
        fichas: parseInt(formEdicao.fichas) || 0,
        abastecidas: parseInt(formEdicao.abastecidas) || 0,
        quantidade_notas_entrada:
          formEdicao.quantidade_notas_entrada !== ""
            ? parseFloat(formEdicao.quantidade_notas_entrada)
            : null,
        valor_entrada_maquininha_pix:
          formEdicao.valor_entrada_maquininha_pix !== ""
            ? parseFloat(formEdicao.valor_entrada_maquininha_pix)
            : null,
      });
      setSuccess("Movimentação atualizada com sucesso!");
      setEditandoMov(null);
      carregarMovMaquinas();
    } catch (err) {
      console.error("Erro ao atualizar:", err);
      setError("Erro ao atualizar movimentação.");
    }
  };

  // --- Ações: estoque de loja ---

  const salvarEdicaoEstoque = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/movimentacao-estoque-loja/${editandoEstoque.id}`, {
        lojaId: editandoEstoque.loja?.id || editandoEstoque.lojaId,
        usuarioId: usuario.id,
        produtos: editandoEstoque.produtosEnviados.map((p) => ({
          produtoId: p.produto?.id || p.produtoId,
          quantidade: Number(p.quantidade),
          tipoMovimentacao: p.tipoMovimentacao || "saida",
        })),
      });
      setSuccess("Movimentação de estoque atualizada!");
      setEditandoEstoque(null);
      carregarEstoque();
    } catch (err) {
      console.error("Erro ao editar:", err);
      setError("Erro ao atualizar movimentação de estoque.");
    }
  };

  const confirmarExclusaoEstoque = async () => {
    if (!excluindoEstoque) return;
    try {
      await api.delete(`/movimentacao-estoque-loja/${excluindoEstoque.id}`);
      setSuccess("Movimentação de estoque excluída.");
      carregarEstoque();
    } catch (err) {
      console.error("Erro ao excluir:", err);
      setError("Erro ao excluir movimentação de estoque.");
    } finally {
      setExcluindoEstoque(null);
    }
  };

  const atualizarItemEstoque = (idx, campo, valor) =>
    setEditandoEstoque((prev) => ({
      ...prev,
      produtosEnviados: prev.produtosEnviados.map((p, i) =>
        i === idx ? { ...p, [campo]: valor } : p,
      ),
    }));

  // --- Exportação ---

  const exportarCsv = () => {
    if (aba === "maquinas") {
      baixarCsv(
        `movimentacoes-maquinas_${inicio}_${fim}.csv`,
        [
          "Data",
          "Hora",
          "Loja",
          "Máquina",
          "Produto",
          "Usuário",
          "Estoque antes",
          "Saíram",
          "Abastecidas",
          "Estoque depois",
          "Fichas",
          "Contador IN",
          "Contador OUT",
          "Notas",
          "Digital (R$)",
          "Faturado (R$)",
          "Retirada de estoque",
          "Observação",
        ],
        movMaquinasFiltradas.map((mov) => {
          const { maquina, loja, produto } = infoMov(mov);
          const data = new Date(dataMovMaquina(mov));
          return [
            data.toLocaleDateString("pt-BR"),
            data.toLocaleTimeString("pt-BR"),
            loja?.nome,
            `${maquina.codigo || ""} ${maquina.nome || ""}`.trim(),
            produto?.nome,
            mov.usuario?.nome,
            mov.totalPre,
            mov.sairam,
            mov.abastecidas,
            mov.totalPos,
            mov.fichas,
            mov.contadorIn,
            mov.contadorOut,
            mov.quantidade_notas_entrada,
            mov.valor_entrada_maquininha_pix,
            mov.valorFaturado,
            mov.retiradaEstoque ? "Sim" : "Não",
            mov.observacoes,
          ];
        }),
      );
    } else {
      baixarCsv(
        `movimentacoes-estoque_${inicio}_${fim}.csv`,
        ["Data", "Hora", "Loja", "Responsável", "Produto", "Tipo", "Quantidade"],
        movEstoqueFiltradas.flatMap((mov) => {
          const data = new Date(mov.dataMovimentacao);
          return (mov.produtosEnviados || []).map((p) => [
            data.toLocaleDateString("pt-BR"),
            data.toLocaleTimeString("pt-BR"),
            mov.loja?.nome,
            mov.usuario?.nome,
            nomeProdutoEstoque(p).nome,
            p.tipoMovimentacao || "saida",
            p.quantidade,
          ]);
        }),
      );
    }
  };

  if (carregandoInicial) return <PageLoader />;

  const gruposMaquinas = agruparPorDia(movMaquinasFiltradas, dataMovMaquina);
  const gruposEstoque = agruparPorDia(
    movEstoqueFiltradas,
    (m) => m.dataMovimentacao,
  );
  const filtrosTipo =
    aba === "maquinas" ? FILTROS_TIPO_MAQUINA : FILTROS_TIPO_ESTOQUE;
  const totalVisivel =
    aba === "maquinas" ? movMaquinasFiltradas.length : movEstoqueFiltradas.length;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Histórico"
          subtitle="Tudo o que entrou e saiu das máquinas e do estoque das lojas"
          icon="🗂️"
          action={
            <div className="flex gap-2">
              <Link to="/movimentacoes" className="btn-secondary">
                + Nova movimentação
              </Link>
              <button
                type="button"
                onClick={exportarCsv}
                disabled={totalVisivel === 0}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ⬇ Exportar CSV
              </button>
            </div>
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

        {/* Abas */}
        <div className="mb-4 inline-flex rounded-2xl bg-white p-1 shadow-sm border border-slate-200">
          {[
            {
              id: "maquinas",
              label: "🎮 Máquinas",
              count: movMaquinasFiltradas.length,
            },
            {
              id: "estoque",
              label: "🏪 Estoque de lojas",
              count: movEstoqueFiltradas.length,
            },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => trocarAba(item.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                aba === item.id
                  ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  aba === item.id ? "bg-white/25" : "bg-slate-100"
                }`}
              >
                {item.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 mr-1">
              Período
            </span>
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriodo(p.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  periodo === p.id
                    ? "bg-amber-50 border-amber-400 text-amber-700"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {p.label}
              </button>
            ))}
            {periodo === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={inicioCustom}
                  max={fimCustom || undefined}
                  onChange={(e) => setInicioCustom(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  aria-label="Data início"
                />
                <span className="text-slate-400">até</span>
                <input
                  type="date"
                  value={fimCustom}
                  min={inicioCustom || undefined}
                  onChange={(e) => setFimCustom(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  aria-label="Data fim"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-3">
            <select
              value={filtroLoja}
              onChange={(e) => setFiltroLoja(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
              aria-label="Loja"
            >
              <option value="">🏪 Todas as lojas</option>
              {lojas.map((loja) => (
                <option key={loja.id} value={loja.id}>
                  {loja.nome}
                </option>
              ))}
            </select>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={
                aba === "maquinas"
                  ? "🔎 Buscar máquina, produto, usuário ou observação..."
                  : "🔎 Buscar loja, produto ou responsável..."
              }
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {filtrosTipo.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltroTipo(f.id)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    filtroTipo === f.id
                      ? "bg-slate-800 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {filtrosAtivos && (
              <button
                type="button"
                onClick={limparFiltros}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* Resumo do período */}
        {aba === "maquinas" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <Kpi
              icon="🧾"
              label="Registros"
              value={movMaquinasFiltradas.length}
              hint={`${totaisMaquinas.maquinas.size} máquina(s)`}
            />
            <Kpi
              icon="📤"
              label="Prêmios saíram"
              value={totaisMaquinas.sairam}
              tone="red"
            />
            <Kpi
              icon="📥"
              label="Abastecidos"
              value={totaisMaquinas.abastecidas}
              tone="green"
            />
            <Kpi
              icon="🎫"
              label="Fichas"
              value={totaisMaquinas.fichas.toLocaleString("pt-BR")}
              hint={
                totaisMaquinas.sairam > 0
                  ? `${(totaisMaquinas.fichas / totaisMaquinas.sairam).toFixed(1)} fichas/prêmio`
                  : null
              }
              tone="blue"
            />
            <Kpi
              icon="💳"
              label="Digital"
              value={formatarMoeda(totaisMaquinas.digital)}
              hint="Pix / maquininha"
            />
            <Kpi
              icon="💰"
              label="Faturado"
              value={formatarMoeda(totaisMaquinas.faturado)}
              tone="amber"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Kpi
              icon="🧾"
              label="Movimentações"
              value={movEstoqueFiltradas.length}
            />
            <Kpi
              icon="📥"
              label="Itens de entrada"
              value={totaisEstoque.entrada}
              tone="green"
            />
            <Kpi
              icon="📤"
              label="Itens de saída"
              value={totaisEstoque.saida}
              tone="red"
            />
            <Kpi
              icon="🏪"
              label="Lojas / produtos"
              value={`${totaisEstoque.lojas.size} / ${totaisEstoque.produtos.size}`}
            />
          </div>
        )}

        {/* Lista */}
        {aba === "maquinas" ? (
          carregandoMaquinas ? (
            <div className="py-16">
              <LoadingSpinner message="Carregando movimentações..." />
            </div>
          ) : gruposMaquinas.length === 0 ? (
            <Vazio
              titulo="Nenhuma movimentação neste período"
              mensagem="Tente outro período, outra loja ou limpe os filtros."
            />
          ) : (
            <div className="space-y-6">
              {gruposMaquinas.map(({ dia, itens }) => (
                <section key={dia}>
                  <CabecalhoDia
                    dia={dia}
                    quantidade={itens.length}
                    resumo={
                      <span className="flex gap-3 tabular-nums">
                        <span className="text-red-600 font-semibold">
                          −
                          {itens.reduce((s, m) => s + numero(m.sairam), 0)}{" "}
                          saíram
                        </span>
                        <span className="text-emerald-600 font-semibold">
                          +
                          {itens.reduce(
                            (s, m) => s + numero(m.abastecidas),
                            0,
                          )}{" "}
                          abastecidos
                        </span>
                        <span className="text-blue-600 font-semibold">
                          {itens.reduce((s, m) => s + numero(m.fichas), 0)}{" "}
                          fichas
                        </span>
                      </span>
                    }
                  />
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100 overflow-hidden">
                    {itens.map((mov) => (
                      <LinhaMaquina
                        key={mov.id}
                        mov={mov}
                        info={infoMov(mov)}
                        aberto={expandidos.has(mov.id)}
                        onToggle={() => alternarExpandido(mov.id)}
                        onEditar={ehAdmin ? () => iniciarEdicao(mov) : null}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )
        ) : gruposEstoque.length === 0 ? (
          <Vazio
            titulo="Nenhuma movimentação de estoque neste período"
            mensagem="Tente outro período, outra loja ou limpe os filtros."
          />
        ) : (
          <div className="space-y-6">
            {gruposEstoque.map(({ dia, itens }) => (
              <section key={dia}>
                <CabecalhoDia
                  dia={dia}
                  quantidade={itens.length}
                  resumo={
                    <span className="flex gap-3 tabular-nums">
                      <span className="text-emerald-600 font-semibold">
                        +
                        {itens.reduce(
                          (s, m) =>
                            s + somarItens(m.produtosEnviados || [], "entrada"),
                          0,
                        )}{" "}
                        entrada
                      </span>
                      <span className="text-red-600 font-semibold">
                        −
                        {itens.reduce(
                          (s, m) =>
                            s + somarItens(m.produtosEnviados || [], "saida"),
                          0,
                        )}{" "}
                        saída
                      </span>
                    </span>
                  }
                />
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100 overflow-hidden">
                  {itens.map((mov) => (
                    <LinhaEstoque
                      key={mov.id}
                      mov={mov}
                      nomeProduto={nomeProdutoEstoque}
                      somarItens={somarItens}
                      onEditar={ehAdmin ? () => setEditandoEstoque(mov) : null}
                      onExcluir={
                        ehAdmin ? () => setExcluindoEstoque(mov) : null
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Modal: editar movimentação de máquina */}
      <Modal
        isOpen={!!editandoMov}
        onClose={() => setEditandoMov(null)}
        title="✏️ Editar movimentação"
        size="sm"
      >
        {editandoMov && (
          <div className="space-y-4 text-left">
            <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              <p>
                <strong>Máquina:</strong>{" "}
                {infoMov(editandoMov).maquina.codigo || "N/A"} ·{" "}
                {infoMov(editandoMov).loja?.nome || "-"}
              </p>
              <p>
                <strong>Data:</strong>{" "}
                {new Date(dataMovMaquina(editandoMov)).toLocaleString("pt-BR")}
              </p>
            </div>
            {[
              { campo: "fichas", label: "🎫 Fichas", step: "1" },
              { campo: "abastecidas", label: "📥 Abastecidas", step: "1" },
              {
                campo: "quantidade_notas_entrada",
                label: "💵 Notas",
                step: "1",
              },
              {
                campo: "valor_entrada_maquininha_pix",
                label: "💳 Digital (Pix/Maquininha) R$",
                step: "0.01",
              },
            ].map(({ campo, label, step }) => (
              <div key={campo}>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {label}
                </label>
                <input
                  type="number"
                  min="0"
                  step={step}
                  value={formEdicao[campo]}
                  onChange={(e) =>
                    setFormEdicao((prev) => ({
                      ...prev,
                      [campo]: e.target.value,
                    }))
                  }
                  className="input-field"
                />
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setEditandoMov(null)}
                className="flex-1 btn-secondary"
              >
                Cancelar
              </button>
              <button onClick={salvarEdicao} className="flex-1 btn-primary">
                Salvar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: editar movimentação de estoque */}
      <Modal
        isOpen={!!editandoEstoque}
        onClose={() => setEditandoEstoque(null)}
        title="✏️ Editar produtos"
        size="sm"
      >
        {editandoEstoque && (
          <form onSubmit={salvarEdicaoEstoque} className="text-left">
            <p className="mb-4 text-sm text-slate-600">
              <strong>{editandoEstoque.loja?.nome || "-"}</strong> ·{" "}
              {editandoEstoque.dataMovimentacao
                ? new Date(editandoEstoque.dataMovimentacao).toLocaleString(
                    "pt-BR",
                  )
                : "-"}
            </p>
            <div className="space-y-2">
              {(editandoEstoque.produtosEnviados || []).map((prod, idx) => (
                <div key={prod.id || idx} className="flex gap-2 items-center">
                  <span className="flex-1 text-sm font-medium text-slate-700 truncate">
                    {nomeProdutoEstoque(prod).emoji}{" "}
                    {nomeProdutoEstoque(prod).nome}
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={prod.quantidade}
                    onChange={(e) =>
                      atualizarItemEstoque(idx, "quantidade", e.target.value)
                    }
                    className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  />
                  <select
                    value={prod.tipoMovimentacao || "saida"}
                    onChange={(e) =>
                      atualizarItemEstoque(
                        idx,
                        "tipoMovimentacao",
                        e.target.value,
                      )
                    }
                    className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  >
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                  </select>
                </div>
              ))}
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button
                type="button"
                onClick={() => setEditandoEstoque(null)}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primary">
                Salvar
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!excluindoEstoque}
        onClose={() => setExcluindoEstoque(null)}
        onConfirm={confirmarExclusaoEstoque}
        title="Excluir movimentação?"
        message={`A movimentação de ${excluindoEstoque?.loja?.nome || "estoque"} será excluída e o estoque da loja ajustado. Esta ação não pode ser desfeita.`}
        confirmText="Sim, excluir"
      />

      <Footer />
    </div>
  );
}

function LinhaMaquina({ mov, info, aberto, onToggle, onEditar }) {
  const { maquina, loja, produto } = info;
  const sairam = numero(mov.sairam);
  const abastecidas = numero(mov.abastecidas);
  const temObs = !!mov.observacoes?.trim();

  return (
    <div className={aberto ? "bg-amber-50/40" : ""}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors grid grid-cols-[auto_1fr_auto] md:grid-cols-[56px_minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-2"
        aria-expanded={aberto}
      >
        <span className="text-sm font-bold text-slate-700 tabular-nums">
          {formatarHora(dataMovMaquina(mov))}
        </span>

        <div className="min-w-0">
          <p className="font-semibold text-slate-900 truncate">
            {maquina.codigo || "Máquina"}
            {maquina.nome && maquina.nome !== maquina.codigo && (
              <span className="ml-1.5 text-sm font-normal text-slate-500">
                {maquina.nome}
              </span>
            )}
          </p>
          <p className="text-xs text-slate-500 truncate">
            🏪 {loja?.nome || "-"} · 👤 {mov.usuario?.nome || "Não informado"}
          </p>
        </div>

        <div className="hidden md:flex items-center gap-2 min-w-0">
          <span className="text-xl">{produto?.emoji || "🧸"}</span>
          <span className="text-sm text-slate-700 truncate">
            {produto?.nome || "Sem produto"}
          </span>
          {mov.retiradaEstoque && (
            <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
              Retirada
            </span>
          )}
          {temObs && (
            <span className="shrink-0" title={mov.observacoes}>
              💬
            </span>
          )}
        </div>

        <div className="col-span-3 md:col-span-1 row-start-2 md:row-start-auto flex items-center justify-around md:justify-end gap-2 rounded-xl bg-slate-50 md:bg-transparent py-1.5 md:py-0">
          <Metrica
            label="Saíram"
            value={sairam > 0 ? `−${sairam}` : "0"}
            tone={sairam > 0 ? "red" : "muted"}
            destaque
          />
          <Metrica
            label="Abast."
            value={abastecidas > 0 ? `+${abastecidas}` : "0"}
            tone={abastecidas > 0 ? "green" : "muted"}
            destaque
          />
          <Metrica
            label="Fichas"
            value={numero(mov.fichas)}
            tone={numero(mov.fichas) > 0 ? "blue" : "muted"}
          />
          <Metrica
            label="Estoque"
            value={
              mov.totalPos !== null && mov.totalPos !== undefined
                ? mov.totalPos
                : "-"
            }
          />
        </div>

        <span className="col-start-3 row-start-1 md:col-start-auto md:row-start-auto">
          <Chevron aberto={aberto} />
        </span>
      </button>

      {aberto && (
        <div className="px-4 pb-4">
          <div className="md:hidden mb-3 flex items-center gap-2 text-sm text-slate-700">
            <span className="text-lg">{produto?.emoji || "🧸"}</span>
            {produto?.nome || "Sem produto"}
            {mov.retiradaEstoque && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                Retirada de estoque
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <Detalhe
              label="Estoque"
              value={`${mov.totalPre ?? "-"} → ${mov.totalPos ?? "-"}`}
            />
            <Detalhe label="Contador IN" value={mov.contadorIn ?? "-"} />
            <Detalhe label="Contador OUT" value={mov.contadorOut ?? "-"} />
            <Detalhe label="Notas" value={mov.quantidade_notas_entrada ?? "-"} />
            <Detalhe
              label="Digital"
              value={
                mov.valor_entrada_maquininha_pix != null
                  ? formatarMoeda(mov.valor_entrada_maquininha_pix)
                  : "-"
              }
            />
            <Detalhe
              label="Faturado"
              value={
                mov.valorFaturado != null ? formatarMoeda(mov.valorFaturado) : "-"
              }
            />
            <Detalhe
              label="Fichas por prêmio"
              value={
                sairam > 0 ? (numero(mov.fichas) / sairam).toFixed(1) : "-"
              }
            />
            <Detalhe
              label="Registrado em"
              value={new Date(dataMovMaquina(mov)).toLocaleString("pt-BR")}
            />
          </div>
          {temObs && (
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              💬 {mov.observacoes}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {maquina.id && (
              <Link
                to={`/maquinas/${maquina.id}`}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                🎮 Ver máquina
              </Link>
            )}
            {onEditar && (
              <button
                type="button"
                onClick={onEditar}
                className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-600"
              >
                ✏️ Editar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LinhaEstoque({ mov, nomeProduto, somarItens, onEditar, onExcluir }) {
  const itens = mov.produtosEnviados || [];
  const entrada = somarItens(itens, "entrada");
  const saida = somarItens(itens, "saida");

  return (
    <div className="px-4 py-3 grid grid-cols-[auto_1fr] md:grid-cols-[56px_minmax(0,220px)_1fr_auto] gap-x-4 gap-y-2 items-start">
      <span className="text-sm font-bold text-slate-700 tabular-nums pt-0.5">
        {mov.dataMovimentacao ? formatarHora(mov.dataMovimentacao) : "-"}
      </span>

      <div className="min-w-0">
        <p className="font-semibold text-slate-900 truncate">
          🏪 {mov.loja?.nome || "-"}
        </p>
        <p className="text-xs text-slate-500 truncate">
          👤 {mov.usuario?.nome || "-"}
        </p>
        <p className="text-xs mt-0.5 tabular-nums">
          {entrada > 0 && (
            <span className="text-emerald-600 font-semibold mr-2">
              +{entrada}
            </span>
          )}
          {saida > 0 && (
            <span className="text-red-600 font-semibold">−{saida}</span>
          )}
        </p>
      </div>

      <div className="col-span-2 md:col-span-1 flex flex-wrap gap-1.5">
        {itens.length === 0 && (
          <span className="text-sm text-slate-400">Nenhum produto</span>
        )}
        {itens.map((p, idx) => {
          const { nome, emoji } = nomeProduto(p);
          const ehEntrada = (p.tipoMovimentacao || "saida") === "entrada";
          return (
            <span
              key={p.id || idx}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm ${
                ehEntrada
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
              title={ehEntrada ? "Entrada" : "Saída"}
            >
              <span>{emoji}</span>
              <span className="max-w-[180px] truncate">{nome}</span>
              <span className="font-bold tabular-nums">
                {ehEntrada ? "+" : "−"}
                {p.quantidade}
              </span>
            </span>
          );
        })}
        {mov.observacao && (
          <span className="w-full text-xs text-slate-500">
            💬 {mov.observacao}
          </span>
        )}
      </div>

      {(onEditar || onExcluir) && (
        <div className="col-span-2 md:col-span-1 flex gap-1 justify-end">
          {onEditar && (
            <button
              type="button"
              onClick={onEditar}
              className="rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-amber-50 hover:text-amber-700"
              title="Editar"
            >
              ✏️ <span className="md:hidden">Editar</span>
            </button>
          )}
          {onExcluir && (
            <button
              type="button"
              onClick={onExcluir}
              className="rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-red-50 hover:text-red-700"
              title="Excluir"
            >
              🗑️ <span className="md:hidden">Excluir</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
