import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { useTanks } from '@/hooks/useTanks';
import { useTankModal } from '@/contexts/TankModalContext';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Container, Stack, Inline, ControlBar, StatusPanel } from '@/components/ui/layout';
import { Search, X, Eye, MapPin, Fuel, AlertTriangle, Layers, Download, RefreshCw, Navigation, Clock, Ruler, Calendar, Filter, Printer, FileText, Route } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L from 'leaflet';
import 'leaflet.heat';
import 'leaflet-draw';
import 'leaflet-geometryutil';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import { semanticColors } from '@/lib/design-tokens';
import { getFuelStatus, getFuelStatusText } from '@/components/ui/fuel-status';

// Create simple tank icons without template literals
const createTankIcon = (color: string) => {
  return new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">' +
      '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="' + color + '" stroke="#ffffff" stroke-width="2"/>' +
      '<circle cx="12" cy="9" r="3" fill="#ffffff"/>' +
      '</svg>'
    ),
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  });
};

const TANK_ICONS = {
  critical: createTankIcon(semanticColors.tankCritical),
  low: createTankIcon(semanticColors.tankLow),
  normal: createTankIcon(semanticColors.tankNormal),
  default: createTankIcon(semanticColors.tankUnknown),
};

const getIconForTank = (tank: { current_level_percent?: number | null }) => {
  const percent = tank.current_level_percent ?? 0;
  if (percent <= 20) return TANK_ICONS.critical;
  if (percent <= 40) return TANK_ICONS.low;
  return TANK_ICONS.normal;
};

function MapView() {
  const { tanks, isLoading } = useTanks();
  const { openTankModal } = useTankModal();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [mapStyle, setMapStyle] = useState('light');
  
  // Default center for the map (Perth, WA)
  const defaultCenter: [number, number] = [-31.9505, 115.8605];
  
  // Filter tanks based on search and filters
  const filteredTanks = useMemo(() => {
    if (!tanks) return [];
    
    return tanks.filter(tank => {
      // Search filter
      if (searchTerm && !tank.location?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Group filter
      if (selectedGroup !== 'all' && tank.group_name !== selectedGroup) {
        return false;
      }
      
      // Status filter
      if (selectedStatus !== 'all') {
        const percent = tank.current_level_percent ?? 0;
        if (selectedStatus === 'critical' && percent > 20) return false;
        if (selectedStatus === 'low' && (percent <= 20 || percent > 40)) return false;
        if (selectedStatus === 'normal' && percent <= 40) return false;
      }
      
      return true;
    });
  }, [tanks, searchTerm, selectedGroup, selectedStatus]);
  
  // Get unique groups for filter dropdown
  const uniqueGroups = useMemo(() => {
    if (!tanks) return [];
    const groups = tanks.map(tank => tank.group_name).filter(Boolean) as string[];
    return Array.from(new Set(groups)).sort();
  }, [tanks]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading map...</div>
      </div>
    );
  }
  
  return (
    <Container className="py-4">
      <Stack spacing="lg">
        {/* Header Section */}
        <Card>
          <CardContent className="p-4">
            <Stack spacing="md">
              {/* Header Info */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold">Tank Locations Map</h1>
                  <p className="text-sm text-gray-600">
                    Showing {filteredTanks.length} of {tanks?.length || 0} tanks
                  </p>
                </div>
              </div>
              
              {/* Search & Filters */}
              <Inline spacing="md" align="center">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search tanks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-10"
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Groups" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Groups</SelectItem>
                    {uniqueGroups.map(group => (
                      <SelectItem key={group} value={group}>{group}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                  </SelectContent>
                </Select>
              </Inline>
            </Stack>
          </CardContent>
        </Card>
        
        {/* Legend */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-6">
              <span className="font-medium">Status Legend:</span>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span className="text-sm">Critical (&le;20%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-500 rounded"></div>
                <span className="text-sm">Low (21-40%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span className="text-sm">Normal (&gt;40%)</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Map */}
        <Card>
          <CardContent className="p-0">
            <div className="h-[600px] w-full">
              <MapContainer
                center={defaultCenter}
                zoom={10}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />
                
                <MarkerClusterGroup>
                  {filteredTanks
                    .filter(tank => tank.latitude && tank.longitude)
                    .map(tank => (
                      <Marker
                        key={tank.id}
                        position={[tank.latitude!, tank.longitude!]}
                        icon={getIconForTank(tank)}
                        eventHandlers={{
                          click: () => openTankModal(tank),
                        }}
                      >
                        <Popup>
                          <div className="p-2">
                            <h3 className="font-semibold">{tank.location}</h3>
                            <p className="text-sm text-gray-600">{tank.group_name}</p>
                            <p className="text-sm">
                              Level: {tank.current_level_percent?.toFixed(1) || 'N/A'}%
                            </p>
                          </div>
                        </Popup>
                      </Marker>
                    ))
                  }
                </MarkerClusterGroup>
              </MapContainer>
            </div>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}

export default MapView;