import { cn } from "@/lib/utils";
import { Breadcrumbs } from "./Breadcrumbs";
import { CheckCircle } from "lucide-react";
import { motion } from "framer-motion";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeroProps {
  title: string;
  highlight?: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  badge?: string;
  children?: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const PageHero = ({
  title,
  highlight,
  description,
  breadcrumbs,
  badge,
  children,
  className,
  size = "md"
}: PageHeroProps) => {
  const sizeClasses = {
    sm: "py-8 md:py-12",
    md: "py-10 md:py-16 lg:py-20",
    lg: "py-12 md:py-20 lg:py-28"
  };

  return (
    <section className={cn(
      "relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/20",
      sizeClasses[size],
      className
    )}>
      {/* Enhanced decorative elements with animations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute -top-20 -right-20 w-64 md:w-[400px] lg:w-[500px] h-64 md:h-[400px] lg:h-[500px] bg-primary/8 rounded-full blur-3xl"
          animate={{ scale: [1, 1.1, 1], opacity: [0.08, 0.12, 0.08] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute -bottom-20 -left-20 w-56 md:w-[320px] lg:w-[400px] h-56 md:h-[320px] lg:h-[400px] bg-accent/30 rounded-full blur-3xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.4, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        <motion.div 
          className="absolute top-1/3 right-1/4 w-16 md:w-24 h-16 md:h-24 bg-gold/10 rounded-full blur-xl"
          animate={{ y: [-5, 5, -5] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute bottom-1/4 left-1/3 w-12 md:w-16 h-12 md:h-16 bg-primary/10 rounded-full blur-lg"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
      </div>

      <div className="container relative z-10 px-4">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Breadcrumbs items={breadcrumbs} className="mb-4 md:mb-6" />
          </motion.div>
        )}
        
        <div className="max-w-4xl">
          {/* Badge */}
          {badge && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 bg-primary/10 backdrop-blur-sm border border-primary/20 rounded-full px-3 md:px-4 py-1.5 md:py-2 mb-4 md:mb-6 shadow-sm"
            >
              <CheckCircle className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
              <span className="text-xs md:text-sm font-bold text-primary">{badge}</span>
            </motion.div>
          )}

          {/* Bold Round Headline - Mobile optimized with balanced text */}
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <span 
              className="block text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-foreground tracking-tight leading-[1.1] text-balance" 
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", textWrap: 'balance' }}
            >
              {title}
            </span>
            {highlight && (
              <span 
                className="block text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight leading-[1.1] mt-1 text-balance" 
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", textWrap: 'balance' }}
              >
                <span className="text-primary">{highlight}</span>
              </span>
            )}
          </motion.h1>
          
          {description && (
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-4 md:mt-6 text-sm md:text-base lg:text-lg xl:text-xl text-muted-foreground max-w-2xl font-medium"
            >
              {description}
            </motion.p>
          )}
          
          {children && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-6 md:mt-8"
            >
              {children}
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
};