import { useState } from "react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { AlertBox } from "../components/UIComponents";
import { LoadingSpinner } from "../components/Loading";
import api from "../services/api";

const CAMPOS_PRODUTO = [
  { chave: "qtd1pol", label: "1pol" },
  { chave: "qtd2pol", label: "2pol" },
  { chave: "qtd27mm", label: "27mm" },
  { chave: "qtd32mm", label: "32mm" },
  { chave: "qtd45mm", label: "45mm" },
  { chave: "caps1pol", label: "Cap 1" },
  { chave: "caps2pol", label: "Cap 2" },
  { chave: "squareGlobinho", label: "Square/Globinho" },
  { chave: "gvTodas", label: "GV Todas" },
  { chave: "pedestalX", label: "Pedestal X" },
  { chave: "hack", label: "Hack" },
  { chave: "cuba", label: "Cuba" },
  { chave: "pelucia", label: "Pelúcia" },
  { chave: "chiclete", label: "Chiclete" },
  { chave: "pedestalRedondo", label: "Pedestal Redondo" },
];

const quantidadesVazias = () =>
  CAMPOS_PRODUTO.reduce((acc, { chave }) => ({ ...acc, [chave]: "" }), {});

const novoProdutoPersonalizado = () => ({
  nome: "",
  quantidade: "",
  pesoUnitario: "",
  altura: "",
  largura: "",
  comprimento: "",
});

const formatarMoeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export function CalculadoraPedidos() {
  const [quantidades, setQuantidades] = useState(quantidadesVazias());
  const [produtosPersonalizados, setProdutosPersonalizados] = useState([]);

  const [calculando, setCalculando] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState(null);
  const [analiseIA, setAnaliseIA] = useState(null);

  const handleQuantidadeChange = (chave, valor) => {
    setQuantidades((atual) => ({ ...atual, [chave]: valor }));
  };

  const handleAdicionarProduto = () => {
    setProdutosPersonalizados((atual) => [...atual, novoProdutoPersonalizado()]);
  };

  const handleRemoverProduto = (index) => {
    setProdutosPersonalizados((atual) => atual.filter((_, i) => i !== index));
  };

  const handleProdutoChange = (index, campo, valor) => {
    setProdutosPersonalizados((atual) =>
      atual.map((item, i) => (i === index ? { ...item, [campo]: valor } : item)),
    );
  };

  const handleCalcular = async (e) => {
    e.preventDefault();
    setErro("");
    setResultado(null);
    setAnaliseIA(null);
    setCalculando(true);

    try {
      const response = await api.post("/calculadora-pedidos/calcular", {
        quantidades,
        produtosPersonalizados,
      });
      setResultado(response.data);
    } catch (err) {
      setErro(
        err.response?.data?.error || "Não foi possível calcular o pedido.",
      );
    } finally {
      setCalculando(false);
    }
  };

  const handleAnalisarIA = async () => {
    if (!resultado) return;
    setErro("");
    setAnalisando(true);

    try {
      const response = await api.post("/calculadora-pedidos/analisar-ia", {
        quantidades: resultado.quantidades,
        produtosPersonalizados: resultado.produtosPersonalizados,
        caixaLegado: resultado.caixaLegado,
        pesoTotal: resultado.pesoTotal,
      });
      setAnaliseIA(response.data);
    } catch (err) {
      setErro(
        err.response?.data?.error ||
          "Não foi possível analisar as caixas com a IA.",
      );
    } finally {
      setAnalisando(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <span className="text-5xl">📦</span>
            <span className="text-gradient">Calculadora de Pedidos</span>
          </h1>
          <p className="text-gray-600 text-lg">
            Calcule valor de nota, peso e a caixa ideal para o pedido. Use a
            análise da IA para produtos fora do catálogo ou quando nenhuma
            regra conhecida se encaixar.
          </p>
        </div>

        {erro && (
          <div className="mb-6">
            <AlertBox type="error" message={erro} onClose={() => setErro("")} />
          </div>
        )}

        <form onSubmit={handleCalcular} className="card mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Itens do catálogo
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {CAMPOS_PRODUTO.map(({ chave, label }) => (
              <div key={chave}>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  {label}
                </label>
                <input
                  type="number"
                  min="0"
                  value={quantidades[chave]}
                  onChange={(e) => handleQuantidadeChange(chave, e.target.value)}
                  className="input-field"
                  placeholder="0"
                />
              </div>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                Produtos personalizados (fora do catálogo)
              </h2>
              <button
                type="button"
                onClick={handleAdicionarProduto}
                className="btn-secondary text-sm"
              >
                + Adicionar produto
              </button>
            </div>

            {produtosPersonalizados.length === 0 && (
              <p className="text-sm text-gray-400">
                Nenhum produto personalizado adicionado.
              </p>
            )}

            <div className="space-y-4">
              {produtosPersonalizados.map((produto, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end bg-gray-50 rounded-xl p-4"
                >
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Nome do produto
                    </label>
                    <input
                      type="text"
                      value={produto.nome}
                      onChange={(e) =>
                        handleProdutoChange(index, "nome", e.target.value)
                      }
                      className="input-field"
                      placeholder="Ex: Urso 25cm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Quantidade
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={produto.quantidade}
                      onChange={(e) =>
                        handleProdutoChange(index, "quantidade", e.target.value)
                      }
                      className="input-field"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Peso un. (kg)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={produto.pesoUnitario}
                      onChange={(e) =>
                        handleProdutoChange(index, "pesoUnitario", e.target.value)
                      }
                      className="input-field"
                      placeholder="opcional"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      A x L x C (cm)
                    </label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        min="0"
                        value={produto.altura}
                        onChange={(e) =>
                          handleProdutoChange(index, "altura", e.target.value)
                        }
                        className="input-field px-2"
                        placeholder="A"
                      />
                      <input
                        type="number"
                        min="0"
                        value={produto.largura}
                        onChange={(e) =>
                          handleProdutoChange(index, "largura", e.target.value)
                        }
                        className="input-field px-2"
                        placeholder="L"
                      />
                      <input
                        type="number"
                        min="0"
                        value={produto.comprimento}
                        onChange={(e) =>
                          handleProdutoChange(
                            index,
                            "comprimento",
                            e.target.value,
                          )
                        }
                        className="input-field px-2"
                        placeholder="C"
                      />
                    </div>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => handleRemoverProduto(index)}
                      className="btn-danger w-full text-sm"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <button type="submit" className="btn-primary" disabled={calculando}>
              {calculando ? "Calculando..." : "🧮 Calcular pedido"}
            </button>
          </div>
        </form>

        {calculando && (
          <div className="card flex justify-center py-10">
            <LoadingSpinner message="Calculando pedido..." />
          </div>
        )}

        {resultado && !calculando && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="stat-card bg-gradient-to-br from-primary to-accent-yellow">
                <p className="text-sm opacity-90 mb-1">Valor da nota</p>
                <p className="text-2xl font-bold">
                  {formatarMoeda(resultado.nfTotal)}
                </p>
              </div>
              <div className="stat-card bg-gradient-to-br from-slate-600 to-slate-800">
                <p className="text-sm opacity-90 mb-1">Peso total</p>
                <p className="text-2xl font-bold">
                  {resultado.pesoTotal.toFixed(2)} kg
                </p>
              </div>
              <div className="stat-card bg-gradient-to-br from-emerald-500 to-emerald-700">
                <p className="text-sm opacity-90 mb-1">Caixa sugerida</p>
                <p className="text-xl font-bold">{resultado.caixaLegado}</p>
              </div>
            </div>

            {resultado.precisaAnaliseIA && !analiseIA && (
              <div className="card-gradient flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-800">
                    Essa combinação não bate 100% com as regras conhecidas ou
                    tem produtos fora do catálogo.
                  </p>
                  <p className="text-sm text-gray-600">
                    A IA pode analisar as dimensões e sugerir a melhor caixa.
                  </p>
                </div>
                <button
                  onClick={handleAnalisarIA}
                  className="btn-primary whitespace-nowrap"
                  disabled={analisando}
                >
                  {analisando ? "Analisando..." : "🤖 Analisar com IA"}
                </button>
              </div>
            )}

            {analisando && (
              <div className="card flex justify-center py-10">
                <LoadingSpinner message="IA analisando as melhores caixas..." />
              </div>
            )}

            {analiseIA && !analisando && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  🤖 Sugestão da IA
                </h2>
                {analiseIA.resumo && (
                  <div className="card-gradient">
                    <p className="text-gray-800">{analiseIA.resumo}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {(analiseIA.caixasSugeridas || []).map((caixa, index) => (
                    <div key={index} className="card">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold text-gray-900">
                          📐 {caixa.dimensoes}
                        </h3>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            caixa.tipo === "padrao"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {caixa.tipo === "padrao"
                            ? "Caixa padrão"
                            : "Caixa nova"}
                        </span>
                      </div>
                      {caixa.itensAlocados && (
                        <p className="text-sm text-gray-700 mb-2">
                          {caixa.itensAlocados}
                        </p>
                      )}
                      {caixa.justificativa && (
                        <p className="text-sm text-gray-500 border-t border-gray-100 pt-2">
                          {caixa.justificativa}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
