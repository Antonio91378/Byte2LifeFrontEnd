'use client';

import { useDialog } from '@/context/DialogContext';
import axios from 'axios';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Paint {
  id: string;
  brand: string;
  code?: string;
  color: string;
  colorHex?: string;
  type: string;
  volumeMl: number;
  stockQuantity: number;
  isLowStock: boolean;
}

export default function PaintsPage() {
  const [paints, setPaints] = useState<Paint[]>([]);
  const { showAlert, showConfirm } = useDialog();

  useEffect(() => {
    axios.get('http://localhost:5000/api/paints')
      .then(res => setPaints(res.data))
      .catch(err => console.error(err));
  }, []);

  const toggleLowStock = async (paint: Paint) => {
    try {
      const updatedPaint = { ...paint, isLowStock: !paint.isLowStock };
      await axios.put(`http://localhost:5000/api/paints/${paint.id}`, updatedPaint);
      setPaints(paints.map(p => p.id === paint.id ? updatedPaint : p));
    } catch (error) {
      console.error(error);
      showAlert('Erro', 'Erro ao atualizar status', 'error');
    }
  };

  const handleDelete = (id: string) => {
    showConfirm(
      'Excluir Tinta',
      'Tem certeza que deseja excluir esta tinta?',
      async () => {
        try {
          await axios.delete(`http://localhost:5000/api/paints/${id}`);
          setPaints(paints.filter(p => p.id !== id));
          await showAlert('Sucesso', 'Tinta excluída com sucesso!', 'success');
        } catch (error: any) {
          console.error(error);
          await showAlert('Erro', 'Erro ao excluir tinta', 'error');
        }
      }
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 space-y-6">
        <div className="flex justify-between items-center border-b-2 border-brand-orange pb-4">
          <h1 className="text-3xl font-bold text-brand-purple">Estoque de Tintas</h1>
          <Link href="/paints/new" className="bg-brand-purple hover:bg-purple-800 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            Nova Tinta
          </Link>
        </div>
      
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {paints.map(p => (
            <div key={p.id} className={`bg-white rounded-lg shadow-md overflow-hidden border ${p.isLowStock ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-100'} hover:shadow-lg transition-all relative group`}>
              <div className="h-2" style={{ backgroundColor: p.colorHex || '#2e0249' }}></div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    {p.colorHex && (
                      <span 
                        className="w-4 h-4 rounded-full border border-gray-200 shadow-sm inline-block" 
                        style={{ backgroundColor: p.colorHex }}
                      ></span>
                    )}
                    {p.brand} - {p.color}
                  </h3>
                  <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-600">{p.type}</span>
                </div>
                
                <div className="space-y-2">
                  {p.code && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Código:</span>
                      <span className="font-medium text-gray-800">{p.code}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Volume:</span>
                    <span className="font-medium text-gray-800">{p.volumeMl} ml</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Quantidade em Estoque:</span>
                    <span className={`font-medium ${p.stockQuantity < 2 ? 'text-red-500' : 'text-green-600'}`}>
                      {p.stockQuantity} un
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-50">
                    <span className="text-sm text-gray-500">Acabando?</span>
                    <button 
                      onClick={() => toggleLowStock(p)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-purple focus:ring-offset-2 ${p.isLowStock ? 'bg-red-500' : 'bg-gray-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${p.isLowStock ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link href={`/paints/${p.id}`} className="text-sm text-brand-purple hover:text-purple-900 font-medium">
                    Editar
                  </Link>
                  <button 
                    onClick={() => handleDelete(p.id)}
                    className="text-sm text-red-600 hover:text-red-900 font-medium"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          {paints.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"></path></svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma tinta cadastrada</h3>
              <p className="mt-1 text-sm text-gray-500">Comece adicionando uma nova tinta ao estoque.</p>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar for Low Stock */}
      <div className="w-full lg:w-80 shrink-0">
        <div className="bg-white rounded-lg shadow-md p-6 border border-red-100 sticky top-6">
          <h2 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            Tintas Acabando
          </h2>
          
          <div className="space-y-3">
            {paints.filter(p => p.isLowStock).length === 0 ? (
              <p className="text-sm text-gray-500 italic">Nenhuma tinta marcada como acabando.</p>
            ) : (
              paints.filter(p => p.isLowStock).map(p => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded bg-red-50 border border-red-100">
                  <div 
                    className="w-3 h-3 rounded-full shadow-sm shrink-0" 
                    style={{ backgroundColor: p.colorHex || '#000' }}
                  ></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.brand} - {p.color}</p>
                    <p className="text-xs text-gray-500">{p.volumeMl}ml restantes</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
