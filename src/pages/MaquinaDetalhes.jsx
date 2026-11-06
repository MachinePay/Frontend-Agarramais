import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { AlertBox, ConfirmDialog } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import { useAuth } from "../contexts/AuthContext";
import { ehGestao } from "../utils/cargos";

// Detalhe da máquina a partir de um alerta: mostra as duas últimas
// movimentações lado a lado, confere IN/OUT contra fichas/saída (mesma regra
// do backend, relatorioController) e deixa corrigir qualquer uma das duas.

const numero = (valor) =>
  valor === null || valor === undefined || valor === "" ? null : Number(valor);

const formatarDataHora = (valor) =>
  valor
    ? new Date(valor).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

const formatarMoeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const comSinal = (n) => (n > 0 ? `+${n}` : `${n}`);

// Campos editáveis de uma movimentação.
const CAMPOS = [
  { chave: "contadorIn", label: "Contador IN", icone: "📥" },
  { chave: "contadorOut", label: "Contador OUT", icone: "📤" },
  { chave: "fichas", label: "Fichas", icone: "🎫" },
  { chave: "totalPre", label: "Tinha na máquina", icone: "📦" },
  { chave: "abastecidas", label: "Abastecido", icone: "➕" },
];

// Conferência de uma movimentação contra a anterior.
const conferir = (atual, anterior) => {
  if (!atual || !anterior) return null;
  const temContadores =
    atual.contadorOut !== null && atual.contadorOut !== 0;
  const diffIn = (atual.contadorIn || 0) - (anterior.contadorIn || 0);
  const diffOut = (atual.contadorOut || 0) - (anterior.contadorOut || 0);
  const fichas = atual.fichas || 0;
  const sairam = atual.sairam || 0;
  return {
    temContadores,
    diffIn,
    diffOut,
    fichas,
    sairam,
    inOk: diffIn === fichas,
    outOk: diffOut === sairam,
  };
};

function Chip({ icone, label, valor, destaque }) {
  return (
    <div
      className={`rounded-2xl border px-4 py-2.5 ${
        destaque ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {icone} {label}
      </p>
      <p className="text-lg font-bold text-slate-900 tabular-nums truncate">
        {valor}
      </p>
    </div>
  );
}

function Conta({ titulo, antes, depois, andou, comparado, rotulo, ok }) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        ok ? "border-emerald-200 bg-emerald-50/60" : "border-red-200 bg-red-50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-slate-900">{titulo}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
            ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {ok ? "✓ Bate" : `Diferença ${comSinal(andou - comparado)}`}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm tabular-nums">
        <span className="rounded-lg bg-white px-2 py-1 border border-slate-200">
          {antes ?? "-"}
        </span>
        <span className="text-slate-400">→</span>
        <span className="rounded-lg bg-white px-2 py-1 border border-slate-200">
          {depois ?? "-"}
        </span>
        <span className="text-slate-500">
          = andou <strong className="text-slate-900">{andou}</strong>
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-700">
        {rotulo}: <strong className="tabular-nums">{comparado}</strong>
      </p>
    </div>
  );
}

export function MaquinaDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();

  const [maquina, setMaquina] = useState(null);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [alertaAbastecimento, setAlertaAbastecimento] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [confirmarCorrigido, setConfirmarCorrigido] = useState(false);

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const carregarDados = async () => {
    try {
      // O alerta de abastecimento é rota de admin: se falhar, a página
      // continua funcionando sem ele.
      const [maquinaRes, movRes, abastRes] = await Promise.allSettled([
        api.get(`/maquinas/${id}`),
        api.get("/movimentacoes", { params: { maquinaId: id, limite: 3 } }),
        api.get("/relatorios/alertas-abastecimento-incompleto", {
          params: { maquinaId: id },
        }),
      ]);
      if (maquinaRes.status !== "fulfilled") throw maquinaRes.reason;
      setMaquina(maquinaRes.value.data);
      const movs = movRes.status === "fulfilled" ? movRes.value.data || [] : [];
      setMovimentacoes(movs);
      const alertas =
        abastRes.status === "fulfilled" ? abastRes.value.data?.alertas || [] : [];
      setAlertaAbastecimento(
        alertas.find(
          (a) =>
            String(a.maquinaId) === String(id) &&
            movs[0] &&
            String(a.id).endsWith(String(movs[0].id)),
        ) || null,
      );
    } catch (err) {
      setError(
        "Erro ao carregar dados: " + (err.response?.data?.error || err.message),
      );
    } finally {
      setLoading(false);
    }
  };

  const atual = movimentacoes[0];
  const anterior = movimentacoes[1];
  const antesDoAnterior = movimentacoes[2];
  const conferencia = conferir(atual, anterior);
  const temInconsistencia =
    conferencia?.temContadores && (!conferencia.inOk || !conferencia.outOk);

  const podeEditar = (mov) =>
    ehGestao(usuario?.role) || mov?.usuarioId === usuario?.id;

  const iniciarEdicao = (mov) => {
    setEditandoId(mov.id);
    setForm({
      ...Object.fromEntries(CAMPOS.map((c) => [c.chave, mov[c.chave] ?? ""])),
      observacoes: mov.observacoes || "",
    });
    setError("");
    setSuccess("");
  };

  const salvarEdicao = async () => {
    const mov = movimentacoes.find((m) => m.id === editandoId);
    if (!mov) return;
    const indice = movimentacoes.indexOf(mov);
    const anteriorDela = movimentacoes[indice + 1];

    const totalPre = numero(form.totalPre) ?? 0;
    const abastecidas = numero(form.abastecidas) ?? 0;
    // Mantém a retirada que já existia: só desloca o total pós pelo que
    // mudou em "tinha" e "abastecido".
    const totalPos =
      (mov.totalPos ?? 0) +
      (totalPre - (mov.totalPre ?? 0)) +
      (abastecidas - (mov.abastecidas ?? 0));
    const sairam = anteriorDela
      ? Math.max(0, (anteriorDela.totalPos ?? 0) - totalPre)
      : mov.sairam;

    setSalvando(true);
    setError("");
    try {
      await api.put(`/movimentacoes/${mov.id}`, {
        contadorIn: numero(form.contadorIn),
        contadorOut: numero(form.contadorOut),
        fichas: numero(form.fichas) ?? 0,
        totalPre,
        abastecidas,
        totalPos,
        sairam,
        observacoes: form.observacoes,
      });
      setEditandoId(null);
      setSuccess("✏️ Movimentação corrigida. A conferência foi refeita.");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao salvar a correção.");
    } finally {
      setSalvando(false);
    }
  };

  const marcarCorrigido = async () => {
    try {
      await api.delete(
        `/relatorios/alertas-movimentacao-inconsistente/${maquina.id}-${atual.id}`,
        { data: { maquinaId: maquina.id } },
      );
      if (alertaAbastecimento) {
        await api.delete(
          `/relatorios/alertas-movimentacao-inconsistente/${alertaAbastecimento.id}`,
          { data: { maquinaId: maquina.id } },
        );
      }
      navigate("/alertas");
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao marcar como corrigido.");
    }
  };

  if (loading) return <PageLoader />;
  if (!maquina)
    return (
      <div className="min-h-screen bg-background-light">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <AlertBox type="error" message={error || "Máquina não encontrada."} />
        </div>
      </div>
    );

  const produto = atual?.detalhesProdutos?.[0]?.produto;
  const loja = maquina.loja?.nome || maquina.lojaNome;
  const temAlerta = temInconsistencia || !!alertaAbastecimento;

  // Linhas da comparação: valor de cada movimentação.
  const linhas = [
    ...CAMPOS,
    { chave: "sairam", label: "Saíram", icone: "🧸", calculado: true },
    { chave: "totalPos", label: "Ficou na máquina", icone: "✅", calculado: true },
  ];

  // Funções de render (não componentes): assim o input em edição não é
  // recriado a cada tecla e não perde o foco.
  const renderCabecalho = (mov, titulo) => (
    <th key={mov.id} className="px-3 py-3 text-left align-top min-w-44">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
        {titulo}
      </p>
      <p className="text-sm font-semibold text-slate-900">
        {formatarDataHora(mov.dataColeta || mov.createdAt)}
      </p>
      <p className="text-xs font-normal text-slate-500">
        👤 {mov.usuario?.nome || "-"}
      </p>
      {podeEditar(mov) &&
        (editandoId === mov.id ? (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={salvarEdicao}
              disabled={salvando}
              className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "✓ Salvar"}
            </button>
            <button
              type="button"
              onClick={() => setEditandoId(null)}
              disabled={salvando}
              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => iniciarEdicao(mov)}
            disabled={!!editandoId}
            className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:border-amber-300 disabled:opacity-40"
          >
            ✏️ Corrigir
          </button>
        ))}
    </th>
  );

  const renderCelula = (mov, linha) => {
    const editando = editandoId === mov.id && !linha.calculado;
    if (editando) {
      return (
        <td key={mov.id} className="px-3 py-2">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={form[linha.chave]}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, [linha.chave]: e.target.value }))
            }
            className="w-28 rounded-lg border-2 border-amber-300 bg-amber-50 px-2 py-1 text-sm font-bold tabular-nums focus:border-amber-500 focus:outline-none"
          />
        </td>
      );
    }
    return (
      <td
        key={mov.id}
        className="px-3 py-2 text-sm font-semibold text-slate-800 tabular-nums"
      >
        {mov[linha.chave] ?? "-"}
        {editandoId === mov.id && linha.calculado && (
          <span className="ml-1 text-[10px] font-normal text-slate-400">
            (recalculado ao salvar)
          </span>
        )}
      </td>
    );
  };

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        {/* Topo */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() =>
                window.history.length > 1 ? navigate(-1) : navigate("/alertas")
              }
              className="mb-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
            >
              ← Voltar
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 truncate">
              🎮 {maquina.nome}
            </h1>
            <p className="text-sm text-slate-500">
              {maquina.codigo && maquina.codigo !== maquina.nome
                ? `${maquina.codigo} · `
                : ""}
              🏪 {loja || "-"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ehGestao(usuario?.role) && (
              <Link
                to="/historico-movimentacoes"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                🗂️ Histórico
              </Link>
            )}
            {ehGestao(usuario?.role) && temAlerta && (
              <button
                type="button"
                onClick={() => setConfirmarCorrigido(true)}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-emerald-700"
              >
                ✓ Marcar alerta como corrigido
              </button>
            )}
          </div>
        </div>

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

        {/* Resumo da máquina */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Chip
            icone={produto?.emoji || "🧸"}
            label="Produto"
            valor={produto?.nome || "-"}
          />
          <Chip
            icone="📏"
            label="Padrão"
            valor={maquina.capacidadePadrao ?? "-"}
          />
          <Chip
            icone="✅"
            label="Na máquina agora"
            valor={atual?.totalPos ?? maquina.estoqueAtual ?? "-"}
            destaque={
              maquina.capacidadePadrao != null &&
              (atual?.totalPos ?? 0) < maquina.capacidadePadrao
            }
          />
          <Chip
            icone="🎫"
            label="Valor da ficha"
            valor={
              maquina.valorFicha != null ? formatarMoeda(maquina.valorFicha) : "-"
            }
          />
        </div>

        {/* O que está errado */}
        {temAlerta ? (
          <section className="rounded-3xl border border-red-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                ⚠️ O que não está batendo
              </h2>
              <p className="text-sm text-slate-500">
                Se algum número foi digitado errado, clique em{" "}
                <strong>✏️ Corrigir</strong> na movimentação abaixo. A conta é
                refeita na hora.
              </p>
            </div>

            {temInconsistencia && (
              <div className="grid gap-3 md:grid-cols-2">
                <Conta
                  titulo="📥 Contador IN × fichas"
                  antes={anterior.contadorIn}
                  depois={atual.contadorIn}
                  andou={conferencia.diffIn}
                  comparado={conferencia.fichas}
                  rotulo="Fichas lançadas"
                  ok={conferencia.inOk}
                />
                <Conta
                  titulo="📤 Contador OUT × saída"
                  antes={anterior.contadorOut}
                  depois={atual.contadorOut}
                  andou={conferencia.diffOut}
                  comparado={conferencia.sairam}
                  rotulo="Prêmios que saíram"
                  ok={conferencia.outOk}
                />
              </div>
            )}

            {alertaAbastecimento && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="font-bold text-amber-900">
                  📦 Máquina não ficou no padrão
                </h3>
                <div className="mt-2 flex flex-wrap gap-2 text-sm tabular-nums">
                  <span className="rounded-lg bg-white px-2 py-1 border border-amber-200">
                    Tinha <strong>{alertaAbastecimento.totalAntes}</strong>
                  </span>
                  <span className="rounded-lg bg-white px-2 py-1 border border-amber-200">
                    + abasteceu <strong>{alertaAbastecimento.abastecido}</strong>
                  </span>
                  <span className="rounded-lg bg-white px-2 py-1 border border-amber-200">
                    = ficou <strong>{alertaAbastecimento.totalDepois}</strong>
                  </span>
                  <span className="rounded-lg bg-red-100 px-2 py-1 font-bold text-red-700">
                    Faltou{" "}
                    {Math.max(
                      0,
                      (alertaAbastecimento.capacidadePadrao || 0) -
                        (alertaAbastecimento.totalDepois || 0),
                    )}{" "}
                    para o padrão {alertaAbastecimento.capacidadePadrao}
                  </span>
                </div>
                {alertaAbastecimento.observacao &&
                  alertaAbastecimento.observacao !== "Sem observação" && (
                    <p className="mt-2 text-sm text-amber-900">
                      💬 Motivo: {alertaAbastecimento.observacao}
                    </p>
                  )}
              </div>
            )}
          </section>
        ) : (
          atual &&
          anterior && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              ✓ A última movimentação bate com a anterior: IN, OUT e
              abastecimento estão certos.
            </div>
          )
        )}

        {/* Comparação lado a lado */}
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 pt-4">
            <h2 className="text-lg font-bold text-slate-900">
              Últimas movimentações
            </h2>
            <p className="text-sm text-slate-500">
              Lado a lado para conferir. “Saíram” e “Ficou na máquina” são
              calculados.
            </p>
          </div>

          {!atual ? (
            <p className="p-5 text-sm text-slate-500">
              Esta máquina ainda não tem movimentações.
            </p>
          ) : (
            <div className="overflow-x-auto mt-2">
              <table className="min-w-full">
                <thead className="border-b border-slate-200 bg-slate-50/70">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400 w-48">
                      &nbsp;
                    </th>
                    {anterior && renderCabecalho(anterior, "Anterior")}
                    {renderCabecalho(atual, "Mais recente")}
                    {anterior && (
                      <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400 align-top">
                        Diferença
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {linhas.map((linha) => {
                    const delta =
                      anterior &&
                      ["contadorIn", "contadorOut"].includes(linha.chave)
                        ? (atual[linha.chave] || 0) -
                          (anterior[linha.chave] || 0)
                        : null;
                    const deltaOk =
                      linha.chave === "contadorIn"
                        ? conferencia?.inOk
                        : linha.chave === "contadorOut"
                          ? conferencia?.outOk
                          : null;
                    return (
                      <tr key={linha.chave} className={linha.calculado ? "bg-slate-50/50" : ""}>
                        <td className="px-4 py-2 text-sm text-slate-600 whitespace-nowrap">
                          {linha.icone} {linha.label}
                        </td>
                        {anterior && renderCelula(anterior, linha)}
                        {renderCelula(atual, linha)}
                        {anterior && (
                          <td className="px-3 py-2 text-sm whitespace-nowrap">
                            {delta !== null && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                                  !conferencia?.temContadores
                                    ? "bg-slate-100 text-slate-600"
                                    : deltaOk
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-red-100 text-red-700"
                                }`}
                              >
                                andou {delta}
                                {conferencia?.temContadores &&
                                  (deltaOk
                                    ? " ✓"
                                    : ` · esperado ${
                                        linha.chave === "contadorIn"
                                          ? conferencia.fichas
                                          : conferencia.sairam
                                      }`)}
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  <tr>
                    <td className="px-4 py-2 text-sm text-slate-600 align-top whitespace-nowrap">
                      💬 Observação
                    </td>
                    {[anterior, atual].filter(Boolean).map((mov) => (
                      <td key={mov.id} className="px-3 py-2 text-sm text-slate-700 align-top">
                        {editandoId === mov.id ? (
                          <textarea
                            value={form.observacoes}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                observacoes: e.target.value,
                              }))
                            }
                            rows={2}
                            className="w-full min-w-44 rounded-lg border-2 border-amber-300 bg-amber-50 px-2 py-1 text-sm focus:border-amber-500 focus:outline-none"
                          />
                        ) : (
                          mov.observacoes || (
                            <span className="text-slate-300">—</span>
                          )
                        )}
                      </td>
                    ))}
                    {anterior && <td />}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {anterior && !antesDoAnterior && (
            <p className="px-5 pb-4 text-xs text-slate-400">
              A movimentação anterior é a primeira desta máquina: a saída dela
              não é recalculada ao corrigir.
            </p>
          )}
        </section>
      </main>

      <ConfirmDialog
        isOpen={confirmarCorrigido}
        onClose={() => setConfirmarCorrigido(false)}
        onConfirm={marcarCorrigido}
        title="Marcar como corrigido?"
        message="O alerta desta máquina sai da central de alertas. Se os números ainda estiverem errados, corrija a movimentação antes."
        confirmText="Sim, está corrigido"
        type="primary"
      />

      <Footer />
    </div>
  );
}

export default MaquinaDetalhes;
