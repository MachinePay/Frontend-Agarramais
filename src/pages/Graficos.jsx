import { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export function Graficos() {
  const [loading, setLoading] = useState(true);
  const [lojas, setLojas] = useState([]);
  const [lojaSelecionada, setLojaSelecionada] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [dadosProcessados, setDadosProcessados] = useState(null);

  useEffect(() => {
    carregarLojas();
  }, []);

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);
      const [maquinasRes, movimentacoesRes, produtosRes] = await Promise.all([
        api.get("/maquinas"),
        api.get("/movimentacoes"),
        api.get("/produtos"),
      ]);

      const maquinasDaLoja = maquinasRes.data.filter(
        (m) => m.lojaId === lojaSelecionada
      );

      // Filtrar movimentações por máquinas da loja e período
      const maquinaIds = maquinasDaLoja.map((m) => m.id);
      const movFiltradas = movimentacoesRes.data.filter((mov) => {
        const movData = new Date(mov.createdAt);
        const inicio = new Date(dataInicio);
        const fim = new Date(dataFim + "T23:59:59");
        return (
          maquinaIds.includes(mov.maquinaId) &&
          movData >= inicio &&
          movData <= fim
        );
      });

      processarDados(maquinasDaLoja, movFiltradas, produtosRes.data);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }, [lojaSelecionada, dataInicio, dataFim]);

  useEffect(() => {
    if (lojaSelecionada && dataInicio && dataFim) {
      carregarDados();
    }
  }, [lojaSelecionada, dataInicio, dataFim, carregarDados]);

  const carregarLojas = async () => {
    try {
      setLoading(true);
      const lojasRes = await api.get("/lojas");
      setLojas(lojasRes.data || []);
    } catch (error) {
      console.error("Erro ao carregar lojas:", error);
    } finally {
      setLoading(false);
    }
  };

  const processarDados = (maquinasLista, movimentacoesLista, produtosLista) => {
    // Processar dados por máquina
    const dadosPorMaquina = maquinasLista.map((maquina) => {
      const movsMaquina = movimentacoesLista.filter(
        (mov) => mov.maquinaId === maquina.id
      );

      const totalSaidas = movsMaquina.reduce(
        (sum, mov) => sum + (mov.sairam || 0),
        0
      );
      const totalEntradas = movsMaquina.reduce(
        (sum, mov) => sum + (mov.abastecidas || 0),
        0
      );
      const totalFichas = movsMaquina.reduce(
        (sum, mov) => sum + (mov.fichas || 0),
        0
      );
      const faturamento = totalFichas * (parseFloat(maquina.valorFicha) || 0);

      // Calcular estoque atual baseado nas movimentações
      const ultimaMov =
        movsMaquina.length > 0
          ? movsMaquina.sort(
              (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
            )[0]
          : null;

      const estoqueAtual = ultimaMov
        ? (ultimaMov.totalPre || 0) +
          (ultimaMov.abastecidas || 0) -
          (ultimaMov.sairam || 0)
        : maquina.estoqueAtual || 0;

      // --- CORREÇÃO AQUI: O código continua dentro do map ---

      // Produtos que passaram pela máquina no período
      const produtosPassaram = {};
      movsMaquina.forEach((mov) => {
        const detalhes = mov.detalhesProdutos || mov.produtos;
        if (detalhes && Array.isArray(detalhes)) {
          detalhes.forEach((detalhe) => {
            const produtoId = detalhe.produtoId;
            if (produtoId) produtosPassaram[produtoId] = true;
          });
        }
      });

      const produtosDaMaquina = Object.keys(produtosPassaram)
        .map((id) => produtosLista.find((p) => p.id === id))
        .filter(Boolean);

      // Agora sim retornamos o objeto completo
      return {
        id: maquina.id,
        nome: maquina.nome,
        codigo: maquina.codigo,
        totalSaidas,
        totalEntradas,
        totalFichas,
        faturamento,
        estoqueAtual,
        capacidade: maquina.capacidadePadrao || 0,
        numeroMovimentacoes: movsMaquina.length,
        produtosPassaram: produtosDaMaquina,
      };
    }); // Fim do map

    // Vendas por produto (quantidade total que saiu de cada produto)
    const vendasPorProduto = {};
    movimentacoesLista.forEach((mov) => {
      const detalhes = mov.detalhesProdutos || mov.produtos;
      if (detalhes && Array.isArray(detalhes)) {
        detalhes.forEach((detalhe) => {
          const produtoId = detalhe.produtoId;
          const quantidadeSaiu =
            detalhe.quantidadeSaiu || detalhe.quantidadeSaida || 0;
          if (!vendasPorProduto[produtoId]) {
            vendasPorProduto[produtoId] = {
              quantidade: 0,
              produto: produtosLista.find((p) => p.id === produtoId) || {
                nome: "Produto Desconhecido",
                emoji: "🧸",
              },
            };
          }
          vendasPorProduto[produtoId].quantidade += quantidadeSaiu;
        });
      }
    });

    // Criar array de produtos vendidos (com nome, emoji, quantidade)
    const produtosVendidos = Object.entries(vendasPorProduto)
      .map(([produtoId, obj]) => ({
        produtoId,
        nome: obj.produto.nome,
        emoji: obj.produto.emoji || "🧸",
        quantidade: obj.quantidade,
      }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);

    // Dados totais
    const totais = {
      totalSaidas: dadosPorMaquina.reduce((sum, m) => sum + m.totalSaidas, 0),
      totalEntradas: dadosPorMaquina.reduce(
        (sum, m) => sum + m.totalEntradas,
        0
      ),
      totalFichas: dadosPorMaquina.reduce((sum, m) => sum + m.totalFichas, 0),
      faturamentoTotal: dadosPorMaquina.reduce(
        (sum, m) => sum + m.faturamento,
        0
      ),
      numeroMaquinas: maquinasLista.length,
      numeroMovimentacoes: movimentacoesLista.length,
    };

    // Movimentações por dia
    const movimentacoesPorDia = {};
    movimentacoesLista.forEach((mov) => {
      const dia = new Date(mov.createdAt).toLocaleDateString("pt-BR");
      if (!movimentacoesPorDia[dia]) {
        movimentacoesPorDia[dia] = {
          saidas: 0,
          entradas: 0,
          fichas: 0,
        };
      }
      movimentacoesPorDia[dia].saidas += mov.sairam || 0;
      movimentacoesPorDia[dia].entradas += mov.abastecidas || 0;
      movimentacoesPorDia[dia].fichas += mov.fichas || 0;
    });

    setDadosProcessados({
      porMaquina: dadosPorMaquina,
      totais,
      porDia: movimentacoesPorDia,
      porProduto: produtosVendidos,
    });
  };

  if (loading && lojas.length === 0) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="📊 Gráficos e Relatórios"
          subtitle="Visualize o desempenho das máquinas"
          icon="📈"
        />

        {/* Filtros */}
        <div className="card mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🏪 Loja
              </label>
              <select
                value={lojaSelecionada}
                onChange={(e) => setLojaSelecionada(e.target.value)}
                className="input-field w-full"
              >
                <option value="">Selecione uma loja</option>
                {lojas.map((loja) => (
                  <option key={loja.id} value={loja.id}>
                    {loja.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Data Inicial
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Data Final
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="input-field w-full"
              />
            </div>
          </div>
        </div>

        {loading && lojaSelecionada ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-gray-600 mt-4">Carregando dados...</p>
          </div>
        ) : !lojaSelecionada || !dataInicio || !dataFim ? (
          <div className="text-center py-12 card">
            <p className="text-6xl mb-4">📊</p>
            <p className="text-gray-600 text-lg">
              Selecione uma loja e o período para visualizar os gráficos
            </p>
          </div>
        ) : dadosProcessados ? (
          <div className="space-y-6">
            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
                <div className="text-3xl mb-2">💰</div>
                <div className="text-2xl font-bold">
                  R$ {dadosProcessados.totais.faturamentoTotal.toFixed(2)}
                </div>
                <div className="text-sm opacity-90">Faturamento Total</div>
              </div>

              <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
                <div className="text-3xl mb-2">📤</div>
                <div className="text-2xl font-bold">
                  {dadosProcessados.totais.totalSaidas}
                </div>
                <div className="text-sm opacity-90">Produtos Vendidos</div>
              </div>

              <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <div className="text-3xl mb-2">🎫</div>
                <div className="text-2xl font-bold">
                  {dadosProcessados.totais.totalFichas}
                </div>
                <div className="text-sm opacity-90">Total de Fichas</div>
              </div>

              <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                <div className="text-3xl mb-2">🔄</div>
                <div className="text-2xl font-bold">
                  {dadosProcessados.totais.numeroMovimentacoes}
                </div>
                <div className="text-sm opacity-90">Movimentações</div>
              </div>
            </div>

            {/* Gráfico de Barras - Saídas por Máquina */}
            <div className="card">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">📊</span>
                Produtos Vendidos por Máquina
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={dadosProcessados.porMaquina}
                  margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="nome"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="totalSaidas"
                    fill="#ef4444"
                    name="Produtos Vendidos"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico de Barras - Faturamento por Máquina */}
            <div className="card">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">💰</span>
                Faturamento por Máquina
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={dadosProcessados.porMaquina}
                  margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="nome"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis />
                  <Tooltip formatter={(value) => `R$ ${value.toFixed(2)}`} />
                  <Legend />
                  <Bar
                    dataKey="faturamento"
                    fill="#22c55e"
                    name="Faturamento (R$)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico de Pizza - Distribuição de Vendas */}
            <div className="card">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">🥧</span>
                Distribuição de Vendas por Máquina
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={dadosProcessados.porMaquina}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ nome, totalSaidas, percent }) =>
                      `${nome}: ${totalSaidas} (${(percent * 100).toFixed(0)}%)`
                    }
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="totalSaidas"
                  >
                    {dadosProcessados.porMaquina.map((entry, index) => {
                      const COLORS = [
                        "#ef4444",
                        "#f59e0b",
                        "#22c55e",
                        "#3b82f6",
                        "#a855f7",
                        "#ec4899",
                        "#14b8a6",
                        "#f97316",
                      ];
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          name={`${entry.nome}: ${entry.totalSaidas} (${(
                            (entry.totalSaidas /
                              dadosProcessados.totais.totalSaidas || 1) * 100
                          ).toFixed(0)}%)`}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico de Produtos Mais Vendidos */}
            <div className="card">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">🧸</span>
                Top 10 Produtos Mais Vendidos na Loja
              </h3>
              {dadosProcessados.porProduto &&
              dadosProcessados.porProduto.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={dadosProcessados.porProduto}
                    margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="nome"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="quantidade"
                      fill="#a855f7"
                      name="Quantidade Vendida"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12">
                  <p className="text-6xl mb-4">📭</p>
                  <p className="text-gray-600">
                    Nenhum produto vendido no período selecionado
                  </p>
                </div>
              )}
            </div>

            {/* Gráfico de Pizza - Top 5 Produtos */}
            {dadosProcessados.porProduto &&
              dadosProcessados.porProduto.length > 0 && (
                <div className="card">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">🎯</span>
                    Top 5 Produtos - Distribuição Percentual
                  </h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <PieChart>
                      <Pie
                        data={dadosProcessados.porProduto.slice(0, 5)}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ nome, quantidade, percent }) =>
                          `${nome}: ${quantidade} (${(percent * 100).toFixed(
                            1
                          )}%)`
                        }
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="quantidade"
                      >
                        {dadosProcessados.porProduto
                          .slice(0, 5)
                          .map((entry, index) => {
                            const COLORS = [
                              "#ef4444",
                              "#f59e0b",
                              "#22c55e",
                              "#3b82f6",
                              "#a855f7",
                            ];
                            return (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            );
                          })}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

            {/* Gráfico de Barras - Ocupação */}
            <div className="card">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">📦</span>
                Ocupação das Máquinas
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={dadosProcessados.porMaquina.map((m) => ({
                    ...m,
                    ocupacao:
                      m.capacidade > 0
                        ? ((m.estoqueAtual / m.capacidade) * 100).toFixed(1)
                        : 0,
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="nome"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Legend />
                  <Bar dataKey="ocupacao" fill="#8b5cf6" name="Ocupação (%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico Linha do Tempo - Movimentações por Dia */}
            <div className="card">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">📈</span>
                Movimentações ao Longo do Período
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={Object.entries(dadosProcessados.porDia)
                    .sort((a, b) => {
                      const dateA = a[0].split("/").reverse().join("-");
                      const dateB = b[0].split("/").reverse().join("-");
                      return dateA.localeCompare(dateB);
                    })
                    .map(([dia, dados]) => ({
                      dia,
                      saidas: dados.saidas,
                      entradas: dados.entradas,
                      fichas: dados.fichas,
                    }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="saidas"
                    stroke="#ef4444"
                    strokeWidth={2}
                    name="Saídas"
                  />
                  <Line
                    type="monotone"
                    dataKey="entradas"
                    stroke="#22c55e"
                    strokeWidth={2}
                    name="Entradas"
                  />
                  <Line
                    type="monotone"
                    dataKey="fichas"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Fichas"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Tabela Detalhada */}
            <div className="card">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">📋</span>
                Resumo Detalhado por Máquina
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Máquina
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Vendidos
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Abastecidos
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Fichas
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Faturamento
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Total da Máquina
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Ocupação
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Produtos
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dadosProcessados.porMaquina.map((maquina) => {
                      const ocupacao =
                        maquina.capacidade > 0
                          ? (maquina.estoqueAtual / maquina.capacidade) * 100
                          : 0;

                      return (
                        <tr key={maquina.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {maquina.nome}
                            </div>
                            <div className="text-sm text-gray-500">
                              {maquina.codigo}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600 font-semibold">
                            {maquina.totalSaidas}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600 font-semibold">
                            {maquina.totalEntradas}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-600 font-semibold">
                            {maquina.totalFichas}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                            R$ {maquina.faturamento.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {maquina.estoqueAtual} / {maquina.capacidade}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                ocupacao < 30
                                  ? "bg-red-100 text-red-800"
                                  : ocupacao < 60
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-green-100 text-green-800"
                              }`}
                            >
                              {ocupacao.toFixed(0)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {maquina.produtosPassaram &&
                            maquina.produtosPassaram.length > 0 ? (
                              maquina.produtosPassaram.map((prod) => (
                                <span
                                  key={prod.id}
                                  className="inline-block mr-2"
                                >
                                  {prod.emoji || "🧸"} {prod.nome}
                                </span>
                              ))
                            ) : (
                              <span className="text-gray-400">Nenhum</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <Footer />
    </div>
  );
}
