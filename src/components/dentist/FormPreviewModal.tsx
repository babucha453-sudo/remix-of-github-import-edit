import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Eye, FileText } from 'lucide-react';

interface FormPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: {
    id: string;
    name: string;
    description: string | null;
    form_type: string;
    fields: any[];
  } | null;
}

export function FormPreviewModal({
  open,
  onOpenChange,
  template,
}: FormPreviewModalProps) {
  if (!template) return null;

  const fields = Array.isArray(template.fields) ? template.fields : [];

  const renderField = (field: any, index: number) => {
    const isRequired = field.required;

    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'number':
        return (
          <div key={field.name || index} className="space-y-2">
            <Label className="flex items-center gap-1">
              {field.label}
              {isRequired && <span className="text-destructive">*</span>}
            </Label>
            <Input
              type={field.type}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              disabled
              className="bg-muted/30"
            />
          </div>
        );

      case 'textarea':
        return (
          <div key={field.name || index} className="space-y-2">
            <Label className="flex items-center gap-1">
              {field.label}
              {isRequired && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              disabled
              className="bg-muted/30"
              rows={3}
            />
          </div>
        );

      case 'date':
        return (
          <div key={field.name || index} className="space-y-2">
            <Label className="flex items-center gap-1">
              {field.label}
              {isRequired && <span className="text-destructive">*</span>}
            </Label>
            <Input
              type="date"
              disabled
              className="bg-muted/30"
            />
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.name || index} className="flex items-center gap-2">
            <Checkbox disabled />
            <Label className="font-normal cursor-not-allowed text-muted-foreground">
              {field.label}
              {isRequired && <span className="text-destructive ml-1">*</span>}
            </Label>
          </div>
        );

      case 'radio':
        return (
          <div key={field.name || index} className="space-y-2">
            <Label className="flex items-center gap-1">
              {field.label}
              {isRequired && <span className="text-destructive">*</span>}
            </Label>
            <RadioGroup disabled className="flex flex-col gap-2">
              {(field.options || []).map((option: string, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <RadioGroupItem value={option} disabled />
                  <Label className="font-normal cursor-not-allowed text-muted-foreground">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case 'select':
        return (
          <div key={field.name || index} className="space-y-2">
            <Label className="flex items-center gap-1">
              {field.label}
              {isRequired && <span className="text-destructive">*</span>}
            </Label>
            <Select disabled>
              <SelectTrigger className="bg-muted/30">
                <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {(field.options || []).map((option: string, i: number) => (
                  <SelectItem key={i} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      default:
        return (
          <div key={field.name || index} className="space-y-2">
            <Label>{field.label}</Label>
            <Input disabled className="bg-muted/30" placeholder="Unknown field type" />
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Form Preview
          </DialogTitle>
          <DialogDescription>
            This is how patients will see the form
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/30 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <div>
              <h3 className="font-semibold">{template.name}</h3>
              {template.description && (
                <p className="text-sm text-muted-foreground">{template.description}</p>
              )}
            </div>
          </div>
          <div className="mt-2">
            <Badge variant="secondary">{fields.length} fields</Badge>
          </div>
        </div>

        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-6">
            {fields.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No fields defined for this form</p>
              </div>
            ) : (
              fields.map((field, index) => renderField(field, index))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
