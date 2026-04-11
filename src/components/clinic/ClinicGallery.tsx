import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, Images } from "lucide-react";
import { cn } from "@/lib/utils";

interface GalleryImage {
  id: string;
  image_url: string;
  caption: string | null;
}

interface ClinicGalleryProps {
  images: GalleryImage[];
  clinicName: string;
}

export function ClinicGallery({ images, clinicName }: ClinicGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  
  if (images.length === 0) {
    return null;
  }

  const openLightbox = (index: number) => setSelectedIndex(index);
  const closeLightbox = () => setSelectedIndex(null);
  
  const goNext = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex + 1) % images.length);
    }
  };
  
  const goPrev = () => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex - 1 + images.length) % images.length);
    }
  };

  // Grid layout based on image count
  const getGridClass = () => {
    if (images.length === 1) return "grid-cols-1";
    if (images.length === 2) return "grid-cols-2";
    if (images.length === 3) return "grid-cols-2 md:grid-cols-3";
    if (images.length === 4) return "grid-cols-2";
    return "grid-cols-2 md:grid-cols-3";
  };

  return (
    <>
      <div className={cn("grid gap-3", getGridClass())}>
        {images.slice(0, 6).map((img, i) => (
          <button
            key={img.id}
            onClick={() => openLightbox(i)}
            className={cn(
              "relative aspect-square rounded-xl overflow-hidden bg-muted group",
              i === 0 && images.length > 4 && "col-span-2 row-span-2"
            )}
          >
            <img
              src={img.image_url}
              alt={img.caption || `${clinicName} photo ${i + 1}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder.svg';
              }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            
            {/* Show +N overlay on last visible image if more exist */}
            {i === 5 && images.length > 6 && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="text-white text-center">
                  <Images className="h-6 w-6 mx-auto mb-1" />
                  <span className="font-bold text-lg">+{images.length - 6}</span>
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      <Dialog open={selectedIndex !== null} onOpenChange={closeLightbox}>
        <DialogContent className="max-w-5xl h-[90vh] p-0 bg-black/95 border-0">
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10 text-white hover:bg-white/10"
              onClick={closeLightbox}
            >
              <X className="h-6 w-6" />
            </Button>
            
            {/* Navigation */}
            {images.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 z-10 text-white hover:bg-white/10 h-12 w-12"
                  onClick={goPrev}
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 z-10 text-white hover:bg-white/10 h-12 w-12"
                  onClick={goNext}
                >
                  <ChevronRight className="h-8 w-8" />
                </Button>
              </>
            )}
            
            {/* Image */}
            {selectedIndex !== null && (
              <div className="max-w-full max-h-full p-12">
                <img
                  src={images[selectedIndex].image_url}
                  alt={images[selectedIndex].caption || `${clinicName} photo`}
                  className="max-w-full max-h-[70vh] object-contain mx-auto"
                />
                
                {/* Caption & counter */}
                <div className="absolute bottom-6 left-0 right-0 text-center">
                  {images[selectedIndex].caption && (
                    <p className="text-white/80 text-sm mb-2">
                      {images[selectedIndex].caption}
                    </p>
                  )}
                  <p className="text-white/60 text-sm">
                    {selectedIndex + 1} / {images.length}
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
