import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SEOHead } from "@/components/seo/SEOHead";
import { toast } from "sonner";
import {
  CheckCircle,
  FileText,
  Heart,
  Shield,
  CreditCard,
  ClipboardList,
  AlertCircle,
} from "lucide-react";

interface FormField {
  id: string;
  name: string;
  type: "text" | "textarea" | "select" | "checkbox" | "radio" | "date";
  label: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

const FORM_TYPE_ICONS: Record<string, any> = {
  medical_history: Heart,
  consent: Shield,
  insurance: CreditCard,
  custom: ClipboardList,
};

export default function PatientFormPage() {
  const { submissionId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Fetch submission details through backend function (public access)
  const { data: submission, isLoading, error } = useQuery({
    queryKey: ["patient-form-submission", submissionId, token],
    queryFn: async () => {
      if (!submissionId) return null;

      const { data, error } = await supabase.functions.invoke('patient-form', {
        body: {
          mode: 'get',
          submissionId,
          token,
        },
      });

      if (error) throw error;
      return (data as any)?.submission ?? null;
    },
    enabled: !!submissionId,
  });

  // Check if already completed and pre-fill form data
  useEffect(() => {
    if (submission?.status === "completed" || submission?.submitted_at) {
      setIsSubmitted(true);
    }
    // Pre-fill with any existing form data
    if (submission?.form_data && typeof submission.form_data === 'object') {
      setFormData(submission.form_data as Record<string, any>);
    }
  }, [submission]);

  // Submit form mutation
  const submitMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      if (!submissionId) throw new Error('Missing submissionId');

      const { error } = await supabase.functions.invoke('patient-form', {
        body: {
          mode: 'submit',
          submissionId,
          token,
          formData: data,
        },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setIsSubmitted(true);
      toast.success("Form submitted successfully!");
    },
    onError: (error) => {
      toast.error("Failed to submit form. Please try again.");
      console.error("Form submission error:", error);
    },
  });

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    const fields = (submission?.template as any)?.fields || [];
    const missingFields = fields.filter(
      (f: FormField) => f.required && !formData[f.id]
    );
    
    if (missingFields.length > 0) {
      toast.error(`Please fill in all required fields`);
      return;
    }
    
    submitMutation.mutate(formData);
  };

  const renderField = (field: FormField) => {
    switch (field.type) {
      case "text":
        return (
          <Input
            id={field.id}
            placeholder={field.placeholder}
            value={formData[field.id] || ""}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className="rounded-xl"
          />
        );
      case "textarea":
        return (
          <Textarea
            id={field.id}
            placeholder={field.placeholder}
            value={formData[field.id] || ""}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className="rounded-xl"
            rows={4}
          />
        );
      case "date":
        return (
          <Input
            id={field.id}
            type="date"
            value={formData[field.id] || ""}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className="rounded-xl"
          />
        );
      case "checkbox":
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.id}
              checked={formData[field.id] || false}
              onCheckedChange={(checked) => handleFieldChange(field.id, checked)}
            />
            <Label htmlFor={field.id} className="text-sm">
              {field.label}
            </Label>
          </div>
        );
      case "radio":
        return (
          <RadioGroup
            value={formData[field.id] || ""}
            onValueChange={(value) => handleFieldChange(field.id, value)}
          >
            {field.options?.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${field.id}-${option}`} />
                <Label htmlFor={`${field.id}-${option}`}>{option}</Label>
              </div>
            ))}
          </RadioGroup>
        );
      case "select":
        return (
          <select
            id={field.id}
            value={formData[field.id] || ""}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className="w-full rounded-xl border border-border p-3 bg-background"
          >
            <option value="">Select...</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <PageLayout>
        <Section>
          <div className="max-w-2xl mx-auto">
            <Skeleton className="h-12 w-3/4 mb-4" />
            <Skeleton className="h-6 w-1/2 mb-8" />
            <Skeleton className="h-96" />
          </div>
        </Section>
      </PageLayout>
    );
  }

  if (error || !submission) {
    return (
      <PageLayout>
        <Section>
          <div className="max-w-2xl mx-auto text-center py-20">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Form Not Found</h1>
            <p className="text-muted-foreground">
              This form link may be expired or invalid.
            </p>
          </div>
        </Section>
      </PageLayout>
    );
  }

  const template = submission.template as any;
  const clinic = submission.clinic as any;
  const FormIcon = FORM_TYPE_ICONS[template?.form_type] || FileText;
  const fields: FormField[] = template?.fields || [];

  if (isSubmitted) {
    return (
      <PageLayout>
        <SEOHead
          title="Form Submitted"
          description="Your form has been submitted successfully"
          noindex
        />
        <Section>
          <div className="max-w-2xl mx-auto text-center py-20">
            <div className="h-20 w-20 rounded-full bg-teal/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-10 w-10 text-teal" />
            </div>
            <h1 className="text-3xl font-bold mb-4">Form Submitted!</h1>
            <p className="text-lg text-muted-foreground mb-8">
              Thank you for completing your {template?.name || "intake form"}.
              <br />
              <span className="font-medium text-foreground">{clinic?.name}</span> has received your information.
            </p>
            <Card className="card-modern max-w-md mx-auto">
              <CardContent className="p-6">
                <h3 className="font-bold mb-2">What happens next?</h3>
                <ul className="text-sm text-muted-foreground space-y-2 text-left">
                  <li>• The clinic will review your information</li>
                  <li>• You may receive a confirmation email</li>
                  <li>• Arrive 10-15 minutes early for your appointment</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </Section>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <SEOHead
        title={`${template?.name || "Patient Form"} - ${clinic?.name || "Dental Clinic"}`}
        description={template?.description || "Complete your patient intake form"}
        noindex
      />
      
      <Section className="py-8 md:py-12">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <FormIcon className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              {template?.name || "Patient Intake Form"}
            </h1>
            <p className="text-muted-foreground">
              {clinic?.name && (
                <span className="font-medium text-foreground">{clinic.name}</span>
              )}
              {template?.description && (
                <span className="block mt-1">{template.description}</span>
              )}
            </p>
          </div>

          {/* Form */}
          <Card className="card-modern">
            <CardContent className="p-6 md:p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {fields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    {field.type !== "checkbox" && (
                      <Label htmlFor={field.id} className="font-medium">
                        {field.label}
                        {field.required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                    )}
                    {renderField(field)}
                  </div>
                ))}

                <div className="pt-4 border-t">
                  <Button
                    type="submit"
                    className="w-full rounded-xl h-12 font-bold"
                    disabled={submitMutation.isPending}
                  >
                    {submitMutation.isPending ? "Submitting..." : "Submit Form"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <p className="text-xs text-center text-muted-foreground mt-6">
            Your information is secure and encrypted. By submitting this form, you agree to share your health information with {clinic?.name || "the dental clinic"}.
          </p>
        </div>
      </Section>
    </PageLayout>
  );
}