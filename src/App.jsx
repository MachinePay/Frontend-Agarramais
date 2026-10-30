import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { PrivateRoute } from "./components/PrivateRoute";
import { Login } from "./pages/Login";
import "./App.css";
import { PageLoader } from "./components/Loading";

// Cada página vira um arquivo JS separado, baixado só quando a rota é
// aberta (antes o app inteiro — gráficos, QR code, zip… — vinha no
// primeiro carregamento).
const Veiculos = lazy(() => import("./pages/Veiculos"));
const Alertas = lazy(() => import("./pages/Alertas"));
const Registrar = lazy(() =>
  import("./pages/Registrar").then((m) => ({ default: m.Registrar })),
);
const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const Usuarios = lazy(() =>
  import("./pages/Usuarios").then((m) => ({ default: m.Usuarios })),
);
const UsuarioForm = lazy(() =>
  import("./pages/UsuarioForm").then((m) => ({ default: m.UsuarioForm })),
);
const Lojas = lazy(() =>
  import("./pages/Lojas").then((m) => ({ default: m.Lojas })),
);
const LojaForm = lazy(() =>
  import("./pages/LojaForm").then((m) => ({ default: m.LojaForm })),
);
const LojaDetalhes = lazy(() =>
  import("./pages/LojaDetalhes").then((m) => ({ default: m.LojaDetalhes })),
);
const Maquinas = lazy(() =>
  import("./pages/Maquinas").then((m) => ({ default: m.Maquinas })),
);
const MaquinaForm = lazy(() =>
  import("./pages/MaquinaForm").then((m) => ({ default: m.MaquinaForm })),
);
const MaquinaDetalhes = lazy(() =>
  import("./pages/MaquinaDetalhes").then((m) => ({ default: m.MaquinaDetalhes })),
);
const Produtos = lazy(() =>
  import("./pages/Produtos").then((m) => ({ default: m.Produtos })),
);
const ProdutosAComprar = lazy(() =>
  import("./pages/ProdutosAComprar").then((m) => ({ default: m.ProdutosAComprar })),
);
const ProdutoForm = lazy(() =>
  import("./pages/ProdutoForm").then((m) => ({ default: m.ProdutoForm })),
);
const Movimentacoes = lazy(() =>
  import("./pages/Movimentacoes").then((m) => ({ default: m.Movimentacoes })),
);
const ManutencaoPage = lazy(() => import("./pages/ManutencaoPage"));
const Graficos = lazy(() =>
  import("./pages/Graficos").then((m) => ({ default: m.Graficos })),
);
const RankingMaquinas = lazy(() =>
  import("./pages/RankingMaquinas").then((m) => ({ default: m.RankingMaquinas })),
);
const Relatorios = lazy(() =>
  import("./pages/Relatorios").then((m) => ({ default: m.Relatorios })),
);
const MachinePay = lazy(() =>
  import("./pages/MachinePay").then((m) => ({ default: m.MachinePay })),
);
const CompactPay = lazy(() =>
  import("./pages/CompactPay").then((m) => ({ default: m.CompactPay })),
);
const AlertasCompactPay = lazy(() =>
  import("./pages/AlertasCompactPay").then((m) => ({ default: m.AlertasCompactPay })),
);
const CriarCaixasMachinePay = lazy(() =>
  import("./pages/CriarCaixasMachinePay").then((m) => ({ default: m.CriarCaixasMachinePay })),
);
const QrCodesMachinePay = lazy(() =>
  import("./pages/QrCodesMachinePay").then((m) => ({ default: m.QrCodesMachinePay })),
);
const CreditosRemotos = lazy(() =>
  import("./pages/CreditosRemotos").then((m) => ({ default: m.CreditosRemotos })),
);
const Correios = lazy(() =>
  import("./pages/Correios").then((m) => ({ default: m.Correios })),
);
const CreditoRemotoPublico = lazy(() =>
  import("./pages/CreditoRemotoPublico").then((m) => ({ default: m.CreditoRemotoPublico })),
);
const BuscaTransportadoras = lazy(() =>
  import("./pages/BuscaTransportadoras").then((m) => ({ default: m.BuscaTransportadoras })),
);
const CalculadoraPedidos = lazy(() =>
  import("./pages/CalculadoraPedidos").then((m) => ({ default: m.CalculadoraPedidos })),
);
const Sangrias = lazy(() =>
  import("./pages/Sangrias").then((m) => ({ default: m.Sangrias })),
);
const PedidosNotasFiscais = lazy(() =>
  import("./pages/PedidosNotasFiscais").then((m) => ({ default: m.PedidosNotasFiscais })),
);
const GastosVariaveis = lazy(() =>
  import("./pages/GastosVariaveis").then((m) => ({ default: m.GastosVariaveis })),
);
const StyleGuide = lazy(() =>
  import("./pages/StyleGuide").then((m) => ({ default: m.StyleGuide })),
);
const AnaliseEstoque = lazy(() =>
  import("./pages/AnaliseEstoque").then((m) => ({ default: m.AnaliseEstoque })),
);
const SuporteTecnico = lazy(() =>
  import("./pages/suporteTecnico/SuporteTecnico").then((m) => ({ default: m.SuporteTecnico })),
);
const SuporteTecnicoHistorico = lazy(() =>
  import("./pages/suporteTecnico/SuporteTecnicoHistorico").then((m) => ({ default: m.SuporteTecnicoHistorico })),
);
const SuporteTecnicoDevolucoesPendentes = lazy(() =>
  import("./pages/suporteTecnico/SuporteTecnicoDevolucoesPendentes").then((m) => ({ default: m.SuporteTecnicoDevolucoesPendentes })),
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route
            path="/veiculos"
            element={
              <PrivateRoute>
                <Veiculos />
              </PrivateRoute>
            }
          />
          <Route path="/login" element={<Login />} />
          {/* Link temporário de crédito remoto: público, sem login */}
          <Route path="/creditos" element={<CreditoRemotoPublico />} />
          <Route
            path="/alertas"
            element={
              <PrivateRoute adminOnly>
                <Alertas />
              </PrivateRoute>
            }
          />
          ;
          <Route path="/registrar" element={<Registrar />} />
          <Route path="/style-guide" element={<StyleGuide />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/usuarios"
            element={
              <PrivateRoute adminOnly>
                <Usuarios />
              </PrivateRoute>
            }
          />
          <Route
            path="/usuarios/novo"
            element={
              <PrivateRoute adminOnly>
                <UsuarioForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/usuarios/:id/editar"
            element={
              <PrivateRoute adminOnly>
                <UsuarioForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/lojas"
            element={
              <PrivateRoute>
                <Lojas />
              </PrivateRoute>
            }
          />
          <Route
            path="/lojas/:id"
            element={
              <PrivateRoute>
                <LojaDetalhes />
              </PrivateRoute>
            }
          />
          <Route
            path="/lojas/nova"
            element={
              <PrivateRoute>
                <LojaForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/lojas/:id/editar"
            element={
              <PrivateRoute>
                <LojaForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/maquinas"
            element={
              <PrivateRoute>
                <Maquinas />
              </PrivateRoute>
            }
          />
          <Route
            path="/maquinas/nova"
            element={
              <PrivateRoute>
                <MaquinaForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/maquinas/:id/editar"
            element={
              <PrivateRoute>
                <MaquinaForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/maquinas/:id"
            element={
              <PrivateRoute>
                <MaquinaDetalhes />
              </PrivateRoute>
            }
          />
          <Route
            path="/produtos"
            element={
              <PrivateRoute>
                <Produtos />
              </PrivateRoute>
            }
          />
          <Route
            path="/produtos-a-comprar"
            element={
              <PrivateRoute>
                <ProdutosAComprar />
              </PrivateRoute>
            }
          />
          <Route
            path="/produtos/novo"
            element={
              <PrivateRoute>
                <ProdutoForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/produtos/:id/editar"
            element={
              <PrivateRoute>
                <ProdutoForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/movimentacoes"
            element={
              <PrivateRoute>
                <Movimentacoes />
              </PrivateRoute>
            }
          />
          <Route
            path="/analise-estoque"
            element={
              <PrivateRoute adminOnly>
                <AnaliseEstoque />
              </PrivateRoute>
            }
          />
          <Route
            path="/manutencao"
            element={
              <PrivateRoute>
                <ManutencaoPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/alertas-compactpay"
            element={
              <PrivateRoute adminOnly>
                <AlertasCompactPay />
              </PrivateRoute>
            }
          />
          <Route
            path="/graficos"
            element={
              <PrivateRoute adminOnly>
                <Graficos />
              </PrivateRoute>
            }
          />
          <Route
            path="/relatorios"
            element={
              <PrivateRoute adminOnly>
                <Relatorios />
              </PrivateRoute>
            }
          />
          <Route
            path="/ranking-maquinas"
            element={
              <PrivateRoute adminOnly>
                <RankingMaquinas />
              </PrivateRoute>
            }
          />
          <Route
            path="/machine-pay"
            element={
              <PrivateRoute roles={["ADMIN", "MACHINEPAY"]}>
                <MachinePay />
              </PrivateRoute>
            }
          />
          <Route
            path="/machine-pay/criar-caixas"
            element={
              <PrivateRoute adminOnly>
                <CriarCaixasMachinePay />
              </PrivateRoute>
            }
          />
          <Route
            path="/machine-pay/qr-codes"
            element={
              <PrivateRoute adminOnly>
                <QrCodesMachinePay />
              </PrivateRoute>
            }
          />
          <Route
            path="/compact-pay"
            element={
              <PrivateRoute roles={["ADMIN", "MACHINEPAY"]}>
                <CompactPay />
              </PrivateRoute>
            }
          />
          <Route
            path="/creditos-remotos"
            element={
              <PrivateRoute adminOnly>
                <CreditosRemotos />
              </PrivateRoute>
            }
          />
          <Route
            path="/transportadoras"
            element={
              <PrivateRoute roles={["ADMIN", "COMERCIAL"]}>
                <BuscaTransportadoras />
              </PrivateRoute>
            }
          />
          <Route
            path="/calculadora-pedidos"
            element={
              <PrivateRoute roles={["ADMIN", "COMERCIAL"]}>
                <CalculadoraPedidos />
              </PrivateRoute>
            }
          />
          <Route
            path="/correios"
            element={
              <PrivateRoute roles={["ADMIN", "COMERCIAL"]}>
                <Correios />
              </PrivateRoute>
            }
          />
          <Route
            path="/pedidos-notas-fiscais"
            element={
              <PrivateRoute roles={["ADMIN", "COMERCIAL"]}>
                <PedidosNotasFiscais />
              </PrivateRoute>
            }
          />
          <Route
            path="/sangrias"
            element={
              <PrivateRoute>
                <Sangrias />
              </PrivateRoute>
            }
          />
          <Route
            path="/gastos-variaveis"
            element={
              <PrivateRoute>
                <GastosVariaveis />
              </PrivateRoute>
            }
          />
          <Route
            path="/suporte-tecnico"
            element={
              <PrivateRoute>
                <SuporteTecnico />
              </PrivateRoute>
            }
          />
          <Route
            path="/suporte-tecnico/historico"
            element={
              <PrivateRoute adminOnly>
                <SuporteTecnicoHistorico />
              </PrivateRoute>
            }
          />
          <Route
            path="/suporte-tecnico/devolucoes-pendentes"
            element={
              <PrivateRoute adminOnly>
                <SuporteTecnicoDevolucoesPendentes />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
