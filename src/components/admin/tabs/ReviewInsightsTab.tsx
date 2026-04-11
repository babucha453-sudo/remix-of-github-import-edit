import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown, 
  TrendingUp,
  Star,
  AlertTriangle,
  Building2,
  BarChart3,
  Eye,
  Flag,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Search,
  Filter,
  Download,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import DarkCard from '@/components/dashboard/DarkCard';
import StatCardDark from '@/components/dashboard/StatCardDark';

export default function ReviewInsightsTab() {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClinic, setSelectedClinic] = useState<string>('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('30');

  // Fetch review funnel stats
  const { data: funnelStats } = useQuery({
    queryKey: ['funnel-stats'],
    queryFn: async () => {
      const { data: events } = await supabase
        .from('review_funnel_events')
        .select('id, event_type, rating, created_at');
      
      const total = events?.length || 0;
      const positive = events?.filter(e => e.event_type === 'thumbs_up').length || 0;
      const negative = events?.filter(e => e.event_type === 'thumbs_down').length || 0;
      const avgRating = events?.filter(e => e.rating)?.length 
        ? events.filter(e => e.rating).reduce((sum, e) => sum + (e.rating || 0), 0) / events.filter(e => e.rating).length 
        : 0;
      
      return { total, positive, negative, avgRating };
    },
  });

  // Fetch recent negative feedback from review_funnel_events
  const { data: negativeFeedback } = useQuery({
    queryKey: ['negative-feedback'],
    queryFn: async () => {
      const { data } = await supabase
        .from('review_funnel_events')
        .select(`
          id, rating, comment, source, created_at,
          clinic:clinics(id, name, slug)
        `)
        .eq('event_type', 'thumbs_down')
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  // Fetch internal reviews (negative feedback stored for follow-up)
  const { data: internalReviews, isLoading: internalLoading } = useQuery({
    queryKey: ['internal-reviews-admin'],
    queryFn: async () => {
      const { data } = await supabase
        .from('internal_reviews')
        .select(`
          id, patient_name, patient_email, rating, comment, status, created_at, sentiment_score, ai_suggested_response, resolution_notes, resolved_at,
          clinic:clinics(id, name, slug)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // Fetch clinics with most negative feedback
  const { data: problemClinics } = useQuery({
    queryKey: ['problem-clinics-funnel'],
    queryFn: async () => {
      const { data: events } = await supabase
        .from('review_funnel_events')
        .select(`
          clinic_id,
          clinic:clinics(id, name, slug, city:cities(name))
        `)
        .eq('event_type', 'thumbs_down');
      
      // Count per clinic
      const counts: Record<string, { count: number; clinic: any }> = {};
      events?.forEach((e: any) => {
        if (!counts[e.clinic_id]) {
          counts[e.clinic_id] = { count: 0, clinic: e.clinic };
        }
        counts[e.clinic_id].count++;
      });
      
      return Object.values(counts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    },
  });

  // Fetch top performing clinics
  const { data: topClinics } = useQuery({
    queryKey: ['top-clinics'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinics')
        .select('id, name, slug, rating, review_count, city:cities(name)')
        .gt('review_count', 0)
        .order('rating', { ascending: false })
        .order('review_count', { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  // Calculate KPIs similar to ReputationSuite
  const kpis = useMemo(() => {
    const total = funnelStats?.total || 0;
    const positive = funnelStats?.positive || 0;
    const negative = funnelStats?.negative || 0;
    const avgRating = funnelStats?.avgRating || 0;

    // Conversion rate (positive / total)
    const conversionRate = total > 0 ? (positive / total) * 100 : 0;

    // Platform reputation score (weighted calculation)
    const ratingScore = (avgRating / 5) * 50;
    const conversionScore = conversionRate * 0.3;
    const volumeScore = Math.min(total / 100, 1) * 20; // Max 100 for full score
    const reputationScore = Math.round(ratingScore + conversionScore + volumeScore);

    return {
      reputationScore,
      conversionRate,
      total,
      positive,
      negative,
      avgRating,
    };
  }, [funnelStats]);

  const positiveRate = funnelStats?.total 
    ? Math.round((funnelStats.positive / funnelStats.total) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            Review Insights
          </h1>
          <p className="text-muted-foreground mt-1">Platform-wide review funnel performance & feedback trends</p>
        </div>
      </div>

      {/* Hero Score Section - Matching ReputationSuite */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Platform Score Card */}
        <Card className="lg:col-span-1 card-dark text-white overflow-hidden">
          <CardContent className="p-6 relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/20 to-transparent rounded-bl-full" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-white/70">Platform Health</span>
              </div>
              <div className="flex items-end gap-4">
                <div className="relative">
                  <div 
                    className="h-28 w-28 rounded-full flex items-center justify-center"
                    style={{
                      background: `conic-gradient(hsl(172 66% 50%) ${kpis.reputationScore}%, hsl(215 25% 27%) ${kpis.reputationScore}%)`
                    }}
                  >
                    <div className="h-20 w-20 rounded-full bg-slate-900 flex items-center justify-center">
                      <span className="text-4xl font-bold">{kpis.reputationScore}</span>
                    </div>
                  </div>
                </div>
                <div className="pb-2">
                  <Badge className={`${kpis.reputationScore >= 70 ? 'bg-teal/20 text-teal' : kpis.reputationScore >= 40 ? 'bg-gold/20 text-gold' : 'bg-coral/20 text-coral'} border-0`}>
                    {kpis.reputationScore >= 70 ? 'Excellent' : kpis.reputationScore >= 40 ? 'Good' : 'Needs Work'}
                  </Badge>
                  <p className="text-xs text-white/50 mt-2">Based on conversion, rating & volume</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Grid */}
        <div className="lg:col-span-2 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Total Responses */}
          <Card className="card-stat">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Responses</span>
              </div>
              <p className="text-2xl font-bold">{kpis.total}</p>
              <p className="text-xs text-muted-foreground mt-1">Total funnel</p>
            </CardContent>
          </Card>

          {/* Positive */}
          <Card className="card-stat">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ThumbsUp className="h-4 w-4 text-teal" />
                <span className="text-xs font-medium text-muted-foreground">→ Google</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">{kpis.positive}</p>
                <ArrowUpRight className="h-4 w-4 text-teal" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Redirected</p>
            </CardContent>
          </Card>

          {/* Negative */}
          <Card className="card-stat">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ThumbsDown className="h-4 w-4 text-coral" />
                <span className="text-xs font-medium text-muted-foreground">Private</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">{kpis.negative}</p>
                <ArrowDownRight className="h-4 w-4 text-coral" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Captured</p>
            </CardContent>
          </Card>

          {/* Avg Rating */}
          <Card className="card-stat">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-4 w-4 text-gold" />
                <span className="text-xs font-medium text-muted-foreground">Avg Rating</span>
              </div>
              <p className="text-2xl font-bold">{kpis.avgRating.toFixed(1)}</p>
              <div className="flex items-center gap-1 mt-1">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className={`h-3 w-3 ${i <= kpis.avgRating ? 'text-gold fill-gold' : 'text-muted'}`} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Conversion Rate */}
          <Card className="card-stat">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Conversion</span>
              </div>
              <p className="text-2xl font-bold">{kpis.conversionRate.toFixed(0)}%</p>
              <Progress value={kpis.conversionRate} className="h-1.5 mt-2" />
            </CardContent>
          </Card>

          {/* Problem Clinics */}
          <Card className="card-stat">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-coral" />
                <span className="text-xs font-medium text-muted-foreground">At Risk</span>
              </div>
              <p className="text-2xl font-bold">{problemClinics?.length || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Clinics flagged</p>
            </CardContent>
          </Card>

          {/* Top Performers */}
          <Card className="card-stat">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-teal" />
                <span className="text-xs font-medium text-muted-foreground">Top Rated</span>
              </div>
              <p className="text-2xl font-bold">{topClinics?.filter(c => (c.rating || 0) >= 4.5).length || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">4.5+ rating</p>
            </CardContent>
          </Card>

          {/* Feedback Volume */}
          <Card className="card-stat">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-blue-custom" />
                <span className="text-xs font-medium text-muted-foreground">Weekly</span>
              </div>
              <p className="text-2xl font-bold">~{Math.round(kpis.total / 4)}</p>
              <p className="text-xs text-muted-foreground mt-1">Avg per week</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Funnel Performance Card */}
      <Card className="card-modern border-primary/20 bg-gradient-to-r from-primary/5 via-card to-teal/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-bold text-lg">Review Funnel Performance</p>
              <p className="text-sm text-muted-foreground">% of patients redirected to Google reviews</p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold bg-gradient-to-r from-primary to-teal bg-clip-text text-transparent">{positiveRate}%</p>
              <p className="text-sm text-muted-foreground">Conversion Rate</p>
            </div>
          </div>
          <div className="relative h-4 rounded-full overflow-hidden bg-muted">
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-teal to-primary rounded-full transition-all duration-500"
              style={{ width: `${positiveRate}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-sm text-muted-foreground">
            <span>0% (All Private)</span>
            <span className="font-medium text-primary">{positiveRate}% converted</span>
            <span>100% (All to Google)</span>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 rounded-xl bg-muted/50 p-1">
          <TabsTrigger value="overview" className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="internal" className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <MessageSquare className="h-4 w-4 mr-2" />
            Internal Reviews
            {(internalReviews?.length || 0) > 0 && (
              <Badge className="ml-2 bg-coral/20 text-coral text-xs">{internalReviews?.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="complaints" className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Funnel Feedback
          </TabsTrigger>
          <TabsTrigger value="problem" className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Flag className="h-4 w-4 mr-2" />
            Problem Clinics
          </TabsTrigger>
          <TabsTrigger value="top" className="rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <TrendingUp className="h-4 w-4 mr-2" />
            Top Performers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Funnel Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <ThumbsUp className="h-4 w-4 text-teal" />
                      Thumbs Up → Google
                    </span>
                    <span className="font-bold text-teal">{funnelStats?.positive || 0}</span>
                  </div>
                  <div className="relative h-3 rounded-full overflow-hidden bg-muted">
                    <div 
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-teal to-primary rounded-full"
                      style={{ width: `${funnelStats?.total ? (funnelStats.positive / funnelStats.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <ThumbsDown className="h-4 w-4 text-coral" />
                      Thumbs Down → Private
                    </span>
                    <span className="font-bold text-coral">{funnelStats?.negative || 0}</span>
                  </div>
                  <div className="relative h-3 rounded-full overflow-hidden bg-muted">
                    <div 
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-coral to-red-500 rounded-full"
                      style={{ width: `${funnelStats?.total ? (funnelStats.negative / funnelStats.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-modern">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-coral" />
                  Private Feedback Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <div className="h-20 w-20 rounded-full bg-coral/10 flex items-center justify-center mx-auto mb-4">
                    <ThumbsDown className="h-10 w-10 text-coral" />
                  </div>
                  <p className="text-4xl font-bold">{funnelStats?.negative || 0}</p>
                  <p className="text-muted-foreground">Total Private Complaints</p>
                  <p className="mt-4 text-sm text-muted-foreground max-w-xs mx-auto">
                    These are patients who chose "thumbs down" and provided private feedback instead of public reviews.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="internal" className="mt-4">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-coral" />
                Internal Reviews Dashboard
              </CardTitle>
              <CardDescription>
                All negative reviews captured through the reputation suite - these stay private and need follow-up
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Clinic</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>AI Response</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {internalReviews?.map((review: any) => (
                    <TableRow key={review.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {format(new Date(review.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-coral/10 flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-coral" />
                          </div>
                          <span className="font-medium">{review.clinic?.name || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{review.patient_name || 'Anonymous'}</p>
                          {review.patient_email && (
                            <p className="text-xs text-muted-foreground">{review.patient_email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3.5 w-3.5 ${i < (review.rating || 0) ? 'text-gold fill-gold' : 'text-muted'}`}
                            />
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="truncate">{review.comment || '-'}</p>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className={
                            review.status === 'resolved' 
                              ? 'bg-teal/20 text-teal' 
                              : review.status === 'in_progress' 
                                ? 'bg-gold/20 text-gold'
                                : 'bg-coral/20 text-coral'
                          }
                        >
                          {review.status || 'pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {review.ai_suggested_response ? (
                          <Badge variant="outline" className="text-xs">
                            <Eye className="h-3 w-3 mr-1" />
                            AI Ready
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!internalReviews || internalReviews.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        <ThumbsUp className="h-12 w-12 mx-auto mb-3 text-teal opacity-50" />
                        <p className="font-medium">No internal reviews recorded</p>
                        <p className="text-sm">Negative reviews from the reputation suite will appear here.</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="complaints" className="mt-4">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-coral" />
                Recent Private Feedback
              </CardTitle>
              <CardDescription>Negative feedback submitted through the review funnel</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Clinic</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {negativeFeedback?.map((feedback: any) => (
                    <TableRow key={feedback.id}>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(feedback.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-coral/10 flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-coral" />
                          </div>
                          <span className="font-medium">{feedback.clinic?.name || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {feedback.rating && (
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3.5 w-3.5 ${i < feedback.rating ? 'text-gold fill-gold' : 'text-muted'}`}
                              />
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{feedback.comment || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{feedback.source}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!negativeFeedback || negativeFeedback.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        <ThumbsUp className="h-12 w-12 mx-auto mb-3 text-teal opacity-50" />
                        <p className="font-medium">No private feedback recorded yet</p>
                        <p className="text-sm">Great news! All reviews are going to Google.</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="problem" className="mt-4">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Flag className="h-5 w-5 text-coral" />
                Clinics with Most Negative Feedback
              </CardTitle>
              <CardDescription>These clinics have received the most private complaints</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Clinic</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Complaints</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {problemClinics?.map((item: any, index: number) => (
                    <TableRow key={item.clinic?.id || index} className="bg-coral/5">
                      <TableCell>
                        <Badge className="bg-coral text-white">{index + 1}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-coral/10 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-coral" />
                          </div>
                          <span className="font-medium">{item.clinic?.name || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.clinic?.city?.name || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="font-bold">{item.count} complaints</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!problemClinics || problemClinics.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        <TrendingUp className="h-12 w-12 mx-auto mb-3 text-teal opacity-50" />
                        <p className="font-medium">No problem clinics identified</p>
                        <p className="text-sm">All clinics are performing well!</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="top" className="mt-4">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Star className="h-5 w-5 text-gold" />
                Top Performing Clinics
              </CardTitle>
              <CardDescription>Clinics with the best Google ratings</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Clinic</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Reviews</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topClinics?.map((clinic: any, index: number) => (
                    <TableRow key={clinic.id} className={index < 3 ? 'bg-gold/5' : ''}>
                      <TableCell>
                        <Badge className={index < 3 ? 'bg-gold text-white' : 'bg-muted'}>{index + 1}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${index < 3 ? 'bg-gold/10' : 'bg-muted'}`}>
                            <Building2 className={`h-5 w-5 ${index < 3 ? 'text-gold' : 'text-muted-foreground'}`} />
                          </div>
                          <span className="font-medium">{clinic.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {clinic.city?.name || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Star className="h-4 w-4 text-gold fill-gold" />
                          <span className="font-bold">{clinic.rating || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{clinic.review_count || 0} reviews</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!topClinics || topClinics.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium">No clinic data available</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}