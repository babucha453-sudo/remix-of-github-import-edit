import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Brain,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Target,
  MessageSquare,
  Loader2,
  RefreshCw,
  BarChart3,
  Zap,
} from 'lucide-react';
import { useAIReputationInsights } from '@/hooks/useReputationAI';
import { cn } from '@/lib/utils';

interface ReputationAIInsightsTabProps {
  clinicId: string;
  clinicName: string;
}

export default function ReputationAIInsightsTab({ clinicId, clinicName }: ReputationAIInsightsTabProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { data: insights, isLoading, refetch } = useAIReputationInsights(clinicId);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    await refetch();
    setIsAnalyzing(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* AI Header */}
      <Card className="border-2 border-gradient-to-r from-primary/20 to-teal/20 bg-gradient-to-r from-primary/5 to-teal/5">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-teal flex items-center justify-center shadow-lg">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  AI Reputation Insights
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Powered by Gemini AI - Real-time analysis of your patient feedback
                </CardDescription>
              </div>
            </div>
            <Button 
              onClick={handleAnalyze} 
              disabled={isAnalyzing}
              className="gap-2"
            >
              {isAnalyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {isAnalyzing ? 'Analyzing...' : 'Refresh Analysis'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!insights ? (
            <div className="text-center py-8">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Brain className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">No Insights Yet</h3>
              <p className="text-muted-foreground text-sm mb-4 max-w-sm mx-auto">
                Click the button above to analyze your negative feedback using AI and get actionable insights.
              </p>
              <Button onClick={handleAnalyze} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Generate AI Insights
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Severity Indicator */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-background/50 border">
                <div className={cn(
                  "h-12 w-12 rounded-xl flex items-center justify-center",
                  insights.severity === 'high' ? "bg-red-100" :
                  insights.severity === 'medium' ? "bg-amber-100" : "bg-emerald-100"
                )}>
                  {insights.severity === 'high' ? (
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  ) : insights.severity === 'medium' ? (
                    <TrendingDown className="h-6 w-6 text-amber-600" />
                  ) : (
                    <CheckCircle className="h-6 w-6 text-emerald-600" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold capitalize">Severity: {insights.severity}</p>
                  <p className="text-sm text-muted-foreground">Based on recent feedback analysis</p>
                </div>
                <Badge variant={insights.severity === 'high' ? 'destructive' : 'secondary'}>
                  {insights.severity === 'high' ? 'Needs Attention' : 
                   insights.severity === 'medium' ? 'Monitor' : 'Healthy'}
                </Badge>
              </div>

              {/* Summary */}
              <div className="p-4 rounded-xl bg-background border">
                <h4 className="font-semibold flex items-center gap-2 mb-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  AI Summary
                </h4>
                <p className="text-muted-foreground">{insights.summary}</p>
              </div>

              {/* Key Themes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-background border">
                  <h4 className="font-semibold flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4 text-coral" />
                    Key Issues Identified
                  </h4>
                  <div className="space-y-2">
                    {insights.themes?.map((theme, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-coral/10 flex items-center justify-center text-xs font-medium text-coral">
                          {i + 1}
                        </div>
                        <span className="text-sm">{theme}</span>
                      </div>
                    )) || <p className="text-sm text-muted-foreground">No themes identified</p>}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-background border">
                  <h4 className="font-semibold flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Recommended Actions
                  </h4>
                  <div className="space-y-2">
                    {insights.recommendations?.slice(0, 5).map((action, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="h-6 w-6 rounded-full bg-amber-100 flex items-center justify-center text-xs font-medium text-amber-600 shrink-0">
                          {i + 1}
                        </div>
                        <span className="text-sm">{action}</span>
                      </div>
                    )) || <p className="text-sm text-muted-foreground">No recommendations</p>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <p className="text-2xl font-bold">AI</p>
              <p className="text-xs text-muted-foreground">Powered by Gemini</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="h-10 w-10 rounded-xl bg-teal/10 flex items-center justify-center mx-auto mb-2">
                <BarChart3 className="h-5 w-5 text-teal" />
              </div>
              <p className="text-2xl font-bold">Real-time</p>
              <p className="text-xs text-muted-foreground">Live Analysis</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="h-10 w-10 rounded-xl bg-coral/10 flex items-center justify-center mx-auto mb-2">
                <Lightbulb className="h-5 w-5 text-coral" />
              </div>
              <p className="text-2xl font-bold">Smart</p>
              <p className="text-xs text-muted-foreground">Actionable Insights</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* How it Works */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <h4 className="font-semibold mb-4">How AI Insights Work</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">1</div>
              <p className="text-muted-foreground">Collect negative feedback from the review funnel</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">2</div>
              <p className="text-muted-foreground">Analyze with Gemini AI for sentiment and themes</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">3</div>
              <p className="text-muted-foreground">Generate actionable recommendations</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}