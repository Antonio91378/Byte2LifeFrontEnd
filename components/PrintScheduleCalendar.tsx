"use client";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { parseDurationToHours } from '@/utils/time';

interface PrintScheduleCalendarProps {
  estimatedHours?: number;
  hasPainting?: boolean;
  layout?: 'auto' | 'stacked';
  paintHours?: number;
  paintValue?: string | null;
  onPaintChange?: (value: string | null) => void;
  paintResponsible?: string;
  showPainting?: boolean;
  value?: string | null;
  onChange?: (value: string | null) => void;
  readOnly?: boolean;
  saleId?: string;
  showSuggestionSummary?: boolean;
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
  paintStartConfirmedAt?: string;
  paintTimeHours?: number;
  paintResponsible?: string;
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
  options: { enforceFuture?: boolean; ignoreSaleId?: string } = {}
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
    return { valid: false, message: 'A pintura deve iniciar após o término da impressão.' };
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
  layout = 'auto',
  paintHours,
  paintValue,
  onPaintChange,
  paintResponsible,
  showPainting,
  value,
  onChange,
  readOnly,
  saleId,
  showSuggestionSummary = true
}: PrintScheduleCalendarProps) {
  const [queue, setQueue] = useState<QueueSale[]>([]);
  const [currentPrint, setCurrentPrint] = useState<QueueSale | null>(null);
  const [paintingSales, setPaintingSales] = useState<QueueSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [paintEndpointAvailable, setPaintEndpointAvailable] = useState(true);
  const [selectionError, setSelectionError] = useState('');
  const [paintSelectionError, setPaintSelectionError] = useState('');
  const [saving, setSaving] = useState(false);
  const [effectiveHours, setEffectiveHours] = useState<number>(Number(estimatedHours) || 0);
  const canPersist = isValidObjectId(saleId);
  const shouldShowPainting = Boolean(showPainting ?? hasPainting);
  const shouldSplit = shouldShowPainting && layout !== 'stacked';
  const effectivePaintHours = Math.max(0, Number(paintHours) || 0);
  const normalizedPaintValue = typeof paintValue === 'string' && paintValue.trim() !== '' ? paintValue : null;
  const paintSale = saleId ? paintingSales.find((sale) => sale.id === saleId) : null;
  const resolvedPaintValue = normalizedPaintValue || paintSale?.paintStartConfirmedAt || null;
  const resolvedPaintHours = effectivePaintHours > 0
    ? effectivePaintHours
    : Math.max(0, Number(paintSale?.paintTimeHours) || 0);
  const hasResolvedPaintSchedule = Boolean(resolvedPaintValue) && resolvedPaintHours > 0;

  const fetchPaintingFallback = async () => {
    try {
      const salesRes = await axios.get('http://localhost:5000/api/sales');
      const list = (salesRes.data || []).filter((sale: QueueSale) =>
        sale.hasPainting ||
        sale.paintStartConfirmedAt ||
        (Number(sale.paintTimeHours) || 0) > 0 ||
        (sale.paintResponsible && sale.paintResponsible.trim() !== '')
      );
      setPaintingSales(list);
    } catch {
      setPaintingSales([]);
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

    if (!shouldShowPainting) {
      setPaintingSales([]);
      setLoading(false);
      return;
    }

    if (!paintEndpointAvailable) {
      await fetchPaintingFallback();
      setLoading(false);
      return;
    }

    try {
      const paintRes = await axios.get('http://localhost:5000/api/sales/painting');
      setPaintingSales(paintRes.data || []);
    } catch (error) {
      const status = (error as any)?.response?.status;
      if (status === 404) {
        setPaintEndpointAvailable(false);
        await fetchPaintingFallback();
      } else {
        setPaintingSales([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData().catch(() => null);
  }, [shouldShowPainting, paintEndpointAvailable]);

  useEffect(() => {
    const nextHours = Number(estimatedHours) || 0;
    const timeoutId = setTimeout(() => {
      setEffectiveHours(nextHours);
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [estimatedHours]);

  const occupied = useMemo(() => {
    const fixedSlots: { start: Date; end: Date; saleId?: string }[] = [];
    if (currentPrint?.printStartedAt) {
      const duration = Math.max(getDurationHours(currentPrint), 0);
      if (duration > 0) {
        const start = new Date(currentPrint.printStartedAt);
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
    if (currentPrint?.printStartedAt) {
      const duration = Math.max(getDurationHours(currentPrint), 0);
      if (duration > 0) {
        const start = new Date(currentPrint.printStartedAt);
        list.push({
          id: `current-${currentPrint.id}`,
          title: currentPrint.description || 'Em impressao',
          start,
          end: addHours(start, duration),
          color: '#f97316'
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
        color: '#0f766e'
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
        backgroundColor: '#fde68a'
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
          color: '#22c55e'
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
          backgroundColor: '#fde68a'
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

    if (currentPrint?.id === saleId && currentPrint.printStartedAt) {
      const hours = duration > 0 ? duration : Math.max(getDurationHours(currentPrint), 0);
      if (hours > 0) {
        return addHours(new Date(currentPrint.printStartedAt), hours);
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

  const paintEvents = useMemo(() => {
    const list: any[] = [];
    paintingSales.forEach((sale) => {
      if (!sale.paintStartConfirmedAt) return;
      const duration = Math.max(getPaintDurationHours(sale), 0);
      if (duration <= 0) return;
      const start = new Date(sale.paintStartConfirmedAt);
      const responsible = sale.paintResponsible ? ` - ${sale.paintResponsible}` : '';
      list.push({
        id: `paint-${sale.id}`,
        title: `${sale.description || 'Pintura'}${responsible}`,
        start,
        end: addHours(start, duration),
        color: '#6366f1'
      });
    });

    const hasSelectedMatch = paintValue
      ? paintingSales.some((sale) => sale.paintStartConfirmedAt && new Date(sale.paintStartConfirmedAt).getTime() === new Date(paintValue).getTime())
      : false;

    if (paintValue && !hasSelectedMatch) {
      const duration = Math.max(0, effectivePaintHours);
      if (duration > 0) {
        const start = new Date(paintValue);
        const responsible = paintResponsible ? ` - ${paintResponsible}` : '';
        list.push({
          id: 'paint-selected',
          title: `${'Pintura'}${responsible}`,
          start,
          end: addHours(start, duration),
          color: '#8b5cf6'
        });
      }
    }

    return list;
  }, [paintingSales, paintValue, effectivePaintHours, paintResponsible]);

  const persistSchedule = async (nextValue: string | null) => {
    if (!canPersist) return;
    setSaving(true);
    try {
      await axios.patch(`http://localhost:5000/api/sales/${saleId}/schedule`, {
        printStartConfirmedAt: nextValue ? nextValue : null
      });
      await fetchData();
      setSelectionError('');
    } catch (error) {
      const status = (error as any)?.response?.status;
      if (status === 404 && saleId) {
        try {
          const saleRes = await axios.get(`http://localhost:5000/api/sales/${saleId}`);
          const updatedSale = {
            ...saleRes.data,
            printStartConfirmedAt: nextValue ? nextValue : null
          };
          await axios.put(`http://localhost:5000/api/sales/${saleId}`, updatedSale);
          await fetchData();
          setSelectionError('');
          return;
        } catch (fallbackError) {
          console.error('Error saving schedule (fallback)', fallbackError);
        }
      }
      console.error('Error saving schedule', error);
      setSelectionError('Erro ao salvar o horario. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const persistPaintSchedule = async (nextValue: string | null) => {
    if (!canPersist) return;
    setSaving(true);
    const payload = {
      paintStartConfirmedAt: nextValue ? nextValue : null,
      paintTimeHours: effectivePaintHours > 0 ? effectivePaintHours : null,
      paintResponsible: paintResponsible && paintResponsible.trim() !== '' ? paintResponsible.trim() : null
    };
    try {
      if (!paintEndpointAvailable) {
        throw new Error('paint-endpoint-missing');
      }
      await axios.patch(`http://localhost:5000/api/sales/${saleId}/paint-schedule`, payload);
      await fetchData();
      setPaintSelectionError('');
    } catch (error) {
      const status = (error as any)?.response?.status;
      if ((status === 404 || (error as Error)?.message === 'paint-endpoint-missing') && saleId) {
        if (status === 404) {
          setPaintEndpointAvailable(false);
        }
        try {
          const saleRes = await axios.get(`http://localhost:5000/api/sales/${saleId}`);
          const updatedSale = {
            ...saleRes.data,
            paintStartConfirmedAt: nextValue ? nextValue : null
          };
          if (effectivePaintHours > 0) {
            updatedSale.paintTimeHours = effectivePaintHours;
          }
          if (paintResponsible && paintResponsible.trim() !== '') {
            updatedSale.paintResponsible = paintResponsible.trim();
          }
          await axios.put(`http://localhost:5000/api/sales/${saleId}`, updatedSale);
          await fetchData();
          setPaintSelectionError('');
          return;
        } catch (fallbackError) {
          console.error('Error saving paint schedule (fallback)', fallbackError);
        }
      }
      console.error('Error saving paint schedule', error);
      setPaintSelectionError('Erro ao salvar o horario de pintura. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!value || !onChange || readOnly) return;
    const duration = Math.max(0, effectiveHours);
    const start = new Date(value);
    const validation = validateSlot(start, duration, occupied, {
      ignoreSaleId: saleId
    });
    if (!validation.valid) {
      onChange(null);
      setSelectionError(validation.message || 'Horario invalido para este tempo.');
      return;
    }
    setSelectionError('');
  }, [estimatedHours, value, occupied, onChange, readOnly, saleId, effectiveHours]);

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

  const handleDateClick = (info: { date: Date }) => {
    if (!onChange || readOnly) return;
    const duration = Math.max(0, effectiveHours);
    const validation = validateSlot(info.date, duration, occupied, {
      enforceFuture: true,
      ignoreSaleId: saleId
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

  const handlePaintDateClick = (info: { date: Date }) => {
    if (!onPaintChange || readOnly) return;
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
          <span className="text-xs font-semibold uppercase tracking-wide text-teal-600 bg-teal-50 px-2 py-1 rounded-full">Impressão</span>
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

        {showSuggestionSummary && hasPainting && shouldShowPainting && !hasResolvedPaintSchedule && (
          <div className="mt-3 text-xs text-amber-600 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
            Defina a agenda de pintura para completar a sugestao de entrega.
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
            slotMinTime="08:00:00"
            slotMaxTime="23:00:00"
            businessHours={{
              daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
              startTime: '08:00',
              endTime: '23:00'
            }}
            events={printEvents}
            dateClick={handleDateClick}
          />
        </div>

        <div className="mt-4 text-xs text-gray-500">
          {loading
            ? 'Carregando agenda...'
            : 'Regras: inicio entre 08:00-23:00, intervalo de 20 min, entrega ate 18:00.'}
        </div>
      </div>

      {shouldShowPainting && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Agenda de pintura</h3>
              <p className="text-sm text-gray-500">Agendamento livre, sem regras de horario.</p>
              <p className="text-xs text-gray-500 mt-1">
                Responsavel: {paintResponsible ? paintResponsible : 'Nao informado'}
              </p>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">Pintura</span>
          </div>

          {!readOnly && onPaintChange && (
            <div className="mt-2 text-xs text-amber-600 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
              Marque a agenda de pintura clicando no horario desejado.
            </div>
          )}

          {paintSelectionError && (
            <div className="mt-3 text-xs text-red-600">{paintSelectionError}</div>
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
              selectable={!readOnly && Boolean(onPaintChange)}
              selectMirror
              dayMaxEvents
              slotMinTime="00:00:00"
              slotMaxTime="24:00:00"
              events={paintEvents}
              dateClick={handlePaintDateClick}
            />
          </div>

          <div className="mt-4 text-xs text-gray-500">
            {loading ? 'Carregando agenda...' : 'Sem regras fixas para pintura.'}
          </div>
        </div>
      )}
    </div>
  );
}
