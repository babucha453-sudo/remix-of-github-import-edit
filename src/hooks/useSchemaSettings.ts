import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OrganizationSettings {
  name: string;
  url: string;
  logo: string;
  description: string;
  email: string;
  phone: string;
  address: {
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry: string;
  };
  socialProfiles: string[];
  foundingDate: string;
  founders: string[];
}

export interface SitewideSettings {
  defaultRating: number;
  enableBreadcrumbs: boolean;
  enableFAQSchema: boolean;
  enableReviewSchema: boolean;
  enableLocalBusinessSchema: boolean;
}

export interface SchemaSettings {
  organization: OrganizationSettings;
  sitewide: SitewideSettings;
}

// Default settings as fallback
const defaultOrganization: OrganizationSettings = {
  name: 'AppointPanda',
  url: 'https://www.appointpanda.com',
  logo: 'https://www.appointpanda.com/logo.png',
  description: 'Find and book appointments with top-rated dental professionals across the United States.',
  email: '',
  phone: '',
  address: {
    streetAddress: '',
    addressLocality: '',
    addressRegion: '',
    postalCode: '',
    addressCountry: 'US',
  },
  socialProfiles: [],
  foundingDate: '',
  founders: [],
};

const defaultSitewide: SitewideSettings = {
  defaultRating: 4.5,
  enableBreadcrumbs: true,
  enableFAQSchema: true,
  enableReviewSchema: true,
  enableLocalBusinessSchema: true,
};

export function useSchemaSettings() {
  return useQuery({
    queryKey: ['schema-settings-public'],
    queryFn: async (): Promise<SchemaSettings> => {
      const { data, error } = await supabase
        .from('schema_settings')
        .select('setting_key, setting_value');
      
      if (error) {
        console.warn('Failed to load schema settings, using defaults:', error);
        return {
          organization: defaultOrganization,
          sitewide: defaultSitewide,
        };
      }
      
      const settings: Record<string, any> = {};
      data?.forEach(row => {
        settings[row.setting_key] = row.setting_value;
      });
      
      return {
        organization: settings.organization || defaultOrganization,
        sitewide: settings.sitewide || defaultSitewide,
      };
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

// For SSR/static generation, provide defaults
export function getDefaultSchemaSettings(): SchemaSettings {
  return {
    organization: defaultOrganization,
    sitewide: defaultSitewide,
  };
}
