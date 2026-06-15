import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-100">
      <button
        type="button"
        onClick={() => canPrev && onPageChange(page - 1)}
        disabled={!canPrev}
        aria-label="Previous page"
        className={[
          'flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition-all',
          canPrev
            ? 'border-slate-200 bg-white text-slate-700 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 shadow-sm'
            : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300',
        ].join(' ')}
      >
        <ChevronLeft size={15} />
        Previous
      </button>

      <span className="text-sm text-slate-400">
        Page <span className="font-bold text-slate-700">{page}</span> of{' '}
        <span className="font-bold text-slate-700">{totalPages}</span>
      </span>

      <button
        type="button"
        onClick={() => canNext && onPageChange(page + 1)}
        disabled={!canNext}
        aria-label="Next page"
        className={[
          'flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition-all',
          canNext
            ? 'border-slate-200 bg-white text-slate-700 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 shadow-sm'
            : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300',
        ].join(' ')}
      >
        Next
        <ChevronRight size={15} />
      </button>
    </div>
  );
}
