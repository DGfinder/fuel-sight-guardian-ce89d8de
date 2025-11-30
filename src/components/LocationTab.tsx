import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, ExternalLink, Navigation, AlertCircle, CheckCircle, Activity, AlertTriangle } from 'lucide-react';
import { Tank } from '@/types/fuel';
import { useTaTanksCompat as useTanks } from '@/hooks/useTaTanksCompat';
import { getFuelStatus } from '@/components/ui/fuel-status';
import { TankMapPopup } from '@/components/TankMapPopup';
import { useTankModal } from '@/contexts/TankModalContext';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Create tank icons with status colors
const createTankIcon = (color: string) => {
  return new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${color}" stroke="#ffffff" stroke-width="2"/>
        <circle cx="12" cy="9" r="3" fill="#ffffff"/>
      </svg>`
    ),
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  });
};

const TANK_ICONS = {
  critical: createTankIcon('#dc2626'), // red-600
  low: createTankIcon('#ea580c'),     // orange-600
  normal: createTankIcon('#2563eb'),  // blue-600
  high: createTankIcon('#16a34a'),    // green-600
  unknown: createTankIcon('#6b7280'), // gray-500
};

const getIconForTank = (tank: Tank) => {
  const status = getFuelStatus(tank.current_level_percent);
  return TANK_ICONS[status] || TANK_ICONS.unknown;
};

interface LocationTabProps {
  tank: Tank;
  allTanks?: Tank[]; // Optional - if provided, avoids duplicate useTanks call
}

export const LocationTab: React.FC<LocationTabProps> = ({ tank, allTanks }) => {
  // Use provided tanks or fetch via hook (React Query caching prevents duplicate network requests)
  const { tanks: fetchedTanks } = useTanks();
  const tanks = allTanks || fetchedTanks;
  const { openModal } = useTankModal();
  const [mapLoaded, setMapLoaded] = useState(false);

  // Safe navigation function to avoid router context issues
  const navigateToMap = () => {
    try {
      window.location.href = '/map';
    } catch (error) {
      console.warn('Navigation failed:', error);
    }
  };

  // Default center (Perth, WA) if no coordinates
  const defaultCenter: [number, number] = [-31.9505, 115.8605];
  
  const tankPosition: [number, number] = useMemo(() => {
    if (tank.latitude && tank.longitude) {
      return [tank.latitude, tank.longitude];
    }
    return defaultCenter;
  }, [tank.latitude, tank.longitude, defaultCenter]);

  // Find nearby tanks (within reasonable distance)
  const nearbyTanks = useMemo(() => {
    if (!tank.latitude || !tank.longitude || !tanks) return [];
    
    return tanks.filter(t => 
      t.id !== tank.id && 
      t.latitude && 
      t.longitude &&
      Math.abs(t.latitude - tank.latitude!) < 0.1 && // ~11km radius
      Math.abs(t.longitude - tank.longitude!) < 0.1
    ).slice(0, 10); // Limit to 10 nearby tanks for performance
  }, [tank, tanks]);

  const hasCoordinates = tank.latitude && tank.longitude;

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'low': return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case 'normal': return <Activity className="w-4 h-4 text-blue-600" />;
      case 'high': return <CheckCircle className="w-4 h-4 text-green-600" />;
      default: return <MapPin className="w-4 h-4 text-gray-500" />;
    }
  };

  if (!hasCoordinates) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MapPin className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Location Not Available
            </h3>
            <p className="text-gray-600 mb-4">
              Geographic coordinates have not been set for this tank.
            </p>
            <Button
              onClick={navigateToMap}
              className="bg-primary hover:bg-primary/90"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View All Tanks on Map
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Tank Location Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-blue-600" />
            Tank Location
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-500">Coordinates</span>
              <p className="font-medium">
                {tank.latitude?.toFixed(6)}, {tank.longitude?.toFixed(6)}
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Address</span>
              <p className="font-medium">{tank.address || 'Not specified'}</p>
            </div>
          </div>
          
          {nearbyTanks.length > 0 && (
            <div className="pt-2 border-t">
              <span className="text-sm text-gray-500 mb-2 block">
                Nearby Tanks ({nearbyTanks.length})
              </span>
              <div className="flex flex-wrap gap-2">
                {nearbyTanks.slice(0, 5).map(nearbyTank => {
                  const status = getFuelStatus(nearbyTank.current_level_percent);
                  return (
                    <Badge
                      key={nearbyTank.id}
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-gray-50"
                      onClick={() => openModal(nearbyTank)}
                    >
                      <StatusIcon status={status} />
                      <span className="ml-1">{nearbyTank.location}</span>
                    </Badge>
                  );
                })}
                {nearbyTanks.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{nearbyTanks.length - 5} more
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Interactive Map */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              Interactive Map
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={navigateToMap}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Full Map
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            className="h-[400px] rounded-lg overflow-hidden border"
            onMouseEnter={() => !mapLoaded && setMapLoaded(true)}
          >
            {mapLoaded ? (
              <MapContainer
                center={tankPosition}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                className="rounded-lg"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />
                
                {/* Current tank marker */}
                <Marker position={tankPosition} icon={getIconForTank(tank)}>
                  <Popup>
                    <TankMapPopup tank={tank} onViewDetails={() => {}} />
                  </Popup>
                </Marker>
                
                {/* Nearby tanks */}
                {nearbyTanks.map(nearbyTank => (
                  <Marker
                    key={nearbyTank.id}
                    position={[nearbyTank.latitude!, nearbyTank.longitude!]}
                    icon={getIconForTank(nearbyTank)}
                  >
                    <Popup>
                      <TankMapPopup 
                        tank={nearbyTank} 
                        onViewDetails={(tank) => openModal(tank)} 
                      />
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-50 text-gray-500">
                <div className="text-center">
                  <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm">Hover to load interactive map</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LocationTab;