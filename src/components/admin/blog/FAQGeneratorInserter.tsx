import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { HelpCircle, Loader2, ChevronDown, ChevronUp, Plus, Trash2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { ContentBlock } from './BlogContentBlockEditor';
import { parseFaqsFromAIResponse } from '@/lib/blog/parseFaqsFromAI';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQGeneratorInserterProps {
  blocks: ContentBlock[];
  onInsert: (blocks: ContentBlock[], insertAfterIndex: number | null) => void;
  blogTitle?: string;
  blogContent?: string;
}

export default function FAQGeneratorInserter({ 
  blocks, 
  onInsert, 
  blogTitle = '', 
  blogContent = '' 
}: FAQGeneratorInserterProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [insertAfterIndex, setInsertAfterIndex] = useState<string>('end');
  const [faqCount, setFaqCount] = useState<string>('5');
  const [customTopic, setCustomTopic] = useState('');

  const handleGenerateFAQs = async () => {
    const topic = customTopic || blogTitle;
    if (!topic) {
      toast.error('Please enter a topic or add a blog title first');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('blog-ai-assistant', {
        body: {
          action: 'generate_faqs',
          title: topic,
          content: blogContent || topic, // Pass at least the topic if no content
          count: parseInt(faqCount),
        },
      });

      if (error) {
        console.error('FAQ generation error:', error);
        toast.error(error.message || 'Failed to generate FAQs');
        return;
      }

      // Robust parsing (handles markdown fences, preamble text, truncation, q/a field names)
      const parsedFaqs = parseFaqsFromAIResponse(data);

      if (parsedFaqs.length > 0) {
        setFaqs(parsedFaqs);
        toast.success(`Generated ${parsedFaqs.length} FAQs`);
      } else if ((data as any)?.error) {
        toast.error((data as any).error);
      } else {
        console.error('Unexpected FAQ response:', data);
        toast.error('Failed to parse FAQ from a response. Please try again.');
      }
    } catch (e: any) {
      console.error('FAQ generation error:', e);
      toast.error(e?.message || 'Failed to generate FAQs');
    } finally {
      setIsGenerating(false);
    }
  };

  const updateFAQ = (index: number, field: 'question' | 'answer', value: string) => {
    setFaqs(prev => prev.map((faq, i) => 
      i === index ? { ...faq, [field]: value } : faq
    ));
  };

  const removeFAQ = (index: number) => {
    setFaqs(prev => prev.filter((_, i) => i !== index));
  };

  const addEmptyFAQ = () => {
    setFaqs(prev => [...prev, { question: '', answer: '' }]);
  };

  const handleInsert = () => {
    if (faqs.length === 0) {
      toast.error('No FAQs to insert');
      return;
    }

    // Filter out empty FAQs
    const validFaqs = faqs.filter(f => f.question.trim() && f.answer.trim());
    if (validFaqs.length === 0) {
      toast.error('All FAQs are empty');
      return;
    }

    // Create a single FAQ list block that will be rendered as accordion
    const faqBlock: ContentBlock = {
      id: Math.random().toString(36).substring(2, 11),
      type: 'faq-list',
      faqs: validFaqs,
      headingText: 'Frequently Asked Questions',
    };

    const insertIndex = insertAfterIndex === 'end' 
      ? null 
      : insertAfterIndex === 'start' 
        ? -1 
        : parseInt(insertAfterIndex);

    onInsert([faqBlock], insertIndex);
    toast.success(`Inserted ${validFaqs.length} FAQs`);
    
    // Reset
    setFaqs([]);
    setIsExpanded(false);
  };

  // Get block labels for position selector
  const blockOptions = blocks.map((block, index) => ({
    value: index.toString(),
    label: block.type === 'heading' 
      ? `${block.headingLevel?.toUpperCase()}: ${block.headingText?.slice(0, 40) || 'Untitled'}${(block.headingText?.length || 0) > 40 ? '...' : ''}`
      : block.type === 'dentist-list'
        ? `Dentist List: ${block.locationLabel}`
        : block.type === 'faq-list'
          ? `FAQ Section (${block.faqs?.length || 0} items)`
          : `Image: ${block.imageAlt?.slice(0, 30) || 'No alt'}`,
  }));

  return (
    <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-purple-500/5">
      <CardHeader className="p-4 pb-2">
        <button 
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between"
        >
          <CardTitle className="text-sm flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-violet-500" />
            AI FAQ Generator
          </CardTitle>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        <p className="text-xs text-muted-foreground mt-1">
          Generate FAQs using AI (renders as dropdown accordion)
        </p>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="p-4 pt-2 space-y-4">
          {/* Topic Input */}
          <div className="space-y-2">
            <Label className="text-xs">Topic (optional - uses blog title by default)</Label>
            <Input
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder={blogTitle || 'Enter topic for FAQs...'}
              className="h-9"
            />
          </div>

          {/* FAQ Count & Position */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Number of FAQs</Label>
              <Select value={faqCount} onValueChange={setFaqCount}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 FAQs</SelectItem>
                  <SelectItem value="5">5 FAQs</SelectItem>
                  <SelectItem value="7">7 FAQs</SelectItem>
                  <SelectItem value="10">10 FAQs</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Insert Position</Label>
              <Select value={insertAfterIndex} onValueChange={setInsertAfterIndex}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="start">At Beginning</SelectItem>
                  {blockOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      After: {opt.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="end">At End</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Generate Button */}
          <Button
            type="button"
            variant="outline"
            onClick={handleGenerateFAQs}
            disabled={isGenerating || (!customTopic && !blogTitle)}
            className="w-full"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {isGenerating ? 'Generating...' : 'Generate FAQs with AI'}
          </Button>
          
          {!customTopic && !blogTitle && (
            <p className="text-xs text-amber-600 text-center">
              ⚠️ Please add a blog title or enter a custom topic above
            </p>
          )}

          {/* FAQs Preview & Edit */}
          {faqs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-2">
                  Generated FAQs
                  <Badge variant="secondary" className="text-[10px]">{faqs.length}</Badge>
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addEmptyFAQ}
                  className="h-7 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add FAQ
                </Button>
              </div>
              
              <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
                {faqs.map((faq, index) => (
                  <div 
                    key={index} 
                    className="p-3 rounded-lg border bg-background/50 space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-600 shrink-0 mt-1">
                        {index + 1}
                      </span>
                      <div className="flex-1 space-y-2">
                        <Input
                          value={faq.question}
                          onChange={(e) => updateFAQ(index, 'question', e.target.value)}
                          placeholder="Question..."
                          className="h-8 text-sm font-medium"
                        />
                        <Textarea
                          value={faq.answer}
                          onChange={(e) => updateFAQ(index, 'answer', e.target.value)}
                          placeholder="Answer..."
                          rows={2}
                          className="text-xs"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFAQ(index)}
                        className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Insert Button */}
              <Button
                type="button"
                onClick={handleInsert}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Insert {faqs.length} FAQs {insertAfterIndex === 'end' ? 'at End' : insertAfterIndex === 'start' ? 'at Beginning' : `after Block ${parseInt(insertAfterIndex) + 1}`}
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
