import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "muted" | "dark" | "gradient" | "primary";
  size?: "sm" | "md" | "lg" | "xl";
}

export const Section = forwardRef<HTMLElement, SectionProps>(
  ({ children, className, variant = "default", size = "lg", ...props }, ref) => {
    const sizeClasses = {
      sm: "py-12",
      md: "py-16",
      lg: "py-20",
      xl: "py-28"
    };

    const variantClasses = {
      default: "bg-background",
      muted: "bg-muted/30",
      dark: "bg-dark-section text-dark-section-foreground",
      gradient: "gradient-hero",
      primary: "bg-gradient-to-r from-primary to-teal-dark text-primary-foreground"
    };

    return (
      <section
        ref={ref}
        className={cn(sizeClasses[size], variantClasses[variant], className)}
        {...props}
      >
        <div className="container">
          {children}
        </div>
      </section>
    );
  }
);

Section.displayName = "Section";
