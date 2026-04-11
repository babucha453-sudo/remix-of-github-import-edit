import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { withTrailingSlash } from "@/lib/url/withTrailingSlash";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumbs = ({ items, className }: BreadcrumbsProps) => {
  return (
    <nav 
      aria-label="Breadcrumb" 
      className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}
    >
      <Link 
        to="/" 
        className="hover:text-primary transition-colors flex items-center gap-1"
      >
        <Home className="h-4 w-4" />
        <span className="sr-only">Home</span>
      </Link>
      
      {items.map((item, index) => {
        const href = item.href ? withTrailingSlash(item.href) : undefined;
        return (
        <div key={index} className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4 text-border" />
          {href && index !== items.length - 1 ? (
            <Link 
              to={href} 
              className="hover:text-primary transition-colors font-medium"
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-foreground">{item.label}</span>
          )}
        </div>
      );
      })}
    </nav>
  );
};
