import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle,
  Clock,
  Mail,
  Phone,
  FileText,
  Calendar,
} from 'lucide-react';

interface FormSubmissionDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: {
    id: string;
    patient_email: string | null;
    patient_phone: string | null;
    status: string;
    form_data: any;
    submitted_at: string | null;
    created_at: string;
    template: {
      name: string;
      form_type: string;
      fields: any[];
    } | null;
  } | null;
}

export function FormSubmissionDetail({
  open,
  onOpenChange,
  submission,
}: FormSubmissionDetailProps) {
  if (!submission) return null;

  const template = submission.template;
  const responses = submission.form_data || {};
  const fields = Array.isArray(template?.fields) ? template.fields : [];

  const getFieldLabel = (fieldName: string) => {
    const field = fields.find((f: any) => f.name === fieldName);
    return field?.label || fieldName;
  };

  const formatValue = (value: any, fieldName: string) => {
    if (value === null || value === undefined) return '—';
    
    const field = fields.find((f: any) => f.name === fieldName);
    
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    
    if (field?.type === 'date' && value) {
      try {
        return format(new Date(value), 'MMM d, yyyy');
      } catch {
        return value;
      }
    }
    
    return String(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Form Submission Details
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Status & Info */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge
                  variant={submission.status === 'completed' ? 'default' : 'secondary'}
                  className="flex items-center gap-1"
                >
                  {submission.status === 'completed' ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : (
                    <Clock className="h-3 w-3" />
                  )}
                  {submission.status}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Form</span>
                <span className="font-medium">{template?.name || 'Unknown Form'}</span>
              </div>

              {submission.patient_email && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Email
                  </span>
                  <span className="font-medium">{submission.patient_email}</span>
                </div>
              )}

              {submission.patient_phone && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Phone
                  </span>
                  <span className="font-medium">{submission.patient_phone}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Sent
                </span>
                <span className="text-sm">
                  {format(new Date(submission.created_at), 'MMM d, yyyy h:mm a')}
                </span>
              </div>

              {submission.submitted_at && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Submitted
                  </span>
                  <span className="text-sm">
                    {format(new Date(submission.submitted_at), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
              )}
            </div>

            <Separator />

            {/* Responses */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                Responses
              </h4>

              {submission.status === 'pending' ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Awaiting patient submission</p>
                </div>
              ) : Object.keys(responses).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No responses recorded</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(responses).map(([key, value]) => (
                    <div
                      key={key}
                      className="bg-muted/50 rounded-lg p-3 space-y-1"
                    >
                      <p className="text-sm font-medium text-muted-foreground">
                        {getFieldLabel(key)}
                      </p>
                      <p className="text-foreground">
                        {formatValue(value, key)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
