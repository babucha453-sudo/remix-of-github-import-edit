import { memo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildServiceUrl } from "@/lib/url/buildProfileUrl";

interface ServiceCardProps {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  clinicCount?: number;
  className?: string;
  variant?: "default" | "compact";
}

export const ServiceCard = ({
  name,
  slug,
  description,
  clinicCount,
  className,
  variant = "default"
}: ServiceCardProps) => {
  const href = buildServiceUrl(slug);

  if (variant === "compact") {
    return (
      <Link 
        to={href}
        className={cn(
          "treatment-pill flex items-center gap-2 group",
          className
        )}
      >
        <span>{name}</span>
        <ArrowRight className="h-4 w-4 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" />
      </Link>
    );
  }

  return (
    <Link 
      to={href}
      className={cn(
        "card-modern p-6 card-hover group",
        className
      )}
    >
      <h3 className="font-display text-lg font-bold text-foreground group-hover:text-primary transition-colors">
        {name}
      </h3>
      
      {description && (
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
          {description}
        </p>
      )}
      
      {clinicCount !== undefined && (
        <p className="mt-3 text-sm font-medium text-primary">
          {clinicCount} clinics offering this service
        </p>
      )}
      
      <div className="flex items-center gap-1 mt-4 text-sm font-bold text-primary">
        Learn More
        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  );
};

export const ServiceCardMemo = memo(ServiceCard);
