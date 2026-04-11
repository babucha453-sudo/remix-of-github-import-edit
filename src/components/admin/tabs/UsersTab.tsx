import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminUsers, useUpdateUserRole, useUpdateUserStatus, AdminUser } from '@/hooks/useAdminUsers';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Search, Mail, Shield, UserCheck, Filter, Calendar, MoreHorizontal, Eye, Plus, Loader2, Check, X, Globe, UserX, Trash2, Power, Building2, Settings2, FileEdit, Megaphone, HeadphonesIcon, KeyRound, ExternalLink } from 'lucide-react';
import { AssignClinicModal } from '@/components/admin/AssignClinicModal';
import TabPermissionsDialog from '@/components/admin/TabPermissionsDialog';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Team roles configuration
const TEAM_ROLES = [
  { value: 'super_admin', label: 'Super Admin', color: 'purple', icon: Shield },
  { value: 'district_manager', label: 'District Manager', color: 'blue-custom', icon: UserCheck },
  { value: 'dentist', label: 'Dentist', color: 'primary', icon: Users },
  { value: 'seo_team', label: 'SEO Team', color: 'teal', icon: Search },
  { value: 'content_team', label: 'Content Team', color: 'gold', icon: FileEdit },
  { value: 'marketing_team', label: 'Marketing Team', color: 'coral', icon: Megaphone },
  { value: 'support_team', label: 'Support Team', color: 'emerald', icon: HeadphonesIcon },
  { value: 'patient', label: 'Patient', color: 'muted', icon: Users },
] as const;

export default function UsersTab() {
  const { data: users, isLoading, error } = useAdminUsers();
  const updateRole = useUpdateUserRole();
  const updateStatus = useUpdateUserStatus();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Create user dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'dentist' as string,
    clinicId: '',
  });
  
  // Delete confirmation
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  
  // Assign clinic modal
  const [assignClinicUser, setAssignClinicUser] = useState<AdminUser | null>(null);
  
  // Tab permissions dialog
  const [tabPermissionsUser, setTabPermissionsUser] = useState<AdminUser | null>(null);
  
  // Password reset state
  const [isSendingReset, setIsSendingReset] = useState<string | null>(null);
  
  // Send password reset handler
  const handleSendPasswordReset = async (user: AdminUser) => {
    if (!user.email) {
      toast({ title: "No email", description: "This user has no email address", variant: "destructive" });
      return;
    }
    
    setIsSendingReset(user.user_id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      
      const { data, error } = await supabase.functions.invoke('admin-send-password-reset', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { email: user.email },
      });
      
      // Check for error in response data (edge function returns JSON with error field)
      if (error) {
        const errorMessage = typeof error === 'object' && error.message 
          ? error.message 
          : 'Could not send password reset';
        throw new Error(errorMessage);
      }
      
      if (data?.error) {
        throw new Error(data.error);
      }
      
      toast({ title: "Password Reset Sent", description: `Email sent to ${user.email}` });
    } catch (error: any) {
      console.error('Password reset error:', error);
      const message = error.message || "Could not send password reset";
      const isRateLimit = message.includes('wait') || message.includes('60 seconds');
      toast({ 
        title: isRateLimit ? "Please Wait" : "Failed", 
        description: message, 
        variant: "destructive" 
      });
    } finally {
      setIsSendingReset(null);
    }
  };

  // Filter logic
  const filteredUsers = users?.filter(u => {
    // Search filter
    const matchesSearch = 
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.phone?.toLowerCase().includes(search.toLowerCase());
    
    // Role filter
    const userRole = u.roles?.[0] || 'patient';
    const matchesRole = roleFilter === 'all' || userRole === roleFilter;
    
    // Source filter
    const matchesSource = sourceFilter === 'all' || u.signup_method === sourceFilter;
    
    // Status filter
    const matchesStatus = statusFilter === 'all' || u.account_status === statusFilter;
    
    // Date filter
    let matchesDate = true;
    if (dateFilter !== 'all' && u.created_at) {
      const createdDate = new Date(u.created_at);
      const now = new Date();
      switch (dateFilter) {
        case 'today':
          matchesDate = createdDate.toDateString() === now.toDateString();
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = createdDate >= weekAgo;
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          matchesDate = createdDate >= monthAgo;
          break;
        case 'quarter':
          const quarterAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          matchesDate = createdDate >= quarterAgo;
          break;
      }
    }
    
    return matchesSearch && matchesRole && matchesSource && matchesStatus && matchesDate;
  }) || [];

  const handleRoleChange = async (userId: string, currentRoles: string[], newRole: string) => {
    const primaryRole = currentRoles?.[0] || 'patient';
    if (primaryRole !== newRole) {
      await updateRole.mutateAsync({ userId, role: newRole });
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.fullName) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: newUser.email,
          password: newUser.password,
          fullName: newUser.fullName,
          role: newUser.role,
          clinicId: newUser.clinicId || undefined,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "User Created",
          description: `Successfully created ${newUser.role} account for ${newUser.email}`,
        });
        setCreateDialogOpen(false);
        setNewUser({ email: '', password: '', fullName: '', role: 'dentist', clinicId: '' });
        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      } else {
        throw new Error(data.error || "Failed to create user");
      }
    } catch (error: any) {
      console.error('Create user error:', error);
      toast({
        title: "Failed to Create User",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const getRoleBadge = (roles: string[] | undefined) => {
    const role = roles?.[0] || 'patient';
    const roleConfig = TEAM_ROLES.find(r => r.value === role) || TEAM_ROLES.find(r => r.value === 'patient')!;
    const Icon = roleConfig.icon;
    const colorMap: Record<string, string> = {
      'purple': 'bg-purple-100 text-purple-700',
      'blue-custom': 'bg-blue-100 text-blue-700',
      'primary': 'bg-primary/10 text-primary',
      'teal': 'bg-teal-100 text-teal-700',
      'gold': 'bg-amber-100 text-amber-700',
      'coral': 'bg-red-100 text-red-700',
      'emerald': 'bg-emerald-100 text-emerald-700',
      'muted': 'bg-muted text-muted-foreground',
    };
    return (
      <Badge className={`${colorMap[roleConfig.color] || colorMap.muted} border-0 gap-1`}>
        <Icon className="h-3 w-3" />
        {roleConfig.label}
      </Badge>
    );
  };

  const getSignupMethodBadge = (method: AdminUser['signup_method']) => {
    switch (method) {
      case 'google': return <Badge variant="outline" className="text-xs gap-1"><Globe className="h-3 w-3" />Google</Badge>;
      case 'gmb': return <Badge className="bg-teal/20 text-teal border-0 text-xs gap-1"><Globe className="h-3 w-3" />GMB</Badge>;
      case 'admin_created': return <Badge variant="outline" className="text-xs gap-1"><Shield className="h-3 w-3" />Admin</Badge>;
      case 'manual': return <Badge variant="secondary" className="text-xs">Manual</Badge>;
      default: return <Badge variant="secondary" className="text-xs">Unknown</Badge>;
    }
  };

  const getStatusBadge = (status: AdminUser['account_status']) => {
    switch (status) {
      case 'active': return <Badge className="bg-teal/20 text-teal border-0 text-xs gap-1"><Check className="h-3 w-3" />Active</Badge>;
      case 'pending': return <Badge className="bg-amber/20 text-amber border-0 text-xs gap-1">Pending</Badge>;
      case 'suspended': return <Badge className="bg-coral/20 text-coral border-0 text-xs gap-1"><X className="h-3 w-3" />Suspended</Badge>;
    }
  };

  const roleBreakdown = {
    super_admin: users?.filter(u => u.roles?.includes('super_admin')).length || 0,
    district_manager: users?.filter(u => u.roles?.includes('district_manager')).length || 0,
    dentist: users?.filter(u => u.roles?.includes('dentist')).length || 0,
    team: users?.filter(u => 
      u.roles?.some(r => ['seo_team', 'content_team', 'marketing_team', 'support_team'].includes(r))
    ).length || 0,
    patient: users?.filter(u => !u.roles?.length || u.roles?.includes('patient')).length || 0,
  };

  const handleUserAction = async (userId: string, action: 'activate' | 'suspend' | 'delete') => {
    try {
      await updateStatus.mutateAsync({ userId, action });
      if (action === 'delete') {
        setDeleteUserId(null);
      }
    } catch (err) {
      console.error('User action failed:', err);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setRoleFilter('all');
    setDateFilter('all');
    setSourceFilter('all');
    setStatusFilter('all');
  };

  const hasActiveFilters = search || roleFilter !== 'all' || dateFilter !== 'all' || sourceFilter !== 'all' || statusFilter !== 'all';

  if (isLoading) {
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
          <h1 className="text-3xl font-display font-bold text-foreground">Users & Patients</h1>
          <p className="text-muted-foreground mt-1">Manage platform users and their roles</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl font-bold">
                <Plus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    placeholder="Dr. John Smith"
                    value={newUser.fullName}
                    onChange={(e) => setNewUser(prev => ({ ...prev, fullName: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={newUser.email}
                    onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Min 6 characters"
                    value={newUser.password}
                    onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role *</Label>
                  <Select 
                    value={newUser.role} 
                    onValueChange={(value) => setNewUser(prev => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAM_ROLES.filter(r => r.value !== 'patient').map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          <span className="flex items-center gap-2">
                            <role.icon className="h-4 w-4" />
                            {role.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {newUser.role === 'dentist' && (
                  <div>
                    <Label htmlFor="clinicId">Clinic ID (Optional)</Label>
                    <Input
                      id="clinicId"
                      placeholder="UUID of clinic to link"
                      value={newUser.clinicId}
                      onChange={(e) => setNewUser(prev => ({ ...prev, clinicId: e.target.value }))}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Link this dentist to a specific clinic
                    </p>
                  </div>
                )}
                <Button 
                  onClick={handleCreateUser} 
                  className="w-full rounded-xl font-bold"
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create User"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Badge variant="outline" className="text-sm py-1 px-3">
            {filteredUsers.length} of {users?.length || 0} users
          </Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="card-modern cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setRoleFilter('all')}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{users?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Total Users</p>
            </div>
          </CardContent>
        </Card>
        <Card className={`card-modern cursor-pointer transition-colors ${roleFilter === 'super_admin' ? 'border-purple' : 'hover:border-purple/50'}`} onClick={() => setRoleFilter('super_admin')}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-purple-light flex items-center justify-center">
              <Shield className="h-6 w-6 text-purple" />
            </div>
            <div>
              <p className="text-2xl font-bold">{roleBreakdown.super_admin}</p>
              <p className="text-sm text-muted-foreground">Super Admins</p>
            </div>
          </CardContent>
        </Card>
        <Card className={`card-modern cursor-pointer transition-colors ${roleFilter === 'district_manager' ? 'border-blue-custom' : 'hover:border-blue-custom/50'}`} onClick={() => setRoleFilter('district_manager')}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-light flex items-center justify-center">
              <UserCheck className="h-6 w-6 text-blue-custom" />
            </div>
            <div>
              <p className="text-2xl font-bold">{roleBreakdown.district_manager}</p>
              <p className="text-sm text-muted-foreground">District Mgrs</p>
            </div>
          </CardContent>
        </Card>
        <Card className={`card-modern cursor-pointer transition-colors ${roleFilter === 'dentist' ? 'border-teal' : 'hover:border-teal/50'}`} onClick={() => setRoleFilter('dentist')}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-teal-light flex items-center justify-center">
              <Users className="h-6 w-6 text-teal" />
            </div>
            <div>
              <p className="text-2xl font-bold">{roleBreakdown.dentist}</p>
              <p className="text-sm text-muted-foreground">Dentists</p>
            </div>
          </CardContent>
        </Card>
        <Card className={`card-modern cursor-pointer transition-colors hover:border-gold/50`} onClick={() => setRoleFilter('all')}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gold/10 flex items-center justify-center">
              <FileEdit className="h-6 w-6 text-gold" />
            </div>
            <div>
              <p className="text-2xl font-bold">{roleBreakdown.team}</p>
              <p className="text-sm text-muted-foreground">Team Members</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="card-modern">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-64 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {TEAM_ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-40">
                <Globe className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="gmb">GMB</SelectItem>
                <SelectItem value="admin_created">Admin Created</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <Power className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-48">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
                <SelectItem value="quarter">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="card-modern">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>GMB</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                          {user.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{user.full_name || 'No name'}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {user.email || 'No email'}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getRoleBadge(user.roles)}</TableCell>
                  <TableCell>{getSignupMethodBadge(user.signup_method)}</TableCell>
                  <TableCell>{getStatusBadge(user.account_status)}</TableCell>
                  <TableCell>
                    {user.gmb_connected ? (
                      <Badge className="bg-teal/20 text-teal border-0 text-xs gap-1">
                        <Check className="h-3 w-3" />Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Not Connected
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {user.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem 
                          className="gap-2"
                          onClick={() => {
                            if (user.clinic_slug) {
                              window.open(`/clinic/${user.clinic_slug}`, '_blank');
                            } else {
                              toast({ 
                                title: "No Profile Available", 
                                description: "This user doesn't have a claimed clinic profile yet.",
                                variant: "destructive" 
                              });
                            }
                          }}
                        >
                          <Eye className="h-4 w-4" /> View Profile
                          {user.clinic_slug && <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="gap-2"
                          onClick={() => setAssignClinicUser(user)}
                        >
                          <Building2 className="h-4 w-4" /> Assign Clinic
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="gap-2"
                          onClick={() => setTabPermissionsUser(user)}
                        >
                          <Settings2 className="h-4 w-4" /> Tab Permissions
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="gap-2"
                          onClick={() => handleSendPasswordReset(user)}
                          disabled={isSendingReset === user.user_id}
                        >
                          {isSendingReset === user.user_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <KeyRound className="h-4 w-4" />
                          )}
                          Send Password Reset
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="gap-2">
                            <Shield className="h-4 w-4" /> Change Role
                          </DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                              {TEAM_ROLES.map((role) => (
                                <DropdownMenuItem
                                  key={role.value}
                                  className="gap-2"
                                  onClick={() => handleRoleChange(user.user_id, user.roles || [], role.value)}
                                >
                                  <role.icon className="h-4 w-4" />
                                  {role.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                        {user.account_status === 'suspended' ? (
                          <DropdownMenuItem 
                            className="gap-2 text-teal"
                            onClick={() => handleUserAction(user.user_id, 'activate')}
                          >
                            <Power className="h-4 w-4" /> Activate User
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem 
                            className="gap-2 text-amber"
                            onClick={() => handleUserAction(user.user_id, 'suspend')}
                          >
                            <UserX className="h-4 w-4" /> Suspend User
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          className="gap-2 text-coral"
                          onClick={() => setDeleteUserId(user.user_id)}
                        >
                          <Trash2 className="h-4 w-4" /> Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No users found</p>
                    {hasActiveFilters && (
                      <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
                        Clear filters to see all users
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user account
              and remove their data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-coral hover:bg-coral/90"
              onClick={() => deleteUserId && handleUserAction(deleteUserId, 'delete')}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Clinic Modal */}
      {assignClinicUser && (
        <AssignClinicModal
          open={!!assignClinicUser}
          onOpenChange={(open) => !open && setAssignClinicUser(null)}
          userId={assignClinicUser.user_id}
          userName={assignClinicUser.full_name || ''}
          userEmail={assignClinicUser.email || ''}
        />
      )}

      {/* Tab Permissions Dialog */}
      {tabPermissionsUser && (
        <TabPermissionsDialog
          open={!!tabPermissionsUser}
          onOpenChange={(open) => !open && setTabPermissionsUser(null)}
          userId={tabPermissionsUser.user_id}
          userName={tabPermissionsUser.full_name || tabPermissionsUser.email || 'User'}
          userRole={tabPermissionsUser.roles?.[0] || 'patient'}
        />
      )}
    </div>
  );
}