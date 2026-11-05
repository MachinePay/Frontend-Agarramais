import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageLoader } from "../components/Loading";
import { AlertBox, Modal, PageHeader } from "../components/UIComponents";

const PRIORIDADES = {
  URGENTE: {
    label: "Urgente",
    ordem: 0,
    faixa: "border-l-red-600",
    chip: "bg-red-600 text-white",
    botao: "border-red-500 bg-red-50 text-red-700",
  },
  ALTA: {
    label: "Alta",
    ordem: 1,
    faixa: "border-l-orange-500",
    chip: "bg-orange-100 text-orange-800",
    botao: "border-orange-400 bg-orange-50 text-orange-700",
  },
  MEDIA: {
    label: "Média",
    ordem: 2,
    faixa: "border-l-amber-400",
    chip: "bg-amber-100 text-amber-800",
    botao: "border-amber-400 bg-amber-50 text-amber-700",
  },
  BAIXA: {
    label: "Baixa",
    ordem: 3,
    faixa: "border-l-slate-300",
    chip: "bg-slate-100 text-slate-600",
    botao: "border-slate-400 bg-slate-50 text-slate-700",
  },
};
const ORDEM_PRIORIDADES = ["URGENTE", "ALTA", "MEDIA", "BAIXA"];

// Problemas mais comuns: um toque preenche o título e sugere a prioridade.
const MODELOS = [
  { icon: "🎯", titulo: "Garra fraca", prioridade: "ALTA" },
  { icon: "🔒", titulo: "Trava / fechadura", prioridade: "ALTA" },
  { icon: "⛔", titulo: "Máquina parada", prioridade: "URGENTE" },
  { icon: "💵", titulo: "Noteiro / moedeiro", prioridade: "ALTA" },
  { icon: "📟", titulo: "Placa de pagamento", prioridade: "ALTA" },
  { icon: "💡", titulo: "Iluminação", prioridade: "MEDIA" },
  { icon: "🧽", titulo: "Limpeza / vidro", prioridade: "BAIXA" },
];

const ABAS = [
  { id: "ABERTAS", label: "Abertas", icon: "🛠️" },
  { id: "RESOLVIDAS", label: "Resolvidas", icon: "✅" },
  { id: "TODAS", label: "Todas", icon: "📋" },
];

const FORM_VAZIO = {
  titulo: "",
  descricao: "",
  lojaId: "",
  maquinaId: "",
  prioridade: "MEDIA",
  prazo: "",
  funcionariosIds: [],
  custo: "",
};

// --- Datas ---

const isoLocal = (data) => {
  const d = new Date(data);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const hojeIso = () => isoLocal(new Date());
const diasAPartirDeHoje = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return isoLocal(d);
};
const diasEntre = (isoA, isoB) =>
  Math.round(
    (new Date(`${isoB}T12:00:00`) - new Date(`${isoA}T12:00:00`)) / 86400000,
  );

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

const duracao = (inicio, fim) => {
  const horas = (new Date(fim) - new Date(inicio)) / 3600000;
  if (!Number.isFinite(horas) || horas < 0) return null;
  if (horas < 1) return "menos de 1h";
  if (horas < 24) return `${Math.round(horas)}h`;
  const dias = Math.round(horas / 24);
  return dias === 1 ? "1 dia" : `${dias} dias`;
};

// Situação do prazo de uma manutenção aberta.
const situacaoPrazo = (item) => {
  if (!item.prazo || item.status === "RESOLVIDA") return null;
  const dias = diasEntre(hojeIso(), item.prazo);
  if (dias < 0)
    return {
      atrasada: true,
      texto: `Atrasada ${-dias} dia${dias === -1 ? "" : "s"}`,
      classe: "bg-red-100 text-red-700",
    };
  if (dias === 0)
    return { texto: "Vence hoje", classe: "bg-orange-100 text-orange-700" };
  if (dias === 1)
    return { texto: "Vence amanhã", classe: "bg-amber-100 text-amber-700" };
  return {
    texto: `Prazo ${new Date(`${item.prazo}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`,
    classe: "bg-slate-100 text-slate-600",
  };
};

const iniciais = (nome) =>
  String(nome || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

const normalizar = (texto) =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const formatarMoeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

// --- Componentes ---

function Kpi({ icon, label, valor, tom = "text-slate-900", onClick, ativo }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-2xl border bg-white px-4 py-3 text-left shadow-sm transition-all ${
        ativo ? "border-amber-400 ring-2 ring-amber-200" : "border-slate-200"
      } ${onClick ? "hover:shadow-md" : "cursor-default"}`}
    >
      <p className="text-xs font-semibold text-slate-500">
        {icon} {label}
      </p>
      <p className={`mt-0.5 text-2xl font-bold tabular-nums ${tom}`}>{valor}</p>
    </button>
  );
}

function Avatares({ pessoas }) {
  if (!pessoas?.length) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {pessoas.slice(0, 4).map((p) => (
          <span
            key={p.id}
            title={p.nome}
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-indigo-100 text-[11px] font-bold text-indigo-700"
          >
            {iniciais(p.nome)}
          </span>
        ))}
        {pessoas.length > 4 && (
          <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[11px] font-bold text-slate-600">
            +{pessoas.length - 4}
          </span>
        )}
      </div>
      <span className="truncate text-xs text-slate-500">
        {pessoas.map((p) => p.nome.split(" ")[0]).join(", ")}
      </span>
    </div>
  );
}

function CartaoManutencao({ item, isAdmin, podeResolver, onResolver, onEditar }) {
  const [expandido, setExpandido] = useState(false);
  const prioridade = PRIORIDADES[item.prioridade] || PRIORIDADES.MEDIA;
  const prazo = situacaoPrazo(item);
  const resolvida = item.status === "RESOLVIDA";
  const descricaoLonga = (item.descricao || "").length > 180;

  return (
    <article
      className={`rounded-2xl border border-slate-200 border-l-4 ${
        resolvida ? "border-l-emerald-400 bg-white/80" : prioridade.faixa
      } bg-white shadow-sm transition-shadow hover:shadow-md ${
        prazo?.atrasada ? "ring-1 ring-red-200" : ""
      }`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          {resolvida ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
              ✓ Resolvida
            </span>
          ) : (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${prioridade.chip}`}
            >
              {prioridade.label}
            </span>
          )}
          {prazo && (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${prazo.classe}`}
            >
              ⏰ {prazo.texto}
            </span>
          )}
          <span
            className="text-xs text-slate-400"
            title={new Date(item.createdAt).toLocaleString("pt-BR")}
          >
            aberta {tempoRelativo(item.createdAt)}
            {item.criadoPor?.nome && ` por ${item.criadoPor.nome}`}
          </span>
        </div>

        <h3
          className={`mt-2 text-lg font-bold ${
            resolvida ? "text-slate-500" : "text-slate-900"
          }`}
        >
          {item.titulo}
        </h3>
        <p className="text-sm text-slate-500">
          🏪 {item.loja?.nome || "Sem loja"}
          {item.maquina && (
            <>
              {" · "}
              <Link
                to={`/maquinas/${item.maquina.id}`}
                className="font-semibold text-slate-700 hover:text-amber-700"
              >
                🎮 {item.maquina.nome}
              </Link>
            </>
          )}
        </p>

        {item.descricao && (
          <div className="mt-2">
            <p
              className={`whitespace-pre-line text-sm text-slate-700 ${
                expandido ? "" : "line-clamp-3"
              }`}
            >
              {item.descricao}
            </p>
            {descricaoLonga && (
              <button
                type="button"
                onClick={() => setExpandido((v) => !v)}
                className="mt-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                {expandido ? "Ver menos" : "Ver mais"}
              </button>
            )}
          </div>
        )}

        {resolvida && (
          <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-sm">
            {item.solucao ? (
              <p className="text-emerald-900 whitespace-pre-line">
                🔧 {item.solucao}
              </p>
            ) : (
              <p className="text-emerald-800/70 italic">
                Sem descrição do que foi feito.
              </p>
            )}
            <p className="mt-1 text-xs text-emerald-700">
              Resolvida por <strong>{item.resolvidoPor?.nome || "-"}</strong>{" "}
              {tempoRelativo(item.resolvidoEm)}
              {duracao(item.createdAt, item.resolvidoEm) &&
                ` · levou ${duracao(item.createdAt, item.resolvidoEm)}`}
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <Avatares pessoas={item.funcionariosPermitidos} />
          </div>
          {isAdmin && item.custo !== null && item.custo !== undefined && (
            <span className="text-xs font-semibold text-slate-500">
              💰 {formatarMoeda(item.custo)}
            </span>
          )}
          {isAdmin && !resolvida && (
            <button
              type="button"
              onClick={() => onEditar(item)}
              className="rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              ✏️ Editar
            </button>
          )}
          {podeResolver && (
            <button
              type="button"
              onClick={() => onResolver(item)}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-emerald-700"
            >
              ✓ Concluir
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function FormularioManutencao({
  inicial,
  editando,
  lojas,
  maquinas,
  funcionarios,
  salvando,
  onCancelar,
  onSalvar,
}) {
  const [form, setForm] = useState(inicial);
  const [buscaPessoa, setBuscaPessoa] = useState("");
  const atualizar = (campo, valor) =>
    setForm((prev) => ({ ...prev, [campo]: valor }));

  const maquinasDaLoja = maquinas.filter(
    (m) => !form.lojaId || String(m.lojaId) === String(form.lojaId),
  );
  const pessoasFiltradas = funcionarios.filter((f) =>
    normalizar(f.nome).includes(normalizar(buscaPessoa)),
  );
  const alternarPessoa = (id) =>
    atualizar(
      "funcionariosIds",
      form.funcionariosIds.includes(id)
        ? form.funcionariosIds.filter((x) => x !== id)
        : [...form.funcionariosIds, id],
    );

  const prazos = [
    { label: "Sem prazo", valor: "" },
    { label: "Hoje", valor: diasAPartirDeHoje(0) },
    { label: "Amanhã", valor: diasAPartirDeHoje(1) },
    { label: "3 dias", valor: diasAPartirDeHoje(3) },
    { label: "1 semana", valor: diasAPartirDeHoje(7) },
  ];

  const faltando = [
    !form.titulo.trim() && "título",
    !form.descricao.trim() && "descrição",
    form.funcionariosIds.length === 0 && "quem vai resolver",
  ].filter(Boolean);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (faltando.length === 0) onSalvar(form);
      }}
      className="space-y-5 text-left"
    >
      {!editando && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Problema comum
          </p>
          <div className="flex flex-wrap gap-2">
            {MODELOS.map((m) => (
              <button
                key={m.titulo}
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    titulo: m.titulo,
                    prioridade: m.prioridade,
                  }))
                }
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  form.titulo === m.titulo
                    ? "border-amber-400 bg-amber-50 font-semibold text-amber-800"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {m.icon} {m.titulo}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700">
          O que precisa ser feito? *
        </label>
        <input
          value={form.titulo}
          onChange={(e) => atualizar("titulo", e.target.value)}
          className="input-field"
          placeholder="Ex: Trocar trava da máquina 12"
          maxLength={150}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700">
          Detalhes *
        </label>
        <textarea
          value={form.descricao}
          onChange={(e) => atualizar("descricao", e.target.value)}
          className="input-field min-h-24"
          placeholder="O que está acontecendo, desde quando, o que já foi tentado..."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            🏪 Loja
          </label>
          <select
            value={form.lojaId}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                lojaId: e.target.value,
                maquinaId: "",
              }))
            }
            className="select-field"
          >
            <option value="">Sem loja</option>
            {lojas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            🎮 Máquina
          </label>
          <select
            value={form.maquinaId}
            onChange={(e) => {
              const m = maquinas.find(
                (x) => String(x.id) === e.target.value,
              );
              setForm((prev) => ({
                ...prev,
                maquinaId: e.target.value,
                lojaId: m ? String(m.lojaId) : prev.lojaId,
              }));
            }}
            className="select-field"
          >
            <option value="">
              {form.lojaId ? "Nenhuma (problema da loja)" : "Escolha a loja ou a máquina"}
            </option>
            {maquinasDaLoja.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
                {!form.lojaId && m.loja?.nome ? ` · ${m.loja.nome}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">Prioridade</p>
        <div className="grid grid-cols-4 gap-2">
          {ORDEM_PRIORIDADES.map((id) => {
            const p = PRIORIDADES[id];
            const ativo = form.prioridade === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => atualizar("prioridade", id)}
                className={`rounded-xl border-2 py-2 text-sm font-semibold transition-colors ${
                  ativo ? p.botao : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">Prazo</p>
        <div className="flex flex-wrap items-center gap-2">
          {prazos.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => atualizar("prazo", p.valor)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                form.prazo === p.valor
                  ? "border-amber-400 bg-amber-50 font-semibold text-amber-800"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p.label}
            </button>
          ))}
          <input
            type="date"
            value={form.prazo}
            min={hojeIso()}
            onChange={(e) => atualizar("prazo", e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            aria-label="Outra data"
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-700">
            👷 Quem vai resolver? *
            {form.funcionariosIds.length > 0 && (
              <span className="ml-2 font-normal text-slate-500">
                {form.funcionariosIds.length} selecionado(s)
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={() =>
              atualizar(
                "funcionariosIds",
                form.funcionariosIds.length === funcionarios.length
                  ? []
                  : funcionarios.map((f) => f.id),
              )
            }
            className="text-xs font-semibold text-blue-700 hover:text-blue-800"
          >
            {form.funcionariosIds.length === funcionarios.length
              ? "Desmarcar todos"
              : "Marcar todos"}
          </button>
        </div>
        {funcionarios.length > 8 && (
          <input
            type="search"
            value={buscaPessoa}
            onChange={(e) => setBuscaPessoa(e.target.value)}
            placeholder="Buscar pessoa..."
            className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        )}
        <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
          {pessoasFiltradas.map((f) => {
            const ativo = form.funcionariosIds.includes(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => alternarPessoa(f.id)}
                className={`inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition-colors ${
                  ativo
                    ? "border-indigo-400 bg-indigo-50 font-semibold text-indigo-800"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                    ativo ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {ativo ? "✓" : iniciais(f.nome)}
                </span>
                {f.nome}
              </button>
            );
          })}
          {funcionarios.length === 0 && (
            <p className="text-sm text-slate-500">
              Nenhum operador ou suporte ativo cadastrado.
            </p>
          )}
        </div>
      </div>

      {!editando && (
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            💰 Custo (opcional)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.custo}
            onChange={(e) => atualizar("custo", e.target.value)}
            className="input-field sm:max-w-xs"
            placeholder="0,00"
          />
          <p className="mt-1 text-xs text-slate-500">
            Vira gasto variável da loja. Se ainda não sabe, informe ao
            concluir.
          </p>
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 border-t border-slate-100 pt-4">
        {faltando.length > 0 && (
          <p className="text-xs text-slate-500 sm:mr-auto">
            Falta: {faltando.join(", ")}
          </p>
        )}
        <button
          type="button"
          onClick={onCancelar}
          className="btn-secondary sm:ml-auto"
          disabled={salvando}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="btn-primary disabled:opacity-50"
          disabled={salvando || faltando.length > 0}
        >
          {salvando
            ? "Salvando..."
            : editando
              ? "Salvar alterações"
              : "Abrir manutenção"}
        </button>
      </div>
    </form>
  );
}

export default function ManutencaoPage() {
  const { usuario, loading: authLoading } = useAuth();
  const isAdmin = usuario?.role === "ADMIN";

  const [manutencoes, setManutencoes] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [aba, setAba] = useState("ABERTAS");
  const [busca, setBusca] = useState("");
  const [filtroLoja, setFiltroLoja] = useState("");
  const [filtroMaquina, setFiltroMaquina] = useState("");
  const [filtroPessoa, setFiltroPessoa] = useState("");
  const [filtroPrioridade, setFiltroPrioridade] = useState("");
  const [soAtrasadas, setSoAtrasadas] = useState(false);

  const [formAberto, setFormAberto] = useState(null); // { inicial, editandoId }
  const [salvando, setSalvando] = useState(false);
  const [concluindo, setConcluindo] = useState(null);
  const [solucao, setSolucao] = useState("");
  const [custoConclusao, setCustoConclusao] = useState("");

  useEffect(() => {
    if (authLoading) return;
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  const carregarDados = async () => {
    try {
      const requisicoes = [api.get("/manutencoes")];
      if (isAdmin) {
        requisicoes.push(
          api.get("/manutencoes/funcionarios"),
          api.get("/lojas"),
          api.get("/maquinas"),
        );
      }
      const [manutRes, funcRes, lojasRes, maqRes] = await Promise.all(requisicoes);
      setManutencoes(Array.isArray(manutRes.data) ? manutRes.data : []);
      if (isAdmin) {
        setFuncionarios(funcRes.data || []);
        setLojas((lojasRes.data || []).filter((l) => l.ativo !== false));
        setMaquinas(maqRes.data || []);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao carregar manutenções");
    } finally {
      setLoading(false);
    }
  };

  // Alertas automáticos (origem ALERTA_*, ex: CompactPay) ficam na página
  // de Alertas; aqui só manutenção de verdade.
  const reais = useMemo(
    () => manutencoes.filter((m) => !m.origem?.startsWith("ALERTA_")),
    [manutencoes],
  );

  const resumo = useMemo(() => {
    const abertas = reais.filter((m) => m.status !== "RESOLVIDA");
    const limite30 = Date.now() - 30 * 86400000;
    const resolvidas30 = reais.filter(
      (m) =>
        m.status === "RESOLVIDA" &&
        new Date(m.resolvidoEm).getTime() >= limite30,
    );
    const horas = resolvidas30
      .map((m) => (new Date(m.resolvidoEm) - new Date(m.createdAt)) / 3600000)
      .filter((h) => Number.isFinite(h) && h >= 0);
    const mediaHoras = horas.length
      ? horas.reduce((a, b) => a + b, 0) / horas.length
      : null;
    return {
      abertas: abertas.length,
      urgentes: abertas.filter((m) => ["URGENTE", "ALTA"].includes(m.prioridade))
        .length,
      atrasadas: abertas.filter((m) => situacaoPrazo(m)?.atrasada).length,
      resolvidas30: resolvidas30.length,
      tempoMedio:
        mediaHoras === null
          ? "-"
          : mediaHoras < 24
            ? `${Math.round(mediaHoras)}h`
            : `${Math.round(mediaHoras / 24)}d`,
    };
  }, [reais]);

  const contagemAbas = {
    ABERTAS: reais.filter((m) => m.status !== "RESOLVIDA").length,
    RESOLVIDAS: reais.filter((m) => m.status === "RESOLVIDA").length,
    TODAS: reais.length,
  };

  const maquinasComManutencao = useMemo(() => {
    const mapa = new Map();
    reais
      .filter((m) => !filtroLoja || m.loja?.id === filtroLoja)
      .forEach((m) => m.maquina && mapa.set(m.maquina.id, m.maquina.nome));
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [reais, filtroLoja]);

  const visiveis = useMemo(() => {
    const termo = normalizar(busca);
    return reais
      .filter((m) =>
        aba === "ABERTAS"
          ? m.status !== "RESOLVIDA"
          : aba === "RESOLVIDAS"
            ? m.status === "RESOLVIDA"
            : true,
      )
      .filter((m) => !filtroLoja || m.loja?.id === filtroLoja)
      .filter((m) => !filtroMaquina || m.maquina?.id === filtroMaquina)
      .filter(
        (m) =>
          !filtroPessoa ||
          (m.funcionariosPermitidos || []).some((f) => f.id === filtroPessoa),
      )
      .filter((m) => !filtroPrioridade || m.prioridade === filtroPrioridade)
      .filter((m) => !soAtrasadas || situacaoPrazo(m)?.atrasada)
      .filter(
        (m) =>
          !termo ||
          normalizar(
            [
              m.titulo,
              m.descricao,
              m.solucao,
              m.loja?.nome,
              m.maquina?.nome,
              ...(m.funcionariosPermitidos || []).map((f) => f.nome),
            ].join(" "),
          ).includes(termo),
      )
      .sort((a, b) => {
        const resolvidaA = a.status === "RESOLVIDA";
        const resolvidaB = b.status === "RESOLVIDA";
        if (resolvidaA !== resolvidaB) return resolvidaA ? 1 : -1;
        if (resolvidaA)
          return new Date(b.resolvidoEm) - new Date(a.resolvidoEm);
        // Abertas: atrasadas, depois prioridade, depois prazo, depois idade.
        const atrasoA = situacaoPrazo(a)?.atrasada ? 0 : 1;
        const atrasoB = situacaoPrazo(b)?.atrasada ? 0 : 1;
        if (atrasoA !== atrasoB) return atrasoA - atrasoB;
        const pa = PRIORIDADES[a.prioridade]?.ordem ?? 2;
        const pb = PRIORIDADES[b.prioridade]?.ordem ?? 2;
        if (pa !== pb) return pa - pb;
        if (a.prazo !== b.prazo) {
          if (!a.prazo) return 1;
          if (!b.prazo) return -1;
          return a.prazo.localeCompare(b.prazo);
        }
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
  }, [
    reais,
    aba,
    busca,
    filtroLoja,
    filtroMaquina,
    filtroPessoa,
    filtroPrioridade,
    soAtrasadas,
  ]);

  const filtrosAtivos =
    !!busca ||
    !!filtroLoja ||
    !!filtroMaquina ||
    !!filtroPessoa ||
    !!filtroPrioridade ||
    soAtrasadas;

  const limparFiltros = () => {
    setBusca("");
    setFiltroLoja("");
    setFiltroMaquina("");
    setFiltroPessoa("");
    setFiltroPrioridade("");
    setSoAtrasadas(false);
  };

  const substituir = (atualizada) =>
    setManutencoes((prev) => {
      const existe = prev.some((m) => m.id === atualizada.id);
      return existe
        ? prev.map((m) => (m.id === atualizada.id ? atualizada : m))
        : [atualizada, ...prev];
    });

  // --- Ações ---

  const abrirNova = () => setFormAberto({ inicial: FORM_VAZIO, editandoId: null });

  const abrirEdicao = (item) =>
    setFormAberto({
      editandoId: item.id,
      inicial: {
        ...FORM_VAZIO,
        titulo: item.titulo || "",
        descricao: item.descricao || "",
        lojaId: item.loja?.id ? String(item.loja.id) : "",
        maquinaId: item.maquina?.id ? String(item.maquina.id) : "",
        prioridade: item.prioridade || "MEDIA",
        prazo: item.prazo || "",
        funcionariosIds: (item.funcionariosPermitidos || []).map((f) => f.id),
      },
    });

  const salvar = async (form) => {
    setSalvando(true);
    setError("");
    try {
      const corpo = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        maquinaId: form.maquinaId || null,
        prioridade: form.prioridade,
        prazo: form.prazo || null,
        funcionariosIds: form.funcionariosIds,
      };
      if (formAberto.editandoId) {
        const res = await api.put(
          `/manutencoes/${formAberto.editandoId}`,
          corpo,
        );
        substituir(res.data);
        setSuccess("✏️ Manutenção atualizada.");
      } else {
        const custo = form.custo !== "" ? Number(form.custo) : null;
        if (custo > 0 && !form.lojaId && !form.maquinaId) {
          setError("Para lançar o custo, escolha a loja ou a máquina.");
          setSalvando(false);
          return;
        }
        const res = await api.post("/manutencoes", {
          ...corpo,
          lojaId: form.lojaId || null,
          custo,
        });
        substituir(res.data);
        setAba("ABERTAS");
        setSuccess(`🛠️ Manutenção "${corpo.titulo}" aberta.`);
      }
      setFormAberto(null);
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao salvar manutenção");
    } finally {
      setSalvando(false);
    }
  };

  const abrirConclusao = (item) => {
    setConcluindo(item);
    setSolucao("");
    setCustoConclusao("");
  };

  const concluir = async () => {
    if (!concluindo) return;
    setSalvando(true);
    setError("");
    try {
      const res = await api.patch(`/manutencoes/${concluindo.id}/resolver`, {
        solucao,
        ...(isAdmin && custoConclusao !== "" && { custo: Number(custoConclusao) }),
      });
      substituir(res.data);
      setSuccess(`✅ "${concluindo.titulo}" concluída.`);
      setConcluindo(null);
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao concluir manutenção");
    } finally {
      setSalvando(false);
    }
  };

  if (loading || authLoading) return <PageLoader />;

  const podeResolver = (item) =>
    item.status === "PENDENTE" &&
    (isAdmin ||
      (item.funcionariosPermitidos || []).some((f) => f.id === usuario?.id));

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Manutenção"
          subtitle={
            isAdmin
              ? "Abra, acompanhe e feche os consertos das lojas"
              : "Os consertos que estão com você"
          }
          icon="🛠️"
          action={
            isAdmin && (
              <button type="button" onClick={abrirNova} className="btn-primary">
                + Nova manutenção
              </button>
            )
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

        {/* Resumo */}
        <div
          className={`mb-5 grid gap-3 ${
            isAdmin ? "grid-cols-2 md:grid-cols-5" : "grid-cols-3"
          }`}
        >
          <Kpi
            icon="🛠️"
            label="Abertas"
            valor={resumo.abertas}
            onClick={() => {
              limparFiltros();
              setAba("ABERTAS");
            }}
            ativo={aba === "ABERTAS" && !filtrosAtivos}
          />
          <Kpi
            icon="🔥"
            label="Urgentes / altas"
            valor={resumo.urgentes}
            tom={resumo.urgentes ? "text-orange-600" : "text-slate-300"}
          />
          <Kpi
            icon="⏰"
            label="Atrasadas"
            valor={resumo.atrasadas}
            tom={resumo.atrasadas ? "text-red-600" : "text-slate-300"}
            onClick={() => {
              setAba("ABERTAS");
              setSoAtrasadas((v) => !v);
            }}
            ativo={soAtrasadas}
          />
          {isAdmin && (
            <>
              <Kpi
                icon="✅"
                label="Resolvidas (30 dias)"
                valor={resumo.resolvidas30}
                tom="text-emerald-600"
              />
              <Kpi
                icon="⏱️"
                label="Tempo médio p/ resolver"
                valor={resumo.tempoMedio}
              />
            </>
          )}
        </div>

        {/* Abas */}
        <div className="mb-3 flex overflow-x-auto rounded-2xl bg-white p-1 shadow-sm border border-slate-200 w-full sm:w-fit">
          {ABAS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setAba(item.id)}
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
                {contagemAbas[item.id]}
              </span>
            </button>
          ))}
        </div>

        {/* Filtros */}
        {reais.length > 0 && (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm space-y-2">
            <div
              className={`grid grid-cols-1 gap-2 ${
                isAdmin ? "sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]" : ""
              }`}
            >
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="🔎 Buscar título, detalhe, máquina..."
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
              {isAdmin && (
                <>
                  <select
                    value={filtroLoja}
                    onChange={(e) => {
                      setFiltroLoja(e.target.value);
                      setFiltroMaquina("");
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                    aria-label="Loja"
                  >
                    <option value="">🏪 Todas as lojas</option>
                    {lojas.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nome}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filtroMaquina}
                    onChange={(e) => setFiltroMaquina(e.target.value)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                    aria-label="Máquina"
                  >
                    <option value="">🎮 Todas as máquinas</option>
                    {maquinasComManutencao.map(([id, nome]) => (
                      <option key={id} value={id}>
                        {nome}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filtroPessoa}
                    onChange={(e) => setFiltroPessoa(e.target.value)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                    aria-label="Responsável"
                  >
                    <option value="">👷 Todos os responsáveis</option>
                    {funcionarios.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {ORDEM_PRIORIDADES.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() =>
                    setFiltroPrioridade((v) => (v === id ? "" : id))
                  }
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    filtroPrioridade === id
                      ? PRIORIDADES[id].botao
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {PRIORIDADES[id].label}
                </button>
              ))}
              <label className="ml-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={soAtrasadas}
                  onChange={(e) => setSoAtrasadas(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Só atrasadas
              </label>
              {filtrosAtivos && (
                <button
                  type="button"
                  onClick={limparFiltros}
                  className="ml-auto text-xs font-semibold text-blue-700 hover:text-blue-800"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
        )}

        {/* Lista */}
        {visiveis.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center px-4">
            <div className="text-5xl mb-3">
              {filtrosAtivos ? "🔍" : aba === "RESOLVIDAS" ? "📭" : "🎉"}
            </div>
            <p className="font-semibold text-slate-700">
              {filtrosAtivos
                ? "Nenhuma manutenção com esses filtros"
                : aba === "ABERTAS"
                  ? isAdmin
                    ? "Nenhuma manutenção aberta. Tudo funcionando!"
                    : "Nada com você agora. Bom trabalho!"
                  : "Nenhuma manutenção por aqui ainda."}
            </p>
            {filtrosAtivos ? (
              <button
                type="button"
                onClick={limparFiltros}
                className="mt-3 text-sm font-semibold text-blue-700 hover:text-blue-800"
              >
                Limpar filtros
              </button>
            ) : (
              isAdmin &&
              aba !== "RESOLVIDAS" && (
                <button
                  type="button"
                  onClick={abrirNova}
                  className="mt-4 btn-primary"
                >
                  + Abrir uma manutenção
                </button>
              )
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {visiveis.map((item) => (
              <CartaoManutencao
                key={item.id}
                item={item}
                isAdmin={isAdmin}
                podeResolver={podeResolver(item)}
                onResolver={abrirConclusao}
                onEditar={abrirEdicao}
              />
            ))}
          </div>
        )}
      </main>

      {/* Nova / editar */}
      <Modal
        isOpen={!!formAberto}
        onClose={() => !salvando && setFormAberto(null)}
        title={formAberto?.editandoId ? "✏️ Editar manutenção" : "🛠️ Nova manutenção"}
        size="md"
      >
        {formAberto && (
          <FormularioManutencao
            key={formAberto.editandoId || "nova"}
            inicial={formAberto.inicial}
            editando={!!formAberto.editandoId}
            lojas={lojas}
            maquinas={maquinas}
            funcionarios={funcionarios}
            salvando={salvando}
            onCancelar={() => setFormAberto(null)}
            onSalvar={salvar}
          />
        )}
      </Modal>

      {/* Concluir */}
      <Modal
        isOpen={!!concluindo}
        onClose={() => !salvando && setConcluindo(null)}
        title="✅ Concluir manutenção"
        size="sm"
      >
        {concluindo && (
          <div className="space-y-4 text-left">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="font-semibold text-slate-900">{concluindo.titulo}</p>
              <p className="text-xs text-slate-500">
                🏪 {concluindo.loja?.nome || "Sem loja"}
                {concluindo.maquina && ` · 🎮 ${concluindo.maquina.nome}`}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                O que foi feito?
              </label>
              <textarea
                value={solucao}
                onChange={(e) => setSolucao(e.target.value)}
                className="input-field min-h-24"
                placeholder="Ex: troquei a mola da garra e testei 10 jogadas"
                autoFocus
              />
              <p className="mt-1 text-xs text-slate-500">
                Ajuda quem pegar um problema parecido depois.
              </p>
            </div>
            {isAdmin &&
              (concluindo.custo === null || concluindo.custo === undefined) && (
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    💰 Quanto custou? (opcional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={custoConclusao}
                    onChange={(e) => setCustoConclusao(e.target.value)}
                    className="input-field"
                    placeholder="0,00"
                    disabled={!concluindo.loja}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    {concluindo.loja
                      ? `Vira gasto variável de ${concluindo.loja.nome}.`
                      : "Sem loja, não dá para lançar custo."}
                  </p>
                </div>
              )}
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setConcluindo(null)}
                className="btn-secondary"
                disabled={salvando}
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={concluir}
                className="btn-success disabled:opacity-50"
                disabled={salvando}
              >
                {salvando ? "Salvando..." : "✓ Concluir"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Footer />
    </div>
  );
}
