import { useEffect, useMemo, useState } from "react";
import api from "../../services/api";

// Seção do cadastro do usuário SUPORTE: quais máquinas ele pode usar na página
// Machine Pay dele (status, crédito e pulso). Dá para marcar as máquinas já
// cadastradas no sistema ou adicionar qualquer ID da Machine Pay (POS ID) ou
// da CompactPay, de qualquer cliente — o nome é buscado direto lá.
//
// value / onChange: [{ sistema, posId, nome, usrId }]

const SISTEMAS_PAGAMENTO = {
  MACHINE_PAY: { label: "Machine Pay", curto: "Machine Pay", cor: "border-amber-300 bg-amber-50 text-amber-800" },
  COMPACT_PAY: { label: "CompactPay", curto: "CompactPay", cor: "border-sky-300 bg-sky-50 text-sky-800" },
};

const chave = (item) => `${item.sistema}:${item.posId}`;

const mensagemErro = (error, padrao) =>
  error?.response?.data?.error || error?.message || padrao;

const nomeDaMaquina = (m) =>
  m.nomeExterno || [m.codigo, m.nomeMaquina].filter(Boolean).join(" - ") || `ID ${m.posId}`;

export function SistemaBadge({ sistema }) {
  const info = SISTEMAS_PAGAMENTO[sistema] || SISTEMAS_PAGAMENTO.MACHINE_PAY;
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${info.cor}`}>
      {info.curto}
    </span>
  );
}

export function MachinePayPermitidos({ value, onChange }) {
  const [cadastradas, setCadastradas] = useState([]);
  // IDs de máquinas desativadas: saem da seleção (e o backend não salva).
  const [desativados, setDesativados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState("");
  const [busca, setBusca] = useState("");

  const [novoSistema, setNovoSistema] = useState("MACHINE_PAY");
  const [novoId, setNovoId] = useState("");
  const [buscandoId, setBuscandoId] = useState(false);
  const [mensagemId, setMensagemId] = useState(null);

  useEffect(() => {
    let cancelado = false;
    api
      .get("/machine-pay/suporte/admin/maquinas-cadastradas")
      .then((res) => {
        if (cancelado) return;
        setCadastradas(res.data?.maquinas || []);
        setDesativados(res.data?.desativados || []);
      })
      .catch((error) => !cancelado && setErroLista(mensagemErro(error, "Erro ao carregar as máquinas.")))
      .finally(() => !cancelado && setCarregando(false));
    return () => {
      cancelado = true;
    };
  }, []);

  // Registros antigos não têm "sistema": eram todos da Machine Pay.
  // Saem da seleção: IDs de máquinas desativadas e liberações que vieram de
  // uma máquina que não está mais na lista (desativada ou excluída).
  const chavesCadastradas = useMemo(() => new Set(cadastradas.map(chave)), [cadastradas]);
  const lista = useMemo(() => {
    const fora = new Set(desativados);
    return value
      .map((item) => ({ ...item, sistema: item.sistema || "MACHINE_PAY" }))
      .filter((item) => !fora.has(chave(item)))
      .filter(
        (item) => carregando || item.origem !== "MAQUINA" || chavesCadastradas.has(chave(item)),
      );
  }, [value, desativados, carregando, chavesCadastradas]);
  const selecionados = useMemo(() => new Set(lista.map(chave)), [lista]);
  const extras = lista.filter((item) => !chavesCadastradas.has(chave(item)));

  const cadastradasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return cadastradas;
    return cadastradas.filter((m) =>
      [m.codigo, m.nomeMaquina, m.nomeExterno, m.lojaNome, m.posId, SISTEMAS_PAGAMENTO[m.sistema]?.label]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(termo)),
    );
  }, [cadastradas, busca]);

  const paraItem = (m) => ({ sistema: m.sistema, posId: m.posId, nome: nomeDaMaquina(m), usrId: m.usrId });

  const alternar = (maquina) => {
    if (selecionados.has(chave(maquina))) {
      onChange(lista.filter((item) => chave(item) !== chave(maquina)));
    } else {
      onChange([...lista, paraItem(maquina)]);
    }
  };

  const marcarFiltradas = () => {
    const novos = cadastradasFiltradas.filter((m) => !selecionados.has(chave(m))).map(paraItem);
    onChange([...lista, ...novos]);
  };

  const desmarcarFiltradas = () => {
    const remover = new Set(cadastradasFiltradas.map(chave));
    onChange(lista.filter((item) => !remover.has(chave(item))));
  };

  const remover = (item) => onChange(lista.filter((atual) => chave(atual) !== chave(item)));

  const adicionarId = async () => {
    const id = novoId.trim();
    setMensagemId(null);
    if (novoSistema === "MACHINE_PAY" && !/^\d+$/.test(id)) {
      setMensagemId({ ok: false, texto: "Digite só os números do POS ID." });
      return;
    }
    if (selecionados.has(`${novoSistema}:${id}`)) {
      setMensagemId({ ok: false, texto: "Esse ID já está liberado." });
      return;
    }
    setBuscandoId(true);
    try {
      const res = await api.get(
        `/machine-pay/suporte/admin/buscar/${novoSistema}/${encodeURIComponent(id)}`,
      );
      const leitor = res.data;
      const nome = leitor.nome || `ID ${leitor.posId}`;
      if (!selecionados.has(`${leitor.sistema}:${leitor.posId}`)) {
        onChange([...lista, { sistema: leitor.sistema, posId: leitor.posId, nome, usrId: leitor.usrId }]);
      }
      setNovoId("");
      setMensagemId({ ok: true, texto: `Adicionado: ${nome}${leitor.cliente ? ` (${leitor.cliente})` : ""}` });
    } catch (error) {
      setMensagemId({ ok: false, texto: mensagemErro(error, "Não foi possível buscar o ID.") });
    } finally {
      setBuscandoId(false);
    }
  };

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">💳 Máquinas liberadas (Machine Pay / CompactPay)</h2>
      <p className="mb-4 text-sm text-gray-500">
        Na página Machine Pay, o suporte vê só estas máquinas: se está online, dar crédito e se o pulso chegou.
      </p>

      {/* Adicionar ID avulso, de qualquer cliente */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <label className="mb-2 block text-sm font-medium text-gray-700">Adicionar ID de qualquer cliente</label>
        <div className="flex flex-wrap gap-2">
          <select
            className="input-field w-auto"
            value={novoSistema}
            onChange={(e) => {
              setNovoSistema(e.target.value);
              setMensagemId(null);
            }}
          >
            {Object.entries(SISTEMAS_PAGAMENTO).map(([valor, info]) => (
              <option key={valor} value={valor}>
                {info.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            inputMode={novoSistema === "MACHINE_PAY" ? "numeric" : "text"}
            className="input-field w-56"
            placeholder={novoSistema === "MACHINE_PAY" ? "POS ID, ex.: 12345678" : "ID da placa CompactPay"}
            value={novoId}
            onChange={(e) => setNovoId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                adicionarId();
              }
            }}
          />
          <button
            type="button"
            className="btn-secondary disabled:opacity-60"
            onClick={adicionarId}
            disabled={buscandoId || !novoId.trim()}
          >
            {buscandoId ? `Buscando na ${SISTEMAS_PAGAMENTO[novoSistema].label}...` : "Buscar e adicionar"}
          </button>
        </div>
        {novoSistema === "MACHINE_PAY" && buscandoId && (
          <p className="mt-2 text-xs text-gray-500">Procurando em todos os clientes do painel, pode levar alguns segundos.</p>
        )}
        {mensagemId && (
          <p className={`mt-2 text-sm font-semibold ${mensagemId.ok ? "text-green-700" : "text-red-600"}`}>
            {mensagemId.texto}
          </p>
        )}
      </div>

      {/* IDs avulsos (fora das máquinas cadastradas) */}
      {extras.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-gray-700">IDs adicionados</p>
          <ul className="space-y-1">
            {extras.map((item) => (
              <li
                key={chave(item)}
                className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <SistemaBadge sistema={item.sistema} />
                  <span className="truncate text-gray-900">{item.nome || `ID ${item.posId}`}</span>
                  <span className="font-mono text-xs text-gray-500">{item.posId}</span>
                </span>
                <button
                  type="button"
                  className="text-sm font-semibold text-red-600 hover:text-red-800"
                  onClick={() => remover(item)}
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Máquinas já cadastradas no sistema */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-700">Máquinas cadastradas com Machine Pay / CompactPay</p>
        <div className="flex gap-3 text-sm">
          <button type="button" className="font-semibold text-primary hover:underline" onClick={marcarFiltradas}>
            Marcar todas
          </button>
          <button type="button" className="font-semibold text-gray-500 hover:underline" onClick={desmarcarFiltradas}>
            Desmarcar
          </button>
        </div>
      </div>
      <input
        type="search"
        className="input-field mb-2"
        placeholder="Filtrar por código, nome, loja, ID ou sistema..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      {erroLista && <p className="mb-2 text-sm font-semibold text-red-600">{erroLista}</p>}
      <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-gray-300 p-3">
        {carregando ? (
          <p className="text-sm text-gray-500">Carregando máquinas...</p>
        ) : cadastradasFiltradas.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma máquina encontrada.</p>
        ) : (
          cadastradasFiltradas.map((m) => (
            <label key={chave(m)} className="flex cursor-pointer items-start gap-3 rounded p-2 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={selecionados.has(chave(m))}
                onChange={() => alternar(m)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-gray-900">
                  <SistemaBadge sistema={m.sistema} />
                  {m.codigo} - {m.nomeMaquina}
                </span>
                <span className="block text-xs text-gray-500">
                  {m.lojaNome || "Sem loja"} · ID <span className="font-mono">{m.posId}</span>
                  {m.nomeExterno && ` · ${m.nomeExterno}`}
                </span>
              </span>
            </label>
          ))
        )}
      </div>

      <p className="mt-2 text-sm text-gray-600">{lista.length} máquina(s) liberada(s)</p>
    </div>
  );
}
