import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageLoader } from "../components/Loading";

export function Dashboard() {
  const [stats, setStats] = useState({
    alertas: [],
    balanco: null,
    loading: true,
  });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const [alertasRes, balancoRes] = await Promise.all([
        api.get("/relatorios/alertas-estoque"),
        api.get("/relatorios/balanco-semanal"),
      ]);

      setStats({
        alertas: alertasRes.data.alertas || [],
        balanco: balancoRes.data,
        loading: false,
      });
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      setStats({ ...stats, loading: false });
    }
  };

  if (stats.loading) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header com boas-vindas */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            <span className="text-gradient">Dashboard</span> 🧸
          </h1>
          <p className="text-gray-600">
            Visão geral do seu sistema de pelúcias
          </p>
        </div>

        {/* Cards de Resumo com design moderno */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="stat-card bg-gradient-to-br from-primary to-accent-yellow">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium opacity-90">
                  Faturamento Semanal
                </h3>
                <svg
                  className="w-8 h-8 opacity-80"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="text-3xl font-bold">
                R${" "}
                {stats.balanco?.totais?.totalFaturamento?.toFixed(2) || "0,00"}
              </p>
              <p className="text-xs opacity-75 mt-1">💰 Últimos 7 dias</p>
            </div>
          </div>

          <div className="stat-card bg-gradient-to-br from-blue-500 to-blue-600">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium opacity-90">
                  Total de Fichas
                </h3>
                <svg
                  className="w-8 h-8 opacity-80"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <p className="text-3xl font-bold">
                {stats.balanco?.totais?.totalFichas || 0}
              </p>
              <p className="text-xs opacity-75 mt-1">🎫 Fichas inseridas</p>
            </div>
          </div>

          <div className="stat-card bg-gradient-to-br from-green-500 to-green-600">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium opacity-90">
                  Prêmios Saídos
                </h3>
                <svg
                  className="w-8 h-8 opacity-80"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                  />
                </svg>
              </div>
              <p className="text-3xl font-bold">
                {stats.balanco?.totais?.totalSairam || 0}
              </p>
              <p className="text-xs opacity-75 mt-1">🎁 Pelúcias entregues</p>
            </div>
          </div>

          <div className="stat-card bg-gradient-to-br from-red-500 to-red-600">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium opacity-90">
                  Alertas de Estoque
                </h3>
                <svg
                  className="w-8 h-8 opacity-80"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <p className="text-3xl font-bold">{stats.alertas.length}</p>
              <p className="text-xs opacity-75 mt-1">⚠️ Requer atenção</p>
            </div>
          </div>
        </div>

        {/* Alertas de Estoque */}
        {stats.alertas.length > 0 && (
          <div className="card mb-8 border-l-4 border-red-500">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <span className="bg-red-100 p-2 rounded-lg">⚠️</span>
                Alertas de Estoque Baixo
              </h2>
              <span className="badge badge-danger">
                {stats.alertas.length}{" "}
                {stats.alertas.length === 1 ? "alerta" : "alertas"}
              </span>
            </div>
            <div className="space-y-3">
              {stats.alertas.slice(0, 5).map((alerta, index) => (
                <div
                  key={index}
                  className={`p-5 rounded-xl border-l-4 transition-all duration-200 hover:scale-[1.02] ${
                    alerta.nivelAlerta === "CRÍTICO"
                      ? "bg-gradient-to-r from-red-50 to-red-100/50 border-red-500 shadow-red-100 shadow-md"
                      : alerta.nivelAlerta === "ALTO"
                      ? "bg-gradient-to-r from-orange-50 to-orange-100/50 border-orange-500 shadow-orange-100 shadow-md"
                      : "bg-gradient-to-r from-yellow-50 to-yellow-100/50 border-yellow-500 shadow-yellow-100 shadow-md"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-lg text-gray-900">
                          {alerta.maquina.codigo}
                        </span>
                        <span className="text-gray-600">-</span>
                        <span className="text-gray-800 font-medium">
                          {alerta.maquina.nome}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {alerta.maquina.loja}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-gray-900">
                          {alerta.percentualAtual}
                        </span>
                        <span className="text-lg text-gray-600">%</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 bg-white/60 px-2 py-1 rounded-full">
                        {alerta.estoqueAtual}/{alerta.capacidadePadrao} unidades
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {stats.alertas.length > 5 && (
              <Link
                to="/maquinas"
                className="block mt-6 text-center bg-gradient-to-r from-primary/10 to-accent-yellow/10 hover:from-primary/20 hover:to-accent-yellow/20 text-primary font-bold py-3 rounded-xl transition-all duration-200"
              >
                Ver todos os alertas ({stats.alertas.length})
              </Link>
            )}
          </div>
        )}

        {/* Distribuição por Loja */}
        {stats.balanco?.distribuicaoLojas?.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <span className="bg-gradient-to-br from-primary to-accent-yellow p-2 rounded-lg">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                Performance por Loja
              </h2>
              <span className="badge badge-info">
                {stats.balanco.distribuicaoLojas.length}{" "}
                {stats.balanco.distribuicaoLojas.length === 1
                  ? "loja"
                  : "lojas"}
              </span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-primary"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Loja
                      </div>
                    </th>
                    <th>
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-blue-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                          <path
                            fillRule="evenodd"
                            d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Fichas
                      </div>
                    </th>
                    <th>
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-green-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                        </svg>
                        Prêmios
                      </div>
                    </th>
                    <th>
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-accent-yellow"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Faturamento
                      </div>
                    </th>
                    <th>
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-purple-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                        </svg>
                        Média F/P
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.balanco.distribuicaoLojas.map((loja, index) => (
                    <tr key={index}>
                      <td className="font-bold text-gray-900">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-gradient-to-r from-primary to-accent-yellow"></div>
                          {loja.nome}
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-blue-50 text-blue-700 border-blue-200">
                          {loja.fichas}
                        </span>
                      </td>
                      <td>
                        <span className="badge bg-green-50 text-green-700 border-green-200">
                          {loja.sairam}
                        </span>
                      </td>
                      <td>
                        <span className="font-bold text-green-600 text-lg">
                          R$ {loja.faturamento.toFixed(2)}
                        </span>
                      </td>
                      <td>
                        <span className="badge bg-purple-50 text-purple-700 border-purple-200">
                          {loja.mediaFichasPremio}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ação Rápida com design destacado */}
        <div className="mt-8 flex justify-center">
          <Link
            to="/movimentacoes/nova"
            className="btn-primary text-lg px-10 py-4 flex items-center gap-3 shadow-2xl"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Registrar Nova Movimentação
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}
