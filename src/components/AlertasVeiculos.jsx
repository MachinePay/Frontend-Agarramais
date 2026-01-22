import React, { useEffect, useState } from "react";

const nivelCor = {
  danger: "bg-red-100 text-red-800 border-red-300",
  warning: "bg-yellow-100 text-yellow-800 border-yellow-300",
  info: "bg-blue-100 text-blue-800 border-blue-300",
};

export default function AlertasVeiculos() {
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Definimos a função DENTRO do useEffect para evitar problemas de dependência
    const fetchAlertas = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/alertas-veiculos");
        const data = await res.json();
        setAlertas(data);
      } catch (error) {
        // Corrigido: adicionado (error) e um log para debug
        console.error("Erro ao buscar alertas:", error);
        setAlertas([]);
      } finally {
        // O finally garante que o loading pare, dando certo ou errado
        setLoading(false);
      }
    };

    fetchAlertas();
  }, []); // O array vazio [] garante que rode apenas uma vez ao montar

  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold mb-2">Alertas de Veículos</h2>
      {loading ? (
        <div className="text-gray-500">Carregando alertas...</div>
      ) : alertas.length === 0 ? (
        <div className="text-gray-500">
          Nenhum alerta de veículo no momento.
        </div>
      ) : (
        <ul className="space-y-2">
          {alertas.map((alerta, idx) => (
            <li
              key={alerta.id || idx}
              className={`border-l-4 p-3 rounded ${
                nivelCor[alerta.nivel] ||
                "bg-gray-100 text-gray-800 border-gray-300"
              }`}
            >
              <span className="font-semibold">{alerta.veiculo}:</span>{" "}
              {alerta.mensagem}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}