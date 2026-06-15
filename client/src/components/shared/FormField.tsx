import React from 'react';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
  htmlFor?: string;
}

export default function FormField({
  label,
  error,
  required = false,
  children,
  hint,
  htmlFor,
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="label">
        {label}
        {required && (
          <span className="ml-0.5 text-brand-500" aria-hidden="true">*</span>
        )}
      </label>

      {children}

      {error ? (
        <p className="form-error" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}
