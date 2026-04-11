import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  Lock, 
  Shield, 
  Users, 
  UserCheck,
  Plus,
  Edit,
  Trash2,
  Key,
  Eye,
  EyeOff,
  Settings,
  Building2,
  MapPin,
  FileText,
  Calendar,
  CreditCard,
  Save,
  MessageSquare,
  Bot,
  Zap,
  Star,
  CheckCircle,
  Clock,
  AlertTriangle,
  UserPlus,
} from 'lucide-react';
import { useAdminUsers, useUpdateUserRole } from '@/hooks/useAdminUsers';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { createAuditLog } from '@/lib/audit';
import { 
  useRolePresets, 
  useSaveRolePreset, 
  useDeleteRolePreset,
  usePermissionOverrides,
  useSavePermissionOverride,
  useDeletePermissionOverride,
  ALL_PERMISSIONS,
  getPermissionsByCategory,
} from '@/hooks/usePermissions';

type DistrictAssignment = {
  id: string;
  user_id: string;
  city: string;
  area: string | null;
  created_at: string;
};

// Default role permissions (kept for backwards compatibility)
const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ['*'],
  district_manager: [
    'clinics.view', 'clinics.edit', 'clinics.verify',
    'locations.view',
    'users.view',
    'appointments.view', 'appointments.manage',
    'leads.view', 'leads.manage',
    'messaging.view_logs',
    'reviews.view',
    'support.view',
  ],
  dentist: [
    'clinics.view',
    'appointments.view',
    'messaging.sms', 'messaging.whatsapp', 'messaging.email',
    'reviews.view',
  ],
  seo_team: [
    'pages.view', 'pages.edit',
    'blog.manage',
    'seo.manage',
    'clinics.view',
  ],
  content_team: [
    'pages.view', 'pages.edit',
    'blog.manage',
    'clinics.view',
  ],
  marketing_team: [
    'clinics.view',
    'promotions.manage',
    'messaging.sms', 'messaging.whatsapp', 'messaging.email',
    'messaging.view_logs',
  ],
  support_team: [
    'clinics.view',
    'appointments.view',
    'leads.view',
    'reviews.view',
    'support.view', 'support.manage',
  ],
  patient: [],
};

// All available roles
const ALL_ROLES = [
  { value: 'super_admin', label: 'Super Admin', color: 'purple' },
  { value: 'district_manager', label: 'District Manager', color: 'blue-custom' },
  { value: 'dentist', label: 'Dentist', color: 'primary' },
  { value: 'seo_team', label: 'SEO Team', color: 'teal' },
  { value: 'content_team', label: 'Content Team', color: 'gold' },
  { value: 'marketing_team', label: 'Marketing Team', color: 'coral' },
  { value: 'support_team', label: 'Support Team', color: 'emerald' },
  { value: 'patient', label: 'Patient', color: 'muted' },
] as const;

export default function RolesTab() {
  const queryClient = useQueryClient();
  const { data: users, isLoading: usersLoading } = useAdminUsers();
  const updateRole = useUpdateUserRole();
  
  const [activeTab, setActiveTab] = useState('permissions');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [editingRole, setEditingRole] = useState<string | null>(null);

  // Fetch role permissions from global_settings
  const { data: rolePermissions } = useQuery({
    queryKey: ['role-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_settings')
        .select('*')
        .eq('key', 'role_permissions')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return (data?.value as Record<string, string[]>) || DEFAULT_ROLE_PERMISSIONS;
    },
  });

  // Fetch district assignments
  const { data: assignments } = useQuery({
    queryKey: ['district-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('district_assignments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as DistrictAssignment[];
    },
  });

  // Save role permissions
  const saveRolePermissions = useMutation({
    mutationFn: async (newPermissions: Record<string, string[]>) => {
      const existing = await supabase
        .from('global_settings')
        .select('id')
        .eq('key', 'role_permissions')
        .single();

      if (existing.data) {
        const { error } = await supabase
          .from('global_settings')
          .update({ value: newPermissions as any, updated_at: new Date().toISOString() })
          .eq('id', existing.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('global_settings')
          .insert([{ key: 'role_permissions', value: newPermissions as any }]);
        if (error) throw error;
      }

      await createAuditLog({
        action: 'UPDATE_ROLE_PERMISSIONS',
        entityType: 'role_permissions',
        newValues: newPermissions,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
      toast.success('Permissions updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Toggle permission for a role
  const togglePermission = (role: string, permissionId: string) => {
    const currentPermissions = rolePermissions || DEFAULT_ROLE_PERMISSIONS;
    const rolePerms = currentPermissions[role] || [];
    
    let newRolePerms: string[];
    if (rolePerms.includes(permissionId)) {
      newRolePerms = rolePerms.filter(p => p !== permissionId);
    } else {
      newRolePerms = [...rolePerms, permissionId];
    }
    
    saveRolePermissions.mutate({
      ...currentPermissions,
      [role]: newRolePerms,
    });
  };

  // Check if role has permission
  const hasPermission = (role: string, permissionId: string) => {
    const perms = rolePermissions || DEFAULT_ROLE_PERMISSIONS;
    if (perms[role]?.includes('*')) return true;
    return perms[role]?.includes(permissionId) || false;
  };

  // Create district assignment
  const createAssignment = useMutation({
    mutationFn: async (data: { user_id: string; city: string; area?: string }) => {
      const { error } = await supabase.from('district_assignments').insert({
        user_id: data.user_id,
        city: data.city,
        area: data.area || null,
      });
      if (error) throw error;
      await createAuditLog({
        action: 'CREATE_DISTRICT_ASSIGNMENT',
        entityType: 'district_assignment',
        newValues: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['district-assignments'] });
      setAssignDialogOpen(false);
      resetAssignForm();
      toast.success('District assigned successfully');
    },
    onError: (error: any) => toast.error('Error: ' + error.message),
  });

  // Delete assignment
  const deleteAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('district_assignments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['district-assignments'] });
      toast.success('Assignment removed');
    },
  });

  const resetAssignForm = () => {
    setSelectedUserId('');
    setSelectedCity('');
    setSelectedArea('');
  };

  const handleAssign = () => {
    if (selectedUserId && selectedCity) {
      createAssignment.mutate({
        user_id: selectedUserId,
        city: selectedCity,
        area: selectedArea || undefined,
      });
    }
  };

  // Get users by role
  const adminUsers = users?.filter(u => u.roles?.includes('super_admin') || u.roles?.includes('district_manager')) || [];
  const districtManagers = users?.filter(u => u.roles?.includes('district_manager')) || [];

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin': return <Badge className="bg-purple text-purple-foreground">Super Admin</Badge>;
      case 'district_manager': return <Badge className="bg-blue-custom text-blue-custom-foreground">District Manager</Badge>;
      case 'dentist': return <Badge className="bg-primary text-primary-foreground">Dentist</Badge>;
      default: return <Badge variant="secondary">Patient</Badge>;
    }
  };

  // Group permissions by category
  const permissionsByCategory = ALL_PERMISSIONS.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, typeof ALL_PERMISSIONS>);

  if (usersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Access Control & Permissions</h1>
          <p className="text-muted-foreground mt-1">Manage roles, permissions, and access levels</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-purple-light flex items-center justify-center">
              <Shield className="h-6 w-6 text-purple" />
            </div>
            <div>
              <p className="text-2xl font-bold">{users?.filter(u => u.roles?.includes('super_admin')).length || 0}</p>
              <p className="text-sm text-muted-foreground">Super Admins</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-light flex items-center justify-center">
              <UserCheck className="h-6 w-6 text-blue-custom" />
            </div>
            <div>
              <p className="text-2xl font-bold">{districtManagers.length}</p>
              <p className="text-sm text-muted-foreground">District Managers</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-teal-light flex items-center justify-center">
              <MapPin className="h-6 w-6 text-teal" />
            </div>
            <div>
              <p className="text-2xl font-bold">{assignments?.length || 0}</p>
              <p className="text-sm text-muted-foreground">District Assignments</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Key className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{ALL_PERMISSIONS.length}</p>
              <p className="text-sm text-muted-foreground">Total Permissions</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 rounded-xl">
          <TabsTrigger value="permissions" className="rounded-xl">Matrix</TabsTrigger>
          <TabsTrigger value="presets" className="rounded-xl">Role Presets</TabsTrigger>
          <TabsTrigger value="overrides" className="rounded-xl">User Overrides</TabsTrigger>
          <TabsTrigger value="admins" className="rounded-xl">Admin Users</TabsTrigger>
          <TabsTrigger value="districts" className="rounded-xl">Districts</TabsTrigger>
        </TabsList>

        {/* Permission Matrix - Granular toggles for each role */}
        <TabsContent value="permissions" className="mt-4">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Permission Matrix
              </CardTitle>
              <CardDescription>
                Toggle permissions on/off for each role. Super Admin always has full access.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-6">
                  {Object.entries(permissionsByCategory).map(([category, permissions]) => {
                    return (
                    <div key={category} className="space-y-3">
                      <h3 className="font-semibold text-lg flex items-center gap-2 sticky top-0 bg-card py-2">
                        <Key className="h-5 w-5 text-primary" />
                        {category}
                      </h3>
                      <div className="rounded-xl border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[180px]">Permission</TableHead>
                              <TableHead className="text-center w-[80px]">Admin</TableHead>
                              <TableHead className="text-center w-[80px]">Dist Mgr</TableHead>
                              <TableHead className="text-center w-[80px]">Dentist</TableHead>
                              <TableHead className="text-center w-[80px]">SEO</TableHead>
                              <TableHead className="text-center w-[80px]">Content</TableHead>
                              <TableHead className="text-center w-[80px]">Marketing</TableHead>
                              <TableHead className="text-center w-[80px]">Support</TableHead>
                              <TableHead className="text-center w-[80px]">Patient</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {permissions.map((perm) => (
                              <TableRow key={perm.id}>
                                <TableCell className="font-medium text-sm">{perm.label}</TableCell>
                                <TableCell className="text-center">
                                  <div className="flex justify-center">
                                    <CheckCircle className="h-4 w-4 text-teal" />
                                  </div>
                                </TableCell>
                                {['district_manager', 'dentist', 'seo_team', 'content_team', 'marketing_team', 'support_team', 'patient'].map((role) => (
                                  <TableCell key={role} className="text-center">
                                    <div className="flex justify-center">
                                      <Switch
                                        checked={hasPermission(role, perm.id)}
                                        onCheckedChange={() => togglePermission(role, perm.id)}
                                        disabled={saveRolePermissions.isPending}
                                        className="scale-75"
                                      />
                                    </div>
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Role Presets Tab */}
        <TabsContent value="presets" className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            {['super_admin', 'district_manager', 'dentist', 'patient'].map((role) => {
              const rolePerms = rolePermissions?.[role] || DEFAULT_ROLE_PERMISSIONS[role] || [];
              const hasAllPerms = rolePerms.includes('*');
              const activeCount = hasAllPerms ? ALL_PERMISSIONS.length : rolePerms.length;
              
              return (
                <Card key={role} className="card-modern">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg capitalize flex items-center gap-2">
                        {role === 'super_admin' && <Shield className="h-5 w-5 text-purple" />}
                        {role === 'district_manager' && <UserCheck className="h-5 w-5 text-blue-custom" />}
                        {role === 'dentist' && <Building2 className="h-5 w-5 text-teal" />}
                        {role === 'patient' && <Users className="h-5 w-5 text-muted-foreground" />}
                        {role.replace('_', ' ')}
                      </CardTitle>
                      {getRoleBadge(role)}
                    </div>
                    <CardDescription className="text-xs">
                      {role === 'super_admin' && 'Full platform control'}
                      {role === 'district_manager' && 'Regional operations'}
                      {role === 'dentist' && 'Practice management'}
                      {role === 'patient' && 'Public access only'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Active Permissions</span>
                        <Badge variant="outline">{activeCount} / {ALL_PERMISSIONS.length}</Badge>
                      </div>
                      {role === 'super_admin' ? (
                        <div className="flex items-center gap-2 text-sm text-teal p-3 bg-teal-light rounded-lg">
                          <Eye className="h-4 w-4" />
                          Full access to all features
                        </div>
                      ) : role === 'patient' ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                          <EyeOff className="h-4 w-4" />
                          No admin dashboard access
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {Object.entries(permissionsByCategory).map(([category, perms]) => {
                            const activeInCategory = perms.filter(p => hasPermission(role, p.id));
                            if (activeInCategory.length === 0) return null;
                            return (
                              <div key={category} className="text-sm">
                                <span className="text-muted-foreground font-medium">{category}:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {activeInCategory.map(p => (
                                    <Badge key={p.id} variant="outline" className="text-xs">
                                      {p.label}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {role !== 'super_admin' && role !== 'patient' && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full mt-2"
                          onClick={() => setActiveTab('permissions')}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Edit Permissions
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* User Permission Overrides Tab */}
        <TabsContent value="overrides" className="mt-4">
          <Card className="card-modern">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    User Permission Overrides
                  </CardTitle>
                  <CardDescription>
                    Grant or revoke specific permissions for individual users, with optional expiration
                  </CardDescription>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Override
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Permission Override</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Select User</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a user" />
                          </SelectTrigger>
                          <SelectContent>
                            {users?.map(u => (
                              <SelectItem key={u.user_id} value={u.user_id}>
                                {u.full_name || u.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Permission</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a permission" />
                          </SelectTrigger>
                          <SelectContent>
                            {ALL_PERMISSIONS.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.category}: {p.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Grant Access</Label>
                        <Switch defaultChecked />
                      </div>
                      <div className="space-y-2">
                        <Label>Expires (Optional)</Label>
                        <Input type="datetime-local" />
                      </div>
                      <div className="space-y-2">
                        <Label>Reason (Optional)</Label>
                        <Input placeholder="e.g., Temporary access for project" />
                      </div>
                      <Button className="w-full">Save Override</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No active permission overrides</p>
                <p className="text-sm mt-1">
                  Use overrides to grant temporary or special permissions to individual users
                </p>
                <div className="flex items-center justify-center gap-2 mt-4 text-xs">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-teal" />
                    <span>Time-bound access</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-gold" />
                    <span>Auto-expires</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Shield className="h-3 w-3 text-purple" />
                    <span>Audit logged</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admins" className="mt-4">
          <Card className="card-modern">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-bold text-primary">
                              {user.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{user.full_name || 'No name'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Select
                          value={user.roles?.[0] || 'patient'}
                          onValueChange={(value) => updateRole.mutate({ userId: user.user_id, role: value })}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                            <SelectItem value="district_manager">District Manager</SelectItem>
                            <SelectItem value="dentist">Dentist</SelectItem>
                            <SelectItem value="patient">Patient</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {adminUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No admin users found</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="districts" className="mt-4">
          <Card className="card-modern">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">District Assignments</CardTitle>
              <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Assign District
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Assign District to Manager</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>District Manager</Label>
                      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a user" />
                        </SelectTrigger>
                        <SelectContent>
                          {districtManagers.map(u => (
                            <SelectItem key={u.user_id} value={u.user_id}>
                              {u.full_name || u.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input 
                        value={selectedCity} 
                        onChange={(e) => setSelectedCity(e.target.value)} 
                        placeholder="e.g., Los Angeles"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>State (Optional)</Label>
                      <Input 
                        value={selectedArea} 
                        onChange={(e) => setSelectedArea(e.target.value)} 
                        placeholder="e.g., California"
                      />
                    </div>
                    <Button onClick={handleAssign} className="w-full" disabled={!selectedUserId || !selectedCity}>
                      Assign District
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Manager</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments?.map((assignment) => {
                    const manager = users?.find(u => u.user_id === assignment.user_id);
                    return (
                      <TableRow key={assignment.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-blue-light flex items-center justify-center">
                              <span className="text-sm font-bold text-blue-custom">
                                {manager?.full_name?.[0]?.toUpperCase() || 'M'}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">{manager?.full_name || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{manager?.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{assignment.city}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {assignment.area || 'All areas'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(assignment.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteAssignment.mutate(assignment.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!assignments || assignments.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No district assignments</p>
                        <p className="text-xs mt-1">Assign districts to limit manager access to specific locations</p>
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