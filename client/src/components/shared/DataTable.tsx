import React from 'react';
import { Inbox } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Column<T = any> {
  header: string;
  accessor: keyof T | string;
  render?: (value: unknown, row: T) => React.ReactNode;
  className?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface DataTableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  skeletonRows?: number;
  rowKey?: (row: T, index: number) => React.Key;
}

function getNestedValue(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        acc != null && typeof acc === 'object'
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      obj,
    );
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <div
            className="h-3.5 rounded-full bg-slate-100"
            style={{ width: `${55 + (i * 17) % 35}%` }}
          />
        </td>
      ))}
    </tr>
  );
}

export default function DataTable<T>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No records found.',
  skeletonRows = 5,
  rowKey,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            {columns.map((col, i) => (
              <th
                key={i}
                scope="col"
                className={[
                  'px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400',
                  col.className ?? '',
                ].join(' ')}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {isLoading &&
            Array.from({ length: skeletonRows }).map((_, i) => (
              <SkeletonRow key={i} cols={columns.length} />
            ))}

          {!isLoading && data.length === 0 && (
            <tr>
              <td colSpan={columns.length}>
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                    <Inbox size={28} strokeWidth={1.5} />
                  </div>
                  <p className="text-sm text-slate-400">{emptyMessage}</p>
                </div>
              </td>
            </tr>
          )}

          {!isLoading &&
            data.map((row, rowIndex) => {
              const key = rowKey ? rowKey(row, rowIndex) : rowIndex;
              return (
                <tr
                  key={key}
                  className={[
                    'border-b border-slate-100 transition-colors',
                    rowIndex % 2 === 1 ? 'bg-slate-50/50' : 'bg-white',
                    'hover:bg-brand-50/40',
                  ].join(' ')}
                >
                  {columns.map((col, colIndex) => {
                    const rawValue = getNestedValue(row, col.accessor as string);
                    const cell = col.render
                      ? col.render(rawValue, row)
                      : rawValue != null
                        ? String(rawValue)
                        : <span className="text-slate-300">—</span>;

                    return (
                      <td
                        key={colIndex}
                        className={[
                          'whitespace-nowrap px-4 py-3.5 text-slate-700',
                          col.className ?? '',
                        ].join(' ')}
                      >
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
