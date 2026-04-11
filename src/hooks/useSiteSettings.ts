import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ContactDetails {
  support_email?: string;
  booking_email?: string;
  sales_email?: string;
  partnerships_email?: string;
  support_phone?: string;
  booking_phone?: string;
  sales_phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
}

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  youtube?: string;
  tiktok?: string;
}

export interface FooterLink {
  label: string;
  path: string;
  external?: boolean;
}

export interface FooterSection {
  title: string;
  links: FooterLink[];
}

export interface Branding {
  logo_url?: string;
  logo_dark_url?: string;
  favicon_url?: string;
}

export interface SiteSettings {
  siteName: string;
  siteUrl: string;
  siteTagline: string;
  contactDetails: ContactDetails;
  socialLinks: SocialLinks;
  footerSections: FooterSection[];
  legalText: string;
  copyrightText: string;
  branding: Branding;
}

// Default settings are only used when database values are not available
// These should match the values stored in global_settings table
const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: 'AppointPanda',
  siteUrl: 'https://www.appointpanda.com/',
  siteTagline: 'US Dental Directory',
  contactDetails: {
    support_email: 'support@appointpanda.com',
    booking_email: 'bookings@appointpanda.com',
    sales_email: 'sales@appointpanda.com',
    partnerships_email: 'partners@appointpanda.com',
    support_phone: '+1 833-887-2632',
    booking_phone: '+1 833-887-2632',
    sales_phone: '+1 833-887-2632',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'United States',
  },
  socialLinks: {
    facebook: 'https://facebook.com/appointpanda',
    instagram: 'https://instagram.com/appointpanda',
    twitter: 'https://twitter.com/appointpanda',
    linkedin: 'https://linkedin.com/company/appointpanda',
    youtube: '',
    tiktok: '',
  },
  footerSections: [],
  legalText: 'Licensed Dental Professionals Only.',
  copyrightText: '© 2026 AppointPanda. All rights reserved by Quick Commerce LLC.',
  branding: {
    logo_url: '',
    logo_dark_url: '',
    favicon_url: '',
  },
};

/**
 * Hook to fetch site-wide settings for header/footer/contact info
 * This data is cached and available across the entire site
 */
export function useSiteSettings() {
  return useQuery({
    queryKey: ['site-settings'],
    queryFn: async (): Promise<SiteSettings> => {
      // Fetch multiple settings keys in parallel
      const { data, error } = await supabase
        .from('global_settings')
        .select('key, value')
        .in('key', ['platform', 'contact_details', 'social_links', 'footer_config', 'legal', 'header_nav', 'branding']);

      if (error) {
        console.error('Error fetching site settings:', error);
        return DEFAULT_SITE_SETTINGS;
      }

      // Parse settings into a map
      const settingsMap: Record<string, Record<string, unknown>> = {};
      data?.forEach(s => {
        settingsMap[s.key] = s.value as Record<string, unknown>;
      });

      // Build site settings from database values with fallbacks
      // IMPORTANT: Database values take priority over defaults
      const platform = settingsMap['platform'] || {};
      const contacts = settingsMap['contact_details'] || {};
      const social = settingsMap['social_links'] || {};
      const footerConfig = settingsMap['footer_config'] || {};
      const legal = settingsMap['legal'] || {};
      const branding = settingsMap['branding'] || {};

      return {
        siteName: (platform.site_name as string) || DEFAULT_SITE_SETTINGS.siteName,
        siteUrl: (platform.site_url as string) || DEFAULT_SITE_SETTINGS.siteUrl,
        siteTagline: (platform.tagline as string) || DEFAULT_SITE_SETTINGS.siteTagline,
        contactDetails: {
          // Prioritize contact_details table values over platform defaults
          support_email: (contacts.support_email as string) || (platform.support_email as string) || DEFAULT_SITE_SETTINGS.contactDetails.support_email,
          booking_email: (contacts.booking_email as string) || '',
          sales_email: (contacts.sales_email as string) || '',
          partnerships_email: (contacts.partnerships_email as string) || '',
          support_phone: (contacts.support_phone as string) || DEFAULT_SITE_SETTINGS.contactDetails.support_phone,
          booking_phone: (contacts.booking_phone as string) || '',
          sales_phone: (contacts.sales_phone as string) || '',
          address_line1: (contacts.address_line1 as string) || '',
          address_line2: (contacts.address_line2 as string) || '',
          city: (contacts.city as string) || '',
          state: (contacts.state as string) || '',
          zip_code: (contacts.zip_code as string) || '',
          country: (contacts.country as string) || 'United States',
        },
        socialLinks: {
          facebook: (social.facebook as string) || '',
          instagram: (social.instagram as string) || '',
          twitter: (social.twitter as string) || '',
          linkedin: (social.linkedin as string) || '',
          youtube: (social.youtube as string) || '',
          tiktok: (social.tiktok as string) || '',
        },
        footerSections: (footerConfig.sections as FooterSection[]) || [],
        // Legal text from database takes priority
        legalText: (legal.footer_text as string) || DEFAULT_SITE_SETTINGS.legalText,
        copyrightText: (legal.copyright_text as string) || DEFAULT_SITE_SETTINGS.copyrightText,
        // Branding - logo and favicon from settings
        branding: {
          logo_url: (branding.logo_url as string) || '',
          logo_dark_url: (branding.logo_dark_url as string) || '',
          favicon_url: (branding.favicon_url as string) || '',
        },
      };
    },
    staleTime: 0, // Always consider data stale to force refetch
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchInterval: 30 * 1000, // Refetch every 30 seconds in background
  });
}
