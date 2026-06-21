import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationBarProps {
  page: number
  pageCount: number
  onPage: (p: number) => void
}

function buildPages(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const result: (number | '...')[] = [1]
  if (current > 3) result.push('...')
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    result.push(p)
  }
  if (current < total - 2) result.push('...')
  result.push(total)
  return result
}

export function PaginationBar({ page, pageCount, onPage }: PaginationBarProps) {
  if (pageCount <= 1) return null
  return (
    <div className="flex items-center justify-center gap-1.5 pt-6">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
        className="p-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {buildPages(page, pageCount).map((p, i) =>
        p === '...' ? (
          <span key={`e${i}`} className="w-8 text-center text-xs text-muted-foreground select-none">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${
              p === page
                ? 'bg-[var(--primary)] text-white shadow-sm'
                : 'border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onPage(page + 1)}
        disabled={page === pageCount}
        className="p-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
