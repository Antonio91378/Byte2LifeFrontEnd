'use client';

import { DETAIL_LEVELS } from '@/constants/printQuality';
import PrintScheduleCalendar from '@/components/PrintScheduleCalendar';
import { useDialog } from '@/context/DialogContext';
import { parseDurationToHours } from '@/utils/time';
import axios from 'axios';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

interface Filament {
  id: string;
  description: string;
  color: string;
  remainingMassGrams: number;
}

interface Client {
  id: string;
  name: string;
  phoneNumber: string;
}

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
  const stockId = searchParams.get('stockId');
  const { showAlert } = useDialog();

  const parseMassGrams = (value: string | number) => {
    const normalized = String(value ?? '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    description: '',
    productLink: '',
    printQuality: 'Normal',
    massGrams: 0,
    cost: 0,
    saleValue: 0,
    profit: 0,
    profitPercentage: '',
    designPrintTime: '',
    printStatus: 'InQueue',
    isPrintConcluded: false,
    isDelivered: false,
    isPaid: false,
    filamentId: '',
    clientId: '',
    saleDate: new Date().toISOString().split('T')[0],
    deliveryDate: '',
    hasCustomArt: false,
    hasPainting: false,
    hasVarnish: false,
    paintTimeHours: 0,
    paintResponsible: '',
    paintStartConfirmedAt: '',
    productionCost: 0,
    nozzleDiameter: '',
    layerHeight: '',
    printStartConfirmedAt: '',
    costDetails: null as any
  });

  const buildReturnToSalesUrl = () => {
    if (!searchParams) {
      return '/sales';
    }
    const params = new URLSearchParams();
    const filterType = searchParams.get('filterType');
    if (filterType === 'date' || filterType === 'month') {
      params.set('filterType', filterType);
    }
    const filterDate = searchParams.get('filterDate');
    if (filterDate) {
      params.set('filterDate', filterDate);
    }
    const filterClientId = searchParams.get('filterClientId');
    if (filterClientId) {
      params.set('filterClientId', filterClientId);
    }
    const filterUnpaid = searchParams.get('filterUnpaid');
    if (filterUnpaid === '1') {
      params.set('filterUnpaid', '1');
    }
    const filterUndelivered = searchParams.get('filterUndelivered');
    if (filterUndelivered === '1') {
      params.set('filterUndelivered', '1');
    }
    const query = params.toString();
    return query ? `/sales?${query}` : '/sales';
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [filamentsRes, clientsRes] = await Promise.all([
          axios.get('http://localhost:5000/api/filaments'),
          axios.get('http://localhost:5000/api/clients')
        ]);
        setFilaments(filamentsRes.data);
        setClients(clientsRes.data);

        // If coming from stock, fetch stock details
        if (stockId) {
          const stockRes = await axios.get(`http://localhost:5000/api/stock/${stockId}`);
          const stockItem = stockRes.data;
          
          // Map old quality values
          let quality = stockItem.printQuality || 'Normal';
          if (quality === 'Draft') quality = 'Baixo';
          if (quality === 'Standard') quality = 'Normal';
          if (quality === 'High') quality = 'Alto';
          if (quality === 'Ultra') quality = 'Extremo';

          setFormData(prev => ({
            ...prev,
            description: stockItem.description,
            filamentId: stockItem.filamentId,
            massGrams: stockItem.weightGrams,
            cost: stockItem.cost, // This might be overwritten by calculation, but that's fine as it should match
            designPrintTime: stockItem.printTime,
            printQuality: quality,
            printStatus: 'Concluded', // Stock items are already printed
            isPrintConcluded: true,
            hasCustomArt: stockItem.hasCustomArt || false,
            hasPainting: stockItem.hasPainting || false,
            hasVarnish: stockItem.hasVarnish || false
          }));
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, [stockId]);

  const massGramsValue = parseMassGrams(formData.massGrams);

  const filteredFilaments = massGramsValue > 0
    ? filaments.filter(filament => filament.remainingMassGrams >= massGramsValue)
    : [];

  useEffect(() => {
    if (formData.filamentId === '') return;
    const selected = filaments.find(filament => filament.id === formData.filamentId);
    if (!selected || massGramsValue <= 0 || selected.remainingMassGrams < massGramsValue) {
      setFormData(prev => ({ ...prev, filamentId: '' }));
    }
  }, [massGramsValue, formData.filamentId, filaments]);

  // Calculate cost and suggested price automatically
  useEffect(() => {
    const calculatePrice = async () => {
      const isValidFilamentId = typeof formData.filamentId === 'string' && formData.filamentId.length === 24;
      if (!isValidFilamentId || massGramsValue <= 0) return;

      const hours = parseDurationToHours(formData.designPrintTime);
      const level = DETAIL_LEVELS.find(l => l.label === formData.printQuality)?.value ?? 1;

      try {
        const res = await axios.post('http://localhost:5000/api/budget/calculate', {
          filamentId: formData.filamentId,
          detailLevel: level,
          massGrams: massGramsValue,
          hasCustomArt: formData.hasCustomArt,
          hasPainting: formData.hasPainting,
          hasVarnish: formData.hasVarnish,
          printTimeHours: hours > 0 ? hours : undefined,
          nozzleDiameter: formData.nozzleDiameter,
          layerHeight: formData.layerHeight
        });

        setFormData(prev => ({
          ...prev,
          cost: res.data.materialCost, // Keep using material cost for "Custo Material" field if that's what it means, OR switch to TotalProductionCost
          productionCost: res.data.totalProductionCost,
          saleValue: res.data.totalPrice,
          nozzleDiameter: res.data.nozzleDiameter,
          layerHeight: res.data.layerHeightRange,
          costDetails: {
            breakdown: res.data.breakdown,
            materialCost: res.data.materialCost,
            energyCost: res.data.energyCost,
            machineCost: res.data.machineCost
          }
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
    formData.layerHeight
  ]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => {
        if (name === 'paintTimeHours') {
          return { ...prev, paintTimeHours: Number(value) };
        }
        return { ...prev, [name]: value };
      });
    }
  };

  // Auto-calculate profit (UI only, based on current form values)
  useEffect(() => {
    const profit = Number(formData.saleValue) - Number(formData.cost);
    const profitPercent = formData.cost > 0 ? ((profit / Number(formData.cost)) * 100).toFixed(2) + '%' : '0%';
    
    setFormData(prev => ({
      ...prev,
      profit: profit,
      profitPercentage: profitPercent
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
        deliveryDate: formData.deliveryDate === '' ? null : formData.deliveryDate,
        printStartConfirmedAt: formData.printStartConfirmedAt === '' ? null : formData.printStartConfirmedAt,
        paintStartConfirmedAt: formData.paintStartConfirmedAt === '' ? null : formData.paintStartConfirmedAt,
        paintTimeHours: Number(formData.paintTimeHours) || 0,
        paintResponsible: formData.paintResponsible || '',
        filamentId: formData.filamentId && formData.filamentId.length === 24 ? formData.filamentId : null,
        clientId: formData.clientId && formData.clientId.length === 24 ? formData.clientId : null,
        stockItemId: stockId || null
      };
      await axios.post('http://localhost:5000/api/sales', payload);
      
      // If it came from stock, update stock status to Sold
      if (stockId) {
        try {
          const stockRes = await axios.get(`http://localhost:5000/api/stock/${stockId}`);
          await axios.put(`http://localhost:5000/api/stock/${stockId}`, {
            ...stockRes.data,
            status: 'Sold'
          });
        } catch (err) {
          console.error("Error updating stock status", err);
        }
      }

      router.push(buildReturnToSalesUrl());
    } catch (error) {
      console.error('Error creating sale:', error);
      await showAlert('Erro', 'Erro ao criar venda', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-0">
      <h1 className="text-3xl font-bold text-brand-purple mb-8 border-b-2 border-brand-orange pb-4">Nova Venda</h1>
      
      <form onSubmit={handleSubmit} className="bg-white p-4 md:p-8 rounded-xl shadow-sm border border-gray-100 space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Description */}
          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição do Produto</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Massa (g)</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Filamento</label>
            <select
              name="filamentId"
              value={formData.filamentId}
              onChange={handleChange}
              disabled={formData.massGrams <= 0}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900 disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="">
                {formData.massGrams > 0 ? 'Selecione um filamento...' : 'Informe a massa para listar filamentos'}
              </option>
              {filteredFilaments.map(filament => (
                <option key={filament.id} value={filament.id}>
                  {filament.description} ({filament.color}) - {filament.remainingMassGrams}g
                </option>
              ))}
            </select>
          </div>

          {/* Sale Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data da Venda</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Data de Entrega</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Tempo de Impressão</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Adicionais</label>
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

          {formData.hasPainting && (
            <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Responsavel pela Pintura</label>
                <input
                  type="text"
                  name="paintResponsible"
                  value={formData.paintResponsible}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
                  placeholder="Ex: Maria"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tempo de Pintura (h)</label>
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
              hasPainting={formData.hasPainting}
              showPainting={formData.hasPainting}
              value={formData.printStartConfirmedAt}
              onChange={(value) => setFormData(prev => ({ ...prev, printStartConfirmedAt: value || '' }))}
              paintHours={Number(formData.paintTimeHours) || 0}
              paintValue={formData.paintStartConfirmedAt}
              onPaintChange={(value) => setFormData(prev => ({ ...prev, paintStartConfirmedAt: value || '' }))}
              paintResponsible={formData.paintResponsible}
            />
          </div>

          {/* Client */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
            <select
              name="clientId"
              value={formData.clientId}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
            >
              <option value="">Selecione um cliente...</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name || client.phoneNumber}
                </option>
              ))}
            </select>
          </div>

          {/* Product Link */}
          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Link do Produto (STL)</label>
            <input
              type="url"
              name="productLink"
              value={formData.productLink ?? ''}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
            />
          </div>

          {/* Print Quality */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Qualidade de Impressão</label>
            <select
              name="printQuality"
              value={formData.printQuality}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
            >
              {DETAIL_LEVELS.map(level => (
                <option key={level.value} value={level.label}>{level.label}</option>
              ))}
            </select>
          </div>

          {/* Print Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status da Impressão</label>
            <select
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

{/* Cost Details */}
          <div className="col-span-1 md:col-span-2 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
              Detalhamento de Custos
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                <span className="block text-xs text-gray-500 uppercase font-bold mb-1">Custo de Produção</span>
                <span className="text-lg font-bold text-gray-800">
                  R$ {(formData.productionCost || 0).toFixed(2)}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                <span className="block text-xs text-gray-500 uppercase font-bold mb-1">Nozzle</span>
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
                <span className="block text-xs text-gray-500 uppercase font-bold mb-1">Camada</span>
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
                  <span className="font-medium">R$ {(formData.costDetails.materialCost || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-600 border-b border-gray-200 pb-2">
                  <span>Energia</span>
                  <span className="font-medium">R$ {(formData.costDetails.energyCost || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-600 border-b border-gray-200 pb-2">
                  <span>Máquina (Depreciação)</span>
                  <span className="font-medium">R$ {(formData.costDetails.machineCost || 0).toFixed(2)}</span>
                </div>
                
                <div className="mt-3 pt-2">
                  <p className="text-xs font-bold text-gray-700 mb-1">Cálculo da Margem:</p>
                  <pre className="text-[10px] text-gray-500 whitespace-pre-wrap font-mono bg-white p-2 rounded border border-gray-100">
                    {formData.costDetails.breakdown}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Sale Value & Profit */}
          <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor de Venda (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">R$</span>
                <input
                  type="number"
                  name="saleValue"
                  step="0.01"
                  value={formData.saleValue}
                  onChange={handleChange}
                  className="w-full pl-10 p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900 text-lg font-bold text-green-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lucro Estimado</label>
              <div className={`p-3 rounded-xl border flex justify-between items-center ${formData.profit >= 0 ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
                <span className="font-bold text-lg">R$ {formData.profit.toFixed(2)}</span>
                <span className="text-sm font-medium bg-white/50 px-2 py-1 rounded-lg">
                  {formData.profitPercentage}
                </span>
              </div>
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
            {loading ? 'Salvando...' : 'Salvar Venda'}
          </button>
        </div>

      </form>
    </div>
  );
}

