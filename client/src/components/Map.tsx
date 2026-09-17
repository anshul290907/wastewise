import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";

interface MapViewProps {
  className?: string;
  initialCenter?: {
    lat: number;
    lng: number;
  };
  initialZoom?: number;
  onMapReady?: (map: L.Map) => void;
}

export function MapView({
  className,
  initialCenter = { lat: 28.6139, lng: 77.2090 },
  initialZoom = 15,
  onMapReady,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) {
      return;
    }

    const leafletMap = L.map(mapContainer.current).setView(
      [initialCenter.lat, initialCenter.lng],
      initialZoom
    );

    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }
    ).addTo(leafletMap);

    map.current = leafletMap;

    onMapReady?.(leafletMap);

    return () => {
      leafletMap.remove();
      map.current = null;
    };
  }, []);

  return (
    <div
      ref={mapContainer}
      className={cn("w-full h-[500px]", className)}
    />
  );
}