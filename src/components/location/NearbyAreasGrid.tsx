import { motion } from "framer-motion";
import { MapPin, ArrowRight, Navigation, Building, Landmark } from "lucide-react";

interface NearbyCity {
  name: string;
  slug: string;
}

interface NearbyAreasGridProps {
  cities: NearbyCity[];
  stateSlug: string;
  stateName: string;
  variation: 'trust-first' | 'results-first' | 'experience-first';
}

export function NearbyAreasGrid({ cities, stateSlug, stateName, variation }: NearbyAreasGridProps) {
  if (cities.length === 0) return null;
  
  const isLarge = variation === 'experience-first';
  const isCompact = variation === 'results-first';
  
  const primaryColor = variation === 'trust-first' ? 'emerald' : variation === 'results-first' ? 'blue' : 'amber';
  
  const count = isLarge ? Math.min(cities.length, 8) : isCompact ? 4 : 6;
  const displayCities = cities.slice(0, count);
  
  const gridCols = isLarge 
    ? 'grid-cols-2 md:grid-cols-4' 
    : isCompact 
    ? 'grid-cols-2 sm:grid-cols-4'
    : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-6';
  
  const CardIcon = isLarge ? Landmark : isCompact ? Building : MapPin;
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-8"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2`}>
          <CardIcon className={`h-5 w-5 text-${primaryColor}-600`} />
          {isLarge ? `Explore More Areas in ${stateName}` : 'Nearby Cities'}
        </h3>
        <a 
          href={`/${stateSlug}/`} 
          className={`text-sm font-medium hover:text-${primaryColor}-700 flex items-center gap-1 transition-colors`}
        >
          View all cities
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
      
      <div className={`grid ${gridCols} gap-3`}>
        {displayCities.map((city, i) => (
          <motion.a
            key={city.slug}
            href={`/${stateSlug}/${city.slug}/`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`
              flex items-center gap-3 bg-white border border-slate-200 rounded-2xl 
              hover:border-${primaryColor}-300 hover:shadow-lg hover:shadow-${primaryColor}-500/10 
              transition-all group cursor-pointer
              ${isLarge ? 'p-4' : 'p-3'}
            `}
          >
            <div 
              className={`
                ${isLarge ? 'w-12 h-12' : 'w-10 h-10'} 
                bg-${primaryColor}-100 rounded-xl flex items-center justify-center shrink-0
                group-hover:bg-${primaryColor}-500 transition-colors
              `}
            >
              <MapPin className={`h-5 w-5 text-${primaryColor}-600 group-hover:text-white transition-colors`} />
            </div>
            <div className="flex-1 min-w-0">
              <span className={`font-semibold text-slate-700 group-hover:text-${primaryColor}-700 block truncate`}>
                {city.name}
              </span>
              {isLarge && (
                <span className="text-xs text-slate-400">View dentists →</span>
              )}
            </div>
          </motion.a>
        ))}
      </div>
    </motion.div>
  );
}

export default NearbyAreasGrid;