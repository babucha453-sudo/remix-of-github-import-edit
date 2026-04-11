import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Search, Building2, MapPin, Loader2, Check, UserPlus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AssignClinicModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userEmail: string;
}

interface Clinic {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  city: { name: string } | null;
  claim_status: string | null;
  claimed_by: string | null;
}

export function AssignClinicModal({
  open,
  onOpenChange,
  userId,
  userName,
  userEmail,
}: AssignClinicModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);

  // Search clinics
  const { data: clinics, isLoading: searching } = useQuery({
    queryKey: ['clinics-for-assignment', search],
    queryFn: async () => {
      let query = supabase
        .from('clinics')
        .select('id, name, slug, address, claim_status, claimed_by, city:cities(name)')
        .order('name', { ascending: true })
        .limit(50);

      if (search.length >= 2) {
        query = query.ilike('name', `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Clinic[];
    },
    enabled: open,
  });

  // Assign clinic mutation
  const assignClinic = useMutation({
    mutationFn: async (clinicId: string) => {
      // 1. Update clinic claimed_by
      const { error: clinicError } = await supabase
        .from('clinics')
        .update({
          claimed_by: userId,
          claim_status: 'claimed',
          claimed_at: new Date().toISOString(),
        })
        .eq('id', clinicId);

      if (clinicError) throw clinicError;

      // 2. Ensure user has dentist role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role', 'dentist')
        .maybeSingle();

      if (!existingRole) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: 'dentist' });
        
        if (roleError) throw roleError;
      }

      // 3. Log the assignment
      await supabase.from('audit_logs').insert({
        action: 'CLINIC_ASSIGNED_BY_ADMIN',
        entity_type: 'clinic',
        entity_id: clinicId,
        user_id: userId,
        new_values: {
          assigned_to_user: userId,
          assigned_to_email: userEmail,
        },
      });

      return { clinicId };
    },
    onSuccess: () => {
      toast({
        title: 'Clinic Assigned',
        description: `Successfully assigned clinic to ${userName || userEmail}`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['clinics-for-assignment'] });
      onOpenChange(false);
      setSelectedClinic(null);
      setSearch('');
    },
    onError: (error: any) => {
      console.error('Assignment error:', error);
      toast({
        title: 'Assignment Failed',
        description: error.message || 'Failed to assign clinic',
        variant: 'destructive',
      });
    },
  });

  const handleAssign = () => {
    if (selectedClinic) {
      assignClinic.mutate(selectedClinic.id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Assign Clinic to User
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* User info */}
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">Assigning clinic to:</p>
            <p className="font-medium">{userName || 'Unnamed User'}</p>
            <p className="text-sm text-muted-foreground">{userEmail}</p>
          </div>

          {/* Search clinics */}
          <div className="space-y-2">
            <Label>Search Clinics</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Type clinic name to search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Clinic list */}
          <ScrollArea className="h-[300px] border rounded-lg">
            <div className="p-2 space-y-1">
              {searching ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Searching clinics...
                </div>
              ) : clinics && clinics.length > 0 ? (
                clinics.map((clinic) => {
                  const isSelected = selectedClinic?.id === clinic.id;
                  const isClaimed = clinic.claim_status === 'claimed' && clinic.claimed_by;
                  
                  return (
                    <button
                      key={clinic.id}
                      onClick={() => setSelectedClinic(clinic)}
                      disabled={isClaimed && clinic.claimed_by !== userId}
                      className={`w-full p-3 rounded-lg text-left transition-colors ${
                        isSelected
                          ? 'bg-primary/10 border-2 border-primary'
                          : 'hover:bg-muted/50 border border-transparent'
                      } ${isClaimed && clinic.claimed_by !== userId ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{clinic.name}</p>
                            {clinic.city?.name && (
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {clinic.city.name}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isClaimed && clinic.claimed_by !== userId && (
                            <Badge variant="secondary" className="text-xs">Claimed</Badge>
                          )}
                          {isSelected && (
                            <Check className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>{search.length >= 2 ? 'No clinics found' : 'Type to search clinics'}</p>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedClinic || assignClinic.isPending}
              className="flex-1"
            >
              {assignClinic.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Assign Clinic'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
