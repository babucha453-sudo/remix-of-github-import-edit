import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, Users } from 'lucide-react';

export default function TeamInvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'expired' | 'already_member' | 'success'>(
    'loading'
  );
  const [inviteData, setInviteData] = useState<any>(null);
  const [clinic, setClinic] = useState<any>(null);

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }
    validateInvite();
  }, [token]);

  const validateInvite = async () => {
    try {
      const { data: invite, error } = await supabase
        .from('clinic_team_invites')
        .select('*, clinics(name, slug)')
        .eq('invite_token', token)
        .single();

      if (error || !invite) {
        setStatus('invalid');
        return;
      }

      if (invite.status === 'accepted' || invite.status === 'expired') {
        setStatus('expired');
        return;
      }

      const expiresAt = new Date(invite.expires_at);
      if (expiresAt < new Date()) {
        setStatus('expired');
        return;
      }

      if (user && invite.email.toLowerCase() === user.email?.toLowerCase()) {
        const { data: existingMember } = await supabase
          .from('clinic_team')
          .select('id')
          .eq('clinic_id', invite.clinic_id)
          .eq('email', user.email?.toLowerCase())
          .single();

        if (existingMember) {
          setStatus('already_member');
          return;
        }
      }

      setInviteData(invite);
      setClinic(invite.clinics);
      setStatus('valid');
    } catch (err) {
      console.error('Error validating invite:', err);
      setStatus('invalid');
    }
  };

  const acceptInvite = async () => {
    if (!user || !inviteData) return;

    try {
      const { error } = await supabase.from('clinic_team').upsert({
        clinic_id: inviteData.clinic_id,
        user_id: user.id,
        email: user.email?.toLowerCase(),
        name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Team Member',
        role: null,
        is_active: true,
      }, { onConflict: 'user_id,clinic_id' });

      if (error) throw error;

      await supabase
        .from('clinic_team_invites')
        .update({ status: 'accepted' })
        .eq('invite_token', token);

      setStatus('success');
    } catch (err) {
      console.error('Error accepting invite:', err);
      alert('Failed to accept invitation. Please try again.');
    }
  };

  const handleSignInAndAccept = () => {
    navigate(`/auth?redirect=/team-invite/${token}`);
  };

  if (authLoading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal/5 to-primary/5">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Validating your invitation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal/5 to-primary/5 p-4">
      <Card className="max-w-md w-full shadow-2xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-teal flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Users className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl">
            {status === 'valid' && "You're Invited!"}
            {status === 'success' && "Welcome to the Team!"}
            {status === 'invalid' && "Invalid Invitation"}
            {status === 'expired' && "Invitation Expired"}
            {status === 'already_member' && "Already a Member"}
            {status === 'already_member' && (
              <span className="block text-sm font-normal text-muted-foreground mt-2">
                You are already a member of this team.
              </span>
            )}
          </CardTitle>
          <CardDescription>
            {status === 'valid' && clinic?.name && `You've been invited to join ${clinic.name}`}
            {status === 'success' && 'Your invitation has been accepted. You now have access to the team dashboard.'}
            {status === 'invalid' && 'This invitation link is invalid or has been revoked.'}
            {status === 'expired' && 'This invitation link has expired. Please ask your team admin for a new invitation.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {status === 'valid' && (
            <>
              {user ? (
                <Button onClick={acceptInvite} className="w-full" size="lg">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Accept Invitation
                </Button>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground text-center">
                    Sign in or create an account to accept this invitation.
                  </p>
                  <Button onClick={handleSignInAndAccept} className="w-full" size="lg">
                    Sign In to Accept
                  </Button>
                </>
              )}
            </>
          )}

          {status === 'success' && (
            <Button onClick={() => navigate('/dashboard')} className="w-full" size="lg">
              Go to Dashboard
            </Button>
          )}

          {(status === 'invalid' || status === 'expired') && (
            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              Go to Homepage
            </Button>
          )}

          {status === 'already_member' && (
            <Button onClick={() => navigate('/dashboard')} className="w-full" size="lg">
              Go to Dashboard
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}