import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { useMapData } from '@/hooks/useMapData';
import { useTankModal } from '@/contexts/TankModalContext';
import { useAgbotModal } from '@/contexts/AgbotModalContext';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Container, Stack, Inline, ControlBar, StatusPanel } from '@/components/ui/layout';
import { TankMapPopup } from '@/components/TankMapPopup';
import { AgbotMapPopup } from '@/components/AgbotMapPopup';
import { Search, X, Eye, MapPin, Fuel, AlertTriangle, Layers, Download, RefreshCw, Navigation, Clock, Ruler, Calendar, Filter, Printer, FileText, Route, Signal } from 'lucide-react';
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
import { getIconForTank, getIconForAgbot } from '@/components/map/MapIcons';

// Icon logic moved to /src/components/map/MapIcons.ts

function MapView() {
  const { allItems, manualTanks, agbotDevices, counts, isLoading, error, refetch } = useMapData();
  const { openModal } = useTankModal();
  const { openModalFromMap } = useAgbotModal();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all'); // 'all', 'manual', 'agbot'
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
      // Trigger refetch of both tank and agbot data
      refetch();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [autoRefresh, refetch]);
  
  // Manual refresh handler
  const handleManualRefresh = () => {
    refetch();
  };
  
  // Export items as CSV
  const exportToCSV = () => {
    if (!filteredItems.length) return;
    
    const headers = [
      'ID', 'Location', 'Group', 'Product Type', 'Source', 'Current Level %', 
      'Safe Level', 'Min Level', 'Latitude', 'Longitude', 'Last Reading Date', 'Status'
    ];
    
    const csvData = filteredItems.map(item => [
      item.id,
      item.location || '',
      item.group_name || '',
      item.product_type || '',
      item.source,
      item.current_level_percent?.toFixed(1) || '',
      item.safe_level || '',
      item.min_level || '',
      item.latitude || '',
      item.longitude || '',
      item.latest_dip_date ? new Date(item.latest_dip_date).toLocaleDateString() : '',
      item.source === 'agbot' ? (item.device_online ? 'Online' : 'Offline') : 'Manual'
    ]);
    
    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => '"' + String(field).replaceAll('"', '""') + '"').join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'map-locations-' + new Date().toISOString().split('T')[0] + '.csv');
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
      pdf.text('Total locations shown: ' + filteredItems.length + ' (' + counts.manual + ' tanks, ' + counts.agbot + ' agbot devices)', 20, 40);
      
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
  
  // Filter items based on search and filters
  const filteredItems = useMemo(() => {
    if (!allItems) return [];
    
    return allItems.filter(item => {
      // Search filter
      if (searchTerm && !item.location?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Group filter
      if (selectedGroup !== 'all' && item.group_name !== selectedGroup) {
        return false;
      }
      
      // Source filter (manual tanks vs agbot devices)
      if (selectedSource !== 'all' && item.source !== selectedSource) {
        return false;
      }
      
      // Status filter
      if (selectedStatus !== 'all') {
        if (item.source === 'manual') {
          const status = getFuelStatus(item.current_level_percent);
          if (selectedStatus !== status) return false;
        } else if (item.source === 'agbot') {
          // For agbot, map status differently
          const percentage = item.current_level_percent;
          let agbotStatus = 'unknown';
          if (percentage !== null && percentage !== undefined) {
            if (percentage <= 20) agbotStatus = 'critical';
            else if (percentage <= 50) agbotStatus = 'low';
            else agbotStatus = 'normal';
          }
          if (selectedStatus !== agbotStatus) return false;
        }
      }
      
      return true;
    });
  }, [allItems, searchTerm, selectedGroup, selectedStatus, selectedSource]);
  
  // Get unique groups for filter dropdown
  const uniqueGroups = useMemo(() => {
    if (!allItems) return [];
    const groups = allItems.map(item => item.group_name).filter(Boolean) as string[];
    return Array.from(new Set(groups)).sort();
  }, [allItems]);
  
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
                  <h1 className="text-xl font-bold">Fuel Monitoring Map</h1>
                  <p className="text-sm text-gray-600">
                    Showing {filteredItems.length} of {counts.total} locations ({counts.manual} tanks, {counts.agbot} agbot devices)
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
                
                <Select value={selectedSource} onValueChange={setSelectedSource}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="manual">Tanks</SelectItem>
                    <SelectItem value="agbot">Agbot</SelectItem>
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
                <div className="flex items-center gap-4">
                  <span className="font-medium">Manual Tanks:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-600 rounded"></div>
                    <span className="text-sm">Critical</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-orange-500 rounded"></div>
                    <span className="text-sm">Low</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-600 rounded"></div>
                    <span className="text-sm">Normal</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-medium">Agbot Devices:</span>
                  <div className="flex items-center gap-2">
                    <Signal className="w-4 h-4 text-red-600" />
                    <span className="text-sm">Critical (&le;20%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Signal className="w-4 h-4 text-orange-500" />
                    <span className="text-sm">Low (&le;50%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Signal className="w-4 h-4 text-green-600" />
                    <span className="text-sm">Good (&gt;50%)</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToCSV}
                  className="h-8 text-sm whitespace-nowrap"
                  disabled={!filteredItems.length}
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
                  {filteredItems
                    .filter(item => item.latitude && item.longitude)
                    .map(item => (
                      <Marker
                        key={item.id}
                        position={[item.latitude!, item.longitude!]}
                        icon={item.source === 'manual' ? getIconForTank(item) : getIconForAgbot(item)}
                      >
                        <Popup>
                          {item.source === 'manual' ? (
                            <TankMapPopup 
                              tank={item} 
                              onViewDetails={openModal}
                            />
                          ) : (
                            <AgbotMapPopup 
                              agbot={item} 
                              onViewDetails={openModalFromMap}
                            />
                          )}
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