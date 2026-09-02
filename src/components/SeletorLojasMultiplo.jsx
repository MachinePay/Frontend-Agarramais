import { useEffect, useRef, useState } from "react";

export function SeletorLojasMultiplo({ lojas, selecionadas, onChange }) {
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const aoClicarFora = (evento) => {
      if (containerRef.current && !containerRef.current.contains(evento.target)) {
        setAberto(false);
      }
    };
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  const todasSelecionadas =
    lojas.length > 0 && selecionadas.length === lojas.length;

  const alternarLoja = (lojaId) => {
    const id = String(lojaId);
    if (selecionadas.includes(id)) {
      onChange(selecionadas.filter((selecionadaId) => selecionadaId !== id));
    } else {
      onChange([...selecionadas, id]);
    }
  };

  const alternarTodas = () => {
    onChange(todasSelecionadas ? [] : lojas.map((loja) => String(loja.id)));
  };

  const rotulo = () => {
    if (selecionadas.length === 0) return "Selecione uma ou mais lojas";
    if (todasSelecionadas) return "Todas as lojas";
    if (selecionadas.length === 1) {
      const loja = lojas.find((l) => String(l.id) === selecionadas[0]);
      return loja?.nome || "1 loja selecionada";
    }
    return `${selecionadas.length} lojas selecionadas`;
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        className="input-field w-full flex items-center justify-between text-left"
      >
        <span
          className={selecionadas.length === 0 ? "text-gray-400" : "text-gray-900"}
        >
          {rotulo()}
        </span>
        <span className="text-gray-400 ml-2">{aberto ? "▲" : "▼"}</span>
      </button>

      {aberto && (
        <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border-2 border-gray-200 bg-white shadow-lg">
          <label className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 cursor-pointer hover:bg-gray-50 font-medium">
            <input
              type="checkbox"
              checked={todasSelecionadas}
              onChange={alternarTodas}
              className="w-4 h-4 accent-[#f2a20c]"
            />
            Todas as lojas
          </label>
          {lojas.map((loja) => (
            <label
              key={loja.id}
              className="flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selecionadas.includes(String(loja.id))}
                onChange={() => alternarLoja(loja.id)}
                className="w-4 h-4 accent-[#f2a20c]"
              />
              {loja.nome}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
