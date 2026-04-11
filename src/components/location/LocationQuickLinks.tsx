import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Stethoscope, 
  MapPin, 
  ArrowRight,
  Sparkles
} from "lucide-react";
import { withTrailingSlash } from "@/lib/url/withTrailingSlash";

interface LocationQuickLinksProps {
  variant: "treatments" | "nearby" | "services";
  title?: string;
  stateSlug?: string;
  citySlug?: string;
  items: { name: string; slug: string }[];
  locationName?: string;
}

/**
 * LocationQuickLinks - A compact, horizontal scrolling link section
 * For displaying treatment or nearby location links.
 * SEO-friendly with proper nav and link semantics.
 */
export const LocationQuickLinks = ({
  variant,
  title,
  stateSlug,
  citySlug,
  items,
  locationName,
}: LocationQuickLinksProps) => {
  if (!items || items.length === 0) return null;

  const getIcon = () => {
    switch (variant) {
      case "treatments":
        return <Stethoscope className="h-4 w-4 text-primary" />;
      case "nearby":
        return <MapPin className="h-4 w-4 text-primary" />;
      case "services":
        return <Sparkles className="h-4 w-4 text-primary" />;
      default:
        return <ArrowRight className="h-4 w-4 text-primary" />;
    }
  };

  const getDefaultTitle = () => {
    switch (variant) {
      case "treatments":
        return `Dental Services${locationName ? ` in ${locationName}` : ''}`;
      case "nearby":
        return "Nearby Cities";
      case "services":
        return "Related Services";
      default:
        return "Quick Links";
    }
  };

  const buildLink = (item: { name: string; slug: string }) => {
    switch (variant) {
      case "treatments":
        return withTrailingSlash(
          citySlug && stateSlug
            ? `/${stateSlug}/${citySlug}/${item.slug}`
            : `/services/${item.slug}`
        );
      case "nearby":
        return withTrailingSlash(stateSlug ? `/${stateSlug}/${item.slug}` : `/${item.slug}`);
      case "services":
        return withTrailingSlash(`/services/${item.slug}`);
      default:
        return withTrailingSlash(`/${item.slug}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl p-4 md:p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        {getIcon()}
        <h3 className="font-bold text-sm md:text-base text-foreground">
          {title || getDefaultTitle()}
        </h3>
      </div>
      
      <nav 
        className="flex flex-wrap gap-2" 
        aria-label={title || getDefaultTitle()}
      >
        {items.slice(0, 8).map((item, index) => (
          <Link
            key={item.slug}
            to={buildLink(item)}
            className={`
              inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all
              ${variant === "treatments" 
                ? "bg-primary/10 text-primary hover:bg-primary/20" 
                : "bg-muted text-foreground hover:bg-muted/80"
              }
            `}
          >
            {variant === "nearby" && <MapPin className="h-3 w-3" />}
            {item.name}
          </Link>
        ))}
      </nav>
    </motion.div>
  );
};

export default LocationQuickLinks;
