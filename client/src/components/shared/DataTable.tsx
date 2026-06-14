import React from 'react';
import { Inbox } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Column<T = any> {
  /** Column heading text */
  header: string;
  /** Key on the data row, or a dot-path string */
  accessor: keyof T | string;
  /** Custom cell renderer. Receives the row value and the full row. */
  render?: (value: unknown, row: T) => React.ReactNode;
  /** Optional CSS class(es) applied to <th> and <td> for this column */
  className?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface DataTableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  /** Number of skeleton rows shown while loading (default: 5) */
  skeletonRows?: number;
  /** Unique key extractor. Falls back to row index. */
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
        <td key={i} className="px-4 py-3">
          <div className="h-4 w-3/4 rounded bg-slate-200" />
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
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((col, i) => (
              <th
                key={i}
                scope="col"
                className={[
                  'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500',
                  col.className ?? '',
                ].join(' ')}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white">
          {/* Loading skeleton */}
          {isLoading &&
            Array.from({ length: skeletonRows }).map((_, i) => (
              <SkeletonRow key={i} cols={columns.length} />
            ))}

          {/* Empty state */}
          {!isLoading && data.length === 0 && (
            <tr>
              <td colSpan={columns.length}>
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
                  <Inbox size={36} strokeWidth={1.5} />
                  <span className="text-sm">{emptyMessage}</span>
                </div>
              </td>
            </tr>
          )}

          {/* Data rows */}
          {!isLoading &&
            data.map((row, rowIndex) => {
              const key = rowKey ? rowKey(row, rowIndex) : rowIndex;
              return (
                <tr
                  key={key}
                  className="transition-colors hover:bg-slate-50"
                >
                  {columns.map((col, colIndex) => {
                    const rawValue = getNestedValue(row, col.accessor as string);
                    const cell = col.render
                      ? col.render(rawValue, row)
                      : rawValue != null
                        ? String(rawValue)
                        : '—';

                    return (
                      <td
                        key={colIndex}
                        className={[
                          'whitespace-nowrap px-4 py-3 text-slate-700',
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
