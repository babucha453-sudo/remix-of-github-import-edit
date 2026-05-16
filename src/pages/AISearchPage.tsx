import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { 
  Search, Sparkles, MapPin, DollarSign, Star, Shield, Clock, 
  ArrowRight, Loader2, Building2, CheckCircle, Navigation, MessageCircle, Send
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useRealCounts } from "@/hooks/useRealCounts";
import { SEOHead } from "@/components/seo/SEOHead";
import { StructuredData } from "@/components/seo/StructuredData";
import { useAISearch, type SearchResult, type AISearchResponse } from "@/hooks/useAISearch";
import { cn } from "@/lib/utils";

// Service suggestions for quick selection
const SERVICE_SUGGESTIONS = [
  { label: "Cleaning", value: "cleaning" },
  { label: "Implants", value: "dental implants" },
  { label: "Whitening", value: "teeth whitening" },
  { label: "Braces", value: "braces" },
  { label: "Root Canal", value: "root canal" },
  { label: "Veneers", value: "veneers" },
];

// Location suggestions
const LOCATION_SUGGESTIONS = [
  { label: "Los Angeles, CA", value: "Los Angeles" },
  { label: "Boston, MA", value: "Boston" },
  { label: "Hartford, CT", value: "Hartford" },
  { label: "San Francisco, CA", value: "San Francisco" },
  { label: "Near Me", value: "near me", isNearMe: true },
];

const SEARCH_STEPS = [
  { label: "Understanding your needs", icon: Sparkles },
  { label: "Matching budget & service", icon: DollarSign },
  { label: "Finding dentists", icon: Search },
  { label: "Ranking by relevance", icon: Star },
];

interface ConversationMessage {
  type: "user" | "assistant";
  text: string;
  suggestions?: Array<{ label: string; value: string; isNearMe?: boolean }>;
}

const AISearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  
  const [query, setQuery] = useState(initialQuery);
  const [currentStep, setCurrentStep] = useState(0);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [conversationContext, setConversationContext] = useState<{
    budget?: number;
    service?: string;
    location?: string;
  }>({});
  
  const inputRef = useRef<HTMLInputElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  
  const { data: realCounts } = useRealCounts();
  const { search, results, isSearching, response, error, requestLocationPermission } = useAISearch();

  // Run initial search if query param exists
  useEffect(() => {
    if (initialQuery) {
      handleUserInput(initialQuery);
    }
  }, []);

  // Animate progress steps
  useEffect(() => {
    if (isSearching) {
      setCurrentStep(0);
      const interval = setInterval(() => {
        setCurrentStep(prev => (prev < SEARCH_STEPS.length - 1 ? prev + 1 : prev));
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isSearching]);

  // Scroll to bottom of conversation
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, response]);

  const handleUserInput = async (input: string) => {
    if (!input.trim()) return;

    // Add user message to conversation
    setConversation(prev => [...prev, { type: "user", text: input }]);
    
    // Build the full query with context
    let fullQuery = input;
    
    // Check if this is answering a follow-up question
    if (response?.conversationStep === "ask_service" || (!conversationContext.service && conversationContext.budget)) {
      // User is providing service
      setConversationContext(prev => ({ ...prev, service: input }));
      fullQuery = `${input} under $${conversationContext.budget}`;
    } else if (response?.conversationStep === "ask_location" || (conversationContext.service && !conversationContext.location)) {
      // User is providing location
      setConversationContext(prev => ({ ...prev, location: input }));
      fullQuery = `${conversationContext.service} under $${conversationContext.budget || ''} in ${input}`.trim();
    } else {
      // Check if it's a budget-only query
      const budgetMatch = input.match(/(?:under|below|max|budget)\s*\$?(\d+)/i);
      if (budgetMatch && !input.match(/cleaning|implant|whitening|braces|veneers|root canal|extraction|crown/i)) {
        setConversationContext({ budget: parseInt(budgetMatch[1]) });
      }
    }
    
    // Clear input and search
    setQuery("");
    setSearchParams({ q: fullQuery });
    await search(fullQuery);
  };

  const handleSuggestionClick = async (value: string, isNearMe?: boolean) => {
    if (isNearMe) {
      const location = await requestLocationPermission();
      if (location) {
        handleUserInput("near me");
      } else {
        setConversation(prev => [...prev, { 
          type: "assistant", 
          text: "I couldn't access your location. Please type your city name instead."
        }]);
      }
    } else {
      handleUserInput(value);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleUserInput(query);
    }
  };

  // Build assistant response with follow-up
  const getAssistantMessage = (): ConversationMessage | null => {
    if (!response) return null;
    
    if (response.followUpQuestion) {
      let suggestions: Array<{ label: string; value: string; isNearMe?: boolean }> = [];
      
      if (response.conversationStep === "ask_service") {
        suggestions = SERVICE_SUGGESTIONS;
      } else if (response.conversationStep === "ask_location") {
        suggestions = LOCATION_SUGGESTIONS;
      }
      
      return {
        type: "assistant",
        text: response.followUpQuestion,
        suggestions,
      };
    }
    
    if (results.length > 0) {
      return {
        type: "assistant",
        text: `Found ${results.length} dentist${results.length !== 1 ? 's' : ''} matching your criteria${response.intent?.budget?.max ? ` within $${response.intent.budget.max}` : ''}${response.intent?.location?.city ? ` in ${response.intent.location.city}` : ''}.`,
      };
    }
    
    return null;
  };

  const assistantMessage = getAssistantMessage();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="Smart Dental Search | Find Dentists by Budget & Location | AppointPanda"
        description="Tell us what you need, your budget, and location. Our AI finds the perfect dentist match instantly."
        canonical="/search/"
        keywords={["budget dental search", "affordable dentist", "find dentist near me", "dental care finder"]}
      />
      <StructuredData
        type="breadcrumb"
        items={[
          { name: "Home", url: "/" },
          { name: "Find Dentist", url: "/search/" },
        ]}
      />
      <Navbar />

      {/* Main Content - Mobile-first flex layout */}
      <main className="flex-1 flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Hero Header - Compact on mobile */}
        <div className="relative px-4 pt-6 pb-4 md:pt-10 md:pb-6">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 md:w-[400px] md:h-[400px] bg-primary/20 rounded-full blur-3xl opacity-50" />
            <div className="absolute bottom-0 left-0 w-48 h-48 md:w-[300px] md:h-[300px] bg-teal/15 rounded-full blur-3xl" />
          </div>
          
          <div className="relative z-10 text-center max-w-3xl mx-auto">
            <Badge className="bg-primary/20 text-primary border-primary/30 rounded-full px-4 py-1.5 text-xs md:text-sm font-bold mb-3 md:mb-4">
              <MessageCircle className="h-3 w-3 md:h-4 md:w-4 mr-1" />
              Smart Search
            </Badge>

            <h1 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-2 md:mb-3">
              Just Tell Us What You Need
            </h1>
            <p className="text-sm md:text-base text-white/60 max-w-xl mx-auto">
              Describe your dental needs naturally — we'll find the perfect match.
            </p>
            
            {/* Stats - Compact on mobile */}
            <div className="flex justify-center gap-3 md:gap-4 mt-4 md:mt-6">
              <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5 md:px-3 md:py-2">
                <Building2 className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                <span className="text-white font-bold text-xs md:text-sm">{realCounts?.clinics?.toLocaleString() || 0}+</span>
                <span className="text-white/60 text-xs hidden md:inline">Clinics</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5 md:px-3 md:py-2">
                <MapPin className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                <span className="text-white font-bold text-xs md:text-sm">{realCounts?.cities?.toLocaleString() || 0}+</span>
                <span className="text-white/60 text-xs hidden md:inline">Cities</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5 md:px-3 md:py-2">
                <Shield className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                <span className="text-white font-bold text-xs md:text-sm">100%</span>
                <span className="text-white/60 text-xs hidden md:inline">Verified</span>
              </div>
            </div>
          </div>
        </div>

        {/* Conversation Area - Scrollable on mobile */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Initial prompt if no conversation */}
            {conversation.length === 0 && !results.length && !isSearching && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6">
                <p className="text-white font-medium mb-4 text-center text-sm md:text-base">
                  💡 Try searching by service, budget, and location:
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    "Cleaning under $80 in Boston",
                    "Implants under $1500 near me",
                    "Affordable whitening in LA",
                  ].map((example, i) => (
                    <button
                      key={i}
                      onClick={() => handleUserInput(example)}
                      className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/30 rounded-xl px-3 py-2 text-xs md:text-sm text-white/70 hover:text-white transition-all"
                    >
                      "{example}"
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Conversation Messages */}
            {conversation.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  msg.type === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 text-sm md:text-base",
                    msg.type === "user"
                      ? "bg-primary text-white rounded-br-md"
                      : "bg-white/10 text-white rounded-bl-md"
                  )}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {/* Loading State */}
            {isSearching && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="space-y-2">
                  {SEARCH_STEPS.map((step, index) => {
                    const StepIcon = step.icon;
                    const isActive = index === currentStep;
                    const isCompleted = index < currentStep;

                    return (
                      <div
                        key={step.label}
                        className={cn(
                          "flex items-center gap-3 transition-all text-sm",
                          isActive ? "text-primary" : isCompleted ? "text-primary/60" : "text-white/30"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center",
                          isActive ? "bg-primary text-white" : isCompleted ? "bg-primary/20" : "bg-white/10"
                        )}>
                          {isActive ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : isCompleted ? (
                            <CheckCircle className="h-3 w-3" />
                          ) : (
                            <StepIcon className="h-3 w-3" />
                          )}
                        </div>
                        <span>{step.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Assistant Follow-up with Suggestions */}
            {assistantMessage && !isSearching && (
              <div className="space-y-3">
                <div className="flex justify-start">
                  <div className="max-w-[85%] md:max-w-[75%] bg-white/10 text-white rounded-2xl rounded-bl-md px-4 py-3 text-sm md:text-base">
                    {assistantMessage.text}
                  </div>
                </div>
                
                {assistantMessage.suggestions && assistantMessage.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2 pl-2">
                    {assistantMessage.suggestions.map((sug, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestionClick(sug.value, sug.isNearMe)}
                        className="bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary rounded-full px-3 py-1.5 text-xs md:text-sm font-medium transition-all flex items-center gap-1"
                      >
                        {sug.isNearMe && <Navigation className="h-3 w-3" />}
                        {sug.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Results */}
            {results.length > 0 && !isSearching && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg md:text-xl font-bold text-white">
                    {results.length} Match{results.length !== 1 ? "es" : ""}
                  </h2>
                  {response?.searchDurationMs && (
                    <Badge className="bg-white/10 text-white/60 border-0 text-xs">
                      {response.searchDurationMs}ms
                    </Badge>
                  )}
                </div>

                <div className="space-y-3">
                  {results.map((result, index) => (
                    <ResultCard key={result.id} result={result} index={index} />
                  ))}
                </div>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
                <p className="text-red-400 text-sm">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 rounded-xl border-white/20 text-white hover:bg-white/10"
                  onClick={() => setConversation([])}
                >
                  Start Over
                </Button>
              </div>
            )}

            <div ref={conversationEndRef} />
          </div>
        </div>

        {/* Input Area - Fixed at bottom on mobile */}
        <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-lg border-t border-white/10 px-4 py-3 md:py-4">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-primary" />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your dental needs..."
                  className="w-full h-12 md:h-14 pl-11 md:pl-12 pr-4 text-sm md:text-base rounded-xl md:rounded-2xl bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-primary"
                />
              </div>
              <Button
                onClick={() => handleUserInput(query)}
                disabled={!query.trim() || isSearching}
                size="icon"
                className="h-12 w-12 md:h-14 md:w-14 rounded-xl md:rounded-2xl bg-primary hover:bg-primary/90 shrink-0"
              >
                {isSearching ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
            
            {/* Quick actions - Only show when no active search */}
            {!isSearching && !response?.followUpQuestion && (
              <div className="flex gap-2 mt-2 overflow-x-auto pb-1 scrollbar-hide">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSuggestionClick("near me", true)}
                  className="rounded-full text-white/60 hover:text-white hover:bg-white/10 text-xs whitespace-nowrap shrink-0"
                >
                  <Navigation className="h-3 w-3 mr-1" />
                  Near Me
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUserInput("under $100")}
                  className="rounded-full text-white/60 hover:text-white hover:bg-white/10 text-xs whitespace-nowrap shrink-0"
                >
                  <DollarSign className="h-3 w-3 mr-1" />
                  Under $100
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUserInput("emergency dentist")}
                  className="rounded-full text-white/60 hover:text-white hover:bg-white/10 text-xs whitespace-nowrap shrink-0"
                >
                  <Clock className="h-3 w-3 mr-1" />
                  Emergency
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

// Result Card - Mobile optimized
function ResultCard({ result, index }: { result: SearchResult; index: number }) {
  return (
    <Link
      to={`/clinic/${result.slug}`}
      className={cn(
        "block bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-3 md:p-4 hover:border-primary/50 hover:bg-white/10 transition-all",
        "animate-fade-in-up"
      )}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="flex gap-3 md:gap-4">
        {/* Image - Smaller on mobile */}
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg md:rounded-xl overflow-hidden bg-white/10 flex-shrink-0">
          {result.cover_image_url ? (
            <img src={result.cover_image_url} alt={result.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Building2 className="h-6 w-6 md:h-8 md:w-8 text-white/30" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                {result.is_paid && (
                  <Badge className="bg-gold/20 text-gold border-gold/30 rounded-full text-[10px] md:text-xs px-1.5 py-0">
                    Featured
                  </Badge>
                )}
                {result.price_range && (
                  <Badge className="bg-teal/20 text-teal border-0 rounded-full text-[10px] md:text-xs px-1.5 py-0">
                    ${result.price_range.from}{result.price_range.to !== result.price_range.from && `-$${result.price_range.to}`}
                  </Badge>
                )}
              </div>
              <h3 className="font-bold text-white text-sm md:text-base truncate">{result.name}</h3>
              <div className="flex items-center gap-1.5 text-white/60 text-xs md:text-sm mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {result.city_name}{result.state_slug && `, ${result.state_slug.toUpperCase()}`}
                  {result.distance_km && ` • ${result.distance_km.toFixed(1)}km`}
                </span>
              </div>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-0.5 bg-white/10 rounded-lg px-1.5 py-1 shrink-0">
              <Star className="h-3 w-3 md:h-4 md:w-4 text-gold fill-gold" />
              <span className="text-white font-bold text-xs md:text-sm">{result.rating?.toFixed(1) || "—"}</span>
            </div>
          </div>

          {/* Match Reasons - Smaller on mobile */}
          {result.match_reasons && result.match_reasons.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {result.match_reasons.slice(0, 2).map((reason, i) => (
                <span key={i} className="bg-primary/20 text-primary text-[10px] md:text-xs font-medium px-1.5 py-0.5 rounded-full">
                  {reason}
                </span>
              ))}
            </div>
          )}

          {/* CTA - Always visible on mobile */}
          <div className="mt-2 md:mt-3">
            <Button size="sm" className={cn(
              "w-full md:w-auto h-8 text-xs md:text-sm rounded-lg",
              result.is_paid ? "bg-primary" : "bg-slate-700"
            )}>
              {result.is_paid ? "Book Now" : "View Details"}
              <ArrowRight className="h-3 w-3 md:h-4 md:w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default AISearchPage;
