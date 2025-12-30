'use client';

import { useDialog } from '@/context/DialogContext';
import axios from 'axios';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Client {
  id: string;
  name: string;
  phoneNumber: string;
  sex: string;
  category: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const { showAlert, showConfirm } = useDialog();

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const url = searchTerm 
        ? `http://localhost:5000/api/clients?name=${encodeURIComponent(searchTerm)}`
        : 'http://localhost:5000/api/clients';
        
      axios.get(url)
        .then(res => setClients(res.data))
        .catch(err => console.error(err));
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleDelete = (id: string) => {
    showConfirm(
      'Excluir Cliente',
      'Tem certeza que deseja excluir este cliente?',
      async () => {
        try {
          await axios.delete(`http://localhost:5000/api/clients/${id}`);
          setClients(clients.filter(c => c.id !== id));
          await showAlert('Sucesso', 'Cliente excluído com sucesso!', 'success');
        } catch (error: any) {
          console.error(error);
          if (error.response && error.response.data && error.response.data.message) {
            await showAlert('Erro', error.response.data.message, 'error');
          } else {
            await showAlert('Erro', 'Erro ao excluir cliente', 'error');
          }
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center border-b-2 border-brand-orange pb-4 gap-4">
        <h1 className="text-3xl font-bold text-brand-purple">Clientes</h1>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-72 group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400 group-focus-within:text-brand-purple transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <input
              type="text"
              placeholder="Buscar clientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl leading-5 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple transition-all duration-200 shadow-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-red-500 transition-colors"
                title="Limpar busca"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            )}
          </div>
          
          <Link href="/clients/new" className="bg-brand-purple hover:bg-purple-800 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shadow-md h-[42px]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            Novo Cliente
          </Link>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clients.map(c => (
          <div key={c.id} className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow relative group">
            <div className="h-2 bg-brand-purple"></div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-800">{c.name || 'Sem Nome'}</h3>
                <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-600">{c.category}</span>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Telefone:</span>
                  <span className="font-medium text-gray-800">{c.phoneNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Sexo:</span>
                  <span className="font-medium text-gray-800">{c.sex}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link href={`/clients/${c.id}`} className="text-sm text-brand-purple hover:text-purple-900 font-medium">
                  Editar
                </Link>
                <button 
                  onClick={() => handleDelete(c.id)}
                  className="text-sm text-red-600 hover:text-red-900 font-medium"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {clients.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum cliente cadastrado</h3>
          <p className="mt-1 text-sm text-gray-500">Comece adicionando um novo cliente.</p>
        </div>
      )}
    </div>
  );
}
