import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import {
  Users,
  Plus,
  Trash2,
  Upload,
  Loader2,
  GripVertical,
  Edit,
  UserCog,
  Shield,
  Sparkles,
  Image,
  PlusCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NoPracticeLinked } from './NoPracticeLinked';

const PREDEFINED_ROLES = [
  'Dentist',
  'Orthodontist',
  'Periodontist',
  'Endodontist',
  'Oral Surgeon',
  'Pediatric Dentist',
  'Prosthodontist',
  'Hygienist',
  'Dental Assistant',
  'Receptionist',
  'Office Manager',
  'Dental Technician',
  'Other',
];

interface TeamMember {
  id: string;
  clinic_id: string;
  name: string;
  role: string | null;
  bio: string | null;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export default function TeamManagementTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [bio, setBio] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

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

  const { data: teamMembers, isLoading: teamLoading } = useQuery({
    queryKey: ['clinic-team', clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_team')
        .select('*')
        .eq('clinic_id', clinic?.id)
        .order('display_order')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as TeamMember[];
    },
    enabled: !!clinic?.id,
  });

  const addMember = useMutation({
    mutationFn: async () => {
      if (!clinic?.id || !name) {
        throw new Error('Name is required');
      }
      const { error } = await supabase.from('clinic_team').insert({
        clinic_id: clinic.id,
        name,
        role: role || null,
        bio: bio || null,
        image_url: imageUrl || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-team'] });
      setIsAddingMember(false);
      resetForm();
      toast.success('Team member added');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add team member');
    },
  });

  const updateMember = useMutation({
    mutationFn: async () => {
      if (!editingMember?.id) return;
      const { error } = await supabase
        .from('clinic_team')
        .update({
          name,
          role: role || null,
          bio: bio || null,
          image_url: imageUrl || null,
        })
        .eq('id', editingMember.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-team'] });
      setEditingMember(null);
      resetForm();
      toast.success('Team member updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update');
    },
  });

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('clinic_team')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-team'] });
      toast.success('Team member removed');
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('clinic_team')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-team'] });
      toast.success('Status updated');
    },
  });

  const sendInvite = useMutation({
    mutationFn: async () => {
      if (!clinic?.id || !user?.id || !inviteEmail) {
        throw new Error('Email and clinic are required');
      }
      const { error } = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-team-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteName || inviteEmail.split('@')[0],
          clinicId: clinic.id,
          role: inviteRole || null,
          invitedBy: user.id,
          clinicName: clinic.name,
        }),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-team'] });
      setIsInviteModalOpen(false);
      setInviteEmail('');
      setInviteName('');
      setInviteRole('');
      toast.success(`Invitation sent to ${inviteEmail}`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send invitation');
    },
  });

  const resetForm = () => {
    setName('');
    setRole('');
    setBio('');
    setImageUrl('');
  };

  const openEdit = (member: TeamMember) => {
    setEditingMember(member);
    setName(member.name);
    setRole(member.role || '');
    setBio(member.bio || '');
    setImageUrl(member.image_url || '');
    setIsAddingMember(true);
  };

  if (clinicLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!clinic) {
    return <NoPracticeLinked compact />;
  }

  const activeMembers = teamMembers?.filter(m => m.is_active) || [];
  const inactiveMembers = teamMembers?.filter(m => !m.is_active) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-teal flex items-center justify-center shadow-lg">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Team Members</h2>
            <p className="text-sm text-muted-foreground">
              {activeMembers.length} active team members
            </p>
          </div>
        </div>
        <Button onClick={() => { resetForm(); setEditingMember(null); setIsAddingMember(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Member
        </Button>
        <Button variant="outline" onClick={() => setIsInviteModalOpen(true)}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Invite via Email
        </Button>
      </div>

      {/* Team Grid */}
      {teamLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : teamMembers?.length === 0 ? (
        <Card className="border-2 border-dashed border-primary/20">
          <CardContent className="py-12 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">No Team Members Yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Add your team to showcase on your profile
            </p>
            <Button onClick={() => setIsAddingMember(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Member
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamMembers?.map((member) => (
            <Card key={member.id} className={cn(!member.is_active && 'opacity-60')}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-14 w-14 rounded-full">
                    <AvatarImage src={member.image_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <UserCog className="h-6 w-6" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold truncate">{member.name}</h3>
                      <Badge variant={member.is_active ? 'default' : 'secondary'}>
                        {member.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {member.role && (
                      <p className="text-sm text-primary truncate">{member.role}</p>
                    )}
                    {member.bio && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {member.bio}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(member)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={member.is_active ? 'text-amber-500' : 'text-teal'}
                        onClick={() => toggleActive.mutate({ 
                          id: member.id, 
                          isActive: !member.is_active 
                        })}
                      >
                        {member.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => deleteMember.mutate(member.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Member Dialog */}
      <Dialog open={isAddingMember} onOpenChange={setIsAddingMember}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {editingMember ? 'Edit Team Member' : 'Add Team Member'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="Enter name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="">Select role</option>
                {PREDEFINED_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea
                placeholder="Brief biography..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Photo</Label>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Input
                    placeholder="Enter photo URL"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  id="team-photo-upload"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setIsUploading(true);
                    try {
                      const fileName = `team/${Date.now()}-${file.name}`;
                      const { data, error } = await supabase.storage
                        .from('clinic-images')
                        .upload(fileName, file);
                      if (error) throw error;
                      const { data: urlData } = supabase.storage
                        .from('clinic-images')
                        .getPublicUrl(fileName);
                      setImageUrl(urlData.publicUrl);
                      toast.success('Photo uploaded');
                    } catch (err: any) {
                      toast.error('Upload failed: ' + err.message);
                    } finally {
                      setIsUploading(false);
                    }
                  }}
                />
                <label htmlFor="team-photo-upload">
                  <Button variant="outline" size="sm" type="button" asChild>
                    <span className="cursor-pointer">
                      {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Image className="h-4 w-4 mr-2" />}
                      Upload
                    </span>
                  </Button>
                </label>
              </div>
              {imageUrl && (
                <div className="mt-2 p-2 bg-muted/50 rounded-lg flex items-center gap-3">
                  <Avatar className="h-12 w-12 rounded-full">
                    <AvatarImage src={imageUrl} />
                    <AvatarFallback>
                      <UserCog className="h-6 w-6" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground flex-1">Preview</span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingMember(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => editingMember ? updateMember.mutate() : addMember.mutate()}
              disabled={addMember.isPending || !name}
            >
              {addMember.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {editingMember ? 'Update' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite via Email Modal */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address *</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-name">Name (optional)</Label>
              <Input
                id="invite-name"
                placeholder="Dr. Jane Smith"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role (optional)</Label>
              <select
                id="invite-role"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <option value="">Select a role</option>
                {PREDEFINED_ROLES.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              They'll receive an email with a link to join your team. If they don't have an account, they'll be prompted to create one.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => sendInvite.mutate()}
              disabled={!inviteEmail || sendInvite.isPending}
            >
              {sendInvite.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <PlusCircle className="h-4 w-4 mr-2" />
              )}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}