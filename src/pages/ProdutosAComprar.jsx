import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";

const toNumber = (value) => Number(value || 0);

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const getApiErrorMessage = (err, fallback) => {
  const data = err?.response?.data;

  if (typeof data === "string" && data.trim()) return data;
  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }
  if (typeof data?.error === "string" && data.error.trim()) {
    return data.error;
  }

  return fallback;
};

const getProductKey = (produto, fallback = "") =>
  String(
    produto?.id ??
      produto?.produtoId ??
      produto?.idProduto ??
      produto?.codigo ??
      produto?.nome ??
      fallback,
  );

const isAlertFromStore = (alerta, lojaSelecionada) => {
  if (!lojaSelecionada) return false;

  const lojaIdSelecionada = String(lojaSelecionada.id || "");
  const lojaNomeSelecionada = normalizeText(lojaSelecionada.nome);

  const alertaLojaId = String(
    alerta?.lojaId ??
      alerta?.maquina?.lojaId ??
      alerta?.maquina?.loja?.id ??
      "",
  );

  if (alertaLojaId && lojaIdSelecionada && alertaLojaId === lojaIdSelecionada) {
    return true;
  }

  const alertaLojaNome = normalizeText(
    alerta?.maquina?.lojaNome ?? alerta?.maquina?.loja ?? alerta?.lojaNome,
  );

  return !!alertaLojaNome && alertaLojaNome === lojaNomeSelecionada;
};

const buildMachineCapacityByProduct = (alertasMaquinas, lojaSelecionada) => {
  const capacidadePorProduto = new Map();

  const alertasDaLoja = (alertasMaquinas || []).filter((alerta) =>
    isAlertFromStore(alerta, lojaSelecionada),
  );

  alertasDaLoja.forEach((alerta, alertaIndex) => {
    const capacidadePadrao = toNumber(alerta?.capacidadePadrao);
    const estoqueAtual = toNumber(alerta?.estoqueAtual);
    const deficitTotal = Math.max(0, capacidadePadrao - estoqueAtual);

    if (deficitTotal <= 0) return;

    const produtosRelacionados = Array.isArray(alerta?.produtos)
      ? alerta.produtos.filter(Boolean)
      : [];

    if (produtosRelacionados.length === 0) return;

    const base = Math.floor(deficitTotal / produtosRelacionados.length);
    const resto = deficitTotal % produtosRelacionados.length;

    produtosRelacionados.forEach((produto, idx) => {
      const parcela = base + (idx < resto ? 1 : 0);
      if (parcela <= 0) return;

      const key = getProductKey(produto, `alerta-${alertaIndex}-${idx}`);
      const acumulado = capacidadePorProduto.get(key) || {
        produto: {
          id: produto?.id ?? produto?.produtoId ?? produto?.idProduto,
          codigo: produto?.codigo || "",
          nome: produto?.nome || "Produto sem nome",
          emoji: produto?.emoji || "📦",
        },
        faltaCapacidade: 0,
      };

      acumulado.faltaCapacidade += parcela;
      capacidadePorProduto.set(key, acumulado);
    });
  });

  return capacidadePorProduto;
};

export function ProdutosAComprar() {
  const [lojas, setLojas] = useState([]);
  const [lojaIdSelecionada, setLojaIdSelecionada] = useState("");
  const [estoqueLoja, setEstoqueLoja] = useState([]);
  const [alertasMaquinas, setAlertasMaquinas] = useState([]);
  const [loadingInicial, setLoadingInicial] = useState(true);
  const [loadingEstoque, setLoadingEstoque] = useState(false);
  const [erro, setErro] = useState("");
  const [avisoAlertas, setAvisoAlertas] = useState("");

  const lojaSelecionada = useMemo(
    () => lojas.find((loja) => String(loja.id) === String(lojaIdSelecionada)),
    [lojas, lojaIdSelecionada],
  );

  const produtosParaComprar = useMemo(() => {
    const capacidadePorProduto = buildMachineCapacityByProduct(
      alertasMaquinas,
      lojaSelecionada,
    );

    const produtosMap = new Map();

    (estoqueLoja || []).forEach((item, index) => {
      const produto = item?.produto || {};
      const key = getProductKey(produto, `estoque-${index}`);
      const quantidadeAtual = Math.max(0, toNumber(item?.quantidade));
      const estoqueMinimo = Math.max(0, toNumber(item?.estoqueMinimo));
      const faltaMinimo = Math.max(0, estoqueMinimo - quantidadeAtual);
      const faltaCapacidade = toNumber(
        capacidadePorProduto.get(key)?.faltaCapacidade,
      );
      const quantidadeComprar = faltaMinimo + faltaCapacidade;

      produtosMap.set(key, {
        key,
        produto,
        quantidadeAtual,
        estoqueMinimo,
        faltaMinimo,
        faltaCapacidade,
        quantidadeComprar,
      });

      capacidadePorProduto.delete(key);
    });

    capacidadePorProduto.forEach((value, key) => {
      const quantidadeComprar = Math.max(0, toNumber(value?.faltaCapacidade));

      produtosMap.set(key, {
        key,
        produto: value?.produto || { nome: "Produto sem nome", emoji: "📦" },
        quantidadeAtual: 0,
        estoqueMinimo: 0,
        faltaMinimo: 0,
        faltaCapacidade: quantidadeComprar,
        quantidadeComprar,
      });
    });

    return Array.from(produtosMap.values())
      .filter((item) => item.quantidadeComprar > 0)
      .sort((a, b) => b.quantidadeComprar - a.quantidadeComprar);
  }, [alertasMaquinas, estoqueLoja, lojaSelecionada]);

  const resumo = useMemo(() => {
    return produtosParaComprar.reduce(
      (acc, item) => {
        acc.totalComprar += item.quantidadeComprar;
        acc.totalFaltaMinimo += item.faltaMinimo;
        acc.totalFaltaCapacidade += item.faltaCapacidade;
        return acc;
      },
      {
        totalComprar: 0,
        totalFaltaMinimo: 0,
        totalFaltaCapacidade: 0,
      },
    );
  }, [produtosParaComprar]);

  useEffect(() => {
    const carregarBase = async () => {
      try {
        setLoadingInicial(true);
        setErro("");
        setAvisoAlertas("");

        const lojasPromise = api.get("/lojas");
        const alertasPromise = api
          .get("/relatorios/alertas-estoque")
          .catch((alertaErr) => {
            console.warn(
              "Não foi possível carregar alertas de máquinas:",
              alertaErr,
            );
            setAvisoAlertas(
              "Não foi possível carregar alertas de máquinas. O cálculo usará apenas o estoque mínimo da loja.",
            );
            return { data: { alertas: [] } };
          });

        const [lojasRes, alertasRes] = await Promise.all([
          lojasPromise,
          alertasPromise,
        ]);

        setLojas(Array.isArray(lojasRes.data) ? lojasRes.data : []);
        setAlertasMaquinas(
          Array.isArray(alertasRes?.data?.alertas)
            ? alertasRes.data.alertas
            : [],
        );
      } catch (err) {
        console.error("Erro ao carregar dados base:", err);
        setErro(getApiErrorMessage(err, "Erro ao carregar lojas."));
      } finally {
        setLoadingInicial(false);
      }
    };

    carregarBase();
  }, []);

  useEffect(() => {
    const carregarEstoqueDaLoja = async () => {
      if (!lojaIdSelecionada) {
        setEstoqueLoja([]);
        return;
      }

      try {
        setLoadingEstoque(true);
        setErro("");

        const estoqueRes = await api.get(`/estoque-lojas/${lojaIdSelecionada}`);
        setEstoqueLoja(Array.isArray(estoqueRes.data) ? estoqueRes.data : []);
      } catch (err) {
        console.error("Erro ao carregar estoque da loja:", err);
        setErro(getApiErrorMessage(err, "Erro ao carregar estoque da loja."));
        setEstoqueLoja([]);
      } finally {
        setLoadingEstoque(false);
      }
    };

    carregarEstoqueDaLoja();
  }, [lojaIdSelecionada]);

  if (loadingInicial) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Produtos a Comprar"
          subtitle="Selecione a loja e veja a quantidade ideal para reposição"
          icon="🛒"
        />

        {erro && (
          <div className="mb-6 p-4 rounded-xl border border-red-300 bg-red-50 text-red-800 font-medium">
            {erro}
          </div>
        )}

        {avisoAlertas && (
          <div className="mb-6 p-4 rounded-xl border border-yellow-300 bg-yellow-50 text-yellow-800 font-medium">
            {avisoAlertas}
          </div>
        )}

        <section className="card mb-6">
          <label
            htmlFor="loja-select"
            className="block text-sm font-semibold text-gray-700 mb-2"
          >
            Loja
          </label>
          <select
            id="loja-select"
            className="input-field"
            value={lojaIdSelecionada}
            onChange={(event) => setLojaIdSelecionada(event.target.value)}
          >
            <option value="">Selecione uma loja</option>
            {lojas.map((loja) => (
              <option key={loja.id} value={loja.id}>
                {loja.nome}
              </option>
            ))}
          </select>
        </section>

        {!lojaIdSelecionada && (
          <section className="card text-center py-14">
            <div className="text-5xl mb-3">🏪</div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              Escolha uma loja
            </h2>
            <p className="text-gray-600">
              Depois de selecionar, a lista de compra será calculada
              automaticamente.
            </p>
          </section>
        )}

        {lojaIdSelecionada && loadingEstoque && (
          <section className="card text-center py-14">
            <div className="text-4xl mb-3 animate-pulse">📦</div>
            <p className="text-gray-600">Carregando estoque da loja...</p>
          </section>
        )}

        {lojaIdSelecionada && !loadingEstoque && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="stat-card bg-linear-to-br from-red-500 to-red-600">
                <p className="text-sm opacity-90">Produtos para comprar</p>
                <p className="text-3xl font-bold">
                  {produtosParaComprar.length}
                </p>
              </div>
              <div className="stat-card bg-linear-to-br from-orange-500 to-orange-600">
                <p className="text-sm opacity-90">Total a comprar</p>
                <p className="text-3xl font-bold">{resumo.totalComprar}</p>
              </div>
              <div className="stat-card bg-linear-to-br from-amber-500 to-amber-600">
                <p className="text-sm opacity-90">Falta para mínimo</p>
                <p className="text-3xl font-bold">{resumo.totalFaltaMinimo}</p>
              </div>
              <div className="stat-card bg-linear-to-br from-rose-500 to-rose-600">
                <p className="text-sm opacity-90">Falta para capacidade</p>
                <p className="text-3xl font-bold">
                  {resumo.totalFaltaCapacidade}
                </p>
              </div>
            </section>

            <section className="card">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Lista de Compra
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Loja:{" "}
                    <span className="font-semibold">
                      {lojaSelecionada?.nome || "-"}
                    </span>
                  </p>
                </div>
                <span className="badge bg-red-100 text-red-700 border-red-300">
                  {resumo.totalComprar} unidades
                </span>
              </div>

              {produtosParaComprar.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-5xl mb-2">✅</p>
                  <p className="text-gray-700 font-semibold">
                    Nenhuma compra necessária no momento.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {produtosParaComprar.map((item) => {
                    const abaixoMinimo = item.faltaMinimo > 0;

                    return (
                      <article
                        key={item.key}
                        className={`rounded-xl border-2 p-4 transition-all hover:shadow-md ${
                          abaixoMinimo
                            ? "bg-red-50 border-red-300"
                            : "bg-orange-50 border-orange-200"
                        }`}
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <span className="text-3xl">
                            {item.produto.emoji || "📦"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-gray-900 truncate">
                                {item.produto.nome || "Produto sem nome"}
                              </h3>
                              {abaixoMinimo && (
                                <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                                  ⚠️
                                </span>
                              )}
                            </div>
                            {item.produto.codigo && (
                              <p className="text-xs text-gray-500 mt-1">
                                Cód: {item.produto.codigo}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm border-t border-red-100 pt-3">
                          <div>
                            <p className="text-gray-500">Quantidade</p>
                            <p className="text-xl font-bold text-gray-900">
                              {item.quantidadeAtual}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-gray-500">Estoque mín.</p>
                            <p className="text-lg font-semibold text-gray-700">
                              {item.estoqueMinimo}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Falta mínimo</p>
                            <p className="text-lg font-semibold text-red-700">
                              {item.faltaMinimo}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-gray-500">Falta capacidade</p>
                            <p className="text-lg font-semibold text-orange-700">
                              {item.faltaCapacidade}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 p-2 rounded-lg bg-white border border-red-200 flex items-center justify-between">
                          <span className="text-sm text-gray-700 font-medium">
                            Comprar
                          </span>
                          <span className="text-2xl font-extrabold text-red-700">
                            {item.quantidadeComprar}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
