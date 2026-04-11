// Centralized branding configuration for all edge functions
// This ensures consistent branding across all email templates and communications

export interface SiteBranding {
  siteName: string;
  domain: string;
  siteUrl: string;
  logoUrl: string;
  logoDarkUrl: string;
  faviconUrl: string;
  supportEmail: string;
  fromEmail: string;
  fromName: string;
  primaryColor: string;
  copyrightText: string;
}

// Default branding configuration - using local domain paths for SEO (Google indexes domain URLs)
// IMPORTANT: All assets use www.appointpanda.com domain URLs to ensure Google indexes the correct favicon
const DEFAULT_BRANDING: SiteBranding = {
  siteName: 'AppointPanda',
  domain: 'appointpanda.com',
  siteUrl: 'https://www.appointpanda.com',
  logoUrl: 'https://www.appointpanda.com/logo.png',
  logoDarkUrl: 'https://www.appointpanda.com/logo-dark.png',
  // Favicon with cache-busting version to force Google re-indexing
  faviconUrl: 'https://www.appointpanda.com/favicon.png?v=5',
  supportEmail: 'support@appointpanda.com',
  fromEmail: 'no-reply@appointpanda.com',
  fromName: 'Appoint Panda',
  primaryColor: '#0d9488',
  copyrightText: `© ${new Date().getFullYear()} AppointPanda. All rights reserved.`,
};

/**
 * Fetches branding configuration from database
 * Falls back to defaults if not configured
 */
export async function getBranding(supabase: any): Promise<SiteBranding> {
  try {
    // Fetch branding settings from global_settings
    const { data: brandingData } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', 'branding')
      .single();

    // Fetch email settings
    const { data: emailData } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', 'email')
      .single();

    const branding = brandingData?.value || {};
    const email = emailData?.value || {};

    return {
      siteName: DEFAULT_BRANDING.siteName,
      domain: DEFAULT_BRANDING.domain,
      siteUrl: Deno.env.get('SITE_URL') || DEFAULT_BRANDING.siteUrl,
      logoUrl: branding.logo_url || DEFAULT_BRANDING.logoUrl,
      logoDarkUrl: branding.logo_dark_url || branding.logo_url || DEFAULT_BRANDING.logoDarkUrl,
      faviconUrl: branding.favicon_url || DEFAULT_BRANDING.faviconUrl,
      supportEmail: email.support_email || DEFAULT_BRANDING.supportEmail,
      fromEmail: email.from_email || DEFAULT_BRANDING.fromEmail,
      fromName: email.from_name || DEFAULT_BRANDING.fromName,
      primaryColor: branding.primary_color || DEFAULT_BRANDING.primaryColor,
      copyrightText: DEFAULT_BRANDING.copyrightText,
    };
  } catch (error) {
    console.error('Error fetching branding:', error);
    return DEFAULT_BRANDING;
  }
}

/**
 * Generates standard email header HTML with branding
 */
export function generateEmailHeader(branding: SiteBranding, title: string, emoji: string = '🐼'): string {
  return `
    <tr>
      <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 40px 32px; text-align: center; border-radius: 16px 16px 0 0;">
        ${branding.logoUrl ? `<img src="${branding.logoUrl}" alt="${branding.siteName}" style="max-height: 50px; margin-bottom: 16px;">` : `<h1 style="margin: 0 0 8px; font-size: 28px; font-weight: 700; color: #ffffff;">${emoji} ${branding.siteName}</h1>`}
        <div style="color: rgba(255,255,255,0.9); font-size: 16px;">${title}</div>
      </td>
    </tr>
  `;
}

/**
 * Generates standard email footer HTML with branding
 */
export function generateEmailFooter(branding: SiteBranding): string {
  return `
    <tr>
      <td style="background-color: #1e293b; border-radius: 0 0 16px 16px; padding: 28px 32px; text-align: center;">
        <p style="color: #94a3b8; font-size: 13px; margin: 0 0 8px 0;">
          Need help? Contact us at <a href="mailto:${branding.supportEmail}" style="color: #14b8a6; text-decoration: none;">${branding.supportEmail}</a>
        </p>
        <p style="color: #64748b; font-size: 12px; margin: 0;">
          ${branding.copyrightText}
        </p>
        <p style="color: #475569; font-size: 11px; margin: 8px 0 0 0;">
          <a href="${branding.siteUrl}" style="color: #475569; text-decoration: none;">${branding.domain}</a>
        </p>
      </td>
    </tr>
  `;
}

/**
 * Generates the full email wrapper with consistent styling
 */
export function wrapEmailContent(branding: SiteBranding, headerTitle: string, headerEmoji: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <title>${headerTitle}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; -webkit-font-smoothing: antialiased;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
          ${generateEmailHeader(branding, headerTitle, headerEmoji)}
          <tr>
            <td style="background-color: #ffffff; padding: 40px 32px;">
              ${bodyContent}
            </td>
          </tr>
          ${generateEmailFooter(branding)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Gets the "from" address for emails
 */
export function getFromAddress(branding: SiteBranding): string {
  return `${branding.fromName} <${branding.fromEmail}>`;
}
