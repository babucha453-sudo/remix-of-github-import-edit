import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Globe,
  MapPin,
  Building2,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  Pause,
  RefreshCw,
  Eye,
  Trash2,
  ChevronRight,
  Loader2,
  FileText,
  Settings,
  History,
  Sparkles,
  TrendingUp,
  Shield,
  Database,
} from "lucide-react";
import {
  useGeoExpansionStats,
  useGeoExpansionQueue,
  useGeoExpansionSettings,
  usePublishPage,
  useRejectPage,
  useGenerateContent,
  useBulkPublishContent,
  useUpdateGeoExpansionSettings,
  QueueItem,
} from "@/hooks/useGeoExpansion";
import { useSeedLocations, useLocationStats } from "@/hooks/useAdminLocations";
import { format } from "date-fns";

export default function GeoExpansionTab() {
  const [activeTab, setActiveTab] = useState("overview");
  const [queueFilter, setQueueFilter] = useState<string>("all");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useGeoExpansionStats();
  const { data: queue = [], isLoading: queueLoading, refetch: refetchQueue } = useGeoExpansionQueue({
    status: queueFilter === "all" ? undefined : queueFilter,
    limit: 100,
  });
  const { data: settings } = useGeoExpansionSettings();
  const { data: locationStats, refetch: refetchLocationStats } = useLocationStats();

  const publishPage = usePublishPage();
  const rejectPage = useRejectPage();
  const generateContent = useGenerateContent();
  const bulkPublish = useBulkPublishContent();
  const updateSettings = useUpdateGeoExpansionSettings();
  const seedLocations = useSeedLocations();

  const handleRefresh = () => {
    refetchStats();
    refetchQueue();
    refetchLocationStats();
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const publishableIds = queue
        .filter((item) => item.status === "generated" && item.seo_validation_passed)
        .map((item) => item.id);
      setSelectedItems(new Set(publishableIds));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleToggleItem = (id: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedItems(newSet);
  };

  const handleBulkPublish = async () => {
    if (selectedItems.size === 0) return;
    await bulkPublish.mutateAsync(Array.from(selectedItems));
    setSelectedItems(new Set());
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "processing":
        return <Badge className="bg-blue-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
      case "generated":
        return <Badge className="bg-amber-500"><FileText className="h-3 w-3 mr-1" />Generated</Badge>;
      case "published":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Published</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            Geographic Expansion
          </h2>
          <p className="text-muted-foreground">
            Automatic SEO page generation for states and cities
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Seed Locations Card */}
      <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Database Population</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Populate all 51 US states and 1,500+ major cities into the master database. 
                  This enables dentists to search and list their practice in any US city.
                </p>
                <div className="flex gap-4 mt-3 text-sm">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-primary" />
                    <strong>{locationStats?.totalStates || 0}</strong> states
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 className="h-4 w-4 text-teal" />
                    <strong>{locationStats?.totalCities || 0}</strong> cities
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <strong>{locationStats?.activeStatePages || 0}</strong> live state pages
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <strong>{locationStats?.activeCityPages || 0}</strong> live city pages
                  </span>
                </div>
              </div>
            </div>
            <Button 
              onClick={() => seedLocations.mutate()}
              disabled={seedLocations.isPending}
              className="shrink-0"
            >
              {seedLocations.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Seeding...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Seed All US Locations
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.states.total || 0}</p>
                <p className="text-xs text-muted-foreground">Total States</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2 text-xs">
              <span className="text-green-600">{stats?.states.live || 0} live</span>
              <span className="text-amber-600">{stats?.states.draft || 0} draft</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-teal/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-teal" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.cities.total || 0}</p>
                <p className="text-xs text-muted-foreground">Total Cities</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2 text-xs">
              <span className="text-green-600">{stats?.cities.live || 0} live</span>
              <span className="text-amber-600">{stats?.cities.draft || 0} draft</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.queue.pending || 0}</p>
                <p className="text-xs text-muted-foreground">Queue Pending</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2 text-xs">
              <span className="text-blue-600">{stats?.queue.generated || 0} ready</span>
              <span className="text-red-600">{stats?.queue.failed || 0} failed</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.queue.published || 0}</p>
                <p className="text-xs text-muted-foreground">Published</p>
              </div>
            </div>
            <div className="mt-3">
              <Progress 
                value={stats ? (stats.queue.published / Math.max(1, stats.queue.published + stats.queue.pending + stats.queue.generated)) * 100 : 0} 
                className="h-1"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="queue">
            Generation Queue
            {(stats?.queue.pending || 0) + (stats?.queue.generated || 0) > 0 && (
              <Badge variant="secondary" className="ml-2">
                {(stats?.queue.pending || 0) + (stats?.queue.generated || 0)}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="history">Change History</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            {/* States Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  States Coverage
                </CardTitle>
                <CardDescription>
                  {stats?.states.live || 0} of {stats?.states.total || 0} states have live pages
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Progress 
                  value={stats ? (stats.states.live / Math.max(1, stats.states.total)) * 100 : 0}
                  className="h-2 mb-4"
                />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      Live Pages
                    </span>
                    <span className="font-medium">{stats?.states.live || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      Draft Pages
                    </span>
                    <span className="font-medium">{stats?.states.draft || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gray-300" />
                      No Page Yet
                    </span>
                    <span className="font-medium">{stats?.states.inactive || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cities Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Cities Coverage
                </CardTitle>
                <CardDescription>
                  {stats?.cities.live || 0} of {stats?.cities.total || 0} cities have live pages
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Progress 
                  value={stats ? (stats.cities.live / Math.max(1, stats.cities.total)) * 100 : 0}
                  className="h-2 mb-4"
                />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      Live Pages
                    </span>
                    <span className="font-medium">{stats?.cities.live || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      Draft Pages
                    </span>
                    <span className="font-medium">{stats?.cities.draft || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gray-300" />
                      No Page Yet
                    </span>
                    <span className="font-medium">{stats?.cities.inactive || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Changes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Recent Changes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.recentChanges && stats.recentChanges.length > 0 ? (
                <div className="space-y-2">
                  {stats.recentChanges.slice(0, 5).map((change: any) => (
                    <div key={change.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">
                          {change.page_type}
                        </Badge>
                        <span className="font-medium text-sm">{change.field_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {change.change_trigger}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {change.created_at && format(new Date(change.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No recent changes</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Queue Tab */}
        <TabsContent value="queue" className="space-y-4">
          {/* Queue Filters & Actions */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {["all", "pending", "generated", "published", "failed"].map((filter) => (
                <Button
                  key={filter}
                  variant={queueFilter === filter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setQueueFilter(filter)}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  {filter === "generated" && (stats?.queue.generated || 0) > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {stats?.queue.generated}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              {selectedItems.size > 0 && (
                <Button
                  onClick={handleBulkPublish}
                  disabled={bulkPublish.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {bulkPublish.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Publish {selectedItems.size} Selected
                </Button>
              )}
            </div>
          </div>

          {/* Queue List */}
          <Card>
            <CardContent className="p-0">
              {queueLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : queue.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No items in queue</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <table className="w-full">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="p-3 text-left w-10">
                          <Checkbox
                            checked={
                              selectedItems.size > 0 &&
                              queue.filter((q) => q.status === "generated").every((q) => selectedItems.has(q.id))
                            }
                            onCheckedChange={handleSelectAll}
                          />
                        </th>
                        <th className="p-3 text-left text-sm font-medium">Page</th>
                        <th className="p-3 text-left text-sm font-medium">Type</th>
                        <th className="p-3 text-left text-sm font-medium">Status</th>
                        <th className="p-3 text-left text-sm font-medium">Confidence</th>
                        <th className="p-3 text-left text-sm font-medium">Created</th>
                        <th className="p-3 text-right text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queue.map((item) => (
                        <QueueRow
                          key={item.id}
                          item={item}
                          isSelected={selectedItems.has(item.id)}
                          onToggleSelect={() => handleToggleItem(item.id)}
                          onPublish={() => publishPage.mutate(item.id)}
                          onReject={() => rejectPage.mutate(item.id)}
                          onRegenerate={() =>
                            generateContent.mutate({
                              entityType: item.page_type,
                              entityId: item.entity_id,
                              queueId: item.id,
                            })
                          }
                          isPublishing={publishPage.isPending}
                          isRejecting={rejectPage.isPending}
                          isRegenerating={generateContent.isPending}
                        />
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Expansion Settings
              </CardTitle>
              <CardDescription>
                Control how geographic pages are generated and published
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Auto-Publish Enabled</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically publish pages with high confidence scores
                  </p>
                </div>
                <Switch
                  checked={settings?.auto_publish_enabled ?? false}
                  onCheckedChange={(checked) =>
                    updateSettings.mutate({ settingKey: "auto_publish_enabled", settingValue: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Require Admin Approval</Label>
                  <p className="text-sm text-muted-foreground">
                    All pages must be manually approved before publishing
                  </p>
                </div>
                <Switch
                  checked={settings?.require_admin_approval ?? true}
                  onCheckedChange={(checked) =>
                    updateSettings.mutate({ settingKey: "require_admin_approval", settingValue: checked })
                  }
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="font-medium">Auto-Publish Threshold</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Minimum AI confidence score for auto-publish
                  </p>
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings?.auto_publish_threshold ?? 0.85}
                    onChange={(e) =>
                      updateSettings.mutate({
                        settingKey: "auto_publish_threshold",
                        settingValue: parseFloat(e.target.value),
                      })
                    }
                    className="w-32"
                  />
                </div>

                <div>
                  <Label className="font-medium">Max Daily Generations</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Maximum pages to generate per day
                  </p>
                  <Input
                    type="number"
                    min="1"
                    max="1000"
                    value={settings?.max_daily_generations ?? 100}
                    onChange={(e) =>
                      updateSettings.mutate({
                        settingKey: "max_daily_generations",
                        settingValue: parseInt(e.target.value),
                      })
                    }
                    className="w-32"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="font-medium">Content Min Words</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Minimum word count for generated content
                  </p>
                  <Input
                    type="number"
                    min="100"
                    max="2000"
                    value={settings?.content_min_words ?? 400}
                    onChange={(e) =>
                      updateSettings.mutate({
                        settingKey: "content_min_words",
                        settingValue: parseInt(e.target.value),
                      })
                    }
                    className="w-32"
                  />
                </div>

                <div>
                  <Label className="font-medium">Content Max Words</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Maximum word count for generated content
                  </p>
                  <Input
                    type="number"
                    min="200"
                    max="5000"
                    value={settings?.content_max_words ?? 800}
                    onChange={(e) =>
                      updateSettings.mutate({
                        settingKey: "content_max_words",
                        settingValue: parseInt(e.target.value),
                      })
                    }
                    className="w-32"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SEO Safety */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                SEO Safety Rules
              </CardTitle>
              <CardDescription>
                Built-in protections to ensure quality content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-800">Active Protections</span>
                  </div>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• Duplicate content detection (Jaccard similarity)</li>
                    <li>• Spam pattern blocking ("near me", "#1", etc.)</li>
                    <li>• Meta length validation</li>
                    <li>• Keyword density limits</li>
                    <li>• E-E-A-T compliance checks</li>
                  </ul>
                </div>
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="font-medium text-amber-800">Blocked Patterns</span>
                  </div>
                  <ul className="text-sm text-amber-700 space-y-1">
                    <li>• "near me" / "nearby"</li>
                    <li>• "best ... in"</li>
                    <li>• "top ... dentist"</li>
                    <li>• "#1 dentist"</li>
                    <li>• Fake statistics</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Content Version History
              </CardTitle>
              <CardDescription>
                Track all changes and rollback if needed
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.recentChanges && stats.recentChanges.length > 0 ? (
                <div className="space-y-3">
                  {stats.recentChanges.map((change: any) => (
                    <div
                      key={change.id}
                      className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline">{change.page_type}</Badge>
                            <span className="font-medium">{change.field_name}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Trigger: {change.change_trigger}
                          </p>
                          {change.ai_confidence_score && (
                            <p className="text-sm text-muted-foreground">
                              AI Confidence: {(change.ai_confidence_score * 100).toFixed(0)}%
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm">
                            {change.created_at && format(new Date(change.created_at), "MMM d, yyyy")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {change.created_at && format(new Date(change.created_at), "h:mm a")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No version history yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Queue Row Component
function QueueRow({
  item,
  isSelected,
  onToggleSelect,
  onPublish,
  onReject,
  onRegenerate,
  isPublishing,
  isRejecting,
  isRegenerating,
}: {
  item: QueueItem;
  isSelected: boolean;
  onToggleSelect: () => void;
  onPublish: () => void;
  onReject: () => void;
  onRegenerate: () => void;
  isPublishing: boolean;
  isRejecting: boolean;
  isRegenerating: boolean;
}) {
  const canPublish = item.status === "generated" && item.seo_validation_passed;
  const canRegenerate = item.status === "failed" || item.status === "generated";

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "processing":
        return <Badge className="bg-blue-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
      case "generated":
        return <Badge className="bg-amber-500"><FileText className="h-3 w-3 mr-1" />Generated</Badge>;
      case "published":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Published</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <tr className="border-b hover:bg-muted/30 transition-colors">
      <td className="p-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
          disabled={!canPublish}
        />
      </td>
      <td className="p-3">
        <div className="font-medium">{item.entity_slug}</div>
        {item.error_message && (
          <p className="text-xs text-destructive mt-1 truncate max-w-[200px]">
            {item.error_message}
          </p>
        )}
      </td>
      <td className="p-3">
        <Badge variant="outline" className="capitalize">
          {item.page_type}
        </Badge>
      </td>
      <td className="p-3">{getStatusBadge(item.status)}</td>
      <td className="p-3">
        {item.ai_confidence_score != null ? (
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                item.ai_confidence_score >= 0.8
                  ? "bg-green-500"
                  : item.ai_confidence_score >= 0.6
                  ? "bg-amber-500"
                  : "bg-red-500"
              }`}
            />
            <span className="text-sm">{(item.ai_confidence_score * 100).toFixed(0)}%</span>
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>
      <td className="p-3 text-sm text-muted-foreground">
        {item.created_at && format(new Date(item.created_at), "MMM d, h:mm a")}
      </td>
      <td className="p-3 text-right">
        <div className="flex items-center justify-end gap-1">
          {canPublish && (
            <Button
              size="sm"
              variant="ghost"
              className="text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={onPublish}
              disabled={isPublishing}
            >
              {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            </Button>
          )}
          {canRegenerate && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onRegenerate}
              disabled={isRegenerating}
            >
              {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          )}
          {item.status !== "published" && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onReject}
              disabled={isRejecting}
            >
              {isRejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
