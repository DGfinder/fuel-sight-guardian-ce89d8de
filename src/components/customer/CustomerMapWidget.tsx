import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CustomerTank } from '@/hooks/useCustomerAuth';
import { useWeatherForecast } from '@/hooks/useWeatherForecast';
import { MapPin, Fuel, Eye, Sun, CloudRain, Cloud, Droplets, Thermometer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom fuel level marker
const createFuelMarker = (percentage: number | null) => {
  const color = percentage === null ? '#9ca3af' :
    percentage <= 20 ? '#dc2626' :
    percentage <= 50 ? '#f59e0b' : '#16a34a';

  return L.divIcon({
    className: 'custom-fuel-marker',
    html: `
      <div style="
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: ${color};
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 11px;
        font-weight: bold;
      ">
        ${percentage !== null ? Math.round(percentage) + '%' : '?'}
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
};

interface CustomerMapWidgetProps {
  tanks: CustomerTank[];
  height?: number;
  showTitle?: boolean;
  className?: string;
}

export function CustomerMapWidget({
  tanks,
  height = 280,
  showTitle = true,
  className
}: CustomerMapWidgetProps) {
  // Find center point from all tanks with coordinates
  const mapCenter = useMemo(() => {
    const tanksWithCoords = tanks.filter(t => t.lat && t.lng);
    if (tanksWithCoords.length === 0) {
      // Default to Perth, WA
      return { lat: -31.9505, lng: 115.8605 };
    }

    const avgLat = tanksWithCoords.reduce((sum, t) => sum + (t.lat || 0), 0) / tanksWithCoords.length;
    const avgLng = tanksWithCoords.reduce((sum, t) => sum + (t.lng || 0), 0) / tanksWithCoords.length;
    return { lat: avgLat, lng: avgLng };
  }, [tanks]);

  // Primary tank for weather
  const primaryTank = useMemo(() => {
    const tanksWithCoords = tanks.filter(t => t.lat && t.lng);
    return tanksWithCoords.find(t => (t.latest_calibrated_fill_percentage || 0) < 20)
      || tanksWithCoords[0]
      || null;
  }, [tanks]);

  // Fetch weather for primary location
  const { data: weather } = useWeatherForecast(
    primaryTank?.lat || mapCenter.lat,
    primaryTank?.lng || mapCenter.lng,
    7
  );

  const tanksWithCoords = tanks.filter(t => t.lat && t.lng);

  if (tanksWithCoords.length === 0) {
    return (
      <Card className={className}>
        {showTitle && (
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              Tank Location
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex items-center justify-center h-40 text-gray-500">
            <div className="text-center">
              <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No tank coordinates available</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get current weather info
  const currentTemp = weather?.hourly?.temperature_2m?.[new Date().getHours()]
    ?? weather?.daily?.temperature_2m_max?.[0];
  const todayRain = weather?.daily?.rain_sum?.[0] ?? 0;

  const getWeatherIcon = () => {
    if (todayRain > 5) return CloudRain;
    if (todayRain > 0) return Cloud;
    return Sun;
  };
  const WeatherIcon = getWeatherIcon();

  return (
    <Card className={className}>
      {showTitle && (
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              Tank Location
            </CardTitle>
            {weather && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <WeatherIcon className={`h-4 w-4 ${todayRain > 0 ? 'text-blue-500' : 'text-yellow-500'}`} />
                <span>{currentTemp?.toFixed(0)}°C</span>
                {todayRain > 0 && (
                  <span className="flex items-center gap-1 text-blue-500">
                    <Droplets className="h-3 w-3" />
                    {todayRain.toFixed(0)}mm
                  </span>
                )}
              </div>
            )}
          </div>
        </CardHeader>
      )}
      <CardContent className="p-0 overflow-hidden rounded-b-lg">
        <div style={{ height }}>
          <MapContainer
            center={[mapCenter.lat, mapCenter.lng]}
            zoom={tanksWithCoords.length === 1 ? 12 : 8}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />

            {tanksWithCoords.map((tank) => (
              <Marker
                key={tank.id}
                position={[tank.lat!, tank.lng!]}
                icon={createFuelMarker(tank.latest_calibrated_fill_percentage)}
              >
                <Popup>
                  <TankPopupContent tank={tank} weather={weather} />
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact popup content for tank markers
function TankPopupContent({ tank, weather }: { tank: CustomerTank; weather: any }) {
  const percentage = tank.latest_calibrated_fill_percentage;
  const getStatusColor = () => {
    if (percentage === null || percentage === undefined) return 'bg-gray-100 text-gray-600';
    if (percentage <= 20) return 'bg-red-100 text-red-700';
    if (percentage <= 50) return 'bg-yellow-100 text-yellow-700';
    return 'bg-green-100 text-green-700';
  };

  const getStatusText = () => {
    if (percentage === null || percentage === undefined) return 'No Data';
    if (percentage <= 20) return 'Critical';
    if (percentage <= 50) return 'Low';
    return 'Good';
  };

  // Current weather
  const currentTemp = weather?.hourly?.temperature_2m?.[new Date().getHours()]
    ?? weather?.daily?.temperature_2m_max?.[0];
  const todayRain = weather?.daily?.rain_sum?.[0] ?? 0;

  // 7-day forecast mini
  // Note: Append T12:00:00 to parse date as local noon, avoiding UTC midnight timezone issues
  const next7Days = weather?.daily?.time?.slice(0, 7).map((date: string, i: number) => ({
    day: i === 0 ? 'T' : format(new Date(`${date}T12:00:00`), 'EEEEE'),
    rain: weather.daily.rain_sum[i] ?? 0,
  })) ?? [];

  return (
    <div className="min-w-[220px] space-y-3 p-1">
      {/* Tank Info */}
      <div>
        <h3 className="font-semibold text-sm">{tank.location_id || 'Tank'}</h3>
        {tank.address1 && (
          <p className="text-xs text-gray-500 truncate">{tank.address1}</p>
        )}
      </div>

      {/* Fuel Level */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Fuel className="h-4 w-4 text-blue-600" />
          <span className="text-lg font-bold">
            {percentage !== null ? `${percentage.toFixed(0)}%` : '—'}
          </span>
        </div>
        <Badge className={getStatusColor()}>
          {getStatusText()}
        </Badge>
      </div>

      {/* Weather Section */}
      {weather && (
        <div className="border-t pt-2 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-orange-500" />
              <span className="font-medium">{currentTemp?.toFixed(0)}°C</span>
            </div>
            {todayRain > 0 && (
              <div className="flex items-center gap-1 text-blue-600 text-sm">
                <Droplets className="h-3 w-3" />
                {todayRain.toFixed(0)}mm today
              </div>
            )}
          </div>

          {/* Mini 7-day forecast */}
          <div className="flex items-center gap-0.5">
            {next7Days.map((day, i) => (
              <div key={i} className="flex-1 text-center" title={`${day.rain > 0 ? day.rain.toFixed(0) + 'mm' : 'No rain'}`}>
                {day.rain > 0 ? (
                  <Droplets className="h-3 w-3 mx-auto text-blue-400" />
                ) : (
                  <Sun className="h-3 w-3 mx-auto text-yellow-400" />
                )}
                <div className="text-[9px] text-gray-400">{day.day}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View Details Link */}
      <Link to={`/customer/tanks/${tank.id}`}>
        <Button size="sm" className="w-full h-7 text-xs">
          <Eye className="h-3 w-3 mr-1" />
          View Details
        </Button>
      </Link>
    </div>
  );
}

export default CustomerMapWidget;
