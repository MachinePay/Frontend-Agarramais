import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import {
  PageHeader,
  StatsGrid,
  AlertBox,
  ConfirmDialog,
} from "../components/UIComponents";
import RegistrarDinheiro from "../components/RegistrarDinheiro";
import LancarGastoVariavel from "../components/LancarGastoVariavel";
import { PageLoader } from "../components/Loading";
import { useAuth } from "../contexts/AuthContext";
import {
  salvarFotoUltimaMovimentacao,
  obterFotoUltimaMovimentacao,
  limparFotoUltimaMovimentacao,
} from "../services/fotoUltimaMovimentacaoDb";

const CHAVE_ULTIMA_MENSAGEM_WHATSAPP = "ultimaMensagemMovimentacaoWhatsapp";

// Salto grande demais no contador de um registro pro outro costuma ser erro
// de leitura/digitação (ex: trocar os dois contadores, ou digitar um dígito
// a mais). Acima desses limites, exige confirmação explícita do operador
// antes de deixar registrar.
const LIMITE_DIFERENCA_CONTADOR_IN = 300;
const LIMITE_DIFERENCA_CONTADOR_OUT = 40;

// Em celular (onde os funcionários realmente usam isso, no chão de loja),
// abrir uma aba em branco e só depois redirecioná-la pra wa.me é frágil: em
// vários navegadores/WebViews Android essa aba fica presa em "about:blank"
// e nunca navega, deixando quem tá coletando sem conseguir mandar a
// mensagem. Por isso, em celular, nem abrimos aba nova — navegamos a
// própria aba pra wa.me (nunca é bloqueado por popup blocker, já que não é
// popup). Em desktop mantemos o truque de abrir em branco: Safari/iOS só
// permite abrir uma nova aba (ou usar navigator.share) de forma síncrona,
// dentro do mesmo gesto de clique, e como o envio ao WhatsApp só acontece
// depois de um `await` (chamada à API) essa permissão já expirou quando
// chegamos lá.
const ehDispositivoMovel = () =>
  /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");

function abrirJanelaWhatsapp() {
  if (ehDispositivoMovel()) return null;
  try {
    return window.open("", "_blank");
  } catch {
    return null;
  }
}

// Navega pra URL do WhatsApp usando a janela pré-aberta (desktop) ou a
// própria aba (celular). Ver abrirJanelaWhatsapp() acima pro porquê.
function navegarParaWhatsapp(janelaPreAberta, url) {
  if (ehDispositivoMovel()) {
    if (janelaPreAberta && !janelaPreAberta.closed) janelaPreAberta.close();
    window.location.href = url;
    return;
  }

  if (janelaPreAberta && !janelaPreAberta.closed) {
    janelaPreAberta.location.href = url;
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

// Nome da origem dos pagamentos usada na sugestão de Total Pré
// (/movimentacoes/sugestao-total-pre devolve "machinePay", "compactPay" ou
// "ambos" quando a máquina tem os dois IDs).
const nomeFontePagamento = (fonte) =>
  fonte === "ambos"
    ? "Machine Pay + CompactPay"
    : fonte === "compactPay"
      ? "CompactPay"
      : "Machine Pay";

// Data no formato do <input type="datetime-local"> (YYYY-MM-DDTHH:mm, hora local).
const paraInputDataHora = (valor) => {
  const data = valor ? new Date(valor) : new Date();
  if (Number.isNaN(data.getTime())) return "";
  const local = new Date(data.getTime() - data.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

// Uma máquina conta como "concluída" na lista da loja se teve movimentação
// nessa janela (mesmo critério do antigo aviso de máquinas que faltam).
const HORAS_MAQUINA_CONCLUIDA = 12;

const FORMULARIO_VAZIO = {
  dataColeta: "",
  maquina_id: "",
  produto_id: "",
  quantidadeAtualMaquina: "",
  quantidadeAdicionada: "",
  fichas: "",
  contadorIn: "",
  contadorOut: "",
  observacao: "",
  retiradaEstoque: false,
  retiradaProduto: 0,
  retiradaProdutoDevolverEstoque: false,
  ignoreInOut: false,
};

// Rascunhos: o que foi digitado em cada máquina fica salvo no aparelho, pra
// dar pra contar as fichas de todas, depois as pelúcias de todas, na ordem
// que quiser, e só registrar quando cada uma estiver completa. Ficam no
// localStorage porque no celular o envio pro WhatsApp sai da página.
const CHAVE_RASCUNHOS = "rascunhosMovimentacao";
// Conta a partir da última alteração na máquina.
const VALIDADE_RASCUNHO_MS = 90 * 60 * 1000;
const CAMPOS_RASCUNHO = [
  "produto_id",
  "quantidadeAtualMaquina",
  "quantidadeAdicionada",
  "fichas",
  "contadorIn",
  "contadorOut",
  "observacao",
  "retiradaEstoque",
  "retiradaProduto",
  "retiradaProdutoDevolverEstoque",
  "ignoreInOut",
];

const campoPreenchido = (valor) =>
  valor !== "" && valor !== null && valor !== undefined;

const lerRascunhos = () => {
  try {
    const salvos = JSON.parse(localStorage.getItem(CHAVE_RASCUNHOS) || "{}");
    const agora = Date.now();
    return Object.fromEntries(
      Object.entries(salvos).filter(
        ([, r]) => r && agora - r.atualizadoEm < VALIDADE_RASCUNHO_MS,
      ),
    );
  } catch {
    return {};
  }
};

const gravarRascunhos = (rascunhos) => {
  try {
    localStorage.setItem(CHAVE_RASCUNHOS, JSON.stringify(rascunhos));
  } catch {
    // Sem localStorage (aba anônima etc.) o rascunho vale só até recarregar.
  }
};

// O produto vem sugerido sozinho ao abrir a máquina, então não conta pra
// dizer que a pessoa começou a preencher.
const rascunhoTemDados = (campos) =>
  CAMPOS_RASCUNHO.some(
    (c) =>
      c !== "produto_id" &&
      campoPreenchido(campos[c]) &&
      campos[c] !== false &&
      campos[c] !== 0,
  );

const progressoRascunho = (campos = {}) => {
  const itens = [
    { label: "Produto", ok: !!campos.produto_id },
    ...(campos.ignoreInOut
      ? []
      : [
          { label: "Contador IN", ok: campoPreenchido(campos.contadorIn) },
          { label: "Contador OUT", ok: campoPreenchido(campos.contadorOut) },
        ]),
    {
      label: "Quantidade atual",
      ok: campoPreenchido(campos.quantidadeAtualMaquina),
    },
    { label: "Fichas", ok: campoPreenchido(campos.fichas) },
  ];
  const feitos = itens.filter((i) => i.ok).length;
  return {
    feitos,
    total: itens.length,
    faltando: itens.filter((i) => !i.ok).map((i) => i.label),
  };
};

function BarraProgresso({ feitos, total, className = "" }) {
  const completo = feitos === total;
  return (
    <div className={`h-1.5 rounded-full bg-slate-200 overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full transition-all ${completo ? "bg-emerald-500" : "bg-amber-400"}`}
        style={{ width: `${total ? (feitos / total) * 100 : 0}%` }}
      />
    </div>
  );
}

// Status das máquinas de uma loja: quando cada uma foi concluída (última
// movimentação na janela acima) e quantas manutenções pendentes tem.
async function buscarStatusLoja(lojaId) {
  const desde = new Date(
    Date.now() - HORAS_MAQUINA_CONCLUIDA * 60 * 60 * 1000,
  ).toISOString();
  const [movRes, manutRes] = await Promise.allSettled([
    api.get("/movimentacoes", {
      params: { lojaId, dataInicio: desde, limite: 500 },
    }),
    api.get("/manutencoes", { params: { lojaId, status: "PENDENTE" } }),
  ]);

  const concluidas = {};
  if (movRes.status === "fulfilled") {
    for (const mov of movRes.value.data || []) {
      const data = new Date(mov.dataColeta || mov.createdAt);
      if (!concluidas[mov.maquinaId] || data > concluidas[mov.maquinaId]) {
        concluidas[mov.maquinaId] = data;
      }
    }
  }

  const manutencoes = {};
  if (manutRes.status === "fulfilled" && Array.isArray(manutRes.value.data)) {
    for (const manut of manutRes.value.data) {
      if (!manut.maquinaId || manut.status === "RESOLVIDA") continue;
      manutencoes[manut.maquinaId] = (manutencoes[manut.maquinaId] || 0) + 1;
    }
  }

  return { concluidas, manutencoes };
}

function NumeroMaquina({ label, value, tone = "slate" }) {
  const tones = {
    slate: "text-slate-800",
    amber: "text-amber-600",
    muted: "text-slate-400",
  };
  return (
    <div className="w-12 sm:w-16 text-center shrink-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className={`text-base sm:text-lg font-bold tabular-nums ${tones[tone]}`}>
        {value}
      </p>
    </div>
  );
}

export function Movimentacoes() {
  const navigate = useNavigate();
  const location = useLocation();
  const [modalRegistrarDinheiro, setModalRegistrarDinheiro] = useState(false);
  const [modalGastoVariavel, setModalGastoVariavel] = useState(false);
  const { usuario } = useAuth();

  // --- ESTADOS ---
  const [movimentacoes, setMovimentacoes] = useState([]);

  // Dados Gerais
  const [maquinas, setMaquinas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);

  // UI States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mostrarMaisOpcoes, setMostrarMaisOpcoes] = useState(false);
  const [statusLoja, setStatusLoja] = useState({
    concluidas: {},
    manutencoes: {},
  });
  const [carregandoStatusLoja, setCarregandoStatusLoja] = useState(false);
  const [rascunhos, setRascunhos] = useState(lerRascunhos);
  // Foto dos contadores de cada máquina com rascunho (só em memória: File
  // não vai pro localStorage).
  const fotosRascunhoRef = useRef({});
  const [salvandoMovimentacao, setSalvandoMovimentacao] = useState(false);
  const [mostrarConfirmacaoMovimentacao, setMostrarConfirmacaoMovimentacao] =
    useState(false);
  const [fotoContadores, setFotoContadores] = useState(null);
  const [fotoContadoresPreview, setFotoContadoresPreview] = useState("");
  const [lendoFotoContadores, setLendoFotoContadores] = useState(false);
  const [resultadoFotoContadores, setResultadoFotoContadores] = useState("");
  const movimentacaoEmEnvioRef = useRef(false);
  const [movimentacaoAssistentePendente, setMovimentacaoAssistentePendente] =
    useState(null);
  const [alertaOrigemId, setAlertaOrigemId] = useState(null);
  const [naoVaiRegistrar, setNaoVaiRegistrar] = useState(false);
  const [mostrarObsAlerta, setMostrarObsAlerta] = useState(false);
  const [obsAlerta, setObsAlerta] = useState("");
  const [enviandoAlerta, setEnviandoAlerta] = useState(false);
  const [temMensagemSalva, setTemMensagemSalva] = useState(
    () => !!localStorage.getItem(CHAVE_ULTIMA_MENSAGEM_WHATSAPP),
  );

  // Filtros Movimentações
  const [filtroLojaForm, setFiltroLojaForm] = useState("");

  // Formulário Nova Movimentação
  // dataColeta vazio = horário do lançamento (padrão). Só admin preenche,
  // para lançar uma movimentação que ficou para trás.
  const [formData, setFormData] = useState(FORMULARIO_VAZIO);

  // Estados auxiliares
  const [estoqueAnterior, setEstoqueAnterior] = useState(0);
  const [saidasCompactPay, setSaidasCompactPay] = useState(null);
  const [alertaDivergencia, setAlertaDivergencia] = useState(null);
  // Sugestão de Total Pré via Machine Pay (máquinas com desconto automático
  // ativado), ver useEffect abaixo. modo "auto" trava o campo com o valor
  // calculado; "forcar_manual" (a cada 15 dias sem conferência manual)
  // libera o campo pro operador digitar, mas mantém o valor calculado pra
  // comparação/alerta de divergência.
  const [sugestaoTotalPreMachinePay, setSugestaoTotalPreMachinePay] =
    useState(null);
  const [carregandoSugestaoMachinePay, setCarregandoSugestaoMachinePay] =
    useState(false);
  const [
    confirmacaoDivergenciaMachinePay,
    setConfirmacaoDivergenciaMachinePay,
  ] = useState(false);

  // Últimos contadores registrados da máquina selecionada, para detectar
  // salto suspeito no IN/OUT (ver LIMITE_DIFERENCA_CONTADOR_IN/OUT acima).
  const [ultimoContadorMaquina, setUltimoContadorMaquina] = useState({
    contadorIn: null,
    contadorOut: null,
  });
  const [confirmacaoContadorIn, setConfirmacaoContadorIn] = useState(false);
  const [confirmacaoContadorOut, setConfirmacaoContadorOut] = useState(false);

  // Data escolhida pelo admin em ISO (null = lançamento no horário atual).
  const dataColetaIso = formData.dataColeta
    ? new Date(formData.dataColeta).toISOString()
    : null;

  // --- EFEITOS ---
  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    return () => {
      if (fotoContadoresPreview) {
        URL.revokeObjectURL(fotoContadoresPreview);
      }
    };
  }, [fotoContadoresPreview]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const state = location.state || {};
    const deveAbrirFormulario =
      state.abrirFormulario === true ||
      state.autoAbrirMovimentacao === true ||
      params.get("abrirFormulario") === "true";
    const modo = state.modo || params.get("modo");

    if (!deveAbrirFormulario || modo !== "nova_movimentacao") {
      return;
    }

    setMovimentacaoAssistentePendente({
      lojaId: state.lojaId ?? params.get("lojaId") ?? "",
      maquinaId: state.maquinaId ?? params.get("maquinaId") ?? "",
      contadorIn: state.contadorIn ?? params.get("contadorIn") ?? "",
      contadorOut: state.contadorOut ?? params.get("contadorOut") ?? "",
      produtoId: state.produtoId ?? params.get("produtoId") ?? "",
      quantidadeAtualMaquina:
        state.quantidadeAtualMaquina ??
        params.get("quantidadeAtualMaquina") ??
        "",
      quantidadeAdicionada:
        state.quantidadeAdicionada ?? params.get("quantidadeAdicionada") ?? "",
      fichas: state.fichas ?? params.get("fichas") ?? "",
      observacao: state.observacao ?? params.get("observacao") ?? "",
      alertaId: state.alertaId ?? params.get("alertaId") ?? null,
      dataColeta: state.dataColeta ?? params.get("dataColeta") ?? "",
    });
  }, [location.search, location.state]);

  useEffect(() => {
    if (!movimentacaoAssistentePendente || loading) {
      return;
    }

    const lojaId = movimentacaoAssistentePendente.lojaId
      ? String(movimentacaoAssistentePendente.lojaId)
      : "";
    const maquinaId = movimentacaoAssistentePendente.maquinaId
      ? String(movimentacaoAssistentePendente.maquinaId)
      : "";
    const contadorIn =
      movimentacaoAssistentePendente.contadorIn !== undefined &&
      movimentacaoAssistentePendente.contadorIn !== null
        ? String(movimentacaoAssistentePendente.contadorIn)
        : "";
    const contadorOut =
      movimentacaoAssistentePendente.contadorOut !== undefined &&
      movimentacaoAssistentePendente.contadorOut !== null
        ? String(movimentacaoAssistentePendente.contadorOut)
        : "";
    const campoOuVazio = (valor) =>
      valor !== undefined && valor !== null ? String(valor) : "";

    // A máquina só aparece aberta dentro da lista da loja dela.
    setFiltroLojaForm(
      lojaId ||
        String(
          maquinas.find((m) => String(m.id) === maquinaId)?.lojaId ?? "",
        ),
    );
    if (movimentacaoAssistentePendente.observacao) setMostrarMaisOpcoes(true);
    setFormData((prev) => ({
      ...prev,
      maquina_id: maquinaId,
      produto_id: campoOuVazio(movimentacaoAssistentePendente.produtoId),
      contadorIn,
      contadorOut,
      quantidadeAtualMaquina: campoOuVazio(
        movimentacaoAssistentePendente.quantidadeAtualMaquina,
      ),
      quantidadeAdicionada: campoOuVazio(
        movimentacaoAssistentePendente.quantidadeAdicionada,
      ),
      fichas: campoOuVazio(movimentacaoAssistentePendente.fichas),
      observacao: campoOuVazio(movimentacaoAssistentePendente.observacao),
      // Vindo de um alerta da Manutenção, já chega com a data/hora em que
      // a movimentação aconteceu (só admin pode lançar com outra data).
      dataColeta:
        movimentacaoAssistentePendente.dataColeta &&
        usuario?.role === "ADMIN"
          ? paraInputDataHora(movimentacaoAssistentePendente.dataColeta)
          : "",
    }));
    setAlertaOrigemId(movimentacaoAssistentePendente.alertaId || null);
    setMovimentacaoAssistentePendente(null);
  }, [movimentacaoAssistentePendente, loading, usuario?.role, maquinas]);

  useEffect(() => {
    if (!filtroLojaForm) {
      setStatusLoja({ concluidas: {}, manutencoes: {} });
      return;
    }
    let cancelado = false;
    setCarregandoStatusLoja(true);
    buscarStatusLoja(filtroLojaForm)
      .then((status) => {
        if (!cancelado) setStatusLoja(status);
      })
      .finally(() => {
        if (!cancelado) setCarregandoStatusLoja(false);
      });
    return () => {
      cancelado = true;
    };
  }, [filtroLojaForm]);

  useEffect(() => {
    gravarRascunhos(rascunhos);
  }, [rascunhos]);

  // Com a página aberta, rascunho vencido some sem precisar recarregar. O da
  // máquina aberta fica: ele é regravado a cada alteração.
  useEffect(() => {
    const intervalo = setInterval(() => {
      const agora = Date.now();
      setRascunhos((prev) => {
        const validos = Object.fromEntries(
          Object.entries(prev).filter(
            ([id, r]) =>
              id === formData.maquina_id ||
              agora - r.atualizadoEm < VALIDADE_RASCUNHO_MS,
          ),
        );
        return Object.keys(validos).length === Object.keys(prev).length
          ? prev
          : validos;
      });
    }, 60 * 1000);
    return () => clearInterval(intervalo);
  }, [formData.maquina_id]);

  // Cada alteração no formulário atualiza o rascunho da máquina aberta.
  useEffect(() => {
    const maquinaId = formData.maquina_id;
    if (!maquinaId) return;
    const campos = Object.fromEntries(
      CAMPOS_RASCUNHO.map((c) => [c, formData[c]]),
    );
    setRascunhos((prev) => {
      if (!rascunhoTemDados(campos)) {
        if (!prev[maquinaId]) return prev;
        const { [maquinaId]: _removido, ...resto } = prev;
        return resto;
      }
      return { ...prev, [maquinaId]: { ...campos, atualizadoEm: Date.now() } };
    });
  }, [formData]);

  // Ao abrir uma máquina, traz ela pro topo da tela (a que estava aberta
  // antes fecha e mudaria tudo de lugar).
  useEffect(() => {
    if (!formData.maquina_id) return;
    queueMicrotask(() => {
      document
        .getElementById(`maquina-${formData.maquina_id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [formData.maquina_id]);

  // Atualizar estoque anterior quando seleciona máquina
  useEffect(() => {
    if (formData.maquina_id) {
      const maquina = maquinas.find(
        (m) => String(m.id) === String(formData.maquina_id),
      );
      if (maquina && !formData.dataColeta) {
        setEstoqueAnterior(maquina.estoqueAtual || 0);
      }
    }
  }, [formData.maquina_id, formData.dataColeta, maquinas]);

  // Verificar divergência entre contador OUT e total pre informado
  useEffect(() => {
    const verificarDivergencia = async () => {
      // Só verificar se temos máquina selecionada, contador OUT e total pre preenchidos
      if (
        !formData.maquina_id ||
        !formData.contadorOut ||
        !formData.quantidadeAtualMaquina
      ) {
        setAlertaDivergencia(null);
        return;
      }

      const contadorOutAtual = parseInt(formData.contadorOut);
      const totalPreInformado = parseInt(formData.quantidadeAtualMaquina);

      // Validar se são números válidos
      if (isNaN(contadorOutAtual) || isNaN(totalPreInformado)) {
        setAlertaDivergencia(null);
        return;
      }

      try {
        // Buscar última movimentação da máquina (até a data escolhida, se
        // for um lançamento retroativo)
        const response = await api.get("/movimentacoes", {
          params: {
            maquinaId: formData.maquina_id,
            limite: 1,
            dataFim: dataColetaIso || undefined,
          },
        });
        const movimentacoes = response.data;

        if (movimentacoes && movimentacoes.length > 0) {
          const ultimaMov = movimentacoes[0];
          const contadorOutAnterior = ultimaMov.contadorOut || 0;
          const totalPosAnterior = ultimaMov.totalPos || 0;

          // Calcular quantos produtos saíram baseado no contador OUT
          const saidaCalculada = contadorOutAtual - contadorOutAnterior;

          // Calcular qual deveria ser o total pre esperado
          const totalPreEsperado = totalPosAnterior - saidaCalculada;

          // Se houver divergência, mostrar alerta
          const diferenca = Math.abs(totalPreInformado - totalPreEsperado);
          if (diferenca > 0) {
            setAlertaDivergencia({
              totalPreInformado,
              totalPreEsperado,
              diferenca,
              saidaCalculada,
              totalPosAnterior,
              contadorOutAnterior,
              contadorOutAtual,
            });
          } else {
            setAlertaDivergencia(null);
          }
        } else {
          // Não há movimentação anterior, não há como comparar
          setAlertaDivergencia(null);
        }
      } catch (error) {
        console.error("Erro ao verificar divergência:", error);
        setAlertaDivergencia(null);
      }
    };

    verificarDivergencia();
  }, [
    formData.maquina_id,
    formData.contadorOut,
    formData.quantidadeAtualMaquina,
    dataColetaIso,
  ]);

  // Busca o último contador IN/OUT registrado da máquina selecionada, para
  // comparar com o que o operador está digitando agora e detectar salto
  // suspeito (ver LIMITE_DIFERENCA_CONTADOR_IN/OUT).
  useEffect(() => {
    if (!formData.maquina_id) {
      setUltimoContadorMaquina({ contadorIn: null, contadorOut: null });
      return;
    }

    let cancelado = false;

    api
      .get("/movimentacoes", {
        params: {
          maquinaId: formData.maquina_id,
          limite: 1,
          dataFim: dataColetaIso || undefined,
        },
      })
      .then((response) => {
        if (cancelado) return;
        const ultimaMov = response.data?.[0];
        setUltimoContadorMaquina({
          contadorIn: ultimaMov?.contadorIn ?? null,
          contadorOut: ultimaMov?.contadorOut ?? null,
        });
        if (dataColetaIso) setEstoqueAnterior(ultimaMov?.totalPos || 0);
      })
      .catch(() => {
        if (!cancelado) {
          setUltimoContadorMaquina({ contadorIn: null, contadorOut: null });
        }
      });

    return () => {
      cancelado = true;
    };
  }, [formData.maquina_id, dataColetaIso]);

  // Para máquinas com "desconto automático via Machine Pay" ativado, busca
  // quanto já entrou na Machine Pay desde a última coleta e calcula o Total
  // Pré esperado (totalPos anterior menos 1 pulso pra cada
  // valorDescontoMachinePay recebido). Em modo "auto" trava o campo e
  // preenche com o valor calculado; a cada 15 dias sem conferência manual o
  // backend devolve modo "forcar_manual" — aí o campo fica liberado pro
  // operador contar fisicamente, e o valor calculado só serve pra comparar
  // e alertar se o que ele digitou não bater (ver alertaSubmit mais abaixo).
  useEffect(() => {
    setSugestaoTotalPreMachinePay(null);
    setCarregandoSugestaoMachinePay(false);

    // A sugestão conta os pagamentos da última coleta até agora: não serve
    // para uma movimentação lançada com data retroativa.
    if (!formData.maquina_id || formData.dataColeta) return;

    const maquina = maquinas.find(
      (m) => String(m.id) === String(formData.maquina_id),
    );
    if (!maquina?.descontoAutomaticoMachinePay) return;

    let cancelado = false;
    setCarregandoSugestaoMachinePay(true);

    api
      .get(`/movimentacoes/sugestao-total-pre/${formData.maquina_id}`)
      .then((response) => {
        if (cancelado) return;
        const dados = response.data;
        setSugestaoTotalPreMachinePay(dados || null);

        if (dados?.sugestaoDisponivel && dados.modo === "auto") {
          setFormData((prev) =>
            prev.quantidadeAtualMaquina === ""
              ? {
                  ...prev,
                  quantidadeAtualMaquina: String(dados.sugestaoTotalPre),
                }
              : prev,
          );
        }
      })
      .catch(() => {
        if (!cancelado) setSugestaoTotalPreMachinePay(null);
      })
      .finally(() => {
        if (!cancelado) setCarregandoSugestaoMachinePay(false);
      });

    return () => {
      cancelado = true;
    };
  }, [formData.maquina_id, formData.dataColeta, maquinas]);

  // Só admin: prêmios que o sensor de saída da placa CompactPay contou desde
  // a última movimentação (o "Prêmios entregues" do painel CompactPay no
  // período entre movimentações). Funcionário não vê pra não copiar o número.
  useEffect(() => {
    setSaidasCompactPay(null);
    if (
      !formData.maquina_id ||
      formData.dataColeta ||
      usuario?.role !== "ADMIN"
    )
      return;

    const maquina = maquinas.find(
      (m) => String(m.id) === String(formData.maquina_id),
    );
    if (!maquina?.compactPayId || !maquina?.conferirSaidaCompactPay) return;

    let cancelado = false;
    setSaidasCompactPay({ carregando: true });
    api
      .get(`/movimentacoes/saidas-compactpay/${formData.maquina_id}`)
      .then((response) => {
        if (!cancelado) setSaidasCompactPay(response.data || null);
      })
      .catch(() => {
        if (!cancelado) setSaidasCompactPay({ erro: true });
      });

    return () => {
      cancelado = true;
    };
  }, [formData.maquina_id, formData.dataColeta, maquinas, usuario?.role]);

  // Cada vez que o operador muda o valor digitado, a confirmação de
  // "certeza que está correto" anterior deixa de valer.
  useEffect(() => {
    setConfirmacaoContadorIn(false);
  }, [formData.contadorIn, formData.maquina_id]);

  useEffect(() => {
    setConfirmacaoContadorOut(false);
  }, [formData.contadorOut, formData.maquina_id]);

  useEffect(() => {
    setConfirmacaoDivergenciaMachinePay(false);
  }, [formData.quantidadeAtualMaquina, formData.maquina_id]);

  // Sugere produto automaticamente ao escolher máquina, mas permite troca manual
  // Sugere produto via backend ao escolher máquina
  useEffect(() => {
    if (!formData.maquina_id) return;
    if (formData.produto_id) return;
    // Busca produto sugerido do backend
    const fetchProdutoSugerido = async () => {
      try {
        const res = await api.get(
          `/maquinas/${formData.maquina_id}/produto-sugerido`,
        );
        if (
          res.data &&
          res.data.produtoSugerido &&
          res.data.produtoSugerido.id
        ) {
          setFormData((prev) => ({
            ...prev,
            produto_id: res.data.produtoSugerido.id,
          }));
        }
      } catch {
        // Silencia erro, não sugere nada
      }
    };
    fetchProdutoSugerido();
  }, [formData.maquina_id, formData.produto_id]);

  // --- FUNÇÕES DE CARREGAMENTO ---
  const carregarDados = async () => {
    try {
      setLoading(true);
      const [movRes, maqRes, prodRes, lojasRes, veiculosRes] =
        await Promise.all([
          api.get("/movimentacoes"),
          api.get("/maquinas"),
          api.get("/produtos"),
          api.get("/lojas"),
          api.get("/veiculos"),
        ]);

      setMovimentacoes(movRes.data || []);
      setMaquinas(maqRes.data || []);
      setProdutos(prodRes.data || []);
      setLojas(lojasRes.data || []);
      setVeiculos(veiculosRes.data || []);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
      setError("Erro ao carregar dados iniciais.");
    } finally {
      setLoading(false);
    }
  };

  // --- HANDLERS ---
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    // Limpar mensagens de erro/sucesso ao editar
    if (error) setError("");
    if (success) setSuccess("");
  };

  const limparFotoContadores = () => {
    if (fotoContadoresPreview) {
      URL.revokeObjectURL(fotoContadoresPreview);
    }
    setFotoContadores(null);
    setFotoContadoresPreview("");
    setResultadoFotoContadores("");
  };

  const prepararImagemParaEnvioIa = (file) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);

      image.onload = () => {
        const maxSize = 900;
        const escala = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * escala));
        canvas.height = Math.max(1, Math.round(image.height * escala));

        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL("image/jpeg", 0.62));
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Nao foi possivel ler a imagem."));
      };

      image.src = objectUrl;
    });

  const handleFotoContadores = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setResultadoFotoContadores("Selecione uma imagem valida.");
      return;
    }

    if (fotoContadoresPreview) {
      URL.revokeObjectURL(fotoContadoresPreview);
    }

    setFotoContadores(file);
    setFotoContadoresPreview(URL.createObjectURL(file));
    setLendoFotoContadores(true);
    setResultadoFotoContadores("IAgarra lendo os contadores...");
    setError("");
    setSuccess("");

    try {
      const dataUrl = await prepararImagemParaEnvioIa(file);
      const [meta, imagemBase64] = dataUrl.split(",");
      const mimeType = meta.match(/^data:(.*);base64$/)?.[1] || "image/jpeg";
      const tamanhoEstimadoBytes = Math.ceil((imagemBase64.length * 3) / 4);

      if (tamanhoEstimadoBytes > 2 * 1024 * 1024) {
        setResultadoFotoContadores(
          "A foto ficou grande demais para enviar. Tente tirar mais perto dos contadores ou com menos area ao redor.",
        );
        return;
      }

      const response = await api.post("/assistente-ia/ler-contadores", {
        imagemBase64,
        mimeType,
      });
      const { contadorIn, contadorOut, confianca, observacao } = response.data || {};

      if (!contadorIn || !contadorOut || confianca === "baixa") {
        setResultadoFotoContadores(
          observacao ||
            "A IAgarra nao teve certeza dos dois contadores. Preencha manualmente ou tire outra foto mais perto e reta.",
        );
        return;
      }

      setFormData((prev) => ({
        ...prev,
        contadorIn: String(contadorIn),
        contadorOut: String(contadorOut),
        ignoreInOut: false,
      }));
      setResultadoFotoContadores(
        `IAgarra leu: IN ${contadorIn} e OUT ${contadorOut}. Confira antes de salvar.`,
      );
    } catch (err) {
      console.error("Erro ao ler foto dos contadores com IA:", err);
      const erroApi = err.response?.data?.message || err.response?.data?.error;
      const mensagemErro =
        typeof erroApi === "string"
          ? erroApi
          : erroApi
            ? JSON.stringify(erroApi)
            : "Nao foi possivel ler a foto com IA. Preencha manualmente ou tente novamente.";
      setResultadoFotoContadores(mensagemErro);
    } finally {
      setLendoFotoContadores(false);
      e.target.value = "";
    }
  };

  const obterEstoqueDisponivelProdutoLoja = async (lojaId, produtoId) => {
    if (!lojaId || !produtoId) return 0;

    try {
      const response = await api.get(`/estoque-lojas/${lojaId}`);
      const itensEstoque = response.data || [];
      const estoqueProduto = itensEstoque.find(
        (item) =>
          item.produtoId === produtoId || item.produto?.id === produtoId,
      );

      return Number(estoqueProduto?.quantidade || 0);
    } catch (err) {
      console.error("Erro ao consultar estoque da loja:", err);
      throw new Error("Não foi possível validar o estoque da loja.");
    }
  };

  // --- CORREÇÃO AQUI: Função handleSubmit recriada com o TRY ---
  const handleSubmit = (e) => {
    e.preventDefault();

    if (divergenciaMachinePaySuspeita && !confirmacaoDivergenciaMachinePay) {
      setError(
        `O valor esperado pela ${nomeFontePagamento(sugestaoTotalPreMachinePay?.fonte)} é diferente do que foi digitado. Reconte a máquina, ou marque a confirmação de que já recontou e o valor está correto.`,
      );
      return;
    }

    if (contadorInSuspeito && !confirmacaoContadorIn) {
      setError(
        "A diferença do Contador IN em relação ao último registro é muito grande (provável erro de leitura). Marque a confirmação de que o valor está correto antes de registrar.",
      );
      return;
    }

    if (contadorOutSuspeito && !confirmacaoContadorOut) {
      setError(
        "A diferença do Contador OUT em relação ao último registro é muito grande (provável erro de leitura). Marque a confirmação de que o valor está correto antes de registrar.",
      );
      return;
    }

    setMostrarConfirmacaoMovimentacao(true);
  };

  const confirmarRegistroMovimentacao = async () => {
    if (movimentacaoEmEnvioRef.current) {
      return;
    }

    // Precisa ser aberta aqui, de forma síncrona, para não ser bloqueada
    // pelo Safari/iOS quando o envio ao WhatsApp acontecer mais tarde.
    const janelaWhatsapp = abrirJanelaWhatsapp();
    let janelaWhatsappUsada = false;

    movimentacaoEmEnvioRef.current = true;
    setSalvandoMovimentacao(true);
    setError("");
    setSuccess("");

    try {
      const quantidadeAdicionada = parseInt(formData.quantidadeAdicionada) || 0;

      if (quantidadeAdicionada > 0) {
        const estoqueDisponivel = await obterEstoqueDisponivelProdutoLoja(
          filtroLojaForm,
          formData.produto_id,
        );

        if (quantidadeAdicionada > estoqueDisponivel) {
          const produtoSelecionado = produtos.find(
            (p) => p.id === formData.produto_id,
          );
          setError(
            `Não há estoque suficiente na loja para abastecer ${produtoSelecionado?.nome || "este produto"}. Disponível: ${estoqueDisponivel}, solicitado: ${quantidadeAdicionada}.`,
          );
          return;
        }
      }

      setSalvandoMovimentacao(true);

      // Converter valores do formulário
      const totalPre = parseInt(formData.quantidadeAtualMaquina) || 0; // valor digitado pelo usuário
      const fichas = parseInt(formData.fichas) || 0;

      // totalPos = totalPre + abastecidas - retiradaProduto
      const retiradaProduto = parseInt(formData.retiradaProduto) || 0;
      const totalPos = totalPre + quantidadeAdicionada - retiradaProduto;

      // Buscar a última movimentação da máquina selecionada para pegar o totalPos anterior
      let ultimoTotalPos = 0;
      let movimentacoesMaquina = movimentacoes
        .filter((m) => {
          // Considera tanto maquinaId quanto maquina_id
          return (
            m.maquinaId === formData.maquina_id ||
            m.maquina_id === formData.maquina_id
          );
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      if (movimentacoesMaquina.length > 0) {
        ultimoTotalPos =
          movimentacoesMaquina[0].totalPos ||
          movimentacoesMaquina[0].totalPos ||
          0;
      }

      // sairam = totalPos da movimentação anterior - totalPre da atual
      // retiradaProduto NÃO conta em quantidadeSaiu nem no financeiro
      const quantidadeSaiu = Math.max(0, ultimoTotalPos - totalPre);

      console.log("📊 [handleSubmit] Cálculos da movimentação:");
      console.log("   📌 totalPos anterior:", ultimoTotalPos);
      console.log("   📌 Quantidade atual informada (totalPre):", totalPre);
      console.log(
        "   📌 Quantidade adicionada (abastecidas):",
        quantidadeAdicionada,
      );
      console.log("   📌 Calculado que saiu (sairam):", quantidadeSaiu);
      console.log("   📌 Novo total (totalPos):", totalPos);

      // Preparar observação
      let observacaoFinal = formData.observacao?.trim() || "";
      if (formData.retiradaEstoque) {
        const notaRetirada = "⚠️ RETIRADA DE ESTOQUE - NÃO É VENDA";
        observacaoFinal = observacaoFinal
          ? `${notaRetirada}. ${observacaoFinal}`
          : notaRetirada;
      }

      // Transformar para o formato do backend
      const data = {
        maquinaId: formData.maquina_id,
        ...(usuario?.role === "ADMIN" &&
          dataColetaIso && { dataColeta: dataColetaIso }),
        totalPre: totalPre,
        sairam: quantidadeSaiu,
        abastecidas: quantidadeAdicionada,
        totalPos: totalPos,
        fichas: fichas,
        contadorIn: parseInt(formData.contadorIn) || null,
        contadorOut: parseInt(formData.contadorOut) || null,
        retiradaEstoque: formData.retiradaEstoque,
        contadorMaquina: null,
        observacoes: observacaoFinal || null,
        origemTotalPre: sugestaoTotalPreMachinePay?.sugestaoDisponivel
          ? sugestaoTotalPreMachinePay.modo === "auto"
            ? "automatico"
            : "manual"
          : null,
        produtos: [
          {
            produtoId: formData.produto_id,
            quantidadeSaiu: quantidadeSaiu,
            quantidadeAbastecida: quantidadeAdicionada,
            retiradaProduto: retiradaProduto,
            // Transformar para o formato do backend (atualizado)
          },
        ],
      };

      await api.post("/movimentacoes", data);
      descartarRascunho(formData.maquina_id);

      // Conferência manual (a cada 15 dias) confirmada mesmo com divergência
      // em relação ao esperado pela Machine Pay: avisa o admin com os
      // números pra ele investigar (erro de contagem, pulso perdido, etc).
      if (divergenciaMachinePaySuspeita && confirmacaoDivergenciaMachinePay) {
        try {
          const esperado = sugestaoTotalPreMachinePay.sugestaoTotalPre;
          const diferenca = totalPre - esperado;
          await api.post("/alertas-movimentacao", {
            maquinaId: formData.maquina_id,
            observacao:
              `Divergência na conferência manual da ${nomeFontePagamento(sugestaoTotalPreMachinePay.fonte)}: era pra ter ${esperado} ` +
              `(calculado com base em R$ ${sugestaoTotalPreMachinePay.totalRecebidoDesdeUltimaMovimentacao.toFixed(2)} ` +
              `recebidos na ${nomeFontePagamento(sugestaoTotalPreMachinePay.fonte)} desde a movimentação anterior ÷ R$ ${Number(sugestaoTotalPreMachinePay.valorDesconto).toFixed(2)} por pulso ` +
              `= ${sugestaoTotalPreMachinePay.pulsos} pulso(s)), mas o operador registrou ${totalPre} ` +
              `mesmo após o aviso de recontagem. Diferença: ${diferenca > 0 ? "+" : ""}${diferenca}.`,
            dadosAbastecimento: {
              esperado,
              informado: totalPre,
              diferenca,
              totalRecebidoMachinePay:
                sugestaoTotalPreMachinePay.totalRecebidoDesdeUltimaMovimentacao,
              pulsos: sugestaoTotalPreMachinePay.pulsos,
              valorDesconto: sugestaoTotalPreMachinePay.valorDesconto,
            },
          });
        } catch (erroAlertaDivergencia) {
          console.error(
            "Erro ao registrar alerta de divergência da Machine Pay:",
            erroAlertaDivergencia,
          );
        }
      }

      if (alertaOrigemId) {
        try {
          await api.patch(`/alertas-movimentacao/${alertaOrigemId}/resolver`);
        } catch (erroResolverAlerta) {
          console.error(
            "Erro ao resolver alerta de movimentação de origem:",
            erroResolverAlerta,
          );
        }
        setAlertaOrigemId(null);
      }

      // Movimentação registrada com sucesso: envia automaticamente para o WhatsApp
      await enviarParaWhatsapp(janelaWhatsapp);
      janelaWhatsappUsada = true;
      resetFluxoWhatsappBypass();

      // Devolver retirada para o estoque da loja, se marcado
      if (
        formData.retiradaProdutoDevolverEstoque &&
        retiradaProduto > 0 &&
        formData.produto_id &&
        formData.maquina_id
      ) {
        // Encontrar a loja da máquina selecionada
        const maquinaSelecionada = maquinas.find(
          (m) => m.id === formData.maquina_id,
        );
        const lojaId = maquinaSelecionada ? maquinaSelecionada.lojaId : null;
        if (lojaId) {
          await api.post("/movimentacao-estoque-loja", {
            lojaId,
            produtos: [
              {
                produtoId: formData.produto_id,
                quantidade: retiradaProduto,
                tipoMovimentacao: "entrada",
              },
            ],
            usuarioId: usuario.id,
            observacao:
              "Devolução automática de retirada de produto da máquina",
          });
        }
      }

      // Logs para depuração do filtro
      console.log("Todas movimentações:", movimentacoes);
      console.log(
        "ID da máquina selecionada:",
        formData.maquina_id,
        "(tipo:",
        typeof formData.maquina_id,
        ")",
      );
      movimentacoesMaquina = movimentacoes
        .filter((m) => {
          const id1 = m.maquinaId !== undefined ? m.maquinaId : m.maquina_id;
          console.log(
            "Comparando:",
            id1,
            "(tipo:",
            typeof id1,
            ") com",
            formData.retiradaProdutoDevolverEstoque === true,
            "(tipo:",
            typeof formData.maquina_id,
            ")",
          );
          return id1 === formData.maquina_id;
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      console.log("Movimentações filtradas:", movimentacoesMaquina);
      ultimoTotalPos = 0;
      if (movimentacoesMaquina.length > 0) {
        ultimoTotalPos = movimentacoesMaquina[0].totalPos || 0;
      }
      console.log("Último totalPos encontrado:", ultimoTotalPos);

      setFormData(FORMULARIO_VAZIO);
      limparFotoContadores();
      setEstoqueAnterior(0);
      setMostrarMaisOpcoes(false);

      // Recarregar dados (a loja continua selecionada pra seguir pra
      // próxima máquina)
      carregarDados();
      buscarStatusLoja(filtroLojaForm).then(setStatusLoja);
    } catch (error) {
      console.error("❌ [handleSubmit] Erro:", error);
      setError(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Erro ao registrar movimentação",
      );
    } finally {
      if (janelaWhatsapp && !janelaWhatsappUsada && !janelaWhatsapp.closed) {
        janelaWhatsapp.close();
      }
      movimentacaoEmEnvioRef.current = false;
      setSalvandoMovimentacao(false);
    }
  };

  // --- WHATSAPP ---
  const enviarParaWhatsapp = async (janelaPreAberta = null) => {
    const loja = lojas.find((l) => l.id === filtroLojaForm);
    const maquina = maquinas.find((m) => m.id === formData.maquina_id);
    const produto = produtos.find((p) => p.id === formData.produto_id);
    const capacidadeMaquina =
      maquina?.capacidadePadrao ?? maquina?.capacidade ?? null;

    const totalPre = parseInt(formData.quantidadeAtualMaquina) || 0;
    const quantidadeAdicionada = parseInt(formData.quantidadeAdicionada) || 0;
    const retiradaProduto = parseInt(formData.retiradaProduto) || 0;
    const totalPos = totalPre + quantidadeAdicionada - retiradaProduto;

    let mensagem = ` *Movimentação de Máquina*\n`;
    mensagem += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    mensagem += `->  *Loja:* ${loja?.nome || "Não informada"}\n`;
    mensagem += `->  *Máquina:* ${maquina ? `${maquina.nome} - ${maquina.codigo}` : "Não informada"}\n`;
    mensagem += `->  *Produto:* ${produto ? `${produto.emoji || ""} ${produto.nome}` : "Não informado"}\n`;
    mensagem += `->  *Capacidade da máquina:* ${capacidadeMaquina ?? "Não informada"}\n`;

    if (!formData.ignoreInOut) {
      mensagem += `\n━━━━━━━━━━━━━━━━━━━━\n`;
      mensagem += `->  *Contador IN:* ${formData.contadorIn || "0"}\n`;
      mensagem += `->  *Contador OUT:* ${formData.contadorOut || "0"}\n`;
    }

    mensagem += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    mensagem += `->  *Quantidade atual na máquina:* ${totalPre}\n`;
    mensagem += `->  *Quantidade adicionada:* ${quantidadeAdicionada}\n`;
    mensagem += `->  *Total após abastecimento:* ${totalPos}\n`;
    mensagem += `->  *Fichas:* ${formData.fichas || "0"}\n`;

    if (retiradaProduto > 0) {
      mensagem += `\n━━━━━━━━━━━━━━━━━━━━\n`;
      mensagem += `->  *Retirada de produto:* ${retiradaProduto}\n`;
      mensagem += `->  *Devolvido ao estoque:* ${formData.retiradaProdutoDevolverEstoque ? "Sim ✅" : "Não ❌"}\n`;
    }

    if (formData.retiradaEstoque) {
      mensagem += `\n━━━━━━━━━━━━━━━━━━━━\n`;
      mensagem += `-> *Retirada de estoque (não é venda)*\n`;
    }

    if (formData.observacao?.trim()) {
      mensagem += `\n━━━━━━━━━━━━━━━━━━━━\n`;
      mensagem += `->  *Observação:* ${formData.observacao.trim()}\n`;
    }

    if (fotoContadores) {
      mensagem += `\n->  *Foto dos contadores:* anexada nesta mensagem\n`;
    }

    localStorage.setItem(CHAVE_ULTIMA_MENSAGEM_WHATSAPP, mensagem);
    setTemMensagemSalva(true);
    try {
      if (fotoContadores) {
        await salvarFotoUltimaMovimentacao(fotoContadores);
      } else {
        await limparFotoUltimaMovimentacao();
      }
    } catch (err) {
      console.error("Erro ao salvar foto da última movimentação:", err);
    }

    if (
      fotoContadores &&
      navigator.canShare &&
      navigator.share &&
      navigator.canShare({ files: [fotoContadores] })
    ) {
      try {
        await navigator.share({
          title: "Movimentacao de Maquina",
          text: mensagem,
          files: [fotoContadores],
        });
        if (janelaPreAberta && !janelaPreAberta.closed) janelaPreAberta.close();
        return;
      } catch (err) {
        if (err?.name === "AbortError") {
          if (janelaPreAberta && !janelaPreAberta.closed) janelaPreAberta.close();
          return;
        }
        console.error("Erro ao compartilhar foto no WhatsApp:", err);
      }
    }

    if (fotoContadores) {
      setError(
        "Este navegador nao permite anexar a foto automaticamente pelo WhatsApp. O texto foi aberto; anexe a foto manualmente na conversa.",
      );
    }

    const url = `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
    navegarParaWhatsapp(janelaPreAberta, url);
  };

  const enviarUltimaMensagemSalva = async () => {
    const janelaPreAberta = abrirJanelaWhatsapp();

    const mensagem = localStorage.getItem(CHAVE_ULTIMA_MENSAGEM_WHATSAPP);
    if (!mensagem) {
      if (janelaPreAberta && !janelaPreAberta.closed) janelaPreAberta.close();
      setError("Nenhuma mensagem de movimentação salva para reenviar.");
      return;
    }

    const foto = await obterFotoUltimaMovimentacao().catch((err) => {
      console.error("Erro ao ler foto salva da última movimentação:", err);
      return null;
    });

    if (
      foto &&
      navigator.canShare &&
      navigator.share &&
      navigator.canShare({ files: [foto] })
    ) {
      try {
        await navigator.share({
          title: "Movimentacao de Maquina",
          text: mensagem,
          files: [foto],
        });
        if (janelaPreAberta && !janelaPreAberta.closed) janelaPreAberta.close();
        return;
      } catch (err) {
        if (err?.name === "AbortError") {
          if (janelaPreAberta && !janelaPreAberta.closed) janelaPreAberta.close();
          return;
        }
        console.error("Erro ao compartilhar foto salva no WhatsApp:", err);
      }
    }

    if (foto) {
      setError(
        "Este navegador não permite anexar a foto automaticamente pelo WhatsApp. O texto foi aberto; anexe a foto manualmente na conversa.",
      );
    }

    const url = `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
    navegarParaWhatsapp(janelaPreAberta, url);
  };

  const resetFluxoWhatsappBypass = () => {
    setNaoVaiRegistrar(false);
    setMostrarObsAlerta(false);
    setObsAlerta("");
  };

  // Abre a máquina clicada (com o formulário zerado) ou fecha se já estava
  // aberta. A data retroativa escolhida pelo admin vale pra loja inteira.
  const selecionarMaquina = (maquinaId) => {
    // A leitura da foto por IA preenche a máquina aberta; não troca no meio.
    if (lendoFotoContadores) return;

    const atual = formData.maquina_id;
    if (atual && fotoContadores) {
      fotosRascunhoRef.current[atual] = {
        foto: fotoContadores,
        resultado: resultadoFotoContadores,
      };
    } else if (atual) {
      delete fotosRascunhoRef.current[atual];
    }

    const abrindo = atual === maquinaId ? "" : maquinaId;
    const { atualizadoEm: _atualizadoEm, ...campos } =
      (abrindo && rascunhos[abrindo]) || {};
    const fotoSalva = abrindo ? fotosRascunhoRef.current[abrindo] : null;

    setFotoContadores(fotoSalva?.foto || null);
    setFotoContadoresPreview(
      fotoSalva ? URL.createObjectURL(fotoSalva.foto) : "",
    );
    setResultadoFotoContadores(fotoSalva?.resultado || "");
    resetFluxoWhatsappBypass();
    setAlertaOrigemId(null);
    setMostrarMaisOpcoes(
      !!(campos.observacao || campos.retiradaEstoque || Number(campos.retiradaProduto) > 0),
    );
    setEstoqueAnterior(0);
    setError("");
    setFormData((prev) => ({
      ...FORMULARIO_VAZIO,
      ...campos,
      dataColeta: prev.dataColeta,
      maquina_id: abrindo,
    }));
  };

  const descartarRascunho = (maquinaId) => {
    if (!maquinaId) return;
    delete fotosRascunhoRef.current[maquinaId];
    setRascunhos((prev) => {
      const { [maquinaId]: _removido, ...resto } = prev;
      return resto;
    });
    // Grava já: no celular o WhatsApp abre na mesma aba logo em seguida.
    const salvos = lerRascunhos();
    delete salvos[maquinaId];
    gravarRascunhos(salvos);
  };

  const limparCamposMaquina = () => {
    limparFotoContadores();
    setMostrarMaisOpcoes(false);
    setFormData((prev) => ({
      ...FORMULARIO_VAZIO,
      dataColeta: prev.dataColeta,
      maquina_id: prev.maquina_id,
    }));
  };

  const fecharMaquina = () => {
    if (formData.maquina_id) selecionarMaquina(formData.maquina_id);
  };

  const handleClickEnviarWhatsapp = () => {
    if (!naoVaiRegistrar) return;
    if (!formData.maquina_id) {
      setError("Selecione a máquina antes de enviar para o WhatsApp.");
      return;
    }
    setMostrarObsAlerta(true);
  };

  const confirmarEnvioBypassWhatsapp = async () => {
    if (!obsAlerta.trim() || enviandoAlerta) return;

    // Precisa ser aberta aqui, de forma síncrona, para não ser bloqueada
    // pelo Safari/iOS quando o envio ao WhatsApp acontecer mais tarde.
    const janelaWhatsapp = abrirJanelaWhatsapp();
    let janelaWhatsappUsada = false;

    setEnviandoAlerta(true);
    setError("");
    try {
      await api.post("/alertas-movimentacao", {
        maquinaId: formData.maquina_id,
        observacao: obsAlerta.trim(),
        dadosAbastecimento: {
          produtoId: formData.produto_id || null,
          quantidadeAtualMaquina: formData.quantidadeAtualMaquina || null,
          quantidadeAdicionada: formData.quantidadeAdicionada || null,
          fichas: formData.fichas || null,
          contadorIn: formData.contadorIn || null,
          contadorOut: formData.contadorOut || null,
        },
      });
      await enviarParaWhatsapp(janelaWhatsapp);
      janelaWhatsappUsada = true;
      resetFluxoWhatsappBypass();
    } catch (err) {
      console.error("Erro ao registrar alerta de movimentação:", err);
      setError(
        err?.response?.data?.error ||
          "Não foi possível registrar o alerta. O WhatsApp não foi aberto.",
      );
    } finally {
      if (janelaWhatsapp && !janelaWhatsappUsada && !janelaWhatsapp.closed) {
        janelaWhatsapp.close();
      }
      setEnviandoAlerta(false);
    }
  };

  // --- CÁLCULOS DE ESTATÍSTICAS ---
  // const entradas = movimentacoes.filter((m) => m.abastecidas > 0);
  // const saidas = movimentacoes.filter((m) => m.sairam > 0);
  // const totalEntradas = entradas.reduce(
  //   (sum, m) => sum + (m.abastecidas || 0),
  //   0,
  // );
  // const totalSaidas = saidas.reduce((sum, m) => sum + (m.sairam || 0), 0);

  // const stats = [
  //   {
  //     label: "Total de Entradas",
  //     value: totalEntradas,
  //     icon: "📥",
  //     gradient: "bg-gradient-to-br from-green-500 to-green-600",
  //     subtitle: "Produtos abastecidos",
  //   },
  //   {
  //     label: "Total de Saídas",
  //     value: totalSaidas,
  //     icon: "📤",
  //     gradient: "bg-gradient-to-br from-red-500 to-red-600",
  //     subtitle: "Produtos vendidos",
  //   },
  //   {
  //     label: "Saldo",
  //     value: totalEntradas - totalSaidas,
  //     icon: "📊",
  //     gradient: "bg-gradient-to-br from-blue-500 to-blue-600",
  //     subtitle: "Diferença entrada/saída",
  //   },
  //   {
  //     label: "Movimentações",
  //     value: movimentacoes.length,
  //     icon: "🔄",
  //     gradient: "bg-gradient-to-br from-purple-500 to-purple-600",
  //     subtitle: "Total de registros",
  //   },
  // ];

  if (loading) return <PageLoader />;

  const contadorInAtualNum = parseInt(formData.contadorIn);
  const diferencaContadorIn =
    !formData.ignoreInOut &&
    !isNaN(contadorInAtualNum) &&
    ultimoContadorMaquina.contadorIn !== null
      ? Math.abs(contadorInAtualNum - ultimoContadorMaquina.contadorIn)
      : 0;
  const contadorInSuspeito = diferencaContadorIn > LIMITE_DIFERENCA_CONTADOR_IN;

  const contadorOutAtualNum = parseInt(formData.contadorOut);
  const diferencaContadorOut =
    !formData.ignoreInOut &&
    !isNaN(contadorOutAtualNum) &&
    ultimoContadorMaquina.contadorOut !== null
      ? Math.abs(contadorOutAtualNum - ultimoContadorMaquina.contadorOut)
      : 0;
  const contadorOutSuspeito =
    diferencaContadorOut > LIMITE_DIFERENCA_CONTADOR_OUT;

  // O valor calculado pela Machine Pay (modo "auto" ou "forcar_manual") não
  // trava o campo: o operador pode sempre ajustar. Mas se o que ele digitou
  // não bater com o valor esperado, pede recontagem e confirmação explícita.
  const totalPreDigitadoNum = parseInt(formData.quantidadeAtualMaquina);
  const divergenciaMachinePaySuspeita =
    sugestaoTotalPreMachinePay?.sugestaoDisponivel &&
    (sugestaoTotalPreMachinePay?.modo === "forcar_manual" ||
      sugestaoTotalPreMachinePay?.modo === "auto") &&
    !isNaN(totalPreDigitadoNum) &&
    totalPreDigitadoNum !== sugestaoTotalPreMachinePay.sugestaoTotalPre;

  const lojaSelecionadaNoForm = lojas.find(
    (l) => String(l.id) === String(filtroLojaForm),
  );
  const maquinaSelecionadaNoForm = maquinas.find(
    (m) => String(m.id) === String(formData.maquina_id),
  );
  const produtoSelecionadoNoForm = produtos.find(
    (p) => String(p.id) === String(formData.produto_id),
  );
  const quantidadeAdicionadaNoForm =
    parseInt(formData.quantidadeAdicionada) || 0;
  const retiradaProdutoNoForm = parseInt(formData.retiradaProduto) || 0;

  const maquinasDaLoja = filtroLojaForm
    ? maquinas.filter((m) => String(m.lojaId) === String(filtroLojaForm))
    : [];
  const maquinasConcluidasLoja = maquinasDaLoja.filter(
    (m) => statusLoja.concluidas[m.id],
  ).length;
  const maquinasEmAndamentoLoja = maquinasDaLoja.filter(
    (m) => rascunhos[m.id],
  ).length;

  const resumoConfirmacaoMovimentacao = (
    <>
      <span className="block">
        <strong>Loja:</strong> {lojaSelecionadaNoForm?.nome || "-"}
      </span>
      <span className="block">
        <strong>Máquina:</strong>{" "}
        {maquinaSelecionadaNoForm
          ? `${maquinaSelecionadaNoForm.nome} - ${maquinaSelecionadaNoForm.codigo}`
          : "-"}
      </span>
      <span className="block">
        <strong>Produto:</strong> {produtoSelecionadoNoForm?.nome || "-"}
      </span>
      {!formData.ignoreInOut && (
        <>
          <span className="block">
            <strong>Contador IN:</strong> {formData.contadorIn || "0"}
          </span>
          <span className="block">
            <strong>Contador OUT:</strong> {formData.contadorOut || "0"}
          </span>
        </>
      )}
      <span className="block">
        <strong>Fichas coletadas:</strong> {formData.fichas || "0"}
      </span>
      <span className="block">
        <strong>Quantidade atual na máquina:</strong>{" "}
        {formData.quantidadeAtualMaquina || "0"}
      </span>
      <span className="block font-bold text-green-700">
        <strong>Quantidade abastecida:</strong> {quantidadeAdicionadaNoForm}
      </span>
      {retiradaProdutoNoForm > 0 && (
        <span className="block">
          <strong>Retirada de produto:</strong> {retiradaProdutoNoForm}
        </span>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header com dois botões lado a lado */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <PageHeader
            title="Movimentações"
            subtitle="Registre entradas e saídas de produtos nas máquinas"
            icon="🔄"
            action={null}
          />
          <div className="flex flex-wrap gap-3">
            <button
              className="px-6 py-2 bg-rose-600 text-white rounded hover:bg-rose-700 font-bold shadow text-base"
              onClick={() => navigate("/sangrias")}
            >
              Sangria
            </button>
            {usuario?.role !== "FUNCIONARIO" && (
              <button
                className="px-6 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 font-bold shadow text-base"
                onClick={() => setModalRegistrarDinheiro(true)}
              >
                Registrar Dinheiro
              </button>
            )}
            <button
              className="px-6 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 font-bold shadow text-base"
              onClick={() => setModalGastoVariavel(true)}
            >
              Lançar Gasto Variável
            </button>
            <button
              className="px-6 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 font-bold shadow text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-700"
              onClick={enviarUltimaMensagemSalva}
              disabled={!temMensagemSalva}
              title={
                temMensagemSalva
                  ? "Reenviar a mensagem da última movimentação lançada"
                  : "Nenhuma mensagem salva ainda"
              }
            >
              Enviar Última Mensagem
            </button>
            {usuario?.role === "ADMIN" && (
              <button
                className="px-6 py-2 bg-slate-800 text-white rounded hover:bg-slate-900 font-bold shadow text-base"
                onClick={() => navigate("/historico-movimentacoes")}
              >
                🗂️ Ver Histórico
              </button>
            )}
          </div>
        </div>

        {/* Modal Lançar Gasto Variável */}
        {modalGastoVariavel && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 shadow-lg relative">
              <button
                onClick={() => setModalGastoVariavel(false)}
                style={{
                  position: "absolute",
                  top: 12,
                  right: 16,
                  fontSize: 22,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#888",
                }}
                aria-label="Fechar"
              >
                ×
              </button>
              <LancarGastoVariavel
                lojas={lojas}
                veiculos={veiculos}
                onClose={() => setModalGastoVariavel(false)}
                onSuccess={() => {
                  setSuccess("Gasto variável lançado com sucesso!");
                  carregarDados();
                }}
              />
            </div>
          </div>
        )}
        {/* Modal Registrar Dinheiro */}
        {modalRegistrarDinheiro && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div
              className="bg-white rounded-lg p-6 shadow-lg relative"
              style={{ minWidth: 520 }}
            >
              <button
                onClick={() => setModalRegistrarDinheiro(false)}
                style={{
                  position: "absolute",
                  top: 12,
                  right: 16,
                  fontSize: 22,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#888",
                }}
                aria-label="Fechar"
              >
                ×
              </button>
              <RegistrarDinheiro
                lojas={lojas}
                maquinas={maquinas}
                onSubmit={async (data) => {
                  try {
                    setError("");
                    setSuccess("");
                    const response = await api.post("/registro-dinheiro", data);
                    // Máquina com os dois IDs fecha nos dois sistemas;
                    // junta as mensagens de cada um.
                    const mensagemFechamento = (fechamento, nome) => {
                      if (!fechamento?.executado) return null;
                      if (fechamento.concluido) {
                        return fechamento.jaExistia
                          ? `esse período já estava fechado na ${nome}`
                          : `fechamento concluído na ${nome}`;
                      }
                      return `a ${nome} não confirmou o fechamento${
                        fechamento.erro ? ` (${fechamento.erro})` : ""
                      }`;
                    };
                    const mensagens = [
                      mensagemFechamento(
                        response.data?.fechamentoMachinePay,
                        "Machine Pay",
                      ),
                      mensagemFechamento(
                        response.data?.fechamentoCompactPay,
                        "CompactPay",
                      ),
                    ].filter(Boolean);
                    setSuccess(
                      mensagens.length
                        ? `Registro salvo: ${mensagens.join("; ")}.`
                        : "Registro de dinheiro salvo com sucesso!",
                    );
                    setModalRegistrarDinheiro(false);
                  } catch (err) {
                    setError(
                      err?.response?.data?.error ||
                        "Erro ao registrar dinheiro.",
                    );
                  }
                }}
              />
            </div>
          </div>
        )}

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}
        {success && (
          <AlertBox
            type="success"
            message={success}
            onClose={() => setSuccess("")}
          />
        )}  

        <div className="card-gradient mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🏪 Loja atual
              </label>
              <select
                value={filtroLojaForm}
                onChange={(e) => {
                  fecharMaquina();
                  setFiltroLojaForm(e.target.value);
                }}
                className="select-field text-base font-semibold"
              >
                <option value="">Em qual loja você está?</option>
                {lojas
                  .filter((l) => l.ativo)
                  .map((loja) => (
                    <option key={loja.id} value={loja.id}>
                      {loja.nome}
                    </option>
                  ))}
              </select>
            </div>

            {usuario?.role === "ADMIN" && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Data e hora da movimentação
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <input
                    type="datetime-local"
                    value={formData.dataColeta || paraInputDataHora()}
                    max={paraInputDataHora()}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dataColeta: e.target.value,
                      }))
                    }
                    className={`input-field ${formData.dataColeta ? "border-amber-500 bg-amber-50" : ""}`}
                  />
                  {formData.dataColeta && (
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, dataColeta: "" }))
                      }
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap"
                    >
                      Usar horário atual
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          {formData.dataColeta && (
            <p className="text-xs text-amber-700 mt-2">
              ⏪ Lançamento retroativo: a saída é calculada a partir da
              movimentação anterior a esta data, e a movimentação seguinte é
              recalculada para usar esta como anterior.
            </p>
          )}

          {!filtroLojaForm ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white/70 py-10 text-center">
              <div className="text-4xl mb-2">🏪</div>
              <p className="font-semibold text-slate-700">
                Escolha a loja para ver as máquinas
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Toque numa máquina para registrar a movimentação dela.
              </p>
            </div>
          ) : (
            <div className="mt-6">
              <div className="flex items-end justify-between gap-3 mb-2">
                <h3 className="text-lg font-bold text-gray-900">Máquinas</h3>
                <p className="text-sm font-semibold text-slate-600 tabular-nums">
                  {carregandoStatusLoja
                    ? "Atualizando..."
                    : `${maquinasConcluidasLoja} de ${maquinasDaLoja.length} concluídas${maquinasEmAndamentoLoja ? ` · ${maquinasEmAndamentoLoja} em andamento` : ""}`}
                </p>
              </div>
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden mb-4">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{
                    width: `${maquinasDaLoja.length ? (maquinasConcluidasLoja / maquinasDaLoja.length) * 100 : 0}%`,
                  }}
                />
              </div>

              {maquinasDaLoja.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-500">
                  Nenhuma máquina cadastrada nesta loja.
                </p>
              )}

              <div className="space-y-2">
                {maquinasDaLoja.map((maquina) => {
                  const aberta =
                    String(formData.maquina_id) === String(maquina.id);
                  const concluidaEm = statusLoja.concluidas[maquina.id];
                  const manutencoesPendentes =
                    statusLoja.manutencoes[maquina.id] || 0;
                  const padrao = maquina.capacidadePadrao ?? null;
                  const atual = Number(maquina.estoqueAtual) || 0;
                  const falta =
                    padrao !== null ? Math.max(0, padrao - atual) : null;
                  const rascunho = aberta ? formData : rascunhos[maquina.id];
                  const temRascunho = aberta
                    ? rascunhoTemDados(formData)
                    : !!rascunhos[maquina.id];
                  const progresso = progressoRascunho(rascunho);

                  return (
                    <div
                      key={maquina.id}
                      id={`maquina-${maquina.id}`}
                      className={`scroll-mt-4 rounded-2xl border overflow-hidden transition-shadow ${
                        aberta
                          ? "border-amber-400 bg-white shadow-lg"
                          : concluidaEm
                            ? "border-emerald-200 bg-emerald-50/60"
                            : "border-slate-200 bg-white hover:shadow-md"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => selecionarMaquina(maquina.id)}
                        className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 text-left"
                        aria-expanded={aberta}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                            concluidaEm
                              ? "bg-emerald-500 text-white"
                              : "bg-slate-100 text-slate-400"
                          }`}
                          aria-label={concluidaEm ? "Concluída" : "Pendente"}
                        >
                          {concluidaEm ? "✓" : "•"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`font-bold truncate ${
                              concluidaEm && !aberta
                                ? "text-slate-500 line-through decoration-emerald-500/60"
                                : "text-slate-900"
                            }`}
                          >
                            {maquina.nome}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {maquina.codigo}
                            {temRascunho && (
                              <span className="ml-1 font-semibold text-amber-700">
                                · Rascunho {progresso.feitos}/{progresso.total}
                              </span>
                            )}
                            {concluidaEm && (
                              <span className="ml-1 font-semibold text-emerald-700">
                                · Concluída às{" "}
                                {concluidaEm.toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            )}
                          </p>
                          {temRascunho && (
                            <BarraProgresso
                              feitos={progresso.feitos}
                              total={progresso.total}
                              className="mt-1.5 max-w-48"
                            />
                          )}
                        </div>
                        {manutencoesPendentes > 0 && (
                          <span
                            className="shrink-0 inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-1 text-xs font-bold text-orange-700"
                            title={`${manutencoesPendentes} manutenção(ões) pendente(s)`}
                          >
                            🔧 {manutencoesPendentes}
                          </span>
                        )}
                        <NumeroMaquina label="Padrão" value={padrao ?? "-"} />
                        <NumeroMaquina
                          label="Falta"
                          value={falta ?? "-"}
                          tone={falta > 0 ? "amber" : "muted"}
                        />
                        <NumeroMaquina label="Atual" value={atual} />
                        <svg
                          className={`w-5 h-5 shrink-0 text-slate-400 transition-transform ${aberta ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>

                      {aberta && (
                        <form
                          onSubmit={handleSubmit}
                          className="border-t border-slate-200 px-3 sm:px-4 py-4 space-y-4"
                        >
                          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-semibold text-slate-700">
                                {progresso.faltando.length === 0
                                  ? "✅ Tudo preenchido, pode registrar"
                                  : `Falta: ${progresso.faltando.join(", ")}`}
                              </span>
                              <span className="shrink-0 text-slate-500 tabular-nums">
                                {progresso.feitos}/{progresso.total}
                                {temRascunho && " · 💾 salvo"}
                              </span>
                            </div>
                            <BarraProgresso
                              feitos={progresso.feitos}
                              total={progresso.total}
                              className="mt-1.5"
                            />
                          </div>

                          {concluidaEm && (
                            <p className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
                              ✓ Esta máquina já teve movimentação nas últimas{" "}
                              {HORAS_MAQUINA_CONCLUIDA}h. Registrar de novo
                              cria uma nova movimentação.
                            </p>
                          )}
                          {manutencoesPendentes > 0 && (
                            <p className="rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 text-xs text-orange-800">
                              🔧 {manutencoesPendentes} manutenção(ões)
                              pendente(s) nesta máquina.{" "}
                              <button
                                type="button"
                                onClick={() => navigate("/manutencao")}
                                className="font-semibold underline"
                              >
                                Ver manutenções
                              </button>
                            </p>
                          )}

                          {/* Produto + padrão */}
                          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Produto *
                              </label>
                              <select
                                name="produto_id"
                                value={formData.produto_id}
                                onChange={handleChange}
                                className={`select-field ${formData.produto_id ? "border-blue-500 bg-blue-50" : ""}`}
                                required
                              >
                                <option value="">Nenhum produto</option>
                                {produtos.map((produto) => (
                                  <option key={produto.id} value={produto.id}>
                                    {produto.emoji || "🧸"} {produto.nome}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-2 text-center">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                Padrão
                              </p>
                              <p className="text-xl font-bold text-slate-800 tabular-nums">
                                {padrao ?? "-"}
                              </p>
                            </div>
                          </div>
                          {formData.produto_id && (
                            <p className="-mt-2 text-[11px] text-blue-600">
                              ✨ Produto sugerido com base na última visita
                            </p>
                          )}

                          {/* Foto dos contadores */}
                          <div className="p-4 bg-white border border-blue-100 rounded-xl">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Foto dos contadores
                            </label>
                            <input
                              id="foto-contadores-camera"
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={handleFotoContadores}
                              className="sr-only"
                              disabled={lendoFotoContadores}
                            />
                            <label
                              htmlFor="foto-contadores-camera"
                              className={`inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg px-4 py-2 font-semibold text-white shadow transition-colors ${
                                lendoFotoContadores
                                  ? "cursor-not-allowed bg-gray-400"
                                  : "cursor-pointer bg-blue-600 hover:bg-blue-700"
                              }`}
                            >
                              <span aria-hidden="true">📷</span>
                              {lendoFotoContadores
                                ? "Lendo foto..."
                                : "Tirar foto dos contadores"}
                            </label>
                            <p className="text-xs text-gray-500 mt-2">
                              O maior número vira IN e o menor OUT. Confira e
                              ajuste se precisar.
                            </p>

                            {fotoContadoresPreview && (
                              <div className="mt-3 grid grid-cols-1 md:grid-cols-[160px_1fr] gap-3 items-start">
                                <img
                                  src={fotoContadoresPreview}
                                  alt="Foto dos contadores"
                                  className="w-full max-w-40 rounded-lg border border-gray-200 object-cover"
                                />
                                <div className="text-sm">
                                  {resultadoFotoContadores && (
                                    <p
                                      className={`font-medium ${
                                        lendoFotoContadores
                                          ? "text-blue-700"
                                          : "text-gray-700"
                                      }`}
                                    >
                                      {resultadoFotoContadores}
                                    </p>
                                  )}
                                  <p className="text-xs text-gray-500 mt-1">
                                    A foto não é salva no sistema, só vai
                                    anexada na mensagem do WhatsApp.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={limparFotoContadores}
                                    className="mt-2 text-xs font-semibold text-red-600 hover:text-red-700"
                                  >
                                    Remover foto
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Contadores */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">
                                📥 Contador IN
                              </label>
                              <input
                                type="number"
                                inputMode="numeric"
                                name="contadorIn"
                                value={formData.contadorIn}
                                onChange={handleChange}
                                className="input-field"
                                placeholder={
                                  ultimoContadorMaquina.contadorIn !== null
                                    ? `Último: ${ultimoContadorMaquina.contadorIn}`
                                    : "0"
                                }
                                min="0"
                                required={!formData.ignoreInOut}
                                disabled={formData.ignoreInOut}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">
                                📤 Contador OUT
                              </label>
                              <input
                                type="number"
                                inputMode="numeric"
                                name="contadorOut"
                                value={formData.contadorOut}
                                onChange={handleChange}
                                className="input-field"
                                placeholder={
                                  ultimoContadorMaquina.contadorOut !== null
                                    ? `Último: ${ultimoContadorMaquina.contadorOut}`
                                    : "0"
                                }
                                min="0"
                                required={!formData.ignoreInOut}
                                disabled={formData.ignoreInOut}
                              />
                            </div>
                          </div>
                          {contadorInSuspeito && (
                            <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded">
                              <p className="text-xs font-bold text-red-800 mb-1">
                                🚫 Diferença de {diferencaContadorIn} em relação
                                ao último Contador IN registrado (
                                {ultimoContadorMaquina.contadorIn}).
                                Provavelmente há um erro de leitura ou
                                digitação.
                              </p>
                              <label className="flex items-center gap-2 mt-2">
                                <input
                                  type="checkbox"
                                  checked={confirmacaoContadorIn}
                                  onChange={(e) =>
                                    setConfirmacaoContadorIn(e.target.checked)
                                  }
                                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                />
                                <span className="text-xs font-semibold text-red-800">
                                  Tenho certeza que o Contador IN está correto
                                </span>
                              </label>
                            </div>
                          )}
                          {contadorOutSuspeito && (
                            <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded">
                              <p className="text-xs font-bold text-red-800 mb-1">
                                🚫 Diferença de {diferencaContadorOut} em
                                relação ao último Contador OUT registrado (
                                {ultimoContadorMaquina.contadorOut}).
                                Provavelmente há um erro de leitura ou
                                digitação.
                              </p>
                              <label className="flex items-center gap-2 mt-2">
                                <input
                                  type="checkbox"
                                  checked={confirmacaoContadorOut}
                                  onChange={(e) =>
                                    setConfirmacaoContadorOut(e.target.checked)
                                  }
                                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                />
                                <span className="text-xs font-semibold text-red-800">
                                  Tenho certeza que o Contador OUT está correto
                                </span>
                              </label>
                            </div>
                          )}
                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              name="ignoreInOut"
                              checked={formData.ignoreInOut || false}
                              onChange={handleChange}
                              className="w-4 h-4"
                            />
                            Não preciso informar IN/OUT nesta movimentação
                          </label>

                          {/* Quantidade atual */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              📦 Quantidade atual na máquina *
                            </label>
                            <input
                              type="number"
                              inputMode="numeric"
                              name="quantidadeAtualMaquina"
                              value={formData.quantidadeAtualMaquina}
                              onChange={handleChange}
                              className="input-field"
                              placeholder={
                                carregandoSugestaoMachinePay
                                  ? "Buscando na Machine Pay/CompactPay..."
                                  : "Quantos produtos tem agora"
                              }
                              min="0"
                              disabled={carregandoSugestaoMachinePay}
                            />
                            {!carregandoSugestaoMachinePay &&
                              sugestaoTotalPreMachinePay?.sugestaoDisponivel &&
                              sugestaoTotalPreMachinePay.modo === "auto" && (
                                <p className="text-xs font-semibold text-emerald-600 mt-1">
                                  {`${sugestaoTotalPreMachinePay.fonte === "compactPay" ? "📟" : "💳"} Sugestão via ${nomeFontePagamento(sugestaoTotalPreMachinePay.fonte)}`}
                                  : R${" "}
                                  {sugestaoTotalPreMachinePay.totalRecebidoDesdeUltimaMovimentacao.toFixed(
                                    2,
                                  )}{" "}
                                  recebidos desde a última coleta (
                                  {sugestaoTotalPreMachinePay.pulsos} pulso
                                  {sugestaoTotalPreMachinePay.pulsos === 1
                                    ? ""
                                    : "s"}
                                  ) → Total Pré sugerido:{" "}
                                  {sugestaoTotalPreMachinePay.sugestaoTotalPre}.
                                  Se o valor real for diferente, ajuste — vamos
                                  pedir para você confirmar que recontou.
                                </p>
                              )}
                            {!carregandoSugestaoMachinePay &&
                              sugestaoTotalPreMachinePay?.sugestaoDisponivel &&
                              sugestaoTotalPreMachinePay.modo ===
                                "forcar_manual" && (
                                <p className="text-xs font-semibold text-purple-600 mt-1">
                                  🔍 Conferência manual (a cada 15 dias): conte
                                  fisicamente e digite o valor.
                                </p>
                              )}
                            {divergenciaMachinePaySuspeita && (
                              <div className="mt-2 p-3 bg-red-50 border-l-4 border-red-500 rounded">
                                <p className="text-xs font-bold text-red-800 mb-1">
                                  🚫 O valor digitado não confere com o que a{" "}
                                  {nomeFontePagamento(
                                    sugestaoTotalPreMachinePay?.fonte,
                                  )}{" "}
                                  esperava. Reconte a máquina antes de
                                  confirmar.
                                </p>
                                <label className="flex items-center gap-2 mt-2">
                                  <input
                                    type="checkbox"
                                    checked={confirmacaoDivergenciaMachinePay}
                                    onChange={(e) =>
                                      setConfirmacaoDivergenciaMachinePay(
                                        e.target.checked,
                                      )
                                    }
                                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                  />
                                  <span className="text-xs font-semibold text-red-800">
                                    Já recontei, o valor está correto mesmo
                                    assim
                                  </span>
                                </label>
                              </div>
                            )}
                            {formData.quantidadeAtualMaquina &&
                              estoqueAnterior > 0 && (
                                <p className="text-xs font-semibold text-red-600 mt-1">
                                  🔻 Saíram:{" "}
                                  {Math.max(
                                    0,
                                    estoqueAnterior -
                                      parseInt(
                                        formData.quantidadeAtualMaquina || 0,
                                      ),
                                  )}{" "}
                                  unidades
                                </p>
                              )}
                            {saidasCompactPay?.carregando && (
                              <p className="text-xs text-blue-600 mt-1">
                                📟 Buscando prêmios entregues na CompactPay...
                              </p>
                            )}
                            {saidasCompactPay?.erro && (
                              <p className="text-xs text-gray-500 mt-1">
                                📟 Não foi possível consultar os prêmios
                                entregues na CompactPay.
                              </p>
                            )}
                            {saidasCompactPay?.disponivel && (
                              <p
                                className={`text-xs font-semibold mt-1 ${
                                  formData.quantidadeAtualMaquina &&
                                  Math.max(
                                    0,
                                    estoqueAnterior -
                                      parseInt(
                                        formData.quantidadeAtualMaquina || 0,
                                      ),
                                  ) !== saidasCompactPay.saidas
                                    ? "text-orange-600"
                                    : "text-emerald-600"
                                }`}
                              >
                                📟 CompactPay: {saidasCompactPay.saidas} prêmio
                                {saidasCompactPay.saidas === 1 ? "" : "s"}{" "}
                                entregue
                                {saidasCompactPay.saidas === 1 ? "" : "s"}{" "}
                                desde a última movimentação (
                                {new Date(
                                  saidasCompactPay.desde,
                                ).toLocaleString("pt-BR")}
                                ). Esperado no Total Pré:{" "}
                                {Math.max(
                                  0,
                                  (saidasCompactPay.totalPosAnterior ??
                                    estoqueAnterior) - saidasCompactPay.saidas,
                                )}
                              </p>
                            )}
                            {alertaDivergencia && (
                              <div className="mt-2 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                                <p className="text-xs font-bold text-yellow-800">
                                  ⚠️ Atenção: possível erro de contagem!
                                  Reconte por favor.
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Fichas + abastecido */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">
                                🎫 Fichas
                              </label>
                              <input
                                type="number"
                                inputMode="numeric"
                                name="fichas"
                                value={formData.fichas}
                                onChange={handleChange}
                                className="input-field"
                                placeholder="0"
                                min="0"
                                disabled={formData.retiradaEstoque}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">
                                📥 Abastecido
                              </label>
                              <input
                                type="number"
                                inputMode="numeric"
                                name="quantidadeAdicionada"
                                value={formData.quantidadeAdicionada}
                                onChange={handleChange}
                                className="input-field"
                                placeholder={
                                  falta > 0 ? `Falta ${falta}` : "0"
                                }
                                min="0"
                              />
                            </div>
                          </div>
                          {formData.quantidadeAtualMaquina && (
                            <p className="-mt-2 text-xs font-semibold text-green-700">
                              ✅ Fica com{" "}
                              {parseInt(formData.quantidadeAtualMaquina || 0) +
                                quantidadeAdicionadaNoForm -
                                retiradaProdutoNoForm}
                              {padrao !== null && ` de ${padrao}`} na máquina
                            </p>
                          )}

                          {/* Mais opções */}
                          <div className="rounded-xl border border-slate-200 bg-slate-50/60">
                            <button
                              type="button"
                              onClick={() => setMostrarMaisOpcoes((v) => !v)}
                              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700"
                              aria-expanded={mostrarMaisOpcoes}
                            >
                              <span>
                                ⚙️ Mais opções
                                <span className="ml-2 font-normal text-slate-500">
                                  retirada, observação, aviso sem registrar
                                </span>
                              </span>
                              <svg
                                className={`w-4 h-4 text-slate-400 transition-transform ${mostrarMaisOpcoes ? "rotate-180" : ""}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </button>

                            {mostrarMaisOpcoes && (
                              <div className="px-4 pb-4 space-y-4">
                                <div>
                                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    ❌ Retirada de produto
                                  </label>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    name="retiradaProduto"
                                    value={formData.retiradaProduto}
                                    onChange={handleChange}
                                    className="input-field"
                                    placeholder="0"
                                    min="0"
                                  />
                                  <p className="text-xs text-gray-500 mt-1">
                                    Produtos tirados da máquina (não conta como
                                    saída financeira)
                                  </p>
                                  <label className="flex items-center mt-2 gap-2">
                                    <input
                                      type="checkbox"
                                      name="retiradaProdutoDevolverEstoque"
                                      checked={
                                        formData.retiradaProdutoDevolverEstoque ||
                                        false
                                      }
                                      onChange={handleChange}
                                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                    />
                                    <span className="text-xs text-green-700">
                                      Devolver retirada para o estoque da loja
                                    </span>
                                  </label>
                                </div>

                                <label className="flex items-start gap-3 cursor-pointer p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                  <input
                                    type="checkbox"
                                    name="retiradaEstoque"
                                    checked={formData.retiradaEstoque}
                                    onChange={handleChange}
                                    className="mt-0.5 w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                                  />
                                  <span>
                                    <span className="block text-sm font-bold text-orange-900">
                                      📦 Retirada de estoque (não conta como
                                      dinheiro)
                                    </span>
                                    <span className="block text-xs text-orange-700 mt-1">
                                      Produtos danificados, devolução,
                                      transferência. As fichas são zeradas.
                                    </span>
                                  </span>
                                </label>

                                <div>
                                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    💬 Observação
                                  </label>
                                  <textarea
                                    name="observacao"
                                    value={formData.observacao}
                                    onChange={handleChange}
                                    className="input-field"
                                    rows="2"
                                    placeholder="Informações adicionais sobre a movimentação..."
                                  />
                                </div>

                                <label className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
                                  <input
                                    type="checkbox"
                                    checked={naoVaiRegistrar}
                                    onChange={(e) => {
                                      setNaoVaiRegistrar(e.target.checked);
                                      if (!e.target.checked) {
                                        setMostrarObsAlerta(false);
                                        setObsAlerta("");
                                      }
                                    }}
                                    className="mt-1"
                                  />
                                  Não vou registrar agora — só quero avisar
                                  pelo WhatsApp (gera um alerta pra loja
                                  acompanhar).
                                </label>

                                {mostrarObsAlerta && (
                                  <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 space-y-2">
                                    <label className="block text-sm font-semibold text-amber-900">
                                      Por que você não vai registrar essa
                                      movimentação agora?
                                    </label>
                                    <textarea
                                      value={obsAlerta}
                                      onChange={(e) =>
                                        setObsAlerta(e.target.value)
                                      }
                                      className="input-field"
                                      rows="2"
                                      placeholder="Explique o motivo (obrigatório)"
                                    />
                                    <div className="flex gap-2 justify-end">
                                      <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick={() =>
                                          setMostrarObsAlerta(false)
                                        }
                                        disabled={enviandoAlerta}
                                      >
                                        Voltar
                                      </button>
                                      <button
                                        type="button"
                                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        onClick={confirmarEnvioBypassWhatsapp}
                                        disabled={
                                          enviandoAlerta || !obsAlerta.trim()
                                        }
                                      >
                                        {enviandoAlerta
                                          ? "Enviando..."
                                          : "Confirmar e enviar para WhatsApp"}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {error && (
                            <AlertBox
                              type="error"
                              message={error}
                              onClose={() => setError("")}
                            />
                          )}

                          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:items-center sm:justify-end pt-2">
                            {temRascunho && (
                              <button
                                type="button"
                                onClick={limparCamposMaquina}
                                className="text-sm font-semibold text-red-600 hover:text-red-700 sm:mr-auto"
                                disabled={salvandoMovimentacao}
                              >
                                🗑️ Limpar campos
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={fecharMaquina}
                              className="btn-secondary w-full sm:w-auto"
                              disabled={salvandoMovimentacao}
                              title="O que você preencheu fica salvo"
                            >
                              Fechar
                            </button>
                            {naoVaiRegistrar && (
                              <button
                                type="button"
                                onClick={handleClickEnviarWhatsapp}
                                className="px-4 py-2 font-semibold rounded-xl bg-green-500 hover:bg-green-600 text-white shadow w-full sm:w-auto"
                                disabled={salvandoMovimentacao}
                              >
                                Enviar aviso no WhatsApp
                              </button>
                            )}
                            <button
                              type="submit"
                              className="btn-primary w-full sm:w-auto"
                              disabled={
                                salvandoMovimentacao ||
                                naoVaiRegistrar ||
                                (contadorInSuspeito && !confirmacaoContadorIn) ||
                                (contadorOutSuspeito &&
                                  !confirmacaoContadorOut) ||
                                (divergenciaMachinePaySuspeita &&
                                  !confirmacaoDivergenciaMachinePay)
                              }
                            >
                              {salvandoMovimentacao
                                ? "Salvando..."
                                : "✓ Registrar movimentação"}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>
      <ConfirmDialog
        isOpen={mostrarConfirmacaoMovimentacao}
        onClose={() => setMostrarConfirmacaoMovimentacao(false)}
        onConfirm={confirmarRegistroMovimentacao}
        title="Confirmar Movimentação"
        message={resumoConfirmacaoMovimentacao}
        confirmText="Sim, registrar"
        cancelText="Revisar"
        type="primary"
      />

      <Footer />
    </div>
  );
}
