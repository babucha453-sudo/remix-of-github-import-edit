import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Star,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  Flag,
  Clock,
  User,
  Mail,
  Phone,
  Calendar,
  Bot,
  Loader2
} from 'lucide-react';
import { useInternalReviews, useUpdateInternalReview, InternalReview } from '@/hooks/useReviewSystem';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface InternalReviewsManagerProps {
  clinicId: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  new: { label: 'New', color: 'bg-blue-100 text-blue-800', icon: <Clock className="h-3 w-3" /> },
  acknowledged: { label: 'Acknowledged', color: 'bg-yellow-100 text-yellow-800', icon: <MessageSquare className="h-3 w-3" /> },
  follow_up: { label: 'Follow-up', color: 'bg-purple-100 text-purple-800', icon: <AlertTriangle className="h-3 w-3" /> },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="h-3 w-3" /> },
  flagged_fake: { label: 'Flagged Fake', color: 'bg-red-100 text-red-800', icon: <Flag className="h-3 w-3" /> },
};

export default function InternalReviewsManager({ clinicId }: InternalReviewsManagerProps) {
  const { data: reviews = [], isLoading } = useInternalReviews(clinicId);
  const updateReview = useUpdateInternalReview();
  
  const [selectedReview, setSelectedReview] = useState<InternalReview | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [fakeReason, setFakeReason] = useState('');

  const handleOpenReview = (review: InternalReview) => {
    setSelectedReview(review);
    setNewStatus(review.status);
    setResolutionNotes(review.resolution_notes || '');
    setFakeReason(review.fake_review_reason || '');
    setDialogOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedReview) return;

    const updates: { id: string } & Partial<InternalReview> = {
      id: selectedReview.id,
      status: newStatus as InternalReview['status'],
      resolution_notes: resolutionNotes || null,
    };

    if (newStatus === 'resolved') {
      updates.resolved_at = new Date().toISOString();
    }

    if (newStatus === 'flagged_fake') {
      updates.is_fake_suspected = true;
      updates.fake_review_reason = fakeReason || null;
    }

    updateReview.mutate(updates, {
      onSuccess: () => {
        setDialogOpen(false);
        toast.success('Review updated successfully');
      },
    });
  };

  const stats = {
    total: reviews.length,
    new: reviews.filter(r => r.status === 'new').length,
    pending: reviews.filter(r => ['acknowledged', 'follow_up'].includes(r.status)).length,
    resolved: reviews.filter(r => r.status === 'resolved').length,
    avgRating: reviews.length 
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : '0',
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="card-stat">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="card-stat">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">New</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{stats.new}</p>
          </CardContent>
        </Card>
        <Card className="card-stat">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-muted-foreground">Pending</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="card-stat">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-xs font-medium text-muted-foreground">Resolved</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
          </CardContent>
        </Card>
        <Card className="card-stat">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-gold" />
              <span className="text-xs font-medium text-muted-foreground">Avg Rating</span>
            </div>
            <p className="text-2xl font-bold">{stats.avgRating}</p>
          </CardContent>
        </Card>
      </div>

      {/* Reviews Table */}
      <Card className="card-modern">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-coral" />
            Internal Feedback ({reviews.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-teal/50" />
              <p className="text-lg font-medium">No negative feedback yet</p>
              <p className="text-sm">Great job maintaining patient satisfaction!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((review) => (
                  <TableRow key={review.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleOpenReview(review)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{review.patient_name}</p>
                          {review.patient_email && (
                            <p className="text-xs text-muted-foreground">{review.patient_email}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${star <= review.rating ? 'text-gold fill-gold' : 'text-muted'}`}
                          />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate text-sm">{review.comment || '-'}</p>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statusConfig[review.status]?.color} gap-1`}>
                        {statusConfig[review.status]?.icon}
                        {statusConfig[review.status]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(review.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleOpenReview(review); }}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Review Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Feedback Details</DialogTitle>
          </DialogHeader>
          
          {selectedReview && (
            <div className="space-y-4">
              {/* Patient Info */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{selectedReview.patient_name}</span>
                </div>
                {selectedReview.patient_email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{selectedReview.patient_email}</span>
                  </div>
                )}
                {selectedReview.patient_phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{selectedReview.patient_phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{format(new Date(selectedReview.created_at), 'MMMM d, yyyy HH:mm')}</span>
                </div>
              </div>

              {/* Rating */}
              <div>
                <label className="text-sm font-medium mb-2 block">Rating</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-6 w-6 ${star <= selectedReview.rating ? 'text-gold fill-gold' : 'text-muted'}`}
                    />
                  ))}
                  <span className="ml-2 text-sm text-muted-foreground">({selectedReview.rating}/5)</span>
                </div>
              </div>

              {/* Comment */}
              {selectedReview.comment && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Comment</label>
                  <p className="text-sm p-3 bg-muted rounded-lg">{selectedReview.comment}</p>
                </div>
              )}

              {/* AI Suggestion */}
              {selectedReview.ai_suggested_response && (
                <div>
                  <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    AI Suggested Response
                  </label>
                  <p className="text-sm p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    {selectedReview.ai_suggested_response}
                  </p>
                </div>
              )}

              {/* Status Update */}
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
                    <SelectItem value="follow_up">Follow-up Required</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="flagged_fake">Flag as Fake</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Resolution Notes */}
              <div>
                <label className="text-sm font-medium mb-2 block">Resolution Notes</label>
                <Textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Add notes about how this was resolved..."
                  rows={3}
                />
              </div>

              {/* Fake Review Reason */}
              {newStatus === 'flagged_fake' && (
                <div>
                  <label className="text-sm font-medium mb-2 block text-destructive">Reason for Flagging</label>
                  <Textarea
                    value={fakeReason}
                    onChange={(e) => setFakeReason(e.target.value)}
                    placeholder="Explain why this review appears to be fake..."
                    rows={2}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStatus} disabled={updateReview.isPending}>
              {updateReview.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
