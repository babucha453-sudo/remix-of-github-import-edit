import { CheckCircle, BadgeCheck, Star, Shield, Clock, Users } from "lucide-react";

interface HowToChooseDentistProps {
  locationName?: string;
  className?: string;
}

export function HowToChooseDentist({ locationName, className = "" }: HowToChooseDentistProps) {
  const location = locationName || "your area";

  const tips = [
    {
      icon: BadgeCheck,
      title: "Check Credentials",
      description: `Verify that the dentist is licensed by the relevant health authority. In ${location}, look for DHA, DOH, or MOH licensing.`
    },
    {
      icon: Star,
      title: "Read Patient Reviews",
      description: "Authentic patient reviews give you insight into the dentist's chairside manner, wait times, and treatment quality."
    },
    {
      icon: Shield,
      title: "Look for Verified Profiles",
      description: "Dentists with 'Verified' badges have completed our additional verification process for your peace of mind."
    },
    {
      icon: Users,
      title: "Consider Specializations",
      description: "If you need specific treatment, choose a dentist who specializes in that area for optimal results."
    },
    {
      icon: Clock,
      title: "Check Availability",
      description: "Consider location, operating hours, and appointment availability that fits your schedule."
    }
  ];

  return (
    <div className={`space-y-8 ${className}`}>
      <div className="text-center">
        <span className="inline-block text-xs font-bold text-primary uppercase tracking-widest mb-2">Expert Tips</span>
        <h2 className="text-2xl md:text-3xl font-black text-foreground mb-4">
          How to Choose the Right Dentist{locationName ? ` in ${locationName}` : ''}
        </h2>
        <p className="text-muted-foreground leading-relaxed max-w-2xl mx-auto">
          Finding the right dentist is an important decision for your oral health. 
          Here are key factors to consider when choosing a dental professional{locationName ? ` in ${locationName}` : ''}.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tips.map((tip, i) => (
          <div key={i} className="flex flex-col items-center text-center gap-4 p-6 bg-card border border-border rounded-2xl hover:border-primary/30 transition-colors">
            <div className="w-14 h-14 rounded-2xl bg-emerald-light flex items-center justify-center">
              <tip.icon className="h-7 w-7 text-emerald" />
            </div>
            <div>
              <h3 className="font-bold text-foreground mb-2">{tip.title}</h3>
              <p className="text-sm text-muted-foreground">{tip.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default HowToChooseDentist;
