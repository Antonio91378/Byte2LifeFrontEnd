'use client';

import { useDialog } from '@/context/DialogContext';
import axios from 'axios';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Filament {
  id: string;
  description: string;
  remainingMassGrams: number;
  initialMassGrams: number;
  color: string;
  colorHex?: string;
  price: number;
  type: string;
}

export default function FilamentsPage() {
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const { showAlert, showConfirm } = useDialog();

  useEffect(() => {
    axios.get('http://localhost:5000/api/filaments')
      .then(res => setFilaments(res.data))
      .catch(err => console.error(err));
  }, []);

  const handleDelete = (id: string) => {
    showConfirm(
      'Excluir Filamento',
      'Tem certeza que deseja excluir este filamento?',
      async () => {
        try {
          await axios.delete(`http://localhost:5000/api/filaments/${id}`);
          setFilaments(filaments.filter(f => f.id !== id));
          await showAlert('Sucesso', 'Filamento excluído com sucesso!', 'success');
        } catch (error: any) {
          console.error(error);
          if (error.response && error.response.data && error.response.data.message) {
            await showAlert('Erro', error.response.data.message, 'error');
          } else {
            await showAlert('Erro', 'Erro ao excluir filamento', 'error');
          }
        }
      }
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 space-y-6">
        <div className="flex justify-between items-center border-b-2 border-brand-orange pb-4">
          <h1 className="text-3xl font-bold text-brand-purple">Estoque de Filamentos</h1>
          <Link href="/filaments/new" className="bg-brand-purple hover:bg-purple-800 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            Novo Filamento
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filaments.map(f => (
          <div key={f.id} className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow relative group">
            <div className="h-2" style={{ backgroundColor: f.colorHex || '#2e0249' }}></div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{f.description}</h3>
                  <div className="mt-1 flex gap-2 flex-wrap">
                    <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-600">{f.color}</span>
                    <span className="px-2 py-1 text-xs font-semibold rounded bg-orange-100 text-orange-800">{f.type && f.type.trim() ? f.type : 'Tipo não informado'}</span>
                  </div>
                </div>
                {f.colorHex && (
                  <span 
                    className="w-4 h-4 rounded-full border border-gray-200 shadow-sm" 
                    style={{ backgroundColor: f.colorHex }}
                    title={f.color}
                  ></span>
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Restante:</span>
                  <span className={`font-medium ${f.remainingMassGrams < 200 ? 'text-red-500' : 'text-green-600'}`}>
                    {f.remainingMassGrams}g
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-brand-orange h-2.5 rounded-full" 
                    style={{ width: `${Math.min((f.remainingMassGrams / f.initialMassGrams) * 100, 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-sm pt-2">
                  <span className="text-gray-500">Preço Original:</span>
                  <span className="font-medium text-gray-800">R$ {f.price.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link href={`/filaments/${f.id}`} className="text-sm text-brand-purple hover:text-purple-900 font-medium">
                  Editar
                </Link>
                <button 
                  onClick={() => handleDelete(f.id)}
                  className="text-sm text-red-600 hover:text-red-900 font-medium"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      
        {filaments.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum filamento cadastrado</h3>
            <p className="mt-1 text-sm text-gray-500">Comece adicionando um novo rolo de filamento.</p>
          </div>
        )}
      </div>
      {/* Sidebar for Low Stock Filaments */}
      <div className="w-full lg:w-80 shrink-0">
        <div className="bg-white rounded-lg shadow-md p-6 border border-red-100 sticky top-6">
          <h2 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            Filamentos Acabando
          </h2>
          <div className="space-y-3">
            {(() => {
              // Filamentos acabando (estoque < 200)
              const lowStock = filaments.filter(f => f.remainingMassGrams < 200);
              // Só exibe se não houver outro filamento do mesmo tipo e cor com estoque >= 200
              const uniqueLowStock = lowStock.filter(f => {
                const hasReplacement = filaments.some(other =>
                  other.id !== f.id &&
                  other.type === f.type &&
                  other.color.toLowerCase() === f.color.toLowerCase() &&
                  other.remainingMassGrams >= 200
                );
                return !hasReplacement;
              });
              if (uniqueLowStock.length === 0) {
                return <p className="text-sm text-gray-500 italic">Nenhum filamento acabando.</p>;
              }
              return uniqueLowStock.map(f => (
                <div key={f.id} className="flex items-center gap-3 p-2 rounded bg-red-50 border border-red-100">
                  <div 
                    className="w-3 h-3 rounded-full shadow-sm shrink-0" 
                    style={{ backgroundColor: f.colorHex || '#000' }}
                  ></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{f.description} <span className='text-xs text-gray-500'>({f.type})</span></p>
                    <p className="text-xs text-gray-500">{f.remainingMassGrams}g restantes</p>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
