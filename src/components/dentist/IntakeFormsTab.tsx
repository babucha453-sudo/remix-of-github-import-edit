import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  Send,
  Eye,
  Clock,
  CheckCircle,
  ClipboardList,
  Heart,
  Shield,
  CreditCard,
  Plus,
} from 'lucide-react';
import { NoPracticeLinked } from './NoPracticeLinked';
import { SendFormModal } from './SendFormModal';
import { FormSubmissionDetail } from './FormSubmissionDetail';
import { FormPreviewModal } from './FormPreviewModal';
import FormBuilderModal from './FormBuilderModal';

const FORM_TYPE_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  medical_history: { icon: Heart, color: 'bg-coral-light text-coral', label: 'Medical History' },
  consent: { icon: Shield, color: 'bg-teal-light text-teal', label: 'Consent' },
  insurance: { icon: CreditCard, color: 'bg-gold-light text-gold', label: 'Insurance' },
  custom: { icon: ClipboardList, color: 'bg-purple-light text-purple', label: 'Custom' },
};

export default function IntakeFormsTab() {
  const { user } = useAuth();
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [builderModalOpen, setBuilderModalOpen] = useState(false);

  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ['dentist-clinic-forms', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinics')
        .select('id, name')
        .eq('claimed_by', user?.id)
        .limit(1)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['intake-templates', clinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('intake_form_templates')
        .select('*')
        .or(`clinic_id.eq.${clinic?.id},clinic_id.is.null`)
        .eq('is_active', true)
        .order('form_type');
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  const { data: submissions } = useQuery({
    queryKey: ['form-submissions', clinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('patient_form_submissions')
        .select('*, template:intake_form_templates!template_id(id, name, form_type, fields)')
        .eq('clinic_id', clinic?.id)
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!clinic?.id,
  });

  const stats = {
    total: submissions?.length || 0,
    pending: submissions?.filter(s => s.status === 'pending').length || 0,
    completed: submissions?.filter(s => s.status === 'completed').length || 0,
  };

  if (clinicLoading) {
    return <Skeleton className="h-96" />;
  }

  if (!clinic) {
    return <NoPracticeLinked compact />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold">Patient Intake Forms</h2>
          <p className="text-muted-foreground">Send forms to patients before their appointment</p>
        </div>
        <Button onClick={() => setBuilderModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Form
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{templates?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Form Templates</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gold-light flex items-center justify-center">
              <Clock className="h-6 w-6 text-gold" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
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
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Templates */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Available Form Templates</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templatesLoading ? (
            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)
          ) : templates?.map(template => {
            const config = FORM_TYPE_CONFIG[template.form_type] || FORM_TYPE_CONFIG.custom;
            const Icon = config.icon;
            const fields = Array.isArray(template.fields) ? template.fields : [];
            
            return (
              <Card key={template.id} className="card-modern">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-lg ${config.color} flex items-center justify-center`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{template.name}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-1">{template.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {fields.length} fields
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${config.color} border-0`}>
                          {config.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPreviewTemplate(template);
                        setPreviewModalOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedTemplate(template);
                        setSendModalOpen(true);
                      }}
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Send
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent Submissions */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Recent Submissions</h3>
        {submissions && submissions.length > 0 ? (
          <div className="space-y-2">
            {submissions.slice(0, 10).map(sub => (
              <Card 
                key={sub.id} 
                className="card-modern cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => {
                  setSelectedSubmission(sub);
                  setDetailModalOpen(true);
                }}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                      sub.status === 'completed' ? 'bg-teal-light' : 'bg-gold-light'
                    }`}>
                      {sub.status === 'completed' ? (
                        <CheckCircle className="h-4 w-4 text-teal" />
                      ) : (
                        <Clock className="h-4 w-4 text-gold" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{sub.patient_email || sub.patient_phone || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground">
                        {(sub.template as any)?.name || 'Form'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={sub.status === 'completed' ? 'default' : 'secondary'}>
                      {sub.status}
                    </Badge>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="card-modern">
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Submissions Yet</h3>
              <p className="text-muted-foreground">
                Forms sent to patients will appear here once submitted
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modals */}
      <SendFormModal
        open={sendModalOpen}
        onOpenChange={setSendModalOpen}
        template={selectedTemplate}
        clinicId={clinic.id}
        clinicName={clinic.name}
      />

      <FormPreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        template={previewTemplate}
      />

      <FormSubmissionDetail
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        submission={selectedSubmission}
      />

      <FormBuilderModal
        open={builderModalOpen}
        onOpenChange={setBuilderModalOpen}
        clinicId={clinic.id}
      />
    </div>
  );
}
