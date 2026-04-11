import { Sparkles, Target, MapPin, DollarSign, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIExplainerSectionProps {
  className?: string;
  variant?: "default" | "compact";
}

const explainerItems = [
  {
    icon: Brain,
    title: "Understands Your Needs",
    description: "Describe what you're looking for in plain language — treatment, budget, insurance, urgency.",
  },
  {
    icon: Target,
    title: "Matches Intelligently",
    description: "Our AI analyzes your requirements against verified dentist profiles to find the best fit.",
  },
  {
    icon: MapPin,
    title: "Location-Aware",
    description: "Finds specialists near you with availability that matches your schedule.",
  },
  {
    icon: DollarSign,
    title: "Budget-Conscious",
    description: "Filters results based on your budget preferences — no surprises, just transparency.",
  },
];

export const AIExplainerSection = ({ className, variant = "default" }: AIExplainerSectionProps) => {
  if (variant === "compact") {
    return (
      <div className={cn("bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-6", className)}>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <h3 className="font-bold text-foreground">How AI Search Works</h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Simply describe what you need — treatment type, budget, location, or insurance. Our AI understands your request and matches you with the best-fit dentists from our verified network.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("py-16 bg-muted/30", className)}>
      <div className="container">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 rounded-full px-4 py-2 mb-4">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-primary">AI-Powered</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-foreground mb-3">
              How AppointPanda <span className="text-primary">Finds Your Match</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              This isn't a directory. It's a smarter way to find the right dentist — powered by AI that understands what you actually need.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {explainerItems.map((item, i) => (
              <div
                key={i}
                className="group bg-card border border-border rounded-2xl p-6 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-bold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          {/* Trust Note */}
          <div className="mt-10 text-center">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold">Transparency promise:</span> AI assists matching — dentists control their profiles. Pricing and availability are set by clinics.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
