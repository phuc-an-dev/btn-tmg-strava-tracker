"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { ResponsivePicker } from "./mobile-drawer";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  pageSizeLabel?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  pageSizeLabel = "Số mục mỗi trang",
  ariaLabel = "Phân trang",
  className = "",
  disabled = false,
}: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), safeTotalPages);

  return (
    <nav className={`pagination-bar member-pagination ${className}`.trim()} aria-label={ariaLabel}>
      {pageSize && onPageSizeChange ? (
        <ResponsivePicker
          label={pageSizeLabel}
          value={String(pageSize)}
          disabled={disabled}
          onChange={value => {
            const nextSize = Number(value);
            if (!Number.isNaN(nextSize) && nextSize > 0) {
              onPageSizeChange(nextSize);
            }
          }}
          options={pageSizeOptions.map(size => ({
            value: String(size),
            label: `${size} / trang`,
          }))}
        />
      ) : pageSize ? (
        <span className="pagination-static-size" aria-label={`Hiển thị ${pageSize} mục mỗi trang`}>
          {pageSize} / trang
        </span>
      ) : null}

      <button
        type="button"
        className="pagination-btn pagination-prev icon-button"
        aria-label="Trang trước"
        disabled={disabled || safeCurrentPage <= 1}
        onClick={() => onPageChange(safeCurrentPage - 1)}
      >
        <ChevronLeft size={20} />
      </button>

      <span className="pagination-indicator" aria-live="polite">
        Trang {safeCurrentPage} / {safeTotalPages}
      </span>

      <button
        type="button"
        className="pagination-btn pagination-next icon-button"
        aria-label="Trang sau"
        disabled={disabled || safeCurrentPage >= safeTotalPages}
        onClick={() => onPageChange(safeCurrentPage + 1)}
      >
        <ChevronRight size={20} />
      </button>
    </nav>
  );
}
