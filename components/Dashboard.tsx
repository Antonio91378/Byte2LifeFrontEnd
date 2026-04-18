"use client";

import axios from "axios";

import Link from "next/link";

import { useEffect, useMemo, useRef, useState } from "react";

import Modal from "./Modal";

import PrintScheduleCalendar from "./PrintScheduleCalendar";

interface PrintIncident {
  timestamp: string;

  reason: string;

  comment: string;
}

interface Sale {
  id: string;

  description: string;

  filamentId: string;

  printStatus: string;

  priority: number;

  printStartedAt?: string;

  printStartScheduledAt?: string;

  printStartConfirmedAt?: string;

  printTimeHours?: number;

  designStartConfirmedAt?: string;

  designTimeHours?: number;

  designResponsible?: string;

  designStatus?: string;

  paintStartConfirmedAt?: string;

  paintTimeHours?: number;

  paintResponsible?: string;

  paintStatus?: string;

  tags?: string[];

  deliveryDate?: string;

  incidents?: PrintIncident[];
}

type ServiceStatus = "Active" | "Concluded";

interface ServiceProvider {
  id: string;

  name: string;

  email?: string;

  categories?: string[];

  category?: string;
}

interface DesignTask {
  id: string;

  title: string;

  startAt?: string;

  durationHours?: number;

  responsibleId?: string;

  responsibleName?: string;

  status?: ServiceStatus;
}

interface PaintingTask {
  id: string;

  title: string;

  startAt?: string;

  durationHours?: number;

  responsibleId?: string;

  responsibleName?: string;

  status?: ServiceStatus;
}

interface ServiceSale {
  id: string;

  description?: string;

  designStartConfirmedAt?: string;

  designTimeHours?: number;

  designResponsible?: string;

  designStatus?: ServiceStatus;

  paintStartConfirmedAt?: string;

  paintTimeHours?: number;

  paintResponsible?: string;

  paintStatus?: ServiceStatus;
}

type QueueItemType = "print" | "design" | "painting";

type QueueItemSource = "sale" | "task";

interface QueueItem {
  key: string;

  type: QueueItemType;

  source: QueueItemSource;

  title: string;

  scheduledAt?: string;

  deliveryDate?: string;

  status: string;

  priority?: number;

  rank?: number;

  saleId?: string;

  taskId?: string;

  responsibleId?: string;

  responsibleName?: string;

  incidents?: PrintIncident[];
}

interface FilamentInfo {
  id: string;

  color?: string;

  colorHex?: string;
}

const NOTIFY_LEAD_MINUTES = 30;

const NOTIFICATION_STORAGE_KEY = "byte2life:near-start-notifications";

const normalizeServiceStatus = (value?: string): ServiceStatus =>
  value === "Concluded" ? "Concluded" : "Active";

const isServiceActive = (value?: string) =>
  normalizeServiceStatus(value) === "Active";

const normalizeText = (value?: string) => (value || "").trim().toLowerCase();

const formatDateTime = (value?: string) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("pt-BR");
};

const getQueueTypeLabel = (type: QueueItemType) => {
  if (type === "design") return "Design";

  if (type === "painting") return "Pintura";

  return "Impressão";
};

const getQueueTypeBadge = (type: QueueItemType) => {
  if (type === "design") return "bg-sky-100 text-sky-700";

  if (type === "painting") return "bg-indigo-100 text-indigo-700";

  return "bg-purple-100 text-purple-700";
};

const INCIDENT_REASONS = [
  { value: "PowerLoss", label: "Queda de Energia" },

  { value: "FilamentJam", label: "Entupimento/Trava de Filamento" },

  { value: "LayerShift", label: "Deslocamento de Camada" },

  { value: "AdhesionIssue", label: "Problema de Aderência" },

  { value: "ManualPause", label: "Pausa Manual" },

  { value: "Maintenance", label: "Manutenção" },

  { value: "Other", label: "Outro" },
];

export default function Dashboard() {
  const [currentPrint, setCurrentPrint] = useState<Sale | null>(null);

  const [queue, setQueue] = useState<Sale[]>([]);

  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>(
    [],
  );

  const [designTasks, setDesignTasks] = useState<DesignTask[]>([]);

  const [paintingTasks, setPaintingTasks] = useState<PaintingTask[]>([]);

  const [serviceSales, setServiceSales] = useState<ServiceSale[]>([]);

  const [loading, setLoading] = useState(true);

  const [remainingTime, setRemainingTime] = useState<string>("");

  // Modal State

  const [showFinishModal, setShowFinishModal] = useState(false);

  const [finishStatus, setFinishStatus] = useState("Concluded");

  const [finishTags, setFinishTags] = useState("");

  const [errorReason, setErrorReason] = useState("");

  const [wastedFilament, setWastedFilament] = useState("");

  const [forceZeroTimer, setForceZeroTimer] = useState(false);

  const [showIncidentsModal, setShowIncidentsModal] = useState<Sale | null>(
    null,
  );

  const [showCalendar, setShowCalendar] = useState(false);

  const [currentFilament, setCurrentFilament] = useState<FilamentInfo | null>(
    null,
  );

  const [activeWorkTab, setActiveWorkTab] = useState("printer");

  const notificationCacheRef = useRef<
    Record<string, { startAt: string; notifiedAt: string }>
  >({});

  // Edit Time State

  const [isEditingTime, setIsEditingTime] = useState(false);

  const [editTimeValue, setEditTimeValue] = useState("");

  const [editTimeReason, setEditTimeReason] = useState("Other");

  const [editTimeComment, setEditTimeComment] = useState("");

  const fetchServiceSales = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/sales/services");

      return res.data || [];
    } catch (error: any) {
      if (error?.response?.status === 404) {
        try {
          const res = await axios.get("http://localhost:5000/api/sales");

          const list = (res.data || []).filter(
            (sale: ServiceSale) =>
              sale.designStartConfirmedAt ||
              (Number(sale.designTimeHours) || 0) > 0 ||
              (sale.designResponsible &&
                sale.designResponsible.trim() !== "") ||
              sale.paintStartConfirmedAt ||
              (Number(sale.paintTimeHours) || 0) > 0 ||
              (sale.paintResponsible && sale.paintResponsible.trim() !== ""),
          );

          return list;
        } catch (fallbackError) {
          console.error("Error fetching services fallback", fallbackError);

          return [];
        }
      }

      console.error("Error fetching services schedule", error);

      return [];
    }
  };

  const fetchData = async () => {
    try {
      const [
        currentRes,

        queueRes,

        providersRes,

        designRes,

        paintingRes,

        serviceSalesList,
      ] = await Promise.all([
        axios.get("http://localhost:5000/api/sales/current"),

        axios.get("http://localhost:5000/api/sales/queue"),

        axios
          .get("http://localhost:5000/api/service-providers")
          .catch((error) => {
            console.error("Error fetching service providers", error);

            return { data: [] };
          }),

        axios.get("http://localhost:5000/api/designs").catch((error) => {
          console.error("Error fetching design tasks", error);

          return { data: [] };
        }),

        axios.get("http://localhost:5000/api/paintings").catch((error) => {
          console.error("Error fetching painting tasks", error);

          return { data: [] };
        }),

        fetchServiceSales(),
      ]);

      if (currentRes.status === 204) {
        setCurrentPrint(null);

        setForceZeroTimer(false); // Reset when no print
      } else {
        // If it's a new print (different ID), reset forceZeroTimer

        if (currentPrint && currentPrint.id !== currentRes.data.id) {
          setForceZeroTimer(false);
        }

        setCurrentPrint(currentRes.data);
      }

      setQueue(queueRes.data || []);

      setServiceProviders(providersRes.data || []);

      setDesignTasks(designRes.data || []);

      setPaintingTasks(paintingRes.data || []);

      setServiceSales(serviceSalesList || []);
    } catch (error) {
      console.error("Error fetching dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const interval = setInterval(fetchData, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchFilament = async () => {
      if (!currentPrint?.filamentId) {
        setCurrentFilament(null);

        return;
      }

      try {
        const res = await axios.get(
          `http://localhost:5000/api/filaments/${currentPrint.filamentId}`,
        );

        if (!isMounted) return;

        setCurrentFilament({
          id: res.data?.id || currentPrint.filamentId,

          color: res.data?.color || "",

          colorHex: res.data?.colorHex || "",
        });
      } catch {
        if (!isMounted) return;

        setCurrentFilament(null);
      }
    };

    fetchFilament();

    return () => {
      isMounted = false;
    };
  }, [currentPrint?.filamentId]);

  useEffect(() => {
    if (
      !currentPrint ||
      !currentPrint.printStartedAt ||
      !currentPrint.printTimeHours ||
      currentPrint.printStatus !== "InProgress"
    ) {
      setRemainingTime("");

      return;
    }

    if (forceZeroTimer) {
      setRemainingTime("00:00:00");

      return;
    }

    const updateTimer = () => {
      const start = new Date(currentPrint.printStartedAt!).getTime();

      const totalMs = (currentPrint.printTimeHours || 0) * 3600 * 1000;

      const end = start + totalMs;

      const now = new Date().getTime();

      const diff = end - now;

      if (diff <= 0) {
        setRemainingTime("00:00:00");
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));

        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setRemainingTime(
          `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
        );
      }
    };

    updateTimer();

    const timerInterval = setInterval(updateTimer, 1000);

    return () => clearInterval(timerInterval);
  }, [currentPrint, forceZeroTimer]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = window.localStorage.getItem(NOTIFICATION_STORAGE_KEY);

      if (stored) {
        const parsed = JSON.parse(stored) as Record<
          string,
          { startAt: string; notifiedAt: string }
        >;

        notificationCacheRef.current = parsed || {};
      }
    } catch (error) {
      console.warn("Nao foi possivel carregar cache de notificacoes", error);
    }
  }, []);

  const resolveResponsibleName = (
    responsibleId?: string,
    responsibleName?: string,
  ) => {
    const trimmed = (responsibleName || "").trim();

    if (trimmed) return trimmed;

    if (responsibleId) {
      const provider = serviceProviders.find(
        (item) => item.id === responsibleId,
      );

      if (provider) return provider.name;
    }

    return "";
  };

  const printQueueItems = useMemo<QueueItem[]>(() => {
    return queue.map((sale) => ({
      key: `print-${sale.id}`,

      type: "print",

      source: "sale",

      title: sale.description || "Impressão",

      scheduledAt: sale.printStartConfirmedAt || sale.printStartScheduledAt,

      deliveryDate: sale.deliveryDate,

      status: sale.printStatus,

      priority: sale.priority,

      incidents: sale.incidents,

      saleId: sale.id,
    }));
  }, [queue]);

  const serviceQueueItems = useMemo<QueueItem[]>(() => {
    const items: QueueItem[] = [];

    serviceSales.forEach((sale) => {
      const designStatus = normalizeServiceStatus(sale.designStatus);

      const hasDesignService = Boolean(
        sale.designStartConfirmedAt ||
        (Number(sale.designTimeHours) || 0) > 0 ||
        (sale.designResponsible && sale.designResponsible.trim() !== ""),
      );

      if (hasDesignService && isServiceActive(designStatus)) {
        items.push({
          key: `sale-design-${sale.id}`,

          type: "design",

          source: "sale",

          title: sale.description || "Serviço de design",

          scheduledAt: sale.designStartConfirmedAt,

          status: designStatus,

          saleId: sale.id,

          responsibleName: sale.designResponsible || "",
        });
      }

      const paintStatus = normalizeServiceStatus(sale.paintStatus);

      const hasPaintService = Boolean(
        sale.paintStartConfirmedAt ||
        (Number(sale.paintTimeHours) || 0) > 0 ||
        (sale.paintResponsible && sale.paintResponsible.trim() !== ""),
      );

      if (hasPaintService && isServiceActive(paintStatus)) {
        items.push({
          key: `sale-paint-${sale.id}`,

          type: "painting",

          source: "sale",

          title: sale.description || "Serviço de pintura",

          scheduledAt: sale.paintStartConfirmedAt,

          status: paintStatus,

          saleId: sale.id,

          responsibleName: sale.paintResponsible || "",
        });
      }
    });

    designTasks.forEach((task) => {
      const status = normalizeServiceStatus(task.status);

      if (!isServiceActive(status)) return;

      items.push({
        key: `task-design-${task.id}`,

        type: "design",

        source: "task",

        title: task.title || "Design",

        scheduledAt: task.startAt,

        status,

        taskId: task.id,

        responsibleId: task.responsibleId,

        responsibleName: resolveResponsibleName(
          task.responsibleId,
          task.responsibleName,
        ),
      });
    });

    paintingTasks.forEach((task) => {
      const status = normalizeServiceStatus(task.status);

      if (!isServiceActive(status)) return;

      items.push({
        key: `task-paint-${task.id}`,

        type: "painting",

        source: "task",

        title: task.title || "Pintura",

        scheduledAt: task.startAt,

        status,

        taskId: task.id,

        responsibleId: task.responsibleId,

        responsibleName: resolveResponsibleName(
          task.responsibleId,
          task.responsibleName,
        ),
      });
    });

    return items;
  }, [serviceSales, designTasks, paintingTasks, serviceProviders]);

  const priorityQueue = useMemo<QueueItem[]>(() => {
    const combined = [...printQueueItems, ...serviceQueueItems];

    const sorted = [...combined].sort((a, b) => {
      const aTime = a.scheduledAt
        ? new Date(a.scheduledAt).getTime()
        : Number.POSITIVE_INFINITY;

      const bTime = b.scheduledAt
        ? new Date(b.scheduledAt).getTime()
        : Number.POSITIVE_INFINITY;

      if (aTime !== bTime) return aTime - bTime;

      const aPriority = a.type === "print" ? (a.priority ?? 999) : 999;

      const bPriority = b.type === "print" ? (b.priority ?? 999) : 999;

      if (aPriority !== bPriority) return aPriority - bPriority;

      return a.title.localeCompare(b.title);
    });

    return sorted.map((item, index) => ({
      ...item,

      rank: index + 1,
    }));
  }, [printQueueItems, serviceQueueItems]);

  const printerQueueItems = useMemo(
    () => priorityQueue.filter((item) => item.type === "print"),

    [priorityQueue],
  );

  const serviceProviderTabs = useMemo(() => {
    return serviceProviders

      .map((provider) => {
        const items = priorityQueue.filter((item) => {
          if (item.type === "print") return false;

          if (item.responsibleId && item.responsibleId === provider.id)
            return true;

          if (
            item.responsibleName &&
            normalizeText(item.responsibleName) === normalizeText(provider.name)
          )
            return true;

          return false;
        });

        if (items.length === 0) return null;

        return {
          id: `provider-${provider.id}`,

          label: provider.name,

          count: items.length,

          provider,

          items,
        };
      })

      .filter(Boolean) as Array<{
      id: string;

      label: string;

      count: number;

      provider: ServiceProvider;

      items: QueueItem[];
    }>;
  }, [serviceProviders, priorityQueue]);

  const workTabs = useMemo(() => {
    return [
      { id: "printer", label: "Impressora", count: printerQueueItems.length },

      ...serviceProviderTabs.map((tab) => ({
        id: tab.id,

        label: tab.label,

        count: tab.count,
      })),
    ];
  }, [printerQueueItems.length, serviceProviderTabs]);

  useEffect(() => {
    if (workTabs.length === 0) return;

    if (!workTabs.some((tab) => tab.id === activeWorkTab)) {
      setActiveWorkTab(workTabs[0].id);
    }
  }, [workTabs, activeWorkTab]);

  const activeServiceTab =
    serviceProviderTabs.find((tab) => tab.id === activeWorkTab) || null;

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (priorityQueue.length === 0) return;

    const now = Date.now();

    const leadMs = NOTIFY_LEAD_MINUTES * 60 * 1000;

    const cache = { ...notificationCacheRef.current };

    let cacheChanged = false;

    const allProviderEmails = serviceProviders

      .map((provider) => provider.email?.trim())

      .filter(Boolean) as string[];

    const resolveProviderEmail = (item: QueueItem) => {
      if (item.responsibleId) {
        const provider = serviceProviders.find(
          (p) => p.id === item.responsibleId,
        );

        if (provider?.email) return provider.email;
      }

      if (item.responsibleName) {
        const provider = serviceProviders.find(
          (p) => normalizeText(p.name) === normalizeText(item.responsibleName),
        );

        if (provider?.email) return provider.email;
      }

      return "";
    };

    priorityQueue.forEach((item) => {
      if (!item.scheduledAt) return;

      const startMs = new Date(item.scheduledAt).getTime();

      if (Number.isNaN(startMs)) return;

      const diff = startMs - now;

      if (diff < 0 || diff > leadMs) return;

      const cached = cache[item.key];

      if (cached?.startAt === item.scheduledAt) {
        return;
      }

      const recipients =
        item.type === "print"
          ? allProviderEmails
          : [resolveProviderEmail(item)].filter(Boolean);

      if (recipients.length === 0) return;

      const typeLabel =
        item.type === "print"
          ? "Impressão"
          : item.type === "design"
            ? "Design"
            : "Pintura";

      const subject = `${typeLabel} prestes a iniciar`;

      const body = [
        `O trabalho de ${typeLabel.toLowerCase()} está prestes a iniciar.`,

        `Descrição: ${item.title}`,

        `Início previsto: ${formatDateTime(item.scheduledAt)}`,

        item.rank ? `Prioridade: ${item.rank}` : "",

        item.responsibleName ? `Responsável: ${item.responsibleName}` : "",

        item.type === "print"
          ? "Notificação enviada a todos os funcionários."
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      axios
        .post("http://localhost:5000/api/notifications/email", {
          to: recipients,

          subject,

          body,
        })
        .catch((error) => {
          console.error("Erro ao enviar notificacao de email", error);
        });

      cache[item.key] = {
        startAt: item.scheduledAt,

        notifiedAt: new Date().toISOString(),
      };

      cacheChanged = true;
    });

    if (cacheChanged) {
      notificationCacheRef.current = cache;

      try {
        window.localStorage.setItem(
          NOTIFICATION_STORAGE_KEY,
          JSON.stringify(cache),
        );
      } catch (error) {
        console.warn("Nao foi possivel salvar cache de notificacoes", error);
      }
    }
  }, [priorityQueue, serviceProviders]);

  const handleSaveTime = async () => {
    if (!currentPrint || !currentPrint.printStartedAt) return;

    try {
      // Parse editTimeValue (HH:MM or HH:MM:SS)

      const parts = editTimeValue.split(":");

      if (parts.length < 2) {
        alert("Formato inválido. Use HH:MM");

        return;
      }

      const hours = parseInt(parts[0]);

      const minutes = parseInt(parts[1]);

      const seconds = parts.length > 2 ? parseInt(parts[2]) : 0;

      if (isNaN(hours) || isNaN(minutes)) {
        alert("Valores inválidos");

        return;
      }

      const remainingMs = (hours * 3600 + minutes * 60 + seconds) * 1000;

      const startMs = new Date(currentPrint.printStartedAt).getTime();

      const nowMs = new Date().getTime();

      // New Total Duration = (Now + Remaining) - Start

      const newTotalDurationMs = nowMs + remainingMs - startMs;

      // Ensure duration is positive

      if (newTotalDurationMs < 0) {
        alert("O tempo total não pode ser negativo");

        return;
      }

      const newTotalDurationHours = newTotalDurationMs / (1000 * 3600);

      const commentText = editTimeComment.trim();

      const newIncident = {
        timestamp: new Date().toISOString(),

        reason: editTimeReason,

        comment: commentText
          ? `${commentText} (Tempo ajustado para ${editTimeValue})`
          : `Tempo ajustado para ${editTimeValue}`,
      };

      const updatedIncidents = currentPrint.incidents
        ? [...currentPrint.incidents, newIncident]
        : [newIncident];

      await axios.put(`http://localhost:5000/api/sales/${currentPrint.id}`, {
        ...currentPrint,

        printTimeHours: newTotalDurationHours,

        incidents: updatedIncidents,
      });

      setIsEditingTime(false);

      setEditTimeReason("Other");

      setEditTimeComment("");

      fetchData();
    } catch (error) {
      console.error("Error updating time", error);

      alert("Erro ao atualizar tempo");
    }
  };

  const handleConfirmFinish = async () => {
    if (!currentPrint) return;

    try {
      // 1. Update current print

      const tagsArray = finishTags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t);

      const updateData: any = {
        ...currentPrint,

        printStatus: finishStatus,

        tags: tagsArray,
      };

      if (finishStatus === "Concluded") {
        updateData.isPrintConcluded = true;
      }

      if (finishStatus === "Failed") {
        updateData.errorReason = errorReason;

        updateData.wastedFilamentGrams = parseFloat(wastedFilament) || 0;
      }

      await axios.put(
        `http://localhost:5000/api/sales/${currentPrint.id}`,
        updateData,
      );

      // 2. Promote next item if exists

      if (queue.length > 0) {
        const nextItem = queue[0];

        await axios.put(`http://localhost:5000/api/sales/${nextItem.id}`, {
          ...nextItem,

          printStatus: "Staged",
        });
      }

      setShowFinishModal(false);

      setFinishTags("");

      setFinishStatus("Concluded");

      setErrorReason("");

      setWastedFilament("");

      fetchData();
    } catch (error) {
      console.error("Error finishing print", error);

      alert("Erro ao finalizar impressão");
    }
  };

  const handleStartPrint = async () => {
    if (!currentPrint) return;

    try {
      await axios.put(`http://localhost:5000/api/sales/${currentPrint.id}`, {
        ...currentPrint,

        printStatus: "InProgress",
      });

      fetchData();
    } catch (error) {
      console.error("Error starting print", error);

      alert("Erro ao iniciar impressão");
    }
  };

  const handleStageItem = async (item: Sale) => {
    try {
      // Se já existe uma venda preparada, devolve para fila

      if (currentPrint && currentPrint.printStatus === "Staged") {
        await axios.put(`http://localhost:5000/api/sales/${currentPrint.id}`, {
          ...currentPrint,

          printStatus: "InQueue",
        });
      }

      await axios.put(`http://localhost:5000/api/sales/${item.id}`, {
        ...item,

        printStatus: "Staged",
      });

      fetchData();
    } catch (error) {
      console.error("Error staging item", error);

      alert("Erro ao preparar item");
    }
  };

  if (loading) {
    return <div className="text-center py-8">Carregando dashboard...</div>;
  }

  return (
    <div className="space-y-8 mb-12">
      <Modal
        isOpen={showFinishModal}
        onClose={() => setShowFinishModal(false)}
        title="Finalizar Impressão"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Novo Status
            </label>

            <select
              value={finishStatus}
              onChange={(e) => setFinishStatus(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-purple focus:border-brand-purple p-2 border text-gray-900 bg-white"
            >
              <option value="Concluded">Concluído</option>

              <option value="Failed">Falhou</option>
            </select>
          </div>

          {finishStatus === "Failed" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo do Erro
                </label>

                <textarea
                  value={errorReason}
                  onChange={(e) => setErrorReason(e.target.value)}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-purple focus:border-brand-purple p-2 border text-gray-900 bg-white"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filamento Desperdiçado (g)
                </label>

                <input
                  type="number"
                  value={wastedFilament}
                  onChange={(e) => setWastedFilament(e.target.value)}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-purple focus:border-brand-purple p-2 border text-gray-900 bg-white"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags (separadas por vírgula)
            </label>

            <input
              type="text"
              value={finishTags}
              onChange={(e) => setFinishTags(e.target.value)}
              placeholder="Ex: boa_qualidade, erro_camada"
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-purple focus:border-brand-purple p-2 border text-gray-900 bg-white"
            />
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => {
                setShowFinishModal(false);

                setForceZeroTimer(false);
              }}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>

            <button
              onClick={handleConfirmFinish}
              className="px-4 py-2 bg-brand-purple text-white rounded-lg hover:bg-purple-800"
            >
              Confirmar
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!showIncidentsModal}
        onClose={() => setShowIncidentsModal(null)}
        title="Ocorrências da Impressão"
      >
        <div className="space-y-4">
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
                      {INCIDENT_REASONS.find((r) => r.value === incident.reason)
                        ?.label || incident.reason}
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
            <p className="text-gray-500 text-center">
              Nenhuma ocorrência registrada.
            </p>
          )}
        </div>
      </Modal>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Current Print Card */}

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-brand-purple p-4 text-white">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                ></path>
              </svg>
              Impressão Atual
            </h2>

            <div className="mt-3 flex flex-wrap gap-2">
              {workTabs.map((tab) => {
                const isActive = tab.id === activeWorkTab;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveWorkTab(tab.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      isActive
                        ? "bg-white text-brand-purple"
                        : "bg-white/15 text-white hover:bg-white/25"
                    }`}
                  >
                    <span>{tab.label}</span>

                    <span
                      className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isActive
                          ? "bg-brand-purple text-white"
                          : "bg-white/30 text-white"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-5 text-center sm:p-8">
            {activeWorkTab === "printer" ? (
              currentPrint ? (
                <div className="space-y-4">
                  {currentPrint.printStatus === "InProgress" && (
                    <>
                      <div className="animate-pulse inline-block px-4 py-1 rounded-full bg-green-100 text-green-800 font-semibold text-sm mb-2">
                        Em Andamento
                      </div>

                      <h3 className="wrap-break-word text-2xl font-bold text-gray-800 sm:text-3xl">
                        {currentPrint.description}
                      </h3>

                      <p className="text-sm text-gray-500 sm:text-base">
                        Iniciado em:{" "}
                        {currentPrint.printStartedAt
                          ? new Date(
                              currentPrint.printStartedAt,
                            ).toLocaleString()
                          : "N/A"}
                      </p>

                      {remainingTime && (
                        <div className="my-4 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
                          {isEditingTime ? (
                            <div className="flex flex-col items-center gap-2 bg-white p-4 rounded-xl border border-gray-200 shadow-lg z-10">
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editTimeValue}
                                  onChange={(e) =>
                                    setEditTimeValue(e.target.value)
                                  }
                                  className="text-2xl font-mono font-bold text-brand-purple bg-white px-3 py-1 rounded-lg border-2 border-brand-purple w-32 text-center"
                                  autoFocus
                                  placeholder="HH:MM"
                                />
                              </div>

                              <select
                                value={editTimeReason}
                                onChange={(e) =>
                                  setEditTimeReason(e.target.value)
                                }
                                className="w-full text-sm text-gray-900 bg-white border-gray-300 rounded-md shadow-sm focus:ring-brand-purple focus:border-brand-purple p-1"
                              >
                                {INCIDENT_REASONS.map((reason) => (
                                  <option
                                    key={reason.value}
                                    value={reason.value}
                                    className="text-gray-900"
                                  >
                                    {reason.label}
                                  </option>
                                ))}
                              </select>

                              <textarea
                                value={editTimeComment}
                                onChange={(e) =>
                                  setEditTimeComment(e.target.value)
                                }
                                rows={2}
                                className="w-full text-sm text-gray-900 bg-white border-gray-300 rounded-md shadow-sm focus:ring-brand-purple focus:border-brand-purple p-2"
                                placeholder="Comentário da ocorrência"
                              />

                              <div className="flex gap-2 w-full justify-center mt-1">
                                <button
                                  onClick={handleSaveTime}
                                  className="px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm font-medium flex items-center gap-1"
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
                                      d="M5 13l4 4L19 7"
                                    ></path>
                                  </svg>
                                  Salvar
                                </button>

                                <button
                                  onClick={() => {
                                    setIsEditingTime(false);

                                    setEditTimeComment("");
                                  }}
                                  className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium flex items-center gap-1"
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
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="group relative">
                              <div className="flex flex-wrap items-center justify-center gap-3 rounded-xl border border-purple-100 bg-purple-50 px-4 py-2 font-mono text-3xl font-bold text-brand-purple sm:px-6 sm:text-4xl">
                                {remainingTime}

                                {currentPrint.incidents &&
                                  currentPrint.incidents.length > 0 && (
                                    <button
                                      onClick={() =>
                                        setShowIncidentsModal(currentPrint)
                                      }
                                      className="text-yellow-500 hover:text-yellow-600 transition-colors"
                                      title="Ver ocorrências"
                                    >
                                      <svg
                                        className="w-6 h-6"
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

                              <button
                                onClick={() => {
                                  setEditTimeValue(
                                    remainingTime.substring(0, 5),
                                  );

                                  setEditTimeComment("");

                                  setIsEditingTime(true);
                                }}
                                className="mt-2 inline-flex items-center gap-1 rounded-full border border-brand-purple/15 bg-white px-3 py-1 text-sm font-medium text-brand-purple shadow-sm transition-all sm:absolute sm:-right-10 sm:top-1/2 sm:mt-0 sm:-translate-y-1/2 sm:border-0 sm:bg-transparent sm:p-2 sm:text-gray-400 sm:shadow-none sm:opacity-0 sm:group-hover:opacity-100 sm:hover:text-brand-purple"
                                title="Editar tempo restante"
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
                                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                  ></path>
                                </svg>

                                <span className="sm:hidden">Editar tempo</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-4">
                        <div className="bg-brand-purple h-2.5 rounded-full w-2/3"></div>
                      </div>

                      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
                        <Link
                          href={`/sales/${currentPrint.id}`}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-brand-purple px-6 py-3 text-base font-semibold text-brand-purple shadow-sm transition-colors hover:bg-purple-50 sm:w-auto sm:py-2 sm:text-sm"
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
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            ></path>
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            ></path>
                          </svg>
                          Ver Detalhes
                        </Link>

                        <button
                          onClick={() => {
                            setForceZeroTimer(true);

                            setShowFinishModal(true);
                          }}
                          className="w-full rounded-lg bg-brand-purple px-6 py-3 text-base font-semibold text-white shadow-md transition-colors hover:bg-purple-800 sm:w-auto sm:py-2 sm:text-sm"
                        >
                          Finalizar Impressão
                        </button>
                      </div>
                    </>
                  )}

                  {currentPrint.printStatus === "Staged" && (
                    <>
                      <div className="inline-block px-4 py-1 rounded-full bg-yellow-100 text-yellow-800 font-semibold text-sm mb-2">
                        Aguardando Início
                      </div>

                      <h3 className="wrap-break-word text-2xl font-bold text-gray-800 sm:text-3xl">
                        {currentPrint.description}
                      </h3>

                      <p className="text-sm text-gray-500 sm:text-base">
                        Pronto para imprimir
                      </p>

                      {currentFilament && (
                        <div className="mt-4 inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700 sm:text-sm">
                          <span
                            className="h-3.5 w-3.5 rounded border border-gray-300"
                            style={{
                              backgroundColor:
                                currentFilament.colorHex || "#ffffff",
                            }}
                          ></span>

                          <span className="font-medium">
                            {currentFilament.color
                              ? `Filamento: ${currentFilament.color}`
                              : "Filamento: cor não informada"}
                          </span>
                        </div>
                      )}

                      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
                        <Link
                          href={`/sales/${currentPrint.id}`}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-brand-purple px-6 py-3 text-base font-bold text-brand-purple shadow-sm transition-colors hover:bg-purple-50 sm:w-auto sm:text-lg"
                        >
                          <svg
                            className="w-6 h-6"
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
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            ></path>
                          </svg>
                          Ver Detalhes
                        </Link>

                        <button
                          onClick={handleStartPrint}
                          className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-base font-bold text-white shadow-md transition-colors hover:bg-green-700 sm:w-auto sm:text-lg"
                        >
                          <svg
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                            ></path>
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            ></path>
                          </svg>
                          Iniciar Contabilizador
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="py-8 text-gray-400">
                  <p className="text-xl">Nenhuma impressão em andamento</p>

                  <p className="text-sm mt-2">
                    Selecione um item da fila para iniciar
                  </p>
                </div>
              )
            ) : (
              <div className="space-y-5 text-left">
                {activeServiceTab ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                        <span>{activeServiceTab.label}</span>

                        <span className="rounded-full bg-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
                          {activeServiceTab.count}
                        </span>
                      </div>

                      <Link
                        href="/services/manage"
                        className="text-xs font-semibold text-brand-purple hover:text-purple-900"
                      >
                        Abrir serviços
                      </Link>
                    </div>

                    {activeServiceTab.items.length > 0 ? (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded-full ${getQueueTypeBadge(activeServiceTab.items[0].type)}`}
                            >
                              {getQueueTypeLabel(
                                activeServiceTab.items[0].type,
                              )}
                            </span>

                            {activeServiceTab.items[0].rank && (
                              <span className="text-xs font-semibold text-gray-500">
                                Prioridade #{activeServiceTab.items[0].rank}
                              </span>
                            )}
                          </div>

                          <h3 className="mt-3 text-lg font-bold text-gray-800">
                            {activeServiceTab.items[0].title}
                          </h3>

                          <p className="text-sm text-gray-500">
                            Início previsto:{" "}
                            {formatDateTime(
                              activeServiceTab.items[0].scheduledAt,
                            )}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-3">
                            {activeServiceTab.items[0].saleId && (
                              <Link
                                href={`/sales/${activeServiceTab.items[0].saleId}`}
                                className="px-4 py-2 border border-brand-purple text-brand-purple rounded-lg hover:bg-purple-50 transition-colors text-sm font-semibold"
                              >
                                Ver venda
                              </Link>
                            )}

                            {activeServiceTab.items[0].taskId && (
                              <Link
                                href={`/services/manage?editType=${activeServiceTab.items[0].type}&editId=${activeServiceTab.items[0].taskId}`}
                                className="px-4 py-2 border border-brand-purple text-brand-purple rounded-lg hover:bg-purple-50 transition-colors text-sm font-semibold"
                              >
                                Ver serviço
                              </Link>
                            )}
                          </div>
                        </div>

                        {activeServiceTab.items.length > 1 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                              Próximos na fila
                            </p>

                            <ul className="space-y-2">
                              {activeServiceTab.items
                                .slice(1, 4)
                                .map((item) => (
                                  <li
                                    key={item.key}
                                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2"
                                  >
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getQueueTypeBadge(item.type)}`}
                                        >
                                          {getQueueTypeLabel(item.type)}
                                        </span>

                                        <span className="text-xs text-gray-400">
                                          #{item.rank}
                                        </span>
                                      </div>

                                      <p className="text-sm font-medium text-gray-700 truncate">
                                        {item.title}
                                      </p>
                                    </div>

                                    <span className="text-xs text-gray-500 whitespace-nowrap">
                                      {formatDateTime(item.scheduledAt)}
                                    </span>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-8 text-gray-400 text-center">
                        <p className="text-sm">
                          Nenhum serviço pendente para este responsável.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-8 text-gray-400 text-center">
                    <p className="text-sm">Nenhum serviço na fila.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Queue Card */}

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col">
          <div className="bg-brand-orange p-4 text-white">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                ></path>
              </svg>
              Fila de Impressão
            </h2>
          </div>

          <div className="max-h-75 grow overflow-auto p-0">
            {priorityQueue.length > 0 ? (
              <table className="min-w-180 w-full text-left table-auto">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="w-30 px-3 py-3 sm:px-6">Prioridade</th>

                    <th className="w-35 px-3 py-3 sm:px-6">Entrega/Início</th>

                    <th className="px-3 py-3 sm:px-6">Descrição</th>

                    <th className="w-30 px-3 py-3 sm:px-6">Status</th>

                    <th className="w-30 px-3 py-3 sm:px-6">Ação</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {priorityQueue.map((item) => {
                    const priorityValue = item.rank ?? item.priority ?? 0;

                    const statusLabel =
                      item.type === "print"
                        ? item.status
                        : isServiceActive(item.status)
                          ? "Ativo"
                          : "Concluído";

                    const detailHref =
                      item.type === "print"
                        ? `/sales/${item.saleId}`
                        : item.source === "task"
                          ? `/services/manage?editType=${item.type}&editId=${item.taskId}`
                          : item.saleId
                            ? `/sales/${item.saleId}`
                            : "#";

                    const scheduleLabel =
                      item.type === "print"
                        ? item.deliveryDate
                          ? new Date(item.deliveryDate).toLocaleDateString(
                              "pt-BR",
                            )
                          : "-"
                        : item.scheduledAt
                          ? new Date(item.scheduledAt).toLocaleString("pt-BR")
                          : "-";

                    const saleItem =
                      item.type === "print"
                        ? queue.find((sale) => sale.id === item.saleId)
                        : null;

                    return (
                      <tr key={item.key} className="hover:bg-gray-50">
                        <td className="px-3 py-4 font-medium text-gray-900 sm:px-6">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              priorityValue <= 1
                                ? "bg-red-600 text-white"
                                : priorityValue <= 3
                                  ? "bg-orange-100 text-orange-800"
                                  : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {priorityValue}
                          </span>
                        </td>

                        <td className="px-3 py-4 text-sm text-gray-700 sm:px-6">
                          {scheduleLabel}
                        </td>

                        <td className="px-3 py-4 text-gray-700 sm:px-6">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getQueueTypeBadge(item.type)}`}
                            >
                              {getQueueTypeLabel(item.type)}
                            </span>

                            <div className="min-w-0 flex-1 wrap-break-word">
                              {item.title}
                            </div>

                            {item.type === "print" &&
                              item.incidents &&
                              item.incidents.length > 0 && (
                                <button
                                  onClick={() => {
                                    const target = queue.find(
                                      (sale) => sale.id === item.saleId,
                                    );

                                    if (target) {
                                      setShowIncidentsModal(target);
                                    }
                                  }}
                                  className="text-yellow-500 hover:text-yellow-600 transition-colors"
                                  title="Ver ocorrências"
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
                        </td>

                        <td className="px-3 py-4 sm:px-6">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
                            {statusLabel}
                          </span>
                        </td>

                        <td className="px-3 py-4 sm:px-6">
                          <div className="flex min-w-33 flex-col items-start gap-2 sm:min-w-0 sm:flex-row sm:flex-wrap sm:items-center">
                            {detailHref !== "#" && (
                              <Link
                                href={detailHref}
                                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-brand-purple/30 hover:bg-purple-50 hover:text-brand-purple"
                                title="Ver Detalhes"
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
                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                  ></path>
                                </svg>

                                <span>Detalhes</span>
                              </Link>
                            )}

                            {item.type === "print" && saleItem && (
                              <button
                                onClick={() => handleStageItem(saleItem)}
                                className="inline-flex items-center gap-1.5 rounded-full bg-brand-purple/10 px-3 py-2 text-xs font-semibold text-brand-purple transition-colors hover:bg-brand-purple/15 hover:text-purple-900"
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
                                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                                  ></path>
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                  ></path>
                                </svg>

                                <span>Iniciar</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-gray-400">
                <p>A fila está vazia</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-10">
        {!showCalendar && (
          <button
            type="button"
            onClick={() => setShowCalendar(true)}
            className="w-full py-4 rounded-2xl border border-gray-200 bg-white text-brand-purple font-semibold shadow-sm hover:shadow-md transition-shadow"
          >
            Abrir agenda de impressao
          </button>
        )}

        <div
          className={`transition-all duration-500 ease-out overflow-hidden ${
            showCalendar
              ? "max-h-[1800px] opacity-100 translate-y-0 mt-6"
              : "max-h-0 opacity-0 -translate-y-2"
          }`}
        >
          {showCalendar && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowCalendar(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 transition-colors text-sm font-semibold"
                >
                  Ocultar agenda
                </button>
              </div>

              <PrintScheduleCalendar
                readOnly
                allowDrag
                showSuggestionSummary={false}
                showDesign
                showPainting
                allowImmediateStart
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
