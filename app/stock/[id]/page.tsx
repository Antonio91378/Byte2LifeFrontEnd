'use client';

import { DETAIL_LEVELS } from '@/constants/printQuality';
import { useDialog } from '@/context/DialogContext';
import { formatHoursToDuration } from '@/utils/time';
import axios from 'axios';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Filament {
  id: string;
  description: string;
  color: string;
  price: number;
}

export default function EditStockItemPage() {
  const router = useRouter();
  const params = useParams();
  const { showAlert } = useDialog();
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [isTimeManual, setIsTimeManual] = useState(true); // Default to manual on edit to preserve saved value
  
  const [formData, setFormData] = useState({
    description: '',
    filamentId: '',
    printTime: '',
    weightGrams: 0,
    cost: 0,
    productionCost: 0,
    printQuality: 'Normal',
    nozzleDiameter: '',
    layerHeight: '',
    hasCustomArt: false,
    hasPainting: false,
    hasVarnish: false,
    photos: [] as string[],
    status: 'Available'
  });

  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [costDetails, setCostDetails] = useState<{
    breakdown: string;
    nozzleDiameter: string;
    layerHeightRange: string;
    totalProductionCost: number;
    materialCost: number;
    energyCost: number;
    machineCost: number;
  } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [filamentsRes, itemRes] = await Promise.all([
          axios.get('http://localhost:5000/api/filaments'),
          axios.get(`http://localhost:5000/api/stock/${params.id}`)
        ]);
        setFilaments(filamentsRes.data);
        
        // Map old quality values to new ones if necessary
        let quality = itemRes.data.printQuality;
        if (quality === 'Draft') quality = 'Baixo';
        if (quality === 'Standard') quality = 'Normal';
        if (quality === 'High') quality = 'Alto';
        if (quality === 'Ultra') quality = 'Extremo';

        setFormData({
          ...itemRes.data,
          printQuality: quality
        });
      } catch (error) {
        console.error("Error fetching data", error);
        showAlert('Erro', 'Erro ao carregar dados do item', 'error');
        router.push('/stock');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.id, router, showAlert]);

  // Calculate cost automatically when relevant fields change
  useEffect(() => {
    const calculateCost = async () => {
      if (!formData.filamentId || formData.weightGrams <= 0) return;

      // Parse print time "4h 30m" -> 4.5 ONLY if manual
      let manualHours: number | undefined = undefined;
      
      if (isTimeManual && formData.printTime) {
        const hMatch = formData.printTime.match(/(\d+)h/);
        const mMatch = formData.printTime.match(/(\d+)m/);
        
        if (hMatch || mMatch) {
          let h = 0;
          if (hMatch) h += parseInt(hMatch[1]);
          if (mMatch) h += parseInt(mMatch[1]) / 60;
          manualHours = h;
        } else {
          // Try parsing as direct number (hours)
          const val = parseFloat(formData.printTime.replace(',', '.'));
          if (!isNaN(val)) manualHours = val;
        }
      }

      // Find detail level value from label
      const level = DETAIL_LEVELS.find(l => l.label === formData.printQuality)?.value ?? 1;

      try {
        const res = await axios.post('http://localhost:5000/api/budget/calculate', {
          filamentId: formData.filamentId,
          detailLevel: level,
          massGrams: formData.weightGrams,
          hasCustomArt: formData.hasCustomArt,
          hasPainting: formData.hasPainting,
          hasVarnish: formData.hasVarnish,
          printTimeHours: manualHours,
          nozzleDiameter: formData.nozzleDiameter,
          layerHeight: formData.layerHeight
        });
        
        setFormData(prev => ({ 
          ...prev, 
          cost: res.data.totalPrice,
          productionCost: res.data.totalProductionCost,
          nozzleDiameter: res.data.nozzleDiameter,
          layerHeight: res.data.layerHeightRange,
          // Only update print time if NOT manual
          printTime: !isTimeManual && res.data.estimatedTimeHours 
            ? formatHoursToDuration(res.data.estimatedTimeHours) 
            : prev.printTime
        }));

        setCostDetails({
          breakdown: res.data.breakdown,
          nozzleDiameter: res.data.nozzleDiameter,
          layerHeightRange: res.data.layerHeightRange,
          totalProductionCost: res.data.totalProductionCost,
          materialCost: res.data.materialCost,
          energyCost: res.data.energyCost,
          machineCost: res.data.machineCost
        });
      } catch (err) {
        console.error("Error calculating cost", err);
      }
    };

    // Only calculate if not loading (to avoid overwriting initial data immediately if we wanted to preserve it, 
    // but user wants "always use simulation rules", so recalculating on load is actually correct to update old prices)
    if (!loading) {
        const timeoutId = setTimeout(() => {
            calculateCost();
        }, 500);
        return () => clearTimeout(timeoutId);
    }
  }, [
    formData.filamentId, 
    formData.weightGrams, 
    formData.printQuality, 
    formData.printTime,
    formData.hasCustomArt,
    formData.hasPainting,
    formData.hasVarnish,
    formData.nozzleDiameter,
    formData.layerHeight,
    loading,
    isTimeManual
  ]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    setUploading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/stock/upload', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFormData(prev => ({
        ...prev,
        photos: [...prev.photos, res.data.url]
      }));
    } catch (error) {
      console.error("Upload failed", error);
      showAlert('Erro', 'Falha ao fazer upload da imagem', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.put(`http://localhost:5000/api/stock/${params.id}`, formData);
      await showAlert('Sucesso', 'Item atualizado com sucesso!', 'success');
      router.push('/stock');
    } catch (error) {
      console.error(error);
      showAlert('Erro', 'Erro ao atualizar item', 'error');
    }
  };

  if (loading) {
    return <div className="text-center py-12">Carregando...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-brand-purple/10 rounded-xl">
          <svg className="w-8 h-8 text-brand-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Editar Item</h1>
          <p className="text-gray-500">Atualize as informações do item de estoque.</p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Informações Básicas
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição / Nome do Modelo</label>
              <input 
                type="text" 
                required
                placeholder="Ex: Barquinho Benchy"
                className="w-full rounded-lg border-gray-300 focus:ring-brand-purple focus:border-brand-purple text-gray-900 bg-white"
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
              />
            </div>
          </div>

          {/* Print Details Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
              Detalhes da Impressão
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Filamento Utilizado</label>
                <select 
                  required
                  className="w-full rounded-lg border-gray-300 focus:ring-brand-purple focus:border-brand-purple text-gray-900 bg-white"
                  value={formData.filamentId}
                  onChange={e => setFormData({...formData, filamentId: e.target.value})}
                >
                  <option value="" className="text-gray-900">Selecione o filamento...</option>
                  {filaments.map(f => (
                    <option key={f.id} value={f.id} className="text-gray-900">{f.description} - {f.color}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tempo de Impressão</label>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Ex: 4h 30m"
                    className={`w-full rounded-lg border-gray-300 focus:ring-brand-purple focus:border-brand-purple text-gray-900 bg-white pl-10 ${isTimeManual ? 'border-brand-purple ring-1 ring-brand-purple' : ''}`}
                    value={formData.printTime}
                    onChange={e => {
                      setIsTimeManual(true);
                      setFormData({...formData, printTime: e.target.value});
                    }}
                  />
                  <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  
                  {isTimeManual && (
                    <button
                      type="button"
                      onClick={() => setIsTimeManual(false)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-brand-purple hover:text-brand-dark font-medium bg-brand-purple/10 px-2 py-1 rounded"
                      title="Restaurar cálculo automático"
                    >
                      Auto
                    </button>
                  )}
                </div>
                {isTimeManual && <p className="text-xs text-brand-purple mt-1">Editado manualmente</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Qualidade</label>
                <select 
                  className="w-full rounded-lg border-gray-300 focus:ring-brand-purple focus:border-brand-purple text-gray-900 bg-white"
                  value={formData.printQuality}
                  onChange={e => setFormData({...formData, printQuality: e.target.value})}
                >
                  {DETAIL_LEVELS.map(level => (
                    <option key={level.value} value={level.label}>{level.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Peso (gramas)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    required
                    min="0"
                    step="0.1"
                    className="w-full rounded-lg border-gray-300 focus:ring-brand-purple focus:border-brand-purple text-gray-900 bg-white pl-10"
                    value={formData.weightGrams || ''}
                    onChange={e => setFormData({...formData, weightGrams: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                  />
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 font-medium">g</span>
                </div>
              </div>

              {/* Additional Options */}
              <div className="md:col-span-2 pt-4 border-t border-gray-100">
                <label className="block text-sm font-medium text-gray-700 mb-3">Adicionais</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="rounded text-brand-purple focus:ring-brand-purple border-gray-300"
                      checked={formData.hasCustomArt}
                      onChange={e => setFormData({...formData, hasCustomArt: e.target.checked})}
                    />
                    <span className="text-sm text-gray-700">Arte Personalizada</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="rounded text-brand-purple focus:ring-brand-purple border-gray-300"
                      checked={formData.hasPainting}
                      onChange={e => setFormData({...formData, hasPainting: e.target.checked})}
                    />
                    <span className="text-sm text-gray-700">Pintura</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="rounded text-brand-purple focus:ring-brand-purple border-gray-300"
                      checked={formData.hasVarnish}
                      onChange={e => setFormData({...formData, hasVarnish: e.target.checked})}
                    />
                    <span className="text-sm text-gray-700">Verniz</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Status, Cost & Photos */}
        <div className="space-y-6">
          {/* Status Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Status do Item
            </h2>
            <select 
              required
              className="w-full rounded-lg border-gray-300 focus:ring-brand-purple focus:border-brand-purple text-gray-900 bg-white"
              value={formData.status}
              onChange={e => setFormData({...formData, status: e.target.value})}
            >
              <option value="Available">Disponível</option>
              <option value="Sold">Vendido</option>
              <option value="Reserved">Reservado</option>
            </select>
          </div>

          {/* Cost Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Custos e Preços
            </h2>
            
            {/* Sale Price */}
            <div className="bg-green-50 p-4 rounded-lg border border-green-100 text-center mb-4">
              <span className="block text-sm text-green-600 font-medium mb-1">Valor de Venda Sugerido</span>
              <div className="text-3xl font-bold text-green-700">
                R$ {isNaN(formData.cost) ? '0.00' : formData.cost.toFixed(2)}
              </div>
            </div>

            {/* Production Cost */}
            {costDetails && (
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-200">
                  <span className="text-sm font-bold text-gray-700">Custo de Produção</span>
                  <span className="text-lg font-bold text-gray-800">
                    {(costDetails.totalProductionCost || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Material</span>
                    <span>{(costDetails.materialCost || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Energia</span>
                    <span>{(costDetails.energyCost || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Máquina</span>
                    <span>{(costDetails.machineCost || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                </div>
              </div>
            )}

            {costDetails && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-gray-50 p-2 rounded border border-gray-100">
                    <p className="text-[10px] text-gray-500 uppercase font-bold">Nozzle</p>
                    <input 
                      type="text"
                      className="w-full text-xs font-bold text-gray-800 bg-transparent border-b border-gray-300 focus:border-brand-purple focus:outline-none text-center"
                      value={formData.nozzleDiameter}
                      onChange={e => setFormData({...formData, nozzleDiameter: e.target.value})}
                      placeholder="0.4mm"
                    />
                  </div>
                  <div className="bg-gray-50 p-2 rounded border border-gray-100">
                    <p className="text-[10px] text-gray-500 uppercase font-bold">Camada</p>
                    <input 
                      type="text"
                      className="w-full text-xs font-bold text-gray-800 bg-transparent border-b border-gray-300 focus:border-brand-purple focus:outline-none text-center"
                      value={formData.layerHeight}
                      onChange={e => setFormData({...formData, layerHeight: e.target.value})}
                      placeholder="0.2mm"
                    />
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <h3 className="text-xs font-bold text-gray-700 mb-1">Detalhamento da Margem</h3>
                  <pre className="text-[10px] text-gray-600 whitespace-pre-wrap font-mono leading-tight">
                    {costDetails.breakdown}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Photos Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              Galeria
            </h2>
            
            <div className="space-y-4">
              <label className={`cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center transition-colors ${uploading ? 'bg-gray-50 opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 hover:border-brand-purple'}`}>
                <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                <span className="text-sm text-gray-600 font-medium">{uploading ? 'Enviando...' : 'Clique para adicionar foto'}</span>
                <span className="text-xs text-gray-400 mt-1">JPG, PNG (Max 5MB)</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
              </label>

              {formData.photos.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {formData.photos.map((photo, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200">
                      <img src={`http://localhost:5000${photo}`} alt={`Foto ${idx}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== idx) }))}
                        className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-4">
            <button 
              type="submit" 
              className="w-full py-3 bg-brand-purple text-white rounded-xl hover:bg-purple-800 transition-all shadow-md hover:shadow-lg font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              Salvar Alterações
            </button>
            <button 
              type="button" 
              onClick={() => router.back()}
              className="w-full py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
