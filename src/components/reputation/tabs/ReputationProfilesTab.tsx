import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Building2, Star, MessageSquare, TrendingUp, Search, Eye, Shield, AlertTriangle } from 'lucide-react';

interface Props {
  clinicId?: string;
  isAdmin?: boolean;
}

export default function ReputationProfilesTab({ clinicId, isAdmin }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClinic, setSelectedClinic] = useState<any>(null);

  // Fetch clinics with reputation data
  const { data: clinics = [], isLoading } = useQuery({
    queryKey: ['rep-profiles', clinicId],
    queryFn: async () => {
      let query = supabase
        .from('clinics')
        .select('id, name, slug, rating, review_count, is_active, claimed_by')
        .eq('is_active', true)
        .order('rating', { ascending: false });
      if (clinicId) query = query.eq('id', clinicId);
      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin || !!clinicId,
  });

  // Fetch clinic-specific stats when selected
  const { data: clinicStats } = useQuery({
    queryKey: ['rep-profile-stats', selectedClinic?.id],
    queryFn: async () => {
      const [googleRes, internalRes, funnelRes] = await Promise.all([
        supabase
          .from('google_reviews')
          .select('rating, reply_status')
          .eq('clinic_id', selectedClinic.id),
        supabase
          .from('internal_reviews')
          .select('rating, status')
          .eq('clinic_id', selectedClinic.id),
        supabase
          .from('review_funnel_events')
          .select('event_type')
          .eq('clinic_id', selectedClinic.id),
      ]);

      const google = googleRes.data || [];
      const internal = internalRes.data || [];
      const funnel = funnelRes.data || [];

      return {
        googleCount: google.length,
        googleAvg: google.length
          ? google.reduce((s: number, r: any) => s + r.rating, 0) / google.length
          : 0,
        unreplied: google.filter((r: any) => r.reply_status !== 'posted').length,
        internalCount: internal.length,
        internalNew: internal.filter((r: any) => r.status === 'new').length,
        funnelUp: funnel.filter((e: any) => e.event_type === 'thumbs_up').length,
        funnelDown: funnel.filter((e: any) => e.event_type === 'thumbs_down').length,
      };
    },
    enabled: !!selectedClinic,
  });

  const filteredClinics = clinics.filter(
    (c: any) => c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isAdmin && clinicId) {
    // Single clinic view for dentist
    const clinic = clinics[0];
    if (isLoading) return <Skeleton className="h-64 rounded-xl" />;
    if (!clinic) return <div className="text-center py-12 text-muted-foreground">No profile found</div>;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {clinic.name}
          </CardTitle>
          <CardDescription>Your practice reputation profile</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <Star className="h-6 w-6 mx-auto mb-2 text-amber-500" />
              <p className="text-2xl font-bold">{clinic.rating?.toFixed(1) || 'N/A'}</p>
              <p className="text-sm text-muted-foreground">Rating</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <MessageSquare className="h-6 w-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{clinic.review_count || 0}</p>
              <p className="text-sm text-muted-foreground">Reviews</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <Shield className="h-6 w-6 mx-auto mb-2 text-emerald-500" />
              <p className="text-2xl font-bold">{clinic.claimed_by ? 'Yes' : 'No'}</p>
              <p className="text-sm text-muted-foreground">Claimed</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <TrendingUp className="h-6 w-6 mx-auto mb-2 text-blue-500" />
              <p className="text-2xl font-bold">Active</p>
              <p className="text-sm text-muted-foreground">Status</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Admin view - all clinics
  return (
    <div className="space-y-6">
      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clinics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Clinics List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Clinic Profiles ({filteredClinics.length})
          </CardTitle>
          <CardDescription>Reputation profiles for all clinics</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : filteredClinics.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No clinics found
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3 pr-4">
                {filteredClinics.map((clinic: any) => (
                  <div
                    key={clinic.id}
                    onClick={() => setSelectedClinic(clinic)}
                    className="p-4 rounded-xl border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{clinic.name}</span>
                          {clinic.claimed_by && (
                            <Badge className="bg-emerald-100 text-emerald-700">Claimed</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                            {clinic.rating?.toFixed(1) || 'N/A'}
                          </span>
                          <span>{clinic.review_count || 0} reviews</span>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Clinic Detail Dialog */}
      <Dialog open={!!selectedClinic} onOpenChange={() => setSelectedClinic(null)}>
        <DialogContent className="max-w-lg">
          {selectedClinic && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedClinic.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <p className="text-2xl font-bold">{clinicStats?.googleCount || 0}</p>
                    <p className="text-sm text-muted-foreground">Google Reviews</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <p className="text-2xl font-bold">{clinicStats?.unreplied || 0}</p>
                    <p className="text-sm text-muted-foreground">Unreplied</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <p className="text-2xl font-bold">{clinicStats?.funnelUp || 0}</p>
                    <p className="text-sm text-muted-foreground">Thumbs Up</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <p className="text-2xl font-bold">{clinicStats?.funnelDown || 0}</p>
                    <p className="text-sm text-muted-foreground">Private Feedback</p>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button variant="outline" className="flex-1 gap-2">
                      <Shield className="h-4 w-4" />
                      Lock Automation
                    </Button>
                    <Button variant="outline" className="flex-1 gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Add to Watchlist
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
