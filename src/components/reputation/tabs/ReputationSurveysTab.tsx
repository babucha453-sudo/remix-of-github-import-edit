import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { FileText, Plus, Edit, Copy, Eye, Trash2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { createAuditLog } from '@/lib/audit';

interface Props {
  clinicId?: string;
  isAdmin?: boolean;
}

export default function ReputationSurveysTab({ clinicId, isAdmin }: Props) {
  const [showEditor, setShowEditor] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<any>(null);
  const [surveyName, setSurveyName] = useState('');
  const [surveyQuestions, setSurveyQuestions] = useState('');
  const queryClient = useQueryClient();

  // Fetch surveys (using global_settings as fallback storage)
  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ['reputation-surveys', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_settings')
        .select('*')
        .eq('key', 'survey_templates')
        .maybeSingle();
      if (error || !data?.value) return [];
      const templates = data.value as Record<string, unknown>;
      return Array.isArray(templates) ? templates : [];
    },
  });

  // Fetch negative feedback themes (aggregate from funnel)
  const { data: negativeThemes = [] } = useQuery({
    queryKey: ['negative-themes', clinicId],
    queryFn: async () => {
      let query = supabase
        .from('review_funnel_events')
        .select('comment, rating, created_at')
        .eq('event_type', 'thumbs_down')
        .not('comment', 'is', null)
        .order('created_at', { ascending: false });
      if (clinicId) query = query.eq('clinic_id', clinicId);
      const { data, error } = await query.limit(50);
      if (error) return [];
      return data || [];
    },
  });

  // Save survey
  const saveSurvey = useMutation({
    mutationFn: async () => {
      const surveyData = {
        id: editingSurvey?.id || crypto.randomUUID(),
        name: surveyName,
        content: surveyQuestions,
        is_active: true,
        version: editingSurvey ? (editingSurvey.version || 0) + 1 : 1,
        updated_at: new Date().toISOString(),
        created_at: editingSurvey?.created_at || new Date().toISOString(),
      };

      // Get existing surveys
      const { data: existing } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'survey_templates')
        .maybeSingle();

      const currentSurveys = Array.isArray(existing?.value) ? existing.value : [];
      
      // Update or add
      const updatedSurveys = editingSurvey
        ? currentSurveys.map((s: any) => s.id === editingSurvey.id ? { ...s, is_active: false } : s).concat([surveyData])
        : [...currentSurveys, surveyData];

      const { error } = await supabase
        .from('global_settings')
        .upsert({
          key: 'survey_templates',
          value: updatedSurveys,
          updated_at: new Date().toISOString(),
        });

      await createAuditLog({
        action: editingSurvey ? 'update_survey' : 'create_survey',
        entityType: 'survey_template',
        newValues: surveyData,
      });
    },
    onSuccess: () => {
      toast.success(editingSurvey ? 'New version created' : 'Survey created');
      queryClient.invalidateQueries({ queryKey: ['reputation-surveys'] });
      setShowEditor(false);
      setEditingSurvey(null);
      setSurveyName('');
      setSurveyQuestions('');
    },
    onError: (e: Error) => toast.error('Failed: ' + e.message),
  });

  const openEditor = (survey?: any) => {
    if (survey) {
      setEditingSurvey(survey);
      setSurveyName(survey.name);
      setSurveyQuestions(survey.content || '');
    } else {
      setEditingSurvey(null);
      setSurveyName('');
      setSurveyQuestions('');
    }
    setShowEditor(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Survey Templates</h2>
          <p className="text-muted-foreground">Manage feedback collection surveys</p>
        </div>
        {isAdmin && (
          <Button onClick={() => openEditor()} className="gap-2">
            <Plus className="h-4 w-4" />
            New Survey
          </Button>
        )}
      </div>

      {/* Surveys List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Survey Templates
          </CardTitle>
          <CardDescription>
            Each edit creates a new version for audit tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : surveys.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No survey templates yet</p>
              {isAdmin && (
                <Button variant="outline" className="mt-4" onClick={() => openEditor()}>
                  Create First Survey
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {surveys.map((survey: any) => (
                <div
                  key={survey.id}
                  className="p-4 rounded-xl border bg-card flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{survey.name}</span>
                      <Badge variant="outline">v{survey.version || 1}</Badge>
                      {survey.is_active ? (
                        <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Archived</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {survey.content || 'No content'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Updated {format(new Date(survey.updated_at || survey.created_at), 'PPp')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openEditor(survey)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Negative Themes Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Negative Feedback Themes</CardTitle>
          <CardDescription>Common issues from private feedback</CardDescription>
        </CardHeader>
        <CardContent>
          {negativeThemes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No negative feedback to analyze
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3 pr-4">
                {negativeThemes.map((feedback: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-1">
                      {feedback.rating && (
                        <Badge variant="destructive" className="text-xs">
                          {feedback.rating}★
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(feedback.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <p className="text-sm">{feedback.comment}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingSurvey ? 'Edit Survey (Creates New Version)' : 'Create Survey'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Survey Name</Label>
              <Input
                value={surveyName}
                onChange={(e) => setSurveyName(e.target.value)}
                placeholder="e.g., Post-Visit Satisfaction Survey"
              />
            </div>
            <div className="space-y-2">
              <Label>Questions / Content</Label>
              <Textarea
                value={surveyQuestions}
                onChange={(e) => setSurveyQuestions(e.target.value)}
                placeholder="Enter survey questions or content..."
                className="min-h-[200px]"
              />
            </div>
            {editingSurvey && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                <Clock className="h-4 w-4 inline mr-2" />
                Editing creates a new version (v{(editingSurvey.version || 1) + 1}). Previous version will be archived.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditor(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveSurvey.mutate()}
              disabled={!surveyName.trim() || saveSurvey.isPending}
            >
              {editingSurvey ? 'Create New Version' : 'Create Survey'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
