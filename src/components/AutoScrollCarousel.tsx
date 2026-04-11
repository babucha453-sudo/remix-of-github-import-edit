import { useRef, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ArrowRight, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DoctorCard } from "@/components/DoctorCard";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Doctor {
  name: string;
  specialty: string;
  location: string;
  rating: number;
  image: string;
  slug?: string;
  type?: 'dentist' | 'clinic';
}

interface AutoScrollCarouselProps {
  doctors: Doctor[];
  autoScrollSpeed?: number; // pixels per second
}

export function AutoScrollCarousel({ doctors }: AutoScrollCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  if (doctors.length === 0) return null;

  return (
    <div className="relative overflow-hidden pt-4">
      {/* Container that allows manual scroll but hides scrollbar */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto scrollbar-hide pb-8 -mx-1 px-1"
        style={{ scrollBehavior: 'smooth' }}
      >
        {/* The Marquee Row - Animates purely via CSS */}
        <div
          className={cn(
            "flex gap-3 animate-marquee will-change-transform",
            isPaused && "animate-marquee-paused"
          )}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* We need enough items to cover the width at least twice for a seamless loop */}
          {[...doctors, ...doctors, ...doctors].map((doctor, index) => (
            <div
              key={`${doctor.name}-${index}`}
              className="shrink-0"
            >
              <DoctorCard {...doctor} variant="homepage" />
            </div>
          ))}

          {/* End card - View all */}
          <Link
            href="/search"
            className="shrink-0 min-w-[280px] max-w-[280px] rounded-[2.5rem] bg-card/10 border border-card/20 flex flex-col items-center justify-center p-6 hover:bg-card/20 transition-colors group"
          >
            <div className="text-center">
              <div className="text-label text-card/80 mb-1 text-xs uppercase tracking-wide font-bold">Explore All</div>
              <div className="text-data text-xl text-card mb-3 font-black">{doctors.length}+</div>
              <p className="text-xs text-card/70 mb-3">Top Rated</p>
              <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                <ArrowRight className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Navigation controls */}
      <div className="absolute -top-16 right-0 flex items-center gap-2">
        <Link href="/search" className="text-interface text-card/80 hover:text-primary transition-colors flex items-center gap-1 mr-4">
          VIEW ALL
          <ArrowRight className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-1 border-l border-card/20 pl-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsPaused(!isPaused)}
            className="h-8 w-8 rounded-lg bg-transparent border border-card/30 text-card/70 hover:bg-card/10 hover:text-card"
            title={isPaused ? "Resume auto-scroll" : "Pause auto-scroll"}
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>
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
