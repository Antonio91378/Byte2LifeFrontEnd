"use client";

import Modal from "@/components/Modal";
import { useDialog } from "@/context/DialogContext";
import axios from "axios";
import { Fragment, Suspense, useEffect, useRef, useState } from "react";

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

interface Filament {
  id: string;
  description: string;
  color: string;
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
  printQuality?: string;
  massGrams?: number;
  cost?: number;
  shippingCost?: number;
  designPrintTime?: string;
  incidents?: any[];
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
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const [filterClientId, setFilterClientId] = useState<string>("");
  const [showIncidentsModal, setShowIncidentsModal] = useState<Sale | null>(
    null,
  );
  const [isAddingIncident, setIsAddingIncident] = useState(false);
  const [newIncidentReason, setNewIncidentReason] = useState("Other");
  const [newIncidentComment, setNewIncidentComment] = useState("");
  const [hideProfit, setHideProfit] = useState(false);
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
    return filament
      ? `${filament.description} (${filament.color})`
      : "Desconhecido";
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
      showAlert("Erro", "Falha ao atualizar status da venda.", "error");
    }
  };

  const handleClone = async (sale: Sale) => {
    const payload: any = { ...sale };
    delete payload.id;
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

  const filteredSales = sales.filter((s) => {
    // Filtro por cliente
    if (filterClientId && s.clientId !== filterClientId) return false;
    if (paymentFilter === "paid" && !s.isPaid) return false;
    if (paymentFilter === "unpaid" && s.isPaid) return false;
    if (deliveryFilter === "delivered" && !s.isDelivered) return false;
    if (deliveryFilter === "undelivered" && s.isDelivered) return false;
    if (printFilter === "printed" && !s.isPrintConcluded) return false;
    if (printFilter === "pending" && s.isPrintConcluded) return false;

    if (!filterDate) return true;
    if (!s.saleDate) return false;
    // Compare dates (YYYY-MM-DD) or Month (YYYY-MM)
    return s.saleDate.startsWith(filterDate);
  });

  const totalSales = filteredSales.reduce(
    (acc, curr) => acc + curr.saleValue,
    0,
  );
  const totalProfit = filteredSales.reduce((acc, curr) => acc + curr.profit, 0);
  const pendingPrints = filteredSales.filter((s) => !s.isPrintConcluded).length;
  const activeStatusFilters = [
    paymentFilter,
    deliveryFilter,
    printFilter,
  ].filter((value) => value !== "all").length;
  const filterQuery = new URLSearchParams();
  filterQuery.set("filterType", filterType);
  if (filterDate) {
    filterQuery.set("filterDate", filterDate);
  }
  if (filterClientId) {
    filterQuery.set("filterClientId", filterClientId);
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
  const newSaleHref = filterQuery.toString()
    ? `/sales/new?${filterQuery.toString()}`
    : "/sales/new";
  const buildEditHref = (id: string) =>
    filterQuery.toString()
      ? `/sales/${id}?${filterQuery.toString()}`
      : `/sales/${id}`;
  const hasActiveFilters =
    Boolean(filterDate || filterClientId) || activeStatusFilters > 0;
  const formatDisplayDate = (value?: string) =>
    value ? new Date(value).toLocaleDateString("pt-BR") : "-";
  const renderExpandedSaleDetails = (sale: Sale) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700">
      <div>
        <p className="font-bold text-brand-purple mb-1">Cliente</p>
        <p>{getClientName(sale.clientId)}</p>
      </div>
      <div>
        <p className="font-bold text-brand-purple mb-1">Filamento</p>
        <p>{getFilamentName(sale.filamentId)}</p>
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
        <p className="font-bold text-brand-purple mb-1">Massa / Custo Total</p>
        <p>
          {sale.massGrams}g / R$ {sale.cost?.toFixed(2)}
        </p>
        {Number(sale.shippingCost || 0) > 0 && (
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center border-b-2 border-brand-orange pb-4 gap-4">
        <h1 className="text-3xl font-bold text-brand-purple">
          Registro de Vendas
        </h1>
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
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
              <select
                value={filterClientId || ""}
                onChange={(e) => setFilterClientId(e.target.value)}
                className="border-none text-sm text-gray-600 focus:ring-0 bg-transparent cursor-pointer font-medium"
                style={{ minWidth: 120 }}
              >
                <option value="">Todos os Clientes</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
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

          <div className="relative" ref={filterMenuRef}>
            <button
              type="button"
              onClick={() => setIsStatusFilterOpen((prev) => !prev)}
              className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm hover:border-gray-300 transition-colors"
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
              <span className="text-sm font-medium text-gray-700">Filtros</span>
              {activeStatusFilters > 0 && (
                <span className="text-xs font-bold text-white bg-brand-purple px-2 py-0.5 rounded-full">
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
              <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-4 z-10">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
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
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
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
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
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

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentFilter("all");
                      setDeliveryFilter("all");
                      setPrintFilter("all");
                    }}
                    className="w-full text-xs font-semibold text-gray-600 hover:text-gray-800 transition-colors border-t border-gray-100 pt-3"
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
            className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm hover:border-gray-300 transition-colors text-sm font-semibold text-gray-700"
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
            {hideProfit ? "Mostrar lucro" : "Ocultar lucro"}
          </button>

          <Link
            href={newSaleHref}
            className="bg-brand-purple hover:bg-purple-800 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md"
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
            Nova Venda
          </Link>
        </div>
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

      {filteredSales.length > 0 ? (
        <>
          <div className="md:hidden space-y-4">
            {filteredSales.map((s) => (
              <div
                key={s.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Venda em {formatDisplayDate(s.saleDate)}
                    </p>
                    <h3 className="mt-1 text-base font-bold text-gray-900 wrap-break-word">
                      {s.description}
                    </h3>
                    <p className="mt-1 text-xs text-gray-500">
                      Entrega: {formatDisplayDate(s.deliveryDate)}
                    </p>
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
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Valor
                    </p>
                    <p className="mt-1 text-xl font-bold text-gray-900">
                      R$ {s.saleValue.toFixed(2)}
                    </p>
                  </div>
                  {!hideProfit && (
                    <div className="rounded-xl border border-green-100 bg-green-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-green-700">
                        Lucro
                      </p>
                      <p className="mt-1 text-xl font-bold text-green-700">
                        R$ {s.profit.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(s, "isPrintConcluded")}
                    className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full transition-transform duration-150 hover:scale-105 active:scale-95 ${s.isPrintConcluded ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"}`}
                    title="Alternar impresso"
                  >
                    {s.isPrintConcluded ? "Impresso" : "Pendente"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(s, "isDelivered")}
                    className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full transition-transform duration-150 hover:scale-105 active:scale-95 ${s.isDelivered ? "bg-purple-100 text-purple-800" : "bg-yellow-100 text-yellow-800"}`}
                    title="Alternar entregue"
                  >
                    {s.isDelivered ? "Entregue" : "A Enviar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(s, "isPaid")}
                    className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full transition-transform duration-150 hover:scale-105 active:scale-95 ${s.isPaid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                    title="Alternar pago"
                  >
                    {s.isPaid ? "Pago" : "Não Pago"}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={buildEditHref(s.id)}
                    className="flex items-center justify-center rounded-lg border border-brand-purple/20 bg-brand-purple/5 px-3 py-2 text-sm font-semibold text-brand-purple"
                  >
                    Editar
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
                  >
                    Excluir
                  </button>
                  <button
                    type="button"
                    onClick={() => handleClone(s)}
                    className="col-span-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700"
                  >
                    Clonar venda
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
                  <div className="rounded-xl border border-purple-100 bg-purple-50 p-4">
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
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="hidden md:table-cell px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Entrega
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Descrição
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Valor
                    </th>
                    <th
                      className={`hidden md:table-cell px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider transition-opacity duration-300 ${hideProfit ? "opacity-0" : "opacity-100"}`}
                    >
                      Lucro
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSales.map((s) => (
                    <Fragment key={s.id}>
                      <tr
                        onClick={() => toggleExpand(s.id)}
                        className={`cursor-pointer transition-colors ${expandedSaleId === s.id ? "bg-purple-50" : "hover:bg-gray-50"}`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {s.saleDate
                            ? new Date(s.saleDate).toLocaleDateString("pt-BR")
                            : "-"}
                        </td>
                        <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {s.deliveryDate
                            ? new Date(s.deliveryDate).toLocaleDateString(
                                "pt-BR",
                              )
                            : "-"}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 flex items-center gap-2 min-w-0">
                          {expandedSaleId === s.id ? (
                            <svg
                              className="w-4 h-4 text-brand-purple"
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
                              className="w-4 h-4 text-gray-400"
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
                          <div className="flex-1 min-w-0 max-w-65 overflow-x-auto whitespace-nowrap">
                            {s.description}
                          </div>
                          {s.incidents && s.incidents.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowIncidentsModal(s);
                              }}
                              className="ml-2 text-yellow-500 hover:text-yellow-600 transition-colors"
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
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          R$ {s.saleValue.toFixed(2)}
                        </td>
                        <td
                          className={`hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-green-600 font-bold transition-opacity duration-300 ${hideProfit ? "opacity-0" : "opacity-100"}`}
                        >
                          R$ {s.profit.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center space-x-2">
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStatus(s, "isPrintConcluded");
                            }}
                            className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer transition-transform duration-150 hover:scale-105 active:scale-95 ${s.isPrintConcluded ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"}`}
                            title="Alternar impresso"
                          >
                            {s.isPrintConcluded ? "Impresso" : "Pendente"}
                          </span>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStatus(s, "isDelivered");
                            }}
                            className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer transition-transform duration-150 hover:scale-105 active:scale-95 ${s.isDelivered ? "bg-purple-100 text-purple-800" : "bg-yellow-100 text-yellow-800"}`}
                            title="Alternar entregue"
                          >
                            {s.isDelivered ? "Entregue" : "A Enviar"}
                          </span>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStatus(s, "isPaid");
                            }}
                            className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer transition-transform duration-150 hover:scale-105 active:scale-95 ${s.isPaid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                            title="Alternar pago"
                          >
                            {s.isPaid ? "Pago" : "Não Pago"}
                          </span>
                        </td>
                        <td
                          className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClone(s);
                            }}
                            className="mr-3 text-gray-400 hover:text-brand-purple transition-colors"
                            title="Clonar venda"
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
                          <Link
                            href={buildEditHref(s.id)}
                            className="text-brand-purple hover:text-purple-900 mr-4"
                          >
                            Editar
                          </Link>
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                      {expandedSaleId === s.id && (
                        <tr className="bg-purple-50">
                          <td colSpan={7} className="px-6 py-4">
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

      <Modal
        isOpen={!!showIncidentsModal}
        onClose={() => {
          setShowIncidentsModal(null);
          setIsAddingIncident(false);
          setNewIncidentReason("falha_impressao");
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
