import React, { useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      const id = setTimeout(() => confirmBtnRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isDanger = confirmVariant === 'danger';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="confirm-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-100 animate-scale-in">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 btn-icon"
          aria-label="Close modal"
        >
          <X size={16} />
        </button>

        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={[
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
              isDanger ? 'bg-red-100' : 'bg-brand-100',
            ].join(' ')}>
              {isDanger
                ? <AlertTriangle size={20} className="text-red-600" />
                : <CheckCircle size={20} className="text-brand-600" />
              }
            </div>

            <div className="min-w-0 flex-1 pt-0.5">
              <h2 id="confirm-modal-title" className="text-base font-bold text-slate-900">
                {title}
              </h2>
              <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{message}</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              ref={confirmBtnRef}
              type="button"
              onClick={() => { onConfirm(); onClose(); }}
              className={isDanger ? 'btn-danger' : 'btn-primary'}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
