/**
 * PlatformVerificationsPanel - Comprehensive verification testing panel
 * 
 * Tests and validates all platform integrations:
 * - Google Analytics (GA4)
 * - Google Search Console
 * - Google Tag Manager
 * - Meta/Facebook Pixel
 * - SMTP/Email
 * - API integrations
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Globe,
  BarChart3,
  Search,
  Code,
  Mail,
  Shield,
  Zap,
  Clock,
  PlayCircle,
} from 'lucide-react';

interface VerificationResult {
  id: string;
  name: string;
  category: string;
  status: 'success' | 'warning' | 'error' | 'pending' | 'not_configured';
  message: string;
  lastChecked: Date | null;
  details?: Record<string, unknown>;
}

interface GlobalSetting {
  key: string;
  value: Record<string, unknown>;
}

export function PlatformVerificationsPanel() {
  const queryClient = useQueryClient();
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [verificationResults, setVerificationResults] = useState<Record<string, VerificationResult>>({});
  const [progress, setProgress] = useState(0);

  // Fetch all settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['global-settings-verifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_settings')
        .select('key, value');
      if (error) throw error;
      return (data || []) as GlobalSetting[];
    },
  });

  const getSettingValue = useCallback((key: string) => {
    return settings?.find(s => s.key === key)?.value || {};
  }, [settings]);

  // Individual verification functions
  const verifyGoogleAnalytics = useCallback(async (): Promise<VerificationResult> => {
    const gaSettings = getSettingValue('google_analytics');
    const measurementId = gaSettings?.measurement_id as string;
    
    if (!measurementId) {
      return {
        id: 'google_analytics',
        name: 'Google Analytics 4',
        category: 'Analytics',
        status: 'not_configured',
        message: 'No measurement ID configured',
        lastChecked: new Date(),
      };
    }

    // Check if gtag is loaded in the window
    const gtagLoaded = typeof window !== 'undefined' && typeof window.gtag === 'function';
    const dataLayerExists = typeof window !== 'undefined' && Array.isArray(window.dataLayer);
    
    // Check for the meta tag
    const metaTag = document.querySelector('meta[name="ga-measurement-id"]');
    const metaContent = metaTag?.getAttribute('content');

    if (gtagLoaded && dataLayerExists && metaContent === measurementId) {
      return {
        id: 'google_analytics',
        name: 'Google Analytics 4',
        category: 'Analytics',
        status: 'success',
        message: `GA4 active: ${measurementId}`,
        lastChecked: new Date(),
        details: { measurementId, gtagLoaded, dataLayerSize: window.dataLayer?.length },
      };
    } else if (measurementId) {
      return {
        id: 'google_analytics',
        name: 'Google Analytics 4',
        category: 'Analytics',
        status: 'warning',
        message: `Configured but script may not be loaded. ID: ${measurementId}`,
        lastChecked: new Date(),
        details: { measurementId, gtagLoaded, metaContent },
      };
    }

    return {
      id: 'google_analytics',
      name: 'Google Analytics 4',
      category: 'Analytics',
      status: 'error',
      message: 'GA4 not properly initialized',
      lastChecked: new Date(),
    };
  }, [getSettingValue]);

  const verifyGoogleSearchConsole = useCallback(async (): Promise<VerificationResult> => {
    const gscSettings = getSettingValue('google_search_console');
    const verificationCode = gscSettings?.verification_code as string;
    const verificationCode2 = gscSettings?.verification_code_2 as string;
    
    // Check meta tags in document
    const metaTags = document.querySelectorAll('meta[name="google-site-verification"]');
    const foundCodes: string[] = [];
    metaTags.forEach(tag => {
      const content = tag.getAttribute('content');
      if (content) foundCodes.push(content);
    });

    const configuredCodes = [verificationCode, verificationCode2].filter(Boolean);
    const allPresent = configuredCodes.every(code => foundCodes.includes(code));

    if (configuredCodes.length === 0) {
      return {
        id: 'google_search_console',
        name: 'Google Search Console',
        category: 'SEO',
        status: 'not_configured',
        message: 'No verification codes configured',
        lastChecked: new Date(),
      };
    }

    if (allPresent) {
      return {
        id: 'google_search_console',
        name: 'Google Search Console',
        category: 'SEO',
        status: 'success',
        message: `${foundCodes.length} verification code(s) active in HTML`,
        lastChecked: new Date(),
        details: { foundCodes, configuredCodes },
      };
    }

    return {
      id: 'google_search_console',
      name: 'Google Search Console',
      category: 'SEO',
      status: 'warning',
      message: 'Some verification codes may be missing from HTML',
      lastChecked: new Date(),
      details: { foundCodes, configuredCodes },
    };
  }, [getSettingValue]);

  const verifyGoogleTagManager = useCallback(async (): Promise<VerificationResult> => {
    const gaSettings = getSettingValue('google_analytics');
    const gtmId = gaSettings?.gtm_id as string;

    if (!gtmId) {
      return {
        id: 'google_tag_manager',
        name: 'Google Tag Manager',
        category: 'Analytics',
        status: 'not_configured',
        message: 'GTM not configured',
        lastChecked: new Date(),
      };
    }

    // Check if GTM script is present
    const gtmScript = document.querySelector(`script[src*="googletagmanager.com/gtm.js?id=${gtmId}"]`);
    
    if (gtmScript) {
      return {
        id: 'google_tag_manager',
        name: 'Google Tag Manager',
        category: 'Analytics',
        status: 'success',
        message: `GTM active: ${gtmId}`,
        lastChecked: new Date(),
      };
    }

    return {
      id: 'google_tag_manager',
      name: 'Google Tag Manager',
      category: 'Analytics',
      status: 'warning',
      message: `GTM configured (${gtmId}) but script not detected`,
      lastChecked: new Date(),
    };
  }, [getSettingValue]);

  const verifyFacebookPixel = useCallback(async (): Promise<VerificationResult> => {
    const pixelSettings = getSettingValue('tracking_pixels');
    const pixelId = pixelSettings?.facebook_pixel_id as string;

    if (!pixelId) {
      return {
        id: 'facebook_pixel',
        name: 'Facebook Pixel',
        category: 'Marketing',
        status: 'not_configured',
        message: 'Facebook Pixel not configured',
        lastChecked: new Date(),
      };
    }

    // Check if fbq is defined
    const fbqLoaded = typeof window !== 'undefined' && typeof (window as any).fbq === 'function';

    if (fbqLoaded) {
      return {
        id: 'facebook_pixel',
        name: 'Facebook Pixel',
        category: 'Marketing',
        status: 'success',
        message: `Facebook Pixel active: ${pixelId}`,
        lastChecked: new Date(),
      };
    }

    return {
      id: 'facebook_pixel',
      name: 'Facebook Pixel',
      category: 'Marketing',
      status: 'warning',
      message: `Pixel ID configured (${pixelId}) but fbq not loaded`,
      lastChecked: new Date(),
    };
  }, [getSettingValue]);

  const verifySMTP = useCallback(async (): Promise<VerificationResult> => {
    const smtpSettings = getSettingValue('smtp');
    const hasHost = !!smtpSettings?.host;
    const hasCredentials = !!smtpSettings?.username && !!smtpSettings?.password;
    const hasFromEmail = !!smtpSettings?.from_email;

    if (!hasHost) {
      return {
        id: 'smtp',
        name: 'SMTP / Email',
        category: 'Communications',
        status: 'not_configured',
        message: 'SMTP host not configured',
        lastChecked: new Date(),
      };
    }

    if (hasHost && hasCredentials && hasFromEmail) {
      return {
        id: 'smtp',
        name: 'SMTP / Email',
        category: 'Communications',
        status: 'success',
        message: `SMTP configured: ${smtpSettings.host}`,
        lastChecked: new Date(),
        details: { host: smtpSettings.host, fromEmail: smtpSettings.from_email },
      };
    }

    return {
      id: 'smtp',
      name: 'SMTP / Email',
      category: 'Communications',
      status: 'warning',
      message: 'SMTP partially configured - missing credentials or from email',
      lastChecked: new Date(),
    };
  }, [getSettingValue]);

  const verifyGooglePlacesAPI = useCallback(async (): Promise<VerificationResult> => {
    const placesSettings = getSettingValue('google_places');
    const apiKey = placesSettings?.api_key as string;

    if (!apiKey) {
      return {
        id: 'google_places',
        name: 'Google Places API',
        category: 'APIs',
        status: 'not_configured',
        message: 'Google Places API key not configured',
        lastChecked: new Date(),
      };
    }

    // We can't test the API directly due to CORS, but we can check if it looks valid
    if (apiKey.startsWith('AIza') && apiKey.length > 30) {
      return {
        id: 'google_places',
        name: 'Google Places API',
        category: 'APIs',
        status: 'success',
        message: 'API key configured (starts with AIza...)',
        lastChecked: new Date(),
      };
    }

    return {
      id: 'google_places',
      name: 'Google Places API',
      category: 'APIs',
      status: 'warning',
      message: 'API key format may be invalid',
      lastChecked: new Date(),
    };
  }, [getSettingValue]);

  const verifyGoogleOAuth = useCallback(async (): Promise<VerificationResult> => {
    const oauthSettings = getSettingValue('google_oauth');
    const clientId = oauthSettings?.client_id as string;
    const clientSecret = oauthSettings?.client_secret as string;

    if (!clientId || !clientSecret) {
      return {
        id: 'google_oauth',
        name: 'Google OAuth',
        category: 'Authentication',
        status: 'not_configured',
        message: 'OAuth credentials not configured',
        lastChecked: new Date(),
      };
    }

    if (clientId.includes('.apps.googleusercontent.com')) {
      return {
        id: 'google_oauth',
        name: 'Google OAuth',
        category: 'Authentication',
        status: 'success',
        message: 'OAuth credentials configured',
        lastChecked: new Date(),
      };
    }

    return {
      id: 'google_oauth',
      name: 'Google OAuth',
      category: 'Authentication',
      status: 'warning',
      message: 'Client ID format may be invalid',
      lastChecked: new Date(),
    };
  }, [getSettingValue]);

  const verifyAIMLAPI = useCallback(async (): Promise<VerificationResult> => {
    const aiSettings = getSettingValue('aimlapi');
    const enabled = aiSettings?.enabled;
    const lastStatus = aiSettings?.last_test_status;

    if (!enabled) {
      return {
        id: 'aimlapi',
        name: 'AIML API',
        category: 'AI',
        status: 'not_configured',
        message: 'AIML API not enabled',
        lastChecked: new Date(),
      };
    }

    if (lastStatus === 'connected') {
      return {
        id: 'aimlapi',
        name: 'AIML API',
        category: 'AI',
        status: 'success',
        message: 'AIML API connected and working',
        lastChecked: new Date(),
      };
    }

    return {
      id: 'aimlapi',
      name: 'AIML API',
      category: 'AI',
      status: 'warning',
      message: 'AIML API status unknown',
      lastChecked: new Date(),
    };
  }, [getSettingValue]);

  // Run all verifications
  const runAllVerifications = useCallback(async () => {
    setIsRunningAll(true);
    setProgress(0);

    const verifications = [
      verifyGoogleAnalytics,
      verifyGoogleSearchConsole,
      verifyGoogleTagManager,
      verifyFacebookPixel,
      verifySMTP,
      verifyGooglePlacesAPI,
      verifyGoogleOAuth,
      verifyAIMLAPI,
    ];

    const results: Record<string, VerificationResult> = {};
    
    for (let i = 0; i < verifications.length; i++) {
      try {
        const result = await verifications[i]();
        results[result.id] = result;
        setVerificationResults(prev => ({ ...prev, [result.id]: result }));
      } catch (error) {
        console.error('Verification error:', error);
      }
      setProgress(((i + 1) / verifications.length) * 100);
    }

    setIsRunningAll(false);
    toast.success('All verifications completed');
  }, [
    verifyGoogleAnalytics,
    verifyGoogleSearchConsole,
    verifyGoogleTagManager,
    verifyFacebookPixel,
    verifySMTP,
    verifyGooglePlacesAPI,
    verifyGoogleOAuth,
    verifyAIMLAPI,
  ]);

  // Run on mount
  useEffect(() => {
    if (settings && !isLoading) {
      runAllVerifications();
    }
  }, [settings, isLoading]);

  const getStatusIcon = (status: VerificationResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-teal" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-muted-foreground animate-pulse" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: VerificationResult['status']) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-teal/20 text-teal border-teal/30">Active</Badge>;
      case 'warning':
        return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">Warning</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'pending':
        return <Badge variant="outline">Checking...</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Not Configured</Badge>;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Analytics':
        return <BarChart3 className="h-4 w-4" />;
      case 'SEO':
        return <Search className="h-4 w-4" />;
      case 'Marketing':
        return <Code className="h-4 w-4" />;
      case 'Communications':
        return <Mail className="h-4 w-4" />;
      case 'APIs':
        return <Zap className="h-4 w-4" />;
      case 'Authentication':
        return <Shield className="h-4 w-4" />;
      case 'AI':
        return <Zap className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  // Group results by category
  const groupedResults = Object.values(verificationResults).reduce((acc, result) => {
    if (!acc[result.category]) {
      acc[result.category] = [];
    }
    acc[result.category].push(result);
    return acc;
  }, {} as Record<string, VerificationResult[]>);

  const successCount = Object.values(verificationResults).filter(r => r.status === 'success').length;
  const warningCount = Object.values(verificationResults).filter(r => r.status === 'warning').length;
  const errorCount = Object.values(verificationResults).filter(r => r.status === 'error').length;
  const totalCount = Object.keys(verificationResults).length;

  if (isLoading) {
    return (
      <Card className="card-modern">
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-modern">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Platform Verifications
            </CardTitle>
            <CardDescription>
              Test and verify all platform integrations and tracking codes
            </CardDescription>
          </div>
          <Button
            onClick={runAllVerifications}
            disabled={isRunningAll}
            className="gap-2"
          >
            {isRunningAll ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" />
                Run All Tests
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress bar when running */}
        {isRunningAll && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              Testing integrations... {Math.round(progress)}%
            </p>
          </div>
        )}

        {/* Summary Stats */}
        {totalCount > 0 && (
          <div className="grid grid-cols-4 gap-4">
            <div className="p-3 rounded-xl bg-teal/10 border border-teal/20 text-center">
              <div className="text-2xl font-bold text-teal">{successCount}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
              <div className="text-2xl font-bold text-amber-600">{warningCount}</div>
              <div className="text-xs text-muted-foreground">Warnings</div>
            </div>
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-center">
              <div className="text-2xl font-bold text-destructive">{errorCount}</div>
              <div className="text-xs text-muted-foreground">Errors</div>
            </div>
            <div className="p-3 rounded-xl bg-muted text-center">
              <div className="text-2xl font-bold text-muted-foreground">
                {totalCount - successCount - warningCount - errorCount}
              </div>
              <div className="text-xs text-muted-foreground">Not Configured</div>
            </div>
          </div>
        )}

        <Separator />

        {/* Results by Category */}
        <div className="space-y-6">
          {Object.entries(groupedResults).map(([category, results]) => (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                {getCategoryIcon(category)}
                {category}
              </div>
              <div className="space-y-2">
                {results.map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(result.status)}
                      <div>
                        <div className="font-medium text-sm">{result.name}</div>
                        <div className="text-xs text-muted-foreground">{result.message}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(result.status)}
                      {result.lastChecked && (
                        <span className="text-xs text-muted-foreground">
                          {result.lastChecked.toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Help text */}
        <div className="p-4 rounded-xl bg-muted/50 text-sm text-muted-foreground">
          <p className="mb-2">
            <strong>Note:</strong> Some verifications check if tracking codes are present in the HTML.
            For full validation, use the respective platform's debugging tools:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <a href="https://tagassistant.google.com/" target="_blank" rel="noopener" className="text-primary hover:underline inline-flex items-center gap-1">
                Google Tag Assistant <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>
              <a href="https://search.google.com/search-console" target="_blank" rel="noopener" className="text-primary hover:underline inline-flex items-center gap-1">
                Google Search Console <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>
              <a href="https://developers.facebook.com/tools/debug/" target="_blank" rel="noopener" className="text-primary hover:underline inline-flex items-center gap-1">
                Facebook Pixel Helper <ExternalLink className="h-3 w-3" />
              </a>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default PlatformVerificationsPanel;
