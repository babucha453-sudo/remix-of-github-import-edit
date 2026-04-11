import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface MedicalDisclaimerProps {
  variant?: "inline" | "card" | "banner";
  className?: string;
}

export const MedicalDisclaimer = ({ 
  variant = "inline",
  className 
}: MedicalDisclaimerProps) => {
  const content = {
    title: "Medical Disclaimer",
    text: "The information provided on this website is for general informational purposes only and does not constitute medical advice. Always consult with a qualified healthcare professional before making any decisions about your dental health. Treatment outcomes may vary based on individual circumstances. All dental professionals listed are independently licensed and regulated by the Dubai Health Authority (DHA)."
  };

  if (variant === "banner") {
    return (
      <div className={cn(
        "bg-amber-50 dark:bg-amber-950/20 border-y border-amber-200 dark:border-amber-900/30 py-3",
        className
      )}>
        <div className="container">
          <div className="flex items-start gap-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-amber-800 dark:text-amber-200">
              <strong className="font-semibold">Medical Disclaimer:</strong> {content.text}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <Alert className={cn("border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/30", className)}>
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-800 dark:text-amber-200 font-bold">
          {content.title}
        </AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm mt-2">
          {content.text}
        </AlertDescription>
      </Alert>
    );
  }

  // Inline variant (default)
  return (
    <div className={cn(
      "text-xs text-muted-foreground border-t border-border pt-4 mt-6",
      className
    )}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <p>
          <strong className="font-semibold">Disclaimer:</strong> {content.text}
        </p>
      </div>
    </div>
  );
};

export default MedicalDisclaimer;
