import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Send, Mail, Phone, Loader2 } from 'lucide-react';

interface SendFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: {
    id: string;
    name: string;
    form_type: string;
  } | null;
  clinicId: string;
  clinicName: string;
}

export function SendFormModal({ 
  open, 
  onOpenChange, 
  template, 
  clinicId,
  clinicName 
}: SendFormModalProps) {
  const queryClient = useQueryClient();
  const [deliveryMethod, setDeliveryMethod] = useState<'email' | 'sms'>('email');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientName, setPatientName] = useState('');
  const [customMessage, setCustomMessage] = useState('');

  const resetForm = () => {
    setPatientEmail('');
    setPatientPhone('');
    setPatientName('');
    setCustomMessage('');
    setDeliveryMethod('email');
  };

  const sendFormMutation = useMutation({
    mutationFn: async () => {
      if (!template) throw new Error('No template selected');

      // Create the submission record
      const { data: submission, error: submissionError } = await supabase
        .from('patient_form_submissions')
        .insert({
          template_id: template.id,
          clinic_id: clinicId,
          patient_email: deliveryMethod === 'email' ? patientEmail : null,
          patient_phone: deliveryMethod === 'sms' ? patientPhone : null,
          status: 'pending',
        })
        .select()
        .single();

      if (submissionError) throw submissionError;

      // Call the edge function to send the form link
      const { error: sendError } = await supabase.functions.invoke('send-form-request', {
        body: {
          submissionId: submission.id,
          templateName: template.name,
          deliveryMethod,
          patientEmail: deliveryMethod === 'email' ? patientEmail : undefined,
          patientPhone: deliveryMethod === 'sms' ? patientPhone : undefined,
          patientName: patientName || undefined,
          customMessage: customMessage || undefined,
          clinicName,
        },
      });

      if (sendError) throw sendError;

      return submission;
    },
    onSuccess: () => {
      toast.success('Form request sent successfully!');
      queryClient.invalidateQueries({ queryKey: ['form-submissions'] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(`Failed to send form: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (deliveryMethod === 'email' && !patientEmail) {
      toast.error('Please enter a patient email');
      return;
    }
    if (deliveryMethod === 'sms' && !patientPhone) {
      toast.error('Please enter a patient phone number');
      return;
    }

    sendFormMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Form to Patient
          </DialogTitle>
          <DialogDescription>
            Send "{template?.name}" to a patient via email or SMS
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Delivery Method</Label>
            <RadioGroup
              value={deliveryMethod}
              onValueChange={(v) => setDeliveryMethod(v as 'email' | 'sms')}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="email" id="email" />
                <Label htmlFor="email" className="flex items-center gap-1 cursor-pointer font-normal">
                  <Mail className="h-4 w-4" /> Email
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="sms" id="sms" />
                <Label htmlFor="sms" className="flex items-center gap-1 cursor-pointer font-normal">
                  <Phone className="h-4 w-4" /> SMS
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="patientName">Patient Name (Optional)</Label>
            <Input
              id="patientName"
              placeholder="John Doe"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
            />
          </div>

          {deliveryMethod === 'email' ? (
            <div className="space-y-2">
              <Label htmlFor="patientEmail">Patient Email *</Label>
              <Input
                id="patientEmail"
                type="email"
                placeholder="patient@example.com"
                value={patientEmail}
                onChange={(e) => setPatientEmail(e.target.value)}
                required
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="patientPhone">Patient Phone *</Label>
              <Input
                id="patientPhone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="customMessage">Custom Message (Optional)</Label>
            <Textarea
              id="customMessage"
              placeholder="Please complete this form before your appointment..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={sendFormMutation.isPending}>
              {sendFormMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Form
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
