const formatarMoeda = (valor) =>
  `R$ ${Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
  })}`;

const formatarPercentual = (valor) => `${Number(valor || 0).toFixed(2)}%`;

const calcularLargura = (valor, maximo) => {
  if (!maximo || maximo <= 0) return "0%";
  const percentual = (Number(valor || 0) / maximo) * 100;
  return `${Math.max(percentual, 4).toFixed(2)}%`;
};

const GraficoBarras = ({
  titulo,
  itens,
  chaveNome,
  chaveValor,
  classeBarra,
  formatter,
  vazio,
}) => {
  const maximo = Math.max(
    ...(itens || []).map((item) => Number(item[chaveValor] || 0)),
    0,
  );

  return (
    <div className="card bg-white border border-gray-200">
      <h4 className="text-lg font-bold text-gray-900 mb-4">{titulo}</h4>
      {!itens || itens.length === 0 ? (
        <p className="text-gray-500">{vazio}</p>
      ) : (
        <div className="space-y-3">
          {itens.map((item) => (
            <div key={`${item[chaveNome]}-${item[chaveValor]}`}>
              <div className="flex items-center justify-between text-sm mb-1 gap-2">
                <span className="font-medium text-gray-800 truncate">
                  {item[chaveNome]}
                </span>
                <span className="font-bold text-gray-900 whitespace-nowrap">
                  {formatter(item[chaveValor])}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className={`${classeBarra} h-3 rounded-full`}
                  style={{ width: calcularLargura(item[chaveValor], maximo) }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export function RelatorioTodasLojas({ relatorio }) {
  const totais = relatorio?.totais || {};
  const destaques = relatorio?.destaques || {};
  const graficos = relatorio?.graficos || {};

  return (
    <div className="space-y-6">
      <div className="card bg-gradient-to-r from-indigo-50 to-blue-100 border-2 border-indigo-200">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          🏬 Consolidado de Todas as Lojas
        </h3>
        <p className="text-gray-700">
          Período: <strong>{relatorio?.periodo?.inicio}</strong> até{" "}
          <strong>{relatorio?.periodo?.fim}</strong>
        </p>
        <p className="text-gray-700 mt-1">
          Lojas com dados: <strong>{relatorio?.lojasComDados || 0}</strong>
        </p>
        {!!relatorio?.lojasSemDados?.length && (
          <p className="text-amber-700 mt-2 text-sm">
            Lojas sem dados no período: {relatorio.lojasSemDados.join(", ")}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-emerald-500 to-green-700 text-white">
          <div className="text-2xl mb-1">💰</div>
          <div className="text-2xl font-bold">
            {formatarMoeda(totais.lucroBrutoTotal)}
          </div>
          <div className="text-sm opacity-90">Lucro Bruto Total</div>
        </div>
        <div className="card bg-gradient-to-br from-blue-600 to-cyan-700 text-white">
          <div className="text-2xl mb-1">📉</div>
          <div className="text-2xl font-bold">
            {formatarMoeda(totais.lucroLiquidoTotal)}
          </div>
          <div className="text-sm opacity-90">Lucro Líquido Total</div>
        </div>
        <div className="card bg-gradient-to-br from-rose-500 to-red-700 text-white">
          <div className="text-2xl mb-1">🧾</div>
          <div className="text-2xl font-bold">
            {formatarMoeda(totais.custoTotal)}
          </div>
          <div className="text-sm opacity-90">Custo Total</div>
        </div>
        <div className="card bg-gradient-to-br from-fuchsia-500 to-purple-700 text-white">
          <div className="text-2xl mb-1">📌</div>
          <div className="text-2xl font-bold">
            {formatarMoeda(totais.custoVariavelTotal)}
          </div>
          <div className="text-sm opacity-90">Custo Variável Total</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card border border-green-200 bg-green-50">
          <div className="text-sm text-gray-700">Loja que mais lucrou</div>
          <div className="font-bold text-green-800 mt-1">
            {destaques.lojaMaiorLucro?.lojaNome || "-"}
          </div>
          <div className="text-sm mt-1">
            {formatarMoeda(destaques.lojaMaiorLucro?.lucroBruto || 0)}
          </div>
        </div>
        <div className="card border border-red-200 bg-red-50">
          <div className="text-sm text-gray-700">Loja com maior gasto</div>
          <div className="font-bold text-red-800 mt-1">
            {destaques.lojaMaiorGasto?.lojaNome || "-"}
          </div>
          <div className="text-sm mt-1">
            {formatarMoeda(destaques.lojaMaiorGasto?.custoTotal || 0)}
          </div>
        </div>
        <div className="card border border-indigo-200 bg-indigo-50">
          <div className="text-sm text-gray-700">Maior participação (%)</div>
          <div className="font-bold text-indigo-800 mt-1">
            {destaques.lojaMaiorParticipacao?.lojaNome || "-"}
          </div>
          <div className="text-sm mt-1">
            {formatarPercentual(
              destaques.lojaMaiorParticipacao?.participacaoLucroBruto || 0,
            )}
          </div>
        </div>
        <div className="card border border-amber-200 bg-amber-50">
          <div className="text-sm text-gray-700">Produto que mais saiu</div>
          <div className="font-bold text-amber-800 mt-1">
            {destaques.produtoMaisSaiu?.emoji || "📦"}{" "}
            {destaques.produtoMaisSaiu?.nome || "-"}
          </div>
          <div className="text-sm mt-1">
            {(destaques.produtoMaisSaiu?.quantidade || 0).toLocaleString(
              "pt-BR",
            )}{" "}
            unidades
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <GraficoBarras
          titulo="📊 Ranking: lojas que mais lucraram"
          itens={graficos.rankingLucroLojas || []}
          chaveNome="lojaNome"
          chaveValor="lucroBruto"
          classeBarra="bg-gradient-to-r from-green-500 to-emerald-700"
          formatter={formatarMoeda}
          vazio="Sem dados para ranking de lucro."
        />

        <GraficoBarras
          titulo="📊 Ranking: lojas com maior gasto"
          itens={graficos.rankingGastoLojas || []}
          chaveNome="lojaNome"
          chaveValor="custoTotal"
          classeBarra="bg-gradient-to-r from-red-500 to-rose-700"
          formatter={formatarMoeda}
          vazio="Sem dados para ranking de gastos."
        />

        <GraficoBarras
          titulo="📊 Participação percentual por loja"
          itens={graficos.participacaoLojas || []}
          chaveNome="lojaNome"
          chaveValor="participacaoLucroBruto"
          classeBarra="bg-gradient-to-r from-indigo-500 to-blue-700"
          formatter={formatarPercentual}
          vazio="Sem dados de participação por loja."
        />

        <GraficoBarras
          titulo="📊 Produto que mais está saindo"
          itens={graficos.rankingProdutos || []}
          chaveNome="nome"
          chaveValor="quantidade"
          classeBarra="bg-gradient-to-r from-amber-500 to-orange-700"
          formatter={(valor) => Number(valor || 0).toLocaleString("pt-BR")}
          vazio="Sem produtos com saída no período."
        />
      </div>

      <div className="card bg-gradient-to-r from-cyan-50 to-blue-100 border-2 border-cyan-200">
        <h4 className="text-lg font-bold text-gray-900 mb-4">
          💳 Percentual de recebimento (Dinheiro x Cartão/Pix)
        </h4>
        <div className="space-y-4">
          {(graficos.pagamento || []).map((item) => (
            <div key={item.metodo}>
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="font-medium text-gray-800">{item.metodo}</span>
                <span className="font-bold text-gray-900">
                  {formatarPercentual(item.percentual)} •{" "}
                  {formatarMoeda(item.valor)}
                </span>
              </div>
              <div className="w-full bg-white rounded-full h-4 overflow-hidden border border-gray-200">
                <div
                  className={
                    item.metodo === "Dinheiro"
                      ? "bg-gradient-to-r from-emerald-500 to-green-700 h-4"
                      : "bg-gradient-to-r from-blue-500 to-indigo-700 h-4"
                  }
                  style={{
                    width: `${Number(item.percentual || 0).toFixed(2)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
