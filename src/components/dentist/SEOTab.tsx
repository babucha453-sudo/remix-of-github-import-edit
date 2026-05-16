import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Search,
  Globe,
  MapPin,
  Phone,
  Mail,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Eye,
  MousePointerClick,
  Star,
  Award,
  Video,
  Image
} from 'lucide-react';
import { useState } from 'react';

const SEOItem = ({ 
  label, 
  value, 
  status,
  description 
}: {
  label: string;
  value: string | number;
  status: 'good' | 'warning' | 'error';
  description: string;
}) => (
  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
    <div>
      <p className="font-medium text-gray-900">{label}</p>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-gray-900 font-medium">{value}</span>
      {status === 'good' && <CheckCircle className="h-5 w-5 text-emerald-500" />}
      {status === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-500" />}
      {status === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
    </div>
  </div>
);

export default function SEOTab() {
  const { user } = useAuth();

  const { data: clinic } = useQuery({
    queryKey: ['seo-clinic', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinics')
        .select('*')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: clinicHours } = useQuery({
    queryKey: ['clinic-hours', clinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinic_hours')
        .select('*')
        .eq('clinic_id', clinic?.id);
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  const { data: clinicImages } = useQuery({
    queryKey: ['clinic-images-seo', clinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinic_images')
        .select('*')
        .eq('clinic_id', clinic?.id);
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  const { data: clinicTreatments } = useQuery({
    queryKey: ['clinic-treatments', clinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinic_treatments')
        .select('*')
        .eq('clinic_id', clinic?.id);
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  const descriptionLength = clinic?.description?.length || 0;
  const hasCompleteHours = clinicHours && clinicHours.filter(h => !h.is_closed).length >= 5;
  const hasServices = clinicTreatments && clinicTreatments.length >= 3;
  const hasPhotos = clinicImages && clinicImages.length >= 5;

  const seoChecklist = [
    { id: 1, label: 'Profile Name', value: clinic?.name || 'Not set', status: clinic?.name ? 'good' as const : 'error' as const, description: 'Clinic name is set' },
    { id: 2, label: 'Address', value: clinic?.address ? 'Complete' : 'Missing', status: clinic?.address ? 'good' as const : 'error' as const, description: 'Full street address' },
    { id: 3, label: 'Phone Number', value: clinic?.phone ? 'Listed' : 'Missing', status: clinic?.phone ? 'good' as const : 'error' as const, description: 'Primary phone number' },
    { id: 4, label: 'Website', value: clinic?.website ? 'Linked' : 'Missing', status: clinic?.website ? 'good' as const : 'error' as const, description: 'Link to your website' },
    { id: 5, label: 'Business Hours', value: hasCompleteHours ? 'Complete' : 'Incomplete', status: hasCompleteHours ? 'good' as const : 'warning' as const, description: 'Hours set for weekdays' },
    { id: 6, label: 'Services', value: clinicTreatments?.length || 0, status: hasServices ? 'good' as const : 'warning' as const, description: 'At least 3 services listed' },
    { id: 7, label: 'Photos', value: clinicImages?.length || 0, status: hasPhotos ? 'good' as const : 'warning' as const, description: 'At least 5 photos' },
    { id: 8, label: 'Description', value: descriptionLength > 50 ? `${descriptionLength} chars` : 'Too short', status: descriptionLength > 50 ? 'good' as const : 'error' as const, description: 'At least 50 characters' },
    { id: 9, label: 'Google Business', value: clinic?.google_place_id ? 'Connected' : 'Not connected', status: clinic?.google_place_id ? 'good' as const : 'warning' as const, description: 'Google Business Profile linked' },
  ];

  const keywords = clinic?.id ? [
    { term: 'dentist in ' + (clinic.city || 'area'), volume: 'N/A', difficulty: 'medium', position: 'N/A' },
    { term: 'dental clinic near me', volume: 'N/A', difficulty: 'medium', position: 'N/A' },
    { term: 'emergency dentist', volume: 'N/A', difficulty: 'easy', position: 'N/A' },
  ] : [];

  const score = seoChecklist.filter(s => s.status === 'good').length;
  const maxScore = seoChecklist.length;
  const scorePercent = Math.round((score / maxScore) * 100);

  if (!clinic) {
    return (
      <Card className="bg-white border-gray-200">
        <CardContent className="py-12 text-center">
          <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No clinic linked to your account</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SEO & Visibility</h1>
          <p className="text-gray-500 mt-1">Improve your local search presence</p>
        </div>
        <Button variant="outline">
          <ExternalLink className="h-4 w-4 mr-2" />
          View on Google
        </Button>
      </div>

      {/* SEO Score */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-5xl font-bold text-gray-900 mb-2">{scorePercent}%</div>
              <p className="text-gray-500">Profile Optimization Score</p>
              <div className="mt-4 flex justify-center gap-1">
                {Array.from({ length: maxScore }).map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-2 w-6 rounded-full ${
                      i < score ? 'bg-emerald-500' : 'bg-gray-200'
                    }`} 
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Search Ranking</CardTitle>
            <CardDescription>Local pack position</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-gray-900">#5</p>
                <p className="text-sm text-gray-500">of 42 dentists</p>
              </div>
              <div className="flex items-center gap-2 text-emerald-600">
                <ArrowUpRight className="h-5 w-5" />
                <span>+2 this week</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Profile Health</CardTitle>
            <CardDescription>GMB listing status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Badge className="bg-emerald-100 text-emerald-700">
                <CheckCircle className="h-3 w-3 mr-1" />
                Verified
              </Badge>
              <span className="text-sm text-gray-500">Last updated today</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SEO Checklist */}
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Profile Checklist</CardTitle>
          <CardDescription>Complete all items to improve ranking</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {seoChecklist.map((item) => (
              <SEOItem key={item.id} {...item} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Keywords */}
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Keyword Rankings</CardTitle>
          <CardDescription>Track your search terms</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {keywords.length > 0 ? keywords.map((kw: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{kw.term}</p>
                  <p className="text-sm text-gray-500">{kw.volume} monthly searches</p>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="bg-gray-100">{kw.difficulty}</Badge>
                  <span className="font-bold text-gray-900">#{kw.position}</span>
                </div>
              </div>
            )) : (
              <div className="text-center py-6 text-gray-500">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p>Keyword tracking coming soon</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">SEO Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
              <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Add more photos</p>
                <p className="text-sm text-gray-500">Clinics with photos get 42% more clicks</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
              <TrendingUp className="h-5 w-5 text-emerald-500 shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Respond to reviews</p>
                <p className="text-sm text-gray-500">Reply to all reviews to boost ranking</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
              <Clock className="h-5 w-5 text-emerald-500 shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Keep hours updated</p>
                <p className="text-sm text-gray-500">Accurate hours improve trust signals</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}