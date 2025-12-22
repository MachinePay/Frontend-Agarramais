import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, Badge, AlertBox } from "../components/UIComponents";
import { PageLoader, EmptyState } from "../components/Loading";

export function LojaDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loja, setLoja] = useState(null);
  const [maquinas, setMaquinas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [lojaRes, maquinasRes] = await Promise.all([
        api.get(`/lojas/${id}`),
        api.get(`/maquinas`),
      ]);
      setLoja(lojaRes.data);
      setMaquinas(maquinasRes.data.filter((m) => m.loja_id === parseInt(id)));
    } catch (error) {
      setError(
        "Erro ao carregar dados: " +
          (error.response?.data?.error || error.message)
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageLoader />;
  if (error || !loja) {
    return (
      <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <AlertBox type="error" message={error || "Loja não encontrada"} />
        </div>
        <Footer />
      </div>
    );
  }

  const maquinasAtivas = maquinas.filter((m) => m.ativo).length;
  const capacidadeTotal = maquinas.reduce(
    (sum, m) => sum + (m.capacidade || 0),
    0
  );
  const estoqueTotal = maquinas.reduce(
    (sum, m) => sum + (m.estoque_atual || 0),
    0
  );
  const ocupacaoMedia =
    capacidadeTotal > 0
      ? Math.round((estoqueTotal / capacidadeTotal) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title={loja.nome}
          subtitle="Detalhes da loja e suas máquinas"
          icon="🏪"
          action={{
            label: "Editar Loja",
            onClick: () => navigate(`/lojas/${id}/editar`),
          }}
        />

        {/* Informações da Loja */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 card-gradient">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-primary"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              Informações da Loja
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-500">
                  Nome
                </label>
                <p className="text-lg font-bold text-gray-900">{loja.nome}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-500">
                  Status
                </label>
                <div className="mt-1">
                  <Badge type={loja.ativo ? "success" : "error"}>
                    {loja.ativo ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-gray-500">
                  Endereço
                </label>
                <p className="text-gray-900">
                  {loja.endereco}
                  {loja.cidade && loja.estado && (
                    <span className="text-gray-600">
                      {" "}
                      - {loja.cidade}, {loja.estado}
                    </span>
                  )}
                  {loja.cep && (
                    <span className="text-gray-600"> - CEP: {loja.cep}</span>
                  )}
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-500">
                  Telefone
                </label>
                <p className="text-gray-900">{loja.telefone}</p>
              </div>

              {loja.responsavel && (
                <div>
                  <label className="text-sm font-semibold text-gray-500">
                    Responsável
                  </label>
                  <p className="text-gray-900">{loja.responsavel}</p>
                </div>
              )}
            </div>
          </div>

          {/* Estatísticas */}
          <div className="space-y-4">
            <div className="stat-card bg-gradient-to-br from-primary/10 to-primary/5">
              <div className="text-3xl mb-2">🎰</div>
              <div className="text-2xl font-bold text-gray-900">
                {maquinas.length}
              </div>
              <div className="text-sm text-gray-600">Total de Máquinas</div>
            </div>

            <div className="stat-card bg-gradient-to-br from-green-500/10 to-green-500/5">
              <div className="text-3xl mb-2">✅</div>
              <div className="text-2xl font-bold text-gray-900">
                {maquinasAtivas}
              </div>
              <div className="text-sm text-gray-600">Máquinas Ativas</div>
            </div>

            <div className="stat-card bg-gradient-to-br from-secondary/10 to-secondary/5">
              <div className="text-3xl mb-2">📊</div>
              <div className="text-2xl font-bold text-gray-900">
                {ocupacaoMedia}%
              </div>
              <div className="text-sm text-gray-600">Ocupação Média</div>
            </div>
          </div>
        </div>

        {/* Lista de Máquinas */}
        <div className="card-gradient">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-primary"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
                <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
                <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
              </svg>
              Máquinas da Loja ({maquinas.length})
            </h3>
            <button
              onClick={() => navigate("/maquinas/nova")}
              className="btn-primary text-sm"
            >
              + Nova Máquina
            </button>
          </div>

          {maquinas.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {maquinas.map((maquina) => {
                const ocupacao =
                  maquina.capacidade > 0
                    ? Math.round(
                        (maquina.estoque_atual / maquina.capacidade) * 100
                      )
                    : 0;

                return (
                  <div
                    key={maquina.id}
                    className="p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-primary transition-all cursor-pointer"
                    onClick={() => navigate(`/maquinas/${maquina.id}/editar`)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-gray-900">
                          {maquina.nome}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {maquina.codigo}
                        </p>
                      </div>
                      <Badge type={maquina.ativo ? "success" : "error"}>
                        {maquina.ativo ? "Ativa" : "Inativa"}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Capacidade:</span>
                        <span className="font-semibold">
                          {maquina.capacidade}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Estoque:</span>
                        <span className="font-semibold">
                          {maquina.estoque_atual}
                        </span>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Ocupação:</span>
                          <span className="font-semibold">{ocupacao}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              ocupacao < 30
                                ? "bg-red-500"
                                : ocupacao < 60
                                ? "bg-yellow-500"
                                : "bg-green-500"
                            }`}
                            style={{ width: `${Math.min(ocupacao, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {maquina.modelo && (
                      <p className="text-xs text-gray-500 mt-3">
                        Modelo: {maquina.modelo}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon="🎰"
              title="Nenhuma máquina cadastrada"
              message="Esta loja ainda não possui máquinas cadastradas. Adicione a primeira máquina!"
              action={{
                label: "Nova Máquina",
                onClick: () => navigate("/maquinas/nova"),
              }}
            />
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
