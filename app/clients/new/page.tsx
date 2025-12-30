'use client';

import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function NewClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    sex: '',
    category: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('http://localhost:5000/api/clients', formData);
      router.push('/clients');
    } catch (error) {
      console.error('Error creating client:', error);
      alert('Erro ao criar cliente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-brand-purple mb-8 border-b-2 border-brand-orange pb-4">Novo Cliente</h1>
      
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 space-y-6">
        
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
          <input
            type="text"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
          />
        </div>

        {/* Phone Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
          <input
            type="text"
            name="phoneNumber"
            required
            value={formData.phoneNumber}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Sex */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sexo</label>
            <select
              name="sex"
              required
              value={formData.sex}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
            >
              <option value="">Selecione</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
              <option value="O">Outro</option>
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <input
              type="text"
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
            />
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="bg-brand-purple hover:bg-purple-800 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Salvar Cliente'}
          </button>
        </div>
      </form>
    </div>
  );
}
