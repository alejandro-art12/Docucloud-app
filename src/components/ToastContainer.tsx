import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { ToastMessage } from '../types/docucloud';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="absolute top-3 inset-x-3 z-50 flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-2.5 px-3.5 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all duration-200 ${
              isSuccess
                ? 'bg-[#0F172A] text-white border-[#1E3A8A]'
                : isError
                ? 'bg-[#DC2626] text-white border-[#DC2626]'
                : 'bg-white text-[#0F172A] border-[#E2E8F0]'
            }`}
          >
            {isSuccess ? (
              <CheckCircle2 className="w-5 h-5 text-[#16A34A] shrink-0" />
            ) : isError ? (
              <AlertCircle className="w-5 h-5 text-white shrink-0" />
            ) : (
              <Info className="w-5 h-5 text-[#2563EB] shrink-0" />
            )}
            <span className="flex-1 leading-snug">{toast.message}</span>
            <button
              type="button"
              aria-label="Cerrar notificación"
              onClick={() => onDismiss(toast.id)}
              className="w-7 h-7 rounded-lg flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
