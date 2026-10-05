import { useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./states";

export function DataTable<T>({
  data,
  columns,
  caption,
}: {
  data: T[];
  columns: ColumnDef<T>[];
  caption: string;
}) {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const table = useReactTable({
    data,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  if (!data.length)
    return (
      <EmptyState
        title="No students match these filters"
        description="Try a different support status, trend, or search to see more students."
      />
    );
  return (
    <>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Scrollable student table"
      >
        <table>
          <caption className="sr-only">{caption}</caption>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th scope="col" key={header.id}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>
          {pagination.pageIndex * pagination.pageSize + 1}–
          {Math.min(
            (pagination.pageIndex + 1) * pagination.pageSize,
            data.length,
          )}{" "}
          of {data.length} students
        </span>
        <div className="pagination">
          <Button
            variant="outline"
            size="icon"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </Button>
          <span>
            Page {pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </>
  );
}
