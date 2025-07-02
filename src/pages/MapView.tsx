import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useTanks } from '@/hooks/useTanks';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default Leaflet icon path issue with bundlers like Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

export default function MapView() {
  const { tanks, isLoading } = useTanks();

  if (isLoading) {
    return <div>Loading map and tank locations...</div>;
  }

  // Filter tanks that have valid coordinates
  const tanksWithCoords = tanks?.filter(
    (tank) => tank.latitude != null && tank.longitude != null
  );

  // Default center for the map if no tanks have coordinates
  const defaultCenter: [number, number] = [-31.9523, 115.8613]; // Perth, WA

  return (
    <div className="h-[calc(100vh-theme(spacing.16))] w-full">
      <MapContainer 
        center={defaultCenter} 
        zoom={7} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {tanksWithCoords?.map((tank) => (
          <Marker 
            key={tank.id} 
            position={[Number(tank.latitude), Number(tank.longitude)]}
          >
            <Popup>
              <b>{tank.location}</b><br />
              {tank.product_type}<br />
              Level: {tank.current_level_percent?.toFixed(1)}%
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
} 