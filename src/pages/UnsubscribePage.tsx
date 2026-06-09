import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type UnsubscribeState = "idle" | "processing" | "success" | "error";

export default function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email");
  const [state, setState] = useState<UnsubscribeState>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!email) {
      setMessage("No email address provided. Use the link from your email to unsubscribe.");
    }
  }, [email]);

  const handleUnsubscribe = async () => {
    if (!email) return;
    setState("processing");

    try {
      const { error } = await supabase
        .from("email_logs")
        .update({ status: "unsubscribed" })
        .eq("recipient", email);

      if (error) {
        console.error("Failed to update email logs:", error);
      }

      await supabase.from("unsubscribed_emails").upsert(
        { email: email.toLowerCase(), unsubscribed_at: new Date().toISOString() },
        { onConflict: "email" }
      );

      setState("success");
      setMessage("You have been unsubscribed successfully.");
    } catch (err) {
      setState("error");
      setMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img
              src="https://www.appointpanda.com/logo.png"
              alt="AppointPanda"
              className="h-10"
            />
          </div>
          <CardTitle className="text-2xl">Unsubscribe</CardTitle>
          <CardDescription>
            {email
              ? `Manage email preferences for ${email}`
              : "Unable to process unsubscribe request"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {state === "idle" && email && (
            <>
              <p className="text-muted-foreground text-sm">
                You will stop receiving marketing and notification emails from AppointPanda.
                Transactional emails (appointment confirmations, password resets) may still be sent.
              </p>
              <Button onClick={handleUnsubscribe} variant="destructive" className="w-full">
                Unsubscribe
              </Button>
            </>
          )}

          {state === "processing" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Processing...</p>
            </div>
          )}

          {state === "success" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-green-600 dark:text-green-400 font-medium">{message}</p>
            </div>
          )}

          {state === "error" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <AlertCircle className="h-12 w-12 text-red-500" />
              <p className="text-red-600 dark:text-red-400 font-medium">{message}</p>
              <Button onClick={handleUnsubscribe} variant="outline" className="mt-2">
                Try Again
              </Button>
            </div>
          )}

          {!email && (
            <p className="text-muted-foreground text-sm">{message}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
