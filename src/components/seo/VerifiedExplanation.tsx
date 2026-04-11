import { BadgeCheck, Shield, Award, FileCheck, Building2 } from "lucide-react";
import { Link } from "react-router-dom";

interface VerifiedExplanationProps {
  className?: string;
}

export function VerifiedExplanation({ className = "" }: VerifiedExplanationProps) {
  const verificationLevels = [
    {
      icon: Building2,
      badge: "Listed",
      color: "text-muted-foreground",
      bgColor: "bg-muted",
      description: "Basic listing with public information sourced from official directories."
    },
    {
      icon: Shield,
      badge: "Claimed",
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      description: "Profile has been claimed by the dental professional or clinic management."
    },
    {
      icon: BadgeCheck,
      badge: "Verified",
      color: "text-primary",
      bgColor: "bg-primary/10",
      description: "Credentials verified, identity confirmed, and professional license validated."
    },
    {
      icon: Award,
      badge: "Premium",
      color: "text-gold",
      bgColor: "bg-gold/10",
      description: "Top-tier verification with enhanced profile features and priority placement."
    }
  ];

  return (
    <div className={`space-y-8 ${className}`}>
      <div className="text-center">
        <span className="inline-block text-xs font-bold text-emerald uppercase tracking-widest mb-2">Trust & Safety</span>
        <h2 className="text-2xl md:text-3xl font-black text-foreground mb-4">
          Understanding Our Verification System
        </h2>
        <p className="text-muted-foreground leading-relaxed max-w-2xl mx-auto">
          We maintain strict verification standards to ensure you can trust the dental professionals on our platform. 
          Here's what each verification level means for your safety and peace of mind.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {verificationLevels.map((level, i) => (
          <div key={i} className="flex flex-col items-center text-center gap-4 p-6 bg-card border border-border rounded-2xl hover:border-primary/30 transition-colors">
            <div className={`w-14 h-14 rounded-2xl ${level.bgColor} flex items-center justify-center`}>
              <level.icon className={`h-7 w-7 ${level.color}`} />
            </div>
            <div>
              <h3 className={`font-bold mb-2 ${level.color}`}>{level.badge}</h3>
              <p className="text-sm text-muted-foreground">{level.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-foreground/[0.03] border border-border rounded-2xl p-6 text-center max-w-2xl mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <FileCheck className="h-7 w-7 text-primary" />
        </div>
        <h3 className="font-bold text-foreground mb-3">Our Verification Process</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Every verified dentist on AppointPanda undergoes a thorough vetting process including license verification, 
          identity confirmation, and credential checks with the relevant health authorities (DHA, DOH, MOH).
        </p>
        <Link 
          to="/list-your-practice" 
          className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          Are you a dentist? Get verified →
        </Link>
      </div>
    </div>
  );
}

export default VerifiedExplanation;
