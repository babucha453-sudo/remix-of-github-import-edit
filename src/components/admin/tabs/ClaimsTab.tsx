import { useState } from 'react';
import { useClaimRequests, useApproveClaim, useRejectClaim } from '@/hooks/useAdminClaims';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Shield, CheckCircle, XCircle, Clock, Building2, Mail, Phone } from 'lucide-react';
import { format } from 'date-fns';

export default function ClaimsTab() {
  const { data: claims, isLoading } = useClaimRequests();
  const approveClaim = useApproveClaim();
  const rejectClaim = useRejectClaim();

  const [rejectDialog, setRejectDialog] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');

  const handleApprove = async (claim: any) => {
    await approveClaim.mutateAsync({ claimId: claim.id, clinicId: claim.clinic_id });
  };

  const handleReject = async () => {
    if (selectedClaim) {
      await rejectClaim.mutateAsync({ claimId: selectedClaim.id, reason: rejectReason });
      setRejectDialog(false);
      setSelectedClaim(null);
      setRejectReason('');
    }
  };

  const openReject = (claim: any) => {
    setSelectedClaim(claim);
    setRejectDialog(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-primary text-primary-foreground"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected': return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default: return <Badge variant="outline" className="text-gold border-gold"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const pendingCount = claims?.filter(c => c.status === 'pending').length || 0;
  const approvedCount = claims?.filter(c => c.status === 'approved').length || 0;
  const rejectedCount = claims?.filter(c => c.status === 'rejected').length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Claims & Verification</h1>
        <p className="text-muted-foreground mt-1">Review and manage clinic ownership claims</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{claims?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Total Claims</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gold-light flex items-center justify-center">
              <Clock className="h-6 w-6 text-gold" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-teal-light flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-teal" />
            </div>
            <div>
              <p className="text-2xl font-bold">{approvedCount}</p>
              <p className="text-sm text-muted-foreground">Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-coral-light flex items-center justify-center">
              <XCircle className="h-6 w-6 text-coral" />
            </div>
            <div>
              <p className="text-2xl font-bold">{rejectedCount}</p>
              <p className="text-sm text-muted-foreground">Rejected</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Claims Table */}
      <Card className="card-modern">
        <CardHeader>
          <CardTitle>Claim Requests</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinic</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Verification</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims?.map((claim) => (
                <TableRow key={claim.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{claim.clinic?.name || 'Unknown Clinic'}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      {claim.business_email && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {claim.business_email}
                        </div>
                      )}
                      {claim.business_phone && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {claim.business_phone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {claim.verification_method || 'email'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {claim.created_at ? format(new Date(claim.created_at), 'MMM d, yyyy') : '-'}
                  </TableCell>
                  <TableCell>{getStatusBadge(claim.status || 'pending')}</TableCell>
                  <TableCell className="text-right">
                    {claim.status === 'pending' && (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(claim)}
                          disabled={approveClaim.isPending}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          onClick={() => openReject(claim)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!claims || claims.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No claim requests yet</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Claim</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-muted-foreground">
              Rejecting claim for: <span className="font-medium text-foreground">{selectedClaim?.clinic?.name}</span>
            </p>
            <div className="space-y-2">
              <Label>Rejection Reason</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Please provide a reason for rejection..."
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setRejectDialog(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                className="flex-1"
                disabled={rejectClaim.isPending || !rejectReason.trim()}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
