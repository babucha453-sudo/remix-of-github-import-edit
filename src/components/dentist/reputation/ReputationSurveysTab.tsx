import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { createAuditLog } from '@/lib/audit';
import {
  FileText,
  Plus,
  Edit,
  Eye,
  Send,
  Clock,
  CheckCircle,
  BarChart3,
  MessageSquare,
  Star,
  ThumbsDown,
  TrendingUp,
  Mail,
  Smartphone,
  AlertTriangle,
  Loader2,
  Trash2,
} from 'lucide-react';
import { format, subDays } from 'date-fns';

interface ReputationSurveysTabProps {
  clinicId: string;
  clinicName: string;
}

interface SurveyTemplate {
  id: string;
  name: string;
  questions: SurveyQuestion[];
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

interface SurveyQuestion {
  id: string;
  type: 'rating' | 'yesno' | 'text';
  question: string;
  required: boolean;
}

const DEFAULT_QUESTIONS: SurveyQuestion[] = [
  { id: '1', type: 'rating', question: 'How would you rate your overall experience?', required: true },
  { id: '2', type: 'yesno', question: 'Would you recommend us to friends and family?', required: true },
  { id: '3', type: 'text', question: 'What could we do better?', required: false },
];

export default function ReputationSurveysTab({ clinicId, clinicName }: ReputationSurveysTabProps) {
  const queryClient = useQueryClient();
  const [showEditor, setShowEditor] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<SurveyTemplate | null>(null);
  const [surveyName, setSurveyName] = useState('');
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestion[]>(DEFAULT_QUESTIONS);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [sendChannel, setSendChannel] = useState<'email' | 'sms' | 'whatsapp'>('email');
  const [recipientName, setRecipientName] = useState('');
  const [recipientContact, setRecipientContact] = useState('');

  // Fetch surveys
  const { data: surveys = [], isLoading: surveysLoading } = useQuery({
    queryKey: ['clinic-surveys', clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', `survey_templates_${clinicId}`)
        .maybeSingle() as { data: { value: any } | null };
      if (!data?.value) return [];
      return Array.isArray(data.value) ? data.value as SurveyTemplate[] : [];
    },
  });

  // Fetch negative feedback (private survey responses)
  const { data: feedback = [], isLoading: feedbackLoading } = useQuery({
    queryKey: ['negative-feedback', clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from('review_funnel_events')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('event_type', 'thumbs_down')
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  // Calculate analytics
  const analytics = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const last30 = feedback.filter((f: any) => new Date(f.created_at) >= thirtyDaysAgo);
    
    const ratingBreakdown = [0, 0, 0, 0, 0];
    feedback.forEach((f: any) => {
      if (f.rating && f.rating >= 1 && f.rating <= 5) {
        ratingBreakdown[f.rating - 1]++;
      }
    });
    
    const avgRating = feedback.length > 0
      ? feedback.reduce((sum: number, f: any) => sum + (f.rating || 0), 0) / feedback.filter((f: any) => f.rating).length
      : 0;

    return {
      totalResponses: feedback.length,
      last30Responses: last30.length,
      avgRating: avgRating || 0,
      ratingBreakdown,
      withComments: feedback.filter((f: any) => f.comment).length,
    };
  }, [feedback]);

  // Save survey mutation
  const saveSurvey = useMutation({
    mutationFn: async () => {
      const surveyData: SurveyTemplate = {
        id: editingSurvey?.id || crypto.randomUUID(),
        name: surveyName,
        questions: surveyQuestions,
        is_active: true,
        version: editingSurvey ? (editingSurvey.version || 0) + 1 : 1,
        created_at: editingSurvey?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const updatedSurveys = editingSurvey
        ? surveys.map((s: SurveyTemplate) => s.id === editingSurvey.id ? { ...s, is_active: false } : s).concat([surveyData])
        : [...surveys, surveyData];

      await supabase.from('global_settings').upsert({
        key: `survey_templates_${clinicId}`,
        value: updatedSurveys as any,
        updated_at: new Date().toISOString(),
      } as any);

      await createAuditLog({
        action: editingSurvey ? 'update_survey' : 'create_survey',
        entityType: 'survey_template',
        entityId: surveyData.id,
        newValues: surveyData as unknown as Record<string, unknown>,
      });
    },
    onSuccess: () => {
      toast.success(editingSurvey ? 'Survey updated (new version created)' : 'Survey created');
      queryClient.invalidateQueries({ queryKey: ['clinic-surveys'] });
      closeEditor();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Send survey mutation
  const sendSurvey = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('send-review-request', {
        body: {
          clinicId,
          recipientName,
          recipientEmail: sendChannel === 'email' ? recipientContact : undefined,
          recipientPhone: sendChannel !== 'email' ? recipientContact : undefined,
          channel: sendChannel,
          customMessage: `Hi ${recipientName}, we'd love to hear about your experience at ${clinicName}. Please take a moment to share your feedback.`,
          type: 'survey',
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Survey sent!');
      setShowSendDialog(false);
      setRecipientName('');
      setRecipientContact('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEditor = (survey?: SurveyTemplate) => {
    if (survey) {
      setEditingSurvey(survey);
      setSurveyName(survey.name);
      setSurveyQuestions(survey.questions);
    } else {
      setEditingSurvey(null);
      setSurveyName('');
      setSurveyQuestions(DEFAULT_QUESTIONS);
    }
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditingSurvey(null);
    setSurveyName('');
    setSurveyQuestions(DEFAULT_QUESTIONS);
  };

  const addQuestion = () => {
    setSurveyQuestions([
      ...surveyQuestions,
      { id: crypto.randomUUID(), type: 'text', question: '', required: false },
    ]);
  };

  const updateQuestion = (id: string, updates: Partial<SurveyQuestion>) => {
    setSurveyQuestions(surveyQuestions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const removeQuestion = (id: string) => {
    setSurveyQuestions(surveyQuestions.filter(q => q.id !== id));
  };

  const activeSurveys = surveys.filter((s: SurveyTemplate) => s.is_active);

  return (
    <div className="space-y-6">
      {/* Analytics Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics.totalResponses}</p>
                <p className="text-sm text-muted-foreground">Total Responses</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <Star className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics.avgRating.toFixed(1)}</p>
                <p className="text-sm text-muted-foreground">Avg Satisfaction</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics.last30Responses}</p>
                <p className="text-sm text-muted-foreground">Last 30 Days</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics.withComments}</p>
                <p className="text-sm text-muted-foreground">With Comments</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Survey Templates */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Survey Templates
                </CardTitle>
                <CardDescription>Create and manage feedback surveys</CardDescription>
              </div>
              <Button onClick={() => openEditor()} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Survey
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {surveysLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => <Skeleton key={i} className="h-20" />)}
              </div>
            ) : activeSurveys.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground mb-4">No survey templates yet</p>
                <Button onClick={() => openEditor()} variant="outline">
                  Create Your First Survey
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {activeSurveys.map((survey: SurveyTemplate) => (
                  <div key={survey.id} className="p-4 rounded-xl border bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{survey.name}</span>
                        <Badge variant="outline" className="text-xs">v{survey.version}</Badge>
                        <Badge className="bg-emerald-100 text-emerald-700 text-xs">Active</Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEditor(survey)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowSendDialog(true)}>
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {survey.questions.length} questions • Updated {format(new Date(survey.updated_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Private Feedback */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ThumbsDown className="h-5 w-5 text-red-500" />
              Private Feedback
            </CardTitle>
            <CardDescription>Negative feedback captured privately</CardDescription>
          </CardHeader>
          <CardContent>
            {feedbackLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : feedback.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 mx-auto text-emerald-500/50 mb-4" />
                <p className="text-muted-foreground">No negative feedback. Great work!</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-3 pr-4">
                  {feedback.slice(0, 20).map((item: any) => (
                    <div key={item.id} className="p-3 rounded-lg bg-muted/50 border">
                      <div className="flex items-center justify-between mb-2">
                        {item.rating && (
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map(i => (
                              <Star key={i} className={`h-3 w-3 ${i <= item.rating ? 'text-amber-500 fill-amber-500' : 'text-muted'}`} />
                            ))}
                          </div>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(item.created_at), 'MMM d, HH:mm')}
                        </span>
                      </div>
                      {item.comment && (
                        <p className="text-sm">{item.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Survey Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSurvey ? 'Edit Survey' : 'Create Survey'}</DialogTitle>
            <DialogDescription>
              {editingSurvey && 'Editing creates a new version. Previous version will be archived.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Survey Name</Label>
              <Input
                value={surveyName}
                onChange={(e) => setSurveyName(e.target.value)}
                placeholder="e.g., Post-Visit Feedback"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Questions</Label>
                <Button size="sm" variant="outline" onClick={addQuestion}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Question
                </Button>
              </div>
              {surveyQuestions.map((q, i) => (
                <div key={q.id} className="p-4 rounded-lg border bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Question {i + 1}</span>
                    <Button size="sm" variant="ghost" onClick={() => removeQuestion(q.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <Input
                    value={q.question}
                    onChange={(e) => updateQuestion(q.id, { question: e.target.value })}
                    placeholder="Enter question..."
                  />
                  <div className="flex items-center gap-4">
                    <Select value={q.type} onValueChange={(v: 'rating' | 'yesno' | 'text') => updateQuestion(q.id, { type: v })}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rating">Rating (1-5)</SelectItem>
                        <SelectItem value="yesno">Yes/No</SelectItem>
                        <SelectItem value="text">Text Answer</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Switch checked={q.required} onCheckedChange={(c) => updateQuestion(q.id, { required: c })} />
                      <Label className="text-sm">Required</Label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditor}>Cancel</Button>
            <Button onClick={() => saveSurvey.mutate()} disabled={!surveyName.trim() || saveSurvey.isPending}>
              {saveSurvey.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSurvey ? 'Save New Version' : 'Create Survey'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Survey Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Survey</DialogTitle>
            <DialogDescription>Send a feedback survey to a patient</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Recipient Name</Label>
              <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Patient name" />
            </div>
            <div className="space-y-2">
              <Label>Channel</Label>
              <div className="flex gap-2">
                {(['email', 'sms', 'whatsapp'] as const).map((ch) => (
                  <Button
                    key={ch}
                    variant={sendChannel === ch ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSendChannel(ch)}
                    className="capitalize"
                  >
                    {ch === 'email' ? <Mail className="h-4 w-4 mr-1" /> : <Smartphone className="h-4 w-4 mr-1" />}
                    {ch}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{sendChannel === 'email' ? 'Email' : 'Phone Number'}</Label>
              <Input
                value={recipientContact}
                onChange={(e) => setRecipientContact(e.target.value)}
                placeholder={sendChannel === 'email' ? 'email@example.com' : '+1234567890'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>Cancel</Button>
            <Button onClick={() => sendSurvey.mutate()} disabled={!recipientName || !recipientContact || sendSurvey.isPending}>
              {sendSurvey.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Survey
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
