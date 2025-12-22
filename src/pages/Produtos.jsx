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

export function Produtos() {
  const navigate = useNavigate();
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");

  useEffect(() => {
    carregarProdutos();
  }, []);

  const carregarProdutos = async () => {
    try {
      setLoading(true);
      const response = await api.get("/produtos");
      setProdutos(response.data);
    } catch (error) {
      setError(
        "Erro ao carregar produtos: " +
          (error.response?.data?.error || error.message)
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/produtos/${deleteId}`);
      setSuccess("Produto excluído com sucesso!");
      carregarProdutos();
      setDeleteId(null);
    } catch (error) {
      setError(
        "Erro ao excluir produto: " +
          (error.response?.data?.error || error.message)
      );
      setDeleteId(null);
    }
  };

  const categorias = [
    ...new Set(produtos.map((p) => p.categoria).filter(Boolean)),
  ];
  const produtosFiltrados = filtroCategoria
    ? produtos.filter((p) => p.categoria === filtroCategoria)
    : produtos;

  const stats = [
    {
      title: "Total de Produtos",
      value: produtos.length,
      icon: "🧸",
      color: "primary",
    },
    {
      title: "Produtos Ativos",
      value: produtos.filter((p) => p.ativo).length,
      icon: "✅",
      color: "success",
    },
    {
      title: "Categorias",
      value: categorias.length,
      icon: "📁",
      color: "secondary",
    },
    {
      title: "Valor Médio",
      value:
        produtos.length > 0
          ? `R$ ${(
              produtos.reduce((sum, p) => sum + (p.preco || 0), 0) /
              produtos.length
            ).toFixed(2)}`
          : "R$ 0,00",
      icon: "💰",
      color: "yellow",
    },
  ];

  const columns = [
    {
      key: "imagem",
      label: "",
      render: (produto) => (
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-2xl">
          {produto.emoji || "🧸"}
        </div>
      ),
    },
    { key: "codigo", label: "Código" },
    { key: "nome", label: "Nome" },
    { key: "categoria", label: "Categoria" },
    {
      key: "preco",
      label: "Preço",
      render: (produto) => (
        <span className="font-semibold text-green-600">
          R$ {(produto.preco || 0).toFixed(2)}
        </span>
      ),
    },
    {
      key: "estoque",
      label: "Estoque",
      render: (produto) => {
        const estoque = produto.estoque_atual || 0;
        const cor =
          estoque < 10 ? "error" : estoque < 30 ? "warning" : "success";
        return <Badge type={cor}>{estoque}</Badge>;
      },
    },
    {
      key: "ativo",
      label: "Status",
      render: (produto) => (
        <Badge type={produto.ativo ? "success" : "error"}>
          {produto.ativo ? "Ativo" : "Inativo"}
        </Badge>
      ),
    },
    {
      key: "acoes",
      label: "Ações",
      render: (produto) => (
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/produtos/${produto.id}/editar`)}
            className="text-blue-600 hover:text-blue-800 font-semibold"
            title="Editar"
          >
            ✏️
          </button>
          <button
            onClick={() => setDeleteId(produto.id)}
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
          title="Produtos"
          subtitle="Gerencie os produtos (pelúcias) disponíveis no sistema"
          icon="🧸"
          action={{
            label: "Novo Produto",
            onClick: () => navigate("/produtos/novo"),
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
          {categorias.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Filtrar por Categoria
              </label>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="select-field max-w-xs"
              >
                <option value="">Todas as Categorias</option>
                {categorias.map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {categoria}
                  </option>
                ))}
              </select>
            </div>
          )}

          {produtosFiltrados.length > 0 ? (
            <DataTable columns={columns} data={produtosFiltrados} />
          ) : (
            <EmptyState
              icon="🧸"
              title="Nenhum produto encontrado"
              message={
                filtroCategoria
                  ? "Não há produtos cadastrados nesta categoria. Experimente selecionar outra categoria."
                  : "Cadastre seu primeiro produto para começar!"
              }
              action={{
                label: "Novo Produto",
                onClick: () => navigate("/produtos/novo"),
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
        title="Excluir Produto"
        message="Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
