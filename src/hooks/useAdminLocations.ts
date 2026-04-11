import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createAuditLog } from '@/lib/audit';
import { toast } from 'sonner';
import { ACTIVE_STATE_SLUGS, ACTIVE_STATES, isActiveState } from '@/lib/constants/activeStates';

export interface Country {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
}

export interface State {
  id: string;
  name: string;
  abbreviation: string;
  slug: string;
  country_code: string;
  is_active: boolean;
  seo_status: string;
  page_exists: boolean;
  dentist_count?: number;
  city_count?: number;
  created_at: string;
  updated_at: string;
}

export interface City {
  id: string;
  name: string;
  slug: string;
  country: string;
  country_id: string | null;
  state_id: string | null;
  image_url: string | null;
  dentist_count: number;
  is_active: boolean;
  seo_status?: string;
  state?: { id: string; name: string; abbreviation: string };
  created_at: string;
  updated_at: string;
}

export interface Area {
  id: string;
  city_id: string;
  name: string;
  slug: string;
  image_url: string | null;
  dentist_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  city?: City;
}

export function useCountries() {
  return useQuery({
    queryKey: ['countries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('countries')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Country[];
    },
  });
}

export function useAdminStates() {
  return useQuery({
    queryKey: ['admin-states'],
    queryFn: async () => {
      // DB may store full-name slugs (california, new-jersey) so match both formats
      const fullSlugs = ['california', 'connecticut', 'massachusetts', 'new-jersey'];
      const { data, error } = await supabase
        .from('states')
        .select('*')
        .in('slug', [...ACTIVE_STATE_SLUGS, ...fullSlugs])
        .order('name');
      if (error) throw error;
      return data as State[];
    },
  });
}

export function useCreateState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (state: Record<string, unknown>) => {
      const { data, error } = await supabase.from('states').insert([state as never]).select().single();
      if (error) throw error;
      await createAuditLog({ action: 'CREATE', entityType: 'state', entityId: data.id, newValues: state });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-states'] });
      toast.success('State created');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useUpdateState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<State> }) => {
      const { data: old } = await supabase.from('states').select('*').eq('id', id).single();
      const { error } = await supabase.from('states').update(updates).eq('id', id);
      if (error) throw error;
      await createAuditLog({ action: 'UPDATE', entityType: 'state', entityId: id, oldValues: old, newValues: updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-states'] });
      toast.success('State updated');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useToggleStateActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from('states').update({ is_active: isActive }).eq('id', id);
      if (error) throw error;
      await createAuditLog({ action: 'UPDATE', entityType: 'state', entityId: id, newValues: { is_active: isActive } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-states'] });
      queryClient.invalidateQueries({ queryKey: ['states'] });
      queryClient.invalidateQueries({ queryKey: ['states-with-clinics'] });
      toast.success('State visibility updated');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useToggleCityActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from('cities').update({ is_active: isActive }).eq('id', id);
      if (error) throw error;
      await createAuditLog({ action: 'UPDATE', entityType: 'city', entityId: id, newValues: { is_active: isActive } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cities'] });
      queryClient.invalidateQueries({ queryKey: ['cities'] });
      toast.success('City visibility updated');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useCitiesWithClinics() {
  return useQuery({
    queryKey: ['cities-with-clinics'],
    queryFn: async (): Promise<Array<{ id: string; name: string }>> => {
      // Get approved clinics - cast to any to avoid TS deep instantiation issue with Supabase types
      const { data: clinicsRaw, error: clinicError } = await (supabase
        .from('clinics')
        .select('city_id') as any)
        .eq('claim_status', 'approved');
      
      if (clinicError) throw clinicError;
      
      const clinics = clinicsRaw as Array<{ city_id: string | null }> | null;

      // Get unique city IDs
      const cityIdSet = new Set<string>();
      (clinics || []).forEach(c => {
        if (c.city_id) cityIdSet.add(c.city_id);
      });
      
      if (cityIdSet.size === 0) return [];

      // Get all cities and filter
      const { data: citiesRaw, error } = await supabase
        .from('cities')
        .select('id, name');
      
      if (error) throw error;
      
      const cities = citiesRaw as Array<{ id: string; name: string }> | null;
      
      return (cities || []).filter(c => cityIdSet.has(c.id));
    },
  });
}

export function useSeedLocations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('seed-us-locations', {
        body: { action: 'seed_all' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-states'] });
      queryClient.invalidateQueries({ queryKey: ['admin-cities'] });
      queryClient.invalidateQueries({ queryKey: ['geo-expansion-stats'] });
      toast.success(`Seeded ${data.stats?.statesInserted || 0} states and ${data.stats?.citiesInserted || 0} cities`);
    },
    onError: (e) => toast.error('Failed to seed: ' + e.message),
  });
}

export function useLocationStats() {
  return useQuery({
    queryKey: ['location-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('seed-us-locations', {
        body: { action: 'get_stats' },
      });
      if (error) throw error;
      return data.stats;
    },
  });
}

export function useAdminCities(stateId?: string) {
  return useQuery({
    queryKey: ['admin-cities', stateId],
    queryFn: async () => {
      let query = supabase
        .from('cities')
        .select('*, state:states(id, name, abbreviation)')
        .order('name');
      if (stateId) query = query.eq('state_id', stateId);
      const { data, error } = await query;
      if (error) throw error;
      return data as City[];
    },
  });
}

export function useAdminAreas(cityId?: string) {
  return useQuery({
    queryKey: ['admin-areas', cityId],
    queryFn: async () => {
      let query = supabase.from('areas').select('*, city:cities(*)').order('name');
      if (cityId) query = query.eq('city_id', cityId);
      const { data, error } = await query;
      if (error) throw error;
      return data as Area[];
    },
  });
}

export function useCreateCity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (city: Record<string, unknown>) => {
      const { data, error } = await supabase.from('cities').insert([city as never]).select().single();
      if (error) throw error;
      await createAuditLog({ action: 'CREATE', entityType: 'city', entityId: data.id, newValues: city });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cities'] });
      toast.success('City created');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useUpdateCity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<City> }) => {
      const { data: old } = await supabase.from('cities').select('*').eq('id', id).single();
      const { error } = await supabase.from('cities').update(updates).eq('id', id);
      if (error) throw error;
      await createAuditLog({ action: 'UPDATE', entityType: 'city', entityId: id, oldValues: old, newValues: updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cities'] });
      toast.success('City updated');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useCreateArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (area: Record<string, unknown>) => {
      const { data, error } = await supabase.from('areas').insert([area as never]).select().single();
      if (error) throw error;
      await createAuditLog({ action: 'CREATE', entityType: 'area', entityId: data.id, newValues: area });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-areas'] });
      toast.success('Area created');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useUpdateArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Area> }) => {
      const { data: old } = await supabase.from('areas').select('*').eq('id', id).single();
      const { error } = await supabase.from('areas').update(updates).eq('id', id);
      if (error) throw error;
      await createAuditLog({ action: 'UPDATE', entityType: 'area', entityId: id, oldValues: old, newValues: updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-areas'] });
      toast.success('Area updated');
    },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}
