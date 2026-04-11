import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Globe,
  Building2,
  MapPin,
  Stethoscope,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';

interface RouteTest {
  path: string;
  type: 'city' | 'area' | 'service' | 'clinic' | 'dentist' | 'blog' | 'static';
  name: string;
  status: 'pending' | 'success' | 'error' | 'not-found';
  responseTime?: number;
}

export default function SmokeTestTab() {
  const [testResults, setTestResults] = useState<RouteTest[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // Fetch all routes to test
  const { data: cities } = useQuery({
    queryKey: ['smoke-test-cities'],
    queryFn: async () => {
      const { data } = await supabase.from('cities').select('slug, name').eq('is_active', true).limit(5);
      return data || [];
    },
  });

  const { data: areas } = useQuery({
    queryKey: ['smoke-test-areas'],
    queryFn: async () => {
      const { data } = await supabase.from('areas').select('slug, name, cities!inner(slug)').eq('is_active', true).limit(5);
      return data || [];
    },
  });

  const { data: treatments } = useQuery({
    queryKey: ['smoke-test-treatments'],
    queryFn: async () => {
      const { data } = await supabase.from('treatments').select('slug, name').eq('is_active', true).limit(5);
      return data || [];
    },
  });

  const { data: clinics } = useQuery({
    queryKey: ['smoke-test-clinics'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinics')
        .select('slug, name')
        .eq('is_active', true)
        .limit(10);
      return data || [];
    },
  });

  const { data: dentists } = useQuery({
    queryKey: ['smoke-test-dentists'],
    queryFn: async () => {
      const { data } = await supabase.from('dentists').select('slug, name').eq('is_active', true).limit(5);
      return data || [];
    },
  });

  const { data: blogPosts } = useQuery({
    queryKey: ['smoke-test-blog'],
    queryFn: async () => {
      const { data } = await supabase.from('blog_posts').select('slug, title').eq('status', 'published').limit(3);
      return data || [];
    },
  });

  const buildTestRoutes = (): RouteTest[] => {
    const routes: RouteTest[] = [];

    // Static pages
    const staticPages = [
      { path: '/', name: 'Home' },
      { path: '/search', name: 'Search' },
      { path: '/services', name: 'All Services' },
      { path: '/blog', name: 'Blog' },
      { path: '/about', name: 'About' },
      { path: '/contact', name: 'Contact' },
      { path: '/faq', name: 'FAQs' },
      { path: '/insurance', name: 'Insurance' },
    ];
    staticPages.forEach(p => routes.push({ path: p.path, type: 'static', name: p.name, status: 'pending' }));

    // State/City pages (new US structure)
    cities?.forEach(city => {
      routes.push({ path: `/ma/${city.slug}`, type: 'city', name: city.name, status: 'pending' });
    });

    // Area pages - skip for now as areas need proper state context
    // areas?.forEach(area => {
    //   const citySlug = (area as any).cities?.slug || 'boston';
    //   routes.push({ path: `/ma/${citySlug}/${area.slug}`, type: 'area', name: area.name, status: 'pending' });
    // });

    // Service pages
    treatments?.forEach(t => {
      routes.push({ path: `/services/${t.slug}`, type: 'service', name: t.name, status: 'pending' });
    });

    // Clinic pages
    clinics?.forEach(clinic => {
      routes.push({ path: `/clinic/${clinic.slug}`, type: 'clinic', name: clinic.name, status: 'pending' });
    });

    // Dentist pages
    dentists?.forEach(dentist => {
      routes.push({ path: `/dentist/${dentist.slug}`, type: 'dentist', name: dentist.name, status: 'pending' });
    });

    // Blog pages
    blogPosts?.forEach(post => {
      routes.push({ path: `/blog/${post.slug}`, type: 'blog', name: post.title, status: 'pending' });
    });

    return routes;
  };

  const runSmokeTest = async () => {
    const routes = buildTestRoutes();
    setTestResults(routes);
    setIsRunning(true);

    const baseUrl = window.location.origin;
    const results: RouteTest[] = [];

    for (const route of routes) {
      const start = performance.now();
      try {
        const response = await fetch(`${baseUrl}${route.path}`, { method: 'HEAD' });
        const responseTime = Math.round(performance.now() - start);
        
        // Check if the page returns a valid HTML page (not 404)
        // Since it's a SPA, we need to check the actual page content
        const fullResponse = await fetch(`${baseUrl}${route.path}`);
        const text = await fullResponse.text();
        
        // Check for NotFound content in the page
        const isNotFound = text.includes('Page Not Found') || text.includes('404');
        
        results.push({
          ...route,
          status: isNotFound ? 'not-found' : 'success',
          responseTime,
        });
      } catch (error) {
        results.push({
          ...route,
          status: 'error',
          responseTime: Math.round(performance.now() - start),
        });
      }

      setTestResults([...results, ...routes.slice(results.length)]);
    }

    setTestResults(results);
    setIsRunning(false);

    const successCount = results.filter(r => r.status === 'success').length;
    const failCount = results.filter(r => r.status !== 'success').length;

    if (failCount === 0) {
      toast.success(`All ${successCount} routes passed!`);
    } else {
      toast.error(`${failCount} routes failed out of ${results.length}`);
    }
  };

  const getStatusIcon = (status: RouteTest['status']) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'not-found': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default: return <div className="h-4 w-4 rounded-full bg-muted animate-pulse" />;
    }
  };

  const getTypeIcon = (type: RouteTest['type']) => {
    switch (type) {
      case 'city': return <MapPin className="h-4 w-4" />;
      case 'area': return <MapPin className="h-4 w-4" />;
      case 'service': return <Stethoscope className="h-4 w-4" />;
      case 'clinic': return <Building2 className="h-4 w-4" />;
      case 'dentist': return <Building2 className="h-4 w-4" />;
      case 'blog': return <FileText className="h-4 w-4" />;
      default: return <Globe className="h-4 w-4" />;
    }
  };

  const successCount = testResults.filter(r => r.status === 'success').length;
  const errorCount = testResults.filter(r => r.status === 'error' || r.status === 'not-found').length;
  const pendingCount = testResults.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">URL Smoke Test</h1>
          <p className="text-muted-foreground mt-1">Test all public routes for 404 errors and accessibility</p>
        </div>
        <Button onClick={runSmokeTest} disabled={isRunning}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
          {isRunning ? 'Running...' : 'Run Tests'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="card-modern">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Routes</p>
                <p className="text-2xl font-bold">{testResults.length || buildTestRoutes().length}</p>
              </div>
              <Globe className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Passed</p>
                <p className="text-2xl font-bold text-green-500">{successCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-destructive">{errorCount}</p>
              </div>
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-muted-foreground">{pendingCount}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results Table */}
      <Card className="card-modern">
        <CardHeader>
          <CardTitle className="text-lg">Test Results</CardTitle>
          <CardDescription>
            {testResults.length === 0 ? 'Click "Run Tests" to start' : `Tested ${testResults.length} routes`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Status</TableHead>
                <TableHead className="w-24">Type</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Path</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(testResults.length > 0 ? testResults : buildTestRoutes()).map((route, idx) => (
                <TableRow key={idx}>
                  <TableCell>{getStatusIcon(route.status)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="flex items-center gap-1 w-fit capitalize">
                      {getTypeIcon(route.type)}
                      {route.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{route.name}</TableCell>
                  <TableCell>
                    <a 
                      href={route.path} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm font-mono"
                    >
                      {route.path}
                    </a>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {route.responseTime ? `${route.responseTime}ms` : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
