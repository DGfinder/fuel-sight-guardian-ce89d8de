import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { useTanks } from '@/hooks/useTanks';
import { useTankModal } from '@/contexts/TankModalContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Color-coded icons based on tank status
const createStatusIcon = (status: 'critical' | 'low' | 'normal' | 'default') => {
  const colors = {
    critical: '#dc2626', // red-600
    low: '#f59e0b',      // amber-500
    normal: '#16a34a',   // green-600
    default: '#3b82f6'   // blue-500
  };

  const color = colors[status];
  
  return new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${color}" stroke="#ffffff" stroke-width="2"/>
        <circle cx="12" cy="9" r="3" fill="#ffffff"/>
      </svg>
    `)}`,
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  });
};

const getIconForTank = (tank: { current_level_percent?: number | null }) => {
  const percent = tank.current_level_percent ?? 0;
  if (percent <= 20) return createStatusIcon('critical');
  if (percent <= 40) return createStatusIcon('low');
  return createStatusIcon('normal');
};

type MapStyle = 'light' | 'dark' | 'satellite' | 'terrain';

const mapStyles = {
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    name: 'Light'
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    name: 'Dark'
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    name: 'Satellite'
  },
  terrain: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
    name: 'Terrain'
  }
};

export default function MapView() {
  const { tanks, isLoading } = useTanks();
  const { openModal } = useTankModal();
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [mapStyle, setMapStyle] = useState<MapStyle>('dark');

  // --- ADDED FOR DIAGNOSIS ---
  console.log('Data received by MapView:', tanks);
  console.log('First tank with coordinates:', tanks?.find(tank => tank.latitude && tank.longitude));
  console.log('Tanks with lat/lng count:', tanks?.filter(tank => tank.latitude != null && tank.longitude != null).length);

  const uniqueGroups = useMemo(() => {
    if (!tanks) return [];
    return [...new Set(tanks.map(tank => tank.group_name).filter(Boolean))];
  }, [tanks]);

  const filteredTanks = useMemo(() => {
    if (!tanks) return [];

    let workingTanks = tanks.filter(
      (tank) => tank.latitude != null && tank.longitude != null
    );

    // Apply Group Filter
    if (selectedGroup !== 'all') {
      workingTanks = workingTanks.filter(tank => tank.group_name === selectedGroup);
    }

    // Apply Status Filter
    if (statusFilter !== 'all') {
      workingTanks = workingTanks.filter(tank => {
        const percent = tank.current_level_percent ?? 0;
        if (statusFilter === 'critical') return percent <= 20;
        if (statusFilter === 'low') return percent > 20 && percent <= 40;
        if (statusFilter === 'normal') return percent > 40;
        return true;
      });
    }

    return workingTanks;
  }, [tanks, selectedGroup, statusFilter]);

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
      <div className="h-full flex flex-col">
        {/* Enhanced Info banner with filters */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-sm text-blue-700">
                <strong>Map View:</strong> {filteredTanks?.length || 0} tanks displayed
                {tanks && tanks.length > 0 && (
                  <span className="text-blue-600"> of {tanks.length} total</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue placeholder="All Groups" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Groups</SelectItem>
                    {uniqueGroups.map(group => (
                      <SelectItem key={group} value={group}>{group}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={mapStyle} onValueChange={(value: MapStyle) => setMapStyle(value)}>
                  <SelectTrigger className="w-[100px] h-8 text-xs">
                    <SelectValue placeholder="Map Style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="satellite">Satellite</SelectItem>
                    <SelectItem value="terrain">Terrain</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-blue-600">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span>Critical (≤20%)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                <span>Low (21-40%)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                 <span>Normal (&gt;40%)</span>
              </div>
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
              key={mapStyle}
              url={mapStyles[mapStyle].url}
              attribution={mapStyles[mapStyle].attribution}
            />
            {/* Tank markers with coordinate data */}
            {filteredTanks?.map((tank) => (
              <Marker
                key={tank.id}
                position={[Number(tank.latitude), Number(tank.longitude)]}
                icon={getIconForTank(tank)}
                eventHandlers={{
                  click: () => {
                    openModal(tank);
                  },
                }}
              />
            ))}
            {/* Default marker when no tank coordinates are available */}
            {(!filteredTanks || filteredTanks.length === 0) && (
              <Marker 
                position={defaultCenter} 
                icon={createStatusIcon('default')}
              />
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
} 