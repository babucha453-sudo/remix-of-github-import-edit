import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  Star,
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Target,
} from 'lucide-react';

export interface ReputationKPIs {
  reputationScore: number;
  avgRating: number;
  reviewVelocity: number;
  positiveRatio: number;
  negativeRisk: number;
  responseRate: number;
  avgResponseTime: number;
  totalResponses: number;
  thumbsUp: number;
  thumbsDown: number;
  googleReviewCount: number;
  pendingReplies: number;
}

interface ReputationKPIHeroProps {
  kpis: ReputationKPIs;
  clinicName?: string;
  isPlatformView?: boolean;
}

export default function ReputationKPIHero({ kpis, clinicName, isPlatformView }: ReputationKPIHeroProps) {
  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Work';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500 text-white';
    if (score >= 60) return 'bg-primary text-white';
    if (score >= 40) return 'bg-amber-500 text-white';
    return 'bg-coral text-white';
  };

  return (
    <div className="space-y-3">
      {/* Main KPI Row - Compact */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Reputation Score */}
        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-lg bg-primary/20 flex items-center justify-center">
                <Activity className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-xs font-medium text-white/70">
                {isPlatformView ? 'Platform Health' : 'Score'}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <div 
                className="h-14 w-14 rounded-full flex items-center justify-center"
                style={{
                  background: `conic-gradient(hsl(172 66% 50%) ${kpis.reputationScore}%, hsl(215 25% 27%) ${kpis.reputationScore}%)`
                }}
              >
                <div className="h-10 w-10 rounded-full bg-slate-900 flex items-center justify-center">
                  <span className="text-lg font-bold">{kpis.reputationScore}</span>
                </div>
              </div>
              
              <div>
                <Badge className={`${getScoreColor(kpis.reputationScore)} border-0 text-[10px]`}>
                  {getScoreLabel(kpis.reputationScore)}
                </Badge>
                {clinicName && (
                  <p className="text-[10px] text-white/50 mt-1 truncate max-w-[80px]">{clinicName}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Average Rating */}
        <Card className="bg-white border border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
              </div>
              <span className="text-xs font-medium text-slate-500">Rating</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{kpis.avgRating.toFixed(1)}</p>
            <div className="flex gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} className={`h-3 w-3 ${i <= kpis.avgRating ? 'text-amber-500 fill-amber-500' : 'text-slate-200'}`} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Review Velocity */}
        <Card className="bg-white border border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-xs font-medium text-slate-500">Velocity</span>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-slate-800">{kpis.reviewVelocity >= 0 ? '+' : ''}{kpis.reviewVelocity}</p>
              {kpis.reviewVelocity >= 0 ? (
                <ArrowUpRight className="h-4 w-4 text-emerald-500" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-coral" />
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">vs last 30 days</p>
          </CardContent>
        </Card>

        {/* Positive Ratio */}
        <Card className="bg-white border border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                <ThumbsUp className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <span className="text-xs font-medium text-slate-500">Positive</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{Math.round(kpis.positiveRatio * 100)}%</p>
            <Progress value={kpis.positiveRatio * 100} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Secondary KPI Row - More Compact */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {/* Response Rate */}
        <Card className="bg-slate-50 border-slate-100">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-medium text-slate-500">Response</span>
            </div>
            <p className="text-lg font-bold text-slate-800">{Math.round(kpis.responseRate * 100)}%</p>
            <p className="text-[9px] text-slate-400">~{kpis.avgResponseTime.toFixed(1)}h avg</p>
          </CardContent>
        </Card>

        {/* Negative Risk */}
        <Card className="bg-slate-50 border-slate-100">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-coral" />
              <span className="text-[10px] font-medium text-slate-500">Risk</span>
            </div>
            <p className="text-lg font-bold text-slate-800">{kpis.negativeRisk}</p>
            <p className="text-[9px] text-slate-400">Low ratings</p>
          </CardContent>
        </Card>

        {/* Google Reviews */}
        <Card className="bg-slate-50 border-slate-100">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-[10px] font-medium text-slate-500">Google</span>
            </div>
            <p className="text-lg font-bold text-slate-800">{kpis.googleReviewCount}</p>
            <p className="text-[9px] text-slate-400">Reviews</p>
          </CardContent>
        </Card>

        {/* Thumbs Up */}
        <Card className="bg-slate-50 border-slate-100">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <ThumbsUp className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[10px] font-medium text-slate-500">Happy</span>
            </div>
            <p className="text-lg font-bold text-slate-800">{kpis.thumbsUp}</p>
            <p className="text-[9px] text-slate-400">→ Google</p>
          </CardContent>
        </Card>

        {/* Thumbs Down */}
        <Card className="bg-slate-50 border-slate-100">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <ThumbsDown className="h-3.5 w-3.5 text-coral" />
              <span className="text-[10px] font-medium text-slate-500">Private</span>
            </div>
            <p className="text-lg font-bold text-slate-800">{kpis.thumbsDown}</p>
            <p className="text-[9px] text-slate-400">Captured</p>
          </CardContent>
        </Card>

        {/* Pending Replies */}
        <Card className="bg-slate-50 border-slate-100">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[10px] font-medium text-slate-500">Pending</span>
            </div>
            <p className="text-lg font-bold text-slate-800">{kpis.pendingReplies}</p>
            <p className="text-[9px] text-slate-400">Needs reply</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
