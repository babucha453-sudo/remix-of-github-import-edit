import { cn } from '@/lib/utils';

interface CircularProgressProps {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  sublabel?: string;
  className?: string;
}

export default function CircularProgress({
  value,
  size = 'md',
  label,
  sublabel,
  className,
}: CircularProgressProps) {
  const sizeConfig = {
    sm: { container: 'h-24 w-24', text: 'text-2xl', stroke: 8, radius: 40 },
    md: { container: 'h-32 w-32', text: 'text-3xl', stroke: 10, radius: 55 },
    lg: { container: 'h-44 w-44', text: 'text-4xl', stroke: 12, radius: 75 },
  };

  const config = sizeConfig[size];
  const circumference = 2 * Math.PI * config.radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className={cn('relative', config.container)}>
        <svg className="transform -rotate-90 w-full h-full">
          {/* Background circle */}
          <circle
            cx="50%"
            cy="50%"
            r={config.radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={config.stroke}
          />
          {/* Progress circle */}
          <circle
            cx="50%"
            cy="50%"
            r={config.radius}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={config.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500 ease-out"
          />
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('font-extrabold text-foreground', config.text)}>
            {value}%
          </span>
          {label && (
            <span className="text-xs text-muted-foreground font-medium">{label}</span>
          )}
        </div>
      </div>
      {sublabel && (
        <p className="mt-3 text-sm text-muted-foreground text-center">{sublabel}</p>
      )}
    </div>
  );
}
