import { repairTruncatedJson } from '@/lib/ai/parseAiJson';

export type FAQItem = { question: string; answer: string };

function normalizeFaq(item: any): FAQItem | null {
  if (!item || typeof item !== 'object') return null;
  const q =
    (typeof item.question === 'string' && item.question) ||
    (typeof item.q === 'string' && item.q) ||
    (typeof item.Question === 'string' && item.Question) ||
    '';
  const a =
    (typeof item.answer === 'string' && item.answer) ||
    (typeof item.a === 'string' && item.a) ||
    (typeof item.Answer === 'string' && item.Answer) ||
    '';

  const question = q.trim();
  const answer = a.trim();
  if (!question || !answer) return null;
  return { question, answer };
}

/**
 * Accepts the various shapes we may get back from the AI function:
 * - { faqs: [...] }
 * - [ ... ]
 * - { raw: "..." } containing JSON (optionally fenced / with preamble)
 */
export function parseFaqsFromAIResponse(data: unknown): FAQItem[] {
  // 1) Direct FAQ arrays
  const asAny = data as any;
  if (Array.isArray(asAny)) {
    return asAny.map(normalizeFaq).filter(Boolean) as FAQItem[];
  }
  if (asAny?.faqs && Array.isArray(asAny.faqs)) {
    return asAny.faqs.map(normalizeFaq).filter(Boolean) as FAQItem[];
  }

  // 2) Raw text that should contain JSON
  const raw = typeof asAny?.raw === 'string' ? asAny.raw : null;
  if (!raw) return [];

  const parsed = repairTruncatedJson(raw) as any;
  if (Array.isArray(parsed)) {
    return parsed.map(normalizeFaq).filter(Boolean) as FAQItem[];
  }
  if (parsed?.faqs && Array.isArray(parsed.faqs)) {
    return parsed.faqs.map(normalizeFaq).filter(Boolean) as FAQItem[];
  }

  return [];
}
