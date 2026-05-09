import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  type?: 'error' | 'success' | 'info' | 'warning';
  footer?: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children, type = 'info', footer }: ModalProps) {
  if (!isOpen) return null;

  const colors = {
    error: 'text-red-600 border-red-100 bg-red-50',
    success: 'text-green-600 border-green-100 bg-green-50',
    info: 'text-brand-purple border-purple-100 bg-purple-50',
    warning: 'text-amber-600 border-amber-100 bg-amber-50'
  };

  const titleColor = {
    error: 'text-red-600',
    success: 'text-green-600',
    info: 'text-brand-purple',
    warning: 'text-amber-600'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg transform transition-all scale-100">
        <div className={`flex justify-between items-center p-6 border-b ${type === 'error' ? 'border-red-100' : 'border-gray-100'}`}>
          <h3 className={`text-xl font-bold ${titleColor[type]}`}>
            {title}
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 max-h-[60vh] overflow-y-auto text-gray-700">
          {children}
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
          {footer ? footer : (
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                type === 'error' 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-brand-purple hover:bg-purple-800 text-white'
              }`}
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
