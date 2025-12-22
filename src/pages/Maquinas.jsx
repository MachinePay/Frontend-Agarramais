import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import {
  PageHeader,
  StatsGrid,
  DataTable,
  Badge,
  ConfirmDialog,
  AlertBox,
} from "../components/UIComponents";
import { PageLoader, EmptyState } from "../components/Loading";

export function Maquinas() {
  const navigate = useNavigate();
  const [maquinas, setMaquinas] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filtroLoja, setFiltroLoja] = useState("");

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [maquinasRes, lojasRes] = await Promise.all([
        api.get("/maquinas"),
        api.get("/lojas"),
      ]);
      setMaquinas(maquinasRes.data);
      setLojas(lojasRes.data);
    } catch (error) {
      setError(
        "Erro ao carregar dados: " +
          (error.response?.data?.error || error.message)
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/maquinas/${deleteId}`);
      setSuccess("Máquina excluída com sucesso!");
      carregarDados();
      setDeleteId(null);
    } catch (error) {
      setError(
        "Erro ao excluir máquina: " +
          (error.response?.data?.error || error.message)
      );
      setDeleteId(null);
    }
  };

  const maquinasFiltradas = filtroLoja
    ? maquinas.filter((m) => m.loja_id === parseInt(filtroLoja))
    : maquinas;

  const stats = [
    {
      title: "Total de Máquinas",
      value: maquinas.length,
      icon: "🎰",
      color: "primary",
    },
    {
      title: "Máquinas Ativas",
      value: maquinas.filter((m) => m.ativo).length,
      icon: "✅",
      color: "success",
    },
    {
      title: "Capacidade Total",
      value: maquinas.reduce((sum, m) => sum + (m.capacidade || 0), 0),
      icon: "📦",
      color: "secondary",
    },
    {
      title: "Estoque Total",
      value: maquinas.reduce((sum, m) => sum + (m.estoque_atual || 0), 0),
      icon: "🧸",
      color: "yellow",
    },
  ];

  const columns = [
    { key: "codigo", label: "Código" },
    { key: "nome", label: "Nome" },
    {
      key: "loja",
      label: "Loja",
      render: (maquina) => {
        const loja = lojas.find((l) => l.id === maquina.loja_id);
        return loja ? loja.nome : "N/A";
      },
    },
    { key: "capacidade", label: "Capacidade" },
    { key: "estoque_atual", label: "Estoque Atual" },
    {
      key: "ocupacao",
      label: "Ocupação",
      render: (maquina) => {
        const percent =
          maquina.capacidade > 0
            ? Math.round((maquina.estoque_atual / maquina.capacidade) * 100)
            : 0;

        let color = "success";
        if (percent < 30) color = "error";
        else if (percent < 60) color = "warning";

        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
              <div
                className={`h-2 rounded-full ${
                  color === "error"
                    ? "bg-red-500"
                    : color === "warning"
                    ? "bg-yellow-500"
                    : "bg-green-500"
                }`}
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>
            <span className="text-sm font-semibold">{percent}%</span>
          </div>
        );
      },
    },
    {
      key: "ativo",
      label: "Status",
      render: (maquina) => (
        <Badge type={maquina.ativo ? "success" : "error"}>
          {maquina.ativo ? "Ativa" : "Inativa"}
        </Badge>
      ),
    },
    {
      key: "acoes",
      label: "Ações",
      render: (maquina) => (
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/maquinas/${maquina.id}/editar`)}
            className="text-blue-600 hover:text-blue-800 font-semibold"
            title="Editar"
          >
            ✏️
          </button>
          <button
            onClick={() => setDeleteId(maquina.id)}
            className="text-red-600 hover:text-red-800 font-semibold"
            title="Excluir"
          >
            🗑️
          </button>
        </div>
      ),
    },
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Máquinas"
          subtitle="Gerencie as máquinas de pelúcia das lojas"
          icon="🎰"
          action={{
            label: "Nova Máquina",
            onClick: () => navigate("/maquinas/nova"),
          }}
        />

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

        <StatsGrid stats={stats} />

        <div className="card-gradient">
          {/* Filtros */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Filtrar por Loja
            </label>
            <select
              value={filtroLoja}
              onChange={(e) => setFiltroLoja(e.target.value)}
              className="select-field max-w-xs"
            >
              <option value="">Todas as Lojas</option>
              {lojas.map((loja) => (
                <option key={loja.id} value={loja.id}>
                  {loja.nome}
                </option>
              ))}
            </select>
          </div>

          {maquinasFiltradas.length > 0 ? (
            <DataTable columns={columns} data={maquinasFiltradas} />
          ) : (
            <EmptyState
              icon="🎰"
              title="Nenhuma máquina encontrada"
              message={
                filtroLoja
                  ? "Não há máquinas cadastradas nesta loja. Experimente selecionar outra loja."
                  : "Cadastre sua primeira máquina para começar!"
              }
              action={{
                label: "Nova Máquina",
                onClick: () => navigate("/maquinas/nova"),
              }}
            />
          )}
        </div>
      </div>

      <Footer />

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Excluir Máquina"
        message="Tem certeza que deseja excluir esta máquina? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
