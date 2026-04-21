"use client";

import { useDialog } from "@/context/DialogContext";
import axios from "axios";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Filament {
  id: string;
  description: string;
  remainingMassGrams: number;
  initialMassGrams: number;
  color: string;
  colorHex?: string;
  price: number;
  type: string;
  isNozzle02Compatible?: boolean;
  warningComment?: string;
  slicingProfile3mfPath?: string;
}

export default function FilamentsPage() {
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [nameFilter, setNameFilter] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const { showAlert, showConfirm } = useDialog();

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/filaments")
      .then((res) => setFilaments(res.data))
      .catch((err) => console.error(err));
  }, []);

  const handleDelete = (id: string) => {
    showConfirm(
      "Excluir Filamento",
      "Tem certeza que deseja excluir este filamento?",
      async () => {
        try {
          await axios.delete(`http://localhost:5000/api/filaments/${id}`);
          setFilaments(filaments.filter((f) => f.id !== id));
          await showAlert(
            "Sucesso",
            "Filamento excluído com sucesso!",
            "success",
          );
        } catch (error: any) {
          console.error(error);
          if (
            error.response &&
            error.response.data &&
            error.response.data.message
          ) {
            await showAlert("Erro", error.response.data.message, "error");
          } else {
            await showAlert("Erro", "Erro ao excluir filamento", "error");
          }
        }
      },
    );
  };

  const normalizedNameFilter = nameFilter.trim().toLowerCase();
  const normalizedColorFilter = colorFilter.trim().toLowerCase();

  const filteredFilaments = filaments.filter((filament) => {
    const matchesName = normalizedNameFilter
      ? filament.description.toLowerCase().includes(normalizedNameFilter)
      : true;

    const matchesColor = normalizedColorFilter
      ? filament.color.toLowerCase().includes(normalizedColorFilter)
      : true;

    return matchesName && matchesColor;
  });

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 space-y-6">
        <div className="flex flex-col gap-4 border-b-2 border-brand-orange pb-4 xl:flex-row xl:items-center xl:justify-between">
          <h1 className="text-3xl font-bold text-brand-purple">
            Estoque de Filamentos
          </h1>

          <div className="flex w-full flex-col gap-3 md:flex-row md:items-center xl:w-auto xl:justify-end">
            <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto">
              <div className="group relative w-full xl:w-72">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg
                    className="h-5 w-5 text-gray-400 transition-colors group-focus-within:text-brand-purple"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    ></path>
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Buscar por nome..."
                  value={nameFilter}
                  onChange={(event) => setNameFilter(event.target.value)}
                  className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-10 leading-5 text-gray-900 placeholder-gray-400 shadow-sm transition-all duration-200 focus:border-brand-purple focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
                />
                {nameFilter && (
                  <button
                    type="button"
                    onClick={() => setNameFilter("")}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 transition-colors hover:text-red-500"
                    title="Limpar busca por nome"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      ></path>
                    </svg>
                  </button>
                )}
              </div>

              <div className="group relative w-full xl:w-56">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg
                    className="h-5 w-5 text-gray-400 transition-colors group-focus-within:text-brand-purple"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M7 21a4 4 0 01-4-4c0-1.105.448-2.105 1.172-2.828l7-7a4 4 0 115.656 5.656l-7 7A3.98 3.98 0 017 21z"
                    ></path>
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Filtrar por cor..."
                  value={colorFilter}
                  onChange={(event) => setColorFilter(event.target.value)}
                  className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-10 leading-5 text-gray-900 placeholder-gray-400 shadow-sm transition-all duration-200 focus:border-brand-purple focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
                />
                {colorFilter && (
                  <button
                    type="button"
                    onClick={() => setColorFilter("")}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 transition-colors hover:text-red-500"
                    title="Limpar filtro por cor"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      ></path>
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <Link
              href="/filaments/new"
              className="bg-brand-purple hover:bg-purple-800 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
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
                  strokeWidth="2"
                  d="M12 4v16m8-8H4"
                ></path>
              </svg>
              Novo Filamento
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFilaments.map((f) => {
            const warningComment = f.warningComment?.trim();
            const slicingProfile3mfPath = f.slicingProfile3mfPath?.trim();
            const warningDetails = [
              warningComment,
              slicingProfile3mfPath ? `3MF: ${slicingProfile3mfPath}` : "",
            ]
              .filter(Boolean)
              .join(" | ");
            const hasWarning = Boolean(warningDetails);
            const nozzleCompatible = Boolean(f.isNozzle02Compatible);

            return (
              <div
                key={f.id}
                className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow relative group"
              >
                <div
                  className="h-2"
                  style={{ backgroundColor: f.colorHex || "#2e0249" }}
                ></div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">
                        {f.description}
                      </h3>
                      <div className="mt-1 flex gap-2 flex-wrap">
                        <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-600">
                          {f.color}
                        </span>
                        {nozzleCompatible && (
                          <span
                            className="px-2 py-1 text-xs font-semibold rounded border bg-emerald-100 text-emerald-700 border-emerald-200"
                            title="Compativel com bico 0.2 mm"
                          >
                            0.2 mm
                          </span>
                        )}
                        <span className="px-2 py-1 text-xs font-semibold rounded bg-orange-100 text-orange-800">
                          {f.type && f.type.trim()
                            ? f.type
                            : "Tipo não informado"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasWarning && (
                        <span
                          className="text-yellow-500"
                          title={warningDetails}
                          aria-label="Filamento com ressalvas de fatiamento"
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
                              strokeWidth="2"
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            ></path>
                          </svg>
                        </span>
                      )}
                      {f.colorHex && (
                        <span
                          className="w-4 h-4 rounded-full border border-gray-200 shadow-sm"
                          style={{ backgroundColor: f.colorHex }}
                          title={f.color}
                        ></span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 flex items-center gap-2">
                        Restante:
                        {hasWarning && (
                          <span
                            className="text-yellow-500"
                            title={warningDetails}
                            aria-label="Filamento com ressalvas de fatiamento"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                              ></path>
                            </svg>
                          </span>
                        )}
                      </span>
                      <span
                        className={`font-medium ${f.remainingMassGrams < 200 ? "text-red-500" : "text-green-600"}`}
                      >
                        {f.remainingMassGrams}g
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-brand-orange h-2.5 rounded-full"
                        style={{
                          width: `${Math.min((f.remainingMassGrams / f.initialMassGrams) * 100, 100)}%`,
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-sm pt-2">
                      <span className="text-gray-500">Preço Original:</span>
                      <span className="font-medium text-gray-800">
                        R$ {f.price.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4 opacity-100 transition-opacity sm:flex-row sm:justify-end sm:gap-3 sm:opacity-0 sm:group-hover:opacity-100">
                    <Link
                      href={`/filaments/${f.id}`}
                      className="inline-flex items-center justify-center rounded-lg border border-brand-purple/20 px-4 py-2 text-sm font-semibold text-brand-purple transition-colors hover:bg-purple-50 hover:text-purple-900"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => handleDelete(f.id)}
                      className="inline-flex items-center justify-center rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 hover:text-red-900"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredFilaments.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              ></path>
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {filaments.length === 0
                ? "Nenhum filamento cadastrado"
                : "Nenhum filamento encontrado"}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {filaments.length === 0
                ? "Comece adicionando um novo rolo de filamento."
                : "Tente ajustar os filtros de nome e cor para encontrar o filamento desejado."}
            </p>
          </div>
        )}
      </div>
      {/* Sidebar for Low Stock Filaments */}
      <div className="w-full lg:w-80 shrink-0">
        <div className="bg-white rounded-lg shadow-md p-6 border border-red-100 sticky top-6">
          <h2 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              ></path>
            </svg>
            Filamentos Acabando
          </h2>
          <div className="space-y-3">
            {(() => {
              // Filamentos acabando (estoque < 200)
              const lowStock = filaments.filter(
                (f) => f.remainingMassGrams < 200,
              );
              // Só exibe se não houver outro filamento do mesmo tipo e cor com estoque >= 200
              const uniqueLowStock = lowStock.filter((f) => {
                const hasReplacement = filaments.some(
                  (other) =>
                    other.id !== f.id &&
                    other.type === f.type &&
                    other.color.toLowerCase() === f.color.toLowerCase() &&
                    other.remainingMassGrams >= 200,
                );
                return !hasReplacement;
              });
              if (uniqueLowStock.length === 0) {
                return (
                  <p className="text-sm text-gray-500 italic">
                    Nenhum filamento acabando.
                  </p>
                );
              }
              return uniqueLowStock.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 p-2 rounded bg-red-50 border border-red-100"
                >
                  <div
                    className="w-3 h-3 rounded-full shadow-sm shrink-0"
                    style={{ backgroundColor: f.colorHex || "#000" }}
                  ></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {f.description}{" "}
                      <span className="text-xs text-gray-500">({f.type})</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {f.remainingMassGrams}g restantes
                    </p>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
