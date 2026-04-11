import { Shield } from "lucide-react";

interface InsuranceFAQProps {
  insuranceName: string;
}

const faqs = [
  {
    q: "How do I verify my {insurance} coverage?",
    a: "Contact your insurance provider directly or ask the clinic's front desk to verify your coverage before your appointment. Most clinics can check your benefits in real-time.",
  },
  {
    q: "What is direct billing?",
    a: "Direct billing means the clinic bills your insurance company directly, so you don't have to pay upfront for covered services. You only pay your copay or deductible at the time of service.",
  },
  {
    q: "Do I need pre-approval for dental procedures?",
    a: "Some procedures like crowns, bridges, or orthodontics may require pre-approval. Ask your dentist to submit a pre-authorization request before scheduling major work.",
  },
  {
    q: "What if my dentist isn't in-network?",
    a: "You can still see out-of-network dentists, but you may pay more. Check with your insurance about out-of-network benefits and reimbursement rates.",
  },
  {
    q: "How often can I get preventive care?",
    a: "Most {insurance} plans cover two cleanings and exams per year at 100%. Some plans also cover fluoride treatments and sealants for children.",
  },
];

export function InsuranceFAQ({ insuranceName }: InsuranceFAQProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">Frequently Asked Questions</h2>
      </div>
      
      <div className="space-y-4">
        {faqs.map((faq, index) => (
          <details
            key={index}
            className="group rounded-xl border border-border bg-card overflow-hidden"
          >
            <summary className="flex cursor-pointer items-center justify-between p-4 font-medium hover:bg-muted/50 transition-colors">
              <span>{faq.q.replace("{insurance}", insuranceName)}</span>
              <span className="ml-4 shrink-0 text-muted-foreground group-open:rotate-180 transition-transform">
                ▾
              </span>
            </summary>
            <div className="px-4 pb-4 text-sm text-muted-foreground">
              {faq.a.replace("{insurance}", insuranceName)}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
