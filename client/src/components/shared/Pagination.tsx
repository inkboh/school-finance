import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  page,
  totalPages,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const canPrev = page > 1;
  const canNext = page < totalPages;

  const btnBase =
    'flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors';
  const btnEnabled =
    'border-slate-300 bg-white text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700';
  const btnDisabled =
    'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300';

  return (
    <div className="flex items-center justify-between gap-4 pt-4">
      <button
        type="button"
        onClick={() => canPrev && onPageChange(page - 1)}
        disabled={!canPrev}
        aria-label="Previous page"
        className={[btnBase, canPrev ? btnEnabled : btnDisabled].join(' ')}
      >
        <ChevronLeft size={15} />
        Previous
      </button>

      <span className="text-sm text-slate-500">
        Page <span className="font-semibold text-slate-700">{page}</span> of{' '}
        <span className="font-semibold text-slate-700">{totalPages}</span>
      </span>

      <button
        type="button"
        onClick={() => canNext && onPageChange(page + 1)}
        disabled={!canNext}
        aria-label="Next page"
        className={[btnBase, canNext ? btnEnabled : btnDisabled].join(' ')}
      >
        Next
        <ChevronRight size={15} />
      </button>
    </div>
  );
}
