"use client";

import FilamentSelect from "@/components/FilamentSelect";
import {
    MAX_FILAMENT_USAGE_COUNT,
    ensureFilamentUsageCount,
    getTotalFilamentUsageMass,
    type FilamentUsageSelection,
} from "@/utils/filamentUsage";
import { useId, useMemo } from "react";

interface FilamentOption {
  id: string;
  description: string;
  color: string;
  colorHex?: string;
  type?: string;
  remainingMassGrams?: number;
  price?: number;
}

interface FilamentUsageEditorProps {
  filaments: FilamentOption[];
  usages: FilamentUsageSelection[];
  onChange: (next: FilamentUsageSelection[]) => void;
  title?: string;
  description?: string;
  loading?: boolean;
  disabled?: boolean;
  showPrice?: boolean;
  showRemaining?: boolean;
  showType?: boolean;
}

function getFilteredOptions(
  filaments: FilamentOption[],
  usages: FilamentUsageSelection[],
  index: number,
) {
  const currentUsage = usages[index];
  const selectedIds = new Set(
    usages
      .filter((usage, usageIndex) => usageIndex !== index)
      .map((usage) => usage.filamentId)
      .filter(Boolean),
  );

  return filaments.filter((filament) => {
    if (selectedIds.has(filament.id)) {
      return false;
    }

    const requestedMass = Number(currentUsage?.massGrams || 0);
    if (
      filament.id !== currentUsage?.filamentId &&
      typeof filament.remainingMassGrams === "number" &&
      requestedMass > 0 &&
      filament.remainingMassGrams < requestedMass
    ) {
      return false;
    }

    return true;
  });
}

export default function FilamentUsageEditor({
  filaments,
  usages,
  onChange,
  title = "Filamentos utilizados",
  description = "Defina quantos filamentos participam da impressão e distribua a massa entre eles.",
  loading = false,
  disabled = false,
  showPrice = false,
  showRemaining = false,
  showType = true,
}: Readonly<FilamentUsageEditorProps>) {
  const editorId = useId();
  const totalMass = useMemo(() => getTotalFilamentUsageMass(usages), [usages]);
  const selectedCount = useMemo(
    () => usages.filter((usage) => usage.filamentId.trim() !== "").length,
    [usages],
  );

  const handleCountChange = (nextCount: number) => {
    onChange(ensureFilamentUsageCount(usages, nextCount));
  };

  const handleUsageChange = (
    index: number,
    partial: Partial<FilamentUsageSelection>,
  ) => {
    onChange(
      usages.map((usage, usageIndex) =>
        usageIndex === index ? { ...usage, ...partial } : usage,
      ),
    );
  };

  const handleRemove = (index: number) => {
    if (usages.length <= 1) {
      return;
    }

    onChange(usages.filter((_, usageIndex) => usageIndex !== index));
  };

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50/70 p-4 sm:p-5 lg:p-6">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-start sm:gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">
            {title}
          </h3>
        </div>

        <div className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 sm:px-4 sm:justify-self-end">
          <label
            htmlFor={`${editorId}-count`}
            className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500"
          >
            Quantidade
          </label>
          <select
            id={`${editorId}-count`}
            value={usages.length}
            onChange={(event) => handleCountChange(Number(event.target.value))}
            disabled={disabled}
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:border-brand-purple focus:outline-none"
          >
            {Array.from(
              { length: MAX_FILAMENT_USAGE_COUNT },
              (_, index) => index + 1,
            ).map((count) => (
              <option key={count} value={count}>
                {count} filamento{count > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </div>

        <p className="min-w-0 text-sm leading-6 text-gray-600 sm:col-span-2">
          {description}
        </p>
      </div>

      <div className="space-y-3">
        {usages.map((usage, index) => {
          const selectedFilament = filaments.find(
            (filament) => filament.id === usage.filamentId,
          );
          const remainingAfterUsage =
            typeof selectedFilament?.remainingMassGrams === "number"
              ? selectedFilament.remainingMassGrams -
                Number(usage.massGrams || 0)
              : null;
          const hasInsufficientMass =
            remainingAfterUsage !== null &&
            Number(usage.massGrams || 0) > 0 &&
            remainingAfterUsage < 0;

          return (
            <div
              key={usage.key}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-brand-purple/8 px-3 py-1 text-xs font-semibold text-brand-purple">
                  <span>Filamento {index + 1}</span>
                </div>

                {usages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="ml-auto text-xs font-semibold text-gray-400 transition-colors hover:text-red-500"
                  >
                    Remover
                  </button>
                )}
              </div>

              <div className="mt-4 grid gap-3 2xl:grid-cols-[minmax(0,1fr)_168px] 2xl:items-start">
                <div>
                  <label
                    htmlFor={`${editorId}-filament-${index}`}
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Material / cor
                  </label>
                  <FilamentSelect
                    id={`${editorId}-filament-${index}`}
                    filaments={getFilteredOptions(filaments, usages, index)}
                    value={usage.filamentId}
                    onChange={(value) =>
                      handleUsageChange(index, { filamentId: value })
                    }
                    placeholder={
                      loading
                        ? "Carregando filamentos..."
                        : "Selecione o filamento desta etapa"
                    }
                    disabled={disabled}
                    loading={loading}
                    loadingMessage="Buscando filamentos disponíveis..."
                    emptyMessage="Nenhum filamento disponível para esta combinação."
                    showPrice={showPrice}
                    showRemaining={showRemaining}
                    showType={showType}
                  />
                </div>

                <div>
                  <label
                    htmlFor={`${editorId}-mass-${index}`}
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Massa (g)
                  </label>
                  <input
                    id={`${editorId}-mass-${index}`}
                    type="number"
                    min="0"
                    step="0.1"
                    value={usage.massGrams}
                    onChange={(event) =>
                      handleUsageChange(index, {
                        massGrams: Number(event.target.value || 0),
                      })
                    }
                    disabled={disabled}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
                    placeholder="0"
                  />
                </div>
              </div>

              {(selectedFilament || remainingAfterUsage !== null) && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {selectedFilament && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-gray-300"
                        style={{
                          backgroundColor:
                            selectedFilament.colorHex || "#d1d5db",
                        }}
                      ></span>
                      {selectedFilament.color || "Cor não informada"}
                    </span>
                  )}
                  {remainingAfterUsage !== null && (
                    <span
                      className={`inline-flex rounded-full px-3 py-1 font-medium ${hasInsufficientMass ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}
                    >
                      Saldo após uso:{" "}
                      {remainingAfterUsage.toLocaleString("pt-BR", {
                        maximumFractionDigits: 1,
                      })}
                      g
                    </span>
                  )}
                </div>
              )}

              {hasInsufficientMass && (
                <p className="mt-3 text-xs font-medium text-red-600">
                  Estoque insuficiente para este filamento na massa informada.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="inline-flex rounded-full bg-brand-orange/10 px-3 py-1 font-semibold text-brand-orange">
          Massa total:{" "}
          {totalMass.toLocaleString("pt-BR", {
            maximumFractionDigits: 1,
          })}
          g
        </span>
        <span className="inline-flex rounded-full bg-gray-200 px-3 py-1 font-medium text-gray-700">
          Selecionados: {selectedCount}/{usages.length}
        </span>
      </div>
    </div>
  );
}
