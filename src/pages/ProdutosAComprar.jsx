import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  if (typeof data?.message === "string" && data.message.trim())
    return data.message;
  if (typeof data?.error === "string" && data.error.trim()) return data.error;
  return fallback;
};

const normalizeIdentifier = (value) =>
  normalizeText(value).replace(/\s+/g, " ");

const getProductKey = (produto, fallback = "") => {
  const codigoKey = normalizeIdentifier(produto?.codigo);
  if (codigoKey) return codigoKey;
  const nomeKey = normalizeIdentifier(produto?.nome);
  if (nomeKey) return nomeKey;
  const id = produto?.id ?? produto?.produtoId ?? produto?.idProduto;
  if (id !== undefined && id !== null && String(id).trim()) return `id-${id}`;
  return `fallback-${fallback}`;
};

// Tenta associar um produto do estoque a uma entrada no mapa de déficit (por código ou nome)
const takeCapacityForProduct = (capacidadePorProduto, produto, fallback) => {
  const primaryKey = getProductKey(produto, fallback);
  const primaryValue = capacidadePorProduto.get(primaryKey);
  if (primaryValue) {
    capacidadePorProduto.delete(primaryKey);
    return toNumber(primaryValue.faltaCapacidade);
  }
  const codigo = normalizeIdentifier(produto?.codigo);
  const nome = normalizeIdentifier(produto?.nome);
  for (const [key, value] of capacidadePorProduto.entries()) {
    const nomeMap = normalizeIdentifier(value?.produto?.nome);
    const codigoMap = normalizeIdentifier(value?.produto?.codigo);
    const codigoMatch =
      !!codigo && (codigo === codigoMap || codigo === nomeMap);
    const nomeMatch = !!nome && (nome === nomeMap || nome === codigoMap);
    if (codigoMatch || nomeMatch) {
      capacidadePorProduto.delete(key);
      return toNumber(value?.faltaCapacidade);
    }
  }
  return 0;
};

export function ProdutosAComprar() {
  const [lojas, setLojas] = useState([]);
  const [lojasSelecionadas, setLojasSelecionadas] = useState(new Set());
  const [estoquePorLoja, setEstoquePorLoja] = useState(new Map());
  const [carregandoLoja, setCarregandoLoja] = useState(new Set());
  // Map<lojaId, Map<productKey, {produto, faltaCapacidade}>>
  const [deficitPorLoja, setDeficitPorLoja] = useState(new Map());
  const [quantidadesLevar, setQuantidadesLevar] = useState({});
  const [produtos, setProdutos] = useState([]);
  const [loadingInicial, setLoadingInicial] = useState(true);
  const [erro, setErro] = useState("");

  const printRef = useRef(null);

  // ── cálculo de produtos por loja ─────────────────────────────────────────
  const listaPorLoja = useMemo(() => {
    return Array.from(lojasSelecionadas)
      .map((lojaId) => {
        const loja = lojas.find((l) => String(l.id) === String(lojaId));
        if (!loja) return null;
        const estoque = estoquePorLoja.get(String(lojaId)) || [];
        // Cópia rasa para que takeCapacityForProduct possa deletar chaves sem mutar o estado
        const capacidadePorProduto = new Map(
          deficitPorLoja.get(String(lojaId)) || new Map(),
        );
        const produtosMap = new Map();

        estoque.forEach((item, index) => {
          const produto = item?.produto || {};
          const key = getProductKey(produto, `estoque-${index}`);
          const quantidadeAtual = Math.max(0, toNumber(item?.quantidade));
          const estoqueMinimo = Math.max(0, toNumber(item?.estoqueMinimo));
          const faltaMinimo = Math.max(0, estoqueMinimo - quantidadeAtual);
          const faltaCapacidade = takeCapacityForProduct(
            capacidadePorProduto,
            produto,
            `estoque-${index}`,
          );
          const quantidadeComprar = faltaMinimo + faltaCapacidade;
          const levarKey = `${lojaId}:${key}`;
          const quantidadeLevar = Math.max(
            0,
            toNumber(quantidadesLevar[levarKey] ?? quantidadeComprar),
          );
          produtosMap.set(key, {
            key,
            produto,
            quantidadeAtual,
            estoqueMinimo,
            faltaMinimo,
            faltaCapacidade,
            quantidadeComprar,
            quantidadeLevar,
          });
        });

        // Produtos com déficit de capacidade mas não listados no estoque mínimo
        capacidadePorProduto.forEach((value, key) => {
          const quantidadeComprar = Math.max(
            0,
            toNumber(value?.faltaCapacidade),
          );
          produtosMap.set(key, {
            key,
            produto: value?.produto || {
              nome: "Produto sem nome",
              emoji: "📦",
            },
            quantidadeAtual: 0,
            estoqueMinimo: 0,
            faltaMinimo: 0,
            faltaCapacidade: quantidadeComprar,
            quantidadeComprar,
            quantidadeLevar: Math.max(
              0,
              toNumber(
                quantidadesLevar[`${lojaId}:${key}`] ?? quantidadeComprar,
              ),
            ),
          });
        });

        const ps = Array.from(produtosMap.values())
          .filter((p) => p.quantidadeComprar > 0)
          .sort((a, b) => b.quantidadeComprar - a.quantidadeComprar);
        return { loja, produtos: ps };
      })
      .filter(Boolean);
  }, [
    lojasSelecionadas,
    estoquePorLoja,
    deficitPorLoja,
    lojas,
    quantidadesLevar,
  ]);

  const totalGeral = useMemo(
    () =>
      listaPorLoja.reduce(
        (acc, { produtos: ps }) =>
          acc + ps.reduce((s, p) => s + p.quantidadeLevar, 0),
        0,
      ),
    [listaPorLoja],
  );

  const handleQuantidadeLevarChange = useCallback((lojaId, itemKey, value) => {
    const parsedValue = value === "" ? "" : Math.max(0, toNumber(value));
    setQuantidadesLevar((prev) => ({
      ...prev,
      [`${lojaId}:${itemKey}`]: parsedValue,
    }));
  }, []);

  // ── buscar estoque + déficit de capacidade de uma loja ───────────────────
  const fetchEstoqueLoja = useCallback(
    async (lojaId) => {
      const key = String(lojaId);
      if (estoquePorLoja.has(key) || carregandoLoja.has(key)) return;
      setCarregandoLoja((prev) => new Set(prev).add(key));
      try {
        const [estoqueRes, maquinasRes] = await Promise.all([
          api.get(`/estoque-lojas/${lojaId}`),
          api.get(`/maquinas`),
        ]);

        setEstoquePorLoja((prev) => {
          const next = new Map(prev);
          next.set(key, Array.isArray(estoqueRes.data) ? estoqueRes.data : []);
          return next;
        });

        const maquinasDaLoja = (maquinasRes.data || []).filter(
          (m) => String(m.lojaId) === key,
        );

        const deficitMap = new Map();
        await Promise.all(
          maquinasDaLoja.map(async (maquina) => {
            try {
              const [estoqRes, movRes] = await Promise.all([
                api.get(`/maquinas/${maquina.id}/estoque`),
                api.get(`/movimentacoes?maquinaId=${maquina.id}`),
              ]);
              const estoqueAtual = estoqRes.data.estoqueAtual ?? 0;
              const capacidade = maquina.capacidadePadrao || 0;
              const deficit = Math.max(0, capacidade - estoqueAtual);
              if (deficit <= 0) return;

              // Produto da última movimentação
              const movs = (movRes.data || []).sort(
                (a, b) =>
                  new Date(b.dataColeta || b.createdAt) -
                  new Date(a.dataColeta || a.createdAt),
              );
              let produto = null;
              if (movs.length > 0) {
                const produtoId = movs[0].detalhesProdutos?.[0]?.produtoId;
                if (produtoId) {
                  const found = produtos.find((p) => p.id === produtoId);
                  if (found) {
                    produto = {
                      id: found.id,
                      codigo: found.codigo || "",
                      nome: found.nome || "Produto sem nome",
                      emoji: found.emoji || "📦",
                    };
                  }
                }
              }
              // Fallback: tipo da máquina
              if (!produto) {
                produto = {
                  nome: maquina.tipo || `Máquina ${maquina.codigo}`,
                  codigo: maquina.codigo || "",
                  emoji: "📦",
                };
              }

              const pKey = getProductKey(produto, `maq-${maquina.id}`);
              const existing = deficitMap.get(pKey) || {
                produto,
                faltaCapacidade: 0,
              };
              existing.faltaCapacidade += deficit;
              deficitMap.set(pKey, existing);
            } catch {
              // ignora falha individual de máquina
            }
          }),
        );

        setDeficitPorLoja((prev) => {
          const next = new Map(prev);
          next.set(key, deficitMap);
          return next;
        });
      } catch (err) {
        console.error("Erro ao carregar estoque da loja:", err);
        setEstoquePorLoja((prev) => {
          const next = new Map(prev);
          next.set(key, []);
          return next;
        });
        setDeficitPorLoja((prev) => {
          const next = new Map(prev);
          next.set(key, new Map());
          return next;
        });
      } finally {
        setCarregandoLoja((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [estoquePorLoja, carregandoLoja, produtos],
  );

  const toggleLoja = useCallback(
    (lojaId) => {
      const key = String(lojaId);
      setLojasSelecionadas((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
          fetchEstoqueLoja(key);
        }
        return next;
      });
    },
    [fetchEstoqueLoja],
  );

  // ── carga inicial ────────────────────────────────────────────────────────
  useEffect(() => {
    const carregar = async () => {
      try {
        setLoadingInicial(true);
        setErro("");
        const [lojasRes, produtosRes] = await Promise.all([
          api.get("/lojas"),
          api.get("/produtos"),
        ]);
        setLojas(Array.isArray(lojasRes.data) ? lojasRes.data : []);
        setProdutos(Array.isArray(produtosRes.data) ? produtosRes.data : []);
      } catch (err) {
        setErro(getApiErrorMessage(err, "Erro ao carregar lojas."));
      } finally {
        setLoadingInicial(false);
      }
    };
    carregar();
  }, []);

  const handlePrint = () => window.print();

  if (loadingInicial) return <PageLoader />;

  const algumCarregando = carregandoLoja.size > 0;

  return (
    <>
      <style>{`
				@media print {
					.no-print { display: none !important; }
					.print-only { display: block !important; }
					body { background: white !important; }
					.print-area { padding: 0 !important; margin: 0 !important; }
					.print-store-section { page-break-after: always; }
					.print-store-section:last-child { page-break-after: avoid; }
				}
				@media screen { .print-only { display: none !important; } }
			`}</style>

      <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
        <div className="no-print">
          <Navbar />
        </div>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print-area">
          <div className="no-print">
            <PageHeader
              title="Produtos a Comprar"
              subtitle="Selecione as lojas e imprima a lista de reposição"
              icon="🛒"
            />

            {erro && (
              <div className="mb-6 p-4 rounded-xl border border-red-300 bg-red-50 text-red-800 font-medium">
                {erro}
              </div>
            )}

            {/* ── Seleção de lojas ── */}
            <section className="card mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">
                  Selecione as lojas
                </h2>
                {lojasSelecionadas.size > 0 && (
                  <button
                    onClick={() => setLojasSelecionadas(new Set())}
                    className="text-sm text-gray-500 hover:text-red-600 transition-colors"
                  >
                    Limpar seleção
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {lojas.map((loja) => {
                  const selecionada = lojasSelecionadas.has(String(loja.id));
                  const carregando = carregandoLoja.has(String(loja.id));
                  return (
                    <label
                      key={loja.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all select-none ${selecionada ? "bg-primary/10 border-primary shadow-sm" : "bg-white border-gray-200 hover:border-gray-300"}`}
                    >
                      <input
                        type="checkbox"
                        className="w-5 h-5 accent-primary"
                        checked={selecionada}
                        onChange={() => toggleLoja(loja.id)}
                      />
                      <span className="font-medium text-gray-900 flex-1">
                        {loja.nome}
                      </span>
                      {carregando && (
                        <span className="text-xs text-gray-400 animate-pulse">
                          Carregando...
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </section>

            {lojasSelecionadas.size === 0 && (
              <section className="card text-center py-14">
                <div className="text-5xl mb-3">🏪</div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  Escolha ao menos uma loja
                </h2>
                <p className="text-gray-600">
                  A lista de reposição será calculada automaticamente.
                </p>
              </section>
            )}

            {lojasSelecionadas.size > 0 && !algumCarregando && (
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex flex-wrap gap-3">
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-center">
                    <p className="text-xs text-red-600 font-medium">Lojas</p>
                    <p className="text-2xl font-bold text-red-700">
                      {listaPorLoja.length}
                    </p>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2 text-center">
                    <p className="text-xs text-orange-600 font-medium">
                      Total a levar
                    </p>
                    <p className="text-2xl font-bold text-orange-700">
                      {totalGeral}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handlePrint}
                  className="btn-primary flex items-center gap-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                    />
                  </svg>
                  Imprimir lista
                </button>
              </div>
            )}

            {algumCarregando && lojasSelecionadas.size > 0 && (
              <div className="card text-center py-10 mb-6">
                <div className="text-4xl mb-3 animate-pulse">📦</div>
                <p className="text-gray-600">Carregando estoque das lojas...</p>
              </div>
            )}
          </div>

          {/* ── Lista por loja (tela) ── */}
          {!algumCarregando &&
            listaPorLoja.map(({ loja, produtos: ps }) => (
              <section key={loja.id} className="card mb-6 no-print">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-2xl font-bold text-gray-900">
                    🏪 {loja.nome}
                  </h2>
                  <span className="badge bg-red-100 text-red-700 border-red-300">
                    {ps.reduce((s, p) => s + p.quantidadeLevar, 0)} unidades
                  </span>
                </div>

                {ps.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-4xl mb-2">✅</p>
                    <p className="text-gray-600 font-medium">
                      Nenhuma compra necessária.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-4 py-3 font-semibold text-gray-700">
                            Produto
                          </th>
                          <th className="text-center px-4 py-3 font-semibold text-gray-700">
                            Atual
                          </th>
                          <th className="text-center px-4 py-3 font-semibold text-gray-700">
                            Mín.
                          </th>
                          <th className="text-center px-4 py-3 font-semibold text-orange-600">
                            Falta cap.
                          </th>
                          <th className="text-center px-4 py-3 font-semibold text-red-700">
                            Comprar
                          </th>
                          <th className="text-center px-4 py-3 font-semibold text-blue-700">
                            Levar
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {ps.map((item, idx) => (
                          <tr
                            key={item.key}
                            className={
                              idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                            }
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span>{item.produto.emoji || "📦"}</span>
                                <div>
                                  <p className="font-semibold text-gray-900">
                                    {item.produto.nome}
                                  </p>
                                  {item.produto.codigo && (
                                    <p className="text-xs text-gray-400">
                                      Cód: {item.produto.codigo}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700">
                              {item.quantidadeAtual}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700">
                              {item.estoqueMinimo}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-orange-600">
                              {item.faltaCapacidade > 0
                                ? item.faltaCapacidade
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-center font-extrabold text-red-700 text-lg">
                              {item.quantidadeComprar}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min="0"
                                value={item.quantidadeLevar}
                                onChange={(e) =>
                                  handleQuantidadeLevarChange(
                                    loja.id,
                                    item.key,
                                    e.target.value,
                                  )
                                }
                                className="w-24 rounded-lg border border-blue-200 px-3 py-2 text-center font-semibold text-blue-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ))}

          <div ref={printRef} className="print-only">
            {listaPorLoja.map(({ loja, produtos: ps }) => (
              <div key={loja.id} className="print-store-section">
                <div
                  style={{
                    borderBottom: "2px solid #111",
                    paddingBottom: "8px",
                    marginBottom: "12px",
                  }}
                >
                  <h1
                    style={{ fontSize: "20px", fontWeight: "bold", margin: 0 }}
                  >
                    Lista de Compra — {loja.nome}
                  </h1>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#555",
                      margin: "2px 0 0",
                    }}
                  >
                    {new Date().toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </p>
                </div>

                {ps.length === 0 ? (
                  <p style={{ fontStyle: "italic", color: "#666" }}>
                    Nenhuma compra necessária.
                  </p>
                ) : (
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "13px",
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: "1px solid #333" }}>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "6px 8px",
                            fontWeight: "bold",
                          }}
                        >
                          Produto
                        </th>
                        <th
                          style={{
                            textAlign: "center",
                            padding: "6px 8px",
                            fontWeight: "bold",
                            width: "80px",
                          }}
                        >
                          Levar
                        </th>
                        <th
                          style={{
                            textAlign: "center",
                            padding: "6px 8px",
                            fontWeight: "bold",
                            width: "90px",
                          }}
                        >
                          Levou ✓
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ps.map((item, idx) => (
                        <tr
                          key={item.key}
                          style={{
                            borderBottom: "1px solid #ddd",
                            backgroundColor: idx % 2 === 0 ? "#fff" : "#f9f9f9",
                          }}
                        >
                          <td style={{ padding: "7px 8px" }}>
                            <span style={{ marginRight: "6px" }}>
                              {item.produto.emoji || ""}
                            </span>
                            <strong>{item.produto.nome}</strong>
                            {item.produto.codigo && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "#888",
                                  marginLeft: "6px",
                                }}
                              >
                                ({item.produto.codigo})
                              </span>
                            )}
                          </td>
                          <td
                            style={{
                              textAlign: "center",
                              padding: "7px 8px",
                              fontWeight: "bold",
                              fontSize: "15px",
                            }}
                          >
                            {item.quantidadeLevar}
                          </td>
                          <td
                            style={{ textAlign: "center", padding: "7px 8px" }}
                          >
                            <span
                              style={{
                                display: "inline-block",
                                width: "18px",
                                height: "18px",
                                border: "2px solid #333",
                                borderRadius: "3px",
                                verticalAlign: "middle",
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "2px solid #333" }}>
                        <td style={{ padding: "6px 8px", fontWeight: "bold" }}>
                          Total
                        </td>
                        <td
                          style={{
                            textAlign: "center",
                            padding: "6px 8px",
                            fontWeight: "bold",
                            fontSize: "15px",
                          }}
                        >
                          {ps.reduce((s, p) => s + p.quantidadeLevar, 0)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                )}

                <div
                  style={{ marginTop: "32px", display: "flex", gap: "40px" }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{ borderTop: "1px solid #333", paddingTop: "4px" }}
                    >
                      <span style={{ fontSize: "11px", color: "#555" }}>
                        Responsável
                      </span>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{ borderTop: "1px solid #333", paddingTop: "4px" }}
                    >
                      <span style={{ fontSize: "11px", color: "#555" }}>
                        Data de entrega
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>

        <div className="no-print">
          <Footer />
        </div>
      </div>
    </>
  );
}
