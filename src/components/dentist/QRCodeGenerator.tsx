import { forwardRef, useRef, useState, useEffect } from "react";
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Download, 
  Printer, 
  Smartphone, 
  Star, 
  Palette, 
  Type, 
  Image as ImageIcon,
  Upload,
  Settings2,
  Eye,
  Loader2,
  Save,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface QRCodeGeneratorProps {
  clinicName: string;
  clinicSlug: string;
  clinicId?: string;
  googlePlaceId?: string;
  clinicLogo?: string;
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

const QRCodeGenerator = forwardRef<HTMLDivElement, QRCodeGeneratorProps>(function QRCodeGenerator({ 
  clinicName, 
  clinicSlug, 
  clinicId,
  googlePlaceId, 
  clinicLogo 
}, ref) {
  const cardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  
  // Default settings
  const defaultSettings: QRSettings = {
    selectedStyle: 'modern',
    customTitle: clinicName,
    customSubtitle: 'Share your experience with us!',
    customCTA: 'How did we do?',
    customFooter: 'Your feedback helps us improve.',
    showStars: true,
    showLogo: !!clinicLogo,
    customLogo: clinicLogo || null,
    showBranding: true,
  };

  // State
  const [settings, setSettings] = useState<QRSettings>(defaultSettings);
  const [activeTab, setActiveTab] = useState('preview');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const reviewLink = `${window.location.origin}/review/${clinicSlug}`;
  const currentStyle = CARD_STYLES.find(s => s.id === settings.selectedStyle) || CARD_STYLES[0];

  // Fetch saved QR settings from clinic_oauth_tokens.gmb_data
  const { data: savedSettings } = useQuery({
    queryKey: ['qr-settings', clinicId],
    queryFn: async () => {
      if (!clinicId) return null;
      
      const { data, error } = await supabase
        .from('clinic_oauth_tokens')
        .select('gmb_data')
        .eq('clinic_id', clinicId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data?.gmb_data && typeof data.gmb_data === 'object') {
        const gmbData = data.gmb_data as { qr_settings?: QRSettings };
        return gmbData.qr_settings || null;
      }
      return null;
    },
    enabled: !!clinicId,
  });

  // Load saved settings when available
  useEffect(() => {
    if (savedSettings) {
      setSettings({
        ...defaultSettings,
        ...savedSettings,
        // Keep the clinic name if custom title matches the old clinic name
        customTitle: savedSettings.customTitle || clinicName,
      });
    }
  }, [savedSettings, clinicName]);

  // Track unsaved changes
  const updateSettings = (updates: Partial<QRSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  };

  // Save QR settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (newSettings: QRSettings) => {
      if (!clinicId) throw new Error('No clinic ID provided');
      
      // Get existing gmb_data
      const { data: existing } = await supabase
        .from('clinic_oauth_tokens')
        .select('gmb_data')
        .eq('clinic_id', clinicId)
        .single();

      const existingData = (existing?.gmb_data as Record<string, unknown>) || {};
      const updatedGmbData = { ...existingData, qr_settings: newSettings } as any;
      
      // Update with new QR settings - use update if exists, insert if not
      if (existing) {
        const { error } = await supabase
          .from('clinic_oauth_tokens')
          .update({ gmb_data: updatedGmbData } as any)
          .eq('clinic_id', clinicId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('clinic_oauth_tokens')
          .insert({ clinic_id: clinicId, gmb_data: updatedGmbData } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qr-settings', clinicId] });
      setHasUnsavedChanges(false);
      toast.success('QR code settings saved!');
    },
    onError: (error) => {
      toast.error('Failed to save settings: ' + (error as Error).message);
    },
  });

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await saveSettingsMutation.mutateAsync(settings);
    } finally {
      setIsSaving(false);
    }
  };

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
    if (!cardRef.current) {
      toast.error('Unable to capture QR code');
      return;
    }
    
    setIsDownloading(true);
    
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      
      const link = document.createElement('a');
      link.download = `${clinicSlug}-review-qr-${settings.selectedStyle}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      toast.success('QR code downloaded successfully!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download QR code. Please try again.');
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
          @media print {
            @page {
              size: auto;
              margin: 0;
            }
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            .no-print { display: none !important; }
          }
          body {
            font-family: 'Inter', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: white;
            padding: 20px;
          }
          .card {
            width: 400px;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            background: white;
            border: 1px solid #e2e8f0;
          }
          .header {
            background: linear-gradient(135deg, ${currentStyle.colors.from}, ${currentStyle.colors.to}) !important;
            padding: ${settings.showLogo && settings.customLogo ? '30px' : '40px'} 24px 30px;
            text-align: center;
            color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .logo {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            object-fit: cover;
            margin-bottom: 12px;
            border: 3px solid rgba(255,255,255,0.3);
          }
          .header h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; color: white !important; }
          .header p { font-size: 14px; opacity: 0.9; margin-bottom: 14px; color: white !important; }
          .stars { font-size: 18px; letter-spacing: 4px; color: #fbbf24 !important; }
          .qr-section { padding: 36px; text-align: center; background: white !important; }
          .qr-wrapper {
            display: inline-block;
            padding: 20px;
            background: #f8fafc !important;
            border-radius: 20px;
            border: 2px solid #e2e8f0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .qr-section svg { width: 200px; height: 200px; }
          .scan-hint {
            margin-top: 18px;
            padding: 10px 18px;
            background: #f1f5f9 !important;
            border-radius: 12px;
            font-size: 13px;
            color: #475569 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .instructions { padding: 0 36px 36px; text-align: center; }
          .instructions h2 { font-size: 20px; font-weight: 700; color: #1e293b !important; margin-bottom: 10px; }
          .instructions p { font-size: 13px; color: #64748b !important; line-height: 1.6; white-space: pre-line; }
          .footer {
            padding: 14px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
            color: #0ea5e9 !important;
            font-size: 11px;
            background: #fafafa !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            ${settings.showLogo && settings.customLogo ? `<img class="logo" src="${settings.customLogo}" alt="Logo" />` : ''}
            <h1>${settings.customTitle}</h1>
            <p>${settings.customSubtitle}</p>
            ${settings.showStars ? '<div class="stars">⭐ ⭐ ⭐ ⭐ ⭐</div>' : ''}
          </div>
          <div class="qr-section">
            <div class="qr-wrapper">
              ${document.querySelector('#qr-code-svg')?.outerHTML || ''}
            </div>
            <div class="scan-hint">📱 Scan with your phone camera</div>
          </div>
          <div class="instructions">
            <h2>${settings.customCTA}</h2>
            <p>${settings.customFooter}</p>
          </div>
          ${settings.showBranding ? '<div class="footer">Powered by AppointPanda</div>' : ''}
        </div>
        <script>
          window.onload = function() { setTimeout(function() { window.print(); window.close(); }, 500); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="max-h-[80vh] overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
        <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted rounded-xl p-1">
          <TabsTrigger value="preview" className="gap-2 rounded-lg text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Eye className="h-4 w-4" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="customize" className="gap-2 rounded-lg text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Settings2 className="h-4 w-4" />
            Customize
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="mt-0">
          <ScrollArea className="h-[calc(80vh-140px)]">
            <div className="space-y-5 p-1">
              {/* Style Selector */}
              <div className="flex items-center gap-3 justify-center p-3 bg-slate-800/30 rounded-xl">
                <span className="text-sm text-muted-foreground">Theme:</span>
                {CARD_STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => updateSettings({ selectedStyle: style.id })}
                    className={`h-8 w-8 rounded-full bg-gradient-to-br ${style.gradient} transition-all ${
                      settings.selectedStyle === style.id ? 'ring-2 ring-offset-2 ring-offset-background ring-primary scale-110' : 'opacity-70 hover:opacity-100 hover:scale-105'
                    }`}
                    title={style.name}
                  />
                ))}
              </div>

              {/* Preview Card */}
              <div ref={cardRef} className="mx-auto max-w-sm">
                <Card className="overflow-hidden shadow-2xl border-0 bg-white" style={{ backgroundColor: '#ffffff' }}>
                  {/* Header */}
                  <div className={`bg-gradient-to-r ${currentStyle.gradient} p-6 text-center text-white relative`}>
                    {settings.showLogo && settings.customLogo && (
                      <div className="mb-3">
                        <img 
                          src={settings.customLogo} 
                          alt="Logo" 
                          className="h-14 w-14 rounded-full object-cover mx-auto border-2 border-white/30"
                        />
                      </div>
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

                  {/* QR Code */}
                  <CardContent className="p-8 flex flex-col items-center bg-white">
                    <div className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 shadow-inner">
                      <QRCodeSVG
                        id="qr-code-svg"
                        value={reviewLink}
                        size={180}
                        level="H"
                        includeMargin={false}
                        bgColor="#f8fafc"
                        fgColor="#0f172a"
                      />
                    </div>
                    <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-xl">
                      <Smartphone className="h-4 w-4 text-slate-500" />
                      <span className="text-xs text-slate-600">Scan with your phone camera</span>
                    </div>
                  </CardContent>

                  {/* Instructions */}
                  <div className="px-6 pb-6 text-center bg-white">
                    <h3 className="font-bold text-lg mb-2 text-slate-800">{settings.customCTA}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed whitespace-pre-line">
                      {settings.customFooter}
                    </p>
                  </div>

                  {/* Footer */}
                  {settings.showBranding && (
                    <div className="border-t border-slate-100 py-3 text-center bg-slate-50">
                      <span className="text-xs text-slate-400">Powered by <span className="font-semibold text-primary">AppointPanda</span></span>
                    </div>
                  )}
                </Card>
              </div>

              {/* Actions */}
              <div className="flex justify-center gap-3">
                <Button onClick={downloadAsPNG} variant="outline" className="gap-2 border-slate-300 text-slate-800 hover:bg-slate-100" disabled={isDownloading}>
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {isDownloading ? 'Downloading...' : 'Download PNG'}
                </Button>
                <Button onClick={printCard} className="gap-2 bg-gradient-to-r from-primary to-teal text-white hover:opacity-90">
                  <Printer className="h-4 w-4" />
                  Print Card
                </Button>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="customize" className="mt-0">
          <ScrollArea className="h-[calc(80vh-140px)]">
            <div className="space-y-5 p-1">
              {/* Logo Upload */}
              <Card className="border border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-foreground">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    Logo & Branding
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-foreground">Show Logo</Label>
                    <Switch checked={settings.showLogo} onCheckedChange={(v) => updateSettings({ showLogo: v })} />
                  </div>
                  {settings.showLogo && (
                    <div className="flex items-center gap-3">
                      {settings.customLogo ? (
                        <img src={settings.customLogo} alt="Logo" className="h-12 w-12 rounded-full object-cover border-2 border-border" />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-2"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4" />
                        Upload Logo
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-foreground">Show Stars</Label>
                    <Switch checked={settings.showStars} onCheckedChange={(v) => updateSettings({ showStars: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-foreground">Show "Powered by" Footer</Label>
                    <Switch checked={settings.showBranding} onCheckedChange={(v) => updateSettings({ showBranding: v })} />
                  </div>
                </CardContent>
              </Card>

              {/* Text Customization */}
              <Card className="border border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-foreground">
                    <Type className="h-4 w-4 text-primary" />
                    Text Content
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Business Name</Label>
                    <Input 
                      value={settings.customTitle} 
                      onChange={(e) => updateSettings({ customTitle: e.target.value })}
                      placeholder="Your Business Name"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Subtitle</Label>
                    <Input 
                      value={settings.customSubtitle} 
                      onChange={(e) => updateSettings({ customSubtitle: e.target.value })}
                      placeholder="Share your experience with us!"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Call to Action</Label>
                    <Input 
                      value={settings.customCTA} 
                      onChange={(e) => updateSettings({ customCTA: e.target.value })}
                      placeholder="How did we do?"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Footer Text</Label>
                    <Textarea 
                      value={settings.customFooter} 
                      onChange={(e) => updateSettings({ customFooter: e.target.value })}
                      placeholder="Your feedback helps us improve."
                      className="text-sm resize-none"
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Color Theme */}
              <Card className="border border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-foreground">
                    <Palette className="h-4 w-4 text-primary" />
                    Color Theme
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    {CARD_STYLES.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => updateSettings({ selectedStyle: style.id })}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          settings.selectedStyle === style.id 
                            ? 'border-primary ring-2 ring-primary/20' 
                            : 'border-border hover:border-muted-foreground'
                        }`}
                      >
                        <div className={`h-8 rounded-lg bg-gradient-to-r ${style.gradient} mb-2`} />
                        <span className="text-xs font-medium">{style.name}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Save Button */}
              {clinicId && (
                <Button 
                  onClick={handleSaveSettings}
                  disabled={isSaving || !hasUnsavedChanges}
                  className="w-full gap-2"
                  variant={hasUnsavedChanges ? "default" : "outline"}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : hasUnsavedChanges ? (
                    <Save className="h-4 w-4" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save Customizations' : 'All Changes Saved'}
                </Button>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
});

export default QRCodeGenerator;