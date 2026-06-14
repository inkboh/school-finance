import React from 'react';

interface FormFieldProps {
  label: string;
  /** Error message to display below the field */
  error?: string;
  required?: boolean;
  /** The actual input / select / textarea element */
  children: React.ReactNode;
  /** Optional helper text shown below the input (suppressed when error is present) */
  hint?: string;
  /** Unique id to link the label to the child input via htmlFor */
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
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-slate-700"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-red-500" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children}

      {error ? (
        <p className="flex items-center gap-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}
