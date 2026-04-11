/**
 * Negative Feedback Panel
 * Shows full details of negative feedback including poster name, date, rating, comment
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ThumbsDown,
  Star,
  Clock,
  User,
  MessageSquare,
  AlertTriangle,
  ExternalLink,
  Mail,
  Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NegativeFeedbackPanelProps {
  clinicId: string;
  limit?: number;
  showHeader?: boolean;
  className?: string;
}

interface FeedbackEvent {
  id: string;
  clinic_id: string;
  source: string;
  event_type: string;
  rating: number | null;
  comment: string | null;
  visitor_id: string | null;
  created_at: string;
  // Extended fields from visitor data if available
  visitor_name?: string;
  visitor_email?: string;
  visitor_phone?: string;
}

export default function NegativeFeedbackPanel({
  clinicId,
  limit = 50,
  showHeader = true,
  className,
}: NegativeFeedbackPanelProps) {
  // Fetch negative feedback events
  const { data: feedbackEvents = [], isLoading } = useQuery({
    queryKey: ['negative-feedback', clinicId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('review_funnel_events')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('event_type', 'thumbs_down')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as FeedbackEvent[];
    },
    enabled: !!clinicId,
  });

  // Get star display
  const getStarRating = (rating: number | null) => {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              'h-3 w-3',
              star <= rating ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/30'
            )}
          />
        ))}
      </div>
    );
  };

  // Get severity color based on rating
  const getSeverityColor = (rating: number | null) => {
    if (!rating) return 'border-amber-300 bg-amber-50';
    if (rating <= 2) return 'border-red-300 bg-red-50';
    if (rating <= 3) return 'border-amber-300 bg-amber-50';
    return 'border-yellow-300 bg-yellow-50';
  };

  const getSeverityBadge = (rating: number | null) => {
    if (!rating) return { label: 'No Rating', variant: 'secondary' as const };
    if (rating <= 1) return { label: 'Critical', variant: 'destructive' as const };
    if (rating <= 2) return { label: 'Serious', variant: 'destructive' as const };
    if (rating <= 3) return { label: 'Moderate', variant: 'default' as const };
    return { label: 'Minor', variant: 'secondary' as const };
  };

  if (isLoading) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
        )}
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('border-2', className)}>
      {showHeader && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
                  <ThumbsDown className="h-4 w-4 text-red-600" />
                </div>
                Private Feedback
              </CardTitle>
              <CardDescription>
                Negative feedback that was captured privately (not posted to Google)
              </CardDescription>
            </div>
            <Badge variant="destructive" className="text-sm">
              {feedbackEvents.length} Issues
            </Badge>
          </div>
        </CardHeader>
      )}

      <CardContent>
        {feedbackEvents.length === 0 ? (
          <div className="text-center py-12">
            <div className="h-16 w-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <ThumbsDown className="h-8 w-8 text-emerald-600 rotate-180" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">No Negative Feedback</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Great job! You haven't received any negative feedback through the review funnel.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-2">
            <div className="space-y-3">
              {feedbackEvents.map((feedback, index) => {
                const severity = getSeverityBadge(feedback.rating);
                
                return (
                  <div
                    key={feedback.id}
                    className={cn(
                      'p-4 rounded-xl border-2 transition-all hover:shadow-md',
                      getSeverityColor(feedback.rating)
                    )}
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        {/* Avatar placeholder */}
                        <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                          <User className="h-5 w-5 text-slate-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              {feedback.visitor_name || `Anonymous Visitor`}
                            </span>
                            <Badge variant={severity.variant} className="text-xs h-5">
                              {severity.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <Clock className="h-3 w-3" />
                            <span>{format(new Date(feedback.created_at), 'MMM d, yyyy • h:mm a')}</span>
                            <span className="text-muted-foreground/50">•</span>
                            <span className="capitalize">{feedback.source}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Rating Stars */}
                      <div className="flex flex-col items-end gap-1">
                        {getStarRating(feedback.rating)}
                        <span className="text-xs text-muted-foreground">
                          {feedback.rating ? `${feedback.rating}/5` : 'No rating'}
                        </span>
                      </div>
                    </div>

                    {/* Comment Section */}
                    {feedback.comment ? (
                      <div className="p-3 rounded-lg bg-white/80 border border-slate-200">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-foreground leading-relaxed">
                            "{feedback.comment}"
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-white/50 border border-dashed border-slate-200">
                        <p className="text-sm text-muted-foreground italic flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          No comment provided
                        </p>
                      </div>
                    )}

                    {/* Contact Info (if available) */}
                    {(feedback.visitor_email || feedback.visitor_phone) && (
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-200">
                        {feedback.visitor_email && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span>{feedback.visitor_email}</span>
                          </div>
                        )}
                        {feedback.visitor_phone && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{feedback.visitor_phone}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action hint */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200">
                      <span className="text-xs text-muted-foreground">
                        Feedback #{feedbackEvents.length - index}
                      </span>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-primary">
                        Mark as Addressed
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
