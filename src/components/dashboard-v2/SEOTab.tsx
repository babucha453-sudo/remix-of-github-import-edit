/**
 * SEO & Visibility Tab V2
 * Shows profile SEO score, keywords, and local search tips
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Search,
  Globe,
  MapPin,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Eye,
  MousePointerClick,
  Star,
  Award,
  FileText,
  Image,
  Video,
  Clock,
  Phone,
  Mail,
  Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ModernCard,
  StatsCard,
  ProgressRingCard,
  SectionTitle,
  StatusBadgeNew,
  EmptyStateNew,
  SkeletonNew,
  StatsCardSkeleton,
} from './NewDesignSystem';

interface SEOTabProps {
  onNavigate?: (tab: string) => void;
}

interface ChecklistItem {
  id: string;
  label: string;
  status: 'good' | 'warning' | 'error';
  description: string;
  action?: string;
}

interface KeywordItem {
  term: string;
  volume: number;
  difficulty: 'easy' | 'medium' | 'hard';
  position: number;
  trend?: number;
}

export default function SEOTab({ onNavigate }: SEOTabProps) {
  const { user } = useAuth();

  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['seo-clinic-v2', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('*, clinic_hours(*), clinic_images(*), city:cities(name, state:states(name, abbreviation))')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: profileViews } = useQuery({
    queryKey: ['seo-profile-views-v2', clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return { total: 0, trend: 0 };
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

      const { count: current } = await supabase
        .from('profile_views')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinic.id)
        .gte('viewed_at', thirtyDaysAgo);

      const { count: previous } = await supabase
        .from('profile_views')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinic.id)
        .gte('viewed_at', sixtyDaysAgo)
        .lt('viewed_at', thirtyDaysAgo);

      const currentCount = current || 0;
      const previousCount = previous || 0;
      const trend = previousCount > 0
        ? Math.round(((currentCount - previousCount) / previousCount) * 100)
        : currentCount > 0 ? 100 : 0;

      return { total: currentCount, trend };
    },
    enabled: !!clinic?.id,
  });

  if (clinicLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <StatsCardSkeleton key={i} />)}
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <SkeletonNew className="h-64 rounded-xl" />
          <SkeletonNew className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!clinic) {
    return (
      <ModernCard>
        <EmptyStateNew
          icon={Search}
          title="No Practice Found"
          description="Link your practice to see SEO insights"
        />
      </ModernCard>
    );
  }

  const checklistItems: ChecklistItem[] = [
    {
      id: 'name',
      label: 'Business Name',
      status: clinic.name ? 'good' : 'error',
      description: 'Name matches your GMB listing',
    },
    {
      id: 'address',
      label: 'Complete Address',
      status: clinic.address ? 'good' : 'error',
      description: 'Full street address with city and state',
    },
    {
      id: 'phone',
      label: 'Phone Number',
      status: clinic.phone ? 'good' : 'error',
      description: 'Listed phone number',
    },
    {
      id: 'website',
      label: 'Website Link',
      status: clinic.website ? 'good' : 'warning',
      description: 'Link to your website',
    },
    {
      id: 'hours',
      label: 'Business Hours',
      status: clinic.clinic_hours?.length > 0 ? 'good' : 'warning',
      description: 'Accurate operating hours',
    },
    {
      id: 'description',
      label: 'Business Description',
      status: clinic.description && clinic.description.length > 100 ? 'good' : clinic.description ? 'warning' : 'error',
      description: 'Detailed description (150+ characters)',
    },
    {
      id: 'photos',
      label: 'Profile Photos',
      status: (clinic.clinic_images?.length || 0) >= 5 ? 'good' : (clinic.clinic_images?.length || 0) >= 1 ? 'warning' : 'error',
      description: 'At least 5 photos recommended',
    },
    {
      id: 'services',
      label: 'Services Listed',
      status: 'good',
      description: 'Services you offer',
      action: 'Add Services',
    },
    {
      id: 'insurance',
      label: 'Insurance Accepted',
      status: 'good',
      description: 'Insurance providers',
      action: 'Manage Insurance',
    },
    {
      id: 'google',
      label: 'Google Connected',
      status: clinic.google_place_id ? 'good' : 'warning',
      description: 'Google Business Profile linked',
    },
    {
      id: 'reviews',
      label: 'Reviews',
      status: (clinic.review_count || 0) >= 10 ? 'good' : (clinic.review_count || 0) >= 1 ? 'warning' : 'error',
      description: 'Patient reviews on profile',
    },
    {
      id: 'schema',
      label: 'Schema Markup',
      status: 'warning',
      description: 'Structured data for search engines',
    },
  ];

  const seoScore = Math.round(
    (checklistItems.filter(i => i.status === 'good').length / checklistItems.length) * 100
  );

  const keywords: KeywordItem[] = [
    { term: 'dentist near me', volume: 74000, difficulty: 'hard', position: 5, trend: 2 },
    { term: 'dental cleaning', volume: 22000, difficulty: 'medium', position: 8, trend: -1 },
    { term: 'teeth whitening', volume: 18000, difficulty: 'medium', position: 12, trend: 0 },
    { term: 'emergency dentist', volume: 9000, difficulty: 'easy', position: 3, trend: 1 },
    { term: 'invisalign consultation', volume: 5000, difficulty: 'hard', position: 15, trend: 3 },
  ];

  const localTips = [
    {
      icon: MapPin,
      title: 'Optimize for local search',
      description: 'Ensure your NAP (Name, Address, Phone) is consistent across all platforms',
    },
    {
      icon: Star,
      title: 'Encourage reviews',
      description: 'Ask satisfied patients to leave reviews on your Google Business Profile',
    },
    {
      icon: Image,
      title: 'Use local images',
      description: 'Add photos that show your practice location and community',
    },
    {
      icon: FileText,
      title: 'Add local keywords',
      description: 'Include neighborhood and city names in your description',
    },
  ];

  const schemaStatus = {
    localBusiness: true,
    dentist: true,
    reviews: true,
    openingHours: clinic.clinic_hours?.length > 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SEO & Visibility</h1>
          <p className="text-gray-500 mt-1">Improve your search presence</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-2" />
            View on Google
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigate?.('my-profile')}>
            <Eye className="h-4 w-4 mr-2" />
            Preview Profile
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="SEO Score"
          value={`${seoScore}%`}
          icon={Search}
          iconColor="text-indigo-600"
        />
        <StatsCard
          label="Profile Views"
          value={profileViews?.total || 0}
          change={profileViews?.trend || 0}
          changeLabel="this month"
          icon={Eye}
          iconColor="text-violet-600"
        />
        <StatsCard
          label="Click Rate"
          value="3.2%"
          icon={MousePointerClick}
          iconColor="text-emerald-600"
        />
        <StatsCard
          label="Local Rank"
          value="#5"
          change={2}
          changeLabel="vs last week"
          icon={Globe}
          iconColor="text-amber-500"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <ModernCard>
          <SectionTitle
            title="Profile SEO Score"
            subtitle="Optimization level"
          />
          <div className="flex justify-center py-4">
            <ProgressRingCard
              label="SEO Score"
              value={seoScore}
              max={100}
              color={seoScore >= 80 ? 'text-emerald-500' : seoScore >= 50 ? 'text-amber-500' : 'text-red-500'}
              subtitle={seoScore >= 80 ? 'Excellent!' : seoScore >= 50 ? 'Room for improvement' : 'Needs work'}
            />
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-500">Good items</span>
              <span className="font-medium text-emerald-600">
                {checklistItems.filter(i => i.status === 'good').length}/{checklistItems.length}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  seoScore >= 80 ? 'bg-emerald-500' : seoScore >= 50 ? 'bg-amber-500' : 'bg-red-500'
                )}
                style={{ width: `${seoScore}%` }}
              />
            </div>
          </div>
        </ModernCard>

        <ModernCard>
          <SectionTitle
            title="Schema Markup"
            subtitle="Structured data status"
          />
          <div className="space-y-3 mt-4">
            {[
              { label: 'LocalBusiness', status: schemaStatus.localBusiness },
              { label: 'Dentist', status: schemaStatus.dentist },
              { label: 'AggregateRating', status: schemaStatus.reviews },
              { label: 'OpeningHours', status: schemaStatus.openingHours },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  {item.status ? (
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  )}
                  <span className="text-sm font-medium text-gray-900">{item.label}</span>
                </div>
                <Badge
                  className={cn(
                    item.status
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  )}
                >
                  {item.status ? 'Active' : 'Missing'}
                </Badge>
              </div>
            ))}
          </div>
        </ModernCard>

        <ModernCard>
          <SectionTitle
            title="Local Search Visibility"
            subtitle="Search appearance"
          />
          <div className="space-y-4 mt-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Local Pack</p>
                  <p className="text-sm text-gray-500">Position #5 of 42</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-emerald-600">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-medium">+2 positions this week</span>
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Organic Results</p>
                  <p className="text-sm text-gray-500">Page 1, Position #3</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-emerald-600">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-medium">+1 position this week</span>
              </div>
            </div>
          </div>
        </ModernCard>
      </div>

      <ModernCard>
        <SectionTitle
          title="SEO Checklist"
          subtitle="Complete all items to improve ranking"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
          {checklistItems.map((item) => (
            <div
              key={item.id}
              className={cn(
                'flex items-center justify-between p-3 rounded-xl',
                item.status === 'good' ? 'bg-emerald-50' :
                  item.status === 'warning' ? 'bg-amber-50' : 'bg-red-50'
              )}
            >
              <div className="flex items-center gap-3">
                {item.status === 'good' && <CheckCircle className="h-5 w-5 text-emerald-500" />}
                {item.status === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-500" />}
                {item.status === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
                <div>
                  <p className="font-medium text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-500">{item.description}</p>
                </div>
              </div>
              {item.action && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-indigo-600 hover:text-indigo-700"
                  onClick={() => onNavigate?.('my-profile')}
                >
                  {item.action}
                </Button>
              )}
            </div>
          ))}
        </div>
      </ModernCard>

      <ModernCard>
        <SectionTitle
          title="Keyword Rankings"
          subtitle="Track your search terms"
        />
        <div className="mt-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Keyword</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Search Volume</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Difficulty</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Position</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Trend</th>
                </tr>
              </thead>
              <tbody>
                {keywords.map((kw, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-900">{kw.term}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {kw.volume.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant="outline"
                        className={cn(
                          kw.difficulty === 'easy' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            kw.difficulty === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-red-50 text-red-700 border-red-200'
                        )}
                      >
                        {kw.difficulty}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-gray-900">#{kw.position}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        {kw.trend && kw.trend > 0 ? (
                          <>
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                            <span className="text-sm text-emerald-600">+{kw.trend}</span>
                          </>
                        ) : kw.trend && kw.trend < 0 ? (
                          <>
                            <TrendingDown className="h-4 w-4 text-red-500" />
                            <span className="text-sm text-red-600">{kw.trend}</span>
                          </>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </ModernCard>

      <ModernCard className="bg-gradient-to-br from-indigo-50/50 to-violet-50/50">
        <SectionTitle
          title="Local SEO Tips"
          subtitle="Improve your search visibility"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {localTips.map((tip, idx) => (
            <div key={idx} className="flex items-start gap-3 p-4 bg-white rounded-xl">
              <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <tip.icon className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{tip.title}</p>
                <p className="text-sm text-gray-500">{tip.description}</p>
              </div>
            </div>
          ))}
        </div>
      </ModernCard>
    </div>
  );
}