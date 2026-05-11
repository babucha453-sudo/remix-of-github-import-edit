import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Phone, User, MessageSquare, CheckCircle, Loader2 } from "lucide-react";

interface UnclaimedProfileLeadFormProps {
  clinicId: string;
  clinicName: string;
}

export function UnclaimedProfileLeadForm({ clinicId, clinicName }: UnclaimedProfileLeadFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      clinic_id: clinicId,
      name: formData.get("name") as string,
      phone: formData.get("phone") as string,
      email: formData.get("email") as string,
      message: formData.get("message") as string || null,
    };

    const { error: insertError } = await supabase
      .from("clinic_lead_requests")
      .insert(data);

    if (insertError) {
      setError("Something went wrong. Please try again.");
      setIsSubmitting(false);
      return;
    }

    setIsSuccess(true);
    setIsSubmitting(false);
  };

  if (isSuccess) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-6 text-center">
        <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="font-bold text-lg text-green-900 dark:text-green-100 mb-2">
          Great!
        </h3>
        <p className="text-green-700 dark:text-green-300 text-sm">
          We'll email you their contact info within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-primary/5 via-background to-gold/5 border border-primary/20 rounded-2xl p-6">
      <div className="text-center mb-6">
        <h3 className="font-display text-xl font-bold text-foreground mb-2">
          Get Contact Information
        </h3>
        <p className="text-muted-foreground text-sm">
          This clinic hasn't claimed their profile. Enter your details and we'll send you their contact info.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium">
            Name <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="name"
              name="name"
              required
              placeholder="Your full name"
              className="pl-10 rounded-xl"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-medium">
            Phone <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="phone"
              name="phone"
              type="tel"
              required
              placeholder="Your phone number"
              className="pl-10 rounded-xl"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">
            Email <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="your@email.com"
              className="pl-10 rounded-xl"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="message" className="text-sm font-medium">
            Message <span className="text-muted-foreground">(optional)</span>
          </Label>
          <div className="relative">
            <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Textarea
              id="message"
              name="message"
              placeholder="Any specific questions or notes..."
              className="pl-10 rounded-xl min-h-[80px]"
            />
          </div>
        </div>

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl font-bold"
          size="lg"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            "Send Me Their Info"
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          We respect your privacy. Your info won't be shared with third parties.
        </p>
      </form>
    </div>
  );
}