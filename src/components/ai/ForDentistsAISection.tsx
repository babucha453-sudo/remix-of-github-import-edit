import { Sparkles, Target, Users, TrendingUp, Zap, BarChart3, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface ForDentistsAISectionProps {
  className?: string;
  variant?: "full" | "compact";
}

const benefits = [
  {
    icon: Target,
    title: "Right Patients, Not Random Traffic",
    description: "AI matches patients with clinics based on services, budget, and location — bringing you qualified leads who are ready to book.",
  },
  {
    icon: Users,
    title: "Better Patient Fit",
    description: "Patients who match your services, accept your pricing, and prefer your availability. Less back-and-forth, more confirmed appointments.",
  },
  {
    icon: TrendingUp,
    title: "Smarter Visibility",
    description: "Your profile appears to patients actively searching for what you offer. No wasted impressions on unqualified viewers.",
  },
  {
    icon: Zap,
    title: "Automated Efficiency",
    description: "AI handles initial patient matching, freeing your staff to focus on care delivery instead of qualifying leads.",
  },
];

export const ForDentistsAISection = ({ className, variant = "full" }: ForDentistsAISectionProps) => {
  if (variant === "compact") {
    return (
      <div className={cn("bg-card border border-border rounded-2xl p-6", className)}>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <h3 className="font-bold text-foreground">AI-Powered Patient Matching</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          AI helps bring the right patients — not random traffic. Patients who match your services, budget, and availability. Less back-and-forth. Better conversions.
        </p>
        <Button asChild size="sm" className="rounded-xl font-bold">
          <Link to="/list-your-practice">Learn More</Link>
        </Button>
      </div>
    );
  }

  return (
    <section className={cn("py-20 bg-slate-950 relative overflow-hidden", className)}>
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 right-[10%] w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-[5%] w-48 h-48 bg-emerald/10 rounded-full blur-3xl" />
      </div>

      <div className="container relative z-10">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/20 border border-primary/30 rounded-full px-4 py-2 mb-4">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-primary">For Dental Practices</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              AI That Works <span className="text-primary">For You</span>
            </h2>
            <p className="text-white/60 max-w-2xl mx-auto">
              Our AI doesn't just help patients — it helps your practice grow by connecting you with the right patients who are ready to book.
            </p>
          </div>

          {/* Benefits Grid */}
          <div className="grid sm:grid-cols-2 gap-6 mb-10">
            {benefits.map((benefit, i) => (
              <div
                key={i}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-primary/30 transition-all"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4">
                  <benefit.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-bold text-white mb-2">{benefit.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center">
            <Button asChild size="lg" className="rounded-2xl font-bold px-8">
              <Link to="/list-your-practice">
                List Your Practice
                <Sparkles className="h-4 w-4 ml-2" />
              </Link>
            </Button>
            <p className="mt-4 text-white/40 text-sm">
              No technical terms. No AI jargon. Just better patient connections.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
