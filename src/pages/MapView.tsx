import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useTanks } from '@/hooks/useTanks';
import { Button } from '@/components/ui/button';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default Leaflet icon path issue with bundlers like Vite
const defaultIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = defaultIcon;

export default function MapView() {
  const { tanks, isLoading, refreshTanks } = useTanks();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-theme(spacing.16))]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Loading map and tank locations...</p>
        </div>
      </div>
    );
  }

  // Default center for the map (Perth, WA)
  const defaultCenter: [number, number] = [-31.9523, 115.8613];

  return (
    <div className="relative h-[calc(100vh-theme(spacing.16))] w-full">
      <div className="absolute top-2 right-2 z-[1000]">
        <Button onClick={() => refreshTanks()} variant="secondary" className="shadow-lg">
          Refresh Map
        </Button>
      </div>
      <div className="h-full flex flex-col">
        {/* Info banner about coordinate data */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>Map View Ready:</strong> Tank coordinates will be displayed here once location data is added to the database.
                Currently showing {tanks?.length || 0} tanks available for mapping.
              </p>
            </div>
          </div>
        </div>

        {/* Map container */}
        <div className="flex-1">
          <MapContainer 
            center={defaultCenter} 
            zoom={7} 
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {/* Placeholder marker for Perth */}
            <Marker position={defaultCenter}>
              <Popup>
                <b>Default Location</b><br />
                Perth, Western Australia<br />
                Tank markers will appear here once coordinate data is available.
              </Popup>
            </Marker>
          </MapContainer>
        </div>
      </div>
    </div>
  );
} 