import { useState } from "react";
import { Check, Mail, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmailCaptureProps {
  headline: string;
  subtext: string;
  className?: string;
}

export const EmailCapture = ({ headline, subtext, className }: EmailCaptureProps) => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("newsletter_signups")
        .insert([{ email }]);

      if (error) {
        if (error.code === "23505") {
          setErrorMessage("You're already subscribed!");
          setStatus("error");
        } else {
          setErrorMessage("Something went wrong. Please try again.");
          setStatus("error");
        }
        return;
      }

      setStatus("success");
      setEmail("");
    } catch (err) {
      setErrorMessage("Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className={cn("bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-8 text-center", className)}>
        <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-4">
          <Check className="h-8 w-8 text-white" />
        </div>
        <h3 className="font-bold text-xl text-gray-900 mb-2">You're In!</h3>
        <p className="text-gray-600">Thanks for subscribing. Check your inbox for confirmation.</p>
      </div>
    );
  }

  return (
    <div className={cn("bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 rounded-2xl p-8 text-white", className)}>
      <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-4">
        <Mail className="h-6 w-6 text-white" />
      </div>
      <h3 className="font-bold text-2xl mb-2 text-center">{headline}</h3>
      <p className="text-emerald-100 text-center mb-6">{subtext}</p>
      
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status === "error") setStatus("idle");
            }}
            placeholder="Enter your email"
            className="flex-1 h-12 px-4 rounded-xl bg-white/90 text-gray-900 placeholder:text-gray-500 border-0 focus:ring-2 focus:ring-emerald-300 focus:outline-none"
            required
          />
          <Button
            type="submit"
            disabled={status === "loading"}
            className="h-12 bg-white text-emerald-600 hover:bg-emerald-50 font-bold rounded-xl px-6"
          >
            {status === "loading" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              "Subscribe"
            )}
          </Button>
        </div>
        
        {status === "error" && (
          <p className="text-amber-200 text-sm text-center">{errorMessage}</p>
        )}
      </form>
    </div>
  );
};
