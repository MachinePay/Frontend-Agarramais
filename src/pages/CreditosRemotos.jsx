import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import {
  PageHeader,
  AlertBox,
  Badge,
  Modal,
  ConfirmDialog,
} from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import api from "../services/api";

const formatarMoeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const formatarDataHora = (valor) =>
  valor ? new Date(valor).toLocaleString("pt-BR") : "-";

const situacoes = {
  ativo: { label: "Ativo", variant: "success" },
  esgotado: { label: "Esgotado", variant: "info" },
  expirado: { label: "Expirado", variant: "warning" },
  revogado: { label: "Bloqueado", variant: "danger" },
  inativo: { label: "Inativo", variant: "danger" },
};

const statusEnvio = {
  enviado: { label: "Enviado", variant: "success" },
  incerto: { label: "Sem confirmação", variant: "warning" },
  erro: { label: "Erro", variant: "danger" },
  pendente: { label: "Pendente", variant: "info" },
};

const montarUrlLink = (token) => `${window.location.origin}/creditos#${token}`;

const NOME_MAQUINA_TESTE = "Teste Smart 2";
const LIMITE_LINK_TESTE = 10;

const normalizarNome = (nome) => String(nome || "").trim().toLowerCase();

export function CreditosRemotos() {
  const [links, setLinks] = useState([]);
  const [maquinasPermitidas, setMaquinasPermitidas] = useState([]);
  const [maquinasMachinePay, setMaquinasMachinePay] = useState([]);
  const [copiadoId, setCopiadoId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [descricao, setDescricao] = useState("");
  const [limite, setLimite] = useState("150");
  const [expiraEm, setExpiraEm] = useState("");
  const [maquinaId, setMaquinaId] = useState("");
  const [criando, setCriando] = useState(false);
  const [linkCriado, setLinkCriado] = useState(null);
  const [copiado, setCopiado] = useState(false);

  const [linkBloquear, setLinkBloquear] = useState(null);
  const [linkEnvios, setLinkEnvios] = useState(null);
  const [envios, setEnvios] = useState([]);
  const [carregandoEnvios, setCarregandoEnvios] = useState(false);

  const carregar = async () => {
    try {
      setError("");
      const response = await api.get("/credito-remoto/links");
      setLinks(response.data.links || []);
      setMaquinasPermitidas(response.data.maquinasPermitidas || []);
      setMaquinasMachinePay(response.data.maquinasMachinePay || []);
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao carregar os links.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const enviarCriacao = async (dados) => {
    try {
      setCriando(true);
      setError("");
      const response = await api.post("/credito-remoto/links", dados);
      setLinkCriado({
        ...response.data,
        url: montarUrlLink(response.data.token),
      });
      setCopiado(false);
      carregar();
      return true;
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao criar o link.");
      return false;
    } finally {
      setCriando(false);
    }
  };

  const criar = async (event) => {
    event.preventDefault();
    const ok = await enviarCriacao({
      descricao,
      limite: limite.replace(",", "."),
      expiraEm: expiraEm ? new Date(expiraEm).toISOString() : null,
      maquinaId: maquinaId || null,
    });
    if (ok) {
      setDescricao("");
      setLimite("150");
      setExpiraEm("");
      setMaquinaId("");
    }
  };

  const maquinaTeste = maquinasMachinePay.find(
    (maquina) => normalizarNome(maquina.nome) === normalizarNome(NOME_MAQUINA_TESTE),
  );

  const criarLinkTeste = () => {
    if (!maquinaTeste) {
      setError(
        `A máquina "${NOME_MAQUINA_TESTE}" não foi encontrada. Cadastre-a em Máquinas com o ID Machine Pay (número do Caixa) e deixe ativa.`,
      );
      return;
    }
    enviarCriacao({
      descricao: `Link de teste - ${NOME_MAQUINA_TESTE}`,
      limite: LIMITE_LINK_TESTE,
      maquinaId: maquinaTeste.id,
    });
  };

  const copiarLinkExistente = async (link) => {
    try {
      setError("");
      const response = await api.get(`/credito-remoto/links/${link.id}/token`);
      await navigator.clipboard.writeText(montarUrlLink(response.data.token));
      setCopiadoId(link.id);
      setTimeout(() => setCopiadoId(""), 2500);
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível copiar o link.");
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(linkCriado.url);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };

  const bloquear = async () => {
    try {
      await api.post(`/credito-remoto/links/${linkBloquear.id}/bloquear`);
      carregar();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao bloquear o link.");
    }
  };

  const abrirEnvios = async (link) => {
    setLinkEnvios(link);
    setEnvios([]);
    try {
      setCarregandoEnvios(true);
      const response = await api.get(`/credito-remoto/links/${link.id}/envios`);
      setEnvios(response.data || []);
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao carregar os envios.");
    } finally {
      setCarregandoEnvios(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Créditos Remotos"
          subtitle="Links temporários para enviar crédito Machine Pay nas máquinas GRU"
          icon="🔗"
          action={
            <button
              type="button"
              className="btn-secondary"
              onClick={criarLinkTeste}
              disabled={criando}
              title={`Gera um link só para a máquina ${NOME_MAQUINA_TESTE}, com limite de R$ ${LIMITE_LINK_TESTE},00`}
            >
              🧪 Gerar link de teste ({NOME_MAQUINA_TESTE}, R$ {LIMITE_LINK_TESTE})
            </button>
          }
        />

        {error && (
          <div className="mb-6">
            <AlertBox type="error" message={error} onClose={() => setError("")} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="card-gradient lg:col-span-1">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Novo link</h2>
            <form onSubmit={criar} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Para quem é
                </label>
                <input
                  className="input-field w-full"
                  placeholder="Ex: Artista Fulano - GRU"
                  value={descricao}
                  onChange={(event) => setDescricao(event.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Limite total (R$)
                </label>
                <input
                  className="input-field w-full"
                  inputMode="decimal"
                  value={limite}
                  onChange={(event) => setLimite(event.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Máquinas
                </label>
                <select
                  className="input-field w-full"
                  value={maquinaId}
                  onChange={(event) => setMaquinaId(event.target.value)}
                >
                  <option value="">Todas as máquinas GRU</option>
                  {maquinasMachinePay.map((maquina) => (
                    <option key={maquina.id} value={maquina.id}>
                      Só: {maquina.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Expira em (opcional)
                </label>
                <input
                  type="datetime-local"
                  className="input-field w-full"
                  value={expiraEm}
                  onChange={(event) => setExpiraEm(event.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  O link também expira sozinho quando o limite acaba.
                </p>
              </div>
              <button type="submit" className="btn-primary w-full" disabled={criando}>
                {criando ? "Gerando..." : "Gerar link"}
              </button>
            </form>

            <div className="mt-6 border-t border-gray-200 pt-4">
              <p className="text-xs font-bold uppercase text-gray-500 mb-2">
                Máquinas GRU (links sem máquina fixa)
              </p>
              {maquinasPermitidas.length === 0 ? (
                <p className="text-sm text-amber-700">
                  Nenhuma máquina ativa com "GRU" no nome e ID Machine Pay.
                </p>
              ) : (
                <ul className="text-sm text-gray-700 space-y-1">
                  {maquinasPermitidas.map((nome) => (
                    <li key={nome}>🎮 {nome}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="lg:col-span-2 space-y-3">
            {links.length === 0 ? (
              <div className="card text-center py-12 text-gray-600">
                Nenhum link criado ainda.
              </div>
            ) : (
              links.map((link) => {
                const situacao = situacoes[link.situacao] || situacoes.inativo;
                return (
                  <div key={link.id} className="card">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-gray-900">{link.descricao}</h3>
                          <Badge variant={situacao.variant} size="sm">
                            {situacao.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          🎮 {link.maquina || "Máquinas GRU"}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          Usado {formatarMoeda(link.usado)} de{" "}
                          {formatarMoeda(link.limite)} · resta{" "}
                          <strong>{formatarMoeda(link.restante)}</strong>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Criado em {formatarDataHora(link.createdAt)}
                          {link.criadoPor ? ` por ${link.criadoPor}` : ""}
                          {link.expiraEm
                            ? ` · expira em ${formatarDataHora(link.expiraEm)}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {link.situacao === "ativo" && link.podeCopiar && (
                          <button
                            type="button"
                            className="btn-primary text-sm"
                            onClick={() => copiarLinkExistente(link)}
                          >
                            {copiadoId === link.id ? "Copiado!" : "📋 Copiar link"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-secondary text-sm"
                          onClick={() => abrirEnvios(link)}
                        >
                          Envios
                        </button>
                        {link.situacao === "ativo" && (
                          <button
                            type="button"
                            className="btn-danger text-sm"
                            onClick={() => setLinkBloquear(link)}
                          >
                            🔒 Bloquear link
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </section>
        </div>
      </main>

      <Modal
        isOpen={Boolean(linkCriado)}
        onClose={() => setLinkCriado(null)}
        title="Link criado"
      >
        {linkCriado && (
          <div className="space-y-4">
            <p className="text-gray-700">
              Envie este link para <strong>{linkCriado.descricao}</strong>.
              Limite de <strong>{formatarMoeda(linkCriado.limite)}</strong>
              {linkCriado.maquina
                ? `, só para a máquina ${linkCriado.maquina}`
                : ", máquinas GRU"}
              .
            </p>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm break-all font-mono">
              {linkCriado.url}
            </div>
            <p className="text-sm text-gray-500">
              Dá pra copiar de novo depois pelo botão "Copiar link" na lista.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-primary" onClick={copiar}>
                {copiado ? "Copiado!" : "Copiar link"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(linkEnvios)}
        onClose={() => setLinkEnvios(null)}
        title={linkEnvios ? `Envios - ${linkEnvios.descricao}` : ""}
        size="lg"
      >
        {carregandoEnvios ? (
          <p className="text-gray-600">Carregando...</p>
        ) : envios.length === 0 ? (
          <p className="text-gray-600">Nenhum envio ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-500">Data</th>
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-500">Máquina</th>
                  <th className="px-3 py-2 text-right text-xs font-bold uppercase text-gray-500">Valor</th>
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {envios.map((envio) => {
                  const status = statusEnvio[envio.status] || statusEnvio.pendente;
                  return (
                    <tr key={envio.id}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatarDataHora(envio.createdAt)}
                      </td>
                      <td className="px-3 py-2">{envio.maquina}</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {formatarMoeda(envio.valor)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={status.variant} size="sm">
                          {status.label}
                        </Badge>
                        {envio.detalhe && envio.status === "erro" && (
                          <p className="text-xs text-gray-500 mt-1 break-all">
                            {envio.detalhe}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(linkBloquear)}
        onClose={() => setLinkBloquear(null)}
        onConfirm={bloquear}
        title="🔒 Bloquear link"
        message={
          linkBloquear
            ? `Tem certeza? O link de "${linkBloquear.descricao}" para de funcionar na hora e não pode ser desbloqueado (saldo restante: ${formatarMoeda(linkBloquear.restante)}). Se precisar, gere um link novo.`
            : ""
        }
        confirmText="Sim, bloquear"
      />

      <Footer />
    </div>
  );
}
