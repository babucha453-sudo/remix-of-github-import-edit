import { Sparkles, Percent, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PromotionBannerProps {
  variant?: 'inline' | 'banner' | 'compact';
  className?: string;
}

export function PromotionBanner({ variant = 'banner', className }: PromotionBannerProps) {
  if (variant === 'compact') {
    return (
      <Badge className={cn(
        "bg-gradient-to-r from-red-500 to-orange-500 text-white border-0 px-3 py-1 font-bold animate-pulse",
        className
      )}>
        <Percent className="h-3 w-3 mr-1" />
        50% OFF
      </Badge>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30",
        className
      )}>
        <Sparkles className="h-4 w-4 text-red-500" />
        <span className="text-sm font-bold text-red-600">
          Limited Time: 50% OFF All Plans!
        </span>
      </div>
    );
  }

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 p-[2px]",
      className
    )}>
      <div className="relative rounded-2xl bg-background/95 backdrop-blur-sm px-6 py-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
              <Percent className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-lg">
                  🎉 50% OFF Launch Promotion
                </h3>
                <Badge className="bg-red-500 text-white border-0 animate-pulse">
                  Limited Time
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                Get started at half price! All monthly plans discounted for new subscribers.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Offer ends soon</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper to calculate discounted price
export function getDiscountedPrice(originalPrice: number): { original: number; discounted: number; savings: number } {
  const discounted = Math.round(originalPrice * 0.5);
  return {
    original: originalPrice,
    discounted,
    savings: originalPrice - discounted,
  };
}

export default PromotionBanner;
