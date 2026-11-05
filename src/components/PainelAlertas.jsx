import { Link } from "react-router-dom";
import {
  CATEGORIAS,
  ORDEM_CATEGORIAS,
  rankingPor,
  tempoRelativo,
} from "../utils/alertasCentral";

// Resumo da central de alertas no Dashboard: quantos de cada tipo, onde
// estão concentrados e os mais recentes. Tudo leva para /alertas já
// filtrado. `alertas` = null enquanto carrega.
export default function PainelAlertas({ alertas, erros = [] }) {
  const carregando = alertas === null;
  const lista = alertas || [];
  const total = lista.length;

  const porCategoria = Object.fromEntries(
    ORDEM_CATEGORIAS.map((id) => [
      id,
      lista.filter((a) => a.categoria === id).length,
    ]),
  );
  const topLojas = rankingPor(lista, "loja", (a) => a.loja).slice(0, 3);
  const topMaquinas = rankingPor(
    lista,
    "maquinaId",
    (a) => a.maquina || "Máquina",
  )
    .map((m) => ({
      ...m,
      loja: lista.find((a) => a.maquinaId === m.id)?.loja,
    }))
    .slice(0, 5);
  const recentes = [...lista]
    .sort((a, b) => (b.data?.getTime() || 0) - (a.data?.getTime() || 0))
    .slice(0, 4);

  return (
    <section className="mb-8 rounded-3xl border border-slate-200 bg-white shadow-md overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-linear-to-r from-slate-900 to-slate-700 px-5 py-4 text-white">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            🚨 Central de alertas
          </h2>
          <p className="text-sm opacity-75">
            {carregando
              ? "Carregando alertas..."
              : total === 0
                ? "Tudo certo, nenhum alerta pendente 🎉"
                : `${total} alerta(s) pendente(s) precisando de atenção`}
          </p>
        </div>
        <Link
          to="/alertas"
          className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow hover:bg-amber-100"
        >
          Abrir central →
        </Link>
      </div>

      <div className="p-4 sm:p-5 space-y-5">
        {/* Por tipo */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {ORDEM_CATEGORIAS.map((id) => {
            const cat = CATEGORIAS[id];
            const n = porCategoria[id];
            return (
              <Link
                key={id}
                to={`/alertas?categoria=${id}`}
                className={`rounded-2xl border border-l-4 ${cat.cor} p-3 transition-all hover:shadow-md ${
                  !carregando && n === 0 ? "opacity-55" : ""
                }`}
                title={cat.descricao}
              >
                <p className="text-xs font-semibold text-slate-600 truncate">
                  {cat.icon} {cat.label}
                </p>
                <p
                  className={`text-2xl font-bold tabular-nums ${
                    n > 0 ? "text-slate-900" : "text-slate-300"
                  }`}
                >
                  {carregando ? "…" : erros.includes(id) ? "!" : n}
                </p>
              </Link>
            );
          })}
        </div>

        {!carregando && total > 0 && (
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Onde estão */}
            <div className="rounded-2xl bg-slate-50 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
                🏪 Lojas com mais alertas
              </h3>
              <ul className="space-y-1">
                {topLojas.map((l) => (
                  <li key={l.id}>
                    <Link
                      to={`/alertas?loja=${encodeURIComponent(l.id)}`}
                      className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-white"
                    >
                      <span className="truncate font-medium text-slate-800">
                        {l.nome}
                      </span>
                      <span className="ml-2 rounded-full bg-red-100 px-2 text-xs font-bold text-red-700 tabular-nums">
                        {l.total}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
                🎮 Máquinas com mais alertas
              </h3>
              <ul className="space-y-1">
                {topMaquinas.map((m) => (
                  <li key={m.id}>
                    <Link
                      to={`/alertas?maquina=${encodeURIComponent(m.id)}${
                        m.loja ? `&loja=${encodeURIComponent(m.loja)}` : ""
                      }`}
                      className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-white"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-800">
                          {m.nome}
                        </span>
                        {m.loja && (
                          <span className="block truncate text-[11px] text-slate-400">
                            {m.loja}
                          </span>
                        )}
                      </span>
                      <span className="ml-2 rounded-full bg-red-100 px-2 text-xs font-bold text-red-700 tabular-nums">
                        {m.total}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Mais recentes */}
            <div className="rounded-2xl bg-slate-50 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
                🕑 Mais recentes
              </h3>
              <ul className="space-y-1">
                {recentes.map((a) => (
                  <li key={a.chave}>
                    <Link
                      to={`/alertas?categoria=${a.categoria}${
                        a.maquinaId
                          ? `&maquina=${encodeURIComponent(a.maquinaId)}`
                          : ""
                      }`}
                      className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white"
                    >
                      <span>{CATEGORIAS[a.categoria].icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-slate-800">
                          {a.maquina || "Máquina"}
                        </span>
                        <span className="block truncate text-[11px] text-slate-400">
                          {CATEGORIAS[a.categoria].label} ·{" "}
                          {tempoRelativo(a.data)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
