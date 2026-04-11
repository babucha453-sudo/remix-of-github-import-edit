/**
 * Phase 4 Sprint Hub - Optimization & Scaling (Weeks 25-52)
 * 
 * Sprint 4.1: Content Performance Optimization
 * Sprint 4.2: Advanced Feature Development
 * Sprint 4.3: Content Expansion to 300+ Posts
 * 
 * + KPI Dashboard & Reporting
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  TrendingUp, 
  BarChart3, 
  Target, 
  RefreshCw, 
  Search,
  FileText,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Eye,
  MousePointer,
  Clock,
  Users,
  Calendar,
  Zap,
  Star,
  Filter,
  Settings
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ContentAuditPanel from './phase4/ContentAuditPanel';
import KPIDashboard from './phase4/KPIDashboard';
import AdvancedFeaturesPanel from './phase4/AdvancedFeaturesPanel';
import { PerformanceAuditPanel } from './phase4/PerformanceAuditPanel';
import { SchemaValidationPanel } from './phase4/SchemaValidationPanel';

export default function Phase4SprintHubTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState('audit');

  // Fetch content health stats
  const { data: contentStats } = useQuery({
    queryKey: ['phase4-content-stats'],
    queryFn: async () => {
      // Get blog post count
      const { count: blogCount } = await supabase
        .from('blog_posts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published');

      // Get SEO pages with word count
      const { data: seoPages } = await supabase
        .from('seo_pages')
        .select('word_count, page_type')
        .eq('is_indexed', true);

      const thinContent = seoPages?.filter(p => (p.word_count || 0) < 300).length || 0;
      const goodContent = seoPages?.filter(p => (p.word_count || 0) >= 300).length || 0;

      return {
        totalBlogPosts: blogCount || 0,
        targetBlogPosts: 300,
        thinContentPages: thinContent,
        goodContentPages: goodContent,
        totalSeoPages: seoPages?.length || 0
      };
    }
  });

  // Fetch visitor analytics for KPIs
  const { data: kpiData } = useQuery({
    queryKey: ['phase4-kpi-data'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get appointments (conversions)
      const { count: totalConversions } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Get leads count as sessions proxy
      const { count: totalLeads } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Estimate sessions and pageviews from available data
      const sessions = (totalLeads || 0) * 10; // Estimate
      const pageviews = sessions * 3; // Avg pages per session
      const profileViews = (totalConversions || 0) * 5; // Estimate

      return {
        sessions,
        pageviews,
        conversions: totalConversions || 0,
        profileViews,
        conversionRate: sessions ? ((totalConversions || 0) / sessions * 100).toFixed(2) : '0',
        pagesPerSession: '3.2' // Estimated average
      };
    }
  });

  const milestones = [
    {
      month: 3,
      targets: [
        { label: '30% traffic increase', achieved: false },
        { label: '35 service pages (3,500+ words)', achieved: true },
        { label: '82 city pages (2,500+ words)', achieved: true },
        { label: '40 blog posts', achieved: (contentStats?.totalBlogPosts || 0) >= 40 },
        { label: 'Core Web Vitals green', achieved: true },
        { label: 'Schema markup site-wide', achieved: true },
        { label: '200+ dentists claimed', achieved: false },
        { label: '10-15 quality backlinks', achieved: false },
      ]
    },
    {
      month: 6,
      targets: [
        { label: '100% traffic increase', achieved: false },
        { label: '100 blog posts', achieved: (contentStats?.totalBlogPosts || 0) >= 100 },
        { label: '150+ neighborhood pages', achieved: false },
        { label: '500+ dentists claimed', achieved: false },
        { label: '40-60 quality backlinks', achieved: false },
        { label: '150+ keywords in top 20', achieved: false },
      ]
    },
    {
      month: 12,
      targets: [
        { label: '300% traffic increase', achieved: false },
        { label: '250-300 blog posts', achieved: (contentStats?.totalBlogPosts || 0) >= 250 },
        { label: '1,000+ dentists claimed', achieved: false },
        { label: 'Domain Authority 50+', achieved: false },
        { label: '150+ keywords in top 10', achieved: false },
        { label: '1,000+ conversions/month', achieved: (kpiData?.conversions || 0) >= 1000 },
      ]
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Phase 4: Optimization & Scaling
          </h2>
          <p className="text-muted-foreground">
            Weeks 25-52 • Content optimization, advanced features, and scaling to 300+ posts
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {contentStats?.totalBlogPosts || 0} / 300 Posts
        </Badge>
      </div>

      {/* Sprint Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Sprint 4.1: Content Audit
            </CardTitle>
            <CardDescription>Weekly 25-28</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Thin Content Pages</span>
                <span className="text-destructive font-medium">{contentStats?.thinContentPages || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Good Content Pages</span>
                <span className="text-green-600 font-medium">{contentStats?.goodContentPages || 0}</span>
              </div>
              <Progress 
                value={contentStats?.totalSeoPages ? (contentStats.goodContentPages / contentStats.totalSeoPages * 100) : 0} 
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Sprint 4.2: Advanced Features
            </CardTitle>
            <CardDescription>Weeks 29-36</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Advanced Filters</span>
                <Badge variant="secondary">Ready</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Enhanced Reviews</span>
                <Badge variant="outline">Planned</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Virtual Consults</span>
                <Badge variant="outline">Planned</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Sprint 4.3: Content Expansion
            </CardTitle>
            <CardDescription>Weeks 37-52</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Blog Posts</span>
                <span className="font-medium">{contentStats?.totalBlogPosts || 0} / 300</span>
              </div>
              <Progress 
                value={(contentStats?.totalBlogPosts || 0) / 300 * 100} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground">
                {300 - (contentStats?.totalBlogPosts || 0)} posts remaining
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <TabsList className="grid grid-cols-6 w-full max-w-4xl">
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Content Audit
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="schema" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Schema
          </TabsTrigger>
          <TabsTrigger value="features" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Features
          </TabsTrigger>
          <TabsTrigger value="kpi" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            KPI
          </TabsTrigger>
          <TabsTrigger value="milestones" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Milestones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="mt-6">
          <ContentAuditPanel />
        </TabsContent>

        <TabsContent value="performance" className="mt-6">
          <PerformanceAuditPanel />
        </TabsContent>

        <TabsContent value="schema" className="mt-6">
          <SchemaValidationPanel />
        </TabsContent>

        <TabsContent value="features" className="mt-6">
          <AdvancedFeaturesPanel />
        </TabsContent>

        <TabsContent value="kpi" className="mt-6">
          <KPIDashboard kpiData={kpiData} />
        </TabsContent>

        <TabsContent value="milestones" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {milestones.map((milestone) => (
              <Card key={milestone.month}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Month {milestone.month} Targets
                  </CardTitle>
                  <CardDescription>
                    {milestone.targets.filter(t => t.achieved).length} / {milestone.targets.length} achieved
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {milestone.targets.map((target, idx) => (
                        <div 
                          key={idx}
                          className={`flex items-center gap-2 p-2 rounded text-sm ${
                            target.achieved 
                              ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' 
                              : 'bg-muted'
                          }`}
                        >
                          {target.achieved ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          )}
                          {target.label}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
