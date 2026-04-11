import { useRef } from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DoctorCard } from "@/components/DoctorCard";
import { Link } from "react-router-dom";

interface Doctor {
  name: string;
  specialty: string;
  location: string;
  rating: number;
  image: string;
  slug?: string;
  type?: 'dentist' | 'clinic';
}

interface DoctorCarouselProps {
  doctors: Doctor[];
}

export function DoctorCarousel({ doctors }: DoctorCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 280;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="relative">
      {/* Carousel - tighter spacing */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide pb-4 -mx-1 px-1"
      >
        {doctors.map((doctor, index) => (
          <div
            key={doctor.name + index}
            className="animate-fade-in shrink-0"
            style={{ animationDelay: `${index * 0.08}s` }}
          >
            <DoctorCard {...doctor} variant="homepage" />
          </div>
        ))}
        
        {/* End card - View all */}
        <Link 
          to="/search/"
          className="shrink-0 min-w-[200px] max-w-[200px] rounded-2xl bg-card/10 border border-card/20 flex flex-col items-center justify-center p-4 hover:bg-card/20 transition-colors group"
        >
          <div className="text-center">
            <div className="text-label text-card/80 mb-1 text-xs uppercase tracking-wide font-bold">Explore All</div>
            <div className="text-data text-xl text-card mb-3 font-black">120+</div>
            <p className="text-xs text-card/70 mb-3">Specialists</p>
            <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
              <ArrowRight className="h-4 w-4 text-primary-foreground" />
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation - positioned at header level */}
      <div className="absolute -top-16 right-0 flex items-center gap-2">
        <Link to="/search/" className="text-interface text-card/80 hover:text-primary transition-colors flex items-center gap-1 mr-4">
          VIEW FULL DIRECTORY
          <ArrowRight className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-1 border-l border-card/20 pl-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => scroll("left")}
            className="h-8 w-8 rounded-lg bg-transparent border border-card/30 text-card/70 hover:bg-card/10 hover:text-card"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => scroll("right")}
            className="h-8 w-8 rounded-lg bg-transparent border border-card/30 text-card/70 hover:bg-card/10 hover:text-card"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
