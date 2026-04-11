import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Layers,
  List,
  Loader2
} from "lucide-react";

export interface DentistMapMarker {
  id: string;
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
  address?: string;
  rating?: number;
  isVerified?: boolean;
  hasBookNow?: boolean;
}

interface DentistFinderMapProps {
  markers: DentistMapMarker[];
  highlightedId?: string;
  onMarkerClick?: (marker: DentistMapMarker) => void;
  className?: string;
}

const UAE_CENTER = { lat: 39.8283, lng: -98.5795 }; // US center

export function DentistFinderMap({
  markers,
  highlightedId,
  onMarkerClick,
  className
}: DentistFinderMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const validMarkerCount = markers.filter(m => m.latitude != null && m.longitude != null).length;
  const hasCoordinates = validMarkerCount > 0;

  const getMapCenter = useCallback(() => {
    const validMarkers = markers.filter(m => m.latitude != null && m.longitude != null);
    if (validMarkers.length === 0) return UAE_CENTER;
    
    const lats = validMarkers.map(m => Number(m.latitude));
    const lngs = validMarkers.map(m => Number(m.longitude));
    
    return {
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
      lng: (Math.min(...lngs) + Math.max(...lngs)) / 2
    };
  }, [markers]);

  // Initialize map
  useEffect(() => {
    if (!hasCoordinates || viewMode !== 'map') return;
    if (!mapContainerRef.current) return;

    let mounted = true;
    setIsLoading(true);
    setError(null);

    const initMap = async () => {
      try {
        // Load Leaflet CSS
        if (!document.getElementById('leaflet-css')) {
          const link = document.createElement('link');
          link.id = 'leaflet-css';
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Load Leaflet JS
        let L = (window as any).L;
        if (!L) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Leaflet'));
            document.head.appendChild(script);
          });
          L = (window as any).L;
        }

        if (!L || !mounted || !mapContainerRef.current) return;

        // Clear existing content
        mapContainerRef.current.innerHTML = '';

        const center = getMapCenter();
        
        const map = L.map(mapContainerRef.current, {
          center: [center.lat, center.lng],
          zoom: 11,
          zoomControl: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        // Add markers
        const validMarkers = markers.filter(m => m.latitude != null && m.longitude != null);
        console.log('[DentistFinderMap] Adding markers:', validMarkers.length, validMarkers);
        validMarkers.forEach(marker => {
          const lat = Number(marker.latitude);
          const lng = Number(marker.longitude);
          if (isNaN(lat) || isNaN(lng)) {
            console.warn('[DentistFinderMap] Invalid coordinates:', marker);
            return;
          }
          const markerEl = L.marker([lat, lng])
            .addTo(map)
            .bindPopup(`
              <div style="min-width: 180px; padding: 4px;">
                <strong style="font-size: 13px;">${marker.name}</strong>
                ${marker.address ? `<p style="margin: 2px 0; font-size: 11px; color: #666;">${marker.address}</p>` : ''}
                ${marker.rating ? `<div style="margin-top: 2px;">⭐ ${marker.rating.toFixed(1)}</div>` : ''}
              </div>
            `);
          
          markerEl.on('click', () => {
            onMarkerClick?.(marker);
          });
        });

        // Fit bounds
        if (validMarkers.length > 1) {
          const bounds = L.latLngBounds(
            validMarkers.map(m => [Number(m.latitude), Number(m.longitude)] as [number, number])
          );
          map.fitBounds(bounds, { padding: [30, 30] });
        } else if (validMarkers.length === 1) {
          map.setZoom(13);
        }

        if (mounted) {
          mapInstance.current = map;
          setMapReady(true);
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError('Failed to initialize map');
          setIsLoading(false);
        }
      }
    };

    const timeout = setTimeout(initMap, 300);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      if (mapInstance.current) {
        try {
          mapInstance.current.remove();
        } catch (e) {
          // Ignore cleanup errors
        }
        mapInstance.current = null;
      }
    };
  }, [hasCoordinates, viewMode, markers, getMapCenter, onMarkerClick]);

  // Show list fallback
  if (!hasCoordinates || viewMode === 'list') {
    return (
      <div className={cn("bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden flex flex-col", className)}>
        <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-600" />
            Map
          </h3>
          {hasCoordinates && (
            <Button variant="outline" size="sm" onClick={() => setViewMode('map')}>
              <Layers className="h-4 w-4 mr-1" /> Show
            </Button>
          )}
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
          {markers.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <MapPin className="h-10 w-10 mx-auto mb-2 text-slate-300" />
              <p>No locations</p>
            </div>
          ) : (
            <div className="space-y-2">
              {markers.slice(0, 8).map((marker) => (
                <button
                  key={marker.id}
                  onClick={() => onMarkerClick?.(marker)}
                  className="w-full p-3 rounded-xl text-left border bg-white hover:border-emerald-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${marker.isVerified ? "bg-emerald-100" : "bg-slate-100"}`}>
                      <MapPin className={`h-4 w-4 ${marker.isVerified ? "text-emerald-600" : "text-slate-400"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{marker.name}</p>
                      {marker.address && <p className="text-xs text-slate-500 truncate">{marker.address}</p>}
                    </div>
                    {marker.rating && <Badge variant="secondary" className="text-xs">⭐ {marker.rating.toFixed(1)}</Badge>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-center", className)}>
        <div className="text-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">Loading map...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn("bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden", className)}>
        <div className="p-4 border-b bg-white">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-600" /> Map
          </h3>
        </div>
        <div className="p-8 text-center">
          <p className="text-slate-600 mb-2">{error}</p>
          <Button variant="outline" size="sm" onClick={() => setViewMode('list')}>
            <List className="h-4 w-4 mr-1" /> View as List
          </Button>
        </div>
      </div>
    );
  }

  // Map view
  return (
    <div className={cn("bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden relative", className)} style={{ height: '400px', minHeight: '400px' }}>
      <div className="absolute top-3 left-3 z-10">
        <div className="bg-white rounded-lg px-3 py-1.5 shadow">
          <p className="text-xs font-medium text-slate-700">{markers.length} dentists</p>
        </div>
      </div>
      <div className="absolute top-3 right-3 z-10">
        <Button variant="outline" size="sm" onClick={() => setViewMode('list')} className="bg-white">
          <List className="h-4 w-4" />
        </Button>
      </div>
      <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: '400px' }} />
    </div>
  );
}