import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Sparkles, 
  ChevronDown, 
  ChevronUp,
  AlertTriangle,
  FileText,
  Heading1,
  Heading2,
  BookOpen,
  Target,
  Copy,
  Check,
  Lightbulb
} from 'lucide-react';

interface SeoIssueSectionProps {
  title: string;
  type: 'meta_title' | 'meta_description' | 'h1' | 'h2' | 'content';
  count: number;
  severity: 'critical' | 'high' | 'medium';
  description: string;
  googlePolicies: string[];
  bestPractices: string[];
  onFix: (customPrompt?: string) => void;
  disabled?: boolean;
}

const iconMap = {
  meta_title: Target,
  meta_description: FileText,
  h1: Heading1,
  h2: Heading2,
  content: BookOpen,
};

const severityColors = {
  critical: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    badge: 'bg-red-600 text-white',
    icon: 'text-red-600',
  },
  high: {
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-800',
    badge: 'bg-orange-600 text-white',
    icon: 'text-orange-600',
  },
  medium: {
    bg: 'bg-yellow-50 dark:bg-yellow-950/30',
    border: 'border-yellow-200 dark:border-yellow-800',
    badge: 'bg-yellow-600 text-white',
    icon: 'text-yellow-600',
  },
};

export function SeoIssueSection({
  title,
  type,
  count,
  severity,
  description,
  googlePolicies,
  bestPractices,
  onFix,
  disabled = false,
}: SeoIssueSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const Icon = iconMap[type];
  const colors = severityColors[severity];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleFix = () => {
    onFix(customPrompt.trim() || undefined);
  };

  if (count === 0) return null;

  return (
    <Card className={`${colors.bg} ${colors.border} border`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg bg-background flex items-center justify-center ${colors.icon}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {title}
                    <Badge className={colors.badge}>{severity}</Badge>
                  </CardTitle>
                  <CardDescription className="mt-1">{description}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold">{count}</span>
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Google SEO Policies */}
            <div className="rounded-lg bg-background p-4 space-y-3">
              <h4 className="font-semibold flex items-center gap-2 text-sm">
                <Target className="h-4 w-4 text-primary" />
                Google SEO Policies
              </h4>
              <ul className="space-y-2">
                {googlePolicies.map((policy, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-teal mt-0.5 flex-shrink-0" />
                    <span>{policy}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Best Practices */}
            <div className="rounded-lg bg-background p-4 space-y-3">
              <h4 className="font-semibold flex items-center gap-2 text-sm">
                <Lightbulb className="h-4 w-4 text-gold" />
                Best Practices for Optimization
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {bestPractices.map((practice, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 p-2 rounded-md bg-muted/50 text-sm group cursor-pointer hover:bg-muted"
                    onClick={() => handleCopy(practice, `practice-${idx}`)}
                  >
                    <span className="flex-1">{practice}</span>
                    {copied === `practice-${idx}` ? (
                      <Check className="h-4 w-4 text-teal flex-shrink-0" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Prompt Section */}
            <div className="space-y-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPrompt(!showPrompt)}
                className="w-full justify-between"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Add Custom Instructions (Optional)
                </span>
                {showPrompt ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>

              {showPrompt && (
                <Textarea
                  placeholder={`Tell the AI exactly what you want for ${title.toLowerCase()}. For example:\n\n"Include the city name at the beginning of each title"\n"Make descriptions more action-oriented with CTAs"\n"Focus on patient benefits rather than features"`}
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="min-h-[120px] text-sm"
                />
              )}
            </div>

            {/* Fix Button */}
            <div className="flex items-center justify-between pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                AI will fix all {count} pages following Google SEO policies
              </p>
              <Button onClick={handleFix} disabled={disabled}>
                <Sparkles className="h-4 w-4 mr-2" />
                Fix All {count} Pages
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// SEO policies and best practices data
export const SEO_ISSUE_CONFIG = {
  meta_title: {
    title: 'Missing Meta Titles',
    severity: 'critical' as const,
    description: 'Pages without meta titles display URLs in search results, dramatically reducing click-through rates.',
    googlePolicies: [
      'Each page must have a unique, descriptive title that accurately reflects page content',
      'Title tags should be under 60 characters to avoid truncation in search results',
      'Include primary keyword near the beginning of the title for better ranking signals',
      'Avoid keyword stuffing - titles should read naturally for users',
      'Brand name should typically appear at the end, separated by a pipe or dash',
    ],
    bestPractices: [
      'Format: [Primary Keyword] - [Secondary Info] | Brand',
      'Include location for local pages (e.g., "Dentist in Los Angeles")',
      'Use action words for service pages (Find, Get, Book)',
      'Keep titles unique across all pages - no duplicates',
      'Match user search intent in the title',
      'Capitalize first letter of each major word',
    ],
  },
  meta_description: {
    title: 'Missing Meta Descriptions',
    severity: 'high' as const,
    description: 'Pages without meta descriptions show random text snippets, reducing click-through rates by up to 30%.',
    googlePolicies: [
      'Meta descriptions should accurately summarize page content in 155 characters or less',
      'Each page needs a unique description - duplicates across pages hurt SEO',
      'Include primary and secondary keywords naturally within the description',
      'Write for users first, search engines second - focus on compelling copy',
      'Avoid using quotes or special characters that may get truncated',
    ],
    bestPractices: [
      'Start with an action verb (Discover, Find, Book, Learn)',
      'Include a clear value proposition or benefit',
      'Add a call-to-action (Schedule today, View our services)',
      'Include location for local SEO pages',
      'Mention what makes the service unique',
      'Use numbers when relevant (5-star rated, 20+ years experience)',
    ],
  },
  h1: {
    title: 'Missing H1 Headings',
    severity: 'high' as const,
    description: 'Every page must have exactly one H1 heading that tells search engines and users the main topic.',
    googlePolicies: [
      'Each page should have exactly ONE H1 heading - multiple H1s confuse crawlers',
      'H1 should match the page title topic but not be an exact duplicate',
      'H1 must be visible to users, not hidden with CSS',
      'The H1 should appear near the top of the main content area',
      'H1 should contain the primary target keyword naturally',
    ],
    bestPractices: [
      'Make H1 descriptive and specific to the page content',
      'Include location for local pages (e.g., "Best Dentists in Miami, FL")',
      'Keep H1 between 20-70 characters for optimal display',
      'Use proper heading hierarchy (H1 → H2 → H3)',
      'Make it compelling and benefit-focused for users',
      'Avoid generic H1s like "Welcome" or "Home"',
    ],
  },
  h2: {
    title: 'Missing H2 Structure',
    severity: 'medium' as const,
    description: 'Pages without proper H2 headings lack structure, making content harder to scan and reducing SEO value.',
    googlePolicies: [
      'Use H2 headings to organize content into logical sections',
      'H2s should follow a single H1 and precede H3 subheadings',
      'Each H2 should introduce a distinct subtopic of the main content',
      'Include relevant keywords in H2s where natural',
      'H2s help search engines understand content hierarchy',
    ],
    bestPractices: [
      'Use 3-6 H2 headings per page for optimal structure',
      'Include keywords naturally in H2s',
      'Make H2s descriptive of the section content',
      'Use questions as H2s for FAQ-style content',
      'Common H2s: About, Services, Location, FAQs, Contact',
      'Keep H2s concise but descriptive (5-10 words)',
    ],
  },
  content: {
    title: 'Thin or Missing Content',
    severity: 'critical' as const,
    description: 'Pages with less than 300 words are flagged as thin content by Google, potentially hurting rankings.',
    googlePolicies: [
      'Content must provide substantial value to users - avoid fluff or filler',
      'Each page should have at least 300-500 words of unique, helpful content',
      'Content must be original - do not duplicate from other pages or sites',
      'Include relevant information that matches user search intent',
      'Use proper formatting: headings, paragraphs, lists for readability',
    ],
    bestPractices: [
      'Include a compelling introduction (150+ words)',
      'Add service/treatment descriptions for dental pages',
      'Include location-specific information for local pages',
      'Add 3-5 frequently asked questions with detailed answers',
      'Use bullet points and lists for scannable content',
      'Include trust signals (experience, credentials, reviews)',
      'Add clear calls-to-action throughout',
      'Optimize for featured snippets with structured answers',
    ],
  },
};
