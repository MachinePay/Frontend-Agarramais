import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import JSZip from "jszip";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, AlertBox } from "../components/UIComponents";
import { AbasMachinePay } from "../components/AbasMachinePay";
import api from "../services/api";

// Etiqueta 10 x 10 cm na Argox OS-214 Plus (203 dpi = 8 pontos/mm): o PNG
// tem o tamanho da etiqueta e o QR ocupa ~5 x 5 cm no meio, o resto é branco.
const PONTOS_POR_MM = 8;
const ETIQUETA_MM = 100;
const QR_MM = 50;

const normalizar = (texto) =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const nomeArquivo = (texto) =>
  String(texto || "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim() || "caixa";

const baixar = (blob, nome) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// CRC32 do PNG, para gravar o bloco pHYs (DPI) no arquivo.
const TABELA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (bytes) => {
  let c = 0xffffffff;
  for (const byte of bytes) c = TABELA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

// Marca o PNG como 203 dpi, pra impressão em "tamanho real" sair com 10 cm.
const comDpi = (png) => {
  const pontosPorMetro = PONTOS_POR_MM * 1000;
  const bloco = new Uint8Array(21);
  const dados = new DataView(bloco.buffer);
  dados.setUint32(0, 9);
  bloco.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  dados.setUint32(8, pontosPorMetro);
  dados.setUint32(12, pontosPorMetro);
  bloco[16] = 1; // unidade: metro
  dados.setUint32(17, crc32(bloco.subarray(4, 17)));
  // Logo depois do IHDR (assinatura 8 bytes + IHDR 25 bytes).
  const saida = new Uint8Array(png.length + bloco.length);
  saida.set(png.subarray(0, 33));
  saida.set(bloco, 33);
  saida.set(png.subarray(33), 33 + bloco.length);
  return saida;
};

// Desenha o QR a partir do texto PIX do caixa (campo qr_code do Mercado Pago):
// é o mesmo QR do link do "Consultar caixa", já sem a moldura do template.
// Cada módulo do QR vira um número inteiro de pontos da impressora, pra sair
// nítido no adesivo.
const gerarPng = async (qrCode) => {
  const { modules } = QRCode.create(qrCode, { errorCorrectionLevel: "M" });
  const etiqueta = ETIQUETA_MM * PONTOS_POR_MM;
  const escala = Math.floor((QR_MM * PONTOS_POR_MM) / modules.size);
  const inicio = Math.round((etiqueta - modules.size * escala) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = etiqueta;
  canvas.height = etiqueta;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, etiqueta, etiqueta);
  ctx.fillStyle = "#000000";
  for (let linha = 0; linha < modules.size; linha += 1) {
    for (let coluna = 0; coluna < modules.size; coluna += 1) {
      if (modules.get(linha, coluna)) {
        ctx.fillRect(inicio + coluna * escala, inicio + linha * escala, escala, escala);
      }
    }
  }

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  const png = comDpi(new Uint8Array(await blob.arrayBuffer()));
  let binario = "";
  png.forEach((byte) => {
    binario += String.fromCharCode(byte);
  });
  return btoa(binario);
};

const base64ParaBlob = (base64) =>
  new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], { type: "image/png" });

export function QrCodesMachinePay() {
  const [clientes, setClientes] = useState([]);
  const [carregandoClientes, setCarregandoClientes] = useState(true);
  const [busca, setBusca] = useState("");
  const [cliente, setCliente] = useState(null);
  const [caixas, setCaixas] = useState([]);
  const [carregandoCaixas, setCarregandoCaixas] = useState(false);
  const [filtroCaixa, setFiltroCaixa] = useState("");
  const [selecionados, setSelecionados] = useState(new Set());
  const [baixando, setBaixando] = useState(false);
  const [falhas, setFalhas] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/machine-pay/caixas/qrcodes/clientes")
      .then((response) => setClientes(response.data.clientes || []))
      .catch((err) =>
        setError(err.response?.data?.error || "Erro ao carregar os clientes da Machine Pay."),
      )
      .finally(() => setCarregandoClientes(false));
  }, []);

  const clientesFiltrados = useMemo(() => {
    const termo = normalizar(busca);
    return termo
      ? clientes.filter((item) => normalizar(item.nome).includes(termo))
      : clientes;
  }, [busca, clientes]);

  const caixasFiltrados = useMemo(() => {
    const termo = normalizar(filtroCaixa);
    return termo
      ? caixas.filter(
          (caixa) => normalizar(caixa.ponto).includes(termo) || caixa.idCaixa.includes(termo),
        )
      : caixas;
  }, [filtroCaixa, caixas]);

  const escolherCliente = async (escolhido) => {
    setCliente(escolhido);
    setBusca("");
    setFiltroCaixa("");
    setSelecionados(new Set());
    setFalhas([]);
    setError("");
    setCaixas([]);
    try {
      setCarregandoCaixas(true);
      const response = await api.get(`/machine-pay/caixas/qrcodes/clientes/${escolhido.id}`);
      setCaixas(response.data.caixas || []);
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao buscar os caixas do cliente.");
    } finally {
      setCarregandoCaixas(false);
    }
  };

  const alternar = (idCaixa) =>
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(idCaixa)) novo.delete(idCaixa);
      else novo.add(idCaixa);
      return novo;
    });

  const todosFiltradosMarcados =
    caixasFiltrados.length > 0 &&
    caixasFiltrados.every((caixa) => selecionados.has(caixa.idCaixa));

  const alternarTodos = () =>
    setSelecionados((atual) => {
      const novo = new Set(atual);
      caixasFiltrados.forEach((caixa) =>
        todosFiltradosMarcados ? novo.delete(caixa.idCaixa) : novo.add(caixa.idCaixa),
      );
      return novo;
    });

  const baixarQrCodes = async () => {
    setBaixando(true);
    setError("");
    setFalhas([]);
    try {
      const response = await api.post(`/machine-pay/caixas/qrcodes/clientes/${cliente.id}`, {
        ids: caixas.filter((c) => selecionados.has(c.idCaixa)).map((c) => c.idCaixa),
      });
      const resultado = response.data.caixas || [];
      const comQr = resultado.filter((caixa) => caixa.qrCode);
      setFalhas(resultado.filter((caixa) => !caixa.qrCode));

      if (comQr.length === 0) {
        setError("Nenhum dos caixas escolhidos devolveu QR code.");
        return;
      }

      // Arquivo = nome do caixa + nome do ponto (quando diferente). Nome
      // repetido ganha o ID do caixa pra não sobrescrever.
      const nomes = comQr.map((caixa) =>
        nomeArquivo(
          [caixa.nome, normalizar(caixa.ponto) !== normalizar(caixa.nome) ? caixa.ponto : ""]
            .filter(Boolean)
            .join(" - ") || caixa.idCaixa,
        ),
      );
      const contagem = {};
      nomes.forEach((nome) => {
        contagem[normalizar(nome)] = (contagem[normalizar(nome)] || 0) + 1;
      });
      const arquivos = await Promise.all(
        comQr.map(async (caixa, i) => ({
          nome: `${nomes[i]}${contagem[normalizar(nomes[i])] > 1 ? ` (${caixa.idCaixa})` : ""}.png`,
          base64: await gerarPng(caixa.qrCode),
        })),
      );

      if (arquivos.length === 1) {
        baixar(base64ParaBlob(arquivos[0].base64), arquivos[0].nome);
      } else {
        const zip = new JSZip();
        arquivos.forEach((arquivo) => zip.file(arquivo.nome, arquivo.base64, { base64: true }));
        baixar(
          await zip.generateAsync({ type: "blob" }),
          `QR codes - ${nomeArquivo(cliente.nome)}.zip`,
        );
      }
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao gerar os QR codes.");
    } finally {
      setBaixando(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Machine Pay"
          subtitle="Baixar os QR codes PIX dos caixas de um cliente da Machine Pay"
          icon="🔳"
        />
        <AbasMachinePay />

        {error && (
          <div className="mb-6">
            <AlertBox type="error" message={error} onClose={() => setError("")} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="card-gradient lg:col-span-1">
            <h2 className="text-lg font-bold text-gray-900 mb-3">1. Cliente</h2>
            {cliente ? (
              <div className="rounded-lg border border-primary bg-white p-3">
                <p className="text-xs font-bold uppercase text-gray-500">Cliente escolhido</p>
                <p className="text-lg font-black text-gray-900">{cliente.nome}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {carregandoCaixas ? "Buscando caixas..." : `${caixas.length} caixa(s)`}
                </p>
                <button
                  type="button"
                  className="btn-secondary text-xs px-2 py-1 mt-2"
                  onClick={() => setCliente(null)}
                  disabled={baixando}
                >
                  Trocar cliente
                </button>
              </div>
            ) : (
              <>
                <input
                  className="input-field w-full"
                  placeholder={carregandoClientes ? "Carregando clientes..." : "Digite o nome do cliente"}
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  disabled={carregandoClientes}
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  {clientesFiltrados.length} de {clientes.length} clientes
                </p>
                <ul className="mt-2 max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
                  {clientesFiltrados.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-amber-50"
                        onClick={() => escolherCliente(item)}
                      >
                        {item.nome}
                      </button>
                    </li>
                  ))}
                  {!carregandoClientes && clientesFiltrados.length === 0 && (
                    <li className="px-3 py-2 text-sm text-gray-500">Nenhum cliente com esse nome.</li>
                  )}
                </ul>
              </>
            )}
          </section>

          <section className="card-gradient lg:col-span-2">
            <h2 className="text-lg font-bold text-gray-900 mb-3">2. Caixas</h2>
            {!cliente ? (
              <p className="text-gray-600">Escolha o cliente primeiro.</p>
            ) : carregandoCaixas ? (
              <p className="text-gray-600">Buscando caixas no painel...</p>
            ) : caixas.length === 0 ? (
              <p className="text-gray-600">Este cliente não tem caixas na tela de Equipamentos.</p>
            ) : (
              <div className="space-y-3">
                <input
                  className="input-field w-full"
                  placeholder="Filtrar por nome do ponto ou ID do caixa"
                  value={filtroCaixa}
                  onChange={(event) => setFiltroCaixa(event.target.value)}
                  disabled={baixando}
                />

                <div className="rounded-lg border border-gray-200 bg-white">
                  <label className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={todosFiltradosMarcados}
                      onChange={alternarTodos}
                      disabled={baixando || caixasFiltrados.length === 0}
                    />
                    {filtroCaixa ? "Marcar todos os filtrados" : "Marcar todos"} (
                    {caixasFiltrados.length})
                  </label>
                  <ul className="max-h-96 overflow-y-auto divide-y divide-gray-100 text-sm">
                    {caixasFiltrados.map((caixa) => (
                      <li key={caixa.idCaixa}>
                        <label className="flex items-center gap-2 px-3 py-2 hover:bg-amber-50">
                          <input
                            type="checkbox"
                            checked={selecionados.has(caixa.idCaixa)}
                            onChange={() => alternar(caixa.idCaixa)}
                            disabled={baixando}
                          />
                          <span className="font-semibold text-gray-900">{caixa.ponto || "—"}</span>
                          <span className="font-mono text-xs text-gray-500">Caixa {caixa.idCaixa}</span>
                        </label>
                      </li>
                    ))}
                    {caixasFiltrados.length === 0 && (
                      <li className="px-3 py-2 text-sm text-gray-500">Nenhum caixa com esse filtro.</li>
                    )}
                  </ul>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={baixando || selecionados.size === 0}
                    onClick={baixarQrCodes}
                  >
                    {baixando
                      ? "Gerando QR codes..."
                      : selecionados.size > 1
                        ? `📥 Baixar ${selecionados.size} QR codes (.zip)`
                        : "📥 Baixar QR code"}
                  </button>
                  {selecionados.size > 0 && !baixando && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setSelecionados(new Set())}
                    >
                      Limpar seleção
                    </button>
                  )}
                </div>

                {falhas.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    ⚠️ {falhas.length} caixa(s) ficaram de fora:
                    <ul className="mt-1 list-disc pl-5">
                      {falhas.map((caixa) => (
                        <li key={caixa.idCaixa}>
                          {caixa.ponto || caixa.idCaixa}: {caixa.erro}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
