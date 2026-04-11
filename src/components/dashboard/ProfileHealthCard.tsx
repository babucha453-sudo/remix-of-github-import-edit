import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Shield, 
  CheckCircle, 
  XCircle,
  Globe,
  Image,
  Clock,
  FileText,
  Phone,
  Mail,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfileHealthCardProps {
  clinicId: string;
  verificationStatus?: string;
  gmbConnected?: boolean;
  onImprove?: () => void;
}

interface CheckItem {
  label: string;
  icon: typeof Shield;
  completed: boolean;
}

export default function ProfileHealthCard({ 
  clinicId, 
  verificationStatus,
  gmbConnected,
  onImprove 
}: ProfileHealthCardProps) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile-health', clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinics')
        .select('*, clinic_hours(*), clinic_images(*)')
        .eq('id', clinicId)
        .single();
      return data;
    },
    enabled: !!clinicId,
  });

  if (isLoading) {
    return (
      <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg">
        <CardContent className="p-6">
          <Skeleton className="h-48 w-full bg-slate-700" />
        </CardContent>
      </Card>
    );
  }

  const checks: CheckItem[] = [
    { label: 'Clinic name', icon: FileText, completed: !!profile?.name },
    { label: 'Description', icon: FileText, completed: !!profile?.description },
    { label: 'Address', icon: MapPin, completed: !!profile?.address },
    { label: 'Phone number', icon: Phone, completed: !!profile?.phone },
    { label: 'Email', icon: Mail, completed: !!profile?.email },
    { label: 'Cover image', icon: Image, completed: !!profile?.cover_image_url },
    { label: 'Business hours', icon: Clock, completed: (profile?.clinic_hours?.length || 0) > 0 },
    { label: 'Gallery photos', icon: Image, completed: (profile?.clinic_images?.length || 0) > 0 },
    { label: 'GMB connected', icon: Globe, completed: !!gmbConnected },
    { label: 'Verified badge', icon: Shield, completed: verificationStatus === 'verified' },
  ];

  const completedCount = checks.filter(c => c.completed).length;
  const completeness = Math.round((completedCount / checks.length) * 100);
  const incompleteItems = checks.filter(c => !c.completed);

  const healthStatus = completeness >= 90 ? 'excellent' : completeness >= 70 ? 'good' : completeness >= 50 ? 'fair' : 'needs_work';
  
  const statusConfig = {
    excellent: { label: 'Excellent', color: 'text-teal', bgColor: 'bg-teal/20', borderColor: 'border-teal/40', ringColor: 'text-teal', barColor: 'bg-teal' },
    good: { label: 'Good', color: 'text-primary', bgColor: 'bg-primary/20', borderColor: 'border-primary/40', ringColor: 'text-primary', barColor: 'bg-primary' },
    fair: { label: 'Fair', color: 'text-gold', bgColor: 'bg-gold/20', borderColor: 'border-gold/40', ringColor: 'text-gold', barColor: 'bg-gold' },
    needs_work: { label: 'Needs Work', color: 'text-coral', bgColor: 'bg-coral/20', borderColor: 'border-coral/40', ringColor: 'text-coral', barColor: 'bg-coral' },
  };

  const config = statusConfig[healthStatus];

  return (
    <Card className="bg-slate-800/90 border border-slate-700/50 shadow-lg overflow-hidden">
      {/* Accent bar */}
      <div className={cn('h-1', config.barColor)} />
      
      <div className="relative p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', config.bgColor)}>
              <Shield className={cn('h-4 w-4', config.color)} />
            </div>
            <h3 className="text-lg font-bold text-white">Profile Health</h3>
          </div>
          <Badge className={cn('border text-xs', config.bgColor, config.color, config.borderColor)}>
            {config.label}
          </Badge>
        </div>

        {/* Progress circle */}
        <div className="flex items-center gap-5">
          <div className="relative h-20 w-20 flex-shrink-0">
            <svg className="h-20 w-20 -rotate-90">
              <circle
                className="text-slate-700/50"
                strokeWidth="8"
                stroke="currentColor"
                fill="transparent"
                r="32"
                cx="40"
                cy="40"
              />
              <circle
                className={cn('transition-all duration-700', config.ringColor)}
                strokeWidth="8"
                strokeDasharray={`${completeness * 2.01} 201`}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r="32"
                cx="40"
                cy="40"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold text-white">{completeness}%</span>
            </div>
          </div>

          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium text-white">
              {completedCount} of {checks.length} complete
            </p>
            <Progress value={completeness} className="h-2 bg-slate-700/50" />
            {completeness < 100 && (
              <p className="text-xs text-white/50">
                Complete profile to rank higher
              </p>
            )}
          </div>
        </div>
      </div>

      <CardContent className="p-4 bg-slate-900/50 border-t border-slate-700/50">
        {/* Missing items */}
        {incompleteItems.length > 0 && (
          <div className="space-y-2 mb-3">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              Missing
            </p>
            <div className="flex flex-wrap gap-1.5">
              {incompleteItems.slice(0, 3).map((item, index) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="bg-coral/10 border-coral/30 text-coral text-[10px]"
                >
                  <XCircle className="h-2.5 w-2.5 mr-1" />
                  {item.label}
                </Badge>
              ))}
              {incompleteItems.length > 3 && (
                <Badge variant="outline" className="text-[10px] bg-slate-700/30 border-slate-600/30 text-white/50">
                  +{incompleteItems.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Status badges */}
        <div className="flex flex-wrap gap-1.5">
          {verificationStatus === 'verified' ? (
            <Badge className="bg-teal/20 text-teal border-teal/30 border text-[10px]">
              <CheckCircle className="h-2.5 w-2.5 mr-1" /> Verified
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-slate-700/30 border-slate-600/30 text-white/50 text-[10px]">
              <Shield className="h-2.5 w-2.5 mr-1" /> Not Verified
            </Badge>
          )}
          {gmbConnected ? (
            <Badge className="bg-teal/20 text-teal border-teal/30 border text-[10px]">
              <Globe className="h-2.5 w-2.5 mr-1" /> GMB
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-slate-700/30 border-slate-600/30 text-white/50 text-[10px]">
              <Globe className="h-2.5 w-2.5 mr-1" /> No GMB
            </Badge>
          )}
        </div>

        {onImprove && completeness < 100 && (
          <Button 
            className="w-full mt-3 bg-teal hover:bg-teal/90 text-white font-bold"
            onClick={onImprove}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Improve Profile
          </Button>
        )}
      </CardContent>
    </Card>
  );
}