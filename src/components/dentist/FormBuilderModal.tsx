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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Plus,
  Trash2,
  GripVertical,
  Type,
  Mail,
  Phone,
  AlignLeft,
  CheckSquare,
  Circle,
  Calendar,
  Hash,
  Save,
  Loader2,
  FileText,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

interface FormBuilderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
}

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'textarea' | 'checkbox' | 'radio' | 'date' | 'number' | 'select';
  required: boolean;
  options?: string[];
  placeholder?: string;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Short Text', icon: Type },
  { value: 'textarea', label: 'Long Text', icon: AlignLeft },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'phone', label: 'Phone', icon: Phone },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'checkbox', label: 'Checkboxes', icon: CheckSquare },
  { value: 'radio', label: 'Multiple Choice', icon: Circle },
  { value: 'select', label: 'Dropdown', icon: FileText },
];

const FORM_TYPES = [
  { value: 'medical_history', label: 'Medical History' },
  { value: 'consent', label: 'Consent Form' },
  { value: 'insurance', label: 'Insurance Info' },
  { value: 'custom', label: 'Custom Form' },
];

export default function FormBuilderModal({ open, onOpenChange, clinicId }: FormBuilderModalProps) {
  const queryClient = useQueryClient();
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState('custom');
  const [fields, setFields] = useState<FormField[]>([]);
  const [showFieldTypeMenu, setShowFieldTypeMenu] = useState(false);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const addField = (type: FormField['type']) => {
    const newField: FormField = {
      id: generateId(),
      label: '',
      type,
      required: false,
      options: ['checkbox', 'radio', 'select'].includes(type) ? ['Option 1', 'Option 2'] : undefined,
      placeholder: '',
    };
    setFields([...fields, newField]);
    setShowFieldTypeMenu(false);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const addOption = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (field?.options) {
      updateField(fieldId, { options: [...field.options, `Option ${field.options.length + 1}`] });
    }
  };

  const updateOption = (fieldId: string, index: number, value: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (field?.options) {
      const newOptions = [...field.options];
      newOptions[index] = value;
      updateField(fieldId, { options: newOptions });
    }
  };

  const removeOption = (fieldId: string, index: number) => {
    const field = fields.find(f => f.id === fieldId);
    if (field?.options && field.options.length > 1) {
      const newOptions = field.options.filter((_, i) => i !== index);
      updateField(fieldId, { options: newOptions });
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!formName.trim()) throw new Error('Form name is required');
      if (fields.length === 0) throw new Error('Add at least one field');
      if (fields.some(f => !f.label.trim())) throw new Error('All fields must have a label');

      const { error } = await supabase
        .from('intake_form_templates')
        .insert([{
          clinic_id: clinicId,
          name: formName,
          description: formDescription,
          form_type: formType,
          fields: fields as any,
          is_active: true,
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Form template created');
      queryClient.invalidateQueries({ queryKey: ['intake-templates', clinicId] });
      onOpenChange(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create form');
    },
  });

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormType('custom');
    setFields([]);
  };

  const getFieldIcon = (type: string) => {
    const fieldType = FIELD_TYPES.find(f => f.value === type);
    return fieldType?.icon || Type;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Create Custom Form
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Build a custom intake form for your patients
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Form Settings */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white/80">Form Name *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., New Patient Intake"
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description of this form..."
                className="bg-slate-800 border-slate-600 text-white resize-none"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">Form Type</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {FORM_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value} className="text-white hover:bg-slate-700">
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Add Field Button */}
            <div className="relative">
              <Button
                variant="outline"
                onClick={() => setShowFieldTypeMenu(!showFieldTypeMenu)}
                className="w-full gap-2 bg-slate-800 border-slate-600 text-white hover:bg-slate-700 border-dashed"
              >
                <Plus className="h-4 w-4" />
                Add Field
              </Button>

              {showFieldTypeMenu && (
                <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-10 grid grid-cols-3 gap-2">
                  {FIELD_TYPES.map(type => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        onClick={() => addField(type.value as FormField['type'])}
                        className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-slate-700 transition-colors text-white/80 hover:text-white"
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-[10px]">{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Field Editor */}
          <div className="space-y-2">
            <Label className="text-white/80">Form Fields ({fields.length})</Label>
            <ScrollArea className="h-[350px] border border-slate-700 rounded-lg p-3 bg-slate-800/50">
              {fields.length === 0 ? (
                <div className="h-full flex items-center justify-center text-white/40 text-sm">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No fields yet</p>
                    <p className="text-xs mt-1">Click "Add Field" to start</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {fields.map((field, index) => {
                    const Icon = getFieldIcon(field.type);
                    return (
                      <div
                        key={field.id}
                        className="p-3 rounded-lg border border-slate-600 bg-slate-800 space-y-3"
                      >
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-white/30 cursor-move" />
                          <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                            <Icon className="h-3 w-3 mr-1" />
                            {FIELD_TYPES.find(t => t.value === field.type)?.label}
                          </Badge>
                          <div className="flex-1" />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-coral hover:text-coral hover:bg-coral/10"
                            onClick={() => removeField(field.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>

                        <Input
                          value={field.label}
                          onChange={(e) => updateField(field.id, { label: e.target.value })}
                          placeholder="Field label"
                          className="bg-slate-900 border-slate-600 text-white h-8 text-sm"
                        />

                        {!['checkbox', 'radio', 'select'].includes(field.type) && (
                          <Input
                            value={field.placeholder || ''}
                            onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                            placeholder="Placeholder text (optional)"
                            className="bg-slate-900 border-slate-600 text-white h-8 text-sm"
                          />
                        )}

                        {/* Options for checkbox/radio/select */}
                        {['checkbox', 'radio', 'select'].includes(field.type) && (
                          <div className="space-y-1">
                            <p className="text-xs text-white/50">Options:</p>
                            {field.options?.map((option, optIndex) => (
                              <div key={optIndex} className="flex items-center gap-2">
                                <Input
                                  value={option}
                                  onChange={(e) => updateOption(field.id, optIndex, e.target.value)}
                                  className="bg-slate-900 border-slate-600 text-white h-7 text-xs flex-1"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-white/40 hover:text-coral"
                                  onClick={() => removeOption(field.id, optIndex)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-primary hover:text-primary h-7"
                              onClick={() => addOption(field.id)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Option
                            </Button>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <Switch
                            checked={field.required}
                            onCheckedChange={(checked) => updateField(field.id, { required: checked })}
                            id={`required-${field.id}`}
                          />
                          <Label htmlFor={`required-${field.id}`} className="text-xs text-white/60">
                            Required field
                          </Label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 pt-4 border-t border-slate-700">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 bg-slate-800 border-slate-600 text-white hover:bg-slate-700"
          >
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex-1 bg-gradient-to-r from-primary to-teal hover:opacity-90"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Create Form
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
