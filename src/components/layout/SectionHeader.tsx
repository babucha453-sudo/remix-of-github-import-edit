import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  label?: string;
  title: string;
  highlight?: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
  dark?: boolean;
}

export const SectionHeader = ({
  label,
  title,
  highlight,
  description,
  align = "center",
  className,
  dark = false
}: SectionHeaderProps) => {
  return (
    <div className={cn(
      "mb-12",
      align === "center" && "text-center",
      className
    )}>
      {label && (
        <span className="text-primary text-sm font-bold uppercase tracking-wider">
          {label}
        </span>
      )}
      <h2 className={cn(
        "font-display text-3xl md:text-4xl font-bold mt-2",
        dark && "text-dark-section-foreground"
      )}>
        {title} {highlight && <span className="text-primary">{highlight}</span>}
      </h2>
      {description && (
        <p className={cn(
          "mt-4 max-w-2xl text-muted-foreground",
          align === "center" && "mx-auto"
        )}>
          {description}
        </p>
      )}
    </div>
  );
};
