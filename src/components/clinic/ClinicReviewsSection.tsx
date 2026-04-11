import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, ThumbsUp, MessageCircle, ExternalLink, Filter } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Review {
  id: string;
  patient_name: string;
  rating: number;
  content: string;
  created_at: string;
  source?: 'internal' | 'google';
}

interface GoogleReview {
  id: string;
  author_name: string;
  rating: number;
  text_content: string | null;
  review_time: string | null;
  author_photo_url: string | null;
  reply_text: string | null;
}

interface ClinicReviewsSectionProps {
  reviews: Review[];
  googleReviews?: GoogleReview[];
  clinicRating?: number | null;
  clinicReviewCount?: number;
  gmbConnected?: boolean;
  clinicSlug: string;
  clinicId?: string;
}

export function ClinicReviewsSection({
  reviews,
  googleReviews = [],
  clinicRating,
  clinicReviewCount = 0,
  gmbConnected = false,
  clinicSlug,
  clinicId,
}: ClinicReviewsSectionProps) {
  const [showAll, setShowAll] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'platform' | 'google'>('all');
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  
  // Format reviews
  const platformReviews = reviews.map(r => ({
    ...r,
    source: 'internal' as const,
  }));
  
  const formattedGoogleReviews = googleReviews.map(g => ({
    id: g.id,
    patient_name: g.author_name,
    rating: g.rating,
    content: g.text_content || '',
    created_at: g.review_time || '',
    source: 'google' as const,
    author_photo_url: g.author_photo_url,
    reply_text: g.reply_text,
  }));
  
  // All reviews combined
  const allReviews = [...platformReviews, ...formattedGoogleReviews];
  
  // Filter by tab and rating
  let filteredReviews = activeTab === 'platform' 
    ? platformReviews 
    : activeTab === 'google' 
      ? formattedGoogleReviews 
      : allReviews;
      
  if (ratingFilter !== null) {
    filteredReviews = filteredReviews.filter(r => r.rating === ratingFilter);
  }
  
  const ratingCounts = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: allReviews.filter(r => r.rating === star).length,
    percentage: allReviews.length > 0 
      ? (allReviews.filter(r => r.rating === star).length / allReviews.length) * 100 
      : 0
  }));

  const displayReviews = showAll ? filteredReviews : filteredReviews.slice(0, 5);
  const avgRating = clinicRating || (allReviews.length > 0 
    ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length 
    : 0);

  return (
    <div className="space-y-6">
      {/* Rating Summary */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Overall Score */}
        <div className="text-center md:text-left shrink-0">
          <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
            <span className="text-5xl font-bold text-foreground">
              {avgRating.toFixed(1)}
            </span>
            <div>
              <div className="flex items-center gap-0.5 text-gold">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    className={cn(
                      "h-5 w-5",
                      i < Math.round(avgRating) ? "fill-current" : "text-muted"
                    )} 
                  />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                {clinicReviewCount || allReviews.length} reviews
              </p>
            </div>
          </div>
          
          {gmbConnected && (
            <Badge variant="outline" className="text-xs">
              <img 
                src="https://www.google.com/favicon.ico" 
                alt="Google" 
                className="h-3 w-3 mr-1"
              />
              Google Connected
            </Badge>
          )}
        </div>
        
        {/* Rating Distribution */}
        <div className="flex-1 space-y-1.5">
          {ratingCounts.map(({ star, count, percentage }) => (
            <div key={star} className="flex items-center gap-2">
              <span className="text-sm w-3">{star}</span>
              <Star className="h-3.5 w-3.5 text-gold fill-gold" />
              <Progress value={percentage} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground w-8">{count}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Source Tabs & Filters */}
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="bg-muted/50 rounded-2xl p-1">
            <TabsTrigger value="all" className="rounded-xl font-bold">
              All ({allReviews.length})
            </TabsTrigger>
            <TabsTrigger value="platform" className="rounded-xl font-bold">
              Platform ({platformReviews.length})
            </TabsTrigger>
            <TabsTrigger value="google" className="rounded-xl font-bold">
              <img 
                src="https://www.google.com/favicon.ico" 
                alt="Google" 
                className="h-3 w-3 mr-1.5"
              />
              Google ({formattedGoogleReviews.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        {/* Rating Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground mr-1">Filter:</span>
          <Button
            variant={ratingFilter === null ? "default" : "outline"}
            size="sm"
            className="rounded-full h-7 px-3"
            onClick={() => setRatingFilter(null)}
          >
            All
          </Button>
          {[5, 4, 3, 2, 1].map(star => (
            <Button
              key={star}
              variant={ratingFilter === star ? "default" : "outline"}
              size="sm"
              className="rounded-full h-7 px-3"
              onClick={() => setRatingFilter(ratingFilter === star ? null : star)}
            >
              {star} <Star className="h-3 w-3 ml-1 fill-current text-gold" />
            </Button>
          ))}
        </div>
      </div>
      
      {/* Leave Review CTA */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" className="rounded-xl" asChild>
          <a href={clinicId ? `/review/${clinicId}` : `/review/${clinicSlug}`}>
            <MessageCircle className="h-4 w-4 mr-2" />
            Leave a Review
          </a>
        </Button>
        {gmbConnected && (
          <Button variant="ghost" className="rounded-xl text-muted-foreground" asChild>
            <a 
              href={`https://search.google.com/local/writereview?placeid=${clinicSlug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Review on Google
            </a>
          </Button>
        )}
      </div>

      {/* Reviews List */}
      {displayReviews.length > 0 ? (
        <div className="space-y-4">
          {displayReviews.map((review) => (
            <div key={review.id} className="p-4 rounded-xl bg-muted/50">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="font-bold text-primary text-sm">
                    {review.patient_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{review.patient_name}</span>
                      {review.source === 'google' && (
                        <Badge variant="outline" className="text-xs py-0">
                          <img 
                            src="https://www.google.com/favicon.ico" 
                            alt="Google" 
                            className="h-2.5 w-2.5 mr-1"
                          />
                          Google
                        </Badge>
                      )}
                    </div>
                    {review.created_at && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-0.5 text-gold my-1">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        className={cn(
                          "h-3.5 w-3.5",
                          i < review.rating ? "fill-current" : "text-muted"
                        )} 
                      />
                    ))}
                  </div>
                  
                  {review.content && (
                    <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                      {review.content}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {allReviews.length > 5 && !showAll && (
            <Button 
              variant="outline" 
              className="w-full rounded-xl"
              onClick={() => setShowAll(true)}
            >
              Show all {allReviews.length} reviews
            </Button>
          )}
        </div>
      ) : (
        <div className="text-center py-8 bg-muted/30 rounded-xl">
          <MessageCircle className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground mb-3">No reviews yet</p>
          <Button variant="outline" className="rounded-xl" asChild>
            <a href={clinicId ? `/review/${clinicId}` : `/review/${clinicSlug}`}>
              Be the first to review
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
