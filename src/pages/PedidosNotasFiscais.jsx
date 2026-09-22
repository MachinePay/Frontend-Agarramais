import { useEffect, useRef, useState } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, Modal } from "../components/UIComponents";

const FRETE_OPTIONS = ["CIF", "FOB"];

const emptyForm = () => ({
  id: null,
  clienteNome: "",
  numeroPedido: "",
  dataPedido: "",
  numeroNota: "",
  dataNota: "",
  tipoFrete: "",
  transportadora: "",
  numeroColeta: "",
  temNumeroColeta: true,
  teveCotacao: false,
  dataCotacao: "",
  numeroCotacao: "",
  valorNota: "",
  observacoes: "",
  chaveAcessoNFe: "",
  origemDados: "MANUAL",
});

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("pt-BR");
};

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  return `R$ ${Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const extractApiErrorMessage = (err, fallback) =>
  err?.response?.data?.error || err?.response?.data?.message || fallback;

export function PedidosNotasFiscais() {
  const didInitRef = useRef(false);
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formData, setFormData] = useState(emptyForm());
  const [filtros, setFiltros] = useState({
    clienteNome: "",
    numeroPedido: "",
    dataInicio: "",
    dataFim: "",
  });

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerNotas, setPickerNotas] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState("");
  const [pickerPage, setPickerPage] = useState(1);
  const [pickerBusca, setPickerBusca] = useState("");
  const [abaAtiva, setAbaAtiva] = useState("cadastro");
  const [buscandoFrete, setBuscandoFrete] = useState(false);
  const [mostrarPendentes, setMostrarPendentes] = useState(false);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    carregarRegistros();
  }, []);

  const carregarRegistros = async (filtrosAtuais = filtros) => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (filtrosAtuais.clienteNome) params.clienteNome = filtrosAtuais.clienteNome;
      if (filtrosAtuais.numeroPedido) params.numeroPedido = filtrosAtuais.numeroPedido;
      if (filtrosAtuais.dataInicio) params.dataInicio = filtrosAtuais.dataInicio;
      if (filtrosAtuais.dataFim) params.dataFim = filtrosAtuais.dataFim;

      const response = await api.get("/pedidos-notas-fiscais", { params });
      setRegistros(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Erro ao carregar pedidos/notas fiscais:", err);
      setError(extractApiErrorMessage(err, "Erro ao carregar registros."));
    } finally {
      setLoading(false);
    }
  };

  const handleFiltroSubmit = async (event) => {
    event.preventDefault();
    await carregarRegistros(filtros);
  };

  const handleLimparFiltros = async () => {
    const limpos = { clienteNome: "", numeroPedido: "", dataInicio: "", dataFim: "" };
    setFiltros(limpos);
    await carregarRegistros(limpos);
  };

  const handleEditar = (registro) => {
    setFormData({
      id: registro.id,
      clienteNome: registro.clienteNome || "",
      numeroPedido: registro.numeroPedido || "",
      dataPedido: registro.dataPedido || "",
      numeroNota: registro.numeroNota || "",
      dataNota: registro.dataNota || "",
      tipoFrete: registro.tipoFrete || "",
      transportadora: registro.transportadora || "",
      numeroColeta: registro.numeroColeta || "",
      temNumeroColeta: !!registro.numeroColeta,
      teveCotacao: !!registro.teveCotacao,
      dataCotacao: registro.dataCotacao || "",
      numeroCotacao: registro.numeroCotacao || "",
      valorNota: registro.valorNota ?? "",
      observacoes: registro.observacoes || "",
      chaveAcessoNFe: registro.chaveAcessoNFe || "",
      origemDados: registro.origemDados || "MANUAL",
    });
    setAbaAtiva("cadastro");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelarEdicao = () => setFormData(emptyForm());

  const abrirPickerNFeMail = async (clienteNomeInicial) => {
    setPickerOpen(true);
    setPickerBusca(
      typeof clienteNomeInicial === "string"
        ? clienteNomeInicial
        : formData.clienteNome || "",
    );
    setPickerNotas([]);
    setPickerPage(1);
    await carregarPickerNFeMail(1, true);
  };

  const carregarPickerNFeMail = async (page, substituir) => {
    try {
      setPickerLoading(true);
      setPickerError("");
      const response = await api.get("/pedidos-notas-fiscais/nfemail/notas", {
        params: { page, limit: 50 },
      });
      const encontradas = Array.isArray(response.data?.notas)
        ? response.data.notas
        : [];
      setPickerNotas((prev) => (substituir ? encontradas : [...prev, ...encontradas]));
      setPickerPage(page);
    } catch (err) {
      console.error("Erro ao buscar notas na NFeMail:", err);
      setPickerError(extractApiErrorMessage(err, "Erro ao buscar notas na NFeMail."));
    } finally {
      setPickerLoading(false);
    }
  };

  const usarNotaNFeMail = async (nota) => {
    setFormData((prev) => ({
      ...prev,
      clienteNome: prev.clienteNome || nota.clienteNome || "",
      numeroNota: nota.numeroNota || prev.numeroNota,
      dataNota: nota.dataNota || prev.dataNota,
      valorNota: nota.valorNota ?? prev.valorNota,
      chaveAcessoNFe: nota.chaveAcessoNFe || prev.chaveAcessoNFe,
      origemDados: "NFEMAIL",
    }));
    setPickerOpen(false);
    setSuccess(
      "Dados da nota aplicados ao formulário. Buscando CIF/FOB e transportadora...",
    );

    if (!nota.chaveAcessoNFe) return;

    try {
      setBuscandoFrete(true);
      const response = await api.get("/pedidos-notas-fiscais/nfemail/detalhe-frete", {
        params: { chave: nota.chaveAcessoNFe },
      });
      const { tipoFrete, transportadora } = response.data || {};
      setFormData((prev) => ({
        ...prev,
        tipoFrete: tipoFrete || prev.tipoFrete,
        transportadora: transportadora || prev.transportadora,
      }));
      setSuccess(
        tipoFrete || transportadora
          ? "Dados da nota aplicados, incluindo CIF/FOB e transportadora. Confira e clique em Salvar/Registrar."
          : "Dados da nota aplicados. A NFeMail não retornou CIF/FOB nem transportadora para essa nota — preencha manualmente se necessário.",
      );
    } catch (err) {
      console.error("Erro ao buscar frete/transportadora na NFeMail:", err);
      setSuccess(
        "Dados da nota aplicados. Não consegui buscar CIF/FOB e transportadora automaticamente — preencha manualmente se necessário.",
      );
    } finally {
      setBuscandoFrete(false);
    }
  };

  const registrosExibidos = mostrarPendentes
    ? registros.filter((r) => !r.numeroColeta)
    : registros;

  const pickerNotasFiltradas = pickerBusca.trim()
    ? pickerNotas.filter((nota) =>
        (nota.clienteNome || "")
          .toLowerCase()
          .includes(pickerBusca.trim().toLowerCase()),
      )
    : pickerNotas;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.clienteNome.trim() || !formData.numeroPedido.trim()) {
      setError("Cliente e número do pedido são obrigatórios.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        clienteNome: formData.clienteNome.trim(),
        numeroPedido: formData.numeroPedido.trim(),
        dataPedido: formData.dataPedido || null,
        numeroNota: formData.numeroNota.trim() || null,
        dataNota: formData.dataNota || null,
        tipoFrete: formData.tipoFrete || null,
        transportadora: formData.transportadora.trim() || null,
        numeroColeta:
          formData.temNumeroColeta && formData.numeroColeta.trim()
            ? formData.numeroColeta.trim()
            : null,
        teveCotacao: formData.teveCotacao,
        dataCotacao: formData.teveCotacao ? formData.dataCotacao || null : null,
        numeroCotacao: formData.teveCotacao
          ? formData.numeroCotacao.trim() || null
          : null,
        valorNota: formData.valorNota !== "" ? Number(formData.valorNota) : null,
        observacoes: formData.observacoes.trim() || null,
        chaveAcessoNFe: formData.chaveAcessoNFe || null,
        origemDados: formData.origemDados || "MANUAL",
      };

      if (formData.id) {
        await api.put(`/pedidos-notas-fiscais/${formData.id}`, payload);
        setSuccess("Registro atualizado com sucesso.");
      } else {
        await api.post("/pedidos-notas-fiscais", payload);
        setSuccess("Pedido/nota fiscal registrado com sucesso.");
      }

      setFormData(emptyForm());
      await carregarRegistros();
    } catch (err) {
      console.error("Erro ao salvar pedido/nota fiscal:", err);
      setError(extractApiErrorMessage(err, "Erro ao salvar registro."));
    } finally {
      setSaving(false);
    }
  };

  const excluirRegistro = async (registro) => {
    const confirmou = window.confirm(
      `Excluir o pedido ${registro.numeroPedido} de ${registro.clienteNome}?`,
    );
    if (!confirmou) return;

    try {
      setDeletingId(registro.id);
      setError("");
      await api.delete(`/pedidos-notas-fiscais/${registro.id}`);
      setSuccess("Registro excluído com sucesso.");
      await carregarRegistros();
    } catch (err) {
      console.error("Erro ao excluir pedido/nota fiscal:", err);
      setError(extractApiErrorMessage(err, "Erro ao excluir registro."));
    } finally {
      setDeletingId(null);
    }
  };

  const sincronizarNFeMail = async (numeroPedido) => {
    try {
      setSincronizando(true);
      setError("");
      setSuccess("");
      const response = await api.post("/pedidos-notas-fiscais/sincronizar-nfemail", {
        numeroPedido: numeroPedido || undefined,
      });
      const {
        atualizados = 0,
        criados = 0,
        semNumeroPedido = 0,
        notasEncontradas = 0,
      } = response.data || {};
      const semPedidoTexto =
        semNumeroPedido > 0
          ? ` ${semNumeroPedido} nota(s) sem número de pedido na NFeMail (não foi possível vincular automaticamente).`
          : "";
      setSuccess(
        `Sincronização concluída: ${notasEncontradas} nota(s) encontrada(s) na NFeMail, ${atualizados} atualizada(s), ${criados} criada(s).${semPedidoTexto}`,
      );
      await carregarRegistros();
    } catch (err) {
      console.error("Erro ao sincronizar com a NFeMail:", err);
      setError(extractApiErrorMessage(err, "Erro ao sincronizar com a NFeMail."));
    } finally {
      setSincronizando(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="📑 Pedidos e Notas Fiscais"
          subtitle="Controle de pedidos, notas fiscais e coletas do time comercial"
          icon="📑"
        />

        {(error || success) && (
          <div className="mb-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
                <p className="text-red-700 text-sm">⚠️ {error}</p>
              </div>
            )}
            {success && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-700 text-sm">✅ {success}</p>
              </div>
            )}
          </div>
        )}

        {abaAtiva === "cadastro" && (
          <button
            type="button"
            className="btn-secondary mb-6"
            onClick={() => setAbaAtiva("historico")}
          >
            📜 Ver Histórico de Pedidos e Notas Fiscais
          </button>
        )}

        {abaAtiva === "historico" && (
          <button
            type="button"
            className="btn-primary w-full mb-6 py-4 text-lg"
            onClick={() => setAbaAtiva("cadastro")}
          >
            ⬅️ Voltar para o Registro de Novas Notas
          </button>
        )}

        {abaAtiva === "cadastro" && (
        <div className="grid grid-cols-1 gap-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {formData.id ? "Editar Registro" : "Novo Pedido / Nota Fiscal"}
              </h2>
              {formData.id && (
                <button
                  type="button"
                  className="text-sm text-gray-500 hover:text-gray-700"
                  onClick={handleCancelarEdicao}
                >
                  Cancelar edição
                </button>
              )}
            </div>

            <button
              type="button"
              className="btn-secondary mb-4 w-full sm:w-auto"
              onClick={() => abrirPickerNFeMail()}
            >
              🔎 Buscar nota na NFeMail
            </button>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    👤 Cliente *
                  </label>
                  <input
                    type="text"
                    value={formData.clienteNome}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, clienteNome: e.target.value }))
                    }
                    className="input-field w-full"
                    placeholder="Nome do cliente"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🧾 Número do pedido *
                  </label>
                  <input
                    type="text"
                    value={formData.numeroPedido}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, numeroPedido: e.target.value }))
                    }
                    className="input-field w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📅 Data do pedido
                  </label>
                  <input
                    type="date"
                    value={formData.dataPedido}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, dataPedido: e.target.value }))
                    }
                    className="input-field w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📄 Número da nota
                  </label>
                  <input
                    type="text"
                    value={formData.numeroNota}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, numeroNota: e.target.value }))
                    }
                    className="input-field w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📅 Data da nota
                  </label>
                  <input
                    type="date"
                    value={formData.dataNota}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, dataNota: e.target.value }))
                    }
                    className="input-field w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🚚 CIF ou FOB
                    {buscandoFrete && (
                      <span className="ml-2 text-xs font-normal text-gray-400">
                        (buscando na NFeMail...)
                      </span>
                    )}
                  </label>
                  <select
                    value={formData.tipoFrete}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, tipoFrete: e.target.value }))
                    }
                    className="input-field w-full"
                    disabled={buscandoFrete}
                  >
                    <option value="">Não informado</option>
                    {FRETE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🚛 Transportadora
                  </label>
                  <input
                    type="text"
                    value={formData.transportadora}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, transportadora: e.target.value }))
                    }
                    className="input-field w-full"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📦 Já tem número da coleta?
                  </label>
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                        formData.temNumeroColeta
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-gray-700 border-gray-300"
                      }`}
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, temNumeroColeta: true }))
                      }
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                        !formData.temNumeroColeta
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-gray-700 border-gray-300"
                      }`}
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          temNumeroColeta: false,
                          numeroColeta: "",
                        }))
                      }
                    >
                      Ainda não
                    </button>
                  </div>
                  {formData.temNumeroColeta ? (
                    <input
                      type="text"
                      value={formData.numeroColeta}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, numeroColeta: e.target.value }))
                      }
                      className="input-field w-full"
                      placeholder="Número da coleta"
                    />
                  ) : (
                    <p className="text-xs text-gray-500">
                      Sem número de coleta o registro fica em "Pendentes" no
                      histórico até você voltar aqui e preencher.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    💰 Valor da nota
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.valorNota}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, valorNota: e.target.value }))
                    }
                    className="input-field w-full"
                    placeholder="0,00"
                  />
                </div>

                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={formData.teveCotacao}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          teveCotacao: e.target.checked,
                        }))
                      }
                    />
                    Teve cotação?
                  </label>
                </div>

                {formData.teveCotacao && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        🔢 Número da cotação
                      </label>
                      <input
                        type="text"
                        value={formData.numeroCotacao}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            numeroCotacao: e.target.value,
                          }))
                        }
                        className="input-field w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        📅 Data da cotação
                      </label>
                      <input
                        type="date"
                        value={formData.dataCotacao}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, dataCotacao: e.target.value }))
                        }
                        className="input-field w-full"
                      />
                    </div>
                  </>
                )}
              </div>

              {formData.chaveAcessoNFe && (
                <p className="text-xs text-gray-500 break-all">
                  🔗 Vinculado à NFeMail (chave de acesso: {formData.chaveAcessoNFe})
                </p>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📝 Observações
                </label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, observacoes: e.target.value }))
                  }
                  className="input-field w-full min-h-22.5"
                />
              </div>

              <button type="submit" className="btn-primary" disabled={saving}>
                {saving
                  ? "⏳ Salvando..."
                  : formData.id
                    ? "💾 Salvar alterações"
                    : "💾 Registrar"}
              </button>
            </form>
          </div>
        </div>
        )}

        {abaAtiva === "historico" && (
        <>
        <div className="grid grid-cols-1 gap-6">
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Filtros</h2>

            <form onSubmit={handleFiltroSubmit} className="space-y-4 mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    👤 Cliente
                  </label>
                  <input
                    type="text"
                    value={filtros.clienteNome}
                    onChange={(e) =>
                      setFiltros((prev) => ({ ...prev, clienteNome: e.target.value }))
                    }
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🧾 Pedido
                  </label>
                  <input
                    type="text"
                    value={filtros.numeroPedido}
                    onChange={(e) =>
                      setFiltros((prev) => ({ ...prev, numeroPedido: e.target.value }))
                    }
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📅 Data inicial
                  </label>
                  <input
                    type="date"
                    value={filtros.dataInicio}
                    onChange={(e) =>
                      setFiltros((prev) => ({ ...prev, dataInicio: e.target.value }))
                    }
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📅 Data final
                  </label>
                  <input
                    type="date"
                    value={filtros.dataFim}
                    onChange={(e) =>
                      setFiltros((prev) => ({ ...prev, dataFim: e.target.value }))
                    }
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? "⏳ Filtrando..." : "🔎 Filtrar"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleLimparFiltros}
                  disabled={loading}
                >
                  Limpar
                </button>
              </div>
            </form>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">
                Sincronização automática com NFeMail
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                Tenta casar notas da NFeMail com pedidos já cadastrados pelo
                número do pedido. Só funciona para notas em que o campo
                "número do pedido" foi preenchido na hora de emitir a nota na
                NFeMail — use o botão "🔎 Buscar nota na NFeMail" no
                formulário para vincular manualmente as demais.
              </p>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => sincronizarNFeMail()}
                disabled={sincronizando}
              >
                {sincronizando ? "⏳ Sincronizando..." : "🔄 Sincronizar com NFeMail"}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
              <div className="p-3 rounded-lg border border-gray-200 bg-white">
                <p className="text-xs text-gray-500">Registros</p>
                <p className="text-xl font-bold text-gray-900">{registros.length}</p>
              </div>
              <div className="p-3 rounded-lg border border-gray-200 bg-white">
                <p className="text-xs text-gray-500">Com cotação</p>
                <p className="text-xl font-bold text-blue-600">
                  {registros.filter((r) => r.teveCotacao).length}
                </p>
              </div>
              <div className="p-3 rounded-lg border border-gray-200 bg-white">
                <p className="text-xs text-gray-500">Pendentes de coleta</p>
                <p className="text-xl font-bold text-amber-600">
                  {registros.filter((r) => !r.numeroColeta).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              {mostrarPendentes
                ? "📋 Pendentes de Coleta"
                : "Histórico de Pedidos e Notas Fiscais"}
            </h2>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setMostrarPendentes((prev) => !prev)}
            >
              {mostrarPendentes
                ? "📜 Ver Histórico Completo"
                : `📋 Pendentes (${registros.filter((r) => !r.numeroColeta).length})`}
            </button>
          </div>

          {mostrarPendentes && (
            <p className="text-xs text-gray-500 mb-4">
              Registros sem número de coleta preenchido. Clique em "Editar"
              para completar a coleta — depois de salvar, o registro volta
              para o histórico normal.
            </p>
          )}

          {loading ? (
            <div className="py-8 text-center text-gray-600">Carregando registros...</div>
          ) : registrosExibidos.length === 0 ? (
            <div className="py-8 text-center text-gray-600">
              {mostrarPendentes
                ? "Nenhum pedido pendente de coleta. 🎉"
                : "Nenhum registro encontrado para os filtros selecionados."}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Pedido</th>
                    <th>Data Pedido</th>
                    <th>Nota</th>
                    <th>Data Nota</th>
                    <th>Frete</th>
                    <th>Transportadora</th>
                    <th>Coleta</th>
                    <th>Cotação</th>
                    <th>Valor</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {registrosExibidos.map((item) => (
                    <tr key={item.id}>
                      <td>{item.clienteNome}</td>
                      <td>{item.numeroPedido}</td>
                      <td>{formatDate(item.dataPedido)}</td>
                      <td>{item.numeroNota || "-"}</td>
                      <td>{formatDate(item.dataNota)}</td>
                      <td>{item.tipoFrete || "-"}</td>
                      <td>{item.transportadora || "-"}</td>
                      <td>
                        {item.numeroColeta || (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                            Pendente
                          </span>
                        )}
                      </td>
                      <td>
                        {item.teveCotacao
                          ? `Sim${item.numeroCotacao ? ` (${item.numeroCotacao})` : ""} - ${formatDate(item.dataCotacao)}`
                          : "Não"}
                      </td>
                      <td>{formatCurrency(item.valorNota)}</td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="px-3 py-1 bg-primary text-white rounded hover:opacity-90"
                            onClick={() => handleEditar(item)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                            onClick={async () => {
                              handleEditar(item);
                              await abrirPickerNFeMail(item.clienteNome || "");
                            }}
                          >
                            🔎 Vincular NFeMail
                          </button>
                          <button
                            type="button"
                            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-60"
                            onClick={() => excluirRegistro(item)}
                            disabled={deletingId === item.id}
                          >
                            {deletingId === item.id ? "Excluindo..." : "Excluir"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>
        )}
      </div>

      <Modal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="🔎 Buscar nota na NFeMail"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Notas mais recentes emitidas na NFeMail. Filtre pelo nome do
            cliente e clique na nota desejada para preencher o formulário
            (número, data, valor, chave de acesso e, em seguida, CIF/FOB e
            transportadora).
          </p>

          <input
            type="text"
            value={pickerBusca}
            onChange={(e) => setPickerBusca(e.target.value)}
            className="input-field w-full"
            placeholder="Filtrar por nome do cliente..."
          />

          {pickerError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">⚠️ {pickerError}</p>
            </div>
          )}

          <div className="max-h-96 overflow-y-auto rounded-xl border border-gray-200">
            <table className="table-modern">
              <thead>
                <tr>
                  <th>Nota</th>
                  <th>Cliente</th>
                  <th>Data</th>
                  <th>Valor</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pickerNotasFiltradas.map((nota, index) => (
                  <tr
                    key={`${nota.chaveAcessoNFe || nota.numeroNota}-${index}`}
                    className="cursor-pointer hover:bg-primary/10 transition-colors"
                    onClick={() => usarNotaNFeMail(nota)}
                  >
                    <td>{nota.numeroNota || "-"}</td>
                    <td>{nota.clienteNome || "-"}</td>
                    <td>{formatDate(nota.dataNota)}</td>
                    <td>{formatCurrency(nota.valorNota)}</td>
                    <td>
                      <button
                        type="button"
                        className="px-3 py-1 bg-primary text-white rounded hover:opacity-90 whitespace-nowrap"
                        onClick={(e) => {
                          e.stopPropagation();
                          usarNotaNFeMail(nota);
                        }}
                      >
                        Usar esta nota
                      </button>
                    </td>
                  </tr>
                ))}
                {!pickerLoading && pickerNotasFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-gray-500">
                      Nenhuma nota encontrada{pickerBusca ? " para esse filtro" : ""}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => carregarPickerNFeMail(pickerPage + 1, false)}
              disabled={pickerLoading}
            >
              {pickerLoading ? "⏳ Carregando..." : "Carregar mais notas"}
            </button>
          </div>
        </div>
      </Modal>

      <Footer />
    </div>
  );
}
