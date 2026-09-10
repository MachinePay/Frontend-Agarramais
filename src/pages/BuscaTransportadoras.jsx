import { useState } from "react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { AlertBox } from "../components/UIComponents";
import { LoadingSpinner } from "../components/Loading";
import api from "../services/api";

const ESTADOS = [
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "TO", nome: "Tocantins" },
];

const apenasDigitos = (valor) => String(valor || "").replace(/\D/g, "");

const linkWhatsapp = (whatsapp) => {
  const digitos = apenasDigitos(whatsapp);
  if (!digitos) return null;
  const numero = digitos.startsWith("55") ? digitos : `55${digitos}`;
  return `https://wa.me/${numero}`;
};

export function BuscaTransportadoras() {
  const [estadoDestino, setEstadoDestino] = useState("");
  const [cidadeDestino, setCidadeDestino] = useState("");
  const [peso, setPeso] = useState("");
  const [dimensoes, setDimensoes] = useState("");
  const [mostrarAvancado, setMostrarAvancado] = useState(false);

  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!estadoDestino || !cidadeDestino.trim()) {
      setErro("Informe o estado e a cidade de destino.");
      return;
    }

    setBuscando(true);
    setErro("");
    setResultado(null);

    try {
      const response = await api.post("/transportadoras/buscar", {
        estadoDestino,
        cidadeDestino: cidadeDestino.trim(),
        peso: peso ? peso.trim() : "",
        dimensoes: dimensoes ? dimensoes.trim() : "",
      });
      setResultado(response.data);
    } catch (err) {
      setErro(
        err.response?.data?.error ||
          "Não foi possível buscar transportadoras no momento.",
      );
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <span className="text-5xl">🚚</span>
            <span className="text-gradient">Busca de Transportadoras</span>
          </h1>
          <p className="text-gray-600 text-lg">
            Encontre transportadoras que atendem a rota de São Paulo até o
            destino desejado, usando IA para pesquisar na web.
          </p>
        </div>

        {erro && (
          <div className="mb-6">
            <AlertBox type="error" message={erro} onClose={() => setErro("")} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="card mb-8 space-y-5">
          <div className="text-sm font-medium text-gray-500">
            Origem fixa: <span className="text-gray-800">São Paulo (SP)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Estado de destino *
              </label>
              <select
                value={estadoDestino}
                onChange={(e) => setEstadoDestino(e.target.value)}
                className="select-field"
                required
              >
                <option value="">Selecione...</option>
                {ESTADOS.map((estado) => (
                  <option key={estado.sigla} value={estado.sigla}>
                    {estado.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Cidade de destino *
              </label>
              <input
                type="text"
                value={cidadeDestino}
                onChange={(e) => setCidadeDestino(e.target.value)}
                className="input-field"
                placeholder="Ex: Belo Horizonte"
                required
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMostrarAvancado((atual) => !atual)}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {mostrarAvancado ? "− Ocultar" : "+ Informar"} peso e tamanho do
            produto (opcional, refina a busca)
          </button>

          {mostrarAvancado && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Peso aproximado (kg)
                </label>
                <input
                  type="text"
                  value={peso}
                  onChange={(e) => setPeso(e.target.value)}
                  className="input-field"
                  placeholder="Ex: 12"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tamanho / dimensões
                </label>
                <input
                  type="text"
                  value={dimensoes}
                  onChange={(e) => setDimensoes(e.target.value)}
                  className="input-field"
                  placeholder="Ex: 40x30x20 cm"
                />
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-gray-100">
            <button
              type="submit"
              className="btn-primary mt-4"
              disabled={buscando}
            >
              {buscando ? "Buscando..." : "🔎 Buscar transportadoras"}
            </button>
          </div>
        </form>

        {buscando && (
          <div className="card flex justify-center py-10">
            <LoadingSpinner message="Pesquisando transportadoras na web..." />
          </div>
        )}

        {resultado && !buscando && (
          <div className="space-y-6">
            {resultado.resumo && (
              <div className="card-gradient">
                <p className="text-gray-800">{resultado.resumo}</p>
              </div>
            )}

            {(!resultado.transportadoras ||
              resultado.transportadoras.length === 0) && (
              <div className="card text-center py-10 text-gray-500">
                Nenhuma transportadora relevante foi encontrada para essa
                rota. Tente refinar a cidade/estado ou informar peso e
                dimensões.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {(resultado.transportadoras || []).map((transportadora, index) => (
                <div key={index} className="card">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    {transportadora.nome}
                  </h3>
                  {transportadora.cidadeBase && (
                    <p className="text-sm text-gray-500 mb-3">
                      📍 {transportadora.cidadeBase}
                    </p>
                  )}

                  <div className="space-y-2 mb-3">
                    {transportadora.telefone && (
                      <a
                        href={`tel:${apenasDigitos(transportadora.telefone)}`}
                        className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary"
                      >
                        📞 {transportadora.telefone}
                      </a>
                    )}
                    {transportadora.whatsapp && (
                      <a
                        href={linkWhatsapp(transportadora.whatsapp)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                      >
                        💬 WhatsApp: {transportadora.whatsapp}
                      </a>
                    )}
                    {!transportadora.telefone && !transportadora.whatsapp && (
                      <p className="text-sm text-gray-400">
                        Contato não encontrado pela IA.
                      </p>
                    )}
                  </div>

                  {transportadora.motivoRelevancia && (
                    <p className="text-sm text-gray-600 border-t border-gray-100 pt-3">
                      {transportadora.motivoRelevancia}
                    </p>
                  )}

                  {transportadora.fonte && (
                    <p className="text-xs text-gray-400 mt-2">
                      Fonte: {transportadora.fonte}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
