import { useEffect, useRef } from 'react';
import { Library } from '../types';

interface MapProps {
  libraries: Library[];
}

export default function Map({ libraries }: MapProps) {
  const mapElement = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapElement.current || !window.naver || !window.naver.maps) return;

    // Initialize map centered on Seoul or first library
    const centerLatLng = libraries.length > 0
      ? new window.naver.maps.LatLng(libraries[0].lat, libraries[0].lng)
      : new window.naver.maps.LatLng(37.5665, 126.9780);

    const mapOptions = {
      center: centerLatLng,
      zoom: 13,
      minZoom: 7,
      zoomControl: true,
      zoomControlOptions: {
        position: window.naver.maps.Position.TOP_RIGHT,
      },
    };

    const map = new window.naver.maps.Map(mapElement.current, mapOptions);

    // Add markers
    libraries.forEach((lib) => {
      const occupancy = (lib.usedSeats / lib.totalSeats) * 100;
      let markerColor = '#10b981'; // green
      if (occupancy >= 90) markerColor = '#ef4444'; // red
      else if (occupancy >= 70) markerColor = '#f59e0b'; // yellow

      new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(lib.lat, lib.lng),
        map: map,
        title: lib.name,
        icon: {
          content: `
            <div style="background-color: ${markerColor}; color: white; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border: 2px solid white; white-space: nowrap;">
              ${lib.name} <span style="font-weight: normal; opacity: 0.9;">${lib.availableSeats}</span>
            </div>
          `,
          anchor: new window.naver.maps.Point(12, 12),
        },
      });
    });

    return () => {
      // Cleanup if needed
    };
  }, [libraries]);

  return <div ref={mapElement} className="w-full h-full" />;
}
