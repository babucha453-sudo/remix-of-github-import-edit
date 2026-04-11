import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle, XCircle, AlertTriangle, Search, FileSearch, ExternalLink, Shield } from "lucide-react";
import { INDEXABLE_PAGES, PRIVATE_PAGES, classifyPath, isPathIndexable } from "@/config/pageRegistry";

interface SEOCheckResult {
  url: string;
  classification: {
    indexable: boolean;
    renderMode: string;
    pageType: string | null;
    matchedRoute: string | null;
  };
  checks: {
    hasTitle: boolean;
    titleLength: number;
    titleText: string;
    hasDescription: boolean;
    descriptionLength: number;
    descriptionText: string;
    hasH1: boolean;
    h1Text: string;
    hasCanonical: boolean;
    canonicalUrl: string;
    hasNoIndex: boolean;
    hasContent: boolean;
    contentWordCount: number;
    cacheStatus: string;
    statusCode: number;
  };
  score: number;
  issues: string[];
  warnings: string[];
}

export default function SeoHealthCheckTab() {
  const [testUrl, setTestUrl] = useState("");
  const [result, setResult] = useState<SEOCheckResult | null>(null);

  const checkMutation = useMutation({
    mutationFn: async (url: string): Promise<SEOCheckResult> => {
      // Clean and normalize the URL
      let path = url.trim();
      if (path.startsWith("http")) {
        try {
          const urlObj = new URL(path);
          path = urlObj.pathname;
        } catch {
          path = url;
        }
      }
      if (!path.startsWith("/")) path = "/" + path;

      // Fetch the static HTML version (what bots see)
      const staticUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/serve-static?path=${encodeURIComponent(path)}&test=1`;

      const res = await fetch(staticUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
      });

      const html = await res.text();
      const cacheStatus = res.headers.get('x-static-cache') || 'miss';
      const statusCode = res.status;

      // Parse HTML to extract SEO elements
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Extract elements
      const titleEl = doc.querySelector('title');
      const titleText = titleEl?.textContent || '';

      const descEl = doc.querySelector('meta[name="description"]');
      const descriptionText = descEl?.getAttribute('content') || '';

      const h1El = doc.querySelector('h1');
      const h1Text = h1El?.textContent?.trim() || '';

      const canonicalEl = doc.querySelector('link[rel="canonical"]');
      const canonicalUrl = canonicalEl?.getAttribute('href') || '';

      const robotsEl = doc.querySelector('meta[name="robots"]');
      const robotsContent = robotsEl?.getAttribute('content') || '';
      const hasNoIndex = robotsContent.toLowerCase().includes('noindex');

      // Content analysis
      const bodyText = doc.body?.textContent || '';
      const contentWordCount = bodyText.split(/\s+/).filter(Boolean).length;

      // Build result
      const checks = {
        hasTitle: !!titleText && titleText.length > 0,
        titleLength: titleText.length,
        titleText,
        hasDescription: !!descriptionText && descriptionText.length > 0,
        descriptionLength: descriptionText.length,
        descriptionText,
        hasH1: !!h1Text && h1Text.length > 0,
        h1Text,
        hasCanonical: !!canonicalUrl,
        canonicalUrl,
        hasNoIndex,
        hasContent: contentWordCount > 50,
        contentWordCount,
        cacheStatus: cacheStatus as any,
        statusCode,
      };

      // Classify the path using the new utility
      const classification = classifyPath(path);

      // Calculate issues and warnings
      const issues: string[] = [];
      const warnings: string[] = [];

      // Use the authoritative classification
      const shouldBeIndexable = classification.indexable;

      // CRITICAL: If indexable but has noindex, that's a major issue
      if (checks.hasNoIndex && shouldBeIndexable) {
        issues.push("⚠️ CRITICAL: Has noindex but page SHOULD be indexed (registry mismatch)");
      } else if (!checks.hasNoIndex && !shouldBeIndexable) {
        warnings.push("Missing noindex for private page");
      }

      // Cache status checks
      if (cacheStatus === 'miss' && shouldBeIndexable) {
        warnings.push("Page cache miss - on-demand prerendering used");
      } else if (cacheStatus === 'miss-indexable' && shouldBeIndexable) {
        issues.push("Page not cached and prerendering failed - minimal HTML served");
      } else if (cacheStatus === 'prerendered' || cacheStatus === 'prerendered-cached') {
        // This is actually good - on-demand prerendering worked
      }

      if (!checks.hasTitle) {
        issues.push("Missing <title> tag");
      } else if (checks.titleLength < 30) {
        warnings.push(`Title too short (${checks.titleLength} chars, min 30)`);
      } else if (checks.titleLength > 60) {
        warnings.push(`Title too long (${checks.titleLength} chars, max 60)`);
      }

      if (!checks.hasDescription) {
        issues.push("Missing meta description");
      } else if (checks.descriptionLength < 100) {
        warnings.push(`Description too short (${checks.descriptionLength} chars, min 100)`);
      } else if (checks.descriptionLength > 160) {
        warnings.push(`Description too long (${checks.descriptionLength} chars, max 160)`);
      }

      if (!checks.hasH1) {
        issues.push("Missing H1 tag");
      }

      if (!checks.hasCanonical && shouldBeIndexable) {
        warnings.push("Missing canonical URL");
      }

      if (!checks.hasContent) {
        issues.push(`Thin content (${checks.contentWordCount} words, min 50)`);
      } else if (checks.contentWordCount < 300 && shouldBeIndexable) {
        warnings.push(`Low word count (${checks.contentWordCount} words, aim for 300+)`);
      }

      // Calculate score
      let score = 100;
      score -= issues.length * 15;
      score -= warnings.length * 5;
      if (cacheStatus === 'hit' || cacheStatus === 'prerendered-cached') score += 10;
      score = Math.max(0, Math.min(100, score));

      return {
        url: path,
        classification,
        checks,
        score,
        issues,
        warnings,
      };
    },
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const handleCheck = () => {
    if (!testUrl.trim()) return;
    checkMutation.mutate(testUrl);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return "bg-green-500/10 text-green-500 border-green-500/20";
    if (score >= 60) return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    return "bg-red-500/10 text-red-500 border-red-500/20";
  };

  return (
    <div className="space-y-6">
      {/* Page Registry Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Indexable Page Patterns</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold text-green-500">{INDEXABLE_PAGES.length}</span>
            <p className="text-xs text-muted-foreground mt-1">Routes that need prerendering</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Private Page Patterns</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold text-muted-foreground">{PRIVATE_PAGES.length}</span>
            <p className="text-xs text-muted-foreground mt-1">CSR-only, noindex routes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Render Strategy</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-lg font-bold">Prerender + Bot Detection</span>
            <p className="text-xs text-muted-foreground mt-1">Vercel rewrites bots to static HTML</p>
          </CardContent>
        </Card>
      </div>

      {/* URL Checker */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5" />
            SEO Health Check
          </CardTitle>
          <CardDescription>
            Enter any URL to check its SEO health as seen by search engine bots
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="/ca/los-angeles or https://www.appointpanda.com/blog"
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCheck()}
              className="flex-1"
            />
            <Button onClick={handleCheck} disabled={checkMutation.isPending}>
              {checkMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-1" />
              )}
              Check
            </Button>
          </div>

          {/* Quick test links */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground">Quick test:</span>
            {["/", "/ca", "/ca/los-angeles", "/blog", "/clinic/smile-dental"].map((path) => (
              <Button
                key={path}
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  setTestUrl(path);
                  checkMutation.mutate(path);
                }}
              >
                {path}
              </Button>
            ))}
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-4 pt-4 border-t">
              {/* Score Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{result.url}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {/* Classification badge */}
                    <Badge
                      variant="outline"
                      className={result.classification.indexable ? 'bg-green-500/10 text-green-500' : 'bg-muted'}
                    >
                      <Shield className="h-3 w-3 mr-1" />
                      {result.classification.indexable ? 'INDEXABLE' : 'PRIVATE'}
                    </Badge>
                    {result.classification.pageType && (
                      <Badge variant="outline">
                        {result.classification.pageType}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={
                        result.checks.cacheStatus === 'hit' || result.checks.cacheStatus === 'prerendered-cached'
                          ? 'bg-green-500/10'
                          : result.checks.cacheStatus === 'prerendered'
                            ? 'bg-blue-500/10'
                            : 'bg-yellow-500/10'
                      }
                    >
                      Cache: {result.checks.cacheStatus}
                    </Badge>
                    <Badge variant="outline">
                      {result.checks.contentWordCount} words
                    </Badge>
                  </div>
                  {result.classification.matchedRoute && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Matched route: <code className="bg-muted px-1 rounded">{result.classification.matchedRoute}</code>
                    </p>
                  )}
                </div>
                <div className={`text-4xl font-bold ${getScoreColor(result.score)}`}>
                  {result.score}
                </div>
              </div>

              {/* Issues */}
              {result.issues.length > 0 && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="font-medium text-red-500 mb-2 flex items-center gap-1">
                    <XCircle className="h-4 w-4" />
                    Issues ({result.issues.length})
                  </p>
                  <ul className="space-y-1">
                    {result.issues.map((issue, i) => (
                      <li key={i} className="text-sm text-red-400">• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="font-medium text-yellow-500 mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    Warnings ({result.warnings.length})
                  </p>
                  <ul className="space-y-1">
                    {result.warnings.map((warning, i) => (
                      <li key={i} className="text-sm text-yellow-400">• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Success */}
              {result.issues.length === 0 && result.warnings.length === 0 && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="font-medium text-green-500 flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" />
                    All checks passed!
                  </p>
                </div>
              )}

              {/* Detailed Checks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Title Tag</h4>
                  <div className="flex items-center gap-2">
                    {result.checks.hasTitle ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm truncate max-w-xs" title={result.checks.titleText}>
                      {result.checks.titleText || "Missing"}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {result.checks.titleLength} chars
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Meta Description</h4>
                  <div className="flex items-center gap-2">
                    {result.checks.hasDescription ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm truncate max-w-xs" title={result.checks.descriptionText}>
                      {result.checks.descriptionText?.substring(0, 50) || "Missing"}...
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {result.checks.descriptionLength} chars
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">H1 Tag</h4>
                  <div className="flex items-center gap-2">
                    {result.checks.hasH1 ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm truncate max-w-xs" title={result.checks.h1Text}>
                      {result.checks.h1Text || "Missing"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Canonical URL</h4>
                  <div className="flex items-center gap-2">
                    {result.checks.hasCanonical ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className="text-sm truncate max-w-xs">
                      {result.checks.canonicalUrl || "Not set"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Robots Directive</h4>
                  <div className="flex items-center gap-2">
                    {!result.checks.hasNoIndex ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className="text-sm">
                      {result.checks.hasNoIndex ? "noindex (blocked)" : "index, follow"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Content</h4>
                  <div className="flex items-center gap-2">
                    {result.checks.hasContent ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm">
                      {result.checks.contentWordCount} words
                    </span>
                  </div>
                </div>
              </div>

              {/* View Live */}
              <div className="pt-4 border-t">
                <Button variant="outline" asChild>
                  <a
                    href={`https://www.appointpanda.com${result.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Live Page
                  </a>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Page Registry Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Page Registry</CardTitle>
          <CardDescription>
            All routes classified by indexability and render mode
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2 text-green-500">Indexable Pages (Prerender)</h4>
              <div className="flex flex-wrap gap-2">
                {INDEXABLE_PAGES.map((page) => (
                  <Badge key={page.route} variant="outline" className="bg-green-500/10">
                    {page.route}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2 text-muted-foreground">Private Pages (CSR)</h4>
              <div className="flex flex-wrap gap-2">
                {PRIVATE_PAGES.map((page) => (
                  <Badge key={page.route} variant="outline" className="bg-muted">
                    {page.route}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
