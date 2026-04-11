import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sparkles, Loader2, MapPin, DollarSign, Shield, AlertCircle, ArrowRight, X, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAISearch, SearchResult, AISearchResponse } from "@/hooks/useAISearch";

interface AISmartSearchProps {
  variant?: "hero" | "compact" | "default";
  className?: string;
  onResultClick?: (result: SearchResult) => void;
  // Context for dynamic examples
  contextCity?: string;
  contextState?: string;
  contextService?: string;
}

// Generate context-aware example queries
function generateExamples(city?: string, state?: string, service?: string): string[] {
  const examples: string[] = [];
  
  if (service && city) {
    // Service + Location page examples
    examples.push(`Affordable ${service.toLowerCase()} in ${city}`);
    examples.push(`Best ${service.toLowerCase()} specialist near me`);
    examples.push(`${service} under $2,000`);
    examples.push(`Emergency ${service.toLowerCase()} today`);
  } else if (city) {
    // City page examples
    examples.push(`Teeth whitening in ${city}`);
    examples.push(`Affordable dentist in ${city}`);
    examples.push(`Emergency dental care ${city}`);
    examples.push(`Invisalign specialist near me`);
  } else if (service) {
    // Service page examples
    examples.push(`${service} under $3,000`);
    examples.push(`Best ${service.toLowerCase()} near me`);
    examples.push(`${service} with financing options`);
    examples.push(`Affordable ${service.toLowerCase()} in California`);
  } else {
    // Homepage/generic examples
    examples.push(`Dental implants under $2,500`);
    examples.push(`Affordable dentist near me`);
    examples.push(`Emergency tooth extraction today`);
    examples.push(`Teeth whitening in Los Angeles`);
  }
  
  return examples.slice(0, 4);
}

export function AISmartSearch({ 
  variant = "hero", 
  className, 
  onResultClick,
  contextCity,
  contextState,
  contextService,
}: AISmartSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [typingIndicator, setTypingIndicator] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const { search, isSearching, results, response, error, clear } = useAISearch({
    onSuccess: (data) => {
      // Auto-redirect if single strong match
      if (data.redirectTo && data.results.length === 1) {
        navigate(data.redirectTo);
      }
    },
  });

  // Dynamic examples based on context
  const exampleQueries = useMemo(
    () => generateExamples(contextCity, contextState, contextService),
    [contextCity, contextState, contextService]
  );

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced live search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Show typing indicator
    if (query.trim().length >= 3 && query.trim().length < 10) {
      setTypingIndicator("Understanding your request...");
    } else if (query.trim().length >= 10) {
      setTypingIndicator("Matching clinics to your needs...");
    } else {
      setTypingIndicator("");
    }

    // Debounce search (500ms after typing stops)
    if (query.trim().length >= 3) {
      debounceRef.current = setTimeout(() => {
        setTypingIndicator("");
        search(query);
        setShowResults(true);
      }, 600);
    } else {
      clear();
      setShowResults(false);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, search, clear]);

  const handleResultClick = useCallback((result: SearchResult) => {
    if (onResultClick) {
      onResultClick(result);
    } else {
      navigate(`/clinic/${result.slug}`);
    }
    setShowResults(false);
  }, [navigate, onResultClick]);

  const handleExampleClick = useCallback((example: string) => {
    setQuery(example);
    inputRef.current?.focus();
  }, []);

  const handleClear = useCallback(() => {
    setQuery("");
    clear();
    setShowResults(false);
    inputRef.current?.focus();
  }, [clear]);

  if (variant === "hero") {
    return (
      <div ref={containerRef} className={cn("w-full max-w-4xl mx-auto", className)}>
        {/* Main Search Box */}
        <div className="bg-card/90 backdrop-blur-xl border border-border/50 rounded-2xl md:rounded-3xl p-3 md:p-4 shadow-2xl shadow-primary/10">
          {/* AI Badge */}
          <div className="flex items-center gap-2 mb-2 md:mb-3">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 gap-1 md:gap-1.5 text-xs md:text-sm px-2 md:px-3 py-0.5 md:py-1">
              <Sparkles className="h-2.5 w-2.5 md:h-3 md:w-3" />
              AI Smart Search
            </Badge>
            <span className="text-[10px] md:text-xs text-muted-foreground hidden md:inline">
              Just type naturally — no filters needed
            </span>
          </div>

          {/* Search Input - No Button */}
          <div className="relative">
            <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length > 0 && setShowResults(true)}
              placeholder="e.g., cleaning under $80 in Boston..."
              className="h-12 md:h-14 pl-10 md:pl-12 pr-10 md:pr-12 text-sm md:text-base rounded-xl md:rounded-2xl border-border bg-muted/30 focus-visible:ring-primary"
            />
            <div className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {isSearching && (
                <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin text-primary" />
              )}
              {query && !isSearching && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClear}
                  className="h-7 w-7 md:h-8 md:w-8 rounded-full"
                >
                  <X className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Typing Indicator */}
          {typingIndicator && !isSearching && (
            <div className="mt-2 flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
              <div className="flex gap-1">
                <span className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>{typingIndicator}</span>
            </div>
          )}

          {/* Follow-up Question */}
          {response?.followUpQuestion && !typingIndicator && !isSearching && (
            <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
              <p className="text-sm text-primary font-medium flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                {response.followUpQuestion}
              </p>
            </div>
          )}

          {/* Example Queries - Mobile optimized */}
          {!showResults && !typingIndicator && !response?.followUpQuestion && (
            <div className="mt-3 md:mt-4 flex flex-wrap gap-1.5 md:gap-2">
              <span className="text-[10px] md:text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-2.5 w-2.5 md:h-3 md:w-3" />
                Try:
              </span>
              {exampleQueries.map((example, i) => (
                <button
                  key={i}
                  onClick={() => handleExampleClick(example)}
                  className="text-[10px] md:text-xs px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  "{example}"
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results Dropdown */}
        {showResults && (
          <div className="mt-3 bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95">
            {/* Processing State */}
            {isSearching && (
              <div className="p-6 flex items-center justify-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-muted-foreground">Finding the best matches for you...</span>
              </div>
            )}

            {/* Error State */}
            {error && !isSearching && (
              <div className="p-6 flex items-center gap-3 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            )}

            {/* Intent Summary */}
            {response && !isSearching && (
              <div className="p-4 border-b border-border bg-muted/30">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Looking for:</span>
                  {response.intent.treatments.map((t, i) => (
                    <Badge key={i} variant="secondary" className="capitalize">
                      {t}
                    </Badge>
                  ))}
                  {response.intent.location.city && (
                    <Badge variant="outline" className="gap-1">
                      <MapPin className="h-3 w-3" />
                      {response.intent.location.city}
                    </Badge>
                  )}
                  {response.intent.budget.max && (
                    <Badge variant="outline" className="gap-1">
                      <DollarSign className="h-3 w-3" />
                      Under ${response.intent.budget.max.toLocaleString()}
                    </Badge>
                  )}
                  {response.intent.insurance && (
                    <Badge variant="outline" className="gap-1">
                      <Shield className="h-3 w-3" />
                      {response.intent.insurance}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Results List */}
            {results.length > 0 && !isSearching && (
              <div className="max-h-[400px] overflow-y-auto">
                {results.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleResultClick(result)}
                    className="w-full p-4 flex items-start gap-4 hover:bg-muted/50 transition-colors border-b border-border last:border-0 text-left"
                  >
                    {/* Image */}
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted shrink-0">
                      {result.cover_image_url ? (
                        <img
                          src={result.cover_image_url}
                          alt={result.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <MapPin className="h-8 w-8" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-semibold text-foreground truncate">
                            {result.name}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {result.city_name}, {result.state_slug.toUpperCase()}
                          </p>
                        </div>
                        {result.is_paid && (
                          <Badge variant="default" className="shrink-0 bg-primary/10 text-primary border-primary/20">
                            Verified
                          </Badge>
                        )}
                      </div>

                      {/* Rating */}
                      {result.rating > 0 && (
                        <div className="flex items-center gap-1 mt-1 text-sm">
                          <span className="text-amber-500">★</span>
                          <span className="font-medium">{result.rating.toFixed(1)}</span>
                          <span className="text-muted-foreground">
                            ({result.review_count} reviews)
                          </span>
                        </div>
                      )}

                      {/* Match Reasons */}
                      {result.match_reasons.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {result.match_reasons.slice(0, 3).map((reason, i) => (
                            <span
                              key={i}
                              className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary"
                            >
                              ✓ {reason}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* CTA */}
                    <div className="shrink-0">
                      <Button
                        variant={result.is_paid ? "default" : "outline"}
                        size="sm"
                        className="gap-1"
                      >
                        {result.is_paid ? "Book Now" : "View"}
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* No Results */}
            {results.length === 0 && response && !isSearching && (
              <div className="p-6 text-center">
                <p className="text-muted-foreground mb-4">
                  No exact matches found. Try a different search term.
                </p>
                {response.suggestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Suggestions:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {response.suggestions.map((s, i) => (
                        <li key={i}>• {s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Follow-up Question */}
            {response?.followUpQuestion && !isSearching && results.length > 0 && (
              <div className="p-4 border-t border-border bg-primary/5">
                <p className="text-sm text-primary font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  {response.followUpQuestion}
                </p>
              </div>
            )}

            {/* Footer Stats */}
            {response && !isSearching && (
              <div className="p-3 border-t border-border bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {response.totalCount} result{response.totalCount !== 1 ? "s" : ""} found
                </span>
                <span>
                  Matched in {response.searchDurationMs}ms
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Compact variant for header/inline - Mobile optimized
  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative flex items-center">
        <Sparkles className="absolute left-2.5 md:left-3 h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="AI Search..."
          className="h-9 md:h-10 pl-8 md:pl-9 pr-9 md:pr-10 text-xs md:text-sm rounded-full border-border bg-muted/50"
        />
        {isSearching && (
          <Loader2 className="absolute right-2.5 md:right-3 h-3.5 w-3.5 md:h-4 md:w-4 animate-spin text-primary" />
        )}
        {query && !isSearching && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="absolute right-1 h-7 w-7 md:h-8 md:w-8 rounded-full"
          >
            <X className="h-3.5 w-3.5 md:h-4 md:w-4" />
          </Button>
        )}
      </div>

      {/* Compact Results Dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-50 max-h-72 md:max-h-80 overflow-y-auto">
          {results.slice(0, 5).map((result) => (
            <button
              key={result.id}
              onClick={() => handleResultClick(result)}
              className="w-full p-2.5 md:p-3 flex items-center gap-2.5 md:gap-3 hover:bg-muted/50 transition-colors border-b border-border last:border-0 text-left"
            >
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                {result.cover_image_url ? (
                  <img
                    src={result.cover_image_url}
                    alt={result.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <MapPin className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-xs md:text-sm truncate">{result.name}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground">
                  {result.city_name} • {result.rating > 0 && `★ ${result.rating.toFixed(1)}`}
                </p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default AISmartSearch;
