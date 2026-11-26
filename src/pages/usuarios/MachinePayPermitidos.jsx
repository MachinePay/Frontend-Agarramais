import { useEffect, useMemo, useState } from "react";
import api from "../../services/api";

// Seção do cadastro do usuário SUPORTE: quais leitores Machine Pay ele pode
// usar na página Machine Pay dele (status, crédito e pulso). Dá para marcar
// as máquinas já cadastradas no sistema ou adicionar qualquer POS ID — o nome
// é buscado direto no painel da Machine Pay.
//
// value / onChange: [{ posId, nome, usrId }]

const mensagemErro = (error, padrao) =>
  error?.response?.data?.error || error?.message || padrao;

const nomeDaMaquina = (m) =>
  m.nomeMachinePay || [m.codigo, m.nomeMaquina].filter(Boolean).join(" - ") || `POS ${m.posId}`;

export function MachinePayPermitidos({ value, onChange }) {
  const [cadastradas, setCadastradas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState("");
  const [busca, setBusca] = useState("");

  const [novoPosId, setNovoPosId] = useState("");
  const [buscandoPosId, setBuscandoPosId] = useState(false);
  const [mensagemPosId, setMensagemPosId] = useState(null);

  useEffect(() => {
    let cancelado = false;
    api
      .get("/machine-pay/suporte/admin/maquinas-cadastradas")
      .then((res) => !cancelado && setCadastradas(res.data || []))
      .catch((error) => !cancelado && setErroLista(mensagemErro(error, "Erro ao carregar as máquinas.")))
      .finally(() => !cancelado && setCarregando(false));
    return () => {
      cancelado = true;
    };
  }, []);

  const selecionados = useMemo(() => new Set(value.map((item) => item.posId)), [value]);
  const posIdsCadastrados = useMemo(() => new Set(cadastradas.map((m) => m.posId)), [cadastradas]);
  const extras = value.filter((item) => !posIdsCadastrados.has(item.posId));

  const cadastradasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return cadastradas;
    return cadastradas.filter((m) =>
      [m.codigo, m.nomeMaquina, m.nomeMachinePay, m.lojaNome, m.posId]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(termo)),
    );
  }, [cadastradas, busca]);

  const alternar = (maquina) => {
    if (selecionados.has(maquina.posId)) {
      onChange(value.filter((item) => item.posId !== maquina.posId));
    } else {
      onChange([...value, { posId: maquina.posId, nome: nomeDaMaquina(maquina), usrId: maquina.usrId }]);
    }
  };

  const marcarFiltradas = () => {
    const novos = cadastradasFiltradas
      .filter((m) => !selecionados.has(m.posId))
      .map((m) => ({ posId: m.posId, nome: nomeDaMaquina(m), usrId: m.usrId }));
    onChange([...value, ...novos]);
  };

  const desmarcarFiltradas = () => {
    const remover = new Set(cadastradasFiltradas.map((m) => m.posId));
    onChange(value.filter((item) => !remover.has(item.posId)));
  };

  const remover = (posId) => onChange(value.filter((item) => item.posId !== posId));

  const adicionarPosId = async () => {
    const posId = novoPosId.trim();
    setMensagemPosId(null);
    if (!/^\d+$/.test(posId)) {
      setMensagemPosId({ ok: false, texto: "Digite só os números do POS ID." });
      return;
    }
    if (selecionados.has(posId)) {
      setMensagemPosId({ ok: false, texto: "Esse POS ID já está liberado." });
      return;
    }
    setBuscandoPosId(true);
    try {
      const res = await api.get(`/machine-pay/suporte/admin/buscar/${posId}`);
      const leitor = res.data;
      onChange([...value, { posId: leitor.posId, nome: leitor.nome || `POS ${leitor.posId}`, usrId: leitor.usrId }]);
      setNovoPosId("");
      setMensagemPosId({
        ok: true,
        texto: `Adicionado: ${leitor.nome || `POS ${leitor.posId}`}${leitor.cliente ? ` (${leitor.cliente})` : ""}`,
      });
    } catch (error) {
      setMensagemPosId({ ok: false, texto: mensagemErro(error, "Não foi possível buscar o POS ID.") });
    } finally {
      setBuscandoPosId(false);
    }
  };

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">💳 Máquinas Machine Pay liberadas</h2>
      <p className="mb-4 text-sm text-gray-500">
        Na página Machine Pay, o suporte vê só estas máquinas: se está online, dar crédito e se o pulso chegou.
      </p>

      {/* Adicionar POS ID avulso */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <label className="mb-2 block text-sm font-medium text-gray-700">Adicionar POS ID da Machine Pay</label>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            inputMode="numeric"
            className="input-field w-56"
            placeholder="Ex.: 12345678"
            value={novoPosId}
            onChange={(e) => setNovoPosId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                adicionarPosId();
              }
            }}
          />
          <button
            type="button"
            className="btn-secondary disabled:opacity-60"
            onClick={adicionarPosId}
            disabled={buscandoPosId || !novoPosId.trim()}
          >
            {buscandoPosId ? "Buscando na Machine Pay..." : "Buscar e adicionar"}
          </button>
        </div>
        {mensagemPosId && (
          <p className={`mt-2 text-sm font-semibold ${mensagemPosId.ok ? "text-green-700" : "text-red-600"}`}>
            {mensagemPosId.texto}
          </p>
        )}
      </div>

      {/* POS IDs avulsos (fora das máquinas cadastradas) */}
      {extras.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-gray-700">POS IDs adicionados</p>
          <ul className="space-y-1">
            {extras.map((item) => (
              <li
                key={item.posId}
                className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2"
              >
                <span className="min-w-0 truncate text-gray-900">
                  {item.nome || `POS ${item.posId}`}
                  <span className="ml-2 font-mono text-xs text-gray-500">POS {item.posId}</span>
                </span>
                <button
                  type="button"
                  className="text-sm font-semibold text-red-600 hover:text-red-800"
                  onClick={() => remover(item.posId)}
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
        <p className="text-sm font-medium text-gray-700">Máquinas cadastradas com Machine Pay</p>
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
        placeholder="Filtrar por código, nome, loja ou POS ID..."
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
            <label
              key={m.posId}
              className="flex cursor-pointer items-start gap-3 rounded p-2 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selecionados.has(m.posId)}
                onChange={() => alternar(m)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="min-w-0">
                <span className="block text-gray-900">
                  {m.codigo} - {m.nomeMaquina}
                  {!m.ativo && <span className="ml-2 text-xs font-semibold text-gray-400">(inativa)</span>}
                </span>
                <span className="block text-xs text-gray-500">
                  {m.lojaNome || "Sem loja"} · POS <span className="font-mono">{m.posId}</span>
                  {m.nomeMachinePay && ` · ${m.nomeMachinePay}`}
                </span>
              </span>
            </label>
          ))
        )}
      </div>

      <p className="mt-2 text-sm text-gray-600">{value.length} máquina(s) liberada(s)</p>
    </div>
  );
}
