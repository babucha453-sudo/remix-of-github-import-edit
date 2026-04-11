import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface FAQItem {
  question: string;
  answer: string;
}

interface BlogFAQListProps {
  faqs: FAQItem[];
  headingText?: string;
}

export function BlogFAQList({ faqs, headingText }: BlogFAQListProps) {
  if (!faqs?.length) return null;

  const title = headingText || 'Frequently Asked Questions';

  return (
    <div className="my-8 not-prose">
      <h2 className="text-2xl font-bold mb-6">{title}</h2>
      <Accordion type="single" collapsible className="space-y-3">
        {faqs.map((faq, index) => (
          <AccordionItem
            key={index}
            value={`faq-${index}`}
            className="bg-card border border-border rounded-xl px-4 data-[state=open]:bg-muted/30"
          >
            <AccordionTrigger className="text-left font-semibold hover:no-underline py-4">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground pb-4 leading-relaxed">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
