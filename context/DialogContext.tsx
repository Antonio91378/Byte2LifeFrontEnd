'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import Modal from '../components/Modal';

interface DialogOptions {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'error' | 'warning';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

interface DialogContextType {
  showAlert: (title: string, message: string, type?: 'info' | 'success' | 'error' | 'warning') => Promise<void>;
  showConfirm: (title: string, message: string, onConfirm: () => void | Promise<void>) => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<DialogOptions>({
    title: '',
    message: '',
    type: 'info'
  });
  const [isLoading, setIsLoading] = useState(false);

  // For alerts, we might want to await the close action
  const [resolveAlert, setResolveAlert] = useState<(() => void) | null>(null);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    if (resolveAlert) {
      resolveAlert();
      setResolveAlert(null);
    }
  }, [resolveAlert]);

  const showAlert = useCallback((title: string, message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    return new Promise<void>((resolve) => {
      setIsLoading(false);
      setOptions({
        title,
        message,
        type,
        confirmText: 'OK',
        onConfirm: () => {
          resolve();
        }
      });
      setResolveAlert(() => resolve);
      setIsOpen(true);
    });
  }, []);

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void | Promise<void>) => {
    setOptions({
      title,
      message,
      type: 'warning',
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      onConfirm,
      onCancel: () => {}
    });
    setIsOpen(true);
  }, []);

  const handleConfirm = async () => {
    if (options.onConfirm) {
      try {
        setIsLoading(true);
        await options.onConfirm();
      } finally {
        setIsLoading(false);
        closeDialog();
      }
    } else {
      closeDialog();
    }
  };

  const handleCancel = () => {
    if (options.onCancel) {
      options.onCancel();
    }
    closeDialog();
  };

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      <Modal
        isOpen={isOpen}
        onClose={closeDialog}
        title={options.title}
        type={options.type}
        footer={
          <>
            {options.cancelText && (
              <button
                onClick={handleCancel}
                disabled={isLoading}
                className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                {options.cancelText}
              </button>
            )}
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                options.type === 'error'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : options.type === 'warning'
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-brand-purple hover:bg-purple-800 text-white'
              } ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isLoading && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {options.confirmText || 'OK'}
            </button>
          </>
        }
      >
        <p className="text-gray-600 whitespace-pre-wrap">{options.message}</p>
      </Modal>
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (context === undefined) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}
