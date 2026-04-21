"use client";

import FilamentSelect from "@/components/FilamentSelect";
import PrintScheduleCalendar from "@/components/PrintScheduleCalendar";
import SaleAttachmentsPanel from "@/components/sale/SaleAttachmentsPanel";
import { DETAIL_LEVELS } from "@/constants/printQuality";
import { useDialog } from "@/context/DialogContext";
import {
    appendPendingAttachmentsToFormData,
    buildPendingSaleAttachments,
    PendingSaleAttachment,
    revokePendingSaleAttachmentPreview,
    revokePendingSaleAttachmentPreviews,
    SaleAttachment,
    SaleAttachmentCategory,
} from "@/utils/saleAttachments";
import {
    formatSaleProfitPercentage,
    getSaleProfitValue,
} from "@/utils/saleFinancials";
import { parseDurationToHours } from "@/utils/time";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

interface Filament {
  id: string;
  description: string;
  color: string;
  colorHex?: string;
  type?: string;
  remainingMassGrams: number;
}

interface Client {
  id: string;
  name: string;
  phoneNumber: string;
}

interface ServiceProvider {
  id: string;
  name: string;
  email?: string;
  categories: string[];
  category?: string;
}

const normalizeCategory = (value?: string) =>
  (value || "").trim().toLowerCase();
const hasCategory = (
  categories: string[] | undefined,
  matcher: (value: string) => boolean,
) =>
  (categories || []).some((category) => matcher(normalizeCategory(category)));
const isDesignerCategory = (categories?: string[]) =>
  hasCategory(categories, (value) => value.includes("design"));
const isPainterCategory = (categories?: string[]) =>
  hasCategory(
    categories,
    (value) => value.includes("pint") || value.includes("paint"),
  );

export default function NewSalePage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <NewSaleContent />
    </Suspense>
  );
}

function NewSaleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stockId = searchParams.get("stockId");
  const { showAlert } = useDialog();
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileSchedule, setShowMobileSchedule] = useState(false);
  const [showMobileAdvanced, setShowMobileAdvanced] = useState(false);
  const [showMobileCostDetails, setShowMobileCostDetails] = useState(false);

  const parseNumericValue = (value: string | number) => {
    const normalized = String(value ?? "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const parseMassGrams = (value: string | number) => parseNumericValue(value);
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>(
    [],
  );
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [existingAttachments, setExistingAttachments] = useState<
    SaleAttachment[]
  >([]);
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingSaleAttachment[]
  >([]);
  const [processingCategories, setProcessingCategories] = useState<
    SaleAttachmentCategory[]
  >([]);
  const pendingAttachmentsRef = useRef<PendingSaleAttachment[]>([]);

  const [formData, setFormData] = useState({
    description: "",
    productLink: "",
    printQuality: "Normal",
    massGrams: 0,
    cost: 0,
    shippingCost: 0,
    saleValue: 0,
    profit: 0,
    profitPercentage: "",
    designPrintTime: "",
    printStatus: "InQueue",
    isPrintConcluded: false,
    isDelivered: false,
    isPaid: false,
    filamentId: "",
    clientId: "",
    saleDate: new Date().toISOString().split("T")[0],
    deliveryDate: "",
    hasCustomArt: false,
    hasPainting: false,
    hasVarnish: false,
    designTimeHours: 0,
    designResponsible: "",
    designStartConfirmedAt: "",
    designValue: 0,
    paintTimeHours: 0,
    paintResponsible: "",
    paintStartConfirmedAt: "",
    productionCost: 0,
    baseCost: 0,
    nozzleDiameter: "",
    layerHeight: "",
    printStartConfirmedAt: "",
    costDetails: null as any,
  });

  useEffect(() => {
    if (globalThis.window === undefined) return;

    const mediaQuery = globalThis.window.matchMedia("(max-width: 767px)");
    const syncViewport = () => setIsMobile(mediaQuery.matches);

    syncViewport();

    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  useEffect(() => {
    return () => {
      revokePendingSaleAttachmentPreviews(pendingAttachmentsRef.current);
    };
  }, []);

  const buildReturnToSalesUrl = () => {
    if (!searchParams) {
      return "/sales";
    }
    const params = new URLSearchParams();
    const filterType = searchParams.get("filterType");
    if (filterType === "date" || filterType === "month") {
      params.set("filterType", filterType);
    }
    const filterDate = searchParams.get("filterDate");
    if (filterDate) {
      params.set("filterDate", filterDate);
    }
    const filterClientName = searchParams.get("filterClientName");
    if (filterClientName) {
      params.set("filterClientName", filterClientName);
    }
    const filterClientId = searchParams.get("filterClientId");
    if (filterClientId) {
      params.set("filterClientId", filterClientId);
    }
    const filterProductName = searchParams.get("filterProductName");
    if (filterProductName) {
      params.set("filterProductName", filterProductName);
    }
    const paymentStatus = searchParams.get("paymentStatus");
    if (paymentStatus === "paid" || paymentStatus === "unpaid") {
      params.set("paymentStatus", paymentStatus);
    } else if (searchParams.get("filterUnpaid") === "1") {
      params.set("paymentStatus", "unpaid");
    }
    const deliveryStatus = searchParams.get("deliveryStatus");
    if (deliveryStatus === "delivered" || deliveryStatus === "undelivered") {
      params.set("deliveryStatus", deliveryStatus);
    } else if (searchParams.get("filterUndelivered") === "1") {
      params.set("deliveryStatus", "undelivered");
    }
    const printStatus = searchParams.get("printStatus");
    if (printStatus === "printed" || printStatus === "pending") {
      params.set("printStatus", printStatus);
    }
    const query = params.toString();
    return query ? `/sales?${query}` : "/sales";
  };

  const getApiErrorMessage = (error: unknown, fallbackMessage: string) => {
    if (axios.isAxiosError(error)) {
      const responseData = error.response?.data;
      if (typeof responseData === "string" && responseData.trim() !== "") {
        return responseData;
      }

      if (
        responseData &&
        typeof responseData === "object" &&
        "message" in responseData &&
        typeof responseData.message === "string"
      ) {
        return responseData.message;
      }
    }

    return fallbackMessage;
  };

  const setCategoryProcessing = (
    category: SaleAttachmentCategory,
    active: boolean,
  ) => {
    setProcessingCategories((prev) => {
      if (active) {
        return prev.includes(category) ? prev : [...prev, category];
      }

      return prev.filter((item) => item !== category);
    });
  };

  const handleFilesSelected = async (
    category: SaleAttachmentCategory,
    files: File[],
  ) => {
    setCategoryProcessing(category, true);

    try {
      const nextPendingAttachments = await buildPendingSaleAttachments(
        files,
        category,
      );
      setPendingAttachments((prev) => [...prev, ...nextPendingAttachments]);
    } catch (error) {
      await showAlert(
        "Erro",
        error instanceof Error
          ? error.message
          : "Falha ao preparar os arquivos.",
        "error",
      );
    } finally {
      setCategoryProcessing(category, false);
    }
  };

  const handleRemoveExistingAttachment = (storageId: string) => {
    setExistingAttachments((prev) =>
      prev.filter((attachment) => attachment.storageId !== storageId),
    );
  };

  const handleRemovePendingAttachment = (localId: string) => {
    setPendingAttachments((prev) => {
      const targetAttachment = prev.find(
        (attachment) => attachment.localId === localId,
      );

      if (targetAttachment) {
        revokePendingSaleAttachmentPreview(targetAttachment);
      }

      return prev.filter((attachment) => attachment.localId !== localId);
    });
  };

  const clearPendingAttachments = () => {
    revokePendingSaleAttachmentPreviews(pendingAttachmentsRef.current);
    pendingAttachmentsRef.current = [];
    setPendingAttachments([]);
  };

  const buildSalePayload = () => {
    const { baseCost, costDetails, ...saleData } = formData;

    return {
      ...saleData,
      attachments: existingAttachments,
      massGrams: massGramsValue,
      printTimeHours: parseDurationToHours(formData.designPrintTime),
      deliveryDate: formData.deliveryDate === "" ? null : formData.deliveryDate,
      printStartConfirmedAt:
        formData.printStartConfirmedAt === ""
          ? null
          : formData.printStartConfirmedAt,
      designStartConfirmedAt:
        formData.designStartConfirmedAt === ""
          ? null
          : formData.designStartConfirmedAt,
      designTimeHours: Number(formData.designTimeHours) || 0,
      designResponsible: formData.designResponsible || "",
      designValue: Number(formData.designValue) || 0,
      paintStartConfirmedAt:
        formData.paintStartConfirmedAt === ""
          ? null
          : formData.paintStartConfirmedAt,
      paintTimeHours: Number(formData.paintTimeHours) || 0,
      paintResponsible: formData.paintResponsible || "",
      filamentId:
        formData.filamentId && formData.filamentId.length === 24
          ? formData.filamentId
          : null,
      clientId:
        formData.clientId && formData.clientId.length === 24
          ? formData.clientId
          : null,
      stockItemId: stockId || null,
    };
  };

  useEffect(() => {
    const fetchData = async () => {
      setOptionsLoading(true);

      try {
        const [filamentsRes, clientsRes, providersRes] = await Promise.all([
          axios.get("http://localhost:5000/api/filaments"),
          axios.get("http://localhost:5000/api/clients"),
          axios
            .get("http://localhost:5000/api/service-providers")
            .catch(() => ({ data: [] })),
        ]);
        setFilaments(filamentsRes.data);
        setClients(clientsRes.data);
        setServiceProviders(providersRes.data || []);

        // If coming from stock, fetch stock details
        if (stockId) {
          const stockRes = await axios.get(
            `http://localhost:5000/api/stock/${stockId}`,
          );
          const stockItem = stockRes.data;

          // Map old quality values
          let quality = stockItem.printQuality || "Normal";
          if (quality === "Draft") quality = "Baixo";
          if (quality === "Standard") quality = "Normal";
          if (quality === "High") quality = "Alto";
          if (quality === "Ultra") quality = "Extremo";

          setFormData((prev) => ({
            ...prev,
            description: stockItem.description,
            filamentId: stockItem.filamentId,
            massGrams: stockItem.weightGrams,
            baseCost: stockItem.productionCost || 0,
            productionCost: stockItem.productionCost || 0,
            designPrintTime: stockItem.printTime,
            printQuality: quality,
            printStatus: "Concluded", // Stock items are already printed
            isPrintConcluded: true,
            hasCustomArt: stockItem.hasCustomArt || false,
            hasPainting: stockItem.hasPainting || false,
            hasVarnish: stockItem.hasVarnish || false,
          }));
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setOptionsLoading(false);
      }
    };
    fetchData();
  }, [stockId]);

  const massGramsValue = parseMassGrams(formData.massGrams);

  const filteredFilaments =
    massGramsValue > 0
      ? filaments.filter(
          (filament) => filament.remainingMassGrams >= massGramsValue,
        )
      : [];
  const designerProviders = serviceProviders.filter((provider) =>
    isDesignerCategory(
      provider.categories && provider.categories.length > 0
        ? provider.categories
        : provider.category
          ? [provider.category]
          : [],
    ),
  );
  const painterProviders = serviceProviders.filter((provider) =>
    isPainterCategory(
      provider.categories && provider.categories.length > 0
        ? provider.categories
        : provider.category
          ? [provider.category]
          : [],
    ),
  );
  const normalizedDesignResponsible = formData.designResponsible
    .trim()
    .toLowerCase();
  const normalizedPaintResponsible = formData.paintResponsible
    .trim()
    .toLowerCase();
  const hasDesignOption =
    normalizedDesignResponsible !== "" &&
    designerProviders.some(
      (provider) =>
        provider.name.trim().toLowerCase() === normalizedDesignResponsible,
    );
  const hasPaintOption =
    normalizedPaintResponsible !== "" &&
    painterProviders.some(
      (provider) =>
        provider.name.trim().toLowerCase() === normalizedPaintResponsible,
    );
  const printStatusLabels: Record<string, string> = {
    Pending: "Pendente",
    InQueue: "Na fila",
    Staged: "Preparado",
    InProgress: "Em andamento",
    Concluded: "Concluído",
  };
  const selectedPrintScheduleLabel = formData.printStartConfirmedAt
    ? new Date(formData.printStartConfirmedAt).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Nenhum horário selecionado";
  const mobileAdvancedSummary = `${formData.printQuality} • ${printStatusLabels[formData.printStatus] ?? formData.printStatus}`;
  const productionCostValue = Number(
    formData.productionCost || formData.baseCost || 0,
  );

  useEffect(() => {
    if (formData.filamentId === "") return;
    const selected = filaments.find(
      (filament) => filament.id === formData.filamentId,
    );
    if (
      !selected ||
      massGramsValue <= 0 ||
      selected.remainingMassGrams < massGramsValue
    ) {
      setFormData((prev) => ({ ...prev, filamentId: "" }));
    }
  }, [massGramsValue, formData.filamentId, filaments]);

  // Calculate cost and suggested price automatically
  useEffect(() => {
    const calculatePrice = async () => {
      const isValidFilamentId =
        typeof formData.filamentId === "string" &&
        formData.filamentId.length === 24;
      if (!isValidFilamentId || massGramsValue <= 0) return;

      const hours = parseDurationToHours(formData.designPrintTime);
      const level =
        DETAIL_LEVELS.find((l) => l.label === formData.printQuality)?.value ??
        1;

      try {
        const res = await axios.post(
          "http://localhost:5000/api/budget/calculate",
          {
            filamentId: formData.filamentId,
            detailLevel: level,
            massGrams: massGramsValue,
            hasCustomArt: formData.hasCustomArt,
            hasPainting: formData.hasPainting,
            hasVarnish: formData.hasVarnish,
            printTimeHours: hours > 0 ? hours : undefined,
            nozzleDiameter: formData.nozzleDiameter,
            layerHeight: formData.layerHeight,
          },
        );

        setFormData((prev) => ({
          ...prev,
          baseCost: res.data.totalProductionCost,
          productionCost: res.data.totalProductionCost,
          saleValue: res.data.totalPrice,
          nozzleDiameter: res.data.nozzleDiameter,
          layerHeight: res.data.layerHeightRange,
          costDetails: {
            breakdown: res.data.breakdown,
            materialCost: res.data.materialCost,
            energyCost: res.data.energyCost,
            machineCost: res.data.machineCost,
          },
        }));
      } catch (err) {
        console.error("Error calculating price", err);
      }
    };

    const timeoutId = setTimeout(() => {
      calculatePrice();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    formData.filamentId,
    formData.massGrams,
    formData.printQuality,
    formData.designPrintTime,
    formData.hasCustomArt,
    formData.hasPainting,
    formData.hasVarnish,
    formData.nozzleDiameter,
    formData.layerHeight,
  ]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => {
        if (
          name === "paintTimeHours" ||
          name === "designTimeHours" ||
          name === "designValue" ||
          name === "shippingCost"
        ) {
          return { ...prev, [name]: parseNumericValue(value) };
        }
        return { ...prev, [name]: value };
      });
    }
  };

  useEffect(() => {
    setFormData((prev) => {
      const totalCost =
        parseNumericValue(prev.baseCost) + parseNumericValue(prev.shippingCost);
      return prev.cost === totalCost ? prev : { ...prev, cost: totalCost };
    });
  }, [formData.baseCost, formData.shippingCost]);

  // Auto-calculate profit (UI only, based on current form values)
  useEffect(() => {
    const profit = getSaleProfitValue({
      saleValue: formData.saleValue,
      cost: formData.cost,
      shippingCost: formData.shippingCost,
      baseCost: formData.baseCost,
    });
    const profitPercent = formatSaleProfitPercentage({
      saleValue: formData.saleValue,
      cost: formData.cost,
      shippingCost: formData.shippingCost,
      baseCost: formData.baseCost,
    });

    setFormData((prev) => ({
      ...prev,
      profit: profit,
      profitPercentage: profitPercent,
    }));
  }, [formData.cost, formData.saleValue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = buildSalePayload();
      const multipartData = new FormData();
      multipartData.append("sale", JSON.stringify(payload));
      appendPendingAttachmentsToFormData(multipartData, pendingAttachments);

      await axios.post(
        "http://localhost:5000/api/sales/with-media",
        multipartData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );
      clearPendingAttachments();

      // If it came from stock, update stock status to Sold
      if (stockId) {
        try {
          const stockRes = await axios.get(
            `http://localhost:5000/api/stock/${stockId}`,
          );
          await axios.put(`http://localhost:5000/api/stock/${stockId}`, {
            ...stockRes.data,
            status: "Sold",
          });
        } catch (err) {
          console.error("Error updating stock status", err);
        }
      }

      router.push(buildReturnToSalesUrl());
    } catch (error) {
      console.error("Error creating sale:", error);
      await showAlert(
        "Erro",
        getApiErrorMessage(error, "Erro ao criar venda"),
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-0">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-purple mb-6 md:mb-8 border-b-2 border-brand-orange pb-4">
        Nova Venda
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-3 md:p-8 rounded-xl shadow-sm border border-gray-100 space-y-5 md:space-y-6"
      >
        {optionsLoading && (
          <div className="rounded-xl border border-brand-purple/10 bg-brand-purple/5 px-4 py-3 text-sm text-brand-purple flex items-start gap-3">
            <svg
              className="mt-0.5 h-4 w-4 animate-spin shrink-0"
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
            <div>
              <p className="font-medium">
                Carregando dados auxiliares da venda...
              </p>
              <p className="text-xs text-brand-purple/80">
                Filamentos, clientes e prestadores serão liberados assim que o
                backend responder.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Description */}
          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descricao do Produto
            </label>
            <input
              type="text"
              name="description"
              required
              value={formData.description}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
            />
          </div>

          {/* Mass */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Massa (g)
            </label>
            <input
              type="number"
              name="massGrams"
              step="0.1"
              value={formData.massGrams}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
            />
          </div>

          {/* Filament */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filamento
            </label>
            <FilamentSelect
              id="new-sale-filament-select"
              filaments={filteredFilaments}
              value={formData.filamentId}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, filamentId: value }))
              }
              loading={optionsLoading}
              loadingMessage="Buscando filamentos disponíveis..."
              emptyMessage={
                formData.massGrams > 0
                  ? "Nenhum filamento compatível com a massa informada."
                  : "Informe a massa para listar filamentos."
              }
              placeholder={
                formData.massGrams > 0
                  ? "Selecione um filamento..."
                  : "Informe a massa para listar filamentos"
              }
              disabled={formData.massGrams <= 0}
              showRemaining
              showType
            />
          </div>

          {/* Client */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente
            </label>
            <select
              name="clientId"
              value={formData.clientId}
              onChange={handleChange}
              disabled={optionsLoading && clients.length === 0}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
            >
              <option value="">
                {optionsLoading && clients.length === 0
                  ? "Carregando clientes..."
                  : clients.length === 0
                    ? "Nenhum cliente cadastrado"
                    : "Selecione um cliente..."}
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name || client.phoneNumber}
                </option>
              ))}
            </select>
          </div>

          {/* Sale Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data da Venda
            </label>
            <input
              type="date"
              name="saleDate"
              required
              value={formData.saleDate}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
            />
          </div>

          {/* Delivery Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data de Entrega
            </label>
            <input
              type="date"
              name="deliveryDate"
              value={formData.deliveryDate}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
            />
          </div>

          {/* Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tempo de Impressao
            </label>
            <input
              type="text"
              name="designPrintTime"
              placeholder="ex: 4h 30m"
              value={formData.designPrintTime}
              required
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
            />
          </div>

          {/* Extras */}
          <div className="col-span-1 md:col-span-2 pt-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Adicionais
            </label>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="hasCustomArt"
                  checked={formData.hasCustomArt}
                  onChange={handleChange}
                  className="w-5 h-5 text-brand-purple rounded focus:ring-brand-purple"
                />
                <span className="text-gray-700">Arte Personalizada</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="hasPainting"
                  checked={formData.hasPainting}
                  onChange={handleChange}
                  className="w-5 h-5 text-brand-purple rounded focus:ring-brand-purple"
                />
                <span className="text-gray-700">Pintura</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="hasVarnish"
                  checked={formData.hasVarnish}
                  onChange={handleChange}
                  className="w-5 h-5 text-brand-purple rounded focus:ring-brand-purple"
                />
                <span className="text-gray-700">Verniz</span>
              </label>
            </div>
          </div>

          {formData.hasCustomArt && (
            <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Responsavel pelo Design
                </label>
                <select
                  name="designResponsible"
                  value={formData.designResponsible}
                  onChange={handleChange}
                  disabled={optionsLoading && designerProviders.length === 0}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
                >
                  <option value="">
                    {optionsLoading && designerProviders.length === 0
                      ? "Carregando responsaveis..."
                      : designerProviders.length === 0
                        ? "Nenhum responsavel disponível"
                        : "Selecione um responsavel..."}
                  </option>
                  {!hasDesignOption && formData.designResponsible && (
                    <option value={formData.designResponsible}>
                      {formData.designResponsible}
                    </option>
                  )}
                  {designerProviders.map((provider) => (
                    <option key={provider.id} value={provider.name}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tempo de Design (h)
                </label>
                <input
                  type="number"
                  name="designTimeHours"
                  step="0.1"
                  min="0"
                  value={formData.designTimeHours}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor do Design (R$)
                </label>
                <input
                  type="number"
                  name="designValue"
                  step="0.01"
                  min="0"
                  value={formData.designValue}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
                />
              </div>
            </div>
          )}

          {formData.hasPainting && (
            <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Responsavel pela Pintura
                </label>
                <select
                  name="paintResponsible"
                  value={formData.paintResponsible}
                  onChange={handleChange}
                  disabled={optionsLoading && painterProviders.length === 0}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
                >
                  <option value="">
                    {optionsLoading && painterProviders.length === 0
                      ? "Carregando responsaveis..."
                      : painterProviders.length === 0
                        ? "Nenhum responsavel disponível"
                        : "Selecione um responsavel..."}
                  </option>
                  {!hasPaintOption && formData.paintResponsible && (
                    <option value={formData.paintResponsible}>
                      {formData.paintResponsible}
                    </option>
                  )}
                  {painterProviders.map((provider) => (
                    <option key={provider.id} value={provider.name}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tempo de Pintura (h)
                </label>
                <input
                  type="number"
                  name="paintTimeHours"
                  step="0.1"
                  min="0"
                  value={formData.paintTimeHours}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
                />
              </div>
            </div>
          )}

          <div className="col-span-1 md:col-span-2">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 md:p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm md:text-base font-bold text-brand-purple">
                    Agenda de impressão
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    {isMobile
                      ? `Horário atual: ${selectedPrintScheduleLabel}`
                      : "Escolha um horário para impressão e serviços adicionais."}
                  </p>
                </div>
                {isMobile && (
                  <button
                    type="button"
                    onClick={() => setShowMobileSchedule((prev) => !prev)}
                    className="shrink-0 rounded-lg border border-brand-purple/20 bg-white px-3 py-2 text-xs font-semibold text-brand-purple"
                  >
                    {showMobileSchedule ? "Ocultar agenda" : "Abrir agenda"}
                  </button>
                )}
              </div>

              {(!isMobile || showMobileSchedule) && (
                <PrintScheduleCalendar
                  estimatedHours={parseDurationToHours(
                    formData.designPrintTime,
                  )}
                  hasCustomArt={formData.hasCustomArt}
                  hasPainting={formData.hasPainting}
                  showDesign={formData.hasCustomArt}
                  showPainting={formData.hasPainting}
                  value={formData.printStartConfirmedAt}
                  onChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      printStartConfirmedAt: value || "",
                    }))
                  }
                  designHours={Number(formData.designTimeHours) || 0}
                  designStartValue={formData.designStartConfirmedAt}
                  onDesignChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      designStartConfirmedAt: value || "",
                    }))
                  }
                  designResponsible={formData.designResponsible}
                  paintHours={Number(formData.paintTimeHours) || 0}
                  paintValue={formData.paintStartConfirmedAt}
                  onPaintChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      paintStartConfirmedAt: value || "",
                    }))
                  }
                  paintResponsible={formData.paintResponsible}
                  layout={isMobile ? "stacked" : "auto"}
                  showSuggestionSummary={!isMobile}
                />
              )}
            </div>
          </div>

          <div className="col-span-1 md:col-span-2">
            {isMobile ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-3">
                <button
                  type="button"
                  onClick={() => setShowMobileAdvanced((prev) => !prev)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div>
                    <p className="text-sm font-bold text-gray-800">
                      Configurações avançadas
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {mobileAdvancedSummary}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-brand-purple">
                    {showMobileAdvanced ? "Ocultar" : "Mostrar"}
                  </span>
                </button>

                {showMobileAdvanced && (
                  <div className="grid grid-cols-1 gap-4 pt-1">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Link do Produto (STL)
                      </label>
                      <input
                        type="url"
                        name="productLink"
                        value={formData.productLink ?? ""}
                        onChange={handleChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="mobile-print-quality"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Qualidade de Impressao
                      </label>
                      <select
                        id="mobile-print-quality"
                        name="printQuality"
                        value={formData.printQuality}
                        onChange={handleChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
                      >
                        {DETAIL_LEVELS.map((level) => (
                          <option key={level.value} value={level.label}>
                            {level.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="mobile-print-status"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Status da Impressao
                      </label>
                      <select
                        id="mobile-print-status"
                        name="printStatus"
                        value={formData.printStatus}
                        onChange={handleChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
                      >
                        <option value="Pending">Pendente</option>
                        <option value="InQueue">Na Fila</option>
                        <option value="Staged">Preparado</option>
                        <option value="InProgress">Em Andamento</option>
                        <option value="Concluded">Concluído</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Link do Produto (STL)
                  </label>
                  <input
                    type="url"
                    name="productLink"
                    value={formData.productLink ?? ""}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="desktop-print-quality"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Qualidade de Impressao
                  </label>
                  <select
                    id="desktop-print-quality"
                    name="printQuality"
                    value={formData.printQuality}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
                  >
                    {DETAIL_LEVELS.map((level) => (
                      <option key={level.value} value={level.label}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="desktop-print-status"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Status da Impressao
                  </label>
                  <select
                    id="desktop-print-status"
                    name="printStatus"
                    value={formData.printStatus}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
                  >
                    <option value="Pending">Pendente</option>
                    <option value="InQueue">Na Fila</option>
                    <option value="Staged">Preparado</option>
                    <option value="InProgress">Em Andamento</option>
                    <option value="Concluded">Concluído</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Cost Details */}
          <div className="col-span-1 md:col-span-2 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
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
                    d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  ></path>
                </svg>
                Detalhamento de Custos
              </h3>
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setShowMobileCostDetails((prev) => !prev)}
                  className="text-xs font-semibold text-brand-purple"
                >
                  {showMobileCostDetails ? "Ocultar ajustes" : "Ver ajustes"}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-4">
              <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                <span className="block text-xs text-gray-500 uppercase font-bold mb-1">
                  Custo de Produção
                </span>
                <span className="text-lg font-bold text-gray-800">
                  R$ {productionCostValue.toFixed(2)}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                <label
                  htmlFor="sale-shipping-cost"
                  className="block text-xs text-gray-500 uppercase font-bold mb-1"
                >
                  Frete
                </label>
                <input
                  id="sale-shipping-cost"
                  type="number"
                  name="shippingCost"
                  step="0.01"
                  min="0"
                  value={formData.shippingCost}
                  onChange={handleChange}
                  className="w-full text-sm font-medium text-gray-800 border-b border-gray-200 focus:border-brand-purple focus:outline-none"
                  placeholder="0.00"
                />
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                <span className="block text-xs text-gray-500 uppercase font-bold mb-1">
                  Custo Total
                </span>
                <span className="text-lg font-bold text-gray-800">
                  R$ {(formData.cost || 0).toFixed(2)}
                </span>
              </div>
              <div
                className={`bg-white p-3 rounded-lg border border-gray-100 shadow-sm ${isMobile && !showMobileCostDetails ? "hidden" : ""}`}
              >
                <span className="block text-xs text-gray-500 uppercase font-bold mb-1">
                  Nozzle
                </span>
                <input
                  type="text"
                  name="nozzleDiameter"
                  value={formData.nozzleDiameter}
                  onChange={handleChange}
                  className="w-full text-sm font-medium text-gray-800 border-b border-gray-200 focus:border-brand-purple focus:outline-none"
                  placeholder="0.4mm"
                />
              </div>
              <div
                className={`bg-white p-3 rounded-lg border border-gray-100 shadow-sm ${isMobile && !showMobileCostDetails ? "hidden" : ""}`}
              >
                <span className="block text-xs text-gray-500 uppercase font-bold mb-1">
                  Camada
                </span>
                <input
                  type="text"
                  name="layerHeight"
                  value={formData.layerHeight}
                  onChange={handleChange}
                  className="w-full text-sm font-medium text-gray-800 border-b border-gray-200 focus:border-brand-purple focus:outline-none"
                  placeholder="0.2mm"
                />
              </div>
            </div>

            {(!isMobile || showMobileCostDetails) &&
              (formData.costDetails ||
                formData.shippingCost > 0 ||
                formData.cost > 0) && (
                <div className="space-y-3">
                  {formData.costDetails && (
                    <>
                      <div className="flex justify-between text-xs text-gray-600 border-b border-gray-200 pb-2">
                        <span>Material</span>
                        <span className="font-medium">
                          R${" "}
                          {(formData.costDetails.materialCost || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-600 border-b border-gray-200 pb-2">
                        <span>Energia</span>
                        <span className="font-medium">
                          R$ {(formData.costDetails.energyCost || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-600 border-b border-gray-200 pb-2">
                        <span>Máquina (Depreciação)</span>
                        <span className="font-medium">
                          R${" "}
                          {(formData.costDetails.machineCost || 0).toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-xs text-gray-600 border-b border-gray-200 pb-2">
                    <span>Frete</span>
                    <span className="font-medium">
                      R$ {(formData.shippingCost || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-800 font-semibold border-b border-gray-200 pb-2">
                    <span>Custo Total</span>
                    <span>R$ {(formData.cost || 0).toFixed(2)}</span>
                  </div>

                  {formData.costDetails && (
                    <div className="mt-3 pt-2">
                      <p className="text-xs font-bold text-gray-700 mb-1">
                        Cálculo da Margem:
                      </p>
                      <pre className="text-[10px] text-gray-500 whitespace-pre-wrap font-mono bg-white p-2 rounded border border-gray-100">
                        {formData.costDetails.breakdown}
                      </pre>
                    </div>
                  )}
                </div>
              )}
          </div>

          {/* Sale Value & Profit */}
          <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="sale-value"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Valor de Venda (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">
                  R$
                </span>
                <input
                  id="sale-value"
                  type="number"
                  name="saleValue"
                  step="0.01"
                  value={formData.saleValue}
                  onChange={handleChange}
                  className="w-full pl-10 p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-purple focus:border-transparent text-lg font-bold text-green-700"
                />
              </div>
            </div>

            <div>
              <p className="block text-sm font-medium text-gray-700 mb-1">
                Lucro Estimado
              </p>
              <div
                className={`p-3 rounded-xl border flex justify-between items-center ${formData.profit >= 0 ? "bg-green-50 border-green-100 text-green-800" : "bg-red-50 border-red-100 text-red-800"}`}
              >
                <span className="font-bold text-lg">
                  R$ {formData.profit.toFixed(2)}
                </span>
                <span className="text-sm font-medium bg-white/50 px-2 py-1 rounded-lg">
                  {formData.profitPercentage}
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Margem calculada sobre o custo de producao. O frete fica fora da
                base percentual.
              </p>
            </div>
          </div>

          <SaleAttachmentsPanel
            existingAttachments={existingAttachments}
            pendingAttachments={pendingAttachments}
            processingCategories={processingCategories}
            onFilesSelected={handleFilesSelected}
            onRemoveExisting={handleRemoveExistingAttachment}
            onRemovePending={handleRemovePendingAttachment}
          />
        </div>

        {/* Checkboxes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-gray-100">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="isPrintConcluded"
              checked={formData.isPrintConcluded}
              onChange={handleChange}
              className="w-5 h-5 text-brand-purple rounded focus:ring-brand-purple"
            />
            <span className="text-gray-700">Impressão Concluída</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="isDelivered"
              checked={formData.isDelivered}
              onChange={handleChange}
              className="w-5 h-5 text-brand-purple rounded focus:ring-brand-purple"
            />
            <span className="text-gray-700">Entregue</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="isPaid"
              checked={formData.isPaid}
              onChange={handleChange}
              className="w-5 h-5 text-brand-purple rounded focus:ring-brand-purple"
            />
            <span className="text-gray-700">Pago</span>
          </label>
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4 pt-6">
          <button
            type="button"
            onClick={() => router.push(buildReturnToSalesUrl())}
            className="w-full sm:w-auto px-6 py-3 sm:py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-6 py-3 sm:py-2 bg-brand-purple text-white rounded-lg hover:bg-purple-800 transition-colors disabled:opacity-50"
          >
            {loading ? "Salvando..." : "Salvar Venda"}
          </button>
        </div>
      </form>
    </div>
  );
}
