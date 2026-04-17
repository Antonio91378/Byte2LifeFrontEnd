"use client";

import FilamentSelect from "@/components/FilamentSelect";
import PrintScheduleCalendar from "@/components/PrintScheduleCalendar";
import { DETAIL_LEVELS } from "@/constants/printQuality";
import { parseDurationToHours } from "@/utils/time";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, use, useEffect, useState } from "react";

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

export default function EditSalePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <EditSaleContent params={params} />
    </Suspense>
  );
}

function EditSaleContent({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { id } = use(params);

  const parseMassGrams = (value: string | number) => {
    const normalized = String(value ?? "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>(
    [],
  );
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    description: "",
    productLink: "",
    printQuality: "Normal",
    massGrams: 0,
    cost: 0,
    saleValue: 0,
    profit: 0,
    profitPercentage: "",
    designPrintTime: "",
    isPrintConcluded: false,
    isDelivered: false,
    isPaid: false,
    filamentId: "",
    clientId: "",
    saleDate: "",
    deliveryDate: "",
    printStatus: "Pending",
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
    nozzleDiameter: "",
    layerHeight: "",
    costDetails: null as any,
    incidents: [],
    tags: [],
    priority: 0,
    printStartedAt: null,
    printStartScheduledAt: null,
    printStartConfirmedAt: "",
    errorReason: null,
    wastedFilamentGrams: null,
    stockItemId: null,
  });

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
    const filterClientId = searchParams.get("filterClientId");
    if (filterClientId) {
      params.set("filterClientId", filterClientId);
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [filamentsRes, clientsRes, providersRes, saleRes] =
          await Promise.all([
            axios.get("http://localhost:5000/api/filaments"),
            axios.get("http://localhost:5000/api/clients"),
            axios
              .get("http://localhost:5000/api/service-providers")
              .catch(() => ({ data: [] })),
            axios.get(`http://localhost:5000/api/sales/${id}`),
          ]);

        setFilaments(filamentsRes.data);
        setClients(clientsRes.data);
        setServiceProviders(providersRes.data || []);

        const sale = saleRes.data;

        // Map old quality values
        let quality = sale.printQuality || "Normal";
        if (quality === "Draft") quality = "Baixo";
        if (quality === "Standard") quality = "Normal";
        if (quality === "High") quality = "Alto";
        if (quality === "Ultra") quality = "Extremo";

        setFormData({
          description: sale.description,
          productLink: sale.productLink || "",
          printQuality: quality,
          massGrams: sale.massGrams,
          cost: sale.cost,
          saleValue: sale.saleValue,
          profit: sale.profit,
          profitPercentage: sale.profitPercentage,
          designPrintTime: sale.designPrintTime || "",
          isPrintConcluded: sale.isPrintConcluded,
          isDelivered: sale.isDelivered,
          isPaid: sale.isPaid,
          filamentId: sale.filamentId || "",
          clientId: sale.clientId || "",
          saleDate: sale.saleDate ? sale.saleDate.split("T")[0] : "",
          deliveryDate: sale.deliveryDate
            ? sale.deliveryDate.split("T")[0]
            : "",
          printStatus: sale.printStatus || "Pending",
          hasCustomArt: sale.hasCustomArt || false,
          hasPainting: sale.hasPainting || false,
          hasVarnish: sale.hasVarnish || false,
          designTimeHours: sale.designTimeHours || 0,
          designResponsible: sale.designResponsible || "",
          designStartConfirmedAt: sale.designStartConfirmedAt || "",
          designValue: sale.designValue || 0,
          paintTimeHours: sale.paintTimeHours || 0,
          paintResponsible: sale.paintResponsible || "",
          paintStartConfirmedAt: sale.paintStartConfirmedAt || "",
          productionCost: sale.productionCost || 0,
          nozzleDiameter: sale.nozzleDiameter || "",
          layerHeight: sale.layerHeight || "",
          costDetails: null, // Will be recalculated
          incidents: sale.incidents || [],
          tags: sale.tags || [],
          priority: sale.priority || 0,
          printStartedAt: sale.printStartedAt || null,
          printStartScheduledAt: sale.printStartScheduledAt || null,
          printStartConfirmedAt: sale.printStartConfirmedAt || "",
          errorReason: sale.errorReason || null,
          wastedFilamentGrams: sale.wastedFilamentGrams || null,
          stockItemId: sale.stockItemId || null,
        });
      } catch (error) {
        console.error("Error fetching data:", error);
        alert("Erro ao carregar dados da venda");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

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

        // Only update if not loading (to avoid overwriting initial data immediately if we wanted to preserve it)
        // But here we want to update to current rules
        setFormData((prev) => ({
          ...prev,
          cost: res.data.materialCost,
          // saleValue: res.data.totalPrice, // Don't overwrite sale value on edit, user might have set a custom price
          productionCost: res.data.totalProductionCost,
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

    if (!loading) {
      const timeoutId = setTimeout(() => {
        calculatePrice();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
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
    loading,
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
        const updates: any = { [name]: value };
        if (
          name === "paintTimeHours" ||
          name === "designTimeHours" ||
          name === "designValue"
        ) {
          updates[name] = Number(value);
        }
        // If quality changes, clear manual overrides so defaults are recalculated
        if (name === "printQuality") {
          updates.nozzleDiameter = "";
          updates.layerHeight = "";
        }
        return { ...prev, ...updates };
      });
    }
  };

  // Auto-calculate profit
  useEffect(() => {
    const profit = Number(formData.saleValue) - Number(formData.cost);
    const profitPercent =
      formData.cost > 0
        ? ((profit / Number(formData.cost)) * 100).toFixed(2) + "%"
        : "0%";

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
      const payload = {
        ...formData,
        massGrams: massGramsValue,
        printTimeHours: parseDurationToHours(formData.designPrintTime),
        deliveryDate:
          formData.deliveryDate === "" ? null : formData.deliveryDate,
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
      };
      await axios.put(`http://localhost:5000/api/sales/${id}`, payload);
      router.push(buildReturnToSalesUrl());
    } catch (error) {
      console.error("Error updating sale:", error);
      alert("Erro ao atualizar venda");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-12">Carregando...</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-0">
      <h1 className="text-3xl font-bold text-brand-purple mb-8 border-b-2 border-brand-orange pb-4">
        Editar Venda
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-4 md:p-8 rounded-xl shadow-sm border border-gray-100 space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              filaments={filteredFilaments}
              value={formData.filamentId}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, filamentId: value }))
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
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
                >
                  <option value="">Selecione um responsavel...</option>
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
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
                >
                  <option value="">Selecione um responsavel...</option>
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
            <PrintScheduleCalendar
              estimatedHours={parseDurationToHours(formData.designPrintTime)}
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
              saleId={id}
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
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
            >
              <option value="">Selecione um cliente...</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name || client.phoneNumber}
                </option>
              ))}
            </select>
          </div>

          {/* Product Link */}
          <div className="col-span-1 md:col-span-2">
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

          {/* Print Quality */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Qualidade de Impressao
            </label>
            <select
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

          {/* Print Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status da Impressao
            </label>
            <select
              name="printStatus"
              value={formData.printStatus}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
            >
              <option value="Pending">Pendente</option>
              <option value="InQueue">Na Fila</option>
              <option value="Staged">Preparado</option>
              <option value="InProgress">Em Progresso</option>
              <option value="Concluded">Concluido</option>
            </select>
          </div>

          {/* Cost Details */}
          <div className="col-span-1 md:col-span-2 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                <span className="block text-xs text-gray-500 uppercase font-bold mb-1">
                  Custo de Produção
                </span>
                <span className="text-lg font-bold text-gray-800">
                  R$ {(formData.productionCost || 0).toFixed(2)}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
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
              <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
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

            {formData.costDetails && (
              <div className="space-y-3">
                <div className="flex justify-between text-xs text-gray-600 border-b border-gray-200 pb-2">
                  <span>Material</span>
                  <span className="font-medium">
                    R$ {(formData.costDetails.materialCost || 0).toFixed(2)}
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
                    R$ {(formData.costDetails.machineCost || 0).toFixed(2)}
                  </span>
                </div>

                <div className="mt-3 pt-2">
                  <p className="text-xs font-bold text-gray-700 mb-1">
                    Cálculo da Margem:
                  </p>
                  <pre className="text-[10px] text-gray-500 whitespace-pre-wrap font-mono bg-white p-2 rounded border border-gray-100">
                    {formData.costDetails.breakdown}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Cost */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Custo Material (R$)
            </label>
            <input
              type="number"
              name="cost"
              step="0.01"
              value={formData.cost}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900 bg-gray-50"
              readOnly
            />
          </div>

          {/* Sale Value */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valor de Venda (R$)
            </label>
            <input
              type="number"
              name="saleValue"
              step="0.01"
              value={formData.saleValue}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
            />
          </div>

          {/* Profit (Read Only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lucro Estimado
            </label>
            <div className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-600">
              R$ {formData.profit.toFixed(2)} ({formData.profitPercentage})
            </div>
          </div>
        </div>

        {/* Checkboxes */}
        <div className="flex flex-wrap gap-6 pt-4 border-t border-gray-100">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="isPrintConcluded"
              checked={formData.isPrintConcluded}
              onChange={handleChange}
              className="w-5 h-5 text-brand-purple rounded focus:ring-brand-purple"
            />
            <span className="text-gray-700">Impressao Concluida</span>
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

        <div className="flex justify-end gap-4 pt-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-brand-purple text-white rounded-lg hover:bg-purple-800 transition-colors disabled:opacity-50"
          >
            {loading ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>
      </form>
    </div>
  );
}
