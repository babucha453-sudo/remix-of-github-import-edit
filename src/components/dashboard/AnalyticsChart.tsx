import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';

interface ChartDataPoint {
  label: string;
  value: number;
  highlight?: boolean;
}

interface AnalyticsChartProps {
  title: string;
  data: ChartDataPoint[];
  className?: string;
  highlightLabel?: string;
}

export default function AnalyticsChart({
  title,
  data,
  className,
  highlightLabel,
}: AnalyticsChartProps) {
  const maxValue = Math.max(...data.map(d => d.value));

  return (
    <div className={cn('bg-card rounded-2xl border border-border/50 p-5', className)}>
      <h3 className="font-bold text-foreground mb-6">{title}</h3>
      
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="30%">
            <XAxis 
              dataKey="label" 
              axisLine={false} 
              tickLine={false}
              tick={{ 
                fill: 'hsl(var(--muted-foreground))', 
                fontSize: 12,
                fontWeight: 500 
              }}
            />
            <YAxis hide />
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-foreground text-background px-3 py-1.5 rounded-lg text-sm font-medium shadow-lg">
                      {payload[0].value}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar 
              dataKey="value" 
              radius={[8, 8, 8, 8]}
              fill="hsl(var(--primary))"
              className="transition-all"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {highlightLabel && (
        <div className="mt-4 flex items-center justify-center">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-xs font-medium text-primary">{highlightLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
}
