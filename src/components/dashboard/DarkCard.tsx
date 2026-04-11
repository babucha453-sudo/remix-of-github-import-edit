import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DarkCardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'gradient' | 'glow' | 'bordered' | 'glass' | 'elevated';
  glowColor?: 'primary' | 'teal' | 'gold' | 'coral' | 'purple' | 'blue' | 'emerald' | 'pink';
  onClick?: () => void;
  noPadding?: boolean;
}

export default function DarkCard({
  children,
  className,
  variant = 'default',
  glowColor = 'primary',
  onClick,
  noPadding = false,
}: DarkCardProps) {
  const glowClasses = {
    primary: 'shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.15)]',
    teal: 'shadow-[0_8px_32px_-8px_hsl(var(--teal)/0.15)]',
    gold: 'shadow-[0_8px_32px_-8px_hsl(var(--gold)/0.15)]',
    coral: 'shadow-[0_8px_32px_-8px_hsl(var(--coral)/0.15)]',
    purple: 'shadow-[0_8px_32px_-8px_hsl(var(--purple)/0.15)]',
    blue: 'shadow-[0_8px_32px_-8px_hsl(var(--blue)/0.15)]',
    emerald: 'shadow-[0_8px_32px_-8px_hsl(var(--emerald)/0.15)]',
    pink: 'shadow-[0_8px_32px_-8px_hsl(var(--pink)/0.15)]',
  };

  const accentBorderClasses = {
    primary: 'border-2 border-primary/25',
    teal: 'border-2 border-teal/25',
    gold: 'border-2 border-gold/25',
    coral: 'border-2 border-coral/25',
    purple: 'border-2 border-purple/25',
    blue: 'border-2 border-blue/25',
    emerald: 'border-2 border-emerald/25',
    pink: 'border-2 border-pink/25',
  };

  const gradientTopClasses = {
    primary: 'from-primary via-primary/80 to-teal',
    teal: 'from-teal via-teal/80 to-emerald',
    gold: 'from-gold via-amber-500 to-orange-400',
    coral: 'from-coral via-rose-500 to-pink',
    purple: 'from-purple via-violet-500 to-indigo',
    blue: 'from-blue-custom via-blue-500 to-cyan',
    emerald: 'from-emerald via-teal to-cyan',
    pink: 'from-pink via-rose-400 to-coral',
  };

  const baseClasses = cn(
    'relative overflow-hidden rounded-2xl',
    'bg-card',
    'transition-all duration-300',
    onClick && 'cursor-pointer hover:scale-[1.01] active:scale-[0.99]',
  );

  const variantClasses = {
    default: 'border border-border shadow-sm hover:shadow-md',
    gradient: cn(
      'bg-gradient-to-br from-card via-muted/10 to-card',
      'border border-border/50',
      'shadow-md hover:shadow-lg'
    ),
    glow: cn(
      glowClasses[glowColor], 
      accentBorderClasses[glowColor],
      'hover:shadow-lg'
    ),
    bordered: cn(
      accentBorderClasses[glowColor],
      'shadow-sm hover:shadow-md'
    ),
    glass: cn(
      'bg-white/80 backdrop-blur-xl',
      'border border-white/50',
      'shadow-lg hover:shadow-xl'
    ),
    elevated: cn(
      'border border-border/50',
      'shadow-lg hover:shadow-xl',
      'bg-gradient-to-br from-card to-card/95'
    ),
  };

  return (
    <div
      className={cn(baseClasses, variantClasses[variant], className)}
      onClick={onClick}
    >
      {/* Gradient accent line at top for glow/bordered variants */}
      {(variant === 'glow' || variant === 'bordered') && (
        <div className={cn(
          'absolute top-0 left-0 right-0 h-1 bg-gradient-to-r rounded-t-2xl',
          gradientTopClasses[glowColor]
        )} />
      )}

      {/* Decorative gradient orb */}
      {(variant === 'glow' || variant === 'elevated') && (
        <div className={cn(
          'absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-10 pointer-events-none',
          glowColor === 'primary' && 'bg-primary',
          glowColor === 'teal' && 'bg-teal',
          glowColor === 'gold' && 'bg-gold',
          glowColor === 'coral' && 'bg-coral',
          glowColor === 'purple' && 'bg-purple',
          glowColor === 'blue' && 'bg-blue-custom',
          glowColor === 'emerald' && 'bg-emerald',
          glowColor === 'pink' && 'bg-pink',
        )} />
      )}

      {/* Content */}
      <div className={cn('relative z-10', !noPadding && 'p-6')}>
        {children}
      </div>
    </div>
  );
}