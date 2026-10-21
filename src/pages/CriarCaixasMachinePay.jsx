import { useEffect, useMemo, useRef, useState } from "react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, AlertBox, ConfirmDialog } from "../components/UIComponents";
import { AbasMachinePay } from "../components/AbasMachinePay";
import api from "../services/api";

const MAXIMO_SEQUENCIA = 100;

const normalizar = (texto) =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// "PlayToys 01" até "PlayToys 15" -> ["PlayToys 01", ..., "PlayToys 15"].
// O prefixo tem que ser igual e o número final define a sequência; os zeros
// à esquerda do primeiro nome definem quantos dígitos usar.
const gerarSequencia = (inicio, fim) => {
  const a = String(inicio || "").trim().match(/^(.*?)(\d+)$/);
  const b = String(fim || "").trim().match(/^(.*?)(\d+)$/);
  if (!inicio.trim() || !fim.trim()) return { nomes: [], erro: "" };
  if (!a || !b) {
    return { nomes: [], erro: "Os dois nomes precisam terminar com número (ex.: PlayToys 01)." };
  }
  if (a[1] !== b[1]) {
    return {
      nomes: [],
      erro: `O começo dos nomes tem que ser igual ("${a[1]}" ≠ "${b[1]}").`,
    };
  }
  const primeiro = Number(a[2]);
  const ultimo = Number(b[2]);
  if (ultimo < primeiro) {
    return { nomes: [], erro: "O nome final precisa ter número maior que o inicial." };
  }
  const quantidade = ultimo - primeiro + 1;
  if (quantidade > MAXIMO_SEQUENCIA) {
    return { nomes: [], erro: `No máximo ${MAXIMO_SEQUENCIA} caixas por vez.` };
  }
  const digitos = a[2].length;
  return {
    nomes: Array.from(
      { length: quantidade },
      (_, i) => `${a[1]}${String(primeiro + i).padStart(digitos, "0")}`,
    ),
    erro: "",
  };
};

const estilosStatus = {
  pendente: "bg-gray-100 text-gray-600",
  pulado: "bg-gray-100 text-gray-500",
  criando: "bg-amber-100 text-amber-800",
  criado: "bg-emerald-100 text-emerald-800",
  erro: "bg-red-100 text-red-800",
};

const rotulosStatus = {
  pendente: "Aguardando",
  pulado: "Já existia (pulado)",
  criando: "Criando...",
  criado: "Criado",
  erro: "Erro",
};

export function CriarCaixasMachinePay() {
  const [clientes, setClientes] = useState([]);
  const [carregandoClientes, setCarregandoClientes] = useState(true);
  const [busca, setBusca] = useState("");
  const [cliente, setCliente] = useState(null);
  const [caixasExistentes, setCaixasExistentes] = useState(null);
  const [carregandoCaixas, setCarregandoCaixas] = useState(false);
  const [verExistentes, setVerExistentes] = useState(false);

  const [modo, setModo] = useState("um");
  const [nomeUnico, setNomeUnico] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [pularExistentes, setPularExistentes] = useState(true);

  const [fila, setFila] = useState([]);
  const [executando, setExecutando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState("");
  const pararRef = useRef(false);

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

  const carregarCaixas = async (escolhido) => {
    try {
      setCarregandoCaixas(true);
      const response = await api.get(`/machine-pay/caixas/clientes/${escolhido.id}`);
      setCaixasExistentes(response.data.caixas || []);
    } catch (err) {
      setCaixasExistentes(null);
      setError(err.response?.data?.error || "Erro ao buscar os caixas do cliente.");
    } finally {
      setCarregandoCaixas(false);
    }
  };

  const escolherCliente = (escolhido) => {
    setCliente(escolhido);
    setBusca("");
    setFila([]);
    setError("");
    setVerExistentes(false);
    setCaixasExistentes(null);
    carregarCaixas(escolhido);
  };

  const sequencia = useMemo(() => gerarSequencia(inicio, fim), [inicio, fim]);

  const nomesExistentes = useMemo(
    () => new Set((caixasExistentes || []).map((caixa) => normalizar(caixa.nome))),
    [caixasExistentes],
  );

  const nomesDesejados =
    modo === "um"
      ? nomeUnico.trim()
        ? [nomeUnico.replace(/\s+/g, " ").trim()]
        : []
      : sequencia.nomes;

  const nomesRepetidos = nomesDesejados.filter((nome) => nomesExistentes.has(normalizar(nome)));
  const nomesParaCriar = pularExistentes
    ? nomesDesejados.filter((nome) => !nomesExistentes.has(normalizar(nome)))
    : nomesDesejados;

  const montarFila = () =>
    nomesDesejados.map((nome) => ({
      nome,
      status:
        pularExistentes && nomesExistentes.has(normalizar(nome)) ? "pulado" : "pendente",
      resultado: null,
      erro: "",
    }));

  const atualizarItem = (indice, dados) =>
    setFila((atual) => atual.map((item, i) => (i === indice ? { ...item, ...dados } : item)));

  // Cria um por um, na ordem. Para no primeiro erro (pra não criar pela
  // metade sem ninguém ver) — dá pra continuar de onde parou.
  const executar = async (filaInicial) => {
    pararRef.current = false;
    setExecutando(true);
    setError("");
    setFila(filaInicial);

    for (let i = 0; i < filaInicial.length; i += 1) {
      if (pararRef.current) break;
      const item = filaInicial[i];
      if (item.status !== "pendente" && item.status !== "erro") continue;

      atualizarItem(i, { status: "criando", erro: "" });
      try {
        const response = await api.post("/machine-pay/caixas", {
          clienteId: cliente.id,
          nome: item.nome,
        });
        atualizarItem(i, { status: "criado", resultado: response.data });
        filaInicial[i] = { ...item, status: "criado", resultado: response.data };
      } catch (err) {
        const mensagem = err.response?.data?.error || "Erro ao criar o caixa.";
        atualizarItem(i, { status: "erro", erro: mensagem });
        setError(`Parou em "${item.nome}": ${mensagem}`);
        break;
      }
    }

    setExecutando(false);
    carregarCaixas(cliente);
  };

  const iniciar = () => executar(montarFila());
  const continuar = () => executar(fila.map((item) => ({ ...item })));

  const criados = fila.filter((item) => item.status === "criado");
  const temPendentes = fila.some((item) => item.status === "pendente" || item.status === "erro");
  const andamento = fila.filter((item) => ["criado", "pulado"].includes(item.status)).length;

  const copiarResultado = () =>
    navigator.clipboard.writeText(
      criados
        .map(
          (item) =>
            `${item.nome} | Caixa ${item.resultado.idCaixa}${item.resultado.idLoja ? ` | Loja ${item.resultado.idLoja}` : ""}`,
        )
        .join("\n"),
    );

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Machine Pay"
          subtitle="Criar Loja e Caixa (Mercado Pago) no cadastro de um cliente da Machine Pay"
          icon="🏠"
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
                  {carregandoCaixas
                    ? "Buscando caixas..."
                    : caixasExistentes
                      ? `${caixasExistentes.length} caixa(s) já cadastrado(s)`
                      : ""}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="btn-secondary text-xs px-2 py-1"
                    onClick={() => setCliente(null)}
                    disabled={executando}
                  >
                    Trocar cliente
                  </button>
                  {caixasExistentes?.length > 0 && (
                    <button
                      type="button"
                      className="btn-secondary text-xs px-2 py-1"
                      onClick={() => setVerExistentes((v) => !v)}
                    >
                      {verExistentes ? "Esconder caixas" : "Ver caixas"}
                    </button>
                  )}
                </div>
                {verExistentes && caixasExistentes && (
                  <ul className="mt-3 max-h-60 overflow-y-auto text-xs text-gray-700 space-y-1">
                    {caixasExistentes.map((caixa) => (
                      <li key={`${caixa.idCaixa}-${caixa.nome}`}>
                        <span className="font-mono text-gray-500">{caixa.idCaixa}</span>{" "}
                        {caixa.nome}
                      </li>
                    ))}
                  </ul>
                )}
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
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Quer criar uma sequência de caixas com nomes em ordem?
                  </p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={modo === "um"}
                        onChange={() => setModo("um")}
                        disabled={executando}
                      />
                      Não, só um caixa
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={modo === "sequencia"}
                        onChange={() => setModo("sequencia")}
                        disabled={executando}
                      />
                      Sim, uma sequência
                    </label>
                  </div>
                </div>

                {modo === "um" ? (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Nome do caixa (vai igual em Nome da Loja e Nome do Caixa)
                    </label>
                    <input
                      className="input-field w-full"
                      placeholder="Ex: PlayToys 01"
                      value={nomeUnico}
                      onChange={(event) => setNomeUnico(event.target.value)}
                      disabled={executando}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Começa em
                      </label>
                      <input
                        className="input-field w-full"
                        placeholder="PlayToys 01"
                        value={inicio}
                        onChange={(event) => setInicio(event.target.value)}
                        disabled={executando}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Termina em
                      </label>
                      <input
                        className="input-field w-full"
                        placeholder="PlayToys 15"
                        value={fim}
                        onChange={(event) => setFim(event.target.value)}
                        disabled={executando}
                      />
                    </div>
                    {sequencia.erro && (
                      <p className="sm:col-span-2 text-sm text-red-700">{sequencia.erro}</p>
                    )}
                    {sequencia.nomes.length > 0 && (
                      <p className="sm:col-span-2 text-sm text-gray-700">
                        <strong>{sequencia.nomes.length} caixas:</strong>{" "}
                        {sequencia.nomes.length <= 6
                          ? sequencia.nomes.join(", ")
                          : `${sequencia.nomes.slice(0, 3).join(", ")}, …, ${sequencia.nomes.slice(-2).join(", ")}`}
                      </p>
                    )}
                  </div>
                )}

                {nomesRepetidos.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    ⚠️ {nomesRepetidos.length} nome(s) já existem neste cliente:{" "}
                    {nomesRepetidos.slice(0, 5).join(", ")}
                    {nomesRepetidos.length > 5 ? "…" : ""}
                    <label className="mt-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={pularExistentes}
                        onChange={(event) => setPularExistentes(event.target.checked)}
                        disabled={executando}
                      />
                      Pular os que já existem
                    </label>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={executando || nomesParaCriar.length === 0 || carregandoCaixas}
                    onClick={() => setConfirmar(true)}
                  >
                    {nomesParaCriar.length > 1
                      ? `Criar ${nomesParaCriar.length} lojas e caixas`
                      : "Criar loja e caixa"}
                  </button>
                  {executando && (
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => {
                        pararRef.current = true;
                      }}
                    >
                      Parar depois do atual
                    </button>
                  )}
                  {!executando && temPendentes && fila.length > 0 && (
                    <button type="button" className="btn-secondary" onClick={continuar}>
                      Continuar de onde parou
                    </button>
                  )}
                </div>

                {fila.length > 0 && (
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-sm font-bold text-gray-900">
                        {andamento} de {fila.length} prontos
                        {executando ? " — criando um por um..." : ""}
                      </p>
                      {criados.length > 0 && !executando && (
                        <button
                          type="button"
                          className="btn-secondary text-xs px-2 py-1"
                          onClick={copiarResultado}
                        >
                          📋 Copiar IDs criados
                        </button>
                      )}
                    </div>
                    <div className="h-2 rounded-full bg-gray-200 overflow-hidden mb-3">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${(andamento / fila.length) * 100}%` }}
                      />
                    </div>
                    <ul className="max-h-96 overflow-y-auto divide-y divide-gray-100 text-sm">
                      {fila.map((item) => (
                        <li
                          key={item.nome}
                          className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="font-semibold text-gray-900">{item.nome}</span>
                          <span className="flex flex-wrap items-center gap-2">
                            {item.resultado && (
                              <span className="font-mono text-xs text-gray-600">
                                Caixa {item.resultado.idCaixa}
                                {item.resultado.idLoja ? ` · Loja ${item.resultado.idLoja}` : ""}
                              </span>
                            )}
                            {item.resultado?.qrCodeUrl && (
                              <a
                                href={item.resultado.qrCodeUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-blue-700 underline"
                              >
                                QR PIX
                              </a>
                            )}
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${estilosStatus[item.status]}`}
                            >
                              {rotulosStatus[item.status]}
                            </span>
                          </span>
                          {item.erro && (
                            <span className="text-xs text-red-700 sm:basis-full">{item.erro}</span>
                          )}
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

      <ConfirmDialog
        isOpen={confirmar}
        onClose={() => setConfirmar(false)}
        onConfirm={iniciar}
        title="Criar na Machine Pay"
        message={
          cliente
            ? `Criar ${nomesParaCriar.length} loja(s) e caixa(s) no cliente "${cliente.nome}"${
                nomesParaCriar.length > 1
                  ? `, de "${nomesParaCriar[0]}" até "${nomesParaCriar[nomesParaCriar.length - 1]}"`
                  : `: "${nomesParaCriar[0] || ""}"`
              }? Eles são criados de verdade no Mercado Pago, um por um.`
            : ""
        }
        confirmText="Criar"
        type="primary"
      />

      <Footer />
    </div>
  );
}
