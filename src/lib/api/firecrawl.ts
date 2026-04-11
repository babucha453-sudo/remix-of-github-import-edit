import { supabase } from '@/integrations/supabase/client';

type FirecrawlResponse<T = any> = {
  success: boolean;
  error?: string;
  data?: T;
};

type ScrapeOptions = {
  formats?: ('markdown' | 'html' | 'rawHtml' | 'links' | 'screenshot')[];
  onlyMainContent?: boolean;
  waitFor?: number;
};

type MapOptions = {
  search?: string;
  limit?: number;
  includeSubdomains?: boolean;
};

export const firecrawlApi = {
  // Scrape a single URL
  async scrape(url: string, options?: ScrapeOptions): Promise<FirecrawlResponse> {
    const { data, error } = await supabase.functions.invoke('firecrawl-scrape', {
      body: { url, options },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },

  // Map a website to discover all URLs (fast sitemap)
  async map(url: string, options?: MapOptions): Promise<FirecrawlResponse> {
    const { data, error } = await supabase.functions.invoke('firecrawl-map', {
      body: { url, options },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },

  // Extract emails from scraped content
  extractEmails(content: string): string[] {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = content.match(emailRegex) || [];
    
    // Filter out common non-business emails
    const filtered = matches.filter((email: string) => {
      const lower = email.toLowerCase();
      // Skip image files, example emails, etc
      if (lower.includes('.png') || lower.includes('.jpg') || lower.includes('.gif')) return false;
      if (lower.includes('example.com') || lower.includes('test.com')) return false;
      if (lower.includes('sentry.io') || lower.includes('wixpress.com')) return false;
      return true;
    });
    
    // Remove duplicates and return
    return [...new Set(filtered)];
  },

  // Prioritize business emails over generic ones
  prioritizeEmails(emails: string[]): string[] {
    const priority: { [key: string]: number } = {
      'contact': 1,
      'info': 2,
      'hello': 3,
      'appointments': 4,
      'booking': 5,
      'office': 6,
      'front': 7,
      'reception': 8,
      'admin': 9,
      'support': 10,
      'noreply': 99,
      'no-reply': 99,
      'donotreply': 99,
    };

    return emails.sort((a, b) => {
      const aPrefix = a.split('@')[0].toLowerCase();
      const bPrefix = b.split('@')[0].toLowerCase();
      
      let aPriority = 50; // default
      let bPriority = 50;
      
      for (const [key, val] of Object.entries(priority)) {
        if (aPrefix.includes(key)) aPriority = Math.min(aPriority, val);
        if (bPrefix.includes(key)) bPriority = Math.min(bPriority, val);
      }
      
      return aPriority - bPriority;
    });
  },
};
