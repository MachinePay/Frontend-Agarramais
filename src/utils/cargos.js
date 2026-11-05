// Cargos dos usuários (mesma lista do backend, src/constants/roles.js).
// "OPERADOR" era "FUNCIONARIO".
export const CARGOS = {
  ADMIN: {
    label: "Administrador",
    curto: "Admin",
    descricao: "Acesso total ao sistema",
    cor: "bg-primary/20 text-primary",
  },
  OPERADOR: {
    label: "Operador",
    curto: "Operador",
    descricao: "Registra movimentações nas lojas autorizadas",
    cor: "bg-blue-100 text-blue-800",
  },
  OPERADOR_CHEFE: {
    label: "Operador chefe",
    curto: "Operador chefe",
    descricao: "Coordena os operadores nas lojas autorizadas",
    cor: "bg-indigo-100 text-indigo-800",
  },
  SUPORTE: {
    label: "Suporte",
    curto: "Suporte",
    descricao: "Cuida de manutenção e suporte técnico das lojas autorizadas",
    cor: "bg-cyan-100 text-cyan-800",
  },
  FINANCEIRO: {
    label: "Financeiro",
    curto: "Financeiro",
    descricao: "Acompanha o financeiro das lojas autorizadas",
    cor: "bg-violet-100 text-violet-800",
  },
  MACHINEPAY: {
    label: "Machine Pay",
    curto: "Machine",
    descricao: "Acesso apenas às funcionalidades da Machine Pay",
    cor: "bg-amber-100 text-amber-800",
  },
  COMERCIAL: {
    label: "Comercial",
    curto: "Comercial",
    descricao: "Acesso apenas às páginas comerciais (transportadoras, pedidos)",
    cor: "bg-emerald-100 text-emerald-800",
  },
};

export const ORDEM_CARGOS = [
  "OPERADOR",
  "OPERADOR_CHEFE",
  "SUPORTE",
  "FINANCEIRO",
  "ADMIN",
  "MACHINEPAY",
  "COMERCIAL",
];

// Cargos que trabalham com lojas autorizadas.
export const CARGOS_COM_LOJAS = [
  "OPERADOR",
  "OPERADOR_CHEFE",
  "SUPORTE",
  "FINANCEIRO",
];

// Cargos da operação: por enquanto veem o sistema como o operador (o que
// antes era a visão de "funcionário").
export const ehEquipeOperacional = (role) => CARGOS_COM_LOJAS.includes(role);

export const nomeCargo = (role) => CARGOS[role]?.label || role || "-";

// Sessões salvas antes da troca ainda têm "FUNCIONARIO" no localStorage.
export const normalizarCargo = (role) =>
  role === "FUNCIONARIO" ? "OPERADOR" : role;
