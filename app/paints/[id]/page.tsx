'use client';

import { useDialog } from '@/context/DialogContext';
import axios from 'axios';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function EditPaintPage() {
  const params = useParams();
  const router = useRouter();
  const { showAlert } = useDialog();
  const [formData, setFormData] = useState({
    brand: '',
    code: '',
    color: '',
    colorHex: '#000000',
    type: 'Acrílica',
    volumeMl: 0,
    stockQuantity: 0,
    isLowStock: false
  });

  useEffect(() => {
    if (params.id) {
      axios.get(`http://localhost:5000/api/paints/${params.id}`)
        .then(res => setFormData(res.data))
        .catch(err => console.error(err));
    }
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.put(`http://localhost:5000/api/paints/${params.id}`, formData);
      await showAlert('Sucesso', 'Tinta atualizada com sucesso!', 'success');
      router.push('/paints');
    } catch (error) {
      console.error(error);
      await showAlert('Erro', 'Erro ao atualizar tinta', 'error');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-brand-purple mb-8">Editar Tinta</h1>
      
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
            <input
              type="text"
              required
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-purple focus:ring-brand-purple text-gray-900 bg-white"
              value={formData.brand}
              onChange={e => setFormData({...formData, brand: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
            <input
              type="text"
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-purple focus:ring-brand-purple text-gray-900 bg-white"
              value={formData.code || ''}
              onChange={e => setFormData({...formData, code: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cor</label>
            <div className="flex gap-4 items-center">
              <input
                type="text"
                required
                placeholder="Ex: Vermelho Fogo"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-purple focus:ring-brand-purple text-gray-900 bg-white"
                value={formData.color}
                onChange={e => setFormData({...formData, color: e.target.value})}
              />
              <div className="flex flex-col items-center">
                <input
                  type="color"
                  value={formData.colorHex || '#000000'}
                  onChange={e => setFormData({...formData, colorHex: e.target.value})}
                  className="h-10 w-14 p-1 border border-gray-300 rounded cursor-pointer"
                  title="Escolher cor visual"
                />
                <span className="text-xs text-gray-500 mt-1">Visual</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-purple focus:ring-brand-purple text-gray-900 bg-white"
              value={formData.type}
              onChange={e => setFormData({...formData, type: e.target.value})}
            >
              <option value="Acrílica">Acrílica</option>
              <option value="Acrílica Fosca Mate">Acrílica Fosca Mate</option>
              <option value="Acrílica Metálica">Acrílica Metálica</option>
              <option value="Esmalte">Esmalte</option>
              <option value="Primer">Primer</option>
              <option value="Verniz">Verniz</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Volume (ml)</label>
            <input
              type="number"
              step="0.1"
              required
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-purple focus:ring-brand-purple text-gray-900 bg-white"
              value={formData.volumeMl}
              onChange={e => setFormData({...formData, volumeMl: parseFloat(e.target.value)})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade em Estoque</label>
            <input
              type="number"
              required
              min="0"
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-purple focus:ring-brand-purple text-gray-900 bg-white"
              value={formData.stockQuantity}
              onChange={e => setFormData({...formData, stockQuantity: parseInt(e.target.value)})}
            />
          </div>

          <div className="flex items-center mt-6">
            <input
              id="isLowStock"
              type="checkbox"
              className="h-4 w-4 text-brand-purple focus:ring-brand-purple border-gray-300 rounded"
              checked={formData.isLowStock}
              onChange={e => setFormData({...formData, isLowStock: e.target.checked})}
            />
            <label htmlFor="isLowStock" className="ml-2 block text-sm text-gray-900">
              Marcar como "Acabando"
            </label>
          </div>
        </div>

        <div className="flex justify-end space-x-4 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-purple hover:bg-brand-purple-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-purple"
          >
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}
