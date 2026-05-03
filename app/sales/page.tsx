"use client";

import Modal from "@/components/Modal";
import { useDialog } from "@/context/DialogContext";
import {
    formatFilamentDisplayName,
    mapSaleFilamentPayload,
} from "@/utils/filamentUsage";
import { getIncidentWasteEntries, getIncidentWasteTotal } from "@/utils/printWaste";
import { isSaleActive } from "@/utils/saleActivity";
import {
    getFirstProductImageUrl,
    SaleAttachment,
} from "@/utils/saleAttachments";
import axios from "axios";
import {
    Fragment,
    Suspense,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const INCIDENT_REASONS = [
  { value: "PowerLoss", label: "Queda de Energia" },
  { value: "FilamentJam", label: "Entupimento/Trava de Filamento" },
  { value: "LayerShift", label: "Deslocamento de Camada" },
  { value: "AdhesionIssue", label: "Problema de Aderência" },
  { value: "ManualPause", label: "Pausa Manual" },
  { value: "Maintenance", label: "Manutenção" },
  { value: "Other", label: "Outro" },
];

interface PrintIncident {
  timestamp: string;
  reason: string;
  comment: string;
  wastedFilamentGrams?: number | null;
  wastedFilaments?: Array<{
    filamentId?: string;
    massGrams?: number;
  }>;
}

interface Filament {
  id: string;
  description: string;
  color: string;
}

interface SaleFilamentUsage {
  filamentId?: string;
  massGrams?: number;
}

interface Client {
  id: string;
  name: string;
  phoneNumber: string;
}

interface Sale {
  id: string;
  description: string;
  saleValue: number;
  profit: number;
  isPaid: boolean;
  isDelivered: boolean;
  isPrintConcluded: boolean;
  saleDate?: string;
  deliveryDate?: string;
  printStartScheduledAt?: string;
  printStartConfirmedAt?: string;
  productLink?: string;
  clientId?: string;
  filamentId?: string;
  filaments?: SaleFilamentUsage[];
  printQuality?: string;
  massGrams?: number;
  cost?: number;
  shippingCost?: number;
  designPrintTime?: string;
  incidents?: PrintIncident[];
  attachments?: SaleAttachment[];
  isActive?: boolean | null;
}

export default function SalesPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <SalesPageContent />
    </Suspense>
  );
}

function SalesPageContent() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const [filterDate, setFilterDate] = useState("");
  const [filterType, setFilterType] = useState<"date" | "month">("date");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "unpaid">(
    "all",
  );
  const [deliveryFilter, setDeliveryFilter] = useState<
    "all" | "delivered" | "undelivered"
  >("all");
  const [printFilter, setPrintFilter] = useState<"all" | "printed" | "pending">(
    "all",
  );
  const [activityFilter, setActivityFilter] = useState<"all" | "inactive">(
    "all",
  );
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const [filterClientId, setFilterClientId] = useState<string>("");
  const [filterClientName, setFilterClientName] = useState("");
  const [filterProductName, setFilterProductName] = useState("");
  const [showIncidentsModal, setShowIncidentsModal] = useState<Sale | null>(
    null,
  );
  const [isAddingIncident, setIsAddingIncident] = useState(false);
  const [newIncidentReason, setNewIncidentReason] = useState("Other");
  const [newIncidentComment, setNewIncidentComment] = useState("");
  const [hideProfit, setHideProfit] = useState(false);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const { showAlert, showConfirm } = useDialog();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [salesRes, clientsRes, filamentsRes] = await Promise.all([
          axios.get("http://localhost:5000/api/sales"),
          axios.get("http://localhost:5000/api/clients"),
          axios.get("http://localhost:5000/api/filaments"),
        ]);
        setSales(salesRes.data);
        setClients(clientsRes.data);
        setFilaments(filamentsRes.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!searchParams) return;
    const nextFilterType = searchParams.get("filterType");
    if (nextFilterType === "date" || nextFilterType === "month") {
      setFilterType(nextFilterType);
    }
    const nextFilterDate = searchParams.get("filterDate");
    if (nextFilterDate !== null) {
      setFilterDate(nextFilterDate);
    }
    const nextFilterClientId = searchParams.get("filterClientId");
    if (nextFilterClientId !== null) {
      setFilterClientId(nextFilterClientId);
    }
    const nextFilterClientName = searchParams.get("filterClientName");
    if (nextFilterClientName !== null) {
      setFilterClientName(nextFilterClientName);
    }
    const nextFilterProductName = searchParams.get("filterProductName");
    if (nextFilterProductName !== null) {
      setFilterProductName(nextFilterProductName);
    }
    const nextPaymentStatus = searchParams.get("paymentStatus");
    if (nextPaymentStatus === "paid" || nextPaymentStatus === "unpaid") {
      setPaymentFilter(nextPaymentStatus);
    } else {
      const legacyUnpaid = searchParams.get("filterUnpaid");
      if (legacyUnpaid === "1") {
        setPaymentFilter("unpaid");
      }
    }
    const nextDeliveryStatus = searchParams.get("deliveryStatus");
    if (
      nextDeliveryStatus === "delivered" ||
      nextDeliveryStatus === "undelivered"
    ) {
      setDeliveryFilter(nextDeliveryStatus);
    } else {
      const legacyUndelivered = searchParams.get("filterUndelivered");
      if (legacyUndelivered === "1") {
        setDeliveryFilter("undelivered");
      }
    }
    const nextPrintStatus = searchParams.get("printStatus");
    if (nextPrintStatus === "printed" || nextPrintStatus === "pending") {
      setPrintFilter(nextPrintStatus);
    }

    const nextActivityStatus = searchParams.get("activityStatus");
    if (nextActivityStatus === "inactive") {
      setActivityFilter("inactive");
    } else {
      setActivityFilter("all");
    }

    const nextSortDirection = searchParams.get("sortDirection");
    if (nextSortDirection === "asc" || nextSortDirection === "desc") {
      setSortDirection(nextSortDirection);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isStatusFilterOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (filterMenuRef.current && !filterMenuRef.current.contains(target)) {
        setIsStatusFilterOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isStatusFilterOpen]);

  useEffect(() => {
    if (!filterClientId || filterClientName || clients.length === 0) {
      return;
    }

    const selectedClient = clients.find(
      (client) => client.id === filterClientId,
    );
    if (selectedClient) {
      setFilterClientName(selectedClient.name);
    }
  }, [clients, filterClientId, filterClientName]);

  const toggleExpand = (id: string) => {
    setExpandedSaleId(expandedSaleId === id ? null : id);
  };

  const getClientName = (id?: string) => {
    if (!id) return "N/A";
    const client = clients.find((c) => c.id === id);
    return client ? client.name : "Desconhecido";
  };

  const getFilamentName = (id?: string) => {
    if (!id) return "N/A";
    const filament = filaments.find((f) => f.id === id);
    return filament ? formatFilamentDisplayName(filament) : "Desconhecido";
  };

  const getSaleActivityLabel = (sale: Sale) =>
    isSaleActive(sale) ? "Ativa" : "Hibernando";

  const getSaleActivityClassName = (sale: Sale) =>
    isSaleActive(sale)
      ? "bg-emerald-100 text-emerald-800"
      : "border border-slate-300 bg-slate-200 text-slate-700";

  const getSaleStatusBadgeClassName = (sale: Sale, activeClassName: string) =>
    isSaleActive(sale)
      ? activeClassName
      : "border border-slate-300 bg-slate-200 text-slate-700";

  const resolveRequestErrorMessage = (
    error: unknown,
    fallbackMessage: string,
  ) => {
    if (axios.isAxiosError(error) && typeof error.response?.data === "string") {
      const responseMessage = error.response.data.trim();
      if (responseMessage) {
        return responseMessage;
      }
    }

    return fallbackMessage;
  };

  const updateSaleActivityState = (saleId: string, nextIsActive: boolean) => {
    setSales((prev) =>
      prev.map((item) =>
        item.id === saleId ? { ...item, isActive: nextIsActive } : item,
      ),
    );
    setShowIncidentsModal((prev) =>
      prev?.id === saleId ? { ...prev, isActive: nextIsActive } : prev,
    );
  };

  const togglePaymentFilter = (value: "paid" | "unpaid") => {
    setPaymentFilter((prev) => (prev === value ? "all" : value));
  };

  const toggleDeliveryFilter = (value: "delivered" | "undelivered") => {
    setDeliveryFilter((prev) => (prev === value ? "all" : value));
  };

  const togglePrintFilter = (value: "printed" | "pending") => {
    setPrintFilter((prev) => (prev === value ? "all" : value));
  };

  const toggleInactiveFilter = () => {
    setActivityFilter((prev) => (prev === "inactive" ? "all" : "inactive"));
  };

  const handleClientFilterChange = (value: string) => {
    setFilterClientName(value);

    const normalizedValue = value.trim().toLowerCase();
    if (!normalizedValue) {
      setFilterClientId("");
      return;
    }

    const exactMatch = clients.find(
      (client) => client.name.trim().toLowerCase() === normalizedValue,
    );
    setFilterClientId(exactMatch?.id || "");
  };

  const handleMoveToStock = (id: string) => {
    showConfirm(
      "Mover para Estoque",
      "Deseja mover esta venda para o estoque? A venda será removida da lista e um novo item de estoque será criado.",
      async () => {
        try {
          await axios.post(`http://localhost:5000/api/stock/from-sale/${id}`);
          setSales(sales.filter((s) => s.id !== id));
          showAlert("Sucesso", "Venda movida para o estoque!", "success");
        } catch (error) {
          console.error(error);
          showAlert("Erro", "Erro ao mover venda para estoque", "error");
        }
      },
    );
  };

  const handleDelete = (id: string) => {
    showConfirm(
      "Excluir Venda",
      "Tem certeza que deseja excluir esta venda?",
      async () => {
        try {
          await axios.delete(`http://localhost:5000/api/sales/${id}`);
          setSales(sales.filter((s) => s.id !== id));
          await showAlert("Sucesso", "Venda excluída com sucesso!", "success");
        } catch (error: any) {
          console.error(error);
          await showAlert("Erro", "Erro ao excluir venda", "error");
        }
      },
    );
  };

  const handleToggleStatus = async (
    sale: Sale,
    field: "isPrintConcluded" | "isDelivered" | "isPaid",
  ) => {
    const updatedSale: any = { ...sale, [field]: !sale[field] };
    try {
      await axios.put(
        `http://localhost:5000/api/sales/${sale.id}`,
        updatedSale,
      );
      setSales((prev) =>
        prev.map((item) =>
          item.id === sale.id ? { ...item, [field]: updatedSale[field] } : item,
        ),
      );
    } catch (error) {
      console.error(error);
      showAlert(
        "Erro",
        resolveRequestErrorMessage(
          error,
          "Falha ao atualizar status da venda.",
        ),
        "error",
      );
    }
  };

  const handleToggleActivity = (sale: Sale) => {
    const nextIsActive = !isSaleActive(sale);
    const title = nextIsActive ? "Reativar Venda" : "Hibernar Venda";
    const description = nextIsActive
      ? "Deseja reativar esta venda? Ela volta para as filas e contabilizacoes conforme o status atual."
      : "Deseja hibernar esta venda? Ela sai das filas e deixa de entrar nas contabilizacoes enquanto estiver inativa.";

    showConfirm(title, description, async () => {
      const updatedSale = { ...sale, isActive: nextIsActive };

      try {
        await axios.put(
          `http://localhost:5000/api/sales/${sale.id}`,
          updatedSale,
        );

        updateSaleActivityState(sale.id, nextIsActive);

        showAlert(
          "Sucesso",
          nextIsActive
            ? "Venda reativada com sucesso!"
            : "Venda hibernada e removida das filas.",
          "success",
        );
      } catch (error) {
        console.error(error);
        showAlert(
          "Erro",
          resolveRequestErrorMessage(
            error,
            "Falha ao atualizar o status da venda.",
          ),
          "error",
        );
      }
    });
  };

  const handleClone = async (sale: Sale) => {
    const payload: any = { ...sale };
    delete payload.id;
    payload.attachments = [];
    try {
      const res = await axios.post("http://localhost:5000/api/sales", payload);
      const created = res.data;
      if (created && created.id) {
        setSales((prev) => [created, ...prev]);
      } else {
        const listRes = await axios.get("http://localhost:5000/api/sales");
        setSales(listRes.data);
      }
      showAlert("Sucesso", "Venda clonada.", "success");
    } catch (error) {
      console.error(error);
      showAlert("Erro", "Falha ao clonar venda.", "error");
    }
  };

  const handleAddIncident = async () => {
    if (!showIncidentsModal) return;

    try {
      const newIncident = {
        timestamp: new Date().toISOString(),
        reason: newIncidentReason,
        comment: newIncidentComment,
      };

      const updatedIncidents = showIncidentsModal.incidents
        ? [...showIncidentsModal.incidents, newIncident]
        : [newIncident];
      const updatedSale = {
        ...showIncidentsModal,
        incidents: updatedIncidents,
      };

      await axios.put(
        `http://localhost:5000/api/sales/${showIncidentsModal.id}`,
        updatedSale,
      );

      // Update local state
      setSales(
        sales.map((s) => (s.id === showIncidentsModal.id ? updatedSale : s)),
      );
      setShowIncidentsModal(updatedSale);

      // Reset form
      setIsAddingIncident(false);
      setNewIncidentReason("Other");
      setNewIncidentComment("");

      showAlert("Sucesso", "Ocorrência adicionada!", "success");
    } catch (error) {
      console.error(error);
      showAlert("Erro", "Erro ao adicionar ocorrência", "error");
    }
  };

  const getSaleSortValue = (sale: Sale) => {
    if (sale.saleDate) {
      const parsedSaleDate = new Date(sale.saleDate).getTime();
      if (!Number.isNaN(parsedSaleDate)) {
        return parsedSaleDate;
      }
    }

    const objectIdPrefix = sale.id?.slice(0, 8);
    if (objectIdPrefix && /^[0-9a-fA-F]{8}$/.test(objectIdPrefix)) {
      return Number.parseInt(objectIdPrefix, 16) * 1000;
    }

    return 0;
  };

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const normalizedClientFilter = filterClientName.trim().toLowerCase();
      const normalizedProductFilter = filterProductName.trim().toLowerCase();

      if (
        filterClientId &&
        !normalizedClientFilter &&
        s.clientId !== filterClientId
      ) {
        return false;
      }
      if (normalizedClientFilter) {
        const clientName = getClientName(s.clientId).toLowerCase();
        if (!clientName.includes(normalizedClientFilter)) return false;
      }
      if (normalizedProductFilter) {
        const description = (s.description || "").toLowerCase();
        if (!description.includes(normalizedProductFilter)) return false;
      }
      if (paymentFilter === "paid" && !s.isPaid) return false;
      if (paymentFilter === "unpaid" && s.isPaid) return false;
      if (deliveryFilter === "delivered" && !s.isDelivered) return false;
      if (deliveryFilter === "undelivered" && s.isDelivered) return false;
      if (printFilter === "printed" && !s.isPrintConcluded) return false;
      if (printFilter === "pending" && s.isPrintConcluded) return false;
      if (activityFilter === "inactive" && isSaleActive(s)) return false;

      if (!filterDate) return true;
      if (!s.saleDate) return false;
      return s.saleDate.startsWith(filterDate);
    });
  }, [
    clients,
    deliveryFilter,
    filterClientId,
    filterClientName,
    filterDate,
    filterProductName,
    activityFilter,
    paymentFilter,
    printFilter,
    sales,
  ]);

  const sortedSales = useMemo(() => {
    return [...filteredSales].sort((firstSale, secondSale) => {
      const firstValue = getSaleSortValue(firstSale);
      const secondValue = getSaleSortValue(secondSale);

      return sortDirection === "desc"
        ? secondValue - firstValue
        : firstValue - secondValue;
    });
  }, [filteredSales, sortDirection]);

  const activeFilteredSales = filteredSales.filter((sale) =>
    isSaleActive(sale),
  );

  const totalSales = activeFilteredSales.reduce(
    (acc, curr) => acc + curr.saleValue,
    0,
  );
  const totalProfit = activeFilteredSales.reduce(
    (acc, curr) => acc + curr.profit,
    0,
  );
  const pendingPrints = activeFilteredSales.filter(
    (s) => !s.isPrintConcluded,
  ).length;
  const activeStatusFilters = [
    paymentFilter,
    deliveryFilter,
    printFilter,
    activityFilter,
  ].filter((value) => value !== "all").length;
  const filterQuery = new URLSearchParams();
  filterQuery.set("filterType", filterType);
  if (filterDate) {
    filterQuery.set("filterDate", filterDate);
  }
  if (filterClientName) {
    filterQuery.set("filterClientName", filterClientName);
  }
  if (filterClientId) {
    filterQuery.set("filterClientId", filterClientId);
  }
  if (filterProductName) {
    filterQuery.set("filterProductName", filterProductName);
  }
  if (paymentFilter !== "all") {
    filterQuery.set("paymentStatus", paymentFilter);
  }
  if (deliveryFilter !== "all") {
    filterQuery.set("deliveryStatus", deliveryFilter);
  }
  if (printFilter !== "all") {
    filterQuery.set("printStatus", printFilter);
  }
  if (activityFilter !== "all") {
    filterQuery.set("activityStatus", activityFilter);
  }
  filterQuery.set("sortDirection", sortDirection);
  const newSaleHref = filterQuery.toString()
    ? `/sales/new?${filterQuery.toString()}`
    : "/sales/new";
  const mobileActionClass =
    "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors";
  const desktopActionClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:border-brand-purple/30 hover:bg-purple-50 hover:text-brand-purple";
  const buildViewHref = (id: string) =>
    filterQuery.toString()
      ? `/sales/view/${id}?${filterQuery.toString()}`
      : `/sales/view/${id}`;
  const buildEditHref = (id: string) =>
    filterQuery.toString()
      ? `/sales/${id}?${filterQuery.toString()}`
      : `/sales/${id}`;
  const hasActiveFilters =
    Boolean(
      filterDate || filterClientId || filterClientName || filterProductName,
    ) || activeStatusFilters > 0;
  const formatDisplayDate = (value?: string) =>
    value ? new Date(value).toLocaleDateString("pt-BR") : "-";
  const getSaleCardClassName = (sale: Sale) =>
    isSaleActive(sale)
      ? "bg-white border-gray-100 shadow-sm"
      : "bg-slate-200/90 border-slate-300 shadow-none";
  const getSaleMutedTextClassName = (sale: Sale) =>
    isSaleActive(sale) ? "text-gray-900" : "text-slate-600";
  const getSaleSecondaryTextClassName = (sale: Sale) =>
    isSaleActive(sale) ? "text-gray-500" : "text-slate-500";
  const getSaleRowClassName = (sale: Sale) => {
    if (!isSaleActive(sale)) {
      return expandedSaleId === sale.id
        ? "text-slate-600 [&>td]:bg-slate-200/95"
        : "text-slate-600 [&>td]:bg-slate-100/95 hover:[&>td]:bg-slate-200/95";
    }

    return expandedSaleId === sale.id ? "bg-purple-50" : "hover:bg-gray-50";
  };
  const getExpandedPanelClassName = (sale: Sale) =>
    isSaleActive(sale)
      ? "rounded-xl border border-purple-100 bg-purple-50 p-4"
      : "rounded-xl border border-slate-200 bg-slate-100 p-4";
  const renderExpandedSaleDetails = (sale: Sale) => {
    const saleFilamentUsages = mapSaleFilamentPayload(sale);

    return (
      <div
        className={`grid grid-cols-1 gap-4 text-sm md:grid-cols-3 ${isSaleActive(sale) ? "text-gray-700" : "text-slate-600"}`}
      >
        {!isSaleActive(sale) && (
          <div className="md:col-span-3 rounded-xl border border-slate-300 bg-white/70 px-4 py-3 text-sm font-medium text-slate-600">
            Esta venda está hibernando. Ela fica fora das filas e das
            contabilizações até ser reativada.
          </div>
        )}
        <div>
          <p className="font-bold text-brand-purple mb-1">Cliente</p>
          <p>{getClientName(sale.clientId)}</p>
        </div>
        <div>
          <p className="font-bold text-brand-purple mb-1">Filamentos</p>
          {saleFilamentUsages.length === 0 ? (
            <p>Não informado</p>
          ) : (
            <div className="space-y-1">
              {saleFilamentUsages.map((usage) => (
                <p key={`${sale.id}-${usage.filamentId}`}>
                  {getFilamentName(usage.filamentId)} •{" "}
                  {usage.massGrams.toLocaleString("pt-BR", {
                    maximumFractionDigits: 1,
                  })}
                  g
                </p>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="font-bold text-brand-purple mb-1">Link do Produto</p>
          {sale.productLink ? (
            <a
              href={sale.productLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline break-all block"
            >
              {sale.productLink}
            </a>
          ) : (
            <span className="text-gray-400">Não informado</span>
          )}
        </div>
        <div>
          <p className="font-bold text-brand-purple mb-1">Qualidade</p>
          <p>{sale.printQuality || "Padrão"}</p>
        </div>
        <div>
          <p className="font-bold text-brand-purple mb-1">Tempo Estimado</p>
          <p>{sale.designPrintTime || "-"}</p>
        </div>
        <div>
          <p className="font-bold text-brand-purple mb-1">
            {hideProfit ? "Massa Total" : "Massa / Custo Total"}
          </p>
          <p>
            {hideProfit
              ? `${sale.massGrams}g`
              : `${sale.massGrams}g / R$ ${sale.cost?.toFixed(2)}`}
          </p>
          {!hideProfit && Number(sale.shippingCost || 0) > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              Frete: R$ {(sale.shippingCost || 0).toFixed(2)}
            </p>
          )}
        </div>
        <div className="md:col-span-3 flex flex-col sm:flex-row sm:justify-end mt-4 pt-4 border-t border-purple-100 gap-3">
          <button
            onClick={() => {
              setShowIncidentsModal(sale);
              setIsAddingIncident(true);
            }}
            className="w-full sm:w-auto bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
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
            Registrar Ocorrência
          </button>
          <button
            onClick={() => handleMoveToStock(sale.id)}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
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
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
              ></path>
            </svg>
            Mover para Estoque
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="border-b-2 border-brand-orange pb-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <h1 className="text-3xl font-bold text-brand-purple">
            Registro de Vendas
          </h1>

          <div className="flex flex-wrap items-stretch justify-end gap-3">
            <div className="relative" ref={filterMenuRef}>
              <button
                type="button"
                onClick={() => setIsStatusFilterOpen((prev) => !prev)}
                className="flex h-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-gray-300 whitespace-nowrap"
              >
                <svg
                  className="w-4 h-4 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707L14 14.586V19a1 1 0 01-1.447.894l-4-2A1 1 0 018 16.618v-2.032L3.293 7.293A1 1 0 013 6.586V4z"
                  ></path>
                </svg>
                <span>Filtros</span>
                {activeStatusFilters > 0 && (
                  <span className="rounded-full bg-brand-purple px-2 py-0.5 text-xs font-bold text-white">
                    {activeStatusFilters}
                  </span>
                )}
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${isStatusFilterOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  ></path>
                </svg>
              </button>

              {isStatusFilterOpen && (
                <div className="absolute right-0 mt-2 z-10 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
                        Pagamento
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => togglePaymentFilter("paid")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            paymentFilter === "paid"
                              ? "bg-green-100 text-green-700 border-green-200"
                              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          Pagas
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePaymentFilter("unpaid")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            paymentFilter === "unpaid"
                              ? "bg-red-100 text-red-700 border-red-200"
                              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          Nao pagas
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
                        Entrega
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => toggleDeliveryFilter("delivered")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            deliveryFilter === "delivered"
                              ? "bg-purple-100 text-purple-700 border-purple-200"
                              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          Entregues
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleDeliveryFilter("undelivered")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            deliveryFilter === "undelivered"
                              ? "bg-yellow-100 text-yellow-700 border-yellow-200"
                              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          Nao entregues
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
                        Impressao
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => togglePrintFilter("printed")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            printFilter === "printed"
                              ? "bg-blue-100 text-blue-700 border-blue-200"
                              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          Impressas
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePrintFilter("pending")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            printFilter === "pending"
                              ? "bg-gray-200 text-gray-700 border-gray-300"
                              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          Nao impressas
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
                        Atividade
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={toggleInactiveFilter}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            activityFilter === "inactive"
                              ? "bg-amber-100 text-amber-800 border-amber-200"
                              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          Somente hibernando
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentFilter("all");
                        setDeliveryFilter("all");
                        setPrintFilter("all");
                        setActivityFilter("all");
                      }}
                      className="w-full border-t border-gray-100 pt-3 text-xs font-semibold text-gray-600 transition-colors hover:text-gray-800"
                    >
                      Limpar filtros
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setHideProfit((prev) => !prev)}
              className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:border-gray-300 whitespace-nowrap"
            >
              <svg
                className="w-4 h-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                ></path>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                ></path>
              </svg>
              <span className="hidden sm:inline">
                {hideProfit ? "Mostrar lucro" : "Ocultar lucro"}
              </span>
              <span className="sm:hidden">Lucro</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setSortDirection((previousDirection) =>
                  previousDirection === "desc" ? "asc" : "desc",
                )
              }
              className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:border-gray-300 whitespace-nowrap"
              title="Alternar ordenação das vendas"
            >
              <svg
                className="w-4 h-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 7h8M8 12h5m-5 5h2M16 6l3 3m0 0l3-3m-3 3V3M8 18l-3-3m0 0l-3 3m3-3v6"
                ></path>
              </svg>
              <span className="hidden md:inline">
                {sortDirection === "desc"
                  ? "Mais novas primeiro"
                  : "Mais antigas primeiro"}
              </span>
              <span className="md:hidden">
                {sortDirection === "desc" ? "Mais novas" : "Mais antigas"}
              </span>
            </button>

            <Link
              href={newSaleHref}
              className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-purple px-4 py-2 text-white shadow-md transition-colors hover:bg-purple-800 whitespace-nowrap"
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
              <span className="hidden sm:inline">Nova Venda</span>
              <span className="sm:hidden">Nova</span>
            </Link>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center">
            <div className="flex items-center gap-2 justify-between md:justify-start">
              <label
                htmlFor="dateFilter"
                className="text-sm font-bold text-brand-purple flex items-center gap-2"
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
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  ></path>
                </svg>
                Filtrar:
              </label>

              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value as "date" | "month");
                  setFilterDate("");
                }}
                className="border-none text-sm text-gray-600 focus:ring-0 bg-transparent cursor-pointer font-medium"
              >
                <option value="date">Dia</option>
                <option value="month">Mês</option>
              </select>
              <div className="hidden md:block h-4 w-px bg-gray-300 mx-1"></div>
              <div className="flex min-w-0 w-full items-center gap-2 md:w-auto md:min-w-45">
                <input
                  type="text"
                  list="sales-client-filter-options"
                  value={filterClientName}
                  onChange={(e) => handleClientFilterChange(e.target.value)}
                  placeholder="Cliente"
                  className="border-0 p-0 text-sm text-gray-600 focus:ring-0 bg-transparent w-full font-medium"
                />
                {(filterClientName || filterClientId) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterClientName("");
                      setFilterClientId("");
                    }}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    title="Limpar cliente"
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
                        d="M6 18L18 6M6 6l12 12"
                      ></path>
                    </svg>
                  </button>
                )}
              </div>

              <div className="hidden md:block h-4 w-px bg-gray-300 mx-1"></div>

              <div className="flex min-w-0 w-full items-center gap-2 md:w-auto md:min-w-45">
                <input
                  type="text"
                  value={filterProductName}
                  onChange={(e) => setFilterProductName(e.target.value)}
                  placeholder="Produto"
                  className="border-0 p-0 text-sm text-gray-600 focus:ring-0 bg-transparent w-full font-medium"
                />
                {filterProductName && (
                  <button
                    type="button"
                    onClick={() => setFilterProductName("")}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    title="Limpar produto"
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
                        d="M6 18L18 6M6 6l12 12"
                      ></path>
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="hidden md:block h-4 w-px bg-gray-300 mx-1"></div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <input
                type={filterType}
                id="dateFilter"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="border-0 p-0 text-sm text-gray-600 focus:ring-0 bg-transparent cursor-pointer w-full md:w-auto"
              />
              {filterDate && (
                <button
                  onClick={() => setFilterDate("")}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title="Limpar filtro"
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
                      d="M6 18L18 6M6 6l12 12"
                    ></path>
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        <datalist id="sales-client-filter-options">
          {clients.map((client) => (
            <option key={client.id} value={client.name} />
          ))}
        </datalist>
      </div>

      <div
        className={`grid grid-cols-1 gap-6 ${hideProfit ? "md:grid-cols-2" : "md:grid-cols-3"}`}
      >
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium uppercase">
            Faturamento Total
          </p>
          <p className="text-3xl font-bold text-gray-800 mt-2">
            R$ {totalSales.toFixed(2)}
          </p>
        </div>
        {!hideProfit && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 font-medium uppercase">
              Lucro Líquido
            </p>
            <p className="text-3xl font-bold text-green-600 mt-2">
              R$ {totalProfit.toFixed(2)}
            </p>
          </div>
        )}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 font-medium uppercase">
            Impressões Pendentes
          </p>
          <p className="text-3xl font-bold text-brand-orange mt-2">
            {pendingPrints}
          </p>
        </div>
      </div>

      {sortedSales.length > 0 ? (
        <>
          <div className="md:hidden space-y-4">
            {sortedSales.map((s) => (
              <div
                key={s.id}
                className={`rounded-xl border p-4 space-y-4 transition-colors ${getSaleCardClassName(s)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    {getFirstProductImageUrl(s.attachments) && (
                      <img
                        src={getFirstProductImageUrl(s.attachments)}
                        alt={s.description}
                        className="h-14 w-14 shrink-0 rounded-xl border border-gray-200 object-cover"
                      />
                    )}
                    <div className="min-w-0">
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide ${getSaleSecondaryTextClassName(s)}`}
                      >
                        Venda em {formatDisplayDate(s.saleDate)}
                      </p>
                      <h3
                        className={`mt-1 text-base font-bold wrap-break-word ${getSaleMutedTextClassName(s)}`}
                      >
                        {s.description}
                      </h3>
                      <div
                        className={`mt-1 flex flex-wrap items-center gap-2 text-xs ${getSaleSecondaryTextClassName(s)}`}
                      >
                        <p>Entrega: {formatDisplayDate(s.deliveryDate)}</p>
                        {!isSaleActive(s) && (
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${getSaleActivityClassName(s)}`}
                          >
                            {getSaleActivityLabel(s)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {s.incidents && s.incidents.length > 0 && (
                    <button
                      onClick={() => setShowIncidentsModal(s)}
                      className="shrink-0 text-yellow-500 hover:text-yellow-600 transition-colors"
                      title="Ver ocorrências de impressão"
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
                    </button>
                  )}
                </div>

                <div
                  className={`grid gap-3 ${hideProfit ? "grid-cols-1" : "grid-cols-2"}`}
                >
                  <div
                    className={`rounded-xl border p-3 ${isSaleActive(s) ? "border-gray-100 bg-gray-50" : "border-slate-200 bg-white/80"}`}
                  >
                    <p
                      className={`text-[11px] font-semibold uppercase tracking-wide ${getSaleSecondaryTextClassName(s)}`}
                    >
                      Valor
                    </p>
                    <p
                      className={`mt-1 text-xl font-bold ${getSaleMutedTextClassName(s)}`}
                    >
                      R$ {s.saleValue.toFixed(2)}
                    </p>
                  </div>
                  {!hideProfit && (
                    <div
                      className={`rounded-xl border p-3 ${isSaleActive(s) ? "border-green-100 bg-green-50" : "border-slate-200 bg-white/80"}`}
                    >
                      <p
                        className={`text-[11px] font-semibold uppercase tracking-wide ${isSaleActive(s) ? "text-green-700" : "text-slate-500"}`}
                      >
                        Lucro
                      </p>
                      <p
                        className={`mt-1 text-xl font-bold ${isSaleActive(s) ? "text-green-700" : "text-slate-600"}`}
                      >
                        R$ {s.profit.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {!isSaleActive(s) && (
                    <span
                      className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getSaleActivityClassName(s)}`}
                    >
                      {getSaleActivityLabel(s)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(s, "isPrintConcluded")}
                    className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full transition-transform duration-150 hover:scale-105 active:scale-95 ${getSaleStatusBadgeClassName(s, s.isPrintConcluded ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800")}`}
                    title="Alternar impresso"
                  >
                    {s.isPrintConcluded ? "Impresso" : "Pendente"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(s, "isDelivered")}
                    className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full transition-transform duration-150 hover:scale-105 active:scale-95 ${getSaleStatusBadgeClassName(s, s.isDelivered ? "bg-purple-100 text-purple-800" : "bg-yellow-100 text-yellow-800")}`}
                    title="Alternar entregue"
                  >
                    {s.isDelivered ? "Entregue" : "A Enviar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(s, "isPaid")}
                    className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full transition-transform duration-150 hover:scale-105 active:scale-95 ${getSaleStatusBadgeClassName(s, s.isPaid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}`}
                    title="Alternar pago"
                  >
                    {s.isPaid ? "Pago" : "Não Pago"}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={buildViewHref(s.id)}
                    className={`${mobileActionClass} border border-gray-200 bg-white text-gray-700`}
                  >
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
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      ></path>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      ></path>
                    </svg>
                    Visualizar
                  </Link>
                  <Link
                    href={buildEditHref(s.id)}
                    className={`${mobileActionClass} border border-brand-purple/20 bg-brand-purple/5 text-brand-purple`}
                  >
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
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      ></path>
                    </svg>
                    Editar
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id)}
                    className={`${mobileActionClass} border border-red-200 bg-red-50 text-red-700`}
                  >
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
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16"
                      ></path>
                    </svg>
                    Excluir
                  </button>
                  <button
                    type="button"
                    onClick={() => handleClone(s)}
                    className={`${mobileActionClass} border border-gray-200 bg-white text-gray-700`}
                  >
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
                        d="M8 7a2 2 0 012-2h7a2 2 0 012 2v9a2 2 0 01-2 2h-7a2 2 0 01-2-2V7zm-4 4a2 2 0 012-2h1v7a2 2 0 002 2h5v1a2 2 0 01-2 2H6a2 2 0 01-2-2v-8z"
                      ></path>
                    </svg>
                    Clonar venda
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActivity(s)}
                    className={`${mobileActionClass} ${isSaleActive(s) ? "border border-amber-200 bg-amber-50 text-amber-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700"}`}
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      {isSaleActive(s) ? (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M10 9v6m4-6v6M9 5h6a2 2 0 012 2v10a2 2 0 01-2 2H9a2 2 0 01-2-2V7a2 2 0 012-2z"
                        ></path>
                      ) : (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M8 5v14l11-7L8 5z"
                        ></path>
                      )}
                    </svg>
                    {isSaleActive(s) ? "Hibernar" : "Reativar"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => toggleExpand(s.id)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700"
                >
                  {expandedSaleId === s.id
                    ? "Ocultar detalhes"
                    : "Ver detalhes"}
                </button>

                {expandedSaleId === s.id && (
                  <div className={getExpandedPanelClassName(s)}>
                    {renderExpandedSaleDetails(s)}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="hidden md:block bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-24 px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="hidden w-24 md:table-cell px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Entrega
                    </th>
                    <th className="w-[31%] px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Descrição
                    </th>
                    <th className="w-24 px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Valor
                    </th>
                    <th
                      className={`hidden w-24 md:table-cell px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider transition-opacity duration-300 ${hideProfit ? "opacity-0" : "opacity-100"}`}
                    >
                      Lucro
                    </th>
                    <th className="w-56 px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="w-48 px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedSales.map((s) => (
                    <Fragment key={s.id}>
                      <tr
                        onClick={() => toggleExpand(s.id)}
                        className={`cursor-pointer transition-colors ${getSaleRowClassName(s)}`}
                      >
                        <td
                          className={`px-4 py-3 whitespace-nowrap text-sm ${getSaleSecondaryTextClassName(s)}`}
                        >
                          {s.saleDate
                            ? new Date(s.saleDate).toLocaleDateString("pt-BR")
                            : "-"}
                        </td>
                        <td
                          className={`hidden md:table-cell px-4 py-3 whitespace-nowrap text-sm ${getSaleSecondaryTextClassName(s)}`}
                        >
                          {s.deliveryDate
                            ? new Date(s.deliveryDate).toLocaleDateString(
                                "pt-BR",
                              )
                            : "-"}
                        </td>
                        <td
                          className={`w-[31%] px-4 py-3 text-sm font-medium ${getSaleMutedTextClassName(s)}`}
                        >
                          <div className="flex min-w-0 items-center gap-1.5">
                            {expandedSaleId === s.id ? (
                              <svg
                                className={`h-4 w-4 ${isSaleActive(s) ? "text-brand-purple" : "text-slate-400"}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M19 9l-7 7-7-7"
                                ></path>
                              </svg>
                            ) : (
                              <svg
                                className={`w-4 h-4 ${isSaleActive(s) ? "text-gray-400" : "text-slate-400"}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M9 5l7 7-7 7"
                                ></path>
                              </svg>
                            )}
                            {getFirstProductImageUrl(s.attachments) && (
                              <img
                                src={getFirstProductImageUrl(s.attachments)}
                                alt={s.description}
                                className="h-8 w-8 shrink-0 rounded-lg border border-gray-200 object-cover"
                              />
                            )}
                            <div
                              className="min-w-0 max-w-[22rem] flex-1 truncate text-[13px]"
                              title={s.description}
                            >
                              {s.description}
                            </div>
                            {s.incidents && s.incidents.length > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowIncidentsModal(s);
                                }}
                                className="ml-1.5 text-yellow-500 hover:text-yellow-600 transition-colors"
                                title="Ver ocorrências de impressão"
                              >
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
                              </button>
                            )}
                          </div>
                        </td>
                        <td
                          className={`px-4 py-3 whitespace-nowrap text-sm ${getSaleSecondaryTextClassName(s)}`}
                        >
                          R$ {s.saleValue.toFixed(2)}
                        </td>
                        <td
                          className={`hidden md:table-cell px-4 py-3 whitespace-nowrap text-sm font-bold transition-opacity duration-300 ${hideProfit ? "opacity-0" : "opacity-100"} ${isSaleActive(s) ? "text-green-600" : "text-slate-500"}`}
                        >
                          R$ {s.profit.toFixed(2)}
                        </td>
                        <td className="w-56 px-4 py-3 text-xs text-center align-middle">
                          <div className="mx-auto flex max-w-[13rem] flex-wrap items-center justify-center gap-1.5">
                            {!isSaleActive(s) && (
                              <span
                                className={`inline-flex whitespace-nowrap items-center justify-center rounded-full px-2.5 py-1 text-[10px] font-semibold leading-none ${getSaleActivityClassName(s)}`}
                              >
                                {getSaleActivityLabel(s)}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleStatus(s, "isPrintConcluded");
                              }}
                              className={`inline-flex whitespace-nowrap items-center justify-center rounded-full px-2.5 py-1 text-[10px] font-semibold leading-none transition-transform duration-150 hover:scale-105 active:scale-95 ${getSaleStatusBadgeClassName(s, s.isPrintConcluded ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800")}`}
                              title="Alternar impresso"
                            >
                              {s.isPrintConcluded ? "Impresso" : "Pendente"}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleStatus(s, "isDelivered");
                              }}
                              className={`inline-flex whitespace-nowrap items-center justify-center rounded-full px-2.5 py-1 text-[10px] font-semibold leading-none transition-transform duration-150 hover:scale-105 active:scale-95 ${getSaleStatusBadgeClassName(s, s.isDelivered ? "bg-purple-100 text-purple-800" : "bg-yellow-100 text-yellow-800")}`}
                              title="Alternar entregue"
                            >
                              {s.isDelivered ? "Entregue" : "A Enviar"}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleStatus(s, "isPaid");
                              }}
                              className={`inline-flex whitespace-nowrap items-center justify-center rounded-full px-2.5 py-1 text-[10px] font-semibold leading-none transition-transform duration-150 hover:scale-105 active:scale-95 ${getSaleStatusBadgeClassName(s, s.isPaid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}`}
                              title="Alternar pago"
                            >
                              {s.isPaid ? "Pago" : "Não Pago"}
                            </button>
                          </div>
                        </td>
                        <td
                          className="w-48 px-4 py-3 whitespace-nowrap text-right text-sm font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={buildViewHref(s.id)}
                              className={desktopActionClass}
                              title="Visualizar venda"
                              aria-label="Visualizar venda"
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
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                ></path>
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                ></path>
                              </svg>
                            </Link>
                            <Link
                              href={buildEditHref(s.id)}
                              className={desktopActionClass}
                              title="Editar venda"
                              aria-label="Editar venda"
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
                                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                ></path>
                              </svg>
                            </Link>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClone(s);
                              }}
                              className={desktopActionClass}
                              title="Clonar venda"
                              aria-label="Clonar venda"
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
                                  d="M8 7a2 2 0 012-2h7a2 2 0 012 2v9a2 2 0 01-2 2h-7a2 2 0 01-2-2V7zm-4 4a2 2 0 012-2h1v7a2 2 0 002 2h5v1a2 2 0 01-2 2H6a2 2 0 01-2-2v-8z"
                                ></path>
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleActivity(s)}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${isSaleActive(s) ? "border-amber-200 bg-amber-50 text-amber-600 hover:border-amber-300 hover:bg-amber-100 hover:text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-600 hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-700"}`}
                              title={
                                isSaleActive(s)
                                  ? "Hibernar venda"
                                  : "Reativar venda"
                              }
                              aria-label={
                                isSaleActive(s)
                                  ? "Hibernar venda"
                                  : "Reativar venda"
                              }
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                {isSaleActive(s) ? (
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M10 9v6m4-6v6M9 5h6a2 2 0 012 2v10a2 2 0 01-2 2H9a2 2 0 01-2-2V7a2 2 0 012-2z"
                                  ></path>
                                ) : (
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M8 5v14l11-7L8 5z"
                                  ></path>
                                )}
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(s.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition-colors hover:border-red-300 hover:bg-red-100 hover:text-red-700"
                              title="Excluir venda"
                              aria-label="Excluir venda"
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
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16"
                                ></path>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedSaleId === s.id && (
                        <tr
                          className={
                            isSaleActive(s) ? "bg-purple-50" : "bg-slate-100"
                          }
                        >
                          <td colSpan={7} className="px-4 py-3">
                            {renderExpandedSaleDetails(s)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            ></path>
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            {hasActiveFilters
              ? "Nenhuma venda encontrada"
              : "Nenhuma venda registrada"}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {hasActiveFilters
              ? "Ajuste os filtros ou limpe a busca para ver mais resultados."
              : "Comece importando uma planilha ou criando uma nova venda."}
          </p>
        </div>
      )}

      {activityFilter === "inactive" && (
        <div className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-600">
          As vendas hibernando aparecem na listagem, mas continuam fora das
          somas de lucro, faturamento e pendências.
        </div>
      )}

      <Modal
        isOpen={!!showIncidentsModal}
        onClose={() => {
          setShowIncidentsModal(null);
          setIsAddingIncident(false);
          setNewIncidentReason("Other");
          setNewIncidentComment("");
        }}
        title="Ocorrências da Impressão"
      >
        <div className="space-y-4">
          {isAddingIncident ? (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
              <h4 className="font-medium text-gray-900">Nova Ocorrência</h4>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo
                </label>
                <select
                  value={newIncidentReason}
                  onChange={(e) => setNewIncidentReason(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-purple focus:ring-brand-purple sm:text-sm"
                >
                  {INCIDENT_REASONS.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comentário
                </label>
                <textarea
                  value={newIncidentComment}
                  onChange={(e) => setNewIncidentComment(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-purple focus:ring-brand-purple sm:text-sm"
                  placeholder="Descreva o que aconteceu..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingIncident(false)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAddIncident}
                  className="px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-purple hover:bg-brand-purple-dark"
                >
                  Salvar
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-end">
                <button
                  onClick={() => setIsAddingIncident(true)}
                  className="text-sm text-brand-purple hover:text-brand-purple-dark font-medium flex items-center"
                >
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Adicionar Ocorrência
                </button>
              </div>

              {showIncidentsModal?.incidents &&
              showIncidentsModal.incidents.length > 0 ? (
                <ul className="space-y-3">
                  {showIncidentsModal.incidents.map((incident, idx) => (
                    <li
                      key={idx}
                      className="bg-gray-50 p-3 rounded-lg border border-gray-200"
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-brand-purple text-sm">
                          {INCIDENT_REASONS.find(
                            (r) => r.value === incident.reason,
                          )?.label || incident.reason}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(incident.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">
                        {incident.comment}
                      </p>

                      {getIncidentWasteTotal(incident) > 0 ? (
                        <p className="mt-2 text-xs font-medium text-amber-700">
                          Desperdício registrado: {getIncidentWasteTotal(incident).toLocaleString("pt-BR", {
                            maximumFractionDigits: 2,
                          })}{" "}
                          g
                        </p>
                      ) : null}

                      {getIncidentWasteEntries(incident).length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {getIncidentWasteEntries(incident).map((entry) => (
                            <p
                              key={`${entry.filamentId}-${entry.massGrams}`}
                              className="text-[11px] text-amber-700"
                            >
                              {getFilamentName(entry.filamentId)}: {entry.massGrams.toLocaleString("pt-BR", {
                                maximumFractionDigits: 2,
                              })} g
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-center py-4">
                  Nenhuma ocorrência registrada.
                </p>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
