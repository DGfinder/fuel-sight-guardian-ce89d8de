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
import { TankMapPopup } from '@/components/TankMapPopup';
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
  const status = getFuelStatus(tank.current_level_percent);
  switch (status) {
    case 'critical': return TANK_ICONS.critical;
    case 'low': return TANK_ICONS.low;
    case 'normal': return TANK_ICONS.normal;
    default: return TANK_ICONS.default;
  }
};

function MapView() {
  const { tanks, isLoading, error } = useTanks();
  const { openModal } = useTankModal();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [mapStyle, setMapStyle] = useState('light');
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  // Default center for the map (Perth, WA)
  const defaultCenter: [number, number] = [-31.9505, 115.8605];
  
  // Map style configurations
  const mapStyles = {
    light: {
      url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    dark: {
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    satellite: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    },
    terrain: {
      url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
    },
  };
  
  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      // Trigger refetch of tanks data
      window.location.reload();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [autoRefresh]);
  
  // Manual refresh handler
  const handleManualRefresh = () => {
    window.location.reload();
  };
  
  // Export tanks as CSV
  const exportToCSV = () => {
    if (!filteredTanks.length) return;
    
    const headers = [
      'Tank ID', 'Location', 'Group', 'Product Type', 'Current Level %', 
      'Safe Level', 'Min Level', 'Latitude', 'Longitude', 'Last Reading Date'
    ];
    
    const csvData = filteredTanks.map(tank => [
      tank.id,
      tank.location || '',
      tank.group_name || '',
      tank.product_type || '',
      tank.current_level_percent?.toFixed(1) || '',
      tank.safe_level || '',
      tank.min_level || '',
      tank.latitude || '',
      tank.longitude || '',
      tank.latest_dip_date ? new Date(tank.latest_dip_date).toLocaleDateString() : ''
    ]);
    
    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => '"' + String(field).replaceAll('"', '""') + '"').join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'tank-locations-' + new Date().toISOString().split('T')[0] + '.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Export map as PDF
  const exportToPDF = async () => {
    try {
      const mapElement = document.querySelector('.leaflet-container') as HTMLElement;
      if (!mapElement) return;
      
      const canvas = await html2canvas(mapElement);
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('landscape');
      pdf.setFontSize(16);
      pdf.text('Tank Locations Map', 20, 20);
      
      pdf.setFontSize(10);
      pdf.text('Generated on: ' + new Date().toLocaleDateString(), 20, 30);
      pdf.text('Total tanks shown: ' + filteredTanks.length, 20, 40);
      
      const imgWidth = 250;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 20, 50, imgWidth, imgHeight);
      
      pdf.save('tank-locations-map-' + new Date().toISOString().split('T')[0] + '.pdf');
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };
  
  // Print map
  const printMap = () => {
    window.print();
  };
  
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
        const status = getFuelStatus(tank.current_level_percent);
        if (selectedStatus !== status) return false;
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
  
  // Handle error state
  if (error) {
    // Safely extract error message from various error types
    const errorMessage = (() => {
      if (typeof error === 'string') return error;
      if (error && typeof error === 'object') {
        if ('message' in error && typeof error.message === 'string') return error.message;
        if ('details' in error && typeof error.details === 'string') return error.details;
        if ('code' in error) return `Database error (${error.code})`;
      }
      return 'Unable to load tank data. Please check your connection and try again.';
    })();

    return (
      <Container className="py-4">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Error loading map data</h3>
              <p className="text-red-600 mt-1">{errorMessage}</p>
            </div>
            <Button onClick={() => window.location.reload()} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Reload Page
            </Button>
          </CardContent>
        </Card>
      </Container>
    );
  }
  
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
                
                <Select value={mapStyle} onValueChange={setMapStyle}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Map Style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="satellite">Satellite</SelectItem>
                    <SelectItem value="terrain">Terrain</SelectItem>
                  </SelectContent>
                </Select>
              </Inline>
            </Stack>
          </CardContent>
        </Card>
        
        {/* Legend and Controls */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <span className="font-medium">Status Legend:</span>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span className="text-sm">Critical (&le;10%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-orange-500 rounded"></div>
                  <span className="text-sm">Low (11-20%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span className="text-sm">Normal (&gt;20%)</span>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToCSV}
                  className="h-8 text-sm whitespace-nowrap"
                  disabled={!filteredTanks.length}
                >
                  <Download className="h-3 w-3 mr-1" />
                  CSV
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToPDF}
                  className="h-8 text-sm whitespace-nowrap"
                >
                  <FileText className="h-3 w-3 mr-1" />
                  PDF
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={printMap}
                  className="h-8 text-sm whitespace-nowrap"
                >
                  <Printer className="h-3 w-3 mr-1" />
                  Print
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualRefresh}
                  className="h-8 text-sm whitespace-nowrap"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Refresh
                </Button>
                
                <Button
                  variant={autoRefresh ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className="h-8 text-sm whitespace-nowrap"
                >
                  <RefreshCw className={autoRefresh ? "h-3 w-3 mr-1 animate-spin" : "h-3 w-3 mr-1"} />
                  Auto
                </Button>
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
                  key={mapStyle}
                  url={mapStyles[mapStyle as keyof typeof mapStyles].url}
                  attribution={mapStyles[mapStyle as keyof typeof mapStyles].attribution}
                />
                
                <MarkerClusterGroup>
                  {filteredTanks
                    .filter(tank => tank.latitude && tank.longitude)
                    .map(tank => (
                      <Marker
                        key={tank.id}
                        position={[tank.latitude!, tank.longitude!]}
                        icon={getIconForTank(tank)}
                      >
                        <Popup>
                          <TankMapPopup 
                            tank={tank} 
                            onViewDetails={openModal}
                          />
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