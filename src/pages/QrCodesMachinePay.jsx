import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import JSZip from "jszip";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, AlertBox } from "../components/UIComponents";
import { AbasMachinePay } from "../components/AbasMachinePay";
import api from "../services/api";

// Tamanho do PNG e margem branca em volta (em "módulos" do QR: 1 módulo ≈ 10px).
const TAMANHO_QR = 600;
const MARGEM_QR = 1;

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

// Desenha o QR a partir do texto PIX do caixa (campo qr_code do Mercado Pago):
// é o mesmo QR do link do "Consultar caixa", já sem a moldura do template.
const gerarPng = async (qrCode) => {
  const dataUrl = await QRCode.toDataURL(qrCode, {
    width: TAMANHO_QR,
    margin: MARGEM_QR,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });
  return dataUrl.split(",")[1];
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
      .get("/machine-pay/caixas/clientes")
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
          (caixa) => normalizar(caixa.nome).includes(termo) || caixa.idCaixa.includes(termo),
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
      const response = await api.get(`/machine-pay/caixas/clientes/${escolhido.id}/qrcodes`);
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
      const response = await api.post(`/machine-pay/caixas/clientes/${cliente.id}/qrcodes`, {
        ids: caixas.filter((c) => selecionados.has(c.idCaixa)).map((c) => c.idCaixa),
      });
      const resultado = response.data.caixas || [];
      const comQr = resultado.filter((caixa) => caixa.qrCode);
      setFalhas(resultado.filter((caixa) => !caixa.qrCode));

      if (comQr.length === 0) {
        setError("Nenhum dos caixas escolhidos devolveu QR code.");
        return;
      }

      // Nome repetido entre caixas ganha o ID no arquivo pra não sobrescrever.
      const contagem = {};
      comQr.forEach((caixa) => {
        const chave = normalizar(caixa.nome);
        contagem[chave] = (contagem[chave] || 0) + 1;
      });
      const arquivos = await Promise.all(
        comQr.map(async (caixa) => ({
          nome: `${nomeArquivo(caixa.nome)}${
            contagem[normalizar(caixa.nome)] > 1 || !caixa.nome ? ` (${caixa.idCaixa})` : ""
          }.png`,
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
              <p className="text-gray-600">Buscando caixas no Mercado Pago...</p>
            ) : caixas.length === 0 ? (
              <p className="text-gray-600">Este cliente não tem caixas.</p>
            ) : (
              <div className="space-y-3">
                <input
                  className="input-field w-full"
                  placeholder="Filtrar caixas por nome ou ID"
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
                          <span className="font-semibold text-gray-900">{caixa.nome || "—"}</span>
                          <span className="font-mono text-xs text-gray-500">{caixa.idCaixa}</span>
                          {!caixa.temQr && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                              sem QR
                            </span>
                          )}
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
                          {caixa.nome || caixa.idCaixa}: {caixa.erro}
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
