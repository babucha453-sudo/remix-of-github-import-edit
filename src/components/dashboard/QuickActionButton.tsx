import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuickActionButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  color?: 'primary' | 'teal' | 'gold' | 'coral' | 'purple' | 'blue';
  variant?: 'default' | 'outline';
  className?: string;
}

export default function QuickActionButton({
  icon: Icon,
  label,
  onClick,
  color = 'primary',
  variant = 'outline',
  className,
}: QuickActionButtonProps) {
  const colorClasses = {
    primary: 'hover:bg-primary/5 hover:border-primary/30 [&>svg]:text-primary',
    teal: 'hover:bg-teal/5 hover:border-teal/30 [&>svg]:text-teal',
    gold: 'hover:bg-gold/5 hover:border-gold/30 [&>svg]:text-gold',
    coral: 'hover:bg-coral/5 hover:border-coral/30 [&>svg]:text-coral',
    purple: 'hover:bg-purple/5 hover:border-purple/30 [&>svg]:text-purple',
    blue: 'hover:bg-blue-custom/5 hover:border-blue-custom/30 [&>svg]:text-blue-custom',
  };

  return (
    <Button
      variant={variant}
      className={cn(
        'h-auto py-3 px-4 flex flex-col items-center gap-2 rounded-xl transition-all',
        colorClasses[color],
        className
      )}
      onClick={onClick}
    >
      <Icon className="h-5 w-5" />
      <span className="text-xs font-medium">{label}</span>
    </Button>
  );
}
