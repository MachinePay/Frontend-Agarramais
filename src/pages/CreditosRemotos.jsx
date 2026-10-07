import { useEffect, useState } from "react";
import QRCode from "qrcode";
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

const gerarQrCode = (url) =>
  QRCode.toDataURL(url, { width: 800, margin: 1, errorCorrectionLevel: "M" });

const NOME_MAQUINA_TESTE = "Teste Smart 2";
const LIMITE_LINK_TESTE = 10;
const QUANTIDADE_MAXIMA = 50;

const normalizarNome = (nome) => String(nome || "").trim().toLowerCase();

const descreverEscopo = (link) => {
  if (link.maquina) return link.maquina;
  if (link.lojas?.length) return `Lojas: ${link.lojas.join(", ")}`;
  return "Máquinas GRU";
};

// Folhas A4 dos vouchers: "AGARRA MAIS" em cima, QR Code no meio e o valor
// embaixo. Com porFolha = 4 cabem 4 vouchers por A4 (2x2) com linha de corte.
// Imprime por um iframe invisível (não esbarra em bloqueador de pop-up) e
// remove o iframe depois.
const imprimirVouchers = (vouchers, porFolha = 1) => {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
  });
  document.body.appendChild(iframe);

  const cartao = ({ qrDataUrl, valor }) => `
    <div class="voucher">
      <div class="marca">AGARRA MAIS</div>
      <img class="qr" src="${qrDataUrl}" alt="QR Code do voucher" />
      <div class="mensagem">
        Você tem um Voucher de<br /><span class="valor">${formatarMoeda(valor)}</span>!<br />Aproveite!
      </div>
    </div>`;

  const folhas = [];
  for (let i = 0; i < vouchers.length; i += porFolha) {
    folhas.push(
      `<div class="folha">${vouchers.slice(i, i + porFolha).map(cartao).join("")}</div>`,
    );
  }

  const estiloGrade =
    porFolha === 4
      ? `
  .folha { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
  .voucher { padding: 9mm 8mm; border: 0.3mm dashed #999; }
  .marca { font-size: 26pt; }
  .qr { width: 78mm; height: 78mm; }
  .mensagem { font-size: 13pt; }`
      : `
  .voucher { padding: 22mm 18mm; }
  .marca { font-size: 64pt; }
  .qr { width: 130mm; height: 130mm; }
  .mensagem { font-size: 30pt; }`;

  const documento = iframe.contentDocument;
  documento.open();
  documento.write(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Vouchers Agarra Mais</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    font-family: "Arial Black", "Helvetica Neue", Arial, sans-serif;
    color: #111;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .folha {
    height: 297mm;
    width: 210mm;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
  }
  .folha:last-child { page-break-after: auto; break-after: auto; }
  .voucher {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    text-align: center;
  }
  .marca { font-weight: 900; letter-spacing: 2pt; line-height: 1; color: #e4002b; }
  .qr { image-rendering: pixelated; }
  .mensagem { font-weight: 900; line-height: 1.25; }
  .valor { color: #e4002b; white-space: nowrap; }
  ${estiloGrade}
</style>
</head>
<body>${folhas.join("")}</body>
</html>`);
  documento.close();

  const imprimir = () => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => iframe.remove(), 60000);
  };
  const imagens = [...documento.querySelectorAll("img")];
  Promise.all(
    imagens.map((imagem) =>
      imagem.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            imagem.onload = resolve;
            imagem.onerror = resolve;
          }),
    ),
  ).then(() => setTimeout(imprimir, 150));
};

export function CreditosRemotos() {
  const [links, setLinks] = useState([]);
  const [maquinasPermitidas, setMaquinasPermitidas] = useState([]);
  const [maquinasMachinePay, setMaquinasMachinePay] = useState([]);
  const [lojasMachinePay, setLojasMachinePay] = useState([]);
  const [copiadoId, setCopiadoId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [descricao, setDescricao] = useState("");
  const [limite, setLimite] = useState("150");
  const [quantidade, setQuantidade] = useState("1");
  const [escopo, setEscopo] = useState("gru");
  const [lojaIds, setLojaIds] = useState([]);
  const [expiraEm, setExpiraEm] = useState("");
  const [maquinaId, setMaquinaId] = useState("");
  const [criando, setCriando] = useState(false);
  const [linkCriado, setLinkCriado] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [abrindoQrId, setAbrindoQrId] = useState("");

  const [lote, setLote] = useState(null);
  const [abrindoLoteId, setAbrindoLoteId] = useState("");
  const [loteCopiado, setLoteCopiado] = useState(false);

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
      setLojasMachinePay(response.data.lojasMachinePay || []);
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao carregar os links.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    if (!linkCriado?.url) {
      setQrDataUrl("");
      return;
    }
    let cancelado = false;
    gerarQrCode(linkCriado.url)
      .then((dataUrl) => {
        if (!cancelado) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelado) setError("Não foi possível gerar o QR Code.");
      });
    return () => {
      cancelado = true;
    };
  }, [linkCriado?.url]);

  // Abre a janela do lote (vários links) já com o QR Code de cada um.
  const abrirLote = async (lista) => {
    const comQr = await Promise.all(
      lista.map(async (link) => {
        const url = montarUrlLink(link.token);
        return { ...link, url, qrDataUrl: await gerarQrCode(url) };
      }),
    );
    setLoteCopiado(false);
    setLote(comQr);
  };

  const enviarCriacao = async (dados) => {
    try {
      setCriando(true);
      setError("");
      const response = await api.post("/credito-remoto/links", dados);
      const criados = response.data.links || [];
      if (criados.length === 1) {
        setLinkCriado({
          ...criados[0],
          url: montarUrlLink(criados[0].token),
          novo: true,
        });
        setCopiado(false);
      } else {
        await abrirLote(criados);
      }
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
    if (escopo === "lojas" && lojaIds.length === 0) {
      setError("Escolha pelo menos uma loja.");
      return;
    }
    if (escopo === "maquina" && !maquinaId) {
      setError("Escolha a máquina.");
      return;
    }
    const ok = await enviarCriacao({
      descricao,
      limite: limite.replace(",", "."),
      quantidade: Number(quantidade),
      expiraEm: expiraEm ? new Date(expiraEm).toISOString() : null,
      maquinaId: escopo === "maquina" ? maquinaId : null,
      lojaIds: escopo === "lojas" ? lojaIds : [],
    });
    if (ok) {
      setDescricao("");
      setLimite("150");
      setQuantidade("1");
      setExpiraEm("");
    }
  };

  const alternarLoja = (id) =>
    setLojaIds((atual) =>
      atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id],
    );

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

  const abrirQrCode = async (link) => {
    try {
      setAbrindoQrId(link.id);
      setError("");
      const response = await api.get(`/credito-remoto/links/${link.id}/token`);
      setCopiado(false);
      setLinkCriado({
        ...link,
        url: montarUrlLink(response.data.token),
        novo: false,
      });
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível abrir o QR Code.");
    } finally {
      setAbrindoQrId("");
    }
  };

  const abrirLoteExistente = async (loteId) => {
    try {
      setAbrindoLoteId(loteId);
      setError("");
      const response = await api.get(`/credito-remoto/lotes/${loteId}/tokens`);
      const ativos = response.data.links || [];
      if (ativos.length === 0) {
        setError("Nenhum link ativo neste lote.");
        return;
      }
      await abrirLote(ativos);
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível abrir o lote.");
    } finally {
      setAbrindoLoteId("");
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

  const copiarLote = async () => {
    try {
      await navigator.clipboard.writeText(
        lote
          .map((item) => `${item.descricao} (${formatarMoeda(item.restante)}): ${item.url}`)
          .join("\n"),
      );
      setLoteCopiado(true);
    } catch {
      setLoteCopiado(false);
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

  // Quantos links cada lote tem (pra mostrar o botão "Imprimir lote" só em
  // lotes com mais de um).
  const tamanhoLote = links.reduce((mapa, link) => {
    if (link.loteId) mapa[link.loteId] = (mapa[link.loteId] || 0) + 1;
    return mapa;
  }, {});

  const quantidadeNumero = Number(quantidade) || 0;
  const valorNumero = Number(String(limite).replace(",", ".")) || 0;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Créditos Remotos"
          subtitle="Links temporários (vouchers) para enviar crédito Machine Pay nas máquinas"
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
            <h2 className="text-xl font-bold text-gray-900 mb-4">Novos links</h2>
            <form onSubmit={criar} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Para quem é
                </label>
                <input
                  className="input-field w-full"
                  placeholder="Ex: Artista Fulano - GRU / Promoção Shopping"
                  value={descricao}
                  onChange={(event) => setDescricao(event.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Quantidade
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={QUANTIDADE_MAXIMA}
                    className="input-field w-full"
                    value={quantidade}
                    onChange={(event) => setQuantidade(event.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Valor de cada (R$)
                  </label>
                  <input
                    className="input-field w-full"
                    inputMode="decimal"
                    value={limite}
                    onChange={(event) => setLimite(event.target.value)}
                    required
                  />
                </div>
              </div>
              {quantidadeNumero > 1 && valorNumero > 0 && (
                <p className="text-xs text-gray-600 -mt-2">
                  {quantidadeNumero} vouchers de {formatarMoeda(valorNumero)} = total de{" "}
                  <strong>{formatarMoeda(quantidadeNumero * valorNumero)}</strong>
                </p>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Onde vale
                </label>
                <div className="space-y-1 text-sm">
                  {[
                    ["gru", "Máquinas GRU (aeroporto)"],
                    ["lojas", "Lojas escolhidas"],
                    ["maquina", "Uma máquina só"],
                  ].map(([valor, rotulo]) => (
                    <label key={valor} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="escopo"
                        checked={escopo === valor}
                        onChange={() => setEscopo(valor)}
                      />
                      {rotulo}
                    </label>
                  ))}
                </div>
              </div>

              {escopo === "lojas" && (
                <div className="rounded-lg border border-gray-200 bg-white p-3 max-h-56 overflow-y-auto space-y-1">
                  {lojasMachinePay.length === 0 ? (
                    <p className="text-sm text-amber-700">
                      Nenhuma loja ativa com máquina Machine Pay.
                    </p>
                  ) : (
                    lojasMachinePay.map((loja) => (
                      <label key={loja.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={lojaIds.includes(loja.id)}
                          onChange={() => alternarLoja(loja.id)}
                        />
                        <span>
                          {loja.nome}{" "}
                          <span className="text-xs text-gray-500">
                            ({loja.qtdMaquinas} máquina{loja.qtdMaquinas === 1 ? "" : "s"})
                          </span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              )}

              {escopo === "maquina" && (
                <select
                  className="input-field w-full"
                  value={maquinaId}
                  onChange={(event) => setMaquinaId(event.target.value)}
                >
                  <option value="">Escolha a máquina</option>
                  {maquinasMachinePay.map((maquina) => (
                    <option key={maquina.id} value={maquina.id}>
                      {maquina.nome}
                    </option>
                  ))}
                </select>
              )}

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
                  Cada link também expira sozinho quando o valor dele acaba.
                </p>
              </div>
              <button type="submit" className="btn-primary w-full" disabled={criando}>
                {criando
                  ? "Gerando..."
                  : quantidadeNumero > 1
                    ? `Gerar ${quantidadeNumero} links`
                    : "Gerar link"}
              </button>
            </form>

            {escopo === "gru" && (
              <div className="mt-6 border-t border-gray-200 pt-4">
                <p className="text-xs font-bold uppercase text-gray-500 mb-2">
                  Máquinas GRU
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
            )}
          </section>

          <section className="lg:col-span-2 space-y-3">
            {links.length === 0 ? (
              <div className="card text-center py-12 text-gray-600">
                Nenhum link criado ainda.
              </div>
            ) : (
              links.map((link) => {
                const situacao = situacoes[link.situacao] || situacoes.inativo;
                const ehLote = link.loteId && tamanhoLote[link.loteId] > 1;
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
                          🎮 {descreverEscopo(link)}
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
                      <div className="flex flex-wrap gap-2 shrink-0 sm:max-w-xs sm:justify-end">
                        {link.situacao === "ativo" && link.podeCopiar && (
                          <>
                            <button
                              type="button"
                              className="btn-primary text-sm"
                              onClick={() => copiarLinkExistente(link)}
                            >
                              {copiadoId === link.id ? "Copiado!" : "📋 Copiar link"}
                            </button>
                            <button
                              type="button"
                              className="btn-secondary text-sm"
                              onClick={() => abrirQrCode(link)}
                              disabled={abrindoQrId === link.id}
                            >
                              {abrindoQrId === link.id ? "Abrindo..." : "🔳 QR Code"}
                            </button>
                          </>
                        )}
                        {ehLote && (
                          <button
                            type="button"
                            className="btn-secondary text-sm"
                            onClick={() => abrirLoteExistente(link.loteId)}
                            disabled={abrindoLoteId === link.loteId}
                          >
                            {abrindoLoteId === link.loteId
                              ? "Abrindo..."
                              : `🖨️ Lote (${tamanhoLote[link.loteId]})`}
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
        title={linkCriado?.novo ? "Link criado" : "QR Code do link"}
      >
        {linkCriado && (
          <div className="space-y-4">
            <p className="text-gray-700">
              {linkCriado.novo ? "Envie este link para " : "Link de "}
              <strong>{linkCriado.descricao}</strong>. Saldo de{" "}
              <strong>{formatarMoeda(linkCriado.restante)}</strong> ·{" "}
              {descreverEscopo(linkCriado)}.
            </p>
            <div className="flex justify-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Code do link"
                  className="w-56 h-56 rounded-lg border border-gray-200 bg-white p-2"
                />
              ) : (
                <div className="w-56 h-56 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-500">
                  Gerando QR Code...
                </div>
              )}
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm break-all font-mono">
              {linkCriado.url}
            </div>
            {linkCriado.novo && (
              <p className="text-sm text-gray-500">
                Dá pra copiar de novo e reabrir o QR Code depois pelos botões na lista.
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={!qrDataUrl}
                onClick={() =>
                  imprimirVouchers([{ qrDataUrl, valor: linkCriado.restante }])
                }
              >
                🖨️ Imprimir QR Code
              </button>
              <button type="button" className="btn-primary" onClick={copiar}>
                {copiado ? "Copiado!" : "Copiar link"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(lote)}
        onClose={() => setLote(null)}
        title={lote ? `${lote.length} vouchers` : ""}
        size="lg"
      >
        {lote && (
          <div className="space-y-4">
            <p className="text-gray-700">
              {lote.length} vouchers ativos · {descreverEscopo(lote[0])}. Total de{" "}
              <strong>
                {formatarMoeda(lote.reduce((soma, item) => soma + Number(item.restante || 0), 0))}
              </strong>
              .
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  imprimirVouchers(
                    lote.map((item) => ({ qrDataUrl: item.qrDataUrl, valor: item.restante })),
                    4,
                  )
                }
              >
                🖨️ Imprimir todos (4 por folha)
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  imprimirVouchers(
                    lote.map((item) => ({ qrDataUrl: item.qrDataUrl, valor: item.restante })),
                    1,
                  )
                }
              >
                🖨️ Imprimir todos (1 por folha)
              </button>
              <button type="button" className="btn-secondary" onClick={copiarLote}>
                {loteCopiado ? "Copiado!" : "📋 Copiar todos os links"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 max-h-[55vh] overflow-y-auto">
              {lote.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-gray-200 bg-white p-2 text-center"
                >
                  <img
                    src={item.qrDataUrl}
                    alt={`QR Code ${item.descricao}`}
                    className="w-full aspect-square"
                  />
                  <p className="text-xs font-semibold text-gray-800 mt-1 wrap-break-word">
                    {item.descricao}
                  </p>
                  <p className="text-xs text-emerald-700 font-bold">
                    {formatarMoeda(item.restante)}
                  </p>
                </div>
              ))}
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
