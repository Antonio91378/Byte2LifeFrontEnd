"use client";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import axios from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { parseDurationToHours } from '@/utils/time';
import { useDialog } from '@/context/DialogContext';

interface PrintScheduleCalendarProps {
  estimatedHours?: number;
  hasPainting?: boolean;
  hasCustomArt?: boolean;
  layout?: 'auto' | 'stacked';
  designHours?: number;
  designStartValue?: string | null;
  onDesignChange?: (value: string | null) => void;
  designResponsible?: string;
  showDesign?: boolean;
  paintHours?: number;
  paintValue?: string | null;
  onPaintChange?: (value: string | null) => void;
  paintResponsible?: string;
  showPainting?: boolean;
  value?: string | null;
  onChange?: (value: string | null) => void;
  readOnly?: boolean;
  allowDrag?: boolean;
  saleId?: string;
  showSuggestionSummary?: boolean;
  allowImmediateStart?: boolean;
}

interface QueueSale {
  id: string;
  description?: string;
  printTimeHours?: number;
  designPrintTime?: string;
  printStartedAt?: string;
  printStartConfirmedAt?: string;
  printStartScheduledAt?: string;
  printStatus?: string;
  hasPainting?: boolean;
  hasCustomArt?: boolean;
  paintStartConfirmedAt?: string;
  paintTimeHours?: number;
  paintResponsible?: string;
  paintStatus?: 'Active' | 'Concluded';
  designStartConfirmedAt?: string;
  designTimeHours?: number;
  designResponsible?: string;
  designValue?: number;
  designStatus?: 'Active' | 'Concluded';
}

interface DesignTask {
  id: string;
  title: string;
  startAt?: string;
  durationHours?: number;
  responsibleName?: string;
  value?: number;
  status?: 'Active' | 'Concluded';
}

interface PaintingTask {
  id: string;
  title: string;
  startAt?: string;
  durationHours?: number;
  responsibleName?: string;
  value?: number;
  status?: 'Active' | 'Concluded';
}

interface HoverCardData {
  x: number;
  y: number;
  title: string;
  typeLabel: string;
  start: Date;
  end: Date;
  durationHours?: number;
  status?: string;
  responsible?: string;
  value?: number;
  taskId?: string;
  taskType?: 'design' | 'painting';
  serviceStatus?: 'Active' | 'Concluded';
  saleId?: string;
  editPath?: string;
  entityType?: 'print' | 'design' | 'painting';
}

const PRINT_START_HOUR = 8;
const LAST_START_HOUR = 23;
const DELIVERY_CUTOFF_HOUR = 18;
const GAP_MINUTES = 20;

function isValidObjectId(value?: string) {
  return typeof value === 'string' && value.length === 24;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function formatDateTime(value: Date) {
  return value.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatCurrency(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function normalizeServiceStatus(value?: string) {
  return value === 'Concluded' ? 'Concluded' : 'Active';
}

function isServiceActive(value?: string) {
  return normalizeServiceStatus(value) === 'Active';
}

function getHoverPosition(
  event: MouseEvent,
  options: { width?: number; height?: number; anchorRect?: DOMRect } = {}
) {
  const width = options.width ?? 288;
  const height = options.height ?? 220;
  if (typeof window === 'undefined') {
    return { x: event.clientX, y: event.clientY };
  }
  const padding = 12;
  const anchor = options.anchorRect;
  let x = anchor ? anchor.left : event.clientX + padding;
  let y = anchor ? anchor.top - height - padding : event.clientY + padding;

  if (anchor && y < padding) {
    y = anchor.bottom + padding;
  }

  const maxX = window.innerWidth - width - padding;
  const maxY = window.innerHeight - height - padding;
  x = Math.min(Math.max(padding, x), Math.max(padding, maxX));
  y = Math.min(Math.max(padding, y), Math.max(padding, maxY));
  return { x, y };
}

function alignStart(candidate: Date, applyGapIfShifted: boolean) {
  const dayStart = new Date(candidate);
  dayStart.setHours(PRINT_START_HOUR, 0, 0, 0);
  const dayEndStart = new Date(candidate);
  dayEndStart.setHours(LAST_START_HOUR, 0, 0, 0);

  if (candidate < dayStart) {
    return applyGapIfShifted ? addMinutes(dayStart, GAP_MINUTES) : dayStart;
  }

  if (candidate > dayEndStart) {
    const nextDayStart = new Date(dayStart);
    nextDayStart.setDate(nextDayStart.getDate() + 1);
    return applyGapIfShifted ? addMinutes(nextDayStart, GAP_MINUTES) : nextDayStart;
  }

  return candidate;
}

function findNextAvailableStart(
  baseTime: Date,
  occupied: { start: Date; end: Date; saleId?: string }[],
  durationHours: number
) {
  let candidate = alignStart(baseTime, false);
  if (durationHours <= 0) return candidate;

  const sorted = [...occupied].sort((a, b) => a.start.getTime() - b.start.getTime());
  for (const slot of sorted) {
    const latestStart = addMinutes(slot.start, -GAP_MINUTES);
    const candidateEnd = addHours(candidate, durationHours);
    if (candidateEnd <= latestStart) {
      return candidate;
    }

    const blockedEnd = addMinutes(slot.end, GAP_MINUTES);
    if (candidate < blockedEnd) {
      candidate = alignStart(blockedEnd, true);
    }
  }

  return candidate;
}

function getDurationHours(sale: QueueSale) {
  const hours = Number(sale.printTimeHours) || 0;
  if (hours > 0) return hours;
  return parseDurationToHours(sale.designPrintTime || '');
}

function getPaintDurationHours(sale: QueueSale) {
  return Number(sale.paintTimeHours) || 0;
}

function calculateDeliveryDate(completionEnd: Date) {
  const cutoff = new Date(completionEnd);
  cutoff.setHours(DELIVERY_CUTOFF_HOUR, 0, 0, 0);
  const delivery = new Date(completionEnd);
  if (completionEnd > cutoff) {
    delivery.setDate(delivery.getDate() + 1);
  }
  delivery.setHours(0, 0, 0, 0);
  return delivery;
}

function isWithinStartWindow(date: Date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  if (hours < PRINT_START_HOUR) return false;
  if (hours > LAST_START_HOUR) return false;
  return !(hours === LAST_START_HOUR && minutes > 0);
}

function validateSlot(
  start: Date,
  durationHours: number,
  occupied: { start: Date; end: Date; saleId?: string }[],
  options: { enforceFuture?: boolean; ignoreSaleId?: string; minStart?: Date | null } = {}
) {
  if (durationHours <= 0) {
    return { valid: false, message: 'Informe o tempo de impressao para agendar.' };
  }

  if (!isWithinStartWindow(start)) {
    return { valid: false, message: 'Horario deve iniciar entre 08:00 e 23:00.' };
  }

  if (options.enforceFuture) {
    const now = new Date();
    if (start < now) {
      return { valid: false, message: 'Escolha um horario futuro.' };
    }
  }

  if (options.minStart && start < options.minStart) {
    return { valid: false, message: 'Horario deve ser apos o termino do design.' };
  }

  const end = addHours(start, durationHours);
  const gapMs = GAP_MINUTES * 60 * 1000;
  for (const slot of occupied) {
    if (options.ignoreSaleId && slot.saleId === options.ignoreSaleId) {
      continue;
    }
    const slotStart = new Date(slot.start.getTime() - gapMs);
    const slotEnd = new Date(slot.end.getTime() + gapMs);
    if (start < slotEnd && end > slotStart) {
      return { valid: false, message: 'Horario indisponivel para este tempo.' };
    }
  }

  return { valid: true };
}

function validatePaintSlot(
  start: Date,
  durationHours: number,
  options: { enforceFuture?: boolean; minStart?: Date | null } = {}
) {
  if (durationHours <= 0) {
    return { valid: false, message: 'Informe o tempo de pintura para agendar.' };
  }

  if (options.minStart && start < options.minStart) {
    return { valid: false, message: 'A pintura deve iniciar apos o termino da impressao.' };
  }

  if (options.enforceFuture) {
    const now = new Date();
    if (start < now) {
      return { valid: false, message: 'Escolha um horario futuro.' };
    }
  }

  return { valid: true };
}

function validateDesignSlot(
  start: Date,
  durationHours: number,
  options: { enforceFuture?: boolean; maxEnd?: Date | null } = {}
) {
  if (durationHours <= 0) {
    return { valid: false, message: 'Informe o tempo de design para agendar.' };
  }

  if (options.maxEnd) {
    const end = addHours(start, durationHours);
    if (end > options.maxEnd) {
      return { valid: false, message: 'O design deve terminar antes da impressao.' };
    }
  }

  if (options.enforceFuture) {
    const now = new Date();
    if (start < now) {
      return { valid: false, message: 'Escolha um horario futuro.' };
    }
  }

  return { valid: true };
}

export default function PrintScheduleCalendar({
  estimatedHours,
  hasPainting,
  hasCustomArt,
  layout = 'auto',
  designHours,
  designStartValue,
  onDesignChange,
  designResponsible,
  showDesign,
  paintHours,
  paintValue,
  onPaintChange,
  paintResponsible,
  showPainting,
  value,
  onChange,
  readOnly,
  allowDrag = false,
  saleId,
  showSuggestionSummary = true,
  allowImmediateStart = false
}: PrintScheduleCalendarProps) {
  const router = useRouter();
  const { showAlert, showConfirm } = useDialog();
  const [queue, setQueue] = useState<QueueSale[]>([]);
  const [currentPrint, setCurrentPrint] = useState<QueueSale | null>(null);
  const [serviceSales, setServiceSales] = useState<QueueSale[]>([]);
  const [designTasks, setDesignTasks] = useState<DesignTask[]>([]);
  const [paintingTasks, setPaintingTasks] = useState<PaintingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceEndpointAvailable, setServiceEndpointAvailable] = useState(true);
  const [designEndpointAvailable, setDesignEndpointAvailable] = useState(true);
  const [paintingEndpointAvailable, setPaintingEndpointAvailable] = useState(true);
  const [selectionError, setSelectionError] = useState('');
  const [paintSelectionError, setPaintSelectionError] = useState('');
  const [designSelectionError, setDesignSelectionError] = useState('');
  const [saving, setSaving] = useState(false);
  const [startingImmediate, setStartingImmediate] = useState(false);
  const [effectiveHours, setEffectiveHours] = useState<number>(Number(estimatedHours) || 0);
  const [hoverCard, setHoverCard] = useState<HoverCardData | null>(null);
  const hoverCardActiveRef = useRef(false);
  const eventHoverActiveRef = useRef(false);
  const isDraggingRef = useRef(false);
  const hideHoverTimeoutRef = useRef<number | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const canPersist = isValidObjectId(saleId);
  const dragEnabled = !readOnly || allowDrag;
  const shouldShowDesign = Boolean(showDesign ?? hasCustomArt);
  const shouldShowPaint = Boolean(showPainting ?? hasPainting);
  const shouldShowServices = shouldShowDesign || shouldShowPaint;
  const shouldSplit = shouldShowServices && layout !== 'stacked';
  const [serviceMode, setServiceMode] = useState<'design' | 'painting'>(shouldShowDesign ? 'design' : 'painting');
  const effectiveDesignHours = Math.max(0, Number(designHours) || 0);
  const effectivePaintHours = Math.max(0, Number(paintHours) || 0);
  const normalizedDesignStart = typeof designStartValue === 'string' && designStartValue.trim() !== '' ? designStartValue : null;
  const normalizedPaintValue = typeof paintValue === 'string' && paintValue.trim() !== '' ? paintValue : null;
  const paintSale = saleId ? serviceSales.find((sale) => sale.id === saleId) : null;
  const designSale = saleId ? serviceSales.find((sale) => sale.id === saleId) : null;
  const resolvedDesignStart = normalizedDesignStart || designSale?.designStartConfirmedAt || null;
  const resolvedDesignHours = effectiveDesignHours > 0
    ? effectiveDesignHours
    : Math.max(0, Number(designSale?.designTimeHours) || 0);
  const hasResolvedDesignSchedule = Boolean(resolvedDesignStart) && resolvedDesignHours > 0;
  const resolvedPaintValue = normalizedPaintValue || paintSale?.paintStartConfirmedAt || null;
  const resolvedPaintHours = effectivePaintHours > 0
    ? effectivePaintHours
    : Math.max(0, Number(paintSale?.paintTimeHours) || 0);
  const hasResolvedPaintSchedule = Boolean(resolvedPaintValue) && resolvedPaintHours > 0;
  const missingServiceLabel = useMemo(() => {
    const missing: string[] = [];
    if (shouldShowDesign && !hasResolvedDesignSchedule) {
      missing.push('design');
    }
    if (shouldShowPaint && !hasResolvedPaintSchedule) {
      missing.push('pintura');
    }
    if (missing.length === 0) {
      return null;
    }
    return missing.join(' e ');
  }, [shouldShowDesign, shouldShowPaint, hasResolvedDesignSchedule, hasResolvedPaintSchedule]);
  const showModeToggle = shouldShowDesign && shouldShowPaint && !readOnly;
  const showServiceBadge = !readOnly && !showModeToggle;
  const showResponsibleSummary = !readOnly;
  const serviceModeLabel = serviceMode === 'design' ? 'Design' : 'Pintura';
  const serviceBadgeClass = serviceMode === 'design'
    ? 'text-sky-600 bg-sky-50'
    : 'text-indigo-600 bg-indigo-50';
  const serviceDescription = serviceMode === 'design'
    ? 'Agendamento de design. Deve terminar antes da impressao.'
    : 'Agendamento de pintura. Deve iniciar apos o termino da impressao.';
  const serviceInstruction = serviceMode === 'design'
    ? 'Marque a agenda de design clicando no horario desejado.'
    : 'Marque a agenda de pintura clicando no horario desejado.';
  const serviceSelectionError = serviceMode === 'design' ? designSelectionError : paintSelectionError;
  const canSelectService = !readOnly && (
    (serviceMode === 'design' && Boolean(onDesignChange)) ||
    (serviceMode === 'painting' && Boolean(onPaintChange))
  );
  const hoverQueueSale = useMemo(() => {
    if (!hoverCard?.saleId) return null;
    return queue.find((sale) => sale.id === hoverCard.saleId) || null;
  }, [hoverCard?.saleId, queue]);
  const canStartImmediate = allowImmediateStart && hoverCard?.entityType === 'print' && Boolean(hoverQueueSale);

  const fetchServiceFallback = async () => {
    try {
      const salesRes = await axios.get('http://localhost:5000/api/sales');
      const list = (salesRes.data || []).filter((sale: QueueSale) =>
        sale.hasPainting ||
        sale.paintStartConfirmedAt ||
        (Number(sale.paintTimeHours) || 0) > 0 ||
        (sale.paintResponsible && sale.paintResponsible.trim() !== '') ||
        sale.hasCustomArt ||
        sale.designStartConfirmedAt ||
        (Number(sale.designTimeHours) || 0) > 0 ||
        (sale.designResponsible && sale.designResponsible.trim() !== '') ||
        sale.designValue
      );
      setServiceSales(list);
    } catch {
      setServiceSales([]);
    }
  };

  const fetchData = async () => {
    try {
      const [queueRes, currentRes] = await Promise.all([
        axios.get('http://localhost:5000/api/sales/queue'),
        axios.get('http://localhost:5000/api/sales/current')
      ]);
      setQueue(queueRes.data || []);
      setCurrentPrint(currentRes.status === 204 ? null : currentRes.data);
    } catch (error) {
      setQueue([]);
      setCurrentPrint(null);
    }

    if (!shouldShowServices) {
      setServiceSales([]);
      setDesignTasks([]);
      setPaintingTasks([]);
      setLoading(false);
      return;
    }

    if (!serviceEndpointAvailable) {
      await fetchServiceFallback();
    } else {
      try {
        const serviceRes = await axios.get('http://localhost:5000/api/sales/services');
        setServiceSales(serviceRes.data || []);
      } catch (error) {
        const status = (error as any)?.response?.status;
        if (status === 404) {
          setServiceEndpointAvailable(false);
          await fetchServiceFallback();
        } else {
          setServiceSales([]);
        }
      }
    }

    if (!shouldShowDesign) {
      setDesignTasks([]);
    } else if (!designEndpointAvailable) {
      setDesignTasks([]);
    } else {
      try {
        const designRes = await axios.get('http://localhost:5000/api/designs');
        setDesignTasks(designRes.data || []);
      } catch (error) {
        const status = (error as any)?.response?.status;
        if (status === 404) {
          setDesignEndpointAvailable(false);
        }
        setDesignTasks([]);
      }
    }

    if (!shouldShowPaint) {
      setPaintingTasks([]);
    } else if (!paintingEndpointAvailable) {
      setPaintingTasks([]);
    } else {
      try {
        const paintingRes = await axios.get('http://localhost:5000/api/paintings');
        setPaintingTasks(paintingRes.data || []);
      } catch (error) {
        const status = (error as any)?.response?.status;
        if (status === 404) {
          setPaintingEndpointAvailable(false);
        }
        setPaintingTasks([]);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData().catch(() => null);
  }, [
    shouldShowServices,
    serviceEndpointAvailable,
    designEndpointAvailable,
    paintingEndpointAvailable,
    shouldShowDesign,
    shouldShowPaint
  ]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (shouldShowDesign && !shouldShowPaint) {
      setServiceMode('design');
    } else if (!shouldShowDesign && shouldShowPaint) {
      setServiceMode('painting');
    }
  }, [shouldShowDesign, shouldShowPaint]);

  useEffect(() => {
    const nextHours = Number(estimatedHours) || 0;
    const timeoutId = setTimeout(() => {
      setEffectiveHours(nextHours);
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [estimatedHours]);

  const occupied = useMemo(() => {
    const fixedSlots: { start: Date; end: Date; saleId?: string }[] = [];
    const currentPrintStart = currentPrint?.printStartedAt || currentPrint?.printStartConfirmedAt;
    if (currentPrintStart) {
      const duration = Math.max(getDurationHours(currentPrint), 0);
      if (duration > 0) {
        const start = new Date(currentPrintStart);
        fixedSlots.push({ start, end: addHours(start, duration), saleId: currentPrint.id });
      }
    }

    queue.forEach((sale) => {
      if (!sale.printStartConfirmedAt) return;
      const duration = saleId === sale.id && effectiveHours > 0
        ? Math.max(0, effectiveHours)
        : Math.max(getDurationHours(sale), 0);
      if (duration <= 0) return;
      const start = new Date(sale.printStartConfirmedAt);
      fixedSlots.push({ start, end: addHours(start, duration), saleId: sale.id });
    });

    return fixedSlots;
  }, [queue, currentPrint, saleId, effectiveHours]);

  const suggestion = useMemo(() => {
    const duration = Math.max(0, effectiveHours);
    if (duration <= 0) {
      return { start: null, delivery: null, printEnd: null };
    }
    const suggestedSlots = queue
      .filter((sale) => !sale.printStartConfirmedAt && sale.printStartScheduledAt)
      .map((sale) => {
        const hours = Math.max(getDurationHours(sale), 0);
        const start = new Date(sale.printStartScheduledAt as string);
        return { start, end: addHours(start, hours) };
      })
      .filter((slot) => slot.end > slot.start);

    const start = findNextAvailableStart(new Date(), [...occupied, ...suggestedSlots], duration);
    const printEnd = addHours(start, duration);
    return { start, delivery: null, printEnd };
  }, [effectiveHours, occupied, queue]);

  const printEvents = useMemo(() => {
    const list: any[] = [];
    const currentPrintStart = currentPrint?.printStartedAt || currentPrint?.printStartConfirmedAt;
    if (currentPrint && currentPrintStart) {
      const duration = Math.max(getDurationHours(currentPrint), 0);
      if (duration > 0) {
        const start = new Date(currentPrintStart);
        const isInProgress = currentPrint.printStatus === 'InProgress';
        const statusLabel = isInProgress ? 'Em impressao' : 'Aguardando inicio';
        list.push({
          id: `current-${currentPrint.id}`,
          title: currentPrint.description || statusLabel,
          start,
          end: addHours(start, duration),
          color: isInProgress ? '#f97316' : '#f59e0b',
          editable: false,
          extendedProps: {
            entityType: 'print',
            saleId: currentPrint.id,
            status: statusLabel,
            description: currentPrint.description || statusLabel,
            durationHours: duration,
            printStatus: currentPrint.printStatus
          }
        });
      }
    }

    queue.forEach((sale) => {
      if (!sale.printStartConfirmedAt) return;
      const duration = saleId === sale.id && effectiveHours > 0
        ? Math.max(0, effectiveHours)
        : Math.max(getDurationHours(sale), 0);
      if (duration <= 0) return;
      const start = new Date(sale.printStartConfirmedAt);
      list.push({
        id: `scheduled-${sale.id}`,
        title: sale.description || 'Agendado',
        start,
        end: addHours(start, duration),
        color: '#0f766e',
        extendedProps: {
          entityType: 'print',
          saleId: sale.id,
          status: 'Agendado',
          description: sale.description || 'Agendado',
          durationHours: duration,
          printStatus: sale.printStatus
        }
      });
    });

    queue.forEach((sale) => {
      if (sale.printStartConfirmedAt || !sale.printStartScheduledAt) return;
      const duration = Math.max(getDurationHours(sale), 0);
      if (duration <= 0) return;
      const start = new Date(sale.printStartScheduledAt);
      list.push({
        id: `suggested-${sale.id}`,
        title: sale.description || 'Sugestao fila',
        start,
        end: addHours(start, duration),
        display: 'background',
        backgroundColor: '#fde68a',
        editable: false,
        extendedProps: {
          isTransient: true
        }
      });
    });

    const hasSelectedMatch = value
      ? queue.some((sale) => sale.printStartConfirmedAt && new Date(sale.printStartConfirmedAt).getTime() === new Date(value).getTime())
      : false;

    if (value && !hasSelectedMatch) {
      const duration = Math.max(0, effectiveHours);
      if (duration > 0) {
        const start = new Date(value);
        list.push({
          id: 'selected',
          title: 'Horario selecionado',
          start,
          end: addHours(start, duration),
          color: '#22c55e',
          editable: false,
          extendedProps: {
            isTransient: true
          }
        });
      }
    }

    if (suggestion.start && (!value || readOnly)) {
      const duration = Math.max(0, effectiveHours);
      if (duration > 0) {
        list.push({
          id: 'suggested',
          title: 'Sugestao',
          start: suggestion.start,
          end: addHours(suggestion.start, duration),
          display: 'background',
          backgroundColor: '#fde68a',
          editable: false,
          extendedProps: {
            isTransient: true
          }
        });
      }
    }

    return list;
  }, [queue, currentPrint, value, effectiveHours, suggestion.start, readOnly, saleId]);

  const deliveryInfo = useMemo(() => {
    const duration = Math.max(0, effectiveHours);
    const baseStart = value ? new Date(value) : suggestion.start;
    const printEnd = baseStart && duration > 0 ? addHours(baseStart, duration) : null;
    const paintEnd = resolvedPaintValue && resolvedPaintHours > 0
      ? addHours(new Date(resolvedPaintValue), resolvedPaintHours)
      : null;
    const completionEnd = paintEnd && printEnd
      ? (paintEnd > printEnd ? paintEnd : printEnd)
      : paintEnd || printEnd;
    const delivery = completionEnd ? calculateDeliveryDate(completionEnd) : null;
    return { printEnd, paintEnd, delivery };
  }, [effectiveHours, value, suggestion.start, resolvedPaintValue, resolvedPaintHours]);

  const printEndForPainting = useMemo(() => {
    const duration = Math.max(0, effectiveHours);
    if (value && duration > 0) {
      return addHours(new Date(value), duration);
    }

    if (!saleId) {
      return null;
    }

    if (currentPrint?.id === saleId && (currentPrint.printStartedAt || currentPrint.printStartConfirmedAt)) {
      const hours = duration > 0 ? duration : Math.max(getDurationHours(currentPrint), 0);
      if (hours > 0) {
        const start = currentPrint.printStartedAt || currentPrint.printStartConfirmedAt;
        return start ? addHours(new Date(start), hours) : null;
      }
    }

    const queued = queue.find((sale) => sale.id === saleId && sale.printStartConfirmedAt);
    if (queued?.printStartConfirmedAt) {
      const hours = duration > 0 ? duration : Math.max(getDurationHours(queued), 0);
      if (hours > 0) {
        return addHours(new Date(queued.printStartConfirmedAt), hours);
      }
    }

    return null;
  }, [value, effectiveHours, saleId, currentPrint, queue]);

  const printStartForDesign = useMemo(() => {
    if (value) {
      return new Date(value);
    }

    if (!saleId) {
      return null;
    }

    if (currentPrint?.id === saleId && (currentPrint.printStartedAt || currentPrint.printStartConfirmedAt)) {
      const start = currentPrint.printStartedAt || currentPrint.printStartConfirmedAt;
      return start ? new Date(start) : null;
    }

    const queued = queue.find((sale) => sale.id === saleId && sale.printStartConfirmedAt);
    if (queued?.printStartConfirmedAt) {
      return new Date(queued.printStartConfirmedAt);
    }

    return null;
  }, [value, saleId, currentPrint, queue]);

  const designEndForPrint = useMemo(() => {
    if (!resolvedDesignStart) {
      return null;
    }
    const duration = Math.max(0, resolvedDesignHours);
    if (duration <= 0) {
      return null;
    }
    return addHours(new Date(resolvedDesignStart), duration);
  }, [resolvedDesignStart, resolvedDesignHours]);

  const getDesignEndForSale = (targetSaleId?: string) => {
    if (!targetSaleId) return null;
    if (saleId && targetSaleId === saleId && designEndForPrint) {
      return designEndForPrint;
    }
    const sale = serviceSales.find((item) => item.id === targetSaleId);
    if (!sale?.designStartConfirmedAt) return null;
    const duration = Math.max(Number(sale.designTimeHours) || 0, 0);
    if (duration <= 0) return null;
    return addHours(new Date(sale.designStartConfirmedAt), duration);
  };

  const getPrintStartForSale = (targetSaleId?: string) => {
    if (!targetSaleId) return null;
    if (saleId && targetSaleId === saleId && printStartForDesign) {
      return printStartForDesign;
    }
    if (currentPrint?.id === targetSaleId && (currentPrint.printStartedAt || currentPrint.printStartConfirmedAt)) {
      const start = currentPrint.printStartedAt || currentPrint.printStartConfirmedAt;
      return start ? new Date(start) : null;
    }
    const queued = queue.find((sale) => sale.id === targetSaleId && sale.printStartConfirmedAt);
    if (queued?.printStartConfirmedAt) {
      return new Date(queued.printStartConfirmedAt);
    }
    return null;
  };

  const getPrintEndForSale = (targetSaleId?: string) => {
    if (!targetSaleId) return null;
    if (saleId && targetSaleId === saleId && printEndForPainting) {
      return printEndForPainting;
    }
    if (currentPrint?.id === targetSaleId && (currentPrint.printStartedAt || currentPrint.printStartConfirmedAt)) {
      const duration = Math.max(getDurationHours(currentPrint), 0);
      if (duration > 0) {
        const start = currentPrint.printStartedAt || currentPrint.printStartConfirmedAt;
        return start ? addHours(new Date(start), duration) : null;
      }
    }
    const queued = queue.find((sale) => sale.id === targetSaleId && sale.printStartConfirmedAt);
    if (queued?.printStartConfirmedAt) {
      const duration = Math.max(getDurationHours(queued), 0);
      if (duration > 0) {
        return addHours(new Date(queued.printStartConfirmedAt), duration);
      }
    }
    return null;
  };

  const serviceEvents = useMemo(() => {
    const list: any[] = [];

    serviceSales.forEach((sale) => {
      const designStatus = normalizeServiceStatus(sale.designStatus);
      if (sale.designStartConfirmedAt && isServiceActive(designStatus)) {
        const duration = Math.max(Number(sale.designTimeHours) || 0, 0);
        if (duration > 0) {
          const start = new Date(sale.designStartConfirmedAt);
          const responsible = sale.designResponsible ? ` - ${sale.designResponsible}` : '';
          list.push({
            id: `design-${sale.id}`,
            title: `Design - ${sale.description || 'Servico'}${responsible}`,
            start,
            end: addHours(start, duration),
            color: '#0ea5e9',
            extendedProps: {
              entityType: 'design',
              saleId: sale.id,
              status: 'Design',
              description: sale.description || 'Servico',
              responsible: sale.designResponsible || null,
              durationHours: duration,
              value: typeof sale.designValue === 'number' ? sale.designValue : null,
              serviceStatus: designStatus
            }
          });
        }
      }

      const paintStatus = normalizeServiceStatus(sale.paintStatus);
      if (sale.paintStartConfirmedAt && isServiceActive(paintStatus)) {
        const duration = Math.max(getPaintDurationHours(sale), 0);
        if (duration > 0) {
          const start = new Date(sale.paintStartConfirmedAt);
          const responsible = sale.paintResponsible ? ` - ${sale.paintResponsible}` : '';
          list.push({
            id: `paint-${sale.id}`,
            title: `Pintura - ${sale.description || 'Servico'}${responsible}`,
            start,
            end: addHours(start, duration),
            color: '#6366f1',
            extendedProps: {
              entityType: 'painting',
              saleId: sale.id,
              status: 'Pintura',
              description: sale.description || 'Servico',
              responsible: sale.paintResponsible || null,
              durationHours: duration,
              serviceStatus: paintStatus
            }
          });
        }
      }
    });

    designTasks.forEach((task) => {
      if (!task.startAt) return;
      if (!isServiceActive(task.status)) return;
      const duration = Math.max(Number(task.durationHours) || 0, 0);
      if (duration <= 0) return;
      const start = new Date(task.startAt);
      const responsible = task.responsibleName ? ` - ${task.responsibleName}` : '';
      list.push({
        id: `design-task-${task.id}`,
        title: `Design - ${task.title}${responsible}`,
        start,
        end: addHours(start, duration),
        color: '#38bdf8',
        extendedProps: {
          entityType: 'design',
          taskId: task.id,
          status: 'Design',
          description: task.title,
          responsible: task.responsibleName || null,
          durationHours: duration,
          value: typeof task.value === 'number' ? task.value : null,
          serviceStatus: normalizeServiceStatus(task.status)
        }
      });
    });

    paintingTasks.forEach((task) => {
      if (!task.startAt) return;
      if (!isServiceActive(task.status)) return;
      const duration = Math.max(Number(task.durationHours) || 0, 0);
      if (duration <= 0) return;
      const start = new Date(task.startAt);
      const responsible = task.responsibleName ? ` - ${task.responsibleName}` : '';
      list.push({
        id: `painting-task-${task.id}`,
        title: `Pintura - ${task.title}${responsible}`,
        start,
        end: addHours(start, duration),
        color: '#a855f7',
        extendedProps: {
          entityType: 'painting',
          taskId: task.id,
          status: 'Pintura',
          description: task.title,
          responsible: task.responsibleName || null,
          durationHours: duration,
          value: typeof task.value === 'number' ? task.value : null,
          serviceStatus: normalizeServiceStatus(task.status)
        }
      });
    });

    const hasDesignMatch = normalizedDesignStart
      ? serviceSales.some((sale) =>
          isServiceActive(sale.designStatus) &&
          sale.designStartConfirmedAt &&
          new Date(sale.designStartConfirmedAt).getTime() === new Date(normalizedDesignStart).getTime()
        ) ||
        designTasks.some((task) =>
          isServiceActive(task.status) &&
          task.startAt &&
          new Date(task.startAt).getTime() === new Date(normalizedDesignStart).getTime()
        )
      : false;

    if (normalizedDesignStart && !hasDesignMatch) {
      const duration = Math.max(0, resolvedDesignHours);
      if (duration > 0) {
        const start = new Date(normalizedDesignStart);
        const responsible = designResponsible ? ` - ${designResponsible}` : '';
        list.push({
          id: 'design-selected',
          title: `Design${responsible}`,
          start,
          end: addHours(start, duration),
          color: '#0ea5e9',
          editable: false,
          extendedProps: {
            isTransient: true
          }
        });
      }
    }

    const hasPaintMatch = normalizedPaintValue
      ? serviceSales.some((sale) =>
          isServiceActive(sale.paintStatus) &&
          sale.paintStartConfirmedAt &&
          new Date(sale.paintStartConfirmedAt).getTime() === new Date(normalizedPaintValue).getTime()
        ) ||
        paintingTasks.some((task) =>
          isServiceActive(task.status) &&
          task.startAt &&
          new Date(task.startAt).getTime() === new Date(normalizedPaintValue).getTime()
        )
      : false;

    if (normalizedPaintValue && !hasPaintMatch) {
      const duration = Math.max(0, effectivePaintHours);
      if (duration > 0) {
        const start = new Date(normalizedPaintValue);
        const responsible = paintResponsible ? ` - ${paintResponsible}` : '';
        list.push({
          id: 'paint-selected',
          title: `Pintura${responsible}`,
          start,
          end: addHours(start, duration),
          color: '#8b5cf6',
          editable: false,
          extendedProps: {
            isTransient: true
          }
        });
      }
    }

    return list;
  }, [
    serviceSales,
    designTasks,
    paintingTasks,
    normalizedDesignStart,
    normalizedPaintValue,
    resolvedDesignHours,
    effectivePaintHours,
    designResponsible,
    paintResponsible
  ]);

  const updateSaleSchedule = async (targetSaleId: string, nextValue: string | null) => {
    if (!isValidObjectId(targetSaleId)) {
      throw new Error('Invalid sale id');
    }
    try {
      await axios.patch(`http://localhost:5000/api/sales/${targetSaleId}/schedule`, {
        printStartConfirmedAt: nextValue ? nextValue : null
      });
    } catch (error) {
      const status = (error as any)?.response?.status;
      if (status !== 404) {
        throw error;
      }
      const saleRes = await axios.get(`http://localhost:5000/api/sales/${targetSaleId}`);
      const updatedSale = {
        ...saleRes.data,
        printStartConfirmedAt: nextValue ? nextValue : null
      };
      await axios.put(`http://localhost:5000/api/sales/${targetSaleId}`, updatedSale);
    }
  };

  const updateSalePaintSchedule = async (
    targetSaleId: string,
    nextValue: string | null,
    options: { paintTimeHours?: number; paintResponsible?: string | null } = {}
  ) => {
    if (!isValidObjectId(targetSaleId)) {
      throw new Error('Invalid sale id');
    }
    const paintTimeHours = typeof options.paintTimeHours === 'number' && options.paintTimeHours > 0
      ? options.paintTimeHours
      : null;
    const paintResponsible = options.paintResponsible && options.paintResponsible.trim() !== ''
      ? options.paintResponsible.trim()
      : null;
    const payload = {
      paintStartConfirmedAt: nextValue ? nextValue : null,
      paintTimeHours,
      paintResponsible
    };
    try {
      await axios.patch(`http://localhost:5000/api/sales/${targetSaleId}/paint-schedule`, payload);
    } catch (error) {
      const status = (error as any)?.response?.status;
      if (status !== 404) {
        throw error;
      }
      const saleRes = await axios.get(`http://localhost:5000/api/sales/${targetSaleId}`);
      const updatedSale = {
        ...saleRes.data,
        paintStartConfirmedAt: nextValue ? nextValue : null
      };
      if (paintTimeHours !== null) {
        updatedSale.paintTimeHours = paintTimeHours;
      }
      if (paintResponsible !== null) {
        updatedSale.paintResponsible = paintResponsible;
      }
      await axios.put(`http://localhost:5000/api/sales/${targetSaleId}`, updatedSale);
    }
  };

  const updateSaleDesignSchedule = async (
    targetSaleId: string,
    nextValue: string | null,
    options: { designTimeHours?: number; designResponsible?: string | null; designValue?: number | null } = {}
  ) => {
    if (!isValidObjectId(targetSaleId)) {
      throw new Error('Invalid sale id');
    }
    const designTimeHours = typeof options.designTimeHours === 'number' && options.designTimeHours > 0
      ? options.designTimeHours
      : null;
    const designResponsible = options.designResponsible && options.designResponsible.trim() !== ''
      ? options.designResponsible.trim()
      : null;
    const designValue = typeof options.designValue === 'number' ? options.designValue : null;
    const payload = {
      designStartConfirmedAt: nextValue ? nextValue : null,
      designTimeHours,
      designResponsible,
      designValue
    };
    try {
      await axios.patch(`http://localhost:5000/api/sales/${targetSaleId}/design-schedule`, payload);
    } catch (error) {
      const status = (error as any)?.response?.status;
      if (status !== 404) {
        throw error;
      }
      const saleRes = await axios.get(`http://localhost:5000/api/sales/${targetSaleId}`);
      const updatedSale = {
        ...saleRes.data,
        designStartConfirmedAt: nextValue ? nextValue : null
      };
      if (designTimeHours !== null) {
        updatedSale.designTimeHours = designTimeHours;
      }
      if (designResponsible !== null) {
        updatedSale.designResponsible = designResponsible;
      }
      if (designValue !== null) {
        updatedSale.designValue = designValue;
      }
      await axios.put(`http://localhost:5000/api/sales/${targetSaleId}`, updatedSale);
    }
  };

  const updateSaleDesignStatus = async (targetSaleId: string, nextStatus: 'Active' | 'Concluded') => {
    if (!isValidObjectId(targetSaleId)) {
      throw new Error('Invalid sale id');
    }
    const ensurePersisted = async () => {
      const saleRes = await axios.get(`http://localhost:5000/api/sales/${targetSaleId}`);
      const currentStatus = normalizeServiceStatus(saleRes.data?.designStatus);
      if (currentStatus === nextStatus) {
        return saleRes.data;
      }
      const updatedSale = {
        ...saleRes.data,
        designStatus: nextStatus
      };
      await axios.put(`http://localhost:5000/api/sales/${targetSaleId}`, updatedSale);
      const verifyRes = await axios.get(`http://localhost:5000/api/sales/${targetSaleId}`);
      const verifiedStatus = normalizeServiceStatus(verifyRes.data?.designStatus);
      if (verifiedStatus !== nextStatus) {
        throw new Error('Sale design status not persisted');
      }
      return verifyRes.data;
    };

    try {
      await axios.patch(`http://localhost:5000/api/sales/${targetSaleId}/design-status`, {
        designStatus: nextStatus
      });
    } catch (error) {
      const status = (error as any)?.response?.status;
      if (status !== 404) {
        throw error;
      }
    }

    const persistedSale = await ensurePersisted();
    setServiceSales((prev) =>
      prev.map((sale) =>
        sale.id === targetSaleId
          ? { ...sale, designStatus: normalizeServiceStatus(persistedSale?.designStatus) }
          : sale
      )
    );
  };

  const updateSalePaintStatus = async (targetSaleId: string, nextStatus: 'Active' | 'Concluded') => {
    if (!isValidObjectId(targetSaleId)) {
      throw new Error('Invalid sale id');
    }
    const ensurePersisted = async () => {
      const saleRes = await axios.get(`http://localhost:5000/api/sales/${targetSaleId}`);
      const currentStatus = normalizeServiceStatus(saleRes.data?.paintStatus);
      if (currentStatus === nextStatus) {
        return saleRes.data;
      }
      const updatedSale = {
        ...saleRes.data,
        paintStatus: nextStatus
      };
      await axios.put(`http://localhost:5000/api/sales/${targetSaleId}`, updatedSale);
      const verifyRes = await axios.get(`http://localhost:5000/api/sales/${targetSaleId}`);
      const verifiedStatus = normalizeServiceStatus(verifyRes.data?.paintStatus);
      if (verifiedStatus !== nextStatus) {
        throw new Error('Sale paint status not persisted');
      }
      return verifyRes.data;
    };

    try {
      await axios.patch(`http://localhost:5000/api/sales/${targetSaleId}/paint-status`, {
        paintStatus: nextStatus
      });
    } catch (error) {
      const status = (error as any)?.response?.status;
      if (status !== 404) {
        throw error;
      }
    }

    const persistedSale = await ensurePersisted();
    setServiceSales((prev) =>
      prev.map((sale) =>
        sale.id === targetSaleId
          ? { ...sale, paintStatus: normalizeServiceStatus(persistedSale?.paintStatus) }
          : sale
      )
    );
  };

  const updateDesignTaskSchedule = async (taskId: string, nextValue: string) => {
    const task = designTasks.find((item) => item.id === taskId);
    if (!task) {
      throw new Error('Design task not found');
    }
    const payload = {
      ...task,
      startAt: nextValue
    };
    await axios.put(`http://localhost:5000/api/designs/${taskId}`, payload);
    setDesignTasks((prev) =>
      prev.map((item) => (item.id === taskId ? { ...item, startAt: nextValue } : item))
    );
  };

  const updatePaintingTaskSchedule = async (taskId: string, nextValue: string) => {
    const task = paintingTasks.find((item) => item.id === taskId);
    if (!task) {
      throw new Error('Painting task not found');
    }
    const payload = {
      ...task,
      startAt: nextValue
    };
    await axios.put(`http://localhost:5000/api/paintings/${taskId}`, payload);
    setPaintingTasks((prev) =>
      prev.map((item) => (item.id === taskId ? { ...item, startAt: nextValue } : item))
    );
  };

  const updateDesignTaskStatus = async (taskId: string, nextStatus: 'Active' | 'Concluded') => {
    const task = designTasks.find((item) => item.id === taskId);
    if (!task) {
      throw new Error('Design task not found');
    }
    const payload = {
      ...task,
      status: nextStatus
    };
    await axios.put(`http://localhost:5000/api/designs/${taskId}`, payload);
    setDesignTasks((prev) =>
      prev.map((item) => (item.id === taskId ? { ...item, status: nextStatus } : item))
    );
  };

  const updatePaintingTaskStatus = async (taskId: string, nextStatus: 'Active' | 'Concluded') => {
    const task = paintingTasks.find((item) => item.id === taskId);
    if (!task) {
      throw new Error('Painting task not found');
    }
    const payload = {
      ...task,
      status: nextStatus
    };
    await axios.put(`http://localhost:5000/api/paintings/${taskId}`, payload);
    setPaintingTasks((prev) =>
      prev.map((item) => (item.id === taskId ? { ...item, status: nextStatus } : item))
    );
  };

  const persistSchedule = async (nextValue: string | null) => {
    if (!canPersist) return;
    setSaving(true);
    try {
      await updateSaleSchedule(saleId as string, nextValue);
      await fetchData();
      setSelectionError('');
    } catch (error) {
      console.error('Error saving schedule', error);
      setSelectionError('Erro ao salvar o horario. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const persistPaintSchedule = async (nextValue: string | null) => {
    if (!canPersist) return;
    setSaving(true);
    try {
      await updateSalePaintSchedule(saleId as string, nextValue, {
        paintTimeHours: effectivePaintHours,
        paintResponsible
      });
      await fetchData();
      setPaintSelectionError('');
    } catch (error) {
      console.error('Error saving paint schedule', error);
      setPaintSelectionError('Erro ao salvar o horario de pintura. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const persistDesignSchedule = async (nextValue: string | null) => {
    if (!canPersist) return;
    setSaving(true);
    try {
      await updateSaleDesignSchedule(saleId as string, nextValue, {
        designTimeHours: resolvedDesignHours,
        designResponsible
      });
      await fetchData();
      setDesignSelectionError('');
    } catch (error) {
      console.error('Error saving design schedule', error);
      setDesignSelectionError('Erro ao salvar o horario de design. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!value || !onChange || readOnly) return;
    const duration = Math.max(0, effectiveHours);
    const start = new Date(value);
    const validation = validateSlot(start, duration, occupied, {
      ignoreSaleId: saleId,
      minStart: designEndForPrint
    });
    if (!validation.valid) {
      onChange(null);
      setSelectionError(validation.message || 'Horario invalido para este tempo.');
      return;
    }
    setSelectionError('');
  }, [estimatedHours, value, occupied, onChange, readOnly, saleId, effectiveHours, designEndForPrint]);

  useEffect(() => {
    if (!paintValue || !onPaintChange || readOnly) return;
    const duration = Math.max(0, effectivePaintHours);
    const start = new Date(paintValue);
    const validation = validatePaintSlot(start, duration, {
      minStart: printEndForPainting
    });
    if (!validation.valid) {
      onPaintChange(null);
      setPaintSelectionError(validation.message || 'Horario invalido para pintura.');
      return;
    }
    setPaintSelectionError('');
  }, [paintValue, onPaintChange, readOnly, effectivePaintHours, printEndForPainting]);

  useEffect(() => {
    if (!normalizedDesignStart || !onDesignChange || readOnly) return;
    const duration = Math.max(0, resolvedDesignHours);
    const start = new Date(normalizedDesignStart);
    const validation = validateDesignSlot(start, duration, {
      maxEnd: printStartForDesign
    });
    if (!validation.valid) {
      onDesignChange(null);
      setDesignSelectionError(validation.message || 'Horario invalido para design.');
      return;
    }
    setDesignSelectionError('');
  }, [normalizedDesignStart, onDesignChange, readOnly, resolvedDesignHours, printStartForDesign]);

  const handleDateClick = (info: { date: Date }) => {
    if (!onChange || readOnly) return;
    const duration = Math.max(0, effectiveHours);
    const validation = validateSlot(info.date, duration, occupied, {
      enforceFuture: true,
      ignoreSaleId: saleId,
      minStart: designEndForPrint
    });
    if (!validation.valid) {
      setSelectionError(validation.message || 'Horario invalido para este tempo.');
      return;
    }

    setSelectionError('');
    const nextValue = info.date.toISOString();
    onChange(nextValue);
    persistSchedule(nextValue).catch(() => null);
  };

  const handleServiceDateClick = (info: { date: Date }) => {
    if (readOnly) return;

    if (serviceMode === 'design') {
      if (!onDesignChange) return;
      const duration = Math.max(0, resolvedDesignHours);
      const validation = validateDesignSlot(info.date, duration, {
        enforceFuture: true,
        maxEnd: printStartForDesign
      });
      if (!validation.valid) {
        setDesignSelectionError(validation.message || 'Horario invalido para design.');
        return;
      }

      setDesignSelectionError('');
      const nextValue = info.date.toISOString();
      onDesignChange(nextValue);
      persistDesignSchedule(nextValue).catch(() => null);
      return;
    }

    if (!onPaintChange) return;
    const duration = Math.max(0, effectivePaintHours);
    const validation = validatePaintSlot(info.date, duration, {
      enforceFuture: true,
      minStart: printEndForPainting
    });
    if (!validation.valid) {
      setPaintSelectionError(validation.message || 'Horario invalido para pintura.');
      return;
    }

    setPaintSelectionError('');
    const nextValue = info.date.toISOString();
    onPaintChange(nextValue);
    persistPaintSchedule(nextValue).catch(() => null);
  };

  const clearHoverHideTimeout = () => {
    if (hideHoverTimeoutRef.current) {
      window.clearTimeout(hideHoverTimeoutRef.current);
      hideHoverTimeoutRef.current = null;
    }
  };

  const scheduleHoverHide = () => {
    if (typeof window === 'undefined') {
      setHoverCard(null);
      return;
    }
    clearHoverHideTimeout();
    hideHoverTimeoutRef.current = window.setTimeout(() => {
      if (!hoverCardActiveRef.current && !eventHoverActiveRef.current) {
        setHoverCard(null);
      }
    }, 240);
  };

  const handleEventMouseEnter = (info: any) => {
    if (isDraggingRef.current) return;
    clearHoverHideTimeout();
    eventHoverActiveRef.current = true;
    hoverCardActiveRef.current = false;
    const event = info.event;
    if (!event || event.display === 'background') return;
    const extended = event.extendedProps || {};
    if (extended.isTransient) return;

    const entityType = extended.entityType as string | undefined;
    const typeLabel = entityType === 'print'
      ? 'Impressao'
      : entityType === 'design'
      ? 'Design'
      : entityType === 'painting'
      ? 'Pintura'
      : 'Servico';
    const taskId = typeof extended.taskId === 'string' ? extended.taskId : undefined;
    const taskType = entityType === 'design' || entityType === 'painting'
      ? (entityType as 'design' | 'painting')
      : undefined;
    const serviceStatus = extended.serviceStatus ? normalizeServiceStatus(extended.serviceStatus) : undefined;
    const saleId = typeof extended.saleId === 'string' ? extended.saleId : undefined;
    const description = extended.description || event.title || 'Servico';
    const start = event.start ? new Date(event.start) : new Date();
    const duration = Number(extended.durationHours) || 0;
    const end = event.end ? new Date(event.end) : duration > 0 ? addHours(start, duration) : start;
    const editPath = saleId
      ? `/sales/${saleId}`
      : extended.taskId
      ? `/services?editType=${entityType}&editId=${extended.taskId}`
      : undefined;
    const position = getHoverPosition(info.jsEvent as MouseEvent, {
      anchorRect: info.el?.getBoundingClientRect()
    });

    setHoverCard({
      x: position.x,
      y: position.y,
      title: description,
      typeLabel,
      start,
      end,
      durationHours: duration > 0 ? duration : undefined,
      status: extended.status,
      responsible: extended.responsible,
      value: typeof extended.value === 'number' ? extended.value : undefined,
      taskId,
      taskType,
      serviceStatus,
      saleId,
      editPath,
      entityType
    });
  };

  const handleConcludeHoverTask = () => {
    if (!hoverCard || !hoverCard.taskType) return;
    const taskId = hoverCard.taskId;
    const saleId = hoverCard.saleId;
    const taskType = hoverCard.taskType;
    if (!taskId && !saleId) return;
    const description = taskType === 'design' ? 'design' : 'pintura';
    showConfirm(
      'Concluir servico',
      `Ao concluir este ${description}, ele sera removido da agenda e ficara apenas na lista de finalizados.`,
      async () => {
        try {
          if (taskId) {
            if (taskType === 'design') {
              await updateDesignTaskStatus(taskId, 'Concluded');
            } else {
              await updatePaintingTaskStatus(taskId, 'Concluded');
            }
          } else if (saleId) {
            if (taskType === 'design') {
              await updateSaleDesignStatus(saleId, 'Concluded');
            } else {
              await updateSalePaintStatus(saleId, 'Concluded');
            }
          }
          setHoverCard(null);
        } catch (error) {
          console.error('Error concluding service task', error);
          await showAlert('Erro', 'Nao foi possivel concluir o servico.', 'error');
        }
      }
    );
  };

  const handleStartPrintImmediate = async () => {
    if (!hoverCard?.saleId) return;
    if (!hoverQueueSale) {
      await showAlert('Aviso', 'Este item nao esta mais na fila.', 'warning');
      return;
    }
    const targetSaleId = hoverCard.saleId;
    if (currentPrint?.id === targetSaleId && currentPrint.printStatus === 'Staged') {
      await showAlert('Aviso', 'Este item ja esta preparado para iniciar.', 'info');
      return;
    }
    if (currentPrint?.id !== targetSaleId && currentPrint?.printStatus === 'InProgress') {
      await showAlert('Erro', 'Ja existe uma impressao em andamento.', 'error');
      return;
    }

    const designEnd = getDesignEndForSale(targetSaleId);
    const now = new Date();
    if (designEnd && designEnd > now) {
      await showAlert('Erro', 'O design ainda nao terminou para iniciar a impressao agora.', 'error');
      return;
    }

    const runStage = async () => {
      setStartingImmediate(true);
      try {
        if (currentPrint && currentPrint.printStatus === 'Staged' && currentPrint.id !== targetSaleId) {
          await axios.put(`http://localhost:5000/api/sales/${currentPrint.id}`, {
            ...currentPrint,
            printStatus: 'InQueue',
            printStartConfirmedAt: null
          });
        }
        const startNow = new Date().toISOString();
        await axios.put(`http://localhost:5000/api/sales/${targetSaleId}`, {
          ...hoverQueueSale,
          printStatus: 'Staged',
          printStartConfirmedAt: startNow
        });
        await fetchData();
        setHoverCard(null);
      } catch (error) {
        console.error('Error starting print immediately', error);
        await showAlert('Erro', 'Nao foi possivel iniciar a impressao agora.', 'error');
      } finally {
        setStartingImmediate(false);
      }
    };

    if (currentPrint && currentPrint.printStatus === 'Staged' && currentPrint.id !== targetSaleId) {
      showConfirm(
        'Substituir item preparado',
        'Ja existe um item preparado. Deseja devolve-lo para a fila e preparar este agora?',
        runStage
      );
      return;
    }

    runStage();
  };

  const handleEventMouseLeave = () => {
    eventHoverActiveRef.current = false;
    scheduleHoverHide();
  };

  const handleEventDragStart = () => {
    isDraggingRef.current = true;
    hoverCardActiveRef.current = false;
    eventHoverActiveRef.current = false;
    clearHoverHideTimeout();
    setHoverCard(null);
  };

  const handleEventDragStop = () => {
    isDraggingRef.current = false;
  };

  const handleEventDrop = async (info: any) => {
    const event = info.event;
    if (!event || !dragEnabled) {
      info.revert();
      return;
    }
    if (event.display === 'background') {
      info.revert();
      return;
    }
    const extended = event.extendedProps || {};
    if (extended.isTransient) {
      info.revert();
      return;
    }
    const start = event.start ? new Date(event.start) : null;
    if (!start) {
      info.revert();
      return;
    }
    let duration = Number(extended.durationHours) || 0;
    if (duration <= 0 && event.end) {
      duration = (event.end.getTime() - start.getTime()) / (60 * 60 * 1000);
    }
    if (duration <= 0) {
      info.revert();
      return;
    }

    const nextValue = event.startStr || start.toISOString();
    let entityType = extended.entityType as string | undefined;
    let targetSaleId = extended.saleId as string | undefined;
    let targetTaskId = extended.taskId as string | undefined;
    const eventId = typeof event.id === 'string' ? event.id : '';
    if (!entityType && eventId) {
      if (eventId.startsWith('design-task-')) {
        entityType = 'design';
        targetTaskId = eventId.replace('design-task-', '');
      } else if (eventId.startsWith('painting-task-')) {
        entityType = 'painting';
        targetTaskId = eventId.replace('painting-task-', '');
      } else if (eventId.startsWith('design-')) {
        entityType = 'design';
        targetSaleId = eventId.replace('design-', '');
      } else if (eventId.startsWith('paint-')) {
        entityType = 'painting';
        targetSaleId = eventId.replace('paint-', '');
      } else if (eventId.startsWith('scheduled-')) {
        entityType = 'print';
        targetSaleId = eventId.replace('scheduled-', '');
      } else if (eventId.startsWith('current-')) {
        entityType = 'print';
        targetSaleId = eventId.replace('current-', '');
      }
    } else {
      if (!targetSaleId && eventId) {
        if (eventId.startsWith('design-')) {
          targetSaleId = eventId.replace('design-', '');
        } else if (eventId.startsWith('paint-')) {
          targetSaleId = eventId.replace('paint-', '');
        } else if (eventId.startsWith('scheduled-')) {
          targetSaleId = eventId.replace('scheduled-', '');
        } else if (eventId.startsWith('current-')) {
          targetSaleId = eventId.replace('current-', '');
        }
      }
      if (!targetTaskId && eventId) {
        if (eventId.startsWith('design-task-')) {
          targetTaskId = eventId.replace('design-task-', '');
        } else if (eventId.startsWith('painting-task-')) {
          targetTaskId = eventId.replace('painting-task-', '');
        }
      }
    }

    try {
      if (entityType === 'print') {
        if (!targetSaleId || !isValidObjectId(targetSaleId)) {
          info.revert();
          return;
        }
        const validation = validateSlot(start, duration, occupied, {
          enforceFuture: true,
          ignoreSaleId: targetSaleId,
          minStart: getDesignEndForSale(targetSaleId)
        });
        if (!validation.valid) {
          setSelectionError(validation.message || 'Horario invalido para este tempo.');
          info.revert();
          return;
        }
        if (targetSaleId === saleId && onChange) {
          onChange(nextValue);
        }
        if (targetSaleId === saleId && canPersist) {
          await persistSchedule(nextValue);
        } else {
          await updateSaleSchedule(targetSaleId, nextValue);
          await fetchData();
          setSelectionError('');
        }
        return;
      }

      if (entityType === 'design') {
        if (targetSaleId && isValidObjectId(targetSaleId)) {
          const validation = validateDesignSlot(start, duration, {
            enforceFuture: true,
            maxEnd: getPrintStartForSale(targetSaleId)
          });
          if (!validation.valid) {
            setDesignSelectionError(validation.message || 'Horario invalido para design.');
            info.revert();
            return;
          }
          if (targetSaleId === saleId && onDesignChange) {
            onDesignChange(nextValue);
          }
          if (targetSaleId === saleId && canPersist) {
            await persistDesignSchedule(nextValue);
          } else {
            await updateSaleDesignSchedule(targetSaleId, nextValue);
            setServiceSales((prev) =>
              prev.map((sale) =>
                sale.id === targetSaleId ? { ...sale, designStartConfirmedAt: nextValue } : sale
              )
            );
            await fetchData();
            setDesignSelectionError('');
          }
          return;
        }
        if (targetTaskId) {
          await updateDesignTaskSchedule(targetTaskId, nextValue);
          await fetchData();
          setDesignSelectionError('');
          return;
        }
      }

      if (entityType === 'painting') {
        if (targetSaleId && isValidObjectId(targetSaleId)) {
          const validation = validatePaintSlot(start, duration, {
            enforceFuture: true,
            minStart: getPrintEndForSale(targetSaleId)
          });
          if (!validation.valid) {
            setPaintSelectionError(validation.message || 'Horario invalido para pintura.');
            info.revert();
            return;
          }
          if (targetSaleId === saleId && onPaintChange) {
            onPaintChange(nextValue);
          }
          if (targetSaleId === saleId && canPersist) {
            await persistPaintSchedule(nextValue);
          } else {
            await updateSalePaintSchedule(targetSaleId, nextValue);
            setServiceSales((prev) =>
              prev.map((sale) =>
                sale.id === targetSaleId ? { ...sale, paintStartConfirmedAt: nextValue } : sale
              )
            );
            await fetchData();
            setPaintSelectionError('');
          }
          return;
        }
        if (targetTaskId) {
          await updatePaintingTaskSchedule(targetTaskId, nextValue);
          await fetchData();
          setPaintSelectionError('');
          return;
        }
      }
    } catch (error) {
      console.error('Error moving schedule item', error);
      info.revert();
      if (entityType === 'painting') {
        setPaintSelectionError('Erro ao salvar o horario de pintura. Tente novamente.');
        return;
      }
      if (entityType === 'design') {
        setDesignSelectionError('Erro ao salvar o horario de design. Tente novamente.');
        return;
      }
      setSelectionError('Erro ao salvar o horario. Tente novamente.');
      return;
    }

    info.revert();
  };

  const suggestedStartLabel = suggestion.start
    ? suggestion.start.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : '--';
  const suggestedDeliveryLabel = deliveryInfo.delivery
    ? deliveryInfo.delivery.toLocaleDateString('pt-BR')
    : '--';

  return (
    <div className={`grid grid-cols-1 ${shouldSplit ? 'xl:grid-cols-2' : ''} gap-6`}>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Agenda de impressao</h3>
            <p className="text-sm text-gray-500">Sugestao baseada na fila e no horario de trabalho.</p>
          </div>
          <span className="text-xs font-semibold uppercase tracking-wide text-teal-600 bg-teal-50 px-2 py-1 rounded-full">Impressao</span>
        </div>

        {showSuggestionSummary && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Inicio sugerido</p>
              <p className="text-2xl font-bold text-gray-900">{suggestedStartLabel}</p>
            </div>
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Entrega sugerida</p>
              <p className="text-2xl font-bold text-gray-900">{suggestedDeliveryLabel}</p>
            </div>
          </div>
        )}

        {showSuggestionSummary && onChange && suggestion.start && !readOnly && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => {
                const nextValue = suggestion.start ? suggestion.start.toISOString() : null;
                onChange(nextValue);
                persistSchedule(nextValue).catch(() => null);
              }}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-semibold"
            >
              {saving ? 'Salvando...' : 'Aplicar sugestao'}
            </button>
          </div>
        )}

        {showSuggestionSummary && missingServiceLabel && (
          <div className="mt-3 text-xs text-amber-600 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
            Defina a agenda de {missingServiceLabel} para completar a sugestao de entrega.
          </div>
        )}

        {!readOnly && onChange && (
          <div className="mt-3 text-xs text-amber-600 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
            Marque a agenda de impressao clicando no horario desejado.
          </div>
        )}

        {selectionError && (
          <div className="mt-3 text-xs text-red-600">{selectionError}</div>
        )}

        <div className="mt-4">
          <FullCalendar
            plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'timeGridWeek,timeGridDay'
            }}
            height="auto"
            allDaySlot={false}
            selectable={!readOnly && Boolean(onChange)}
            selectMirror
            dayMaxEvents
            editable={dragEnabled}
            eventDurationEditable={false}
            slotMinTime="08:00:00"
            slotMaxTime="23:00:00"
            businessHours={{
              daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
              startTime: '08:00',
              endTime: '23:00'
            }}
            events={printEvents}
            dateClick={handleDateClick}
            eventDragStart={handleEventDragStart}
            eventDragStop={handleEventDragStop}
            eventDrop={handleEventDrop}
            eventMouseEnter={handleEventMouseEnter}
            eventMouseLeave={handleEventMouseLeave}
          />
        </div>

        <div className="mt-4 text-xs text-gray-500">
          {loading
            ? 'Carregando agenda...'
            : 'Regras: inicio entre 08:00-23:00, intervalo de 20 min, entrega ate 18:00.'}
        </div>
      </div>

      {shouldShowServices && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Agenda de servicos</h3>
              <p className="text-sm text-gray-500">{serviceDescription}</p>
              {showResponsibleSummary && (
                <div className="text-xs text-gray-500 mt-1 space-y-1">
                  {shouldShowDesign && (
                    <p>Design: {designResponsible ? designResponsible : 'Nao informado'}</p>
                  )}
                  {shouldShowPaint && (
                    <p>Pintura: {paintResponsible ? paintResponsible : 'Nao informado'}</p>
                  )}
                </div>
              )}
            </div>
            {showModeToggle ? (
              <div className="flex items-center rounded-full border border-gray-200 bg-gray-50 p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setServiceMode('design')}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    serviceMode === 'design'
                      ? 'bg-white text-sky-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Design
                </button>
                <button
                  type="button"
                  onClick={() => setServiceMode('painting')}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    serviceMode === 'painting'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Pintura
                </button>
              </div>
            ) : showServiceBadge ? (
              <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded-full ${serviceBadgeClass}`}>
                {serviceModeLabel}
              </span>
            ) : null}
          </div>

          {canSelectService && (
            <div className="mt-2 text-xs text-amber-600 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
              {serviceInstruction}
            </div>
          )}

          {serviceSelectionError && (
            <div className="mt-3 text-xs text-red-600">{serviceSelectionError}</div>
          )}

          <div className="mt-4">
            <FullCalendar
              plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'timeGridWeek,timeGridDay'
              }}
              height="auto"
              allDaySlot={false}
              selectable={canSelectService}
              selectMirror
              dayMaxEvents
              editable={dragEnabled}
              eventDurationEditable={false}
              slotMinTime="00:00:00"
              slotMaxTime="24:00:00"
              events={serviceEvents}
              dateClick={handleServiceDateClick}
              eventDragStart={handleEventDragStart}
              eventDragStop={handleEventDragStop}
              eventDrop={handleEventDrop}
              eventMouseEnter={handleEventMouseEnter}
              eventMouseLeave={handleEventMouseLeave}
            />
          </div>

          <div className="mt-4 text-xs text-gray-500">
            {loading ? 'Carregando agenda...' : serviceDescription}
          </div>
        </div>
      )}
      {hoverCard && portalRoot
        ? createPortal(
            <div className="fixed z-[9999]" style={{ left: hoverCard.x, top: hoverCard.y }}>
              <div
                className="w-72 rounded-xl border border-gray-200 bg-white/95 shadow-lg p-4 backdrop-blur-sm"
                onMouseEnter={() => {
                  hoverCardActiveRef.current = true;
                  clearHoverHideTimeout();
                }}
                onMouseLeave={() => {
                  hoverCardActiveRef.current = false;
                  scheduleHoverHide();
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      {hoverCard.typeLabel}
                    </p>
                    <p className="text-sm font-semibold text-gray-900">{hoverCard.title}</p>
                  </div>
                  {hoverCard.status && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {hoverCard.status}
                    </span>
                  )}
                </div>
                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  <div>Inicio: {formatDateTime(hoverCard.start)}</div>
                  <div>Fim: {formatDateTime(hoverCard.end)}</div>
                  {hoverCard.durationHours && (
                    <div>Duracao: {hoverCard.durationHours.toFixed(2)}h</div>
                  )}
                  {hoverCard.responsible && (
                    <div>Responsavel: {hoverCard.responsible}</div>
                  )}
                  {typeof hoverCard.value === 'number' && (
                    <div>Valor: {formatCurrency(hoverCard.value)}</div>
                  )}
                </div>
                {hoverCard.serviceStatus && isServiceActive(hoverCard.serviceStatus) && (hoverCard.taskId || hoverCard.saleId) && (
                  <button
                    type="button"
                    onClick={handleConcludeHoverTask}
                    className="mt-3 w-full rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs font-semibold py-2 hover:bg-amber-100 transition-colors flex items-center justify-between px-3"
                  >
                    <span>Concluir servico</span>
                    <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-amber-200">
                      <span className="inline-block h-4 w-4 translate-x-1 rounded-full bg-white shadow"></span>
                    </span>
                  </button>
                )}
                {canStartImmediate && (
                  <button
                    type="button"
                    onClick={handleStartPrintImmediate}
                    disabled={startingImmediate}
                    className="mt-3 w-full rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold py-2 hover:bg-emerald-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {startingImmediate ? 'Iniciando...' : 'Iniciar impressao agora'}
                  </button>
                )}
                {hoverCard.editPath && (
                  <button
                    type="button"
                    onClick={() => router.push(hoverCard.editPath as string)}
                    className="mt-3 w-full rounded-lg bg-brand-purple text-white text-xs font-semibold py-2 hover:bg-purple-800 transition-colors"
                  >
                    Editar item
                  </button>
                )}
              </div>
            </div>,
            portalRoot
          )
        : null}
    </div>
  );
}
