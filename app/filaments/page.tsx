"use client";

import { useDialog } from "@/context/DialogContext";
import {
    type Nozzle02Compatibility,
    getNozzle02CompatibilityBadgeClassName,
    getNozzle02CompatibilityLabel,
    getNozzle02CompatibilityValue,
} from "@/utils/filamentNozzleCompatibility";
import axios from "axios";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface Filament {
  id: string;
  description: string;
  remainingMassGrams: number;
  initialMassGrams: number;
  color: string;
  colorHex?: string;
  price: number;
  type: string;
  isNozzle02Compatible?: boolean | null;
  warningComment?: string;
  slicingProfile3mfPath?: string;
}

type Nozzle02Filter = "off" | Nozzle02Compatibility;

export default function FilamentsPage() {
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [nameFilter, setNameFilter] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [nozzleFilter, setNozzleFilter] = useState<Nozzle02Filter>("off");
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

  const { mostAbundantColor, uniqueLowStock } = useMemo(() => {
    const lowStock = filaments.filter(
      (filament) => filament.remainingMassGrams < 200,
    );
    const nextUniqueLowStock = lowStock.filter((filament) => {
      const hasReplacement = filaments.some(
        (other) =>
          other.id !== filament.id &&
          other.type === filament.type &&
          other.color.toLowerCase() === filament.color.toLowerCase() &&
          other.remainingMassGrams >= 200,
      );

      return !hasReplacement;
    });

    const colorGroups = new Map<
      string,
      {
        color: string;
        colorHex?: string;
        totalRemainingMassGrams: number;
        filamentCount: number;
      }
    >();

    filaments.forEach((filament) => {
      const color = filament.color.trim() || "Sem cor";
      const key = color.toLowerCase();
      const current = colorGroups.get(key) || {
        color,
        colorHex: filament.colorHex,
        totalRemainingMassGrams: 0,
        filamentCount: 0,
      };

      current.totalRemainingMassGrams += filament.remainingMassGrams;
      current.filamentCount += 1;
      current.colorHex ||= filament.colorHex;
      colorGroups.set(key, current);
    });

    const nextMostAbundantColor =
      Array.from(colorGroups.values())
        .filter((entry) => entry.totalRemainingMassGrams > 0)
        .sort((firstColor, secondColor) => {
          if (
            secondColor.totalRemainingMassGrams !==
            firstColor.totalRemainingMassGrams
          ) {
            return (
              secondColor.totalRemainingMassGrams -
              firstColor.totalRemainingMassGrams
            );
          }

          return firstColor.color.localeCompare(secondColor.color);
        })[0] || null;

    return {
      mostAbundantColor: nextMostAbundantColor,
      uniqueLowStock: nextUniqueLowStock,
    };
  }, [filaments]);

  const filteredFilaments = filaments.filter((filament) => {
    const matchesName = normalizedNameFilter
      ? filament.description.toLowerCase().includes(normalizedNameFilter)
      : true;

    const matchesColor = normalizedColorFilter
      ? filament.color.toLowerCase().includes(normalizedColorFilter)
      : true;

    const nozzleCompatibility = getNozzle02CompatibilityValue(filament);
    const matchesNozzle =
      nozzleFilter === "off" ? true : nozzleCompatibility === nozzleFilter;

    return matchesName && matchesColor && matchesNozzle;
  });

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 space-y-6">
        <div className="flex flex-col gap-4 border-b-2 border-brand-orange pb-4 xl:flex-row xl:items-center xl:justify-between">
          <h1 className="text-3xl font-bold text-brand-purple">
            Estoque de Filamentos
          </h1>

          <div className="flex w-full flex-col gap-3 md:flex-row md:items-center xl:w-auto xl:justify-end">
            <div className="grid w-full gap-3 sm:grid-cols-3 xl:w-auto">
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

              <div className="group relative w-full xl:w-64">
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
                      d="M7 7h10M7 12h10M7 17h10"
                    ></path>
                  </svg>
                </div>
                <select
                  value={nozzleFilter}
                  onChange={(event) =>
                    setNozzleFilter(event.target.value as Nozzle02Filter)
                  }
                  className={`block w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-10 leading-5 shadow-sm transition-all duration-200 focus:border-brand-purple focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-purple/20 ${nozzleFilter === "off" ? "text-gray-400" : "text-gray-900"}`}
                  aria-label="Filtro de compatibilidade com bico 0.2"
                >
                  <option value="off">Não filtrar por bico 0.2</option>
                  <option value="compatible">
                    Somente compatíveis com bico 0.2
                  </option>
                  <option value="incompatible">
                    Somente não compatíveis com bico 0.2
                  </option>
                  <option value="unknown">
                    Somente com compatibilidade desconhecida
                  </option>
                </select>
                {nozzleFilter !== "off" && (
                  <button
                    type="button"
                    onClick={() => setNozzleFilter("off")}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 transition-colors hover:text-red-500"
                    title="Limpar filtro de bico 0.2"
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
            const nozzleCompatibility = getNozzle02CompatibilityValue(f);

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
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded ${getNozzle02CompatibilityBadgeClassName(nozzleCompatibility)}`}
                          title={getNozzle02CompatibilityLabel(
                            nozzleCompatibility,
                          )}
                        >
                          {getNozzle02CompatibilityLabel(nozzleCompatibility)}
                        </span>
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
                : "Tente ajustar os filtros de nome, cor e bico 0.2 para encontrar o filamento desejado."}
            </p>
          </div>
        )}
      </div>
      {/* Sidebar for Low Stock Filaments */}
      <div className="w-full lg:w-80 shrink-0">
        <div className="space-y-4 lg:sticky lg:top-6">
          <div className="rounded-lg border border-emerald-100 bg-white p-6 shadow-md">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-emerald-700">
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
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                ></path>
              </svg>
              Cor mais abundante
            </h2>
            {mostAbundantColor ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div
                    className="h-4 w-4 shrink-0 rounded-full border border-white/70 shadow-sm"
                    style={{
                      backgroundColor: mostAbundantColor.colorHex || "#10b981",
                    }}
                  ></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {mostAbundantColor.color}
                    </p>
                    <p className="text-xs text-gray-600">
                      {mostAbundantColor.totalRemainingMassGrams.toLocaleString(
                        "pt-BR",
                        {
                          maximumFractionDigits: 0,
                        },
                      )}
                      g somados em {mostAbundantColor.filamentCount} rolo(s)
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs font-medium text-emerald-800">
                  Boa candidata para testes e projetos pessoais por estar
                  sobrando no estoque.
                </p>
              </div>
            ) : (
              <p className="text-sm italic text-gray-500">
                Sem filamentos com estoque disponível.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-red-100 bg-white p-6 shadow-md">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-red-600">
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
              Filamentos acabando
            </h2>
            <div className="space-y-3">
              {uniqueLowStock.length === 0 ? (
                <p className="text-sm italic text-gray-500">
                  Nenhum filamento acabando.
                </p>
              ) : (
                uniqueLowStock.map((filament) => (
                  <div
                    key={filament.id}
                    className="flex items-center gap-3 rounded border border-red-100 bg-red-50 p-2"
                  >
                    <div
                      className="h-3 w-3 shrink-0 rounded-full shadow-sm"
                      style={{ backgroundColor: filament.colorHex || "#000" }}
                    ></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {filament.description}{" "}
                        <span className="text-xs text-gray-500">
                          ({filament.type})
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {filament.remainingMassGrams}g restantes
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
