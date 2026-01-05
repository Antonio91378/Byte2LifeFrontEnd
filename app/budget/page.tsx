'use client';

import { DETAIL_LEVELS } from '@/constants/printQuality';
import axios from 'axios';
import PrintScheduleCalendar from '@/components/PrintScheduleCalendar';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Filament {
  id: string;
  description: string;
  color: string;
  price: number;
  warningComment?: string;
  slicingProfile3mfPath?: string;
}

interface BudgetResult {
  materialCost: number;
  energyCost: number;
  machineCost: number;
  totalProductionCost: number;
  profitMarginPercentage: number;
  profitValue: number;
  totalPrice: number;
  breakdown: string;
  nozzleDiameter: string;
  layerHeightRange: string;
  estimatedTimeHours: number;
}

export default function BudgetPage() {
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  
  const [formData, setFormData] = useState({
    filamentId: '',
    detailLevel: 1, // Normal default
    massGrams: '',
    hasCustomArt: false,
    hasPainting: false,
    hasVarnish: false,
    printTimeHours: '',
    nozzleDiameter: '',
    layerHeight: ''
  });

  const [result, setResult] = useState<BudgetResult | null>(null);
  const selectedFilament = filaments.find(f => f.id === formData.filamentId);
  const warningDetails = [selectedFilament?.warningComment?.trim(), selectedFilament?.slicingProfile3mfPath?.trim() ? `3MF: ${selectedFilament.slicingProfile3mfPath.trim()}` : '']
    .filter(Boolean)
    .join(' | ');
  const hasWarning = Boolean(warningDetails);

  useEffect(() => {
    axios.get('http://localhost:5000/api/filaments')
      .then(res => {
        setFilaments(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const calculateBudget = async (data = formData) => {
    if (!data.filamentId || !data.massGrams) return;
    
    setCalculating(true);
    try {
      const payload = {
        filamentId: data.filamentId,
        detailLevel: Number(data.detailLevel),
        massGrams: Number(data.massGrams),
        hasCustomArt: data.hasCustomArt,
        hasPainting: data.hasPainting,
        hasVarnish: data.hasVarnish,
        printTimeHours: data.printTimeHours ? Number(data.printTimeHours) : undefined,
        nozzleDiameter: data.nozzleDiameter,
        layerHeight: data.layerHeight
      };

      const response = await axios.post('http://localhost:5000/api/budget/calculate', payload);
      setResult(response.data);
      
      // Update form data with calculated defaults if they were empty
      setFormData(prev => ({
        ...prev,
        printTimeHours: prev.printTimeHours || String(response.data.estimatedTimeHours),
        nozzleDiameter: prev.nozzleDiameter || response.data.nozzleDiameter,
        layerHeight: prev.layerHeight || response.data.layerHeightRange
      }));
    } catch (error) {
      console.error('Error calculating budget:', error);
    } finally {
      setCalculating(false);
    }
  };

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    calculateBudget();
  };

  // Dynamic recalculation when technical fields change
  const handleTechnicalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const newData = { ...formData, [name]: value };
    setFormData(newData);
    
    // Debounce calculation
    const timeoutId = setTimeout(() => {
      if (result) { // Only recalculate if we already have a result (user is editing)
        calculateBudget(newData);
      }
    }, 800);
    return () => clearTimeout(timeoutId);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Simulação de Orçamento</h1>
            <p className="text-gray-600 mt-2">Calcule o valor de venda baseado em parâmetros técnicos.</p>
          </div>
          <Link href="/" className="text-brand-purple hover:text-purple-800 font-medium flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            Voltar
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-10">
          {/* Form Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <form onSubmit={handleCalculate} className="space-y-6">
              
              {/* Filament Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Filamento</label>
                <select
                  required
                  value={formData.filamentId}
                  onChange={(e) => setFormData({...formData, filamentId: e.target.value})}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-gray-900"
                >
                  <option value="" className="text-gray-500">Selecione um filamento...</option>
                  {filaments.map(f => (
                    <option key={f.id} value={f.id} className="text-gray-900">
                      {f.description} ({f.color}) - R$ {f.price.toFixed(2)}/kg
                    </option>
                  ))}
                </select>
                {hasWarning && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-yellow-700">
                    <span
                      className="text-yellow-500"
                      title={warningDetails}
                      aria-label="Filamento com ressalvas de fatiamento"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                      </svg>
                    </span>
                    <span className="text-gray-600">Filamento exige cuidados de fatiamento.</span>
                  </div>
                )}
              </div>

              {/* Detail Level Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nível de Detalhamento</label>
                <div className="grid grid-cols-1 gap-3">
                  {DETAIL_LEVELS.map((level) => (
                    <div 
                      key={level.value}
                      className={`relative flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                        formData.detailLevel === level.value 
                          ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-500' 
                          : 'border-gray-200 hover:border-teal-300'
                      }`}
                      onClick={() => setFormData({...formData, detailLevel: level.value, nozzleDiameter: '', layerHeight: ''})}
                    >
                      <input
                        type="radio"
                        name="detailLevel"
                        value={level.value}
                        checked={formData.detailLevel === level.value}
                        onChange={() => {}}
                        className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300"
                      />
                      <span className="ml-3 font-medium text-gray-900">{level.label}</span>
                      
                      {/* Info Icon with Tooltip */}
                      <div className="ml-auto group relative">
                        <svg className="w-5 h-5 text-gray-400 hover:text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                          {level.info}
                          <div className="absolute top-full right-2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {/* Mass Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Massa (g)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.1"
                    value={formData.massGrams}
                    onChange={(e) => setFormData({...formData, massGrams: e.target.value})}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-gray-900 placeholder-gray-500"
                    placeholder="Ex: 150"
                  />
                </div>
              </div>

              {/* Additional Flags */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <label className="block text-sm font-medium text-gray-700 mb-2">Adicionais</label>
                
                <label className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.hasCustomArt}
                    onChange={(e) => setFormData({...formData, hasCustomArt: e.target.checked})}
                    className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-900">Arte Personalizada</span>
                  <span className="ml-auto text-xs text-teal-600 font-bold">+1200%</span>
                </label>

                <label className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.hasPainting}
                    onChange={(e) => setFormData({...formData, hasPainting: e.target.checked})}
                    className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-900">Pintura</span>
                  <span className="ml-auto text-xs text-teal-600 font-bold">+50%</span>
                </label>

                <label className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.hasVarnish}
                    onChange={(e) => setFormData({...formData, hasVarnish: e.target.checked})}
                    className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-900">Verniz</span>
                  <span className="ml-auto text-xs text-teal-600 font-bold">+30%</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={calculating || !formData.filamentId}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {calculating ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Calculando...
                  </>
                ) : (
                  'Calcular Orçamento'
                )}
              </button>
            </form>
          </div>

          {/* Result Section */}
          <div className="space-y-6 min-w-0">
            {result ? (
              <div className="space-y-6">
                {/* Sale Price Card */}
                <div className="bg-white rounded-2xl shadow-lg border border-teal-100 overflow-hidden">
                  <div className="bg-teal-600 p-6 text-white text-center">
                    <p className="text-teal-100 text-sm font-medium uppercase tracking-wider mb-1">Valor Sugerido de Venda</p>
                    <h2 className="text-5xl font-extrabold">
                      {result.totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </h2>
                  </div>
                  
                  <div className="p-6">
                    <div className="flex justify-between items-center py-3 border-b border-gray-100">
                      <span className="text-gray-600">Margem de Lucro</span>
                      <div className="text-right">
                        <span className="block font-semibold text-teal-600">
                          {result.profitMarginPercentage.toFixed(0)}%
                        </span>
                        <span className="text-xs text-gray-400">
                          {result.profitValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Production Cost Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 p-4 border-b border-gray-200">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-bold text-gray-800">Custo de Produção</h3>
                      <span className="text-xl font-bold text-gray-900">
                        {result.totalProductionCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  </div>
                  <div className="p-6 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                        Material (Filamento)
                      </span>
                      <span className="font-medium text-gray-900">
                        {result.materialCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                        Energia Elétrica
                      </span>
                      <span className="font-medium text-gray-900">
                        {result.energyCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-400"></span>
                        Depreciação Máquina
                      </span>
                      <span className="font-medium text-gray-900">
                        {result.machineCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  </div>
                </div>

              {/* Technical Details Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-sm font-bold text-gray-900 mb-4">Detalhes Técnicos (Editável)</h3>
                  <div className="grid grid-cols-3 gap-4 pb-4 border-b border-gray-100">
                    <div className="bg-gray-50 p-3 rounded-lg text-center">
                      <p className="text-xs text-gray-500 uppercase font-bold mb-1">Nozzle</p>
                      <input 
                        type="text"
                        name="nozzleDiameter"
                        value={formData.nozzleDiameter}
                        onChange={handleTechnicalChange}
                        className="w-full text-center text-sm font-bold text-gray-800 bg-transparent border-b border-gray-300 focus:border-teal-500 focus:outline-none"
                        placeholder="0.4mm"
                      />
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg text-center">
                      <p className="text-xs text-gray-500 uppercase font-bold mb-1">Camada</p>
                      <input 
                        type="text"
                        name="layerHeight"
                        value={formData.layerHeight}
                        onChange={handleTechnicalChange}
                        className="w-full text-center text-sm font-bold text-gray-800 bg-transparent border-b border-gray-300 focus:border-teal-500 focus:outline-none"
                        placeholder="0.2mm"
                      />
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg text-center">
                      <p className="text-xs text-gray-500 uppercase font-bold mb-1">Tempo (h)</p>
                      <input 
                        type="number"
                        name="printTimeHours"
                        step="0.1"
                        value={formData.printTimeHours}
                        onChange={handleTechnicalChange}
                        className="w-full text-center text-sm font-bold text-gray-800 bg-transparent border-b border-gray-300 focus:border-teal-500 focus:outline-none"
                        placeholder="0.0"
                      />
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 mt-4">
                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Regras de Negócio Aplicadas</h3>
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">
                      {result.breakdown}
                    </pre>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 flex flex-col items-center justify-center text-center h-full min-h-[400px] text-gray-600">
                <svg className="w-16 h-16 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                </svg>
                <p className="text-lg font-medium text-gray-800">Preencha o formulário ao lado</p>
                <p className="text-sm mt-2 text-gray-600">O resultado do orçamento aparecerá aqui.</p>
              </div>
            )}
          </div>
          {result && (
            <div className="lg:col-span-2">
              <PrintScheduleCalendar
                estimatedHours={result.estimatedTimeHours}
                hasPainting={formData.hasPainting}
                showPainting={formData.hasPainting}
                layout="stacked"
                readOnly
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
