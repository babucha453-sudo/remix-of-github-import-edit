/**
 * KPI Dashboard - Phase 4 Analytics & Reporting
 * 
 * Weekly/Monthly metrics tracking:
 * - Traffic metrics
 * - Engagement metrics
 * - Conversion metrics
 * - SEO performance
 * - Content metrics
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown,
  Users,
  Eye,
  MousePointer,
  Clock,
  FileText,
  Target,
  Calendar,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';

interface KPIData {
  sessions: number;
  pageviews: number;
  conversions: number;
  profileViews: number;
  conversionRate: string;
  pagesPerSession: string;
}

interface KPIDashboardProps {
  kpiData?: KPIData;
}

export default function KPIDashboard({ kpiData }: KPIDashboardProps) {
  const trafficMetrics = [
    {
      label: 'Total Sessions',
      value: kpiData?.sessions?.toLocaleString() || '0',
      change: '+12.5%',
      trend: 'up' as const,
      icon: Users,
      description: 'Unique visitor sessions in last 30 days'
    },
    {
      label: 'Total Pageviews',
      value: kpiData?.pageviews?.toLocaleString() || '0',
      change: '+18.3%',
      trend: 'up' as const,
      icon: Eye,
      description: 'Page views across all pages'
    },
    {
      label: 'Profile Views',
      value: kpiData?.profileViews?.toLocaleString() || '0',
      change: '+8.7%',
      trend: 'up' as const,
      icon: FileText,
      description: 'Dentist profile page views'
    },
    {
      label: 'Pages per Session',
      value: kpiData?.pagesPerSession || '0',
      change: '+2.1%',
      trend: 'up' as const,
      icon: MousePointer,
      description: 'Average pages viewed per visit'
    }
  ];

  const conversionMetrics = [
    {
      label: 'Total Conversions',
      value: kpiData?.conversions?.toLocaleString() || '0',
      target: 1000,
      description: 'Appointment requests & form submissions'
    },
    {
      label: 'Conversion Rate',
      value: `${kpiData?.conversionRate || '0'}%`,
      target: 3,
      description: 'Sessions to conversions'
    }
  ];

  const monthlyTargets = [
    { 
      label: 'Organic Traffic Growth', 
      current: 45, 
      target: 100, 
      unit: '%',
      description: 'vs. Month 1 baseline'
    },
    { 
      label: 'Blog Posts Published', 
      current: 68, 
      target: 100, 
      unit: ' posts',
      description: 'Month 6 target'
    },
    { 
      label: 'Keywords in Top 20', 
      current: 87, 
      target: 150, 
      unit: '',
      description: 'Tracked keywords ranking'
    },
    { 
      label: 'Backlinks Acquired', 
      current: 28, 
      target: 60, 
      unit: '',
      description: 'Quality backlinks'
    },
    { 
      label: 'Dentists Claimed', 
      current: 312, 
      target: 500, 
      unit: '',
      description: 'Verified profiles'
    }
  ];

  const contentMetrics = {
    postsThisMonth: 12,
    totalPosts: 68,
    topPerforming: [
      { title: 'Best Cosmetic Dentists in Los Angeles', views: 4520 },
      { title: 'Dental Implant Cost Guide 2026', views: 3890 },
      { title: 'Root Canal vs Extraction: Complete Comparison', views: 2340 }
    ],
    topCities: [
      { city: 'Los Angeles', views: 12450 },
      { city: 'San Francisco', views: 8920 },
      { city: 'Boston', views: 6780 }
    ],
    topServices: [
      { service: 'Dental Implants', views: 9870 },
      { service: 'Invisalign', views: 7650 },
      { service: 'Teeth Whitening', views: 5430 }
    ]
  };

  const renderTrend = (trend: 'up' | 'down' | 'neutral', change: string) => {
    if (trend === 'up') {
      return (
        <span className="flex items-center text-green-600 text-sm">
          <ArrowUp className="h-4 w-4" />
          {change}
        </span>
      );
    } else if (trend === 'down') {
      return (
        <span className="flex items-center text-destructive text-sm">
          <ArrowDown className="h-4 w-4" />
          {change}
        </span>
      );
    }
    return (
      <span className="flex items-center text-muted-foreground text-sm">
        <Minus className="h-4 w-4" />
        {change}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Traffic Metrics */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Traffic Metrics (Last 30 Days)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {trafficMetrics.map((metric) => (
            <Card key={metric.label}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{metric.label}</p>
                    <p className="text-2xl font-bold mt-1">{metric.value}</p>
                    {renderTrend(metric.trend, metric.change)}
                  </div>
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <metric.icon className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{metric.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Conversion Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Conversion Metrics
            </CardTitle>
            <CardDescription>Appointment requests and lead generation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {conversionMetrics.map((metric) => (
                <div key={metric.label} className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-3xl font-bold">{metric.value}</p>
                  <p className="text-sm font-medium">{metric.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Monthly Targets Progress
            </CardTitle>
            <CardDescription>Month 6 milestone tracking</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {monthlyTargets.slice(0, 3).map((target) => (
                <div key={target.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{target.label}</span>
                    <span className="font-medium">
                      {target.current}{target.unit} / {target.target}{target.unit}
                    </span>
                  </div>
                  <Progress 
                    value={(target.current / target.target) * 100} 
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full Targets Grid */}
      <Card>
        <CardHeader>
          <CardTitle>All KPI Targets</CardTitle>
          <CardDescription>Progress toward Month 12 goals</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {monthlyTargets.map((target) => {
              const progress = (target.current / target.target) * 100;
              const status = progress >= 100 ? 'complete' : progress >= 75 ? 'on-track' : progress >= 50 ? 'warning' : 'behind';
              
              return (
                <div 
                  key={target.label}
                  className={`p-4 rounded-lg border ${
                    status === 'complete' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' :
                    status === 'on-track' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' :
                    status === 'warning' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20' :
                    'border-destructive bg-red-50 dark:bg-red-950/20'
                  }`}
                >
                  <div className="text-center">
                    <p className="text-2xl font-bold">{target.current}</p>
                    <p className="text-sm text-muted-foreground">of {target.target}{target.unit}</p>
                    <Progress value={Math.min(progress, 100)} className="h-1 mt-2" />
                    <p className="text-xs font-medium mt-2">{target.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Content Performance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Blog Posts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {contentMetrics.topPerforming.map((post, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1 mr-2">{post.title}</span>
                  <Badge variant="secondary">{post.views.toLocaleString()}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Cities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {contentMetrics.topCities.map((city, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span>{city.city}</span>
                  <Badge variant="secondary">{city.views.toLocaleString()}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {contentMetrics.topServices.map((service, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span>{service.service}</span>
                  <Badge variant="secondary">{service.views.toLocaleString()}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
