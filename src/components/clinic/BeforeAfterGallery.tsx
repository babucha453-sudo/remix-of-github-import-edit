import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Camera, Sparkles, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface BeforeAfterGalleryProps {
  clinicId: string;
  isClaimed: boolean;
}

interface BeforeAfterCase {
  id: string;
  treatment_name: string;
  before_image_url: string;
  after_image_url: string;
  description?: string;
  display_order: number;
}

export function BeforeAfterGallery({ clinicId, isClaimed }: BeforeAfterGalleryProps) {
  const [selectedCase, setSelectedCase] = useState<BeforeAfterCase | null>(null);
  const [selectedTreatment, setSelectedTreatment] = useState<string | null>(null);

  // For now, we'll use a mock query since the table doesn't exist yet
  // This can be connected to a real table when created
  const { data: cases, isLoading } = useQuery({
    queryKey: ['before-after-cases', clinicId],
    queryFn: async () => {
      // Placeholder - will return empty array for unclaimed clinics
      // Once the before_after_cases table is created, this will fetch real data
      return [] as BeforeAfterCase[];
    },
    enabled: !!clinicId && isClaimed,
  });

  // Get unique treatments for filtering
  const treatments = [...new Set(cases?.map(c => c.treatment_name) || [])];
  
  const filteredCases = selectedTreatment
    ? cases?.filter(c => c.treatment_name === selectedTreatment)
    : cases;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!isClaimed) {
    return (
      <div className="text-center py-12 bg-muted/30 rounded-2xl">
        <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-bold text-foreground mb-2">Before & After Gallery</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Treatment results will be available once this clinic claims their profile
          and uploads their case studies.
        </p>
      </div>
    );
  }

  if (!cases || cases.length === 0) {
    return (
      <div className="text-center py-12 bg-gradient-to-br from-primary/5 via-muted/30 to-purple/5 rounded-2xl border border-dashed border-primary/20">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-2">No Cases Yet</h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          This clinic hasn't added any before & after cases yet.
          Check back later to see their amazing transformations!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Treatment Filter */}
      {treatments.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedTreatment === null ? "default" : "outline"}
            size="sm"
            className="rounded-full"
            onClick={() => setSelectedTreatment(null)}
          >
            All
          </Button>
          {treatments.map((treatment) => (
            <Button
              key={treatment}
              variant={selectedTreatment === treatment ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => setSelectedTreatment(treatment)}
            >
              {treatment}
            </Button>
          ))}
        </div>
      )}

      {/* Cases Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCases?.map((caseItem) => (
          <button
            key={caseItem.id}
            onClick={() => setSelectedCase(caseItem)}
            className="group relative aspect-[4/3] rounded-2xl overflow-hidden bg-muted border border-border hover:border-primary/50 transition-all hover:shadow-elevated"
          >
            {/* Split View */}
            <div className="absolute inset-0 flex">
              <div className="w-1/2 relative overflow-hidden">
                <img
                  src={caseItem.before_image_url}
                  alt="Before"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2">
                  <Badge className="bg-background/80 text-foreground backdrop-blur-sm text-xs">
                    Before
                  </Badge>
                </div>
              </div>
              <div className="w-1/2 relative overflow-hidden border-l-2 border-white">
                <img
                  src={caseItem.after_image_url}
                  alt="After"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute bottom-2 right-2">
                  <Badge className="bg-primary text-primary-foreground text-xs">
                    After
                  </Badge>
                </div>
              </div>
            </div>

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
              <div className="text-white text-left">
                <p className="font-bold">{caseItem.treatment_name}</p>
                {caseItem.description && (
                  <p className="text-sm text-white/80 line-clamp-2">{caseItem.description}</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox Modal */}
      <Dialog open={!!selectedCase} onOpenChange={() => setSelectedCase(null)}>
        <DialogContent className="max-w-4xl p-0 rounded-3xl overflow-hidden">
          {selectedCase && (
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-10 rounded-full bg-black/50 text-white hover:bg-black/70"
                onClick={() => setSelectedCase(null)}
              >
                <X className="h-5 w-5" />
              </Button>

              <div className="grid md:grid-cols-2">
                <div className="relative aspect-square bg-muted">
                  <img
                    src={selectedCase.before_image_url}
                    alt="Before"
                    className="w-full h-full object-cover"
                  />
                  <Badge className="absolute bottom-4 left-4 bg-background/90 text-foreground">
                    Before
                  </Badge>
                </div>
                <div className="relative aspect-square bg-muted">
                  <img
                    src={selectedCase.after_image_url}
                    alt="After"
                    className="w-full h-full object-cover"
                  />
                  <Badge className="absolute bottom-4 right-4 bg-primary text-primary-foreground">
                    After
                  </Badge>
                </div>
              </div>

              <div className="p-6 bg-card">
                <Badge className="mb-2">{selectedCase.treatment_name}</Badge>
                {selectedCase.description && (
                  <p className="text-muted-foreground">{selectedCase.description}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
