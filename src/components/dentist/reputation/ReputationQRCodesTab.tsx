import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  QrCode,
  Download,
  Printer,
  Star,
  Smartphone,
  Palette,
  Type,
  Image as ImageIcon,
  Upload,
  Eye,
  Save,
  CheckCircle,
  Loader2,
  BarChart3,
  TrendingUp,
  Share2,
  Copy,
} from 'lucide-react';
import { format, subDays } from 'date-fns';

interface ReputationQRCodesTabProps {
  clinicId: string;
  clinicName: string;
  clinicSlug: string;
}

const CARD_STYLES = [
  { id: 'modern', name: 'Modern', gradient: 'from-primary to-teal', colors: { from: '#0ea5e9', to: '#14b8a6' } },
  { id: 'classic', name: 'Classic', gradient: 'from-slate-800 to-slate-900', colors: { from: '#1e293b', to: '#0f172a' } },
  { id: 'warm', name: 'Warm', gradient: 'from-amber-500 to-orange-600', colors: { from: '#f59e0b', to: '#ea580c' } },
  { id: 'fresh', name: 'Fresh', gradient: 'from-emerald-500 to-teal-600', colors: { from: '#10b981', to: '#0d9488' } },
  { id: 'purple', name: 'Purple', gradient: 'from-purple-500 to-pink-500', colors: { from: '#8b5cf6', to: '#ec4899' } },
  { id: 'dark', name: 'Dark', gradient: 'from-gray-900 to-gray-800', colors: { from: '#111827', to: '#1f2937' } },
];

interface QRSettings {
  selectedStyle: string;
  customTitle: string;
  customSubtitle: string;
  customCTA: string;
  customFooter: string;
  showStars: boolean;
  showLogo: boolean;
  customLogo: string | null;
  showBranding: boolean;
}

export default function ReputationQRCodesTab({
  clinicId,
  clinicName,
  clinicSlug,
}: ReputationQRCodesTabProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const defaultSettings: QRSettings = {
    selectedStyle: 'modern',
    customTitle: clinicName,
    customSubtitle: 'Share your experience with us!',
    customCTA: 'How did we do?',
    customFooter: 'Your feedback helps us improve.',
    showStars: true,
    showLogo: false,
    customLogo: null,
    showBranding: true,
  };

  const [settings, setSettings] = useState<QRSettings>(defaultSettings);
  const [activeTab, setActiveTab] = useState('preview');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const reviewLink = `${window.location.origin}/review/${clinicSlug}?source=qr_code`;
  const currentStyle = CARD_STYLES.find(s => s.id === settings.selectedStyle) || CARD_STYLES[0];

  // Fetch saved settings
  const { data: savedSettings } = useQuery({
    queryKey: ['qr-settings', clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinic_oauth_tokens')
        .select('gmb_data')
        .eq('clinic_id', clinicId)
        .maybeSingle();

      if (data?.gmb_data && typeof data.gmb_data === 'object') {
        const gmbData = data.gmb_data as { qr_settings?: QRSettings };
        return gmbData.qr_settings || null;
      }
      return null;
    },
  });

  // Fetch QR scan stats
  const { data: scanStats } = useQuery({
    queryKey: ['qr-scan-stats', clinicId],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const { data, error } = await supabase
        .from('review_funnel_events')
        .select('created_at, event_type, source')
        .eq('clinic_id', clinicId)
        .eq('source', 'qr_code')
        .gte('created_at', thirtyDaysAgo);

      if (error) return { total: 0, conversions: 0, rate: 0 };

      const total = data?.length || 0;
      const conversions = data?.filter(e => e.event_type === 'thumbs_up').length || 0;
      return {
        total,
        conversions,
        rate: total > 0 ? Math.round((conversions / total) * 100) : 0,
      };
    },
  });

  useEffect(() => {
    if (savedSettings) {
      setSettings({ ...defaultSettings, ...savedSettings, customTitle: savedSettings.customTitle || clinicName });
    }
  }, [savedSettings, clinicName]);

  const updateSettings = (updates: Partial<QRSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  };

  // Save settings
  const saveSettingsMutation = useMutation({
    mutationFn: async (newSettings: QRSettings) => {
      const { data: existing } = await supabase
        .from('clinic_oauth_tokens')
        .select('gmb_data')
        .eq('clinic_id', clinicId)
        .maybeSingle();

      const existingData = (existing?.gmb_data as Record<string, unknown>) || {};
      const updatedGmbData = { ...existingData, qr_settings: newSettings };

      if (existing) {
        await supabase.from('clinic_oauth_tokens').update({ gmb_data: updatedGmbData } as any).eq('clinic_id', clinicId);
      } else {
        await supabase.from('clinic_oauth_tokens').insert({ clinic_id: clinicId, gmb_data: updatedGmbData } as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qr-settings', clinicId] });
      setHasUnsavedChanges(false);
      toast.success('QR code settings saved!');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateSettings({ customLogo: reader.result as string, showLogo: true });
      };
      reader.readAsDataURL(file);
    }
  };

  const downloadAsPNG = async () => {
    if (!cardRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      link.download = `${clinicSlug}-review-qr.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('QR code downloaded!');
    } catch {
      toast.error('Failed to download');
    } finally {
      setIsDownloading(false);
    }
  };

  const printCard = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Review QR - ${settings.customTitle}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @media print { @page { size: auto; margin: 0; } body { -webkit-print-color-adjust: exact !important; } }
          body { font-family: 'Inter', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: white; padding: 20px; }
          .card { width: 400px; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); background: white; border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, ${currentStyle.colors.from}, ${currentStyle.colors.to}) !important; padding: 40px 24px 30px; text-align: center; color: white !important; -webkit-print-color-adjust: exact !important; }
          .header h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
          .header p { font-size: 14px; opacity: 0.9; margin-bottom: 14px; }
          .stars { font-size: 18px; letter-spacing: 4px; color: #fbbf24 !important; }
          .qr-section { padding: 36px; text-align: center; background: white !important; }
          .qr-wrapper { display: inline-block; padding: 20px; background: #f8fafc !important; border-radius: 20px; border: 2px solid #e2e8f0; }
          .scan-hint { margin-top: 18px; padding: 10px 18px; background: #f1f5f9 !important; border-radius: 12px; font-size: 13px; color: #475569 !important; }
          .instructions { padding: 0 36px 36px; text-align: center; }
          .instructions h2 { font-size: 20px; font-weight: 700; color: #1e293b !important; margin-bottom: 10px; }
          .instructions p { font-size: 13px; color: #64748b !important; }
          .footer { padding: 14px; text-align: center; border-top: 1px solid #e2e8f0; color: #0ea5e9 !important; font-size: 11px; background: #fafafa !important; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            ${settings.showLogo && settings.customLogo ? `<img src="${settings.customLogo}" alt="Logo" style="width:60px;height:60px;border-radius:50%;margin-bottom:12px;border:3px solid rgba(255,255,255,0.3);" />` : ''}
            <h1>${settings.customTitle}</h1>
            <p>${settings.customSubtitle}</p>
            ${settings.showStars ? '<div class="stars">⭐ ⭐ ⭐ ⭐ ⭐</div>' : ''}
          </div>
          <div class="qr-section">
            <div class="qr-wrapper">${document.querySelector('#qr-code-svg')?.outerHTML || ''}</div>
            <div class="scan-hint">📱 Scan with your phone camera</div>
          </div>
          <div class="instructions">
            <h2>${settings.customCTA}</h2>
            <p>${settings.customFooter}</p>
          </div>
          ${settings.showBranding ? '<div class="footer">Powered by AppointPanda</div>' : ''}
        </div>
        <script>window.onload = function() { setTimeout(function() { window.print(); window.close(); }, 500); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(reviewLink);
    toast.success('Link copied!');
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <QrCode className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{scanStats?.total || 0}</p>
                <p className="text-sm text-muted-foreground">Total Scans</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{scanStats?.conversions || 0}</p>
                <p className="text-sm text-muted-foreground">Conversions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{scanStats?.rate || 0}%</p>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main QR Generator */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" />
                QR Code Studio
              </CardTitle>
              <CardDescription>Create print-ready QR codes for in-clinic use</CardDescription>
            </div>
            <div className="flex gap-2">
              {hasUnsavedChanges && (
                <Button
                  onClick={() => saveSettingsMutation.mutate(settings)}
                  disabled={saveSettingsMutation.isPending}
                >
                  {saveSettingsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Design
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="preview" className="gap-2">
                <Eye className="h-4 w-4" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="customize" className="gap-2">
                <Palette className="h-4 w-4" />
                Customize
              </TabsTrigger>
            </TabsList>

            <TabsContent value="preview">
              <div className="space-y-6">
                {/* Style Selector */}
                <div className="flex items-center gap-3 justify-center p-4 bg-muted/50 rounded-xl">
                  <span className="text-sm text-muted-foreground">Theme:</span>
                  {CARD_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => updateSettings({ selectedStyle: style.id })}
                      className={`h-8 w-8 rounded-full bg-gradient-to-br ${style.gradient} transition-all ${
                        settings.selectedStyle === style.id ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                      title={style.name}
                    />
                  ))}
                </div>

                {/* Preview Card */}
                <div ref={cardRef} className="mx-auto max-w-sm">
                  <Card className="overflow-hidden shadow-2xl border-0" style={{ backgroundColor: '#ffffff' }}>
                    <div className={`bg-gradient-to-r ${currentStyle.gradient} p-6 text-center text-white`}>
                      {settings.showLogo && settings.customLogo && (
                        <img src={settings.customLogo} alt="Logo" className="h-14 w-14 rounded-full object-cover mx-auto mb-3 border-2 border-white/30" />
                      )}
                      <h2 className="text-xl font-bold mb-1.5">{settings.customTitle}</h2>
                      <p className="text-sm opacity-90 mb-2">{settings.customSubtitle}</p>
                      {settings.showStars && (
                        <div className="flex justify-center gap-1">
                          {[1,2,3,4,5].map(i => (
                            <Star key={i} className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                          ))}
                        </div>
                      )}
                    </div>
                    <CardContent className="p-8 flex flex-col items-center bg-white">
                      <div className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-100">
                        <QRCodeSVG id="qr-code-svg" value={reviewLink} size={180} level="H" bgColor="#f8fafc" fgColor="#0f172a" />
                      </div>
                      <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-xl">
                        <Smartphone className="h-4 w-4 text-slate-500" />
                        <span className="text-xs text-slate-600">Scan with your phone camera</span>
                      </div>
                    </CardContent>
                    <div className="px-6 pb-6 text-center bg-white">
                      <h3 className="font-bold text-lg mb-2 text-slate-800">{settings.customCTA}</h3>
                      <p className="text-sm text-slate-500">{settings.customFooter}</p>
                    </div>
                    {settings.showBranding && (
                      <div className="border-t border-slate-100 py-3 text-center bg-slate-50">
                        <span className="text-xs text-slate-400">Powered by <span className="font-semibold text-primary">AppointPanda</span></span>
                      </div>
                    )}
                  </Card>
                </div>

                {/* Actions */}
                <div className="flex justify-center gap-3">
                  <Button onClick={downloadAsPNG} variant="outline" disabled={isDownloading}>
                    {isDownloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                    Download PNG
                  </Button>
                  <Button onClick={printCard}>
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </Button>
                  <Button variant="outline" onClick={copyLink}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="customize">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Text Settings */}
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Type className="h-4 w-4 text-primary" />
                    Text & Content
                  </h4>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input value={settings.customTitle} onChange={(e) => updateSettings({ customTitle: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Subtitle</Label>
                      <Input value={settings.customSubtitle} onChange={(e) => updateSettings({ customSubtitle: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Call to Action</Label>
                      <Input value={settings.customCTA} onChange={(e) => updateSettings({ customCTA: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Footer Text</Label>
                      <Input value={settings.customFooter} onChange={(e) => updateSettings({ customFooter: e.target.value })} />
                    </div>
                  </div>
                </div>

                {/* Display Settings */}
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    Display Options
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <Label>Show Stars</Label>
                      <Switch checked={settings.showStars} onCheckedChange={(checked) => updateSettings({ showStars: checked })} />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <Label>Show AppointPanda Branding</Label>
                      <Switch checked={settings.showBranding} onCheckedChange={(checked) => updateSettings({ showBranding: checked })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Custom Logo</Label>
                      <div className="flex gap-2">
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Logo
                        </Button>
                        {settings.customLogo && (
                          <Button variant="outline" onClick={() => updateSettings({ customLogo: null, showLogo: false })}>
                            Remove
                          </Button>
                        )}
                      </div>
                      {settings.customLogo && (
                        <div className="flex items-center gap-2 mt-2">
                          <img src={settings.customLogo} alt="Logo preview" className="h-10 w-10 rounded-full object-cover" />
                          <span className="text-sm text-muted-foreground">Logo uploaded</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
