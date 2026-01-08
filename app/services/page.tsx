'use client';

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import axios from 'axios';
import { useDialog } from '@/context/DialogContext';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';

interface ServiceProvider {
  id: string;
  name: string;
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
}

interface PaintingTask {
  id: string;
  title: string;
  startAt?: string;
  durationHours?: number;
  responsibleId?: string;
  responsibleName?: string;
  value?: number;
}

interface HoverCardData {
  x: number;
  y: number;
  title: string;
  typeLabel: string;
  start: Date;
  end: Date;
  durationHours?: number;
  responsible?: string;
  value?: number;
  saleId?: string;
  taskType?: 'design' | 'painting';
  taskId?: string;
}

interface ServiceSale {
  id: string;
  description?: string;
  designStartConfirmedAt?: string;
  designTimeHours?: number;
  designResponsible?: string;
  paintStartConfirmedAt?: string;
  paintTimeHours?: number;
  paintResponsible?: string;
}

const normalizeCategory = (value?: string) => (value || '').trim().toLowerCase();
const hasCategory = (categories: string[] | undefined, matcher: (value: string) => boolean) =>
  (categories || []).some(category => matcher(normalizeCategory(category)));
const isDesignerCategory = (categories?: string[]) =>
  hasCategory(categories, value => value.includes('design'));
const isPainterCategory = (categories?: string[]) =>
  hasCategory(categories, value => value.includes('pint') || value.includes('paint'));
const normalizeTag = (value: string) => normalizeCategory(value);
const mergeTags = (current: string[], next: string[]) => {
  const map = new Map<string, string>();
  current.forEach(tag => {
    const key = normalizeTag(tag);
    if (key && !map.has(key)) {
      map.set(key, tag);
    }
  });
  next.forEach(tag => {
    const key = normalizeTag(tag);
    if (key && !map.has(key)) {
      map.set(key, tag);
    }
  });
  return Array.from(map.values());
};
const getTagStyle = (tag: string, active: boolean) => {
  const normalized = normalizeTag(tag);
  if (normalized.includes('design')) {
    return active ? 'bg-sky-100 text-sky-700' : 'bg-sky-50 text-sky-600';
  }
  if (normalized.includes('pint') || normalized.includes('paint')) {
    return active ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-50 text-indigo-600';
  }
  return active ? 'bg-gray-200 text-gray-800' : 'bg-gray-100 text-gray-600';
};

const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 60 * 60 * 1000);

const formatDateTime = (value: Date) =>
  value.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const formatCurrency = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const getHoverPosition = (
  event: MouseEvent,
  options: { width?: number; height?: number; anchorRect?: DOMRect } = {}
) => {
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
};
const toLocalInputValue = (value: string) => {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const fromLocalInputValue = (value: string) => {
  if (!value) return '';
  return new Date(value).toISOString();
};

export default function ServicesPage() {
  const { showAlert, showConfirm } = useDialog();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [designTasks, setDesignTasks] = useState<DesignTask[]>([]);
  const [paintingTasks, setPaintingTasks] = useState<PaintingTask[]>([]);
  const [serviceSales, setServiceSales] = useState<ServiceSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceEndpointAvailable, setServiceEndpointAvailable] = useState(true);

  const [providerForm, setProviderForm] = useState({
    name: '',
    categories: [] as string[]
  });
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>(['designer', 'pintor']);
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  const [taskForm, setTaskForm] = useState({
    title: '',
    durationHours: 0,
    value: 0,
    responsibleId: '',
    responsibleName: '',
    startAt: ''
  });
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [paintingForm, setPaintingForm] = useState({
    title: '',
    durationHours: 0,
    value: 0,
    responsibleId: '',
    responsibleName: '',
    startAt: ''
  });
  const [editingPaintingId, setEditingPaintingId] = useState<string | null>(null);
  const [calendarTarget, setCalendarTarget] = useState<'design' | 'painting'>('design');
  const [hoverCard, setHoverCard] = useState<HoverCardData | null>(null);
  const hoverCardActiveRef = useRef(false);
  const eventHoverActiveRef = useRef(false);
  const isDraggingRef = useRef(false);
  const hideHoverTimeoutRef = useRef<number | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  const designerProviders = useMemo(
    () => providers.filter(provider => isDesignerCategory(
      provider.categories && provider.categories.length > 0
        ? provider.categories
        : provider.category
        ? [provider.category]
        : []
    )),
    [providers]
  );
  const painterProviders = useMemo(
    () => providers.filter(provider => isPainterCategory(
      provider.categories && provider.categories.length > 0
        ? provider.categories
        : provider.category
        ? [provider.category]
        : []
    )),
    [providers]
  );
  const hasTaskResponsibleOption = taskForm.responsibleId !== ''
    && designerProviders.some(provider => provider.id === taskForm.responsibleId);
  const hasPaintingResponsibleOption = paintingForm.responsibleId !== ''
    && painterProviders.some(provider => provider.id === paintingForm.responsibleId);
  const hasDesignRequirements = taskForm.title.trim() !== '' && Number(taskForm.durationHours) > 0;
  const hasPaintingRequirements = paintingForm.title.trim() !== '' && Number(paintingForm.durationHours) > 0;
  const isCalendarReady = calendarTarget === 'design'
    ? hasDesignRequirements
    : hasPaintingRequirements;
  const calendarBlockMessage = calendarTarget === 'design'
    ? 'Selecione Design/Pintura e preencha Titulo e Duracao do design para liberar a agenda.'
    : 'Selecione Design/Pintura e preencha Titulo e Duracao da pintura para liberar a agenda.';

  const fetchProviders = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/service-providers');
      const list = res.data || [];
      setProviders(list);
      const tagList = list.flatMap((provider: ServiceProvider) =>
        provider.categories && provider.categories.length > 0
          ? provider.categories
          : provider.category
          ? [provider.category]
          : []
      );
      setAvailableTags(prev => mergeTags(prev, tagList));
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

  const resetProviderForm = () => {
    setProviderForm({ name: '', categories: [] });
    setEditingProviderId(null);
  };

  const resetTaskForm = () => {
    setTaskForm({
      title: '',
      durationHours: 0,
      value: 0,
      responsibleId: '',
      responsibleName: '',
      startAt: ''
    });
    setEditingTaskId(null);
  };

  const resetPaintingForm = () => {
    setPaintingForm({
      title: '',
      durationHours: 0,
      value: 0,
      responsibleId: '',
      responsibleName: '',
      startAt: ''
    });
    setEditingPaintingId(null);
  };

  const handleProviderSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = providerForm.name.trim();
    const categories = providerForm.categories;
    if (!name || categories.length === 0) {
      await showAlert('Erro', 'Informe nome e tags do prestador.', 'error');
      return;
    }

    try {
      if (editingProviderId) {
        await axios.put(`http://localhost:5000/api/service-providers/${editingProviderId}`, {
          name,
          categories
        });
        setProviders(prev =>
          prev.map(provider =>
            provider.id === editingProviderId ? { ...provider, name, categories } : provider
          )
        );
        setAvailableTags(prev => mergeTags(prev, categories));
        await showAlert('Sucesso', 'Prestador atualizado.', 'success');
      } else {
        const res = await axios.post('http://localhost:5000/api/service-providers', {
          name,
          categories
        });
        setProviders(prev => [...prev, res.data]);
        setAvailableTags(prev => mergeTags(prev, categories));
        await showAlert('Sucesso', 'Prestador criado.', 'success');
      }
      resetProviderForm();
    } catch (error) {
      console.error('Error saving provider:', error);
      await showAlert('Erro', 'Nao foi possivel salvar o prestador.', 'error');
    }
  };

  const handleProviderEdit = (provider: ServiceProvider) => {
    const categories = provider.categories && provider.categories.length > 0
      ? provider.categories
      : provider.category
      ? [provider.category]
      : [];
    setProviderForm({
      name: provider.name,
      categories
    });
    setEditingProviderId(provider.id);
  };

  const toggleTag = (tag: string) => {
    setProviderForm(prev => {
      const exists = prev.categories.some(item => normalizeTag(item) === normalizeTag(tag));
      const nextCategories = exists
        ? prev.categories.filter(item => normalizeTag(item) !== normalizeTag(tag))
        : [...prev.categories, tag];
      return { ...prev, categories: nextCategories };
    });
  };

  const handleAddTag = () => {
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    const nextTags = mergeTags(availableTags, [trimmed]);
    setAvailableTags(nextTags);
    setProviderForm(prev => ({
      ...prev,
      categories: mergeTags(prev.categories, [trimmed])
    }));
    setNewTagName('');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-tag-dropdown]')) {
        setIsTagMenuOpen(false);
      }
    };
    if (isTagMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTagMenuOpen]);

  const handleProviderDelete = (providerId: string) => {
    showConfirm(
      'Excluir Prestador',
      'Tem certeza que deseja excluir este prestador?',
      async () => {
        try {
          await axios.delete(`http://localhost:5000/api/service-providers/${providerId}`);
          setProviders(prev => prev.filter(provider => provider.id !== providerId));
          await showAlert('Sucesso', 'Prestador excluido.', 'success');
        } catch (error) {
          console.error('Error deleting provider:', error);
          await showAlert('Erro', 'Nao foi possivel excluir o prestador.', 'error');
        }
      }
    );
  };

  const handleTaskSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = taskForm.title.trim();
    const durationHours = Number(taskForm.durationHours) || 0;
    const startAt = taskForm.startAt;

    if (!title) {
      await showAlert('Erro', 'Informe o titulo do design.', 'error');
      return;
    }
    if (durationHours <= 0) {
      await showAlert('Erro', 'Informe a duracao do design.', 'error');
      return;
    }
    if (!startAt) {
      await showAlert('Erro', 'Selecione um horario na agenda.', 'error');
      return;
    }

    const payload = {
      title,
      startAt,
      durationHours,
      responsibleId: taskForm.responsibleId || null,
      responsibleName: taskForm.responsibleName || null,
      value: Number(taskForm.value) || 0
    };

    try {
      if (editingTaskId) {
        await axios.put(`http://localhost:5000/api/designs/${editingTaskId}`, payload);
        setDesignTasks(prev =>
          prev.map(task => (task.id === editingTaskId ? { ...task, ...payload, id: editingTaskId } : task))
        );
        await showAlert('Sucesso', 'Design atualizado.', 'success');
      } else {
        const res = await axios.post('http://localhost:5000/api/designs', payload);
        setDesignTasks(prev => [...prev, res.data]);
        await showAlert('Sucesso', 'Design criado.', 'success');
      }
      resetTaskForm();
    } catch (error) {
      console.error('Error saving design:', error);
      await showAlert('Erro', 'Nao foi possivel salvar o design.', 'error');
    }
  };

  const handleTaskEdit = (task: DesignTask) => {
    setCalendarTarget('design');
    const resolvedName = task.responsibleName
      || providers.find(provider => provider.id === task.responsibleId)?.name
      || '';
    setTaskForm({
      title: task.title || '',
      durationHours: Number(task.durationHours) || 0,
      value: Number(task.value) || 0,
      responsibleId: task.responsibleId || '',
      responsibleName: resolvedName,
      startAt: task.startAt || ''
    });
    setEditingTaskId(task.id);
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

  const handlePaintingSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = paintingForm.title.trim();
    const durationHours = Number(paintingForm.durationHours) || 0;
    const startAt = paintingForm.startAt;

    if (!title) {
      await showAlert('Erro', 'Informe o titulo da pintura.', 'error');
      return;
    }
    if (durationHours <= 0) {
      await showAlert('Erro', 'Informe a duracao da pintura.', 'error');
      return;
    }
    if (!startAt) {
      await showAlert('Erro', 'Selecione um horario na agenda.', 'error');
      return;
    }

    const payload = {
      title,
      startAt,
      durationHours,
      responsibleId: paintingForm.responsibleId || null,
      responsibleName: paintingForm.responsibleName || null,
      value: Number(paintingForm.value) || 0
    };

    try {
      if (editingPaintingId) {
        await axios.put(`http://localhost:5000/api/paintings/${editingPaintingId}`, payload);
        setPaintingTasks(prev =>
          prev.map(task => (task.id === editingPaintingId ? { ...task, ...payload, id: editingPaintingId } : task))
        );
        await showAlert('Sucesso', 'Pintura atualizada.', 'success');
      } else {
        const res = await axios.post('http://localhost:5000/api/paintings', payload);
        setPaintingTasks(prev => [...prev, res.data]);
        await showAlert('Sucesso', 'Pintura criada.', 'success');
      }
      resetPaintingForm();
    } catch (error) {
      console.error('Error saving painting:', error);
      await showAlert('Erro', 'Nao foi possivel salvar a pintura.', 'error');
    }
  };

  const handlePaintingEdit = (task: PaintingTask) => {
    setCalendarTarget('painting');
    const resolvedName = task.responsibleName
      || providers.find(provider => provider.id === task.responsibleId)?.name
      || '';
    setPaintingForm({
      title: task.title || '',
      durationHours: Number(task.durationHours) || 0,
      value: Number(task.value) || 0,
      responsibleId: task.responsibleId || '',
      responsibleName: resolvedName,
      startAt: task.startAt || ''
    });
    setEditingPaintingId(task.id);
  };

  useEffect(() => {
    const editType = searchParams.get('editType');
    const editId = searchParams.get('editId');
    if (!editType || !editId) return;

    if (editType === 'design') {
      const task = designTasks.find(item => item.id === editId);
      if (task) {
        handleTaskEdit(task);
      }
      return;
    }

    if (editType === 'painting') {
      const task = paintingTasks.find(item => item.id === editId);
      if (task) {
        handlePaintingEdit(task);
      }
    }
  }, [searchParams, designTasks, paintingTasks]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    setPortalRoot(document.body);
  }, []);

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

  const handlePaintingResponsibleChange = (value: string) => {
    const selected = painterProviders.find(provider => provider.id === value);
    setPaintingForm(prev => ({
      ...prev,
      responsibleId: selected?.id || '',
      responsibleName: selected?.name || ''
    }));
  };

  const handleTaskDateClick = (info: { date: Date }) => {
    const nextValue = info.date.toISOString();
    if (calendarTarget === 'painting') {
      setPaintingForm(prev => ({
        ...prev,
        startAt: nextValue
      }));
      return;
    }
    setTaskForm(prev => ({
      ...prev,
      startAt: nextValue
    }));
  };

  const updateSaleDesignSchedule = async (targetSaleId: string, nextValue: string | null) => {
    try {
      await axios.patch(`http://localhost:5000/api/sales/${targetSaleId}/design-schedule`, {
        designStartConfirmedAt: nextValue ? nextValue : null
      });
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
      await axios.put(`http://localhost:5000/api/sales/${targetSaleId}`, updatedSale);
    }
  };

  const updateSalePaintSchedule = async (targetSaleId: string, nextValue: string | null) => {
    try {
      await axios.patch(`http://localhost:5000/api/sales/${targetSaleId}/paint-schedule`, {
        paintStartConfirmedAt: nextValue ? nextValue : null
      });
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
      await axios.put(`http://localhost:5000/api/sales/${targetSaleId}`, updatedSale);
    }
  };

  const updateDesignTaskSchedule = async (taskId: string, nextValue: string) => {
    const task = designTasks.find(item => item.id === taskId);
    if (!task) {
      throw new Error('Design task not found');
    }
    const payload = {
      ...task,
      startAt: nextValue
    };
    await axios.put(`http://localhost:5000/api/designs/${taskId}`, payload);
  };

  const updatePaintingTaskSchedule = async (taskId: string, nextValue: string) => {
    const task = paintingTasks.find(item => item.id === taskId);
    if (!task) {
      throw new Error('Painting task not found');
    }
    const payload = {
      ...task,
      startAt: nextValue
    };
    await axios.put(`http://localhost:5000/api/paintings/${taskId}`, payload);
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

    const entityType = extended.entityType as 'design' | 'painting' | undefined;
    const typeLabel = entityType === 'design' ? 'Design' : entityType === 'painting' ? 'Pintura' : 'Servico';
    const description = extended.description || event.title || 'Servico';
    const start = event.start ? new Date(event.start) : new Date();
    const duration = Number(extended.durationHours) || 0;
    const end = event.end ? new Date(event.end) : duration > 0 ? addHours(start, duration) : start;
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
      responsible: extended.responsible || undefined,
      value: typeof extended.value === 'number' ? extended.value : undefined,
      saleId: extended.saleId,
      taskType: entityType,
      taskId: extended.taskId
    });
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
    if (!event) {
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

    const nextValue = start.toISOString();
    const entityType = extended.entityType as 'design' | 'painting' | undefined;

    try {
      if (entityType === 'design') {
        const targetSaleId = extended.saleId as string | undefined;
        const targetTaskId = extended.taskId as string | undefined;
        if (targetSaleId) {
          await updateSaleDesignSchedule(targetSaleId, nextValue);
          await fetchServiceSales();
          return;
        }
        if (targetTaskId) {
          await updateDesignTaskSchedule(targetTaskId, nextValue);
          await fetchDesignTasks();
          if (editingTaskId === targetTaskId) {
            setTaskForm(prev => ({ ...prev, startAt: nextValue }));
          }
          return;
        }
      }

      if (entityType === 'painting') {
        const targetSaleId = extended.saleId as string | undefined;
        const targetTaskId = extended.taskId as string | undefined;
        if (targetSaleId) {
          await updateSalePaintSchedule(targetSaleId, nextValue);
          await fetchServiceSales();
          return;
        }
        if (targetTaskId) {
          await updatePaintingTaskSchedule(targetTaskId, nextValue);
          await fetchPaintingTasks();
          if (editingPaintingId === targetTaskId) {
            setPaintingForm(prev => ({ ...prev, startAt: nextValue }));
          }
          return;
        }
      }
    } catch (error) {
      console.error('Error moving schedule item', error);
      info.revert();
      await showAlert('Erro', 'Nao foi possivel mover o horario.', 'error');
      return;
    }

    info.revert();
  };

  const handleHoverEdit = () => {
    if (!hoverCard) return;
    if (hoverCard.saleId) {
      router.push(`/sales/${hoverCard.saleId}`);
      return;
    }
    if (hoverCard.taskType === 'design' && hoverCard.taskId) {
      const task = designTasks.find(item => item.id === hoverCard.taskId);
      if (task) {
        handleTaskEdit(task);
      }
      return;
    }
    if (hoverCard.taskType === 'painting' && hoverCard.taskId) {
      const task = paintingTasks.find(item => item.id === hoverCard.taskId);
      if (task) {
        handlePaintingEdit(task);
      }
    }
  };

  const handleTaskResponsibleChange = (value: string) => {
    const selected = designerProviders.find(provider => provider.id === value);
    setTaskForm(prev => ({
      ...prev,
      responsibleId: selected?.id || '',
      responsibleName: selected?.name || ''
    }));
  };

  const serviceEvents = useMemo(() => {
    const list: any[] = [];

    serviceSales.forEach(sale => {
      if (sale.designStartConfirmedAt) {
        const duration = Math.max(Number(sale.designTimeHours) || 0, 0);
        if (duration > 0) {
          const start = new Date(sale.designStartConfirmedAt);
          const responsible = sale.designResponsible ? ` - ${sale.designResponsible}` : '';
          list.push({
            id: `sale-design-${sale.id}`,
            title: `Design - ${sale.description || 'Venda'}${responsible}`,
            start,
            end: addHours(start, duration),
            color: '#0ea5e9',
            extendedProps: {
              entityType: 'design',
              saleId: sale.id,
              description: sale.description || 'Venda',
              responsible: sale.designResponsible || null,
              durationHours: duration,
              value: typeof sale.designValue === 'number' ? sale.designValue : null
            }
          });
        }
      }

      if (sale.paintStartConfirmedAt) {
        const duration = Math.max(Number(sale.paintTimeHours) || 0, 0);
        if (duration > 0) {
          const start = new Date(sale.paintStartConfirmedAt);
          const responsible = sale.paintResponsible ? ` - ${sale.paintResponsible}` : '';
          list.push({
            id: `sale-paint-${sale.id}`,
            title: `Pintura - ${sale.description || 'Venda'}${responsible}`,
            start,
            end: addHours(start, duration),
            color: '#6366f1',
            extendedProps: {
              entityType: 'painting',
              saleId: sale.id,
              description: sale.description || 'Venda',
              responsible: sale.paintResponsible || null,
              durationHours: duration
            }
          });
        }
      }
    });

    designTasks.forEach(task => {
      if (!task.startAt) return;
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
          description: task.title,
          responsible: task.responsibleName || null,
          durationHours: duration,
          value: typeof task.value === 'number' ? task.value : null
        }
      });
    });

    paintingTasks.forEach(task => {
      if (!task.startAt) return;
      const duration = Math.max(Number(task.durationHours) || 0, 0);
      if (duration <= 0) return;
      const start = new Date(task.startAt);
      const responsible = task.responsibleName ? ` - ${task.responsibleName}` : '';
      list.push({
        id: `painting-task-${task.id}`,
        title: `Pintura - ${task.title}${responsible}`,
        start,
        end: addHours(start, duration),
        color: '#8b5cf6',
        extendedProps: {
          entityType: 'painting',
          taskId: task.id,
          description: task.title,
          responsible: task.responsibleName || null,
          durationHours: duration,
          value: typeof task.value === 'number' ? task.value : null
        }
      });
    });

    if (taskForm.startAt && taskForm.durationHours > 0) {
      const start = new Date(taskForm.startAt);
      const responsible = taskForm.responsibleName ? ` - ${taskForm.responsibleName}` : '';
      list.push({
        id: 'design-selected',
        title: `Design - ${taskForm.title || 'Selecionado'}${responsible}`,
        start,
        end: addHours(start, Number(taskForm.durationHours) || 0),
        color: '#22c55e',
        editable: false,
        extendedProps: {
          isTransient: true
        }
      });
    }

    if (paintingForm.startAt && paintingForm.durationHours > 0) {
      const start = new Date(paintingForm.startAt);
      const responsible = paintingForm.responsibleName ? ` - ${paintingForm.responsibleName}` : '';
      list.push({
        id: 'painting-selected',
        title: `Pintura - ${paintingForm.title || 'Selecionado'}${responsible}`,
        start,
        end: addHours(start, Number(paintingForm.durationHours) || 0),
        color: '#6366f1',
        editable: false,
        extendedProps: {
          isTransient: true
        }
      });
    }

    return list;
  }, [
    serviceSales,
    designTasks,
    paintingTasks,
    taskForm.startAt,
    taskForm.durationHours,
    taskForm.title,
    taskForm.responsibleName,
    paintingForm.startAt,
    paintingForm.durationHours,
    paintingForm.title,
    paintingForm.responsibleName
  ]);

  const sortedProviders = useMemo(
    () => [...providers].sort((a, b) => a.name.localeCompare(b.name)),
    [providers]
  );

  const sortedTasks = useMemo(
    () => [...designTasks].sort((a, b) => (a.startAt || '').localeCompare(b.startAt || '')),
    [designTasks]
  );
  const sortedPaintingTasks = useMemo(
    () => [...paintingTasks].sort((a, b) => (a.startAt || '').localeCompare(b.startAt || '')),
    [paintingTasks]
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b-2 border-brand-orange pb-4">
        <h1 className="text-3xl font-bold text-brand-purple">Servicos</h1>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)] gap-6">
        <div className="space-y-6">
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Prestadores de Servico</h2>
                <p className="text-sm text-gray-500">Cadastre designers e pintores.</p>
              </div>
            </div>

            <form onSubmit={handleProviderSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Nome</label>
                <input
                  type="text"
                  value={providerForm.name}
                  onChange={(event) => setProviderForm(prev => ({ ...prev, name: event.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
                />
              </div>
              <div data-tag-dropdown>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Tags</label>
                <button
                  type="button"
                  onClick={() => setIsTagMenuOpen(prev => !prev)}
                  className="w-full flex items-center justify-between gap-2 border border-gray-300 rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:border-brand-purple"
                >
                  <div className="flex flex-wrap gap-2">
                    {providerForm.categories.length === 0 && (
                      <span className="text-gray-400">Selecione tags...</span>
                    )}
                    {providerForm.categories.map(tag => (
                      <span
                        key={tag}
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTagStyle(tag, true)}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>
                {isTagMenuOpen && (
                  <div className="mt-2 border border-gray-200 rounded-lg bg-white shadow-lg p-3 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {availableTags.map(tag => {
                        const active = providerForm.categories.some(item => normalizeTag(item) === normalizeTag(tag));
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full transition-transform duration-150 hover:scale-105 active:scale-95 ${getTagStyle(tag, active)}`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                    <div className="border-t border-gray-100 pt-3">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Nova tag</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newTagName}
                          onChange={(event) => setNewTagName(event.target.value)}
                          placeholder="Ex: acabamento"
                          className="flex-1 p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-purple focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={handleAddTag}
                          className="px-3 py-2 bg-brand-purple text-white rounded-lg text-xs font-semibold hover:bg-purple-800"
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-purple text-white rounded-lg hover:bg-purple-800 transition-colors text-sm font-semibold"
                >
                  {editingProviderId ? 'Atualizar' : 'Cadastrar'}
                </button>
                {editingProviderId && (
                  <button
                    type="button"
                    onClick={resetProviderForm}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            <div className="mt-5 space-y-2">
              {sortedProviders.length === 0 && (
                <p className="text-sm text-gray-500">Nenhum prestador cadastrado.</p>
              )}
              {sortedProviders.map(provider => (
                <div key={provider.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{provider.name}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {(provider.categories && provider.categories.length > 0
                        ? provider.categories
                        : provider.category
                        ? [provider.category]
                        : []
                      ).map(tag => (
                        <span
                          key={`${provider.id}-${tag}`}
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTagStyle(tag, false)}`}
                        >
                          {tag}
                        </span>
                      ))}
                      {(!provider.categories || provider.categories.length === 0) && !provider.category && (
                        <span className="text-xs text-gray-400">Sem tags</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleProviderEdit(provider)}
                      className="text-xs text-brand-purple hover:text-purple-900 font-semibold"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleProviderDelete(provider.id)}
                      className="text-xs text-red-600 hover:text-red-800 font-semibold"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Agendamento de servicos</h2>
                <p className="text-sm text-gray-500">Gerencie design e pintura no mesmo fluxo.</p>
              </div>
              <div className="flex items-center rounded-full border border-gray-200 bg-gray-50 p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setCalendarTarget('design')}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    calendarTarget === 'design'
                      ? 'bg-white text-sky-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Design
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarTarget('painting')}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    calendarTarget === 'painting'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Pintura
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-6">
              <div className="relative">
                <div className="relative min-h-[520px] md:min-h-[360px]">
                  <div
                    className={`absolute inset-0 transition-all duration-300 ${
                      calendarTarget === 'design'
                        ? 'opacity-100 translate-x-0'
                        : 'opacity-0 -translate-x-4 pointer-events-none'
                    }`}
                  >
                    <form onSubmit={handleTaskSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Titulo</label>
                        <input
                          type="text"
                          value={taskForm.title}
                          onChange={(event) => setTaskForm(prev => ({ ...prev, title: event.target.value }))}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Responsavel</label>
                        <select
                          value={taskForm.responsibleId}
                          onChange={(event) => handleTaskResponsibleChange(event.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
                        >
                          <option value="">Selecione...</option>
                          {!hasTaskResponsibleOption && taskForm.responsibleId && (
                            <option value={taskForm.responsibleId}>
                              {taskForm.responsibleName || 'Responsavel atual'}
                            </option>
                          )}
                          {designerProviders.map(provider => (
                            <option key={provider.id} value={provider.id}>
                              {provider.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Duracao (h)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={taskForm.durationHours}
                          onChange={(event) => setTaskForm(prev => ({ ...prev, durationHours: Number(event.target.value) }))}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Valor (R$)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={taskForm.value}
                          onChange={(event) => setTaskForm(prev => ({ ...prev, value: Number(event.target.value) }))}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Horario</label>
                        <input
                          type="datetime-local"
                          value={toLocalInputValue(taskForm.startAt)}
                          onChange={(event) => setTaskForm(prev => ({ ...prev, startAt: fromLocalInputValue(event.target.value) }))}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
                        />
                      </div>
                      <div className="md:col-span-2 flex items-center gap-3">
                        <button
                          type="submit"
                          className="px-4 py-2 bg-brand-purple text-white rounded-lg hover:bg-purple-800 transition-colors text-sm font-semibold"
                        >
                          {editingTaskId ? 'Atualizar' : 'Agendar'}
                        </button>
                        {editingTaskId && (
                          <button
                            type="button"
                            onClick={resetTaskForm}
                            className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:text-gray-800"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </form>
                  </div>

                  <div
                    className={`absolute inset-0 transition-all duration-300 ${
                      calendarTarget === 'painting'
                        ? 'opacity-100 translate-x-0'
                        : 'opacity-0 translate-x-4 pointer-events-none'
                    }`}
                  >
                    <form onSubmit={handlePaintingSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Titulo</label>
                        <input
                          type="text"
                          value={paintingForm.title}
                          onChange={(event) => setPaintingForm(prev => ({ ...prev, title: event.target.value }))}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Responsavel</label>
                        <select
                          value={paintingForm.responsibleId}
                          onChange={(event) => handlePaintingResponsibleChange(event.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
                        >
                          <option value="">Selecione...</option>
                          {!hasPaintingResponsibleOption && paintingForm.responsibleId && (
                            <option value={paintingForm.responsibleId}>
                              {paintingForm.responsibleName || 'Responsavel atual'}
                            </option>
                          )}
                          {painterProviders.map(provider => (
                            <option key={provider.id} value={provider.id}>
                              {provider.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Duracao (h)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={paintingForm.durationHours}
                          onChange={(event) => setPaintingForm(prev => ({ ...prev, durationHours: Number(event.target.value) }))}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Valor (R$)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={paintingForm.value}
                          onChange={(event) => setPaintingForm(prev => ({ ...prev, value: Number(event.target.value) }))}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Horario</label>
                        <input
                          type="datetime-local"
                          value={toLocalInputValue(paintingForm.startAt)}
                          onChange={(event) => setPaintingForm(prev => ({ ...prev, startAt: fromLocalInputValue(event.target.value) }))}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
                        />
                      </div>
                      <div className="md:col-span-2 flex items-center gap-3">
                        <button
                          type="submit"
                          className="px-4 py-2 bg-brand-purple text-white rounded-lg hover:bg-purple-800 transition-colors text-sm font-semibold"
                        >
                          {editingPaintingId ? 'Atualizar' : 'Agendar'}
                        </button>
                        {editingPaintingId && (
                          <button
                            type="button"
                            onClick={resetPaintingForm}
                            className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:text-gray-800"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                </div>

                <div className="mt-4 text-xs text-amber-600 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                  </svg>
                  Clique na agenda ao lado para escolher o horario.
                </div>
              </div>

              <div className="relative">
                <div className="relative">
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
                    selectable={isCalendarReady}
                    selectMirror
                    dayMaxEvents
                    editable
                    eventDurationEditable={false}
                    slotMinTime="00:00:00"
                    slotMaxTime="24:00:00"
                    events={serviceEvents}
                    dateClick={isCalendarReady ? handleTaskDateClick : undefined}
                    eventDragStart={handleEventDragStart}
                    eventDragStop={handleEventDragStop}
                    eventDrop={handleEventDrop}
                    eventMouseEnter={handleEventMouseEnter}
                    eventMouseLeave={handleEventMouseLeave}
                  />
                  {!isCalendarReady && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/70 backdrop-blur-sm">
                      <div className="max-w-sm rounded-lg border border-gray-200 bg-white/80 px-4 py-3 text-center shadow-sm">
                        <p className="text-sm font-semibold text-gray-700">Agenda bloqueada</p>
                        <p className="mt-1 text-xs text-gray-600">{calendarBlockMessage}</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-4 text-xs text-gray-500">
                  {loading ? 'Carregando agenda...' : 'Agenda geral de servicos (design e pintura).'}
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-3">Designs agendados</h3>
                <div className="space-y-2">
                  {sortedTasks.length === 0 && (
                    <p className="text-sm text-gray-500">Nenhum design agendado.</p>
                  )}
                  {sortedTasks.map(task => (
                    <div key={task.id} className="border border-gray-100 rounded-lg px-3 py-2 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{task.title}</p>
                        <p className="text-xs text-gray-500">
                          {task.startAt ? new Date(task.startAt).toLocaleString('pt-BR') : '--'} - {task.durationHours || 0}h
                          {task.responsibleName || providers.find(provider => provider.id === task.responsibleId)?.name
                            ? ` - ${task.responsibleName || providers.find(provider => provider.id === task.responsibleId)?.name}`
                            : ''}
                          {typeof task.value === 'number' && task.value > 0 ? ` - R$ ${task.value.toFixed(2)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleTaskEdit(task)}
                          className="text-xs text-brand-purple hover:text-purple-900 font-semibold"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTaskDelete(task.id)}
                          className="text-xs text-red-600 hover:text-red-800 font-semibold"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-3">Pinturas agendadas</h3>
                <div className="space-y-2">
                  {sortedPaintingTasks.length === 0 && (
                    <p className="text-sm text-gray-500">Nenhuma pintura agendada.</p>
                  )}
                  {sortedPaintingTasks.map(task => (
                    <div key={task.id} className="border border-gray-100 rounded-lg px-3 py-2 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{task.title}</p>
                        <p className="text-xs text-gray-500">
                          {task.startAt ? new Date(task.startAt).toLocaleString('pt-BR') : '--'} - {task.durationHours || 0}h
                          {task.responsibleName || providers.find(provider => provider.id === task.responsibleId)?.name
                            ? ` - ${task.responsibleName || providers.find(provider => provider.id === task.responsibleId)?.name}`
                            : ''}
                          {typeof task.value === 'number' && task.value > 0 ? ` - R$ ${task.value.toFixed(2)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handlePaintingEdit(task)}
                          className="text-xs text-brand-purple hover:text-purple-900 font-semibold"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePaintingDelete(task.id)}
                          className="text-xs text-red-600 hover:text-red-800 font-semibold"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
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
                {(hoverCard.saleId || hoverCard.taskId) && (
                  <button
                    type="button"
                    onClick={handleHoverEdit}
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
