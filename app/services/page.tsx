'use client';

import axios from 'axios';
import { useDialog } from '@/context/DialogContext';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type ServiceStatus = 'Active' | 'Concluded';

interface ServiceProvider {
  id: string;
  name: string;
  email?: string;
  categories: string[];
  category?: string;
}

interface DesignTask {
  id: string;
  title: string;
  startAt?: string;
  durationHours?: number;
  responsibleId?: string;
  responsibleName?: string;
  value?: number;
  status?: ServiceStatus;
}

interface PaintingTask {
  id: string;
  title: string;
  startAt?: string;
  durationHours?: number;
  responsibleId?: string;
  responsibleName?: string;
  value?: number;
  status?: ServiceStatus;
}

interface ServiceSale {
  id: string;
  description?: string;
  designStartConfirmedAt?: string;
  designTimeHours?: number;
  designResponsible?: string;
  designValue?: number;
  designStatus?: ServiceStatus;
  paintStartConfirmedAt?: string;
  paintTimeHours?: number;
  paintResponsible?: string;
  paintValue?: number;
  paintStatus?: ServiceStatus;
}

type ServiceRecordCategory = 'design' | 'painting';
type ServiceRecordSource = 'sale' | 'task';

interface ServiceRecord {
  id: string;
  category: ServiceRecordCategory;
  source: ServiceRecordSource;
  title: string;
  startAt?: string;
  durationHours?: number;
  responsible?: string;
  value: number;
  status: ServiceStatus;
  saleId?: string;
  taskId?: string;
}

const normalizeServiceStatus = (value?: string): ServiceStatus =>
  value === 'Concluded' ? 'Concluded' : 'Active';
const isServiceActive = (value?: string) => normalizeServiceStatus(value) === 'Active';
const normalizeTag = (value: string) => (value || '').trim().toLowerCase();

const formatCurrency = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const buildManageEditHref = (category: ServiceRecordCategory, taskId: string) =>
  `/services/manage?editType=${category}&editId=${taskId}`;

export default function ServicesPage() {
  const { showAlert, showConfirm } = useDialog();
  const router = useRouter();
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [designTasks, setDesignTasks] = useState<DesignTask[]>([]);
  const [paintingTasks, setPaintingTasks] = useState<PaintingTask[]>([]);
  const [serviceSales, setServiceSales] = useState<ServiceSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceEndpointAvailable, setServiceEndpointAvailable] = useState(true);

  const [reportFilterDate, setReportFilterDate] = useState('');
  const [reportFilterType, setReportFilterType] = useState<'date' | 'month'>('date');
  const [reportTypeFilter, setReportTypeFilter] = useState<'all' | ServiceRecordCategory>('all');
  const [reportStatusFilter, setReportStatusFilter] = useState<'all' | 'active' | 'concluded'>('all');
  const [reportResponsibleFilter, setReportResponsibleFilter] = useState('');
  const [isReportFilterOpen, setIsReportFilterOpen] = useState(false);
  const reportFilterMenuRef = useRef<HTMLDivElement | null>(null);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  const fetchProviders = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/service-providers');
      setProviders(res.data || []);
    } catch (error) {
      console.error('Error fetching providers:', error);
      setProviders([]);
    }
  };

  const fetchDesignTasks = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/designs');
      setDesignTasks(res.data || []);
    } catch (error) {
      console.error('Error fetching designs:', error);
      setDesignTasks([]);
    }
  };

  const fetchPaintingTasks = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/paintings');
      setPaintingTasks(res.data || []);
    } catch (error) {
      console.error('Error fetching paintings:', error);
      setPaintingTasks([]);
    }
  };

  const fetchServiceSalesFallback = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/sales');
      const list = (res.data || []).filter((sale: ServiceSale) =>
        sale.designStartConfirmedAt ||
        (Number(sale.designTimeHours) || 0) > 0 ||
        (sale.designResponsible && sale.designResponsible.trim() !== '') ||
        sale.paintStartConfirmedAt ||
        (Number(sale.paintTimeHours) || 0) > 0 ||
        (sale.paintResponsible && sale.paintResponsible.trim() !== '')
      );
      setServiceSales(list);
    } catch (error) {
      console.error('Error fetching services fallback:', error);
      setServiceSales([]);
    }
  };

  const fetchServiceSales = async () => {
    if (!serviceEndpointAvailable) {
      await fetchServiceSalesFallback();
      return;
    }

    try {
      const res = await axios.get('http://localhost:5000/api/sales/services');
      setServiceSales(res.data || []);
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 404) {
        setServiceEndpointAvailable(false);
        await fetchServiceSalesFallback();
        return;
      }
      console.error('Error fetching services:', error);
      setServiceSales([]);
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([fetchProviders(), fetchDesignTasks(), fetchPaintingTasks(), fetchServiceSales()]);
      setLoading(false);
    };
    fetchAll().catch(() => setLoading(false));
  }, [serviceEndpointAvailable]);

  useEffect(() => {
    if (!isReportFilterOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (reportFilterMenuRef.current && !reportFilterMenuRef.current.contains(target)) {
        setIsReportFilterOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isReportFilterOpen]);

  const resolveResponsibleName = (responsibleId?: string, responsibleName?: string) => {
    const trimmedName = (responsibleName || '').trim();
    if (trimmedName) return trimmedName;
    if (responsibleId) {
      const provider = providers.find(item => item.id === responsibleId);
      if (provider) return provider.name;
    }
    return '';
  };

  const serviceRecords = useMemo(() => {
    const records: ServiceRecord[] = [];

    serviceSales.forEach((sale) => {
      const designStatus = normalizeServiceStatus(sale.designStatus);
      const hasDesignService = Boolean(
        sale.designStartConfirmedAt ||
        (Number(sale.designTimeHours) || 0) > 0 ||
        (sale.designResponsible && sale.designResponsible.trim() !== '') ||
        (Number(sale.designValue) || 0) > 0
      );
      if (hasDesignService) {
        records.push({
          id: `sale-design-${sale.id}`,
          category: 'design',
          source: 'sale',
          title: sale.description || 'Servico',
          startAt: sale.designStartConfirmedAt,
          durationHours: Number(sale.designTimeHours) || 0,
          responsible: sale.designResponsible || '',
          value: Number(sale.designValue) || 0,
          status: designStatus,
          saleId: sale.id
        });
      }

      const paintStatus = normalizeServiceStatus(sale.paintStatus);
      const hasPaintService = Boolean(
        sale.paintStartConfirmedAt ||
        (Number(sale.paintTimeHours) || 0) > 0 ||
        (sale.paintResponsible && sale.paintResponsible.trim() !== '') ||
        (Number(sale.paintValue) || 0) > 0
      );
      if (hasPaintService) {
        records.push({
          id: `sale-paint-${sale.id}`,
          category: 'painting',
          source: 'sale',
          title: sale.description || 'Servico',
          startAt: sale.paintStartConfirmedAt,
          durationHours: Number(sale.paintTimeHours) || 0,
          responsible: sale.paintResponsible || '',
          value: Number(sale.paintValue) || 0,
          status: paintStatus,
          saleId: sale.id
        });
      }
    });

    designTasks.forEach((task) => {
      records.push({
        id: `task-design-${task.id}`,
        category: 'design',
        source: 'task',
        title: task.title || 'Design',
        startAt: task.startAt,
        durationHours: Number(task.durationHours) || 0,
        responsible: resolveResponsibleName(task.responsibleId, task.responsibleName),
        value: Number(task.value) || 0,
        status: normalizeServiceStatus(task.status),
        taskId: task.id
      });
    });

    paintingTasks.forEach((task) => {
      records.push({
        id: `task-paint-${task.id}`,
        category: 'painting',
        source: 'task',
        title: task.title || 'Pintura',
        startAt: task.startAt,
        durationHours: Number(task.durationHours) || 0,
        responsible: resolveResponsibleName(task.responsibleId, task.responsibleName),
        value: Number(task.value) || 0,
        status: normalizeServiceStatus(task.status),
        taskId: task.id
      });
    });

    return records;
  }, [serviceSales, designTasks, paintingTasks, providers]);

  const sortedServiceRecords = useMemo(() => {
    return [...serviceRecords].sort((a, b) => {
      const aTime = a.startAt ? new Date(a.startAt).getTime() : 0;
      const bTime = b.startAt ? new Date(b.startAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [serviceRecords]);

  const responsibleOptions = useMemo(() => {
    const map = new Map<string, string>();
    sortedServiceRecords.forEach(record => {
      const name = (record.responsible || '').trim();
      if (!name) return;
      const key = normalizeTag(name);
      if (!map.has(key)) {
        map.set(key, name);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [sortedServiceRecords]);

  const filteredServiceRecords = useMemo(() => {
    return sortedServiceRecords.filter(record => {
      if (reportTypeFilter !== 'all' && record.category !== reportTypeFilter) return false;
      if (reportStatusFilter === 'active' && !isServiceActive(record.status)) return false;
      if (reportStatusFilter === 'concluded' && isServiceActive(record.status)) return false;
      if (reportResponsibleFilter && (record.responsible || '').trim() !== reportResponsibleFilter) return false;
      if (reportFilterDate) {
        if (!record.startAt) return false;
        return record.startAt.startsWith(reportFilterDate);
      }
      return true;
    });
  }, [
    sortedServiceRecords,
    reportTypeFilter,
    reportStatusFilter,
    reportResponsibleFilter,
    reportFilterDate
  ]);

  const totalServiceValue = useMemo(
    () => filteredServiceRecords.reduce((acc, record) => acc + (Number(record.value) || 0), 0),
    [filteredServiceRecords]
  );
  const totalDesignValue = useMemo(
    () => filteredServiceRecords
      .filter(record => record.category === 'design')
      .reduce((acc, record) => acc + (Number(record.value) || 0), 0),
    [filteredServiceRecords]
  );
  const totalPaintingValue = useMemo(
    () => filteredServiceRecords
      .filter(record => record.category === 'painting')
      .reduce((acc, record) => acc + (Number(record.value) || 0), 0),
    [filteredServiceRecords]
  );
  const activeServiceCount = useMemo(
    () => filteredServiceRecords.filter(record => isServiceActive(record.status)).length,
    [filteredServiceRecords]
  );

  const activeReportFilters = useMemo(() => {
    let count = 0;
    if (reportTypeFilter !== 'all') count += 1;
    if (reportStatusFilter !== 'all') count += 1;
    if (reportResponsibleFilter) count += 1;
    return count;
  }, [reportTypeFilter, reportStatusFilter, reportResponsibleFilter]);

  const toggleReportTypeFilter = (value: ServiceRecordCategory) => {
    setReportTypeFilter(prev => (prev === value ? 'all' : value));
  };

  const toggleReportStatusFilter = (value: 'active' | 'concluded') => {
    setReportStatusFilter(prev => (prev === value ? 'all' : value));
  };

  const toggleExpandRecord = (id: string) => {
    setExpandedRecordId(prev => (prev === id ? null : id));
  };

  const handleTaskDelete = (taskId: string) => {
    showConfirm(
      'Excluir Design',
      'Tem certeza que deseja excluir este design?',
      async () => {
        try {
          await axios.delete(`http://localhost:5000/api/designs/${taskId}`);
          setDesignTasks(prev => prev.filter(task => task.id !== taskId));
          await showAlert('Sucesso', 'Design excluido.', 'success');
        } catch (error) {
          console.error('Error deleting design:', error);
          await showAlert('Erro', 'Nao foi possivel excluir o design.', 'error');
        }
      }
    );
  };

  const handlePaintingDelete = (taskId: string) => {
    showConfirm(
      'Excluir Pintura',
      'Tem certeza que deseja excluir esta pintura?',
      async () => {
        try {
          await axios.delete(`http://localhost:5000/api/paintings/${taskId}`);
          setPaintingTasks(prev => prev.filter(task => task.id !== taskId));
          await showAlert('Sucesso', 'Pintura excluida.', 'success');
        } catch (error) {
          console.error('Error deleting painting:', error);
          await showAlert('Erro', 'Nao foi possivel excluir a pintura.', 'error');
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b-2 border-brand-orange pb-4 gap-3">
        <div>
          <h1 className="text-3xl font-bold text-brand-purple">Servicos</h1>
          <p className="text-sm text-gray-500">Relatorio dedicado para design e pintura.</p>
        </div>
        <Link
          href="/services/manage"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-purple px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-purple-900 transition-colors"
        >
          Criar servico
        </Link>
      </div>

      <section className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center border-b-2 border-brand-orange pb-4 gap-4">
          <h2 className="text-2xl font-bold text-brand-purple">Relatorio de Servicos</h2>
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 justify-between md:justify-start">
                <label htmlFor="serviceDateFilter" className="text-sm font-bold text-brand-purple flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
                  </svg>
                  Filtrar:
                </label>
                <select
                  value={reportFilterType}
                  onChange={(event) => {
                    setReportFilterType(event.target.value as 'date' | 'month');
                    setReportFilterDate('');
                  }}
                  className="border-none text-sm text-gray-600 focus:ring-0 bg-transparent cursor-pointer font-medium"
                >
                  <option value="date">Dia</option>
                  <option value="month">Mes</option>
                </select>
                <div className="hidden md:block h-4 w-px bg-gray-300 mx-1"></div>
                <select
                  value={reportResponsibleFilter}
                  onChange={(event) => setReportResponsibleFilter(event.target.value)}
                  className="border-none text-sm text-gray-600 focus:ring-0 bg-transparent cursor-pointer font-medium"
                  style={{ minWidth: 140 }}
                >
                  <option value="">Todos os Responsaveis</option>
                  {responsibleOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div className="hidden md:block h-4 w-px bg-gray-300 mx-1"></div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <input
                  type={reportFilterType}
                  id="serviceDateFilter"
                  value={reportFilterDate}
                  onChange={(event) => setReportFilterDate(event.target.value)}
                  className="border-0 p-0 text-sm text-gray-600 focus:ring-0 bg-transparent cursor-pointer w-full md:w-auto"
                />
                {reportFilterDate && (
                  <button
                    type="button"
                    onClick={() => setReportFilterDate('')}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    title="Limpar filtro"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="relative" ref={reportFilterMenuRef}>
              <button
                type="button"
                onClick={() => setIsReportFilterOpen(prev => !prev)}
                className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm hover:border-gray-300 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707L14 14.586V19a1 1 0 01-1.447.894l-4-2A1 1 0 018 16.618v-2.032L3.293 7.293A1 1 0 013 6.586V4z"></path>
                </svg>
                <span className="text-sm font-medium text-gray-700">Filtros</span>
                {activeReportFilters > 0 && (
                  <span className="text-xs font-bold text-white bg-brand-purple px-2 py-0.5 rounded-full">
                    {activeReportFilters}
                  </span>
                )}
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${isReportFilterOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>

              {isReportFilterOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-4 z-10">
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Categoria</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => toggleReportTypeFilter('design')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            reportTypeFilter === 'design'
                              ? 'bg-sky-100 text-sky-700 border-sky-200'
                              : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          Design
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleReportTypeFilter('painting')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            reportTypeFilter === 'painting'
                              ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                              : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          Pintura
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Status</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => toggleReportStatusFilter('active')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            reportStatusFilter === 'active'
                              ? 'bg-green-100 text-green-700 border-green-200'
                              : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          Ativos
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleReportStatusFilter('concluded')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            reportStatusFilter === 'concluded'
                              ? 'bg-gray-200 text-gray-800 border-gray-200'
                              : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          Concluidos
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setReportTypeFilter('all');
                        setReportStatusFilter('all');
                        setReportResponsibleFilter('');
                      }}
                      className="w-full text-xs font-semibold text-gray-600 hover:text-gray-800 transition-colors border-t border-gray-100 pt-3"
                    >
                      Limpar filtros
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 font-medium uppercase">Lucro total (servicos)</p>
            <p className="text-3xl font-bold text-gray-800 mt-2">{formatCurrency(totalServiceValue)}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 font-medium uppercase">Lucro design</p>
            <p className="text-3xl font-bold text-sky-600 mt-2">{formatCurrency(totalDesignValue)}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 font-medium uppercase">Lucro pintura</p>
            <p className="text-3xl font-bold text-indigo-600 mt-2">{formatCurrency(totalPaintingValue)}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 table-fixed">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Data</th>
                  <th className="hidden md:table-cell px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Descricao</th>
                  <th className="hidden md:table-cell px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Responsavel</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Valor</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Acoes</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredServiceRecords.map(record => (
                  <Fragment key={record.id}>
                    <tr
                      onClick={() => toggleExpandRecord(record.id)}
                      className={`cursor-pointer transition-colors ${expandedRecordId === record.id ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.startAt ? new Date(record.startAt).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            record.category === 'design'
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-indigo-100 text-indigo-700'
                          }`}
                        >
                          {record.category === 'design' ? 'Design' : 'Pintura'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 flex items-center gap-2 min-w-0">
                        {expandedRecordId === record.id ? (
                          <svg className="w-4 h-4 text-brand-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                          </svg>
                        )}
                        <div className="flex-1 min-w-0 max-w-[260px] overflow-x-auto whitespace-nowrap">{record.title}</div>
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.responsible || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(record.value) || 'R$ 0,00'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          isServiceActive(record.status)
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-200 text-gray-800'
                        }`}>
                          {isServiceActive(record.status) ? 'Ativo' : 'Concluido'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={(event) => event.stopPropagation()}>
                        {record.source === 'sale' && record.saleId ? (
                          <button
                            type="button"
                            onClick={() => router.push(`/sales/${record.saleId}`)}
                            className="text-brand-purple hover:text-purple-900"
                          >
                            Ver venda
                          </button>
                        ) : (
                          <div className="flex items-center justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                if (record.taskId) {
                                  router.push(buildManageEditHref(record.category, record.taskId));
                                }
                              }}
                              className="text-brand-purple hover:text-purple-900"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!record.taskId) return;
                                if (record.category === 'design') {
                                  handleTaskDelete(record.taskId);
                                }
                                if (record.category === 'painting') {
                                  handlePaintingDelete(record.taskId);
                                }
                              }}
                              className="text-red-600 hover:text-red-800"
                            >
                              Excluir
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {expandedRecordId === record.id && (
                      <tr className="bg-purple-50">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700">
                            <div>
                              <p className="font-bold text-brand-purple mb-1">Categoria</p>
                              <p>{record.category === 'design' ? 'Design' : 'Pintura'}</p>
                            </div>
                            <div>
                              <p className="font-bold text-brand-purple mb-1">Responsavel</p>
                              <p>{record.responsible || 'Nao informado'}</p>
                            </div>
                            <div>
                              <p className="font-bold text-brand-purple mb-1">Duracao</p>
                              <p>{record.durationHours ? `${record.durationHours}h` : '-'}</p>
                            </div>
                            <div>
                              <p className="font-bold text-brand-purple mb-1">Inicio</p>
                              <p>{record.startAt ? new Date(record.startAt).toLocaleString('pt-BR') : '--'}</p>
                            </div>
                            <div>
                              <p className="font-bold text-brand-purple mb-1">Origem</p>
                              <p>{record.source === 'sale' ? 'Venda' : 'Servico avulso'}</p>
                            </div>
                            <div>
                              <p className="font-bold text-brand-purple mb-1">Lucro</p>
                              <p>{formatCurrency(record.value) || 'R$ 0,00'}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredServiceRecords.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum servico encontrado</h3>
            <p className="mt-1 text-sm text-gray-500">Ajuste os filtros ou cadastre novos servicos.</p>
          </div>
        )}

        <div className="text-xs text-gray-500">
          {loading ? 'Carregando servicos...' : `Servicos ativos: ${activeServiceCount}`}
        </div>
      </section>
    </div>
  );
}
