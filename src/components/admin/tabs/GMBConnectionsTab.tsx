import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Globe, 
  Building2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw, 
  Search, 
  AlertTriangle,
  Star,
  TrendingUp,
  Link as LinkIcon,
  Settings,
  Activity
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface GMBClinic {
  id: string;
  name: string;
  slug: string;
  google_place_id: string | null;
  gmb_connected: boolean;
  rating: number | null;
  review_count: number | null;
  claim_status: string | null;
  verification_status: string | null;
  is_active: boolean | null;
  source: string | null;
  // From joined clinic_oauth_tokens table
  oauth_tokens?: {
    gmb_connected: boolean;
    gmb_location_id: string | null;
    gmb_last_sync_at: string | null;
    gmb_account_email: string | null;
    gmb_data: unknown;
  } | null;
}

export default function GMBConnectionsTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'connected' | 'disconnected'>('all');

  // Fetch all clinics with GMB data from secure oauth tokens table
  const { data: clinics = [], isLoading, refetch } = useQuery({
    queryKey: ['gmb-connections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select(`
          id, name, slug, google_place_id, gmb_connected, rating, review_count, claim_status, verification_status, is_active, source,
          oauth_tokens:clinic_oauth_tokens(gmb_connected, gmb_location_id, gmb_last_sync_at, gmb_account_email, gmb_data)
        `)
        .order('name')
        .limit(1000);
      if (error) throw error;
      return (data || []).map((c: any) => ({
        ...c,
        oauth_tokens: Array.isArray(c.oauth_tokens) ? c.oauth_tokens[0] : c.oauth_tokens
      })) as GMBClinic[];
    },
  });

  // Calculate stats - CRITICAL: gmb_connected flag indicates real OAuth connection
  // google_place_id only means the clinic was imported from GMB, NOT that it's connected
  const totalClinics = clinics.length;
  
  // Truly connected = has oauth_tokens with gmb_connected=true
  const trulyConnectedClinics = clinics.filter(c => c.oauth_tokens?.gmb_connected === true || c.gmb_connected === true);
  
  // Imported but not connected = has google_place_id but no OAuth
  const importedNotConnected = clinics.filter(c => c.google_place_id && !c.oauth_tokens?.gmb_connected && !c.gmb_connected);
  
  // Not linked at all
  const notLinked = clinics.filter(c => !c.google_place_id && !c.oauth_tokens?.gmb_connected && !c.gmb_connected);
  
  const recentlySynced = clinics.filter(c => {
    const syncAt = c.oauth_tokens?.gmb_last_sync_at;
    if (!syncAt) return false;
    const syncDate = new Date(syncAt);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return syncDate >= dayAgo;
  });
  
  const syncErrors = clinics.filter(c => {
    const gmbData = c.oauth_tokens?.gmb_data as any;
    return gmbData?.sync_error;
  });

  const connectionRate = totalClinics > 0 ? Math.round((trulyConnectedClinics.length / totalClinics) * 100) : 0;

  // Filter clinics
  const filteredClinics = clinics.filter(clinic => {
    const matchesSearch = clinic.name.toLowerCase().includes(searchQuery.toLowerCase());
    const isConnected = clinic.oauth_tokens?.gmb_connected === true || clinic.gmb_connected === true;
    
    if (filterStatus === 'connected') return matchesSearch && isConnected;
    if (filterStatus === 'disconnected') return matchesSearch && !isConnected;
    return matchesSearch;
  });

  const getConnectionStatus = (clinic: GMBClinic) => {
    // True connection = OAuth token stored
    const isConnected = clinic.oauth_tokens?.gmb_connected === true || clinic.gmb_connected === true;
    if (isConnected) {
      const gmbData = clinic.oauth_tokens?.gmb_data as any;
      if (gmbData?.sync_error) {
        return { status: 'error', label: 'Sync Error', color: 'text-coral' };
      }
      return { status: 'connected', label: 'OAuth Connected', color: 'text-teal' };
    }
    
    // Has google_place_id but no OAuth = imported only
    if (clinic.google_place_id) {
      return { status: 'imported', label: 'Imported (No OAuth)', color: 'text-gold' };
    }
    
    return { status: 'disconnected', label: 'Not Linked', color: 'text-muted-foreground' };
  };

  const getLastSyncTime = (clinic: GMBClinic) => {
    const syncAt = clinic.oauth_tokens?.gmb_last_sync_at;
    if (syncAt) {
      try {
        return formatDistanceToNow(new Date(syncAt), { addSuffix: true });
      } catch {
        return 'Unknown';
      }
    }
    return 'Never';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            GMB Connections
          </h1>
          <p className="text-muted-foreground mt-1">Monitor Google Business Profile sync status across all clinics</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Settings className="h-4 w-4 mr-2" />
            Sync Settings
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="card-modern bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <p className="text-3xl font-bold">{totalClinics}</p>
            <p className="text-sm text-muted-foreground">Total Clinics</p>
          </CardContent>
        </Card>

        <Card className="card-modern bg-gradient-to-br from-teal/10 to-transparent border-teal/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="h-5 w-5 text-teal" />
              <Badge variant="outline" className="text-[10px]">{connectionRate}%</Badge>
            </div>
            <p className="text-3xl font-bold">{trulyConnectedClinics.length}</p>
            <p className="text-sm text-muted-foreground">OAuth Connected</p>
          </CardContent>
        </Card>

        <Card className="card-modern bg-gradient-to-br from-gold/10 to-transparent border-gold/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <LinkIcon className="h-5 w-5 text-gold" />
            </div>
            <p className="text-3xl font-bold">{importedNotConnected.length}</p>
            <p className="text-sm text-muted-foreground">Imported Only</p>
          </CardContent>
        </Card>

        <Card className="card-modern bg-gradient-to-br from-muted/30 to-transparent border-muted">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <XCircle className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold">{notLinked.length}</p>
            <p className="text-sm text-muted-foreground">Not Linked</p>
          </CardContent>
        </Card>

        <Card className="card-modern bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Activity className="h-5 w-5 text-blue-500" />
            </div>
            <p className="text-3xl font-bold">{recentlySynced.length}</p>
            <p className="text-sm text-muted-foreground">Synced (24h)</p>
          </CardContent>
        </Card>

        <Card className="card-modern bg-gradient-to-br from-coral/10 to-transparent border-coral/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="h-5 w-5 text-coral" />
            </div>
            <p className="text-3xl font-bold">{syncErrors.length}</p>
            <p className="text-sm text-muted-foreground">Sync Errors</p>
          </CardContent>
        </Card>
      </div>

      {/* Connection Rate Progress */}
      <Card className="card-modern border-primary/20 bg-gradient-to-r from-primary/5 via-card to-teal/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-bold text-lg">True OAuth Connection Rate</p>
              <p className="text-sm text-muted-foreground">Clinics with active Google Business OAuth tokens (not just imported)</p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold bg-gradient-to-r from-primary to-teal bg-clip-text text-transparent">{connectionRate}%</p>
              <p className="text-sm text-muted-foreground">{trulyConnectedClinics.length} of {totalClinics}</p>
            </div>
          </div>
          <Progress value={connectionRate} className="h-3" />
          <div className="mt-4 grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <p className="font-bold text-teal">{trulyConnectedClinics.length}</p>
              <p className="text-muted-foreground">OAuth Connected</p>
            </div>
            <div>
              <p className="font-bold text-gold">{importedNotConnected.length}</p>
              <p className="text-muted-foreground">Imported Only</p>
            </div>
            <div>
              <p className="font-bold text-muted-foreground">{notLinked.length}</p>
              <p className="text-muted-foreground">Not Linked</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search & Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clinics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('all')}
          >
            All ({totalClinics})
          </Button>
          <Button
            variant={filterStatus === 'connected' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('connected')}
            className={filterStatus === 'connected' ? 'bg-teal hover:bg-teal/90' : ''}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            OAuth ({trulyConnectedClinics.length})
          </Button>
          <Button
            variant={filterStatus === 'disconnected' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('disconnected')}
          >
            <XCircle className="h-4 w-4 mr-1" />
            Not Connected ({totalClinics - trulyConnectedClinics.length})
          </Button>
        </div>
      </div>

      {/* Clinics Table */}
      <Card className="card-modern">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Clinic GMB Status
          </CardTitle>
          <CardDescription>
            Real-time sync status for all Google Business Profiles
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinic</TableHead>
                <TableHead>GMB Status</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Reviews</TableHead>
                <TableHead>Last Sync</TableHead>
                <TableHead>Claim Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClinics.slice(0, 50).map((clinic) => {
                const connection = getConnectionStatus(clinic);
                return (
                  <TableRow key={clinic.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{clinic.name}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {clinic.google_place_id || 'No GMB ID'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {connection.status === 'connected' ? (
                          <CheckCircle className="h-4 w-4 text-teal" />
                        ) : connection.status === 'imported' ? (
                          <LinkIcon className="h-4 w-4 text-gold" />
                        ) : connection.status === 'error' ? (
                          <AlertTriangle className="h-4 w-4 text-coral" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className={connection.color}>{connection.label}</span>
                      </div>
                      {clinic.oauth_tokens?.gmb_account_email && (
                        <p className="text-xs text-muted-foreground mt-1">{clinic.oauth_tokens.gmb_account_email}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      {clinic.rating ? (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-gold text-gold" />
                          <span className="font-medium">{clinic.rating.toFixed(1)}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{clinic.review_count || 0}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {getLastSyncTime(clinic)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={clinic.claim_status === 'claimed' ? 'default' : 'outline'}
                        className={clinic.claim_status === 'claimed' ? 'bg-teal/20 text-teal border-0' : ''}
                      >
                        {clinic.claim_status || 'unclaimed'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {clinic.google_place_id && (
                        <Button size="sm" variant="outline">
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Sync
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredClinics.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No clinics found matching your criteria</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {filteredClinics.length > 50 && (
            <div className="p-4 text-center border-t">
              <p className="text-sm text-muted-foreground">
                Showing 50 of {filteredClinics.length} clinics
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}