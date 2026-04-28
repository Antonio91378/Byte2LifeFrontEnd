"use client";

import FilamentUsageEditor from "@/components/FilamentUsageEditor";
import PrintScheduleCalendar from "@/components/PrintScheduleCalendar";
import { DETAIL_LEVELS } from "@/constants/printQuality";
import { API_BASE_URL } from "@/utils/api";
import {
    ensureFilamentUsageCount,
    formatFilamentDisplayName,
    getTotalFilamentUsageMass,
    hasCompleteFilamentUsages,
    toFilamentUsagePayload,
    type FilamentUsageSelection,
} from "@/utils/filamentUsage";
import axios from "axios";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

interface Filament {
  id: string;
  description: string;
  color: string;
  colorHex?: string;
  type?: string;
  remainingMassGrams?: number;
  price: number;
  warningComment?: string;
  slicingProfile3mfPath?: string;
}

interface BudgetResult {
  materialCost: number;
  materialBreakdown: Array<{
    filamentId: string;
    filamentDescription: string;
    color: string;
    massGrams: number;
    unitPricePerKg: number;
    materialCost: number;
  }>;
  energyCost: number;
  machineCost: number;
  totalProductionCost: number;
  profitMarginPercentage: number;
  profitValue: number;
  totalPrice: number;
  breakdown: string;
  nozzleDiameter: string;
  layerHeightRange: string;
  estimatedTimeHours: number;
}

interface BudgetFormData {
  filamentUsages: FilamentUsageSelection[];
  detailLevel: number;
  hasCustomArt: boolean;
  hasPainting: boolean;
  hasVarnish: boolean;
  printTimeHours: string;
  nozzleDiameter: string;
  layerHeight: string;
}

const FILAMENTS_ENDPOINT = `${API_BASE_URL}/filaments`;
const BUDGET_CALCULATE_ENDPOINT = `${API_BASE_URL}/budget/calculate`;
const INITIAL_FORM_DATA: BudgetFormData = {
  filamentUsages: ensureFilamentUsageCount([], 1),
  detailLevel: 1,
  hasCustomArt: false,
  hasPainting: false,
  hasVarnish: false,
  printTimeHours: "",
  nozzleDiameter: "",
  layerHeight: "",
};

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (axios.isAxiosError(error)) {
    if (
      typeof error.response?.data === "string" &&
      error.response.data.trim()
    ) {
      return error.response.data;
    }

    const responseMessage = error.response?.data?.message;
    if (typeof responseMessage === "string" && responseMessage.trim()) {
      return responseMessage;
    }
  }

  return fallbackMessage;
}

export default function BudgetPage() {
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [filamentsError, setFilamentsError] = useState<string | null>(null);
  const [calculationError, setCalculationError] = useState<string | null>(null);
  const [formData, setFormData] = useState<BudgetFormData>(INITIAL_FORM_DATA);
  const [result, setResult] = useState<BudgetResult | null>(null);

  const recalculationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const calculationRequestIdRef = useRef(0);
  const formDataRef = useRef<BudgetFormData>(INITIAL_FORM_DATA);
  const resultRef = useRef<BudgetResult | null>(null);

  const filamentPayload = useMemo(
    () => toFilamentUsagePayload(formData.filamentUsages),
    [formData.filamentUsages],
  );
  const totalMassGrams = useMemo(
    () => getTotalFilamentUsageMass(formData.filamentUsages),
    [formData.filamentUsages],
  );
  const selectedFilamentWarnings = useMemo(() => {
    return filamentPayload
      .map((usage) => {
        const filament = filaments.find((item) => item.id === usage.filamentId);
        if (!filament) {
          return null;
        }

        const details = [
          filament.warningComment?.trim(),
          filament.slicingProfile3mfPath?.trim()
            ? `3MF: ${filament.slicingProfile3mfPath.trim()}`
            : "",
        ]
          .filter(Boolean)
          .join(" | ");

        if (!details) {
          return null;
        }

        return `${formatFilamentDisplayName(filament)}: ${details}`;
      })
      .filter(Boolean) as string[];
  }, [filamentPayload, filaments]);
  const selectedFilamentNames = useMemo(() => {
    return filamentPayload
      .map((usage) => {
        const filament = filaments.find((item) => item.id === usage.filamentId);
        if (!filament) {
          return null;
        }

        return `${formatFilamentDisplayName(filament)} • ${usage.massGrams.toLocaleString(
          "pt-BR",
          {
            maximumFractionDigits: 1,
          },
        )}g`;
      })
      .filter(Boolean) as string[];
  }, [filamentPayload, filaments]);
  const hasNoFilaments = !loading && !filamentsError && filaments.length === 0;
  const canCalculate =
    hasCompleteFilamentUsages(formData.filamentUsages) &&
    totalMassGrams > 0 &&
    !loading &&
    !filamentsError &&
    filaments.length > 0;

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  function clearRecalculationTimeout() {
    if (!recalculationTimeoutRef.current) {
      return;
    }

    clearTimeout(recalculationTimeoutRef.current);
    recalculationTimeoutRef.current = null;
  }

  async function calculateBudget(data = formDataRef.current) {
    const nextFilamentPayload = toFilamentUsagePayload(data.filamentUsages);
    const nextTotalMassGrams = nextFilamentPayload.reduce(
      (total, usage) => total + usage.massGrams,
      0,
    );

    if (nextFilamentPayload.length === 0 || nextTotalMassGrams <= 0) {
      return;
    }

    const requestId = calculationRequestIdRef.current + 1;
    calculationRequestIdRef.current = requestId;
    setCalculating(true);
    setCalculationError(null);

    try {
      const payload = {
        filaments: nextFilamentPayload,
        filamentId: nextFilamentPayload[0].filamentId,
        detailLevel: Number(data.detailLevel),
        massGrams: nextTotalMassGrams,
        hasCustomArt: data.hasCustomArt,
        hasPainting: data.hasPainting,
        hasVarnish: data.hasVarnish,
        printTimeHours: data.printTimeHours
          ? Number(data.printTimeHours)
          : undefined,
        nozzleDiameter: data.nozzleDiameter,
        layerHeight: data.layerHeight,
      };

      const response = await axios.post(BUDGET_CALCULATE_ENDPOINT, payload);
      if (requestId !== calculationRequestIdRef.current) {
        return;
      }

      setResult(response.data);
      resultRef.current = response.data;
      setFormData((current) => {
        const nextData = {
          ...current,
          printTimeHours:
            current.printTimeHours || String(response.data.estimatedTimeHours),
          nozzleDiameter:
            current.nozzleDiameter || response.data.nozzleDiameter,
          layerHeight: current.layerHeight || response.data.layerHeightRange,
        };
        formDataRef.current = nextData;
        return nextData;
      });
    } catch (error) {
      console.error("Error calculating budget:", error);
      if (requestId !== calculationRequestIdRef.current) {
        return;
      }

      setResult(null);
      resultRef.current = null;
      setCalculationError(
        getErrorMessage(
          error,
          "Não foi possível calcular o orçamento com os dados informados.",
        ),
      );
    } finally {
      if (requestId === calculationRequestIdRef.current) {
        setCalculating(false);
      }
    }
  }

  function scheduleRecalculation(nextData: BudgetFormData, delay = 450) {
    if (!resultRef.current) {
      return;
    }

    clearRecalculationTimeout();
    recalculationTimeoutRef.current = setTimeout(() => {
      void calculateBudget(nextData);
    }, delay);
  }

  function applyFormData(nextData: BudgetFormData, delay = 450) {
    setFormData(nextData);
    formDataRef.current = nextData;

    const hasRequiredInputs =
      hasCompleteFilamentUsages(nextData.filamentUsages) &&
      getTotalFilamentUsageMass(nextData.filamentUsages) > 0;
    if (!hasRequiredInputs) {
      clearRecalculationTimeout();
      setCalculationError(null);
      setResult(null);
      resultRef.current = null;
      return;
    }

    scheduleRecalculation(nextData, delay);
  }

  function updateFormData(partial: Partial<BudgetFormData>, delay = 450) {
    const nextData = { ...formDataRef.current, ...partial };
    applyFormData(nextData, delay);
  }

  async function fetchFilaments() {
    setLoading(true);
    setFilamentsError(null);

    try {
      const response = await axios.get(FILAMENTS_ENDPOINT);
      setFilaments(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Error fetching filaments:", error);
      setFilaments([]);
      setFilamentsError(
        getErrorMessage(
          error,
          "Não foi possível carregar os filamentos cadastrados. Tente novamente em instantes.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchFilaments();

    return () => {
      clearRecalculationTimeout();
    };
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    let hasChanges = false;
    const nextUsages = formData.filamentUsages.map((usage) => {
      if (!usage.filamentId) {
        return usage;
      }

      const selectedFilament = filaments.find(
        (filament) => filament.id === usage.filamentId,
      );
      const requestedMass = Number(usage.massGrams || 0);

      if (
        !selectedFilament ||
        (requestedMass > 0 &&
          typeof selectedFilament.remainingMassGrams === "number" &&
          selectedFilament.remainingMassGrams < requestedMass)
      ) {
        hasChanges = true;
        return { ...usage, filamentId: "" };
      }

      return usage;
    });

    if (!hasChanges) {
      return;
    }

    applyFormData({ ...formData, filamentUsages: nextUsages });
  }, [filaments, formData, loading]);

  function handleCalculate(event: React.FormEvent) {
    event.preventDefault();
    clearRecalculationTimeout();
    void calculateBudget(formDataRef.current);
  }

  function handleTechnicalChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    updateFormData({ [name]: value } as Partial<BudgetFormData>, 800);
  }

  const budgetResultPanel = (() => {
    if (result) {
      return (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-lg border border-teal-100 overflow-hidden">
            <div className="bg-teal-600 p-6 text-white text-center">
              <p className="text-teal-100 text-sm font-medium uppercase tracking-wider mb-1">
                Valor Sugerido de Venda
              </p>
              <h2 className="text-5xl font-extrabold">
                {result.totalPrice.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </h2>
            </div>

            <div className="p-6">
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600">Margem de Lucro</span>
                <div className="text-right">
                  <span className="block font-semibold text-teal-600">
                    {result.profitMarginPercentage.toFixed(0)}%
                  </span>
                  <span className="text-xs text-gray-400">
                    {result.profitValue.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 p-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-800">
                  Custo de Produção
                </h3>
                <span className="text-xl font-bold text-gray-900">
                  {result.totalProductionCost.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
              </div>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  <span>
                    {result.materialBreakdown.length > 1
                      ? "Materiais (Filamentos)"
                      : "Material (Filamento)"}
                  </span>
                </span>
                <span className="font-medium text-gray-900">
                  {result.materialCost.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                  <span>Energia Elétrica</span>
                </span>
                <span className="font-medium text-gray-900">
                  {result.energyCost.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>
                  <span>Depreciação Máquina</span>
                </span>
                <span className="font-medium text-gray-900">
                  {result.machineCost.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
              </div>

              {result.materialBreakdown.length > 1 && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">
                    Composição do material
                  </p>
                  <div className="mt-3 space-y-2">
                    {result.materialBreakdown.map((item) => (
                      <div
                        key={`${item.filamentId}-${item.color}`}
                        className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900">
                            {item.filamentDescription}
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.color || "Cor não informada"} •{" "}
                            {item.massGrams.toLocaleString("pt-BR", {
                              maximumFractionDigits: 1,
                            })}
                            g
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold text-gray-900">
                          {item.materialCost.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-bold text-gray-900 mb-4">
              Detalhes Técnicos (Editável)
            </h3>
            <div className="grid grid-cols-3 gap-4 pb-4 border-b border-gray-100">
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                  Nozzle
                </p>
                <input
                  type="text"
                  name="nozzleDiameter"
                  value={formData.nozzleDiameter}
                  onChange={handleTechnicalChange}
                  className="w-full text-center text-sm font-bold text-gray-800 bg-transparent border-b border-gray-300 focus:border-teal-500 focus:outline-none"
                  placeholder="0.4mm"
                />
              </div>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                  Camada
                </p>
                <input
                  type="text"
                  name="layerHeight"
                  value={formData.layerHeight}
                  onChange={handleTechnicalChange}
                  className="w-full text-center text-sm font-bold text-gray-800 bg-transparent border-b border-gray-300 focus:border-teal-500 focus:outline-none"
                  placeholder="0.2mm"
                />
              </div>
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                  Tempo (h)
                </p>
                <input
                  type="number"
                  name="printTimeHours"
                  step="0.1"
                  value={formData.printTimeHours}
                  onChange={handleTechnicalChange}
                  className="w-full text-center text-sm font-bold text-gray-800 bg-transparent border-b border-gray-300 focus:border-teal-500 focus:outline-none"
                  placeholder="0.0"
                />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mt-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">
                Regras de Negócio Aplicadas
              </h3>
              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">
                {result.breakdown}
              </pre>
            </div>
          </div>
        </div>
      );
    }

    if (calculationError) {
      return (
        <div
          className="bg-red-50 rounded-2xl border border-red-200 p-8 flex flex-col items-center justify-center text-center h-full min-h-100 text-red-700"
          role="alert"
        >
          <svg
            className="w-16 h-16 mb-4 text-red-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-7.938 4h15.876C21.296 19 22 18.296 22 17.428V6.572C22 5.704 21.296 5 20.428 5H3.572C2.704 5 2 5.704 2 6.572v10.856C2 18.296 2.704 19 3.572 19z"
            ></path>
          </svg>
          <p className="text-lg font-semibold text-red-800">
            Não foi possível calcular o orçamento
          </p>
          <p className="text-sm mt-2 max-w-md">{calculationError}</p>
          <button
            type="button"
            onClick={() => void calculateBudget(formDataRef.current)}
            disabled={!canCalculate || calculating}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Tentar novamente
          </button>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 flex flex-col items-center justify-center text-center h-full min-h-100 text-gray-600">
        <svg
          className="w-16 h-16 mb-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          ></path>
        </svg>
        <p className="text-lg font-medium text-gray-800">
          Preencha o formulário ao lado
        </p>
        <p className="text-sm mt-2 text-gray-600">
          O resultado do orçamento aparecerá aqui.
        </p>
      </div>
    );
  })();

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              Simulação de Orçamento
            </h1>
            <p className="text-gray-600 mt-2">
              Calcule o valor de venda baseado em parâmetros técnicos.
            </p>
          </div>
          <Link
            href="/"
            className="text-brand-purple hover:text-purple-800 font-medium flex items-center gap-2"
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
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              ></path>
            </svg>
            Voltar
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)] xl:gap-10">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <form onSubmit={handleCalculate} className="space-y-6">
              <div>
                <FilamentUsageEditor
                  filaments={filaments}
                  usages={formData.filamentUsages}
                  onChange={(value) =>
                    updateFormData({ filamentUsages: value }, 300)
                  }
                  loading={loading}
                  disabled={Boolean(filamentsError) || hasNoFilaments}
                  showPrice
                  showRemaining
                  showType
                  description="Distribua a massa entre os materiais usados na peça. A soma é usada no custo, no tempo estimado e na sugestão de preço."
                />
                {loading && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-brand-purple/10 bg-brand-purple/5 px-3 py-2 text-sm text-brand-purple">
                    <svg
                      className="h-4 w-4 animate-spin"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      ></path>
                    </svg>
                    <span>
                      Carregando os filamentos cadastrados. Você pode abrir o
                      seletor e acompanhar o progresso.
                    </span>
                  </div>
                )}
                {filamentsError && (
                  <div
                    className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700"
                    role="alert"
                  >
                    <p>{filamentsError}</p>
                    <button
                      type="button"
                      onClick={() => void fetchFilaments()}
                      className="mt-2 font-semibold text-red-700 underline underline-offset-2 hover:text-red-800"
                    >
                      Tentar novamente
                    </button>
                  </div>
                )}
                {hasNoFilaments && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                    <p>Nenhum filamento foi encontrado para a simulação.</p>
                    <Link
                      href="/filaments/new"
                      className="mt-2 inline-flex font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950"
                    >
                      Cadastrar novo filamento
                    </Link>
                  </div>
                )}
                {selectedFilamentWarnings.length > 0 && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                    <div className="flex items-center gap-2 font-semibold text-amber-900">
                      <svg
                        className="h-4 w-4"
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
                      Ressalvas dos filamentos selecionados
                    </div>
                    <div className="mt-2 space-y-2">
                      {selectedFilamentWarnings.map((warning) => (
                        <p key={warning}>{warning}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <fieldset>
                <legend className="block text-sm font-medium text-gray-700 mb-2">
                  Nível de Detalhamento
                </legend>
                <div className="grid grid-cols-1 gap-3">
                  {DETAIL_LEVELS.map((level) => (
                    <label
                      key={level.value}
                      className={`relative flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                        formData.detailLevel === level.value
                          ? "border-teal-500 bg-teal-50 ring-1 ring-teal-500"
                          : "border-gray-200 hover:border-teal-300"
                      }`}
                    >
                      <input
                        id={`budget-detail-level-${level.value}`}
                        type="radio"
                        name="detailLevel"
                        value={level.value}
                        checked={formData.detailLevel === level.value}
                        onChange={() =>
                          updateFormData(
                            {
                              detailLevel: level.value,
                              nozzleDiameter: "",
                              layerHeight: "",
                            },
                            250,
                          )
                        }
                        className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300"
                      />
                      <span className="ml-3 font-medium text-gray-900">
                        {level.label}
                      </span>
                      <div className="ml-auto group relative">
                        <svg
                          className="w-5 h-5 text-gray-400 hover:text-teal-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          ></path>
                        </svg>
                        <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                          {level.info}
                          <div className="absolute top-full right-2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">Massa total calculada</span>
                  <span className="text-lg font-bold text-gray-900">
                    {totalMassGrams.toLocaleString("pt-BR", {
                      maximumFractionDigits: 1,
                    })}
                    g
                  </span>
                </div>
                {selectedFilamentNames.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
                    {selectedFilamentNames.map((name) => (
                      <span
                        key={name}
                        className="rounded-full bg-white px-3 py-1 font-medium text-gray-700 ring-1 ring-gray-200"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <fieldset className="space-y-3 pt-2 border-t border-gray-100">
                <legend className="block text-sm font-medium text-gray-700 mb-2">
                  Adicionais
                </legend>

                <label className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.hasCustomArt}
                    onChange={(event) =>
                      updateFormData(
                        { hasCustomArt: event.target.checked },
                        250,
                      )
                    }
                    className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-900">
                    Arte Personalizada
                  </span>
                  <span className="ml-auto text-xs text-teal-600 font-bold">
                    +1200%
                  </span>
                </label>

                <label className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.hasPainting}
                    onChange={(event) =>
                      updateFormData({ hasPainting: event.target.checked }, 250)
                    }
                    className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-900">
                    Pintura
                  </span>
                  <span className="ml-auto text-xs text-teal-600 font-bold">
                    +50%
                  </span>
                </label>

                <label className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.hasVarnish}
                    onChange={(event) =>
                      updateFormData({ hasVarnish: event.target.checked }, 250)
                    }
                    className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-900">
                    Verniz
                  </span>
                  <span className="ml-auto text-xs text-teal-600 font-bold">
                    +30%
                  </span>
                </label>
              </fieldset>

              <button
                type="submit"
                disabled={calculating || !canCalculate}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {calculating ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Calculando...
                  </>
                ) : (
                  "Calcular Orçamento"
                )}
              </button>
            </form>
          </div>

          <div className="space-y-6 min-w-0">{budgetResultPanel}</div>

          {result && (
            <div className="lg:col-span-2">
              <PrintScheduleCalendar
                estimatedHours={result.estimatedTimeHours}
                hasCustomArt={formData.hasCustomArt}
                hasPainting={formData.hasPainting}
                showDesign={formData.hasCustomArt}
                showPainting={formData.hasPainting}
                layout="stacked"
                readOnly
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
