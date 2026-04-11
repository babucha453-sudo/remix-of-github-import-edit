import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Users,
  Plus,
  Stethoscope,
  Star,
  UserCheck,
  GraduationCap,
} from 'lucide-react';
import { createAuditLog } from '@/lib/audit';
import { NoPracticeLinked } from './NoPracticeLinked';
import { TeamMemberCard, TeamMember } from './TeamMemberCard';
import { TeamMemberFormDialog, TeamMemberFormData } from './TeamMemberFormDialog';

const INITIAL_FORM_DATA: TeamMemberFormData = {
  name: '',
  title: '',
  professional_type: 'dentist',
  is_primary: false,
  license_number: '',
  department: '',
  email: '',
  phone: '',
  bio: '',
  years_experience: 0,
  image_url: '',
};

export default function TeamManagementTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [formData, setFormData] = useState<TeamMemberFormData>(INITIAL_FORM_DATA);

  // Fetch clinic
  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['dentist-clinic-team', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch team members
  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['clinic-team', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dentists')
        .select('*')
        .eq('clinic_id', clinic?.id)
        .order('is_primary', { ascending: false })
        .order('name');

      if (error) throw error;
      return (data || []) as TeamMember[];
    },
    enabled: !!clinic?.id,
  });

  // Add team member mutation
  const addMember = useMutation({
    mutationFn: async (data: TeamMemberFormData) => {
      if (!clinic?.id) throw new Error('No clinic found');

      const slug = data.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString(36);
      
      const { error } = await supabase
        .from('dentists')
        .insert({
          clinic_id: clinic.id,
          name: data.name,
          slug,
          title: data.title || null,
          professional_type: data.professional_type,
          is_primary: data.is_primary,
          license_number: data.license_number || null,
          department: data.department || null,
          email: data.email || null,
          phone: data.phone || null,
          bio: data.bio || null,
          years_experience: data.years_experience || null,
          image_url: data.image_url || null,
          is_active: true,
        });

      if (error) throw error;

      await createAuditLog({
        action: 'CREATE',
        entityType: 'team_member',
        entityId: clinic.id,
        newValues: { name: data.name, professional_type: data.professional_type },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-team'] });
      toast.success('Team member added');
      setIsAddDialogOpen(false);
      setFormData(INITIAL_FORM_DATA);
    },
    onError: (e: any) => toast.error(e.message || 'Failed to add team member'),
  });

  // Update team member mutation
  const updateMember = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TeamMemberFormData }) => {
      const { error } = await supabase
        .from('dentists')
        .update({
          name: data.name,
          title: data.title || null,
          professional_type: data.professional_type,
          is_primary: data.is_primary,
          license_number: data.license_number || null,
          department: data.department || null,
          email: data.email || null,
          phone: data.phone || null,
          bio: data.bio || null,
          years_experience: data.years_experience || null,
          image_url: data.image_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      await createAuditLog({
        action: 'UPDATE',
        entityType: 'team_member',
        entityId: id,
        newValues: { name: data.name, professional_type: data.professional_type },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-team'] });
      toast.success('Team member updated');
      setEditMember(null);
      setFormData(INITIAL_FORM_DATA);
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update team member'),
  });

  // Delete team member mutation
  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('dentists')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      await createAuditLog({
        action: 'DELETE',
        entityType: 'team_member',
        entityId: id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-team'] });
      toast.success('Team member removed');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to remove team member'),
  });

  const openEditDialog = (member: TeamMember) => {
    setEditMember(member);
    setFormData({
      name: member.name,
      title: member.title || '',
      professional_type: member.professional_type || 'dentist',
      is_primary: member.is_primary || false,
      license_number: member.license_number || '',
      department: member.department || '',
      email: member.email || '',
      phone: member.phone || '',
      bio: member.bio || '',
      years_experience: member.years_experience || 0,
      image_url: member.image_url || '',
    });
  };

  const handleSubmit = () => {
    if (editMember) {
      updateMember.mutate({ id: editMember.id, data: formData });
    } else {
      addMember.mutate(formData);
    }
  };

  const handleCloseDialog = () => {
    setIsAddDialogOpen(false);
    setEditMember(null);
    setFormData(INITIAL_FORM_DATA);
  };

  // Group team by role category
  const dentists = team?.filter(m => 
    ['dentist', 'orthodontist', 'endodontist', 'periodontist', 'prosthodontist', 'oral_surgeon', 'pediatric_dentist'].includes(m.professional_type)
  ) || [];
  
  const support = team?.filter(m => 
    ['hygienist', 'assistant', 'receptionist', 'practice_manager'].includes(m.professional_type)
  ) || [];

  if (clinicLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!clinic) {
    return <NoPracticeLinked compact />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold">Team Management</h2>
          <p className="text-muted-foreground">Manage your clinic's doctors and staff</p>
        </div>
        <Button onClick={() => { setFormData(INITIAL_FORM_DATA); setIsAddDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Team Member
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Stethoscope className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{dentists.length}</p>
              <p className="text-sm text-muted-foreground">Dentists</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-teal-light flex items-center justify-center">
              <UserCheck className="h-6 w-6 text-teal" />
            </div>
            <div>
              <p className="text-2xl font-bold">{support.length}</p>
              <p className="text-sm text-muted-foreground">Support Staff</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gold-light flex items-center justify-center">
              <Star className="h-6 w-6 text-gold" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {team && team.length > 0 
                  ? (team.reduce((sum, m) => sum + (Number(m.rating) || 0), 0) / team.filter(m => m.rating).length || 0).toFixed(1)
                  : '-'
                }
              </p>
              <p className="text-sm text-muted-foreground">Avg Rating</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-purple-light flex items-center justify-center">
              <GraduationCap className="h-6 w-6 text-purple" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {team && team.length > 0 
                  ? Math.round(team.reduce((sum, m) => sum + (m.years_experience || 0), 0) / team.length)
                  : '-'
                }
              </p>
              <p className="text-sm text-muted-foreground">Avg Experience</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dentists & Specialists */}
      {dentists.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            Dentists & Specialists
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {dentists.map((member) => (
              <TeamMemberCard 
                key={member.id} 
                member={member} 
                onEdit={openEditDialog}
                onDelete={(id) => deleteMember.mutate(id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Support Staff */}
      {support.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-teal" />
            Support Staff
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {support.map((member) => (
              <TeamMemberCard 
                key={member.id} 
                member={member} 
                onEdit={openEditDialog}
                onDelete={(id) => deleteMember.mutate(id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {teamLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : team?.length === 0 && (
        <Card className="card-modern">
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Team Members Yet</h3>
            <p className="text-muted-foreground mb-6">
              Add dentists, hygienists, and support staff to your practice
            </p>
            <Button onClick={() => { setFormData(INITIAL_FORM_DATA); setIsAddDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Team Member
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <TeamMemberFormDialog 
        isOpen={isAddDialogOpen || !!editMember} 
        onClose={handleCloseDialog}
        title={editMember ? 'Edit Team Member' : 'Add Team Member'}
        clinicId={clinic?.id}
        formData={formData}
        onFormChange={setFormData}
        onSubmit={handleSubmit}
        isSubmitting={addMember.isPending || updateMember.isPending}
        isEdit={!!editMember}
      />
    </div>
  );
}
