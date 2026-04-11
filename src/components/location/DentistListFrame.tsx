import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ProfileCard } from "@/components/ProfileCard";
import { MobileDentistSlider } from "@/components/lists/MobileDentistSlider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ChevronDown, 
  ChevronUp, 
  Users, 
  MapPin,
  X,
  Star,
  Award,
  CheckCircle,
  ArrowRight,
  Stethoscope
} from "lucide-react";

interface DentistListFrameProps {
  profiles: any[];
  isLoading: boolean;
  locationName: string;
  emptyMessage?: string;
  showFilters?: boolean;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  maxHeight?: number;
  initialCount?: number;
}

export const DentistListFrame = ({
  profiles,
  isLoading,
  locationName,
  emptyMessage,
  showFilters = false,
  hasActiveFilters = false,
  onClearFilters,
  maxHeight = 600,
  initialCount = 6,
}: DentistListFrameProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const displayProfiles = isExpanded ? profiles : profiles.slice(0, initialCount);
  const hasMoreProfiles = profiles.length > initialCount;
  const remainingCount = profiles.length - initialCount;

  if (isLoading) {
    return (
      <div 
        className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-lg"
        itemScope 
        itemType="https://schema.org/ItemList"
        aria-busy="true"
      >
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Users className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-xl text-slate-800" itemProp="name">
                  Top Dentists in {locationName}
                </h3>
                <p className="text-sm text-slate-500">Loading results...</p>
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="h-20 w-20 rounded-xl bg-slate-200" />
                <div className="flex-1 space-y-3">
                  <div className="h-5 w-40 bg-slate-200 rounded" />
                  <div className="h-4 w-56 bg-slate-200 rounded" />
                  <div className="h-4 w-32 bg-slate-200 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!profiles || profiles.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-lg">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Users className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-xl text-slate-800">Dentists & Clinics</h3>
              <p className="text-sm text-slate-500">in {locationName}</p>
            </div>
          </div>
        </div>
        <div className="p-12 text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MapPin className="h-10 w-10 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">No dentists found</h3>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            {emptyMessage || (hasActiveFilters 
              ? "Try adjusting your filters to see more results."
              : `We're still adding dentists in ${locationName}. Check back soon!`
            )}
          </p>
          {hasActiveFilters && onClearFilters && (
            <Button 
              variant="outline" 
              className="rounded-xl border-slate-200"
              onClick={onClearFilters}
            >
              <X className="h-4 w-4 mr-2" />
              Clear All Filters
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-lg">
      {/* Header - Big Company Style */}
      <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-50 via-white to-slate-50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Stethoscope className="h-7 w-7 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-xl text-slate-800">
                Top Dentists in {locationName}
              </h3>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-slate-500">
                  {profiles.length} verified {profiles.length === 1 ? 'clinic' : 'clinics'}
                </span>
                <span className="flex items-center gap-1 text-sm text-amber-600">
                  <Star className="h-4 w-4 fill-amber-500" />
                  <span className="font-semibold">4.9</span>
                  <span className="text-slate-400">avg rating</span>
                </span>
              </div>
            </div>
          </div>
          
          {/* Trust Badges */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-semibold text-emerald-700">Verified</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg">
              <Award className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-semibold text-blue-700">Top Rated</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* SEO: Semantic HTML list for bots */}
      <noscript>
        <div itemScope itemType="https://schema.org/ItemList">
          <meta itemProp="name" content={`Dentists in ${locationName}`} />
          <meta itemProp="numberOfItems" content={String(profiles.length)} />
          {profiles.map((profile, index) => (
            <div key={profile.id} itemScope itemType="https://schema.org/Dentist" itemProp="itemListElement">
              <meta itemProp="position" content={String(index + 1)} />
              <h4 itemProp="name">{profile.name}</h4>
              {profile.location && <p itemProp="address">{profile.location}</p>}
              {profile.specialty && <p itemProp="medicalSpecialty">{profile.specialty}</p>}
              {profile.rating && <span itemProp="aggregateRating" itemScope itemType="https://schema.org/AggregateRating">
                <meta itemProp="ratingValue" content={String(profile.rating)} />
              </span>}
              {profile.slug && <a itemProp="url" href={`https://www.appointpanda.com/clinic/${profile.slug}/`}>View Profile</a>}
            </div>
          ))}
        </div>
      </noscript>

      {/* Screen-reader accessible list */}
      <div className="sr-only" role="list" aria-label={`${profiles.length} dentists in ${locationName}`}
        itemScope itemType="https://schema.org/ItemList">
        <meta itemProp="name" content={`Dentists in ${locationName}`} />
        <meta itemProp="numberOfItems" content={String(profiles.length)} />
        {profiles.map((profile, index) => (
          <div key={profile.id} role="listitem" itemScope itemType="https://schema.org/Dentist" itemProp="itemListElement">
            <meta itemProp="position" content={String(index + 1)} />
            <span itemProp="name">{profile.name}</span>
            {profile.slug && <a itemProp="url" href={`https://www.appointpanda.com/clinic/${profile.slug}/`}>{profile.name}</a>}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="relative">
        {/* Mobile slider */}
        <div className="md:hidden p-4">
          <MobileDentistSlider profiles={displayProfiles} />
        </div>
        
        {/* Desktop list */}
        <div className="hidden md:block">
          <AnimatePresence mode="wait">
            <motion.div
              key={isExpanded ? 'expanded' : 'collapsed'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ScrollArea 
                className="w-full"
                style={{ maxHeight: isExpanded ? 'none' : `${maxHeight}px` }}
              >
                <div className="p-4 md:p-6 space-y-4">
                  {displayProfiles.map((profile, index) => (
                    <motion.div
                      key={profile.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <article 
                        itemScope 
                        itemType="https://schema.org/Dentist"
                        className="contents"
                      >
                        <ProfileCard profile={profile} variant="list" />
                        <meta itemProp="name" content={profile.name} />
                      </article>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </motion.div>
          </AnimatePresence>
          
          {!isExpanded && hasMoreProfiles && (
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none" />
          )}
        </div>
      </div>
      
      {/* Expand/Collapse */}
      {hasMoreProfiles && (
        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <Button
            variant="ghost"
            className="w-full rounded-xl font-semibold hover:bg-emerald-50 hover:text-emerald-700 transition-all group"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-5 w-5 mr-2" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="h-5 w-5 mr-2" />
                View All {remainingCount} More Dentists
                <ArrowRight className="h-4 w-4 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default DentistListFrame;
