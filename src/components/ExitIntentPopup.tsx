import { useState } from 'react';
import { X, Sparkles, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useExitIntent } from '@/hooks/useExitIntent';

interface ExitIntentPopupProps {
  enabled?: boolean;
  className?: string;
}

export function ExitIntentPopup({ enabled = true, className }: ExitIntentPopupProps) {
  const { shouldShow, dismiss } = useExitIntent({ enabled });
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      setIsSubmitted(true);
      dismiss();
    } catch {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={shouldShow} onOpenChange={(open) => !open && dismiss()}>
      <DialogContent className={cn('sm:max-w-md p-0 overflow-hidden', className)}>
        <button
          onClick={dismiss}
          className="absolute right-3 top-3 rounded-full p-1.5 opacity-70 hover:opacity-100 hover:bg-emerald-100 transition-all z-10"
          aria-label="Close"
        >
          <X className="h-4 w-4 text-emerald-700" />
        </button>

        <div className="relative bg-gradient-to-b from-emerald-50 to-white p-6 pt-8">
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500" />

          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                <Gift className="h-8 w-8 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-amber-400 flex items-center justify-center animate-bounce">
                <Sparkles className="h-3 w-3 text-white" />
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-display font-bold text-center text-gray-900 mb-2">
            Wait! Before You Go...
          </h2>

          <p className="text-center text-gray-600 mb-6">
            Get <span className="font-bold text-emerald-600">10% off</span> your first booking with any AppointPanda dentist
          </p>

          {isSubmitted ? (
            <div className="text-center py-4">
              <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="font-semibold text-emerald-700">Check your inbox!</p>
              <p className="text-sm text-gray-500">Your 10% discount code is on its way.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500"
                required
              />
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/25 transition-all"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Sending...
                  </span>
                ) : (
                  'Send Me My Code'
                )}
              </Button>
            </form>
          )}

          <button
            onClick={dismiss}
            className="mt-4 text-sm text-gray-400 hover:text-gray-600 transition-colors w-full text-center"
          >
            No thanks, continue browsing
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { useExitIntent } from '@/hooks/useExitIntent';
export type { UseExitIntentOptions } from '@/hooks/useExitIntent';