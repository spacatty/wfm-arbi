"use client";

import { useMemo } from "react";
import { TableHead } from "@/components/ui/table";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

export type SortDir = "asc" | "desc";
export type SortState<T extends string> = { col: T; dir: SortDir } | null;

interface SortableHeadProps<T extends string> {
  column: T;
  sort: SortState<T>;
  onSort: (col: T) => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * Clickable table header with sort indicator arrows.
 * Cycles: asc → desc → off (back to default).
 */
export function SortableHead<T extends string>({
  column,
  sort,
  onSort,
  children,
  className = "",
}: SortableHeadProps<T>) {
  const active = sort?.col === column;
  const dir = active ? sort.dir : null;

  return (
    <TableHead
      className={`text-xs font-mono h-8 px-2 cursor-pointer select-none hover:text-foreground transition-colors ${className}`}
      onClick={() => onSort(column)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {dir === "asc" ? (
          <ArrowUp className="size-3 text-primary" />
        ) : dir === "desc" ? (
          <ArrowDown className="size-3 text-primary" />
        ) : (
          <ArrowUpDown className="size-3 opacity-30" />
        )}
      </span>
    </TableHead>
  );
}

/**
 * Generic sort toggler: asc → desc → null (reset).
 */
export function toggleSort<T extends string>(
  current: SortState<T>,
  col: T
): SortState<T> {
  if (current?.col !== col) return { col, dir: "desc" };
  if (current.dir === "desc") return { col, dir: "asc" };
  return null; // reset
}

/**
 * Sort an array of items by a given column.
 * Supports number, string, and date-like values.
 */
export function useSorted<TItem, TCol extends string>(
  items: TItem[],
  sort: SortState<TCol>,
  accessor: (item: TItem, col: TCol) => number | string | Date | null | undefined
): TItem[] {
  return useMemo(() => {
    if (!sort) return items;
    const { col, dir } = sort;
    const mult = dir === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      const va = accessor(a, col);
      const vb = accessor(b, col);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * mult;
      }
      if (va instanceof Date && vb instanceof Date) {
        return (va.getTime() - vb.getTime()) * mult;
      }
      return String(va).localeCompare(String(vb)) * mult;
    });
  }, [items, sort, accessor]);
}
