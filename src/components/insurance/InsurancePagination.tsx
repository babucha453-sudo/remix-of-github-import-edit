import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { withTrailingSlash } from "@/lib/url/withTrailingSlash";

interface InsurancePaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
  onPageChange: (page: number) => void;
}

export function InsurancePagination({
  currentPage,
  totalPages,
  baseUrl,
  onPageChange,
}: InsurancePaginationProps) {
  if (totalPages <= 1) return null;

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const delta = 2; // Pages to show on each side of current

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - delta && i <= currentPage + delta)
      ) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== "ellipsis") {
        pages.push("ellipsis");
      }
    }

    return pages;
  };

  const buildPageUrl = (page: number) => {
    if (page === 1) return withTrailingSlash(baseUrl);
    return `${withTrailingSlash(baseUrl)}?page=${page}`;
  };

  const handlePageClick = (page: number, e: React.MouseEvent) => {
    e.preventDefault();
    onPageChange(page);
    // Scroll to top of results
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <nav
      className="flex items-center justify-center gap-1"
      aria-label="Pagination"
    >
      {/* Previous */}
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => handlePageClick(currentPage - 1, e)}
        disabled={currentPage === 1}
        className="gap-1"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Previous</span>
      </Button>

      {/* Page Numbers */}
      <div className="flex items-center gap-1">
        {getPageNumbers().map((page, index) =>
          page === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="px-2 text-muted-foreground"
            >
              …
            </span>
          ) : (
            <a
              key={page}
              href={buildPageUrl(page)}
              onClick={(e) => handlePageClick(page, e)}
              className={`h-9 w-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                page === currentPage
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
              aria-current={page === currentPage ? "page" : undefined}
            >
              {page}
            </a>
          )
        )}
      </div>

      {/* Next */}
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => handlePageClick(currentPage + 1, e)}
        disabled={currentPage === totalPages}
        className="gap-1"
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
