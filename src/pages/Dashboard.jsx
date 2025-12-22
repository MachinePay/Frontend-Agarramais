import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";

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
    return (
      <div className="min-h-screen bg-background-light">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card bg-gradient-to-br from-primary to-primary-light text-white">
            <h3 className="text-sm font-medium opacity-90">
              Faturamento Semanal
            </h3>
            <p className="text-3xl font-bold mt-2">
              R$ {stats.balanco?.totais?.totalFaturamento?.toFixed(2) || "0,00"}
            </p>
          </div>

          <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <h3 className="text-sm font-medium opacity-90">Total de Fichas</h3>
            <p className="text-3xl font-bold mt-2">
              {stats.balanco?.totais?.totalFichas || 0}
            </p>
          </div>

          <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
            <h3 className="text-sm font-medium opacity-90">Prêmios Saídos</h3>
            <p className="text-3xl font-bold mt-2">
              {stats.balanco?.totais?.totalSairam || 0}
            </p>
          </div>

          <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
            <h3 className="text-sm font-medium opacity-90">
              Alertas de Estoque
            </h3>
            <p className="text-3xl font-bold mt-2">{stats.alertas.length}</p>
          </div>
        </div>

        {/* Alertas de Estoque */}
        {stats.alertas.length > 0 && (
          <div className="card mb-8 border-l-4 border-red-500">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <span className="text-2xl mr-2">⚠️</span>
              Alertas de Estoque Baixo
            </h2>
            <div className="space-y-3">
              {stats.alertas.slice(0, 5).map((alerta, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-l-4 ${
                    alerta.nivelAlerta === "CRÍTICO"
                      ? "bg-red-50 border-red-500"
                      : alerta.nivelAlerta === "ALTO"
                      ? "bg-orange-50 border-orange-500"
                      : "bg-yellow-50 border-yellow-500"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {alerta.maquina.codigo} - {alerta.maquina.nome}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {alerta.maquina.loja}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-gray-900">
                        {alerta.percentualAtual}%
                      </span>
                      <p className="text-xs text-gray-600">
                        {alerta.estoqueAtual}/{alerta.capacidadePadrao}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {stats.alertas.length > 5 && (
              <Link
                to="/maquinas"
                className="block mt-4 text-center text-primary hover:text-primary-light font-semibold"
              >
                Ver todos os alertas ({stats.alertas.length})
              </Link>
            )}
          </div>
        )}

        {/* Distribuição por Loja */}
        {stats.balanco?.distribuicaoLojas?.length > 0 && (
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Performance por Loja
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Loja
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Fichas
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Prêmios
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Faturamento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Média F/P
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.balanco.distribuicaoLojas.map((loja, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {loja.nome}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {loja.fichas}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {loja.sairam}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-green-600 font-semibold">
                        R$ {loja.faturamento.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {loja.mediaFichasPremio}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ação Rápida */}
        <div className="mt-8 flex justify-center">
          <Link
            to="/movimentacoes/nova"
            className="btn-primary text-lg px-8 py-3"
          >
            ➕ Registrar Nova Movimentação
          </Link>
        </div>
      </div>
    </div>
  );
}
