import { useState, ClipboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown, ImageIcon, Loader2, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface ContentBlock {
  id: string;
  type: 'heading' | 'image' | 'dentist-list' | 'faq-list';
  headingLevel?: 'h1' | 'h2' | 'h3';
  headingText?: string;
  content?: string;
  imageUrl?: string;
  imageAlt?: string;
  // For dentist-list blocks
  clinicIds?: string[];
  locationLabel?: string;
  // For faq-list blocks
  faqs?: Array<{ question: string; answer: string }>;
}

interface BlogContentBlockEditorProps {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  blogTitle?: string;
}

// Utility: Handle paste to preserve links from HTML content
function handlePasteWithLinks(
  e: ClipboardEvent<HTMLTextAreaElement>,
  currentValue: string,
  onUpdate: (newValue: string) => void
) {
  const html = e.clipboardData?.getData('text/html');
  const plainText = e.clipboardData?.getData('text/plain') || '';
  
  // If no HTML or no anchor tags, let default behavior handle it
  if (!html || !html.includes('<a')) {
    return; // Let default paste happen
  }
  
  e.preventDefault();
  
  // Parse HTML and convert links to markdown format
  const doc = new DOMParser().parseFromString(html, 'text/html');
  
  // Process all anchor tags
  doc.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href')?.trim();
    const text = (anchor.textContent || href || '').trim();
    if (href && text) {
      // Replace anchor with markdown link
      const markdownLink = `[${text}](${href})`;
      anchor.replaceWith(doc.createTextNode(markdownLink));
    }
  });
  
  // Get the processed text
  const processedText = doc.body.textContent || plainText;
  
  // Insert at cursor position
  const textarea = e.currentTarget;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const newValue = currentValue.substring(0, start) + processedText + currentValue.substring(end);
  
  onUpdate(newValue);
  
  // Show toast to confirm links were preserved
  const linkCount = (processedText.match(/\[.*?\]\(.*?\)/g) || []).length;
  if (linkCount > 0) {
    toast.success(`Pasted content with ${linkCount} link${linkCount > 1 ? 's' : ''} preserved`);
  }
}

function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

// Insert Link Dialog Component
function InsertLinkDialog({ 
  selectedText,
  onInsertLink,
  onClearSelection
}: { 
  selectedText: string;
  onInsertLink: (linkText: string, url: string) => void;
  onClearSelection: () => void;
}) {
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [open, setOpen] = useState(false);
  
  // When dialog opens with selected text, pre-fill the link text
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && selectedText) {
      setLinkText(selectedText);
    }
    if (!isOpen) {
      setLinkText('');
      setLinkUrl('');
      onClearSelection();
    }
    setOpen(isOpen);
  };
  
  const handleInsert = () => {
    if (!linkText || !linkUrl) {
      toast.error('Please fill in both text and URL');
      return;
    }
    onInsertLink(linkText, linkUrl);
    setLinkText('');
    setLinkUrl('');
    setOpen(false);
    toast.success('Link inserted');
  };
  
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          type="button" 
          variant={selectedText ? "default" : "ghost"} 
          size="sm" 
          className={selectedText ? "h-6 px-2 text-xs bg-primary text-primary-foreground" : "h-6 px-2 text-xs"}
        >
          <LinkIcon className="h-3 w-3 mr-1" />
          {selectedText ? `Link "${selectedText.slice(0, 15)}${selectedText.length > 15 ? '...' : ''}"` : 'Insert Link'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Insert Link</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Link Text (Anchor Text)</Label>
            <Input
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              placeholder="e.g., Best dentist in Boston"
            />
            <p className="text-xs text-muted-foreground">
              This text will be clickable and displayed to users
            </p>
          </div>
          <div className="space-y-2">
            <Label>URL</Label>
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="e.g., /ma/boston or https://..."
            />
            <p className="text-xs text-muted-foreground">
              Use relative paths like /state/city for internal links
            </p>
          </div>
          <Button onClick={handleInsert} className="w-full">
            Insert Anchor Link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function BlogContentBlockEditor({ blocks, onChange, blogTitle }: BlogContentBlockEditorProps) {
  const [generatingImageFor, setGeneratingImageFor] = useState<string | null>(null);
  const [selectedTexts, setSelectedTexts] = useState<Record<string, string>>({});
  const [selectionRanges, setSelectionRanges] = useState<Record<string, { start: number; end: number }>>({});

  const addBlock = (type: 'heading' | 'image') => {
    const newBlock: ContentBlock = {
      id: generateId(),
      type,
      ...(type === 'heading' && { headingLevel: 'h2', headingText: '', content: '' }),
      ...(type === 'image' && { imageUrl: '', imageAlt: '' }),
    };
    onChange([...blocks, newBlock]);
  };

  const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  const removeBlock = (id: string) => {
    onChange(blocks.filter((b) => b.id !== id));
  };

  const moveBlock = (id: string, direction: 'up' | 'down') => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    const newBlocks = [...blocks];
    [newBlocks[idx], newBlocks[newIdx]] = [newBlocks[newIdx], newBlocks[idx]];
    onChange(newBlocks);
  };

  const handleGenerateImage = async (blockId: string, contextText?: string) => {
    const prompt = contextText || blogTitle || 'dental healthcare';
    setGeneratingImageFor(blockId);
    try {
      const { data, error } = await supabase.functions.invoke('blog-ai-assistant', {
        body: { action: 'generate_image', title: prompt },
      });
      if (error) throw error;
      if (data?.imageUrl) {
        updateBlock(blockId, { imageUrl: data.imageUrl });
        toast.success('Image generated');
      } else {
        toast.error('Failed to generate image');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Image generation failed');
    } finally {
      setGeneratingImageFor(null);
    }
  };
  
  const handleTextSelection = (blockId: string, textarea: HTMLTextAreaElement) => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end).trim();
    
    if (selected && start !== end) {
      setSelectedTexts(prev => ({ ...prev, [blockId]: selected }));
      setSelectionRanges(prev => ({ ...prev, [blockId]: { start, end } }));
    } else {
      setSelectedTexts(prev => ({ ...prev, [blockId]: '' }));
      setSelectionRanges(prev => ({ ...prev, [blockId]: { start: 0, end: 0 } }));
    }
  };
  
  const clearSelection = (blockId: string) => {
    setSelectedTexts(prev => ({ ...prev, [blockId]: '' }));
    setSelectionRanges(prev => ({ ...prev, [blockId]: { start: 0, end: 0 } }));
  };
  
  const handleInsertLinkInContent = (blockId: string, linkText: string, url: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    
    const markdownLink = `[${linkText}](${url})`;
    const range = selectionRanges[blockId];
    const content = block.content || '';
    
    // If we have a selection range and the selected text matches, replace it
    if (range && range.start !== range.end && selectedTexts[blockId] === linkText) {
      const newContent = content.substring(0, range.start) + markdownLink + content.substring(range.end);
      updateBlock(blockId, { content: newContent });
    } else {
      // Otherwise append at the end
      const newContent = content + (content ? ' ' : '') + markdownLink;
      updateBlock(blockId, { content: newContent });
    }
    
    clearSelection(blockId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Button type="button" variant="outline" size="sm" onClick={() => addBlock('heading')}>
          <Plus className="h-4 w-4 mr-1" />
          Add Heading + Content
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => addBlock('image')}>
          <ImageIcon className="h-4 w-4 mr-1" />
          Add Image
        </Button>
      </div>

      {blocks.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-8 border rounded-md border-dashed">
          No content blocks yet. Click above to add headings or images.
        </p>
      )}

      {blocks.map((block, idx) => (
        <Card key={block.id} className="relative group">
          <CardHeader className="p-3 flex flex-row items-center justify-between gap-2 bg-muted/30">
            <div className="flex items-center gap-2 text-sm font-medium">
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
              {block.type === 'heading' && `${block.headingLevel?.toUpperCase() || 'H2'} Block`}
              {block.type === 'image' && 'Image Block'}
              {block.type === 'dentist-list' && `Dentist List (${block.clinicIds?.length || 0} clinics)`}
              {block.type === 'faq-list' && `FAQ Section (${block.faqs?.length || 0} items)`}
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => moveBlock(block.id, 'up')}
                disabled={idx === 0}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => moveBlock(block.id, 'down')}
                disabled={idx === blocks.length - 1}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => removeBlock(block.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {block.type === 'heading' && (
              <>
                <div className="flex gap-3">
                  <div className="w-28">
                    <Label className="text-xs text-muted-foreground">Level</Label>
                    <Select
                      value={block.headingLevel || 'h2'}
                      onValueChange={(v) => updateBlock(block.id, { headingLevel: v as 'h1' | 'h2' | 'h3' })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="h1">H1</SelectItem>
                        <SelectItem value="h2">H2</SelectItem>
                        <SelectItem value="h3">H3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Heading Text</Label>
                    <Input
                      value={block.headingText || ''}
                      onChange={(e) => updateBlock(block.id, { headingText: e.target.value })}
                      placeholder="Enter heading..."
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs text-muted-foreground">Content / Description</Label>
                    <div className="flex items-center gap-2">
                      <InsertLinkDialog 
                        selectedText={selectedTexts[block.id] || ''}
                        onInsertLink={(text, url) => handleInsertLinkInContent(block.id, text, url)}
                        onClearSelection={() => clearSelection(block.id)}
                      />
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <LinkIcon className="h-3 w-3" />
                        Select text + click to link
                      </span>
                    </div>
                  </div>
                  <Textarea
                    value={block.content || ''}
                    onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                    onSelect={(e) => handleTextSelection(block.id, e.currentTarget)}
                    onPaste={(e) => handlePasteWithLinks(e, block.content || '', (newVal) => updateBlock(block.id, { content: newVal }))}
                    placeholder="Write content here. Select any text and click 'Insert Link' to add an anchor link."
                    rows={6}
                    className="mt-1 font-mono text-sm"
                  />
                </div>
              </>
            )}

            {block.type === 'image' && (
              <>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Image URL</Label>
                    <Input
                      value={block.imageUrl || ''}
                      onChange={(e) => updateBlock(block.id, { imageUrl: e.target.value })}
                      placeholder="https://..."
                      className="mt-1"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerateImage(block.id, blogTitle)}
                    disabled={generatingImageFor === block.id}
                  >
                    {generatingImageFor === block.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <ImageIcon className="h-4 w-4 mr-1" />
                    )}
                    Generate
                  </Button>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Alt Text</Label>
                  <Input
                    value={block.imageAlt || ''}
                    onChange={(e) => updateBlock(block.id, { imageAlt: e.target.value })}
                    placeholder="Describe the image..."
                    className="mt-1"
                  />
                </div>
                {block.imageUrl && (
                  <div className="mt-2 rounded-md overflow-hidden border max-w-xs">
                    <img
                      src={block.imageUrl}
                      alt={block.imageAlt || 'preview'}
                      className="w-full h-32 object-cover"
                      onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                    />
                  </div>
                )}
              </>
            )}
            
            {block.type === 'dentist-list' && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                <p className="text-sm font-medium text-emerald-600 mb-2">
                  📍 Dentist List: {block.locationLabel}
                </p>
                <p className="text-xs text-muted-foreground">
                  {block.clinicIds?.length || 0} clinics will be dynamically displayed with booking buttons
                </p>
              </div>
            )}
            
            {block.type === 'faq-list' && (
              <div className="bg-violet-500/10 border border-violet-500/30 rounded-lg p-4">
                <p className="text-sm font-medium text-violet-600 mb-2">
                  ❓ FAQ Section
                </p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {block.faqs?.slice(0, 3).map((faq, i) => (
                    <li key={i} className="truncate">• {faq.question}</li>
                  ))}
                  {(block.faqs?.length || 0) > 3 && (
                    <li className="text-muted-foreground/70">+ {(block.faqs?.length || 0) - 3} more</li>
                  )}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Utility: Convert blocks to Markdown string (for storage)
export function blocksToMarkdown(blocks: ContentBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === 'heading') {
        const prefix = b.headingLevel === 'h1' ? '# ' : b.headingLevel === 'h3' ? '### ' : '## ';
        return `${prefix}${b.headingText || ''}\n\n${b.content || ''}`;
      }
      if (b.type === 'image') {
        return `![${b.imageAlt || 'image'}](${b.imageUrl || ''})`;
      }
      if (b.type === 'dentist-list') {
        // Store as a special marker that can be parsed on render
        return `<!-- DENTIST_LIST:${JSON.stringify({ clinicIds: b.clinicIds, locationLabel: b.locationLabel })} -->`;
      }
      if (b.type === 'faq-list') {
        // Store FAQs as a special marker
        return `<!-- FAQ_LIST:${JSON.stringify({ faqs: b.faqs })} -->`;
      }
      return '';
    })
    .join('\n\n');
}

// Utility: Parse Markdown string into blocks (best effort)
export function markdownToBlocks(md: string): ContentBlock[] {
  if (!md?.trim()) return [];
  const lines = md.split('\n');
  const blocks: ContentBlock[] = [];
  let currentBlock: ContentBlock | null = null;

  const flushBlock = () => {
    if (currentBlock) {
      if (currentBlock.type === 'heading') {
        currentBlock.content = (currentBlock.content || '').trim();
      }
      blocks.push(currentBlock);
      currentBlock = null;
    }
  };

  for (const line of lines) {
    // Check for special markers first
    const dentistListMatch = line.match(/<!-- DENTIST_LIST:(.+?) -->/);
    const faqListMatch = line.match(/<!-- FAQ_LIST:(.+?) -->/);
    
    if (dentistListMatch) {
      flushBlock();
      try {
        const data = JSON.parse(dentistListMatch[1]);
        blocks.push({
          id: generateId(),
          type: 'dentist-list',
          clinicIds: data.clinicIds,
          locationLabel: data.locationLabel,
        });
      } catch { /* ignore parse errors */ }
      continue;
    }
    
    if (faqListMatch) {
      flushBlock();
      try {
        const data = JSON.parse(faqListMatch[1]);
        blocks.push({
          id: generateId(),
          type: 'faq-list',
          faqs: data.faqs,
        });
      } catch { /* ignore parse errors */ }
      continue;
    }
    
    const h1 = line.match(/^#\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    const h3 = line.match(/^###\s+(.*)$/);
    const img = line.match(/^!\[(.*?)\]\((.*?)\)$/);

    if (h1 || h2 || h3) {
      flushBlock();
      currentBlock = {
        id: generateId(),
        type: 'heading',
        headingLevel: h1 ? 'h1' : h3 ? 'h3' : 'h2',
        headingText: (h1 || h2 || h3)![1],
        content: '',
      };
    } else if (img) {
      flushBlock();
      blocks.push({
        id: generateId(),
        type: 'image',
        imageAlt: img[1],
        imageUrl: img[2],
      });
    } else if (currentBlock && currentBlock.type === 'heading') {
      currentBlock.content = ((currentBlock.content || '') + '\n' + line).trimStart();
    } else if (line.trim()) {
      // Orphan content before first heading – create implicit h2
      flushBlock();
      currentBlock = {
        id: generateId(),
        type: 'heading',
        headingLevel: 'h2',
        headingText: '',
        content: line,
      };
    }
  }
  flushBlock();
  return blocks;
}
