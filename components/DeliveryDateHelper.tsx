"use client";
import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { parseDurationToHours } from '@/utils/time';

interface DeliveryDateHelperProps {
  estimatedHours?: number;
  hasPainting?: boolean;
}

interface QueueSale {
  id: string;
  printTimeHours?: number;
  designPrintTime?: string;
  printStartedAt?: string;
  printStatus?: string;
}

const PRINT_START_HOUR = 8;
const LAST_START_HOUR = 23;
const DELIVERY_CUTOFF_HOUR = 18;
const GAP_MINUTES = 20;

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

function calculateNextStart(previousEnd: Date | null, baseTime: Date) {
  if (!previousEnd) {
    return alignStart(baseTime, false);
  }
  const candidate = addMinutes(previousEnd, GAP_MINUTES);
  return alignStart(candidate, true);
}

function calculateDeliveryDate(printEnd: Date) {
  const cutoff = new Date(printEnd);
  cutoff.setHours(DELIVERY_CUTOFF_HOUR, 0, 0, 0);
  const delivery = new Date(printEnd);
  if (printEnd > cutoff) {
    delivery.setDate(delivery.getDate() + 1);
  }
  delivery.setHours(0, 0, 0, 0);
  return delivery;
}

function getQueueDuration(sale: QueueSale) {
  const hours = Number(sale.printTimeHours) || 0;
  if (hours > 0) return hours;
  return parseDurationToHours(sale.designPrintTime || '');
}

export default function DeliveryDateHelper({ estimatedHours, hasPainting }: DeliveryDateHelperProps) {
  const [queue, setQueue] = useState<QueueSale[]>([]);
  const [currentPrint, setCurrentPrint] = useState<QueueSale | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const [queueRes, currentRes] = await Promise.all([
          axios.get('http://localhost:5000/api/sales/queue'),
          axios.get('http://localhost:5000/api/sales/current')
        ]);
        if (!isMounted) return;
        setQueue(queueRes.data || []);
        setCurrentPrint(currentRes.status === 204 ? null : currentRes.data);
      } catch (error) {
        if (!isMounted) return;
        setQueue([]);
        setCurrentPrint(null);
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, []);

  const schedule = useMemo(() => {
    const hours = Number(estimatedHours) || 0;
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(PRINT_START_HOUR, 0, 0, 0);
    const dayEnd = new Date(now);
    dayEnd.setHours(LAST_START_HOUR, 0, 0, 0);
    const baseTime = new Date(dayStart);
    if (now > dayEnd) {
      baseTime.setDate(baseTime.getDate() + 1);
    }
    let previousEnd: Date | null = null;

    if (currentPrint?.printStartedAt) {
      const duration = getQueueDuration(currentPrint);
      if (duration > 0) {
        previousEnd = addHours(new Date(currentPrint.printStartedAt), duration);
      }
    }

    for (const item of queue) {
      const start = calculateNextStart(previousEnd, baseTime);
      const duration = Math.max(0, getQueueDuration(item));
      const end = addHours(start, duration);
      previousEnd = end;
    }

    if (hours <= 0) {
      return { suggestedStart: null, suggestedDelivery: null };
    }

    const suggestedStart = calculateNextStart(previousEnd, baseTime);
    const suggestedEnd = addHours(suggestedStart, hours);
    const suggestedDelivery = calculateDeliveryDate(suggestedEnd);
    return { suggestedStart, suggestedDelivery };
  }, [queue, currentPrint, estimatedHours, hasPainting]);

  const startLabel = schedule.suggestedStart
    ? schedule.suggestedStart.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : '--';
  const deliveryLabel = schedule.suggestedDelivery
    ? schedule.suggestedDelivery.toLocaleDateString('pt-BR')
    : '--';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800">Data de entrega</h3>
          <p className="text-sm text-gray-500">Sugestao baseada na fila e nas regras de impressao.</p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-teal-600 bg-teal-50 px-2 py-1 rounded-full">Sugestao</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Inicio previsto</p>
          <p className="text-2xl font-bold text-gray-900">{startLabel}</p>
        </div>
        <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Entrega sugerida</p>
          <p className="text-2xl font-bold text-gray-900">{deliveryLabel}</p>
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500">
        {loading
          ? 'Carregando fila de producao...'
          : 'Regras: inicio entre 08:00-23:00, intervalo de 20 min, entrega ate 18:00.'}
      </div>
    </div>
  );
}
