import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { 
  Sparkles, Settings, BarChart3, Search, TrendingUp, AlertCircle, 
  RefreshCw, Download, Eye, Clock, Target, Zap
} from "lucide-react";
import { format, subDays } from "date-fns";

interface RankingWeights {
  service_match: number;
  budget_fit: number;
  location_proximity: number;
  rating: number;
  profile_completeness: number;
  paid_bonus: number;
}

interface SearchLog {
  id: string;
  original_query: string;
  extracted_intent: any;
  results_count: number;
  search_duration_ms: number;
  fallback_used: boolean;
  clicked_result_id: string | null;
  created_at: string;
}

export function AISearchControlTab() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("settings");
  const [dateRange, setDateRange] = useState(7);

  // Fetch settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["ai-search-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_search_settings")
        .select("*");
      if (error) throw error;
      
      const settingsMap: Record<string, any> = {};
      data?.forEach(s => {
        settingsMap[s.setting_key] = s.setting_value;
      });
      return settingsMap;
    },
  });

  // Fetch search logs
  const { data: searchLogs, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ["ai-search-logs", dateRange],
    queryFn: async () => {
      const startDate = subDays(new Date(), dateRange).toISOString();
      const { data, error } = await supabase
        .from("ai_search_logs")
        .select("*")
        .gte("created_at", startDate)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as SearchLog[];
    },
  });

  // Update setting mutation
  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { error } = await supabase
        .from("ai_search_settings")
        .update({ setting_value: value, updated_at: new Date().toISOString() })
        .eq("setting_key", key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-search-settings"] });
      toast.success("Setting updated");
    },
    onError: (error) => {
      toast.error("Failed to update setting");
      console.error(error);
    },
  });

  const handleToggleAISearch = (enabled: boolean) => {
    updateSetting.mutate({ key: "ai_search_enabled", value: { enabled } });
  };

  const handleTogglePaidPriority = (enabled: boolean) => {
    updateSetting.mutate({ key: "paid_priority_enabled", value: { enabled } });
  };

  const handleWeightChange = (key: keyof RankingWeights, value: number) => {
    const currentWeights = settings?.ranking_weights || {};
    const newWeights = { ...currentWeights, [key]: value / 100 };
    updateSetting.mutate({ key: "ranking_weights", value: newWeights });
  };

  // Calculate analytics
  const analytics = searchLogs ? {
    totalSearches: searchLogs.length,
    avgDuration: searchLogs.length > 0 
      ? Math.round(searchLogs.reduce((sum, l) => sum + (l.search_duration_ms || 0), 0) / searchLogs.length)
      : 0,
    noResults: searchLogs.filter(l => l.results_count === 0).length,
    clickRate: searchLogs.length > 0
      ? Math.round((searchLogs.filter(l => l.clicked_result_id).length / searchLogs.length) * 100)
      : 0,
    fallbackRate: searchLogs.length > 0
      ? Math.round((searchLogs.filter(l => l.fallback_used).length / searchLogs.length) * 100)
      : 0,
    topQueries: getTopQueries(searchLogs),
    noResultQueries: searchLogs.filter(l => l.results_count === 0).slice(0, 10),
  } : null;

  const aiEnabled = settings?.ai_search_enabled?.enabled !== false;
  const paidPriority = settings?.paid_priority_enabled?.enabled !== false;
  const weights: RankingWeights = settings?.ranking_weights || {
    service_match: 0.25,
    budget_fit: 0.20,
    location_proximity: 0.20,
    rating: 0.15,
    profile_completeness: 0.10,
    paid_bonus: 0.10,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">AI Search Control</h2>
            <p className="text-muted-foreground">Manage AI-powered search settings and analytics</p>
          </div>
        </div>
        <Badge variant={aiEnabled ? "default" : "secondary"} className="gap-1">
          <Zap className="h-3 w-3" />
          {aiEnabled ? "AI Search Active" : "AI Search Disabled"}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Search className="h-4 w-4" />
            Search Logs
          </TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Main Controls */}
            <Card>
              <CardHeader>
                <CardTitle>Search Controls</CardTitle>
                <CardDescription>Enable or disable AI search features</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable AI Search</Label>
                    <p className="text-sm text-muted-foreground">
                      Use Gemini AI for intent extraction
                    </p>
                  </div>
                  <Switch
                    checked={aiEnabled}
                    onCheckedChange={handleToggleAISearch}
                    disabled={settingsLoading}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Paid Dentist Priority</Label>
                    <p className="text-sm text-muted-foreground">
                      Boost paid dentists in search rankings
                    </p>
                  </div>
                  <Switch
                    checked={paidPriority}
                    onCheckedChange={handleTogglePaidPriority}
                    disabled={settingsLoading}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Ranking Weights */}
            <Card>
              <CardHeader>
                <CardTitle>Ranking Weights</CardTitle>
                <CardDescription>Adjust how results are scored and ranked</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {Object.entries(weights).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <Label className="capitalize">{key.replace(/_/g, " ")}</Label>
                      <span className="text-muted-foreground">{Math.round(value * 100)}%</span>
                    </div>
                    <Slider
                      value={[value * 100]}
                      onValueChange={([v]) => handleWeightChange(key as keyof RankingWeights, v)}
                      max={50}
                      step={5}
                      className="w-full"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          {/* Date Range Selector */}
          <div className="flex items-center gap-4">
            <Label>Date Range:</Label>
            <div className="flex gap-2">
              {[7, 14, 30].map((days) => (
                <Button
                  key={days}
                  variant={dateRange === days ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateRange(days)}
                >
                  {days} days
                </Button>
              ))}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total Searches</span>
                </div>
                <p className="text-2xl font-bold mt-2">{analytics?.totalSearches || 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Avg Duration</span>
                </div>
                <p className="text-2xl font-bold mt-2">{analytics?.avgDuration || 0}ms</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Click Rate</span>
                </div>
                <p className="text-2xl font-bold mt-2">{analytics?.clickRate || 0}%</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">No Results</span>
                </div>
                <p className="text-2xl font-bold mt-2">{analytics?.noResults || 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Fallback Rate</span>
                </div>
                <p className="text-2xl font-bold mt-2">{analytics?.fallbackRate || 0}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Top Queries & No Result Queries */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Top Queries
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analytics?.topQueries && analytics.topQueries.length > 0 ? (
                  <div className="space-y-2">
                    {analytics.topQueries.map((q, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <span className="text-sm truncate">{q.query}</span>
                        <Badge variant="secondary">{q.count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No data yet</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-warning" />
                  No-Result Queries
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analytics?.noResultQueries && analytics.noResultQueries.length > 0 ? (
                  <div className="space-y-2">
                    {analytics.noResultQueries.map((log, i) => (
                      <div key={i} className="p-2 rounded-lg bg-muted/50">
                        <p className="text-sm truncate">{log.original_query}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), "MMM d, h:mm a")}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No failed searches</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Search Logs</CardTitle>
                <CardDescription>Recent AI search queries and results</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchLogs()} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Query</TableHead>
                      <TableHead>Intent</TableHead>
                      <TableHead>Results</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Clicked</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchLogs?.slice(0, 50).map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="max-w-[200px] truncate font-medium">
                          {log.original_query}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {log.extracted_intent?.treatments?.slice(0, 2).map((t: string, i: number) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.results_count > 0 ? "default" : "destructive"}>
                            {log.results_count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {log.search_duration_ms}ms
                        </TableCell>
                        <TableCell>
                          {log.clicked_result_id ? (
                            <Eye className="h-4 w-4 text-primary" />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(log.created_at), "MMM d, h:mm a")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function getTopQueries(logs: SearchLog[]): { query: string; count: number }[] {
  const queryCount = new Map<string, number>();
  logs.forEach(log => {
    const q = log.original_query.toLowerCase().trim();
    queryCount.set(q, (queryCount.get(q) || 0) + 1);
  });
  
  return Array.from(queryCount.entries())
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}
