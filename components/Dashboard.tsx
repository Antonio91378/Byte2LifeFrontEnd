'use client';

import axios from 'axios';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Modal from './Modal';

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
  printTimeHours?: number;
  tags?: string[];
  deliveryDate?: string;
  incidents?: PrintIncident[];
}

const INCIDENT_REASONS = [
  { value: 'PowerLoss', label: 'Queda de Energia' },
  { value: 'FilamentJam', label: 'Entupimento/Trava de Filamento' },
  { value: 'LayerShift', label: 'Deslocamento de Camada' },
  { value: 'AdhesionIssue', label: 'Problema de Aderência' },
  { value: 'ManualPause', label: 'Pausa Manual' },
  { value: 'Maintenance', label: 'Manutenção' },
  { value: 'Other', label: 'Outro' }
];

export default function Dashboard() {
  const [currentPrint, setCurrentPrint] = useState<Sale | null>(null);
  const [queue, setQueue] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [remainingTime, setRemainingTime] = useState<string>("");
  
  // Modal State
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [finishStatus, setFinishStatus] = useState("Concluded");
  const [finishTags, setFinishTags] = useState("");
  const [errorReason, setErrorReason] = useState("");
  const [wastedFilament, setWastedFilament] = useState("");
  const [forceZeroTimer, setForceZeroTimer] = useState(false);
  const [showIncidentsModal, setShowIncidentsModal] = useState<Sale | null>(null);

  // Edit Time State
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editTimeValue, setEditTimeValue] = useState("");
  const [editTimeReason, setEditTimeReason] = useState("Other");

  const fetchData = async () => {
    try {
      const [currentRes, queueRes] = await Promise.all([
        axios.get('http://localhost:5000/api/sales/current'),
        axios.get('http://localhost:5000/api/sales/queue')
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

      setQueue(queueRes.data);
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
    if (!currentPrint || !currentPrint.printStartedAt || !currentPrint.printTimeHours || currentPrint.printStatus !== 'InProgress') {
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
        setRemainingTime(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);
    return () => clearInterval(timerInterval);
  }, [currentPrint, forceZeroTimer]);

  const handleSaveTime = async () => {
    if (!currentPrint || !currentPrint.printStartedAt) return;

    try {
      // Parse editTimeValue (HH:MM or HH:MM:SS)
      const parts = editTimeValue.split(':');
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

      const remainingMs = ((hours * 3600) + (minutes * 60) + seconds) * 1000;
      const startMs = new Date(currentPrint.printStartedAt).getTime();
      const nowMs = new Date().getTime();
      
      // New Total Duration = (Now + Remaining) - Start
      const newTotalDurationMs = (nowMs + remainingMs) - startMs;
      
      // Ensure duration is positive
      if (newTotalDurationMs < 0) {
        alert("O tempo total não pode ser negativo");
        return;
      }

      const newTotalDurationHours = newTotalDurationMs / (1000 * 3600);

      const newIncident = {
        timestamp: new Date().toISOString(),
        reason: editTimeReason,
        comment: `Tempo ajustado para ${editTimeValue}`
      };

      const updatedIncidents = currentPrint.incidents ? [...currentPrint.incidents, newIncident] : [newIncident];

      await axios.put(`http://localhost:5000/api/sales/${currentPrint.id}`, {
        ...currentPrint,
        printTimeHours: newTotalDurationHours,
        incidents: updatedIncidents
      });
      
      setIsEditingTime(false);
      setEditTimeReason("Other");
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
      const tagsArray = finishTags.split(',').map(t => t.trim()).filter(t => t);
      const updateData: any = {
        ...currentPrint,
        printStatus: finishStatus,
        tags: tagsArray
      };

      if (finishStatus === 'Failed') {
        updateData.errorReason = errorReason;
        updateData.wastedFilamentGrams = parseFloat(wastedFilament) || 0;
      }

      await axios.put(`http://localhost:5000/api/sales/${currentPrint.id}`, updateData);

      // 2. Promote next item if exists
      if (queue.length > 0) {
        const nextItem = queue[0];
        await axios.put(`http://localhost:5000/api/sales/${nextItem.id}`, {
          ...nextItem,
          printStatus: 'Staged'
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
        printStatus: 'InProgress'
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
      if (currentPrint && currentPrint.printStatus === 'Staged') {
        await axios.put(`http://localhost:5000/api/sales/${currentPrint.id}`, {
          ...currentPrint,
          printStatus: 'InQueue'
        });
      }
      await axios.put(`http://localhost:5000/api/sales/${item.id}`, {
        ...item,
        printStatus: 'Staged'
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Novo Status</label>
            <select 
              value={finishStatus}
              onChange={(e) => setFinishStatus(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-purple focus:border-brand-purple p-2 border text-gray-900 bg-white"
            >
              <option value="Concluded">Concluído</option>
              <option value="Failed">Falhou</option>
            </select>
          </div>

          {finishStatus === 'Failed' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo do Erro</label>
                <textarea 
                  value={errorReason}
                  onChange={(e) => setErrorReason(e.target.value)}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-purple focus:border-brand-purple p-2 border text-gray-900 bg-white"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Filamento Desperdiçado (g)</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags (separadas por vírgula)</label>
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
          {showIncidentsModal?.incidents && showIncidentsModal.incidents.length > 0 ? (
            <ul className="space-y-3">
              {showIncidentsModal.incidents.map((incident, idx) => (
                <li key={idx} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-brand-purple text-sm">
                      {INCIDENT_REASONS.find(r => r.value === incident.reason)?.label || incident.reason}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(incident.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">{incident.comment}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-center">Nenhuma ocorrência registrada.</p>
          )}
        </div>
      </Modal>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Current Print Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-brand-purple p-4 text-white">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
              Impressão Atual
            </h2>
          </div>
          <div className="p-8 text-center">
            {currentPrint ? (
              <div className="space-y-4">
                {currentPrint.printStatus === 'InProgress' && (
                  <>
                    <div className="animate-pulse inline-block px-4 py-1 rounded-full bg-green-100 text-green-800 font-semibold text-sm mb-2">
                      Em Andamento
                    </div>
                    <h3 className="text-3xl font-bold text-gray-800">{currentPrint.description}</h3>
                    <p className="text-gray-500">Iniciado em: {currentPrint.printStartedAt ? new Date(currentPrint.printStartedAt).toLocaleString() : 'N/A'}</p>
                    
                    {remainingTime && (
                      <div className="flex items-center justify-center gap-4 my-4">
                        {isEditingTime ? (
                          <div className="flex flex-col items-center gap-2 bg-white p-4 rounded-xl border border-gray-200 shadow-lg z-10">
                            <div className="flex items-center gap-2">
                              <input 
                                type="text" 
                                value={editTimeValue}
                                onChange={(e) => setEditTimeValue(e.target.value)}
                                className="text-2xl font-mono font-bold text-brand-purple bg-white px-3 py-1 rounded-lg border-2 border-brand-purple w-32 text-center"
                                autoFocus
                                placeholder="HH:MM"
                              />
                            </div>
                            <select
                              value={editTimeReason}
                              onChange={(e) => setEditTimeReason(e.target.value)}
                              className="w-full text-sm text-gray-900 bg-white border-gray-300 rounded-md shadow-sm focus:ring-brand-purple focus:border-brand-purple p-1"
                            >
                              {INCIDENT_REASONS.map(reason => (
                                <option key={reason.value} value={reason.value} className="text-gray-900">
                                  {reason.label}
                                </option>
                              ))}
                            </select>
                            <div className="flex gap-2 w-full justify-center mt-1">
                              <button onClick={handleSaveTime} className="px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm font-medium flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                Salvar
                              </button>
                              <button onClick={() => setIsEditingTime(false)} className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="group relative">
                            <div className="text-4xl font-mono font-bold text-brand-purple bg-purple-50 px-6 py-2 rounded-xl border border-purple-100 flex items-center gap-3">
                              {remainingTime}
                              {currentPrint.incidents && currentPrint.incidents.length > 0 && (
                                <button 
                                  onClick={() => setShowIncidentsModal(currentPrint)}
                                  className="text-yellow-500 hover:text-yellow-600 transition-colors"
                                  title="Ver ocorrências"
                                >
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                </button>
                              )}
                            </div>
                            <button 
                              onClick={() => {
                                setEditTimeValue(remainingTime.substring(0, 5)); // HH:MM
                                setIsEditingTime(true);
                              }}
                              className="absolute -right-10 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-brand-purple opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Editar tempo restante"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-4">
                      <div className="bg-brand-purple h-2.5 rounded-full w-2/3"></div>
                    </div>
                    
                    <div className="flex justify-center gap-4 mt-6">
                      <Link 
                        href={`/sales/${currentPrint.id}`}
                        className="px-6 py-2 border border-brand-purple text-brand-purple rounded-lg hover:bg-purple-50 transition-colors shadow-sm flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                        Ver Detalhes
                      </Link>
                      <button 
                        onClick={() => {
                          setForceZeroTimer(true);
                          setShowFinishModal(true);
                        }}
                        className="px-6 py-2 bg-brand-purple text-white rounded-lg hover:bg-purple-800 transition-colors shadow-md"
                      >
                        Finalizar Impressão
                      </button>
                    </div>
                  </>
                )}

                {currentPrint.printStatus === 'Staged' && (
                  <>
                    <div className="inline-block px-4 py-1 rounded-full bg-yellow-100 text-yellow-800 font-semibold text-sm mb-2">
                      Aguardando Início
                    </div>
                    <h3 className="text-3xl font-bold text-gray-800">{currentPrint.description}</h3>
                    <p className="text-gray-500">Pronto para imprimir</p>
                    <button 
                      onClick={handleStartPrint}
                      className="mt-6 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md font-bold text-lg flex items-center justify-center gap-2 mx-auto"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      Iniciar Contabilizador
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="py-8 text-gray-400">
                <p className="text-xl">Nenhuma impressão em andamento</p>
                <p className="text-sm mt-2">Selecione um item da fila para iniciar</p>
              </div>
            )}
          </div>
        </div>

        {/* Queue Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col">
          <div className="bg-brand-orange p-4 text-white">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
              Fila de Impressão
            </h2>
          </div>
          <div className="p-0 flex-grow overflow-y-auto max-h-[300px]">
            {queue.length > 0 ? (
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-6 py-3">Prioridade</th>
                    <th className="px-6 py-3">Entrega</th>
                    <th className="px-6 py-3">Descrição</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {queue.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          item.priority === 0 ? 'bg-red-600 text-white' : 
                          item.priority <= 3 ? 'bg-orange-100 text-orange-800' : 
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {item.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-700 text-sm">
                        {item.deliveryDate ? new Date(item.deliveryDate).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        <div className="flex items-center gap-2">
                          {item.description}
                          {item.incidents && item.incidents.length > 0 && (
                            <button 
                              onClick={() => setShowIncidentsModal(item)}
                              className="text-yellow-500 hover:text-yellow-600 transition-colors"
                              title="Ver ocorrências"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
                          {item.printStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 flex items-center gap-2">
                        <Link 
                          href={`/sales/${item.id}`}
                          className="text-gray-400 hover:text-brand-purple transition-colors"
                          title="Ver Detalhes"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                        </Link>
                        <button
                          onClick={() => handleStageItem(item)}
                          className="text-brand-purple hover:text-purple-800 font-medium text-sm flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                          Iniciar
                        </button>
                      </td>
                    </tr>
                  ))}
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
    </div>
  );
}
