/**
 * Marketing & Growth Tab V2
 * Shows listing optimization, reviews, acquisition, and marketing tips
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Target,
  TrendingUp,
  Users,
  Star,
  Mail,
  MessageSquare,
  Share2,
  Gift,
  BarChart3,
  CheckCircle,
  AlertTriangle,
  ArrowUpRight,
  ExternalLink,
  Phone,
  Globe,
  Zap,
  Lightbulb,
  Award,
  ThumbsUp,
  Send,
  Eye,
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
import { useState } from 'react';

interface MarketingTabProps {
  onNavigate?: (tab: string) => void;
}

export default function MarketingTab({ onNavigate }: MarketingTabProps) {
  const { user } = useAuth();

  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['marketing-clinic-v2', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('*')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: reviews } = useQuery({
    queryKey: ['marketing-reviews-v2', clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return [];
      const { data } = await supabase
        .from('reviews')
        .select('*')
        .eq('clinic_id', clinic.id)
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  const { data: reviewRequests } = useQuery({
    queryKey: ['review-requests-v2', clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return [];
      const { data } = await supabase
        .from('review_requests')
        .select('*')
        .eq('clinic_id', clinic.id)
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
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
          icon={Target}
          title="No Practice Found"
          description="Link your practice to see marketing insights"
        />
      </ModernCard>
    );
  }

  const profileCompleteness = Math.min(
    Math.round(
      ([
        clinic.name,
        clinic.description,
        clinic.address,
        clinic.phone,
        clinic.email,
        clinic.cover_image_url,
        clinic.google_place_id,
        clinic.clinic_hours?.length > 0,
      ].filter(Boolean).length / 8) * 100
    ),
    100
  );

  const avgRating = clinic.rating ? Number(clinic.rating) : 0;
  const totalReviews = clinic.review_count || 0;
  const reviewRequestsSent = reviewRequests?.length || 0;
  const positiveReviews = reviews?.filter(r => r.rating >= 4).length || 0;
  const reviewResponseRate = reviewRequestsSent > 0
    ? Math.round((positiveReviews / reviewRequestsSent) * 100)
    : 0;

  const estimatedPAC = 45;
  const listingScore = profileCompleteness;

  const competitorData = [
    { name: 'Your Practice', rating: avgRating, reviews: totalReviews },
    { name: 'Competitor A', rating: 4.5, reviews: 128 },
    { name: 'Competitor B', rating: 4.2, reviews: 89 },
  ];

  const marketingTips = [
    {
      icon: Photo,
      title: 'Add more photos',
      description: 'Listings with 10+ photos get 2x more clicks',
      completed: (clinic.clinic_images?.length || 0) > 5,
    },
    {
      icon: Mail,
      title: 'Request reviews',
      description: 'Send review requests to recent patients',
      completed: reviewRequestsSent > 10,
    },
    {
      icon: Globe,
      title: 'Connect Google Business',
      description: 'Boost visibility with Google integration',
      completed: !!clinic.google_place_id,
    },
    {
      icon: MessageSquare,
      title: 'Respond to reviews',
      description: 'Reply to all patient reviews',
      completed: false,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketing & Growth</h1>
          <p className="text-gray-500 mt-1">Grow your practice</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={() => onNavigate?.('my-reputation')}>
            <Send className="h-4 w-4 mr-2" />
            Send Review Request
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Listing Score"
          value={`${listingScore}%`}
          icon={Target}
          iconColor="text-indigo-600"
        />
        <StatsCard
          label="Reviews"
          value={totalReviews}
          change={12}
          changeLabel="vs last month"
          icon={Star}
          iconColor="text-amber-500"
        />
        <StatsCard
          label="Avg Rating"
          value={avgRating > 0 ? avgRating.toFixed(1) : '—'}
          icon={Award}
          iconColor="text-emerald-600"
        />
        <StatsCard
          label="Est. Patient AC"
          value={`$${estimatedPAC}`}
          icon={Users}
          iconColor="text-violet-600"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <ModernCard>
          <SectionTitle
            title="Listing Optimization"
            subtitle="Complete your profile"
          />
          <div className="flex justify-center py-4">
            <ProgressRingCard
              label="Profile Score"
              value={profileCompleteness}
              max={100}
              color="text-indigo-600"
              subtitle={`${100 - profileCompleteness}% to complete`}
            />
          </div>
          <div className="space-y-3 mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Description</span>
              <StatusBadgeNew
                status={clinic.description ? 'success' : 'warning'}
                label={clinic.description ? 'Complete' : 'Missing'}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Photos</span>
              <StatusBadgeNew
                status={(clinic.clinic_images?.length || 0) > 3 ? 'success' : 'warning'}
                label={`${clinic.clinic_images?.length || 0} photos`}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Hours</span>
              <StatusBadgeNew
                status={clinic.clinic_hours?.length > 0 ? 'success' : 'warning'}
                label={clinic.clinic_hours?.length > 0 ? 'Set' : 'Missing'}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Google</span>
              <StatusBadgeNew
                status={clinic.google_place_id ? 'success' : 'warning'}
                label={clinic.google_place_id ? 'Connected' : 'Not linked'}
              />
            </div>
          </div>
        </ModernCard>

        <ModernCard>
          <SectionTitle
            title="Review Performance"
            subtitle="Build your reputation"
          />
          <div className="space-y-4 mt-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Requests Sent</span>
                <span className="font-bold text-gray-900">{reviewRequestsSent}</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${Math.min(reviewRequestsSent / 50 * 100, 100)}%` }}
                />
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Response Rate</span>
                <span className="font-bold text-emerald-600">{reviewResponseRate}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${reviewResponseRate}%` }}
                />
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Positive Reviews</span>
                <span className="font-bold text-gray-900">{positiveReviews}</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${totalReviews > 0 ? (positiveReviews / totalReviews) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full mt-4 rounded-lg"
            onClick={() => onNavigate?.('my-reputation')}
          >
            <Send className="h-4 w-4 mr-2" />
            Send Review Request
          </Button>
        </ModernCard>

        <ModernCard>
          <SectionTitle
            title="Competitor Comparison"
            subtitle="Local presence"
          />
          <div className="space-y-4 mt-4">
            {competitorData.map((comp, idx) => (
              <div
                key={idx}
                className={cn(
                  'p-4 rounded-xl',
                  idx === 0 ? 'bg-indigo-50 border-2 border-indigo-200' : 'bg-gray-50'
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={cn('font-medium', idx === 0 ? 'text-indigo-900' : 'text-gray-900')}>
                      {comp.name}
                    </p>
                    <p className="text-sm text-gray-500">{comp.reviews} reviews</p>
                  </div>
                  <div className="text-right">
                    <p className={cn('text-xl font-bold', idx === 0 ? 'text-indigo-600' : 'text-gray-900')}>
                      {comp.rating.toFixed(1)}
                    </p>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            'h-3 w-3',
                            i < Math.floor(comp.rating)
                              ? 'text-amber-400 fill-current'
                              : 'text-gray-300'
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ModernCard>
      </div>

      <ModernCard>
        <SectionTitle
          title="Marketing Checklist"
          subtitle="Action items to grow"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {marketingTips.map((tip, idx) => (
            <div
              key={idx}
              className={cn(
                'flex items-start gap-3 p-4 rounded-xl',
                tip.completed ? 'bg-emerald-50' : 'bg-gray-50'
              )}
            >
              <div
                className={cn(
                  'h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0',
                  tip.completed ? 'bg-emerald-100' : 'bg-indigo-100'
                )}
              >
                {tip.completed ? (
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                ) : (
                  <tip.icon className="h-5 w-5 text-indigo-600" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{tip.title}</p>
                <p className="text-sm text-gray-500">{tip.description}</p>
              </div>
              {tip.completed && (
                <Badge className="bg-emerald-100 text-emerald-700">Done</Badge>
              )}
            </div>
          ))}
        </div>
      </ModernCard>

      <ModernCard className="bg-gradient-to-br from-violet-50/50 to-indigo-50/50">
        <SectionTitle
          title="Growth Tips"
          subtitle="Personalized recommendations"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          <div className="flex items-start gap-3 p-4 bg-white rounded-xl">
            <div className="h-9 w-9 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
              <Lightbulb className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Respond to reviews</p>
              <p className="text-sm text-gray-500">
                Practices that respond get 1.5x more reviews
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-white rounded-xl">
            <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Photo className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Showcase your work</p>
              <p className="text-sm text-gray-500">
                Add before & after photos to your gallery
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-white rounded-xl">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Zap className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Enable SMS reminders</p>
              <p className="text-sm text-gray-500">
                Reduce no-shows by 30% with reminders
              </p>
            </div>
          </div>
        </div>
      </ModernCard>
    </div>
  );
}

const Photo = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);