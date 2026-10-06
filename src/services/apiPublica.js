import axios from "axios";

// Cliente para as páginas abertas por link (ex.: crédito remoto). Não usa os
// interceptors do `api`: nunca manda o token de quem estiver logado no
// navegador e não redireciona para /login em caso de 401.
const apiPublica = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    "https://backend-agarramais.onrender.com/api",
  headers: {
    "Content-Type": "application/json",
  },
});

export default apiPublica;
