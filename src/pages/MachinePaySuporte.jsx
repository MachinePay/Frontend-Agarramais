import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { AlertBox, PageHeader } from "../components/UIComponents";
import { LoadingSpinner } from "../components/Loading";
import { SistemaBadge } from "./usuarios/MachinePayPermitidos";

// Página Machine Pay do usuário SUPORTE: só as máquinas (Machine Pay ou
// CompactPay) que o admin liberou no cadastro dele. Mostra se está online, envia crédito e mostra se o pulso das
// transações das últimas 24h chegou na máquina.

const FUSO = "America/Sao_Paulo";
const VALORES_RAPIDOS_CREDITO = [1, 2, 5, 10, 20];
const CREDITO_MAXIMO = 100;

const formatarMoeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatarValorInput = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const parseValorCredito = (valor) => {
  const numero = Number(String(valor || "").trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) ? numero : 0;
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

const mensagemErro = (error, padrao) =>
  error?.response?.data?.error || error?.message || padrao;

function Pill({ className = "", children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}

function StatusLeitor({ status }) {
  if (!status || status.carregando) {
    return <Pill className="border-gray-300 bg-gray-100 text-gray-600">⏳ Consultando...</Pill>;
  }
  if (status.erro) {
    return <Pill className="border-gray-300 bg-gray-100 text-gray-600">❔ Não consultado</Pill>;
  }
  return status.online ? (
    <Pill className="border-green-300 bg-green-100 text-green-800">🟢 Online</Pill>
  ) : (
    <Pill className="border-red-300 bg-red-100 text-red-800">🔴 Offline</Pill>
  );
}

const PULSO = {
  ok: { label: "✅ Pulso chegou", className: "border-green-300 bg-green-100 text-green-800" },
  aguardando: { label: "⏳ Aguardando pulso", className: "border-yellow-300 bg-yellow-100 text-yellow-900" },
  teste: { label: "🧪 Teste", className: "border-blue-300 bg-blue-100 text-blue-800" },
  falha: { label: "❌ Pulso não chegou", className: "border-red-300 bg-red-100 text-red-800" },
};

function PulsoPill({ transacao }) {
  const info = PULSO[transacao.pulso] || PULSO.falha;
  return <Pill className={info.className}>{info.label}</Pill>;
}

const urlLeitor = (leitor) =>
  `/machine-pay/suporte/leitores/${leitor.sistema}/${encodeURIComponent(leitor.posId)}`;
const chaveLeitor = (leitor) => `${leitor.sistema}:${leitor.posId}`;

function CartaoLeitor({ leitor, status, onAtualizarStatus }) {
  const [valorCredito, setValorCredito] = useState("2,00");
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  const [transacoes, setTransacoes] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [erroTransacoes, setErroTransacoes] = useState("");

  const buscarTransacoes = async () => {
    setBuscando(true);
    setErroTransacoes("");
    try {
      const res = await api.get(`${urlLeitor(leitor)}/transacoes`);
      setTransacoes(res.data);
    } catch (error) {
      setErroTransacoes(mensagemErro(error, "Não foi possível buscar as transações."));
    } finally {
      setBuscando(false);
    }
  };

  const enviarCredito = async () => {
    const creditos = parseValorCredito(valorCredito);
    if (creditos <= 0) {
      setMensagem({ ok: false, texto: "Informe um valor maior que zero." });
      return;
    }
    if (creditos > CREDITO_MAXIMO) {
      setMensagem({ ok: false, texto: `O máximo por envio é ${formatarMoeda(CREDITO_MAXIMO)}.` });
      return;
    }
    if (!window.confirm(`Enviar ${formatarMoeda(creditos)} de crédito para ${leitor.nome || `ID ${leitor.posId}`}?`)) {
      return;
    }
    setEnviando(true);
    setMensagem(null);
    try {
      const res = await api.post(`${urlLeitor(leitor)}/creditos`, { creditos });
      setMensagem({
        ok: true,
        texto: res.data?.sucesso
          ? "Crédito enviado! Confira abaixo se o pulso chegou."
          : "Solicitação enviada para a Machine Pay. Confira abaixo se o pulso chegou.",
      });
      // Dá um tempo para a máquina consultar o pagamento antes de recarregar.
      setTimeout(buscarTransacoes, 5000);
    } catch (error) {
      setMensagem({ ok: false, texto: mensagemErro(error, "Não foi possível enviar o crédito.") });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="card space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold text-gray-900">{leitor.nome || `ID ${leitor.posId}`}</h3>
          <p className="flex flex-wrap items-center gap-1 text-xs text-gray-500">
            <SistemaBadge sistema={leitor.sistema} />
            ID <span className="font-mono">{leitor.posId}</span>
            {leitor.maquina &&
              ` · Máquina ${leitor.maquina.codigo}${leitor.maquina.lojaNome ? ` · ${leitor.maquina.lojaNome}` : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusLeitor status={status} />
          <button
            type="button"
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-60"
            onClick={() => onAtualizarStatus(leitor)}
            disabled={status?.carregando}
            title="Consultar o status de novo"
          >
            🔄
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
        <h4 className="mb-3 font-bold text-gray-900">💸 Dar crédito</h4>
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
            disabled={enviando}
          >
            {enviando ? "Enviando..." : "Enviar crédito"}
          </button>
        </div>
        {mensagem && (
          <p className={`mt-2 text-sm font-semibold ${mensagem.ok ? "text-green-700" : "text-red-600"}`}>
            {mensagem.texto}
          </p>
        )}
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-bold text-gray-900">⚡ Pulsos das últimas 24h</h4>
          <button
            type="button"
            className="btn-secondary px-4 py-1.5 text-sm disabled:opacity-60"
            onClick={buscarTransacoes}
            disabled={buscando}
          >
            {buscando ? "Buscando..." : transacoes ? "Atualizar" : "Ver pulsos"}
          </button>
        </div>

        {erroTransacoes && <p className="text-sm font-semibold text-red-600">{erroTransacoes}</p>}

        {transacoes &&
          (!transacoes.transacoes?.length ? (
            <p className="text-sm text-gray-500">Nenhuma transação nas últimas 24h.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                    <th className="px-3 py-2">Pulso</th>
                  </tr>
                </thead>
                <tbody>
                  {transacoes.transacoes.map((t) => (
                    <tr key={t.id} className="border-b align-top">
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">{formatarDataHora(t.data)}</td>
                      <td className="px-3 py-2">
                        {t.tipo}
                        {t.jaDevolvido && <span className="ml-1 text-xs font-semibold text-red-600">(devolvido)</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">{formatarMoeda(t.valor)}</td>
                      <td className="px-3 py-2">
                        <PulsoPill transacao={t} />
                        {t.pulsoStatus && <span className="mt-1 block text-xs text-gray-500">{t.pulsoStatus}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    </div>
  );
}

export function MachinePaySuporte() {
  const [leitores, setLeitores] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [statusPorPosId, setStatusPorPosId] = useState({});
  const [busca, setBusca] = useState("");

  const consultarStatus = useCallback(async (leitor) => {
    const chave = chaveLeitor(leitor);
    setStatusPorPosId((atual) => ({ ...atual, [chave]: { carregando: true } }));
    try {
      const res = await api.get(`${urlLeitor(leitor)}/status`);
      setStatusPorPosId((atual) => ({ ...atual, [chave]: res.data }));
    } catch (error) {
      setStatusPorPosId((atual) => ({
        ...atual,
        [chave]: { erro: mensagemErro(error, "Erro ao consultar status") },
      }));
    }
  }, []);

  useEffect(() => {
    let cancelado = false;
    api
      .get("/machine-pay/suporte/leitores")
      .then((res) => {
        if (cancelado) return;
        setLeitores(res.data || []);
        (res.data || []).forEach((leitor) => consultarStatus(leitor));
      })
      .catch((error) => {
        if (!cancelado) setErro(mensagemErro(error, "Não foi possível carregar as máquinas."));
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [consultarStatus]);

  const leitoresFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return leitores;
    return leitores.filter((l) =>
      [l.nome, l.posId, l.sistema, l.maquina?.codigo, l.maquina?.lojaNome]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(termo)),
    );
  }, [leitores, busca]);

  const atualizarTodos = () => leitores.forEach((l) => consultarStatus(l));

  return (
    <div className="min-h-screen bg-background-light">
      <Navbar />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Machine Pay"
          subtitle="Veja se a máquina está online, dê crédito e confira se o pulso chegou."
          icon="💳"
          action={
            leitores.length > 0 && (
              <button type="button" className="btn-primary" onClick={atualizarTodos}>
                🔄 Atualizar status
              </button>
            )
          }
        />

        {erro && <AlertBox type="error" message={erro} onClose={() => setErro("")} />}

        {carregando ? (
          <LoadingSpinner message="Carregando máquinas..." />
        ) : leitores.length === 0 ? (
          !erro && (
            <AlertBox
              type="info"
              message="Nenhuma máquina Machine Pay foi liberada para você ainda. Peça para o administrador liberar no seu cadastro."
            />
          )
        ) : (
          <div className="space-y-4">
            {leitores.length > 3 && (
              <input
                type="search"
                className="input-field"
                placeholder="Buscar por nome, POS ID, máquina ou loja..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            )}
            {leitoresFiltrados.map((leitor) => (
              <CartaoLeitor
                key={chaveLeitor(leitor)}
                leitor={leitor}
                status={statusPorPosId[chaveLeitor(leitor)]}
                onAtualizarStatus={consultarStatus}
              />
            ))}
            {leitoresFiltrados.length === 0 && (
              <p className="text-center text-sm text-gray-500">Nenhuma máquina encontrada.</p>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

export default MachinePaySuporte;
