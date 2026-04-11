import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, UserPlus } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
  role: string;
  status: 'active' | 'pending' | 'completed';
}

interface TeamMemberListProps {
  title: string;
  members: TeamMember[];
  onAddMember?: () => void;
  className?: string;
}

export default function TeamMemberList({ title, members, onAddMember, className }: TeamMemberListProps) {
  const statusConfig = {
    active: { label: 'In Progress', className: 'bg-blue-custom/10 text-blue-custom border-0' },
    pending: { label: 'Pending', className: 'bg-gold/10 text-gold border-0' },
    completed: { label: 'Completed', className: 'bg-teal/10 text-teal border-0' },
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const avatarColors = [
    'bg-primary text-white',
    'bg-teal text-white',
    'bg-gold text-white',
    'bg-purple text-white',
    'bg-coral text-white',
    'bg-emerald text-white',
  ];

  return (
    <div className={cn('bg-card rounded-2xl border border-border/50 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
        <h3 className="font-bold text-foreground">{title}</h3>
        {onAddMember && (
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-full text-xs"
            onClick={onAddMember}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Member
          </Button>
        )}
      </div>

      {/* Members */}
      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-3">
            <UserPlus className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No team members yet</p>
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {members.map((member, index) => (
            <div key={member.id} className="flex items-center gap-4 px-5 py-3.5">
              {member.avatar ? (
                <img 
                  src={member.avatar} 
                  alt={member.name}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className={cn(
                  'h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold',
                  avatarColors[index % avatarColors.length]
                )}>
                  {getInitials(member.name)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm">{member.name}</p>
                <p className="text-xs text-muted-foreground truncate">{member.role}</p>
              </div>
              <Badge className={statusConfig[member.status].className}>
                {statusConfig[member.status].label}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
