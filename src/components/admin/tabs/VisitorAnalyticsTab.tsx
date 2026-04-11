import { useState } from 'react';
import { useAnalyticsDashboard } from '@/hooks/useAnalyticsDashboard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  Users, Eye, MousePointerClick, Clock, TrendingUp, TrendingDown,
  Globe, MapPin, Monitor, Smartphone, Tablet, Chrome, Filter,
  Calendar, RefreshCw, Download, ArrowRight, CheckCircle, XCircle,
  Navigation, Layers, Target, Activity, BarChart3
} from 'lucide-react';
import { format, subDays } from 'date-fns';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--teal))', 'hsl(var(--coral))', 'hsl(var(--gold))', 'hsl(var(--purple))'];

export default function VisitorAnalyticsTab() {
  const [dateRange, setDateRange] = useState('30');
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [countryFilter, setCountryFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [pageTypeFilter, setPageTypeFilter] = useState('');

  const { data: analytics, isLoading, refetch } = useAnalyticsDashboard({
    dateFrom: `${dateFrom}T00:00:00Z`,
    dateTo: `${dateTo}T23:59:59Z`,
    country: countryFilter || undefined,
    city: cityFilter || undefined,
    pageType: pageTypeFilter || undefined,
  });

  const handleDateRangeChange = (value: string) => {
    setDateRange(value);
    const days = parseInt(value);
    setDateFrom(format(subDays(new Date(), days), 'yyyy-MM-dd'));
    setDateTo(format(new Date(), 'yyyy-MM-dd'));
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getDeviceIcon = (device: string) => {
    switch (device.toLowerCase()) {
      case 'mobile': return <Smartphone className="h-4 w-4" />;
      case 'tablet': return <Tablet className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Visitor Analytics</h1>
          <p className="text-muted-foreground mt-1">Track visitor behavior, journeys, and conversions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-2 border-primary/20">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select value={dateRange} onValueChange={handleDateRangeChange}>
              <SelectTrigger className="w-[140px] border-2">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={pageTypeFilter || 'all'} onValueChange={(v) => setPageTypeFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[140px] border-2">
                <Layers className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Page Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pages</SelectItem>
                <SelectItem value="home">Home</SelectItem>
                <SelectItem value="clinic">Clinic</SelectItem>
                <SelectItem value="dentist">Dentist</SelectItem>
                <SelectItem value="city">City</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="search">Search</SelectItem>
                <SelectItem value="blog">Blog</SelectItem>
              </SelectContent>
            </Select>
            {analytics?.topCountries && analytics.topCountries.length > 0 && (
              <Select value={countryFilter || 'all'} onValueChange={(v) => setCountryFilter(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-[160px] border-2">
                  <Globe className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {analytics.topCountries.map(c => (
                    <SelectItem key={c.country} value={c.country || 'unknown'}>{c.country || 'Unknown'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {analytics?.topCities && analytics.topCities.length > 0 && (
              <Select value={cityFilter || 'all'} onValueChange={(v) => setCityFilter(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-[160px] border-2">
                  <MapPin className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="City" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {analytics.topCities.map(c => (
                    <SelectItem key={c.city} value={c.city || 'unknown'}>{c.city || 'Unknown'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCountryFilter('');
                setCityFilter('');
                setPageTypeFilter('');
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{analytics?.totalVisitors?.toLocaleString() || 0}</p>
                <p className="text-sm text-muted-foreground">Total Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-2 border-teal/20 bg-teal/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-teal/10 border border-teal/20">
                <Eye className="h-6 w-6 text-teal" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{analytics?.totalPageviews?.toLocaleString() || 0}</p>
                <p className="text-sm text-muted-foreground">Page Views</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-2 border-coral/20 bg-coral/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-coral/10 border border-coral/20">
                <MousePointerClick className="h-6 w-6 text-coral" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{analytics?.totalEvents?.toLocaleString() || 0}</p>
                <p className="text-sm text-muted-foreground">Events Tracked</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-2 border-gold/20 bg-gold/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gold/10 border border-gold/20">
                <Target className="h-6 w-6 text-gold" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{analytics?.conversionRate?.toFixed(2) || 0}%</p>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-muted">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics?.uniqueVisitors?.toLocaleString() || 0}</p>
                <p className="text-xs text-muted-foreground">Unique Visitors</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-muted">
                <TrendingDown className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics?.bounceRate?.toFixed(1) || 0}%</p>
                <p className="text-xs text-muted-foreground">Bounce Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-muted">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatDuration(analytics?.avgSessionDuration || 0)}</p>
                <p className="text-xs text-muted-foreground">Avg. Session</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-muted">
                <Activity className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {analytics?.totalPageviews && analytics?.totalVisitors
                    ? (analytics.totalPageviews / analytics.totalVisitors).toFixed(1)
                    : 0}
                </p>
                <p className="text-xs text-muted-foreground">Pages/Session</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="geo">Geographic</TabsTrigger>
          <TabsTrigger value="journeys">Journeys</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Daily Visitors Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Daily Visitors & Pageviews
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics?.dailyVisitors || []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(v) => format(new Date(v), 'MMM d')}
                      className="text-xs"
                    />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      labelFormatter={(v) => format(new Date(v), 'MMM d, yyyy')}
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="visitors" 
                      name="Sessions"
                      stroke="hsl(var(--primary))" 
                      fill="hsl(var(--primary))" 
                      fillOpacity={0.3}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="pageviews" 
                      name="Page Views"
                      stroke="hsl(var(--teal))" 
                      fill="hsl(var(--teal))" 
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Hourly Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Hourly Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics?.hourlyVisitors || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip />
                      <Bar dataKey="visitors" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Device Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Device Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics?.deviceBreakdown || []}
                        dataKey="count"
                        nameKey="device"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        label={({ device, percent }) => `${device} ${(percent * 100).toFixed(0)}%`}
                      >
                        {analytics?.deviceBreakdown?.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Pages</CardTitle>
              <CardDescription>Most viewed pages on your website</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Page</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="w-[200px]">Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics?.topPages?.map((page, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm max-w-[300px] truncate">
                        {page.page}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{page.type}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{page.views.toLocaleString()}</TableCell>
                      <TableCell>
                        <Progress 
                          value={(page.views / (analytics?.totalPageviews || 1)) * 100} 
                          className="h-2"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Appointment Sources */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Appointment Booking Sources
              </CardTitle>
              <CardDescription>Where appointments are booked from</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Page</TableHead>
                    <TableHead className="text-right">Bookings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics?.appointmentSources?.map((source, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">{source.source}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{source.page}</TableCell>
                      <TableCell className="text-right font-bold">{source.count}</TableCell>
                    </TableRow>
                  ))}
                  {(!analytics?.appointmentSources || analytics.appointmentSources.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No appointment source data yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Traffic Sources */}
            <Card>
              <CardHeader>
                <CardTitle>Traffic Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics?.sourceBreakdown?.slice(0, 10).map((source, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{source.source}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{source.visitors}</span>
                        <Progress 
                          value={(source.visitors / (analytics?.totalVisitors || 1)) * 100} 
                          className="h-2 w-20"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Browser Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Browsers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics?.browserBreakdown?.map((browser, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Chrome className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{browser.browser}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{browser.count}</span>
                        <Progress 
                          value={(browser.count / (analytics?.totalVisitors || 1)) * 100} 
                          className="h-2 w-20"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="geo" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Countries */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Top Countries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics?.topCountries?.map((country, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm">{country.country || 'Unknown'}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{country.visitors}</span>
                        <Progress 
                          value={(country.visitors / (analytics?.totalVisitors || 1)) * 100} 
                          className="h-2 w-24"
                        />
                      </div>
                    </div>
                  ))}
                  {(!analytics?.topCountries || analytics.topCountries.length === 0) && (
                    <p className="text-muted-foreground text-sm text-center py-4">
                      Geographic data will appear once visitors are tracked
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Cities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Top Cities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics?.topCities?.map((city, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm">{city.city || 'Unknown'}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{city.visitors}</span>
                        <Progress 
                          value={(city.visitors / (analytics?.totalVisitors || 1)) * 100} 
                          className="h-2 w-24"
                        />
                      </div>
                    </div>
                  ))}
                  {(!analytics?.topCities || analytics.topCities.length === 0) && (
                    <p className="text-muted-foreground text-sm text-center py-4">
                      City data will appear once visitors are tracked
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="journeys" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Navigation className="h-5 w-5 text-primary" />
                Visitor Journeys
              </CardTitle>
              <CardDescription>
                Track how visitors navigate through your site before booking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session</TableHead>
                    <TableHead>Visitor</TableHead>
                    <TableHead>Journey</TableHead>
                    <TableHead>Converted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics?.visitorJourneys?.map((journey, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">
                        {journey.sessionId.slice(0, 12)}...
                      </TableCell>
                      <TableCell>
                        {journey.patientName || <span className="text-muted-foreground">Anonymous</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap max-w-[400px]">
                          {journey.pages.slice(0, 5).map((page, j) => (
                            <div key={j} className="flex items-center">
                              <Badge variant="outline" className="text-xs truncate max-w-[100px]">
                                {page}
                              </Badge>
                              {j < Math.min(journey.pages.length - 1, 4) && (
                                <ArrowRight className="h-3 w-3 mx-1 text-muted-foreground" />
                              )}
                            </div>
                          ))}
                          {journey.pages.length > 5 && (
                            <Badge variant="secondary" className="text-xs">
                              +{journey.pages.length - 5} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {journey.converted ? (
                          <Badge className="bg-teal/10 text-teal border border-teal/20">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Booked
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            <XCircle className="h-3 w-3 mr-1" />
                            No
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!analytics?.visitorJourneys || analytics.visitorJourneys.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No visitor journey data yet. Journeys will appear once tracking is active.
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
