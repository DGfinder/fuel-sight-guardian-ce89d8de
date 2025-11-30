import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { useMapData, MapItem } from '@/hooks/useMapData';
import { useTankModal } from '@/contexts/TankModalContext';
import { useAgbotModal } from '@/contexts/AgbotModalContext';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useMapCleanup } from '@/hooks/useMapCleanup';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TankMapPopup } from '@/components/TankMapPopup';
import { AgbotMapPopup } from '@/components/AgbotMapPopup';
import { Search, X, Eye, MapPin, Fuel, AlertTriangle, Layers, Download, RefreshCw, Navigation, Clock, Ruler, Calendar, Filter, Printer, FileText, Route, Signal, Info, ChevronUp, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L from 'leaflet';
import 'leaflet.heat';
import 'leaflet-draw';
import 'leaflet-geometryutil';
// PERFORMANCE: html2canvas and jsPDF are dynamically imported when needed (see exportToPDF)

import { semanticColors } from '@/lib/design-tokens';
import { getFuelStatus, getFuelStatusText } from '@/components/ui/fuel-status';
import { getIconForTank, getIconForAgbot } from '@/components/map/MapIcons';

// Icon logic moved to /src/components/map/MapIcons.ts

type MapStyle = 'light' | 'dark' | 'satellite' | 'terrain';

// Smart cluster icon with urgency indicators
const createClusterCustomIcon = (cluster: any) => {
  const markers = cluster.getAllChildMarkers();
  const childCount = cluster.getChildCount();

  // Count by urgency status
  let criticalCount = 0;
  let urgentCount = 0;
  let warningCount = 0;

  markers.forEach((marker: any) => {
    // Get urgency from marker data
    const item = marker.options?.data;
    const percentage = item?.current_level_percent;

    // Determine urgency status
    let status = 'ok';
    if (item?.urgency_status) {
      status = item.urgency_status;
    } else if (percentage !== null && percentage !== undefined) {
      if (percentage <= 10) status = 'critical';
      else if (percentage <= 20) status = 'urgent';
      else if (percentage <= 30) status = 'warning';
    }

    if (status === 'critical') criticalCount++;
    else if (status === 'urgent') urgentCount++;
    else if (status === 'warning') warningCount++;
  });

  // Cluster color = worst status present
  let bgColor = '#16a34a'; // green (ok)
  let ringColor = 'rgba(22, 163, 74, 0.3)';
  let pulseClass = '';

  if (criticalCount > 0) {
    bgColor = '#dc2626'; // red
    ringColor = 'rgba(220, 38, 38, 0.3)';
    pulseClass = 'cluster-pulse-critical';
  } else if (urgentCount > 0) {
    bgColor = '#ea580c'; // orange
    ringColor = 'rgba(234, 88, 12, 0.3)';
    pulseClass = 'cluster-pulse-urgent';
  } else if (warningCount > 0) {
    bgColor = '#f59e0b'; // amber
    ringColor = 'rgba(245, 158, 11, 0.3)';
  }

  // Badge showing critical count if any
  const badge = criticalCount > 0
    ? `<span class="cluster-badge">${criticalCount}</span>`
    : '';

  return L.divIcon({
    html: `
      <div class="cluster-marker ${pulseClass}" style="--cluster-color: ${bgColor}; --ring-color: ${ringColor}">
        <span class="cluster-count">${childCount}</span>
        ${badge}
      </div>
    `,
    className: 'custom-cluster-icon',
    iconSize: L.point(44, 44),
  });
};

// Heatmap layer component
const HeatmapLayer = ({ show, data }: { show: boolean; data: [number, number, number][] }) => {
  const map = useMap();

  useEffect(() => {
    if (!show || data.length === 0) return;

    // @ts-ignore - leaflet.heat types
    const heat = L.heatLayer(data, {
      radius: 35,
      blur: 25,
      maxZoom: 12,
      gradient: {
        0.2: '#22c55e',
        0.4: '#84cc16',
        0.6: '#eab308',
        0.8: '#f97316',
        1.0: '#dc2626'
      }
    }).addTo(map);

    return () => { map.removeLayer(heat); };
  }, [map, show, data]);

  return null;
};

// Optimized markers component with React.memo
interface MapMarkersProps {
  items: any[];
  openModal: (tank: any) => void;
  openModalFromMap: (agbot: any) => void;
}

const MapMarkers = React.memo(({ items, openModal, openModalFromMap }: MapMarkersProps) => {
  const markers = useMemo(
    () =>
      items
        .filter(item => item.latitude && item.longitude)
        .map(item => {
          // Determine marker class based on status
          const getMarkerClass = () => {
            const classes: string[] = [];
            const urgency = item.urgency_status;
            const pct = item.current_level_percent;

            if (urgency === 'critical' || (pct !== null && pct <= 10)) {
              classes.push('marker-critical');
            } else if (urgency === 'urgent' || (pct !== null && pct <= 20)) {
              classes.push('marker-urgent');
            }

            // Check for stale data (>24h old)
            if (item.latest_dip_date) {
              const hoursSince = (Date.now() - new Date(item.latest_dip_date).getTime()) / (1000 * 60 * 60);
              if (hoursSince > 24) classes.push('marker-stale');
            }

            return classes.join(' ');
          };

          return (
            <Marker
              key={item.id}
              position={[item.latitude!, item.longitude!]}
              icon={item.source === 'manual' ? getIconForTank(item) : getIconForAgbot(item)}
              // @ts-ignore - pass data for cluster icon function
              data={item}
            >
              <Popup>
                {item.source === 'manual' ? (
                  <TankMapPopup tank={item} onViewDetails={openModal} />
                ) : (
                  <AgbotMapPopup agbot={item} onViewDetails={openModalFromMap} />
                )}
              </Popup>
            </Marker>
          );
        }),
    [items, openModal, openModalFromMap]
  );

  return <>{markers}</>;
});

MapMarkers.displayName = 'MapMarkers';

function MapView() {
  const { allItems, manualTanks, agbotDevices, counts, isLoading, error, refetch, tanksQuery, agbotQuery, smartfillQuery } = useMapData();

  // Progressive loading: check individual query states
  const hasAnyData = (manualTanks?.length || 0) > 0 || (agbotDevices?.length || 0) > 0;
  const isPartiallyLoaded = hasAnyData && isLoading;
  const fullyLoaded = !isLoading;
  const { openModalFromMap: openTankModalFromMap } = useTankModal();
  const { openModalFromMap: openAgbotModalFromMap } = useAgbotModal();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all'); // 'all', 'manual', 'agbot'
  const [showFilters, setShowFilters] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyle>('light');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Heatmap data (consumption-weighted)
  const heatmapData = useMemo((): [number, number, number][] => {
    if (!allItems) return [];
    return allItems
      .filter(item => item.latitude && item.longitude)
      .map(item => {
        // Intensity based on urgency (critical = highest)
        let intensity = 0.3;
        const pct = item.current_level_percent;
        if (pct !== null && pct !== undefined) {
          if (pct <= 10) intensity = 1.0;
          else if (pct <= 20) intensity = 0.8;
          else if (pct <= 30) intensity = 0.6;
          else intensity = 0.3;
        }
        return [item.latitude!, item.longitude!, intensity] as [number, number, number];
      });
  }, [allItems]);

  // Map cleanup hook for React 19 compatibility
  useMapCleanup();

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

      // PERFORMANCE: Dynamic imports - these heavy libraries (~400KB) are only loaded when user clicks export
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf')
      ]);

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
  
  // Only show full loading state if we have NO data at all
  // Progressive rendering: show map as soon as any data is available
  if (isLoading && !hasAnyData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading map...</div>
      </div>
    );
  }
  
  return (
    <div className="h-[calc(100vh-56px-64px)] md:h-full relative flex flex-col">
      {/* Floating Toolbar */}
      <div className="absolute top-4 left-4 right-4 z-[1000]">
        <Card className="p-3 shadow-lg backdrop-blur-sm bg-white/95 dark:bg-gray-900/95 border-gray-200 dark:border-gray-700">
          <div className="flex flex-col gap-3">
            {/* Row 1: Title + Search + Actions */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <h1 className="text-lg font-bold whitespace-nowrap">Fuel Map</h1>
                <Badge variant="secondary" className="text-xs">
                  {filteredItems.length}
                  {isPartiallyLoaded && (
                    <RefreshCw className="inline w-3 h-3 ml-1 animate-spin" />
                  )}
                </Badge>
              </div>

              <div className="relative flex-1 max-w-xs hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search tanks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Export dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 w-9 p-0" title="Export">
                      <Download className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportToCSV} disabled={!filteredItems.length}>
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportToPDF}>
                      <FileText className="h-4 w-4 mr-2" />
                      Export PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={printMap}>
                      <Printer className="h-4 w-4 mr-2" />
                      Print
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualRefresh}
                  className="h-9 w-9 p-0"
                  title="Refresh"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>

                <Button
                  variant={autoRefresh ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className="h-9 w-9 p-0"
                  title={autoRefresh ? "Auto-refresh on" : "Auto-refresh off"}
                >
                  <Clock className={cn("h-4 w-4", autoRefresh && "animate-pulse")} />
                </Button>

                <Button
                  variant={showHeatmap ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowHeatmap(!showHeatmap)}
                  className="h-9 w-9 p-0"
                  title={showHeatmap ? "Hide heatmap" : "Show urgency heatmap"}
                >
                  <Flame className={cn("h-4 w-4", showHeatmap && "text-orange-400")} />
                </Button>
              </div>
            </div>

            {/* Mobile search */}
            <div className="relative md:hidden">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search tanks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Row 2: Filters (responsive) */}
            <div className="grid grid-cols-2 md:flex md:flex-row gap-2">
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All Groups" />
                </SelectTrigger>
                <SelectContent className="z-[1001]">
                  <SelectItem value="all">All Groups</SelectItem>
                  {uniqueGroups.map(group => (
                    <SelectItem key={group} value={group}>{group}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className="z-[1001]">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedSource} onValueChange={setSelectedSource}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent className="z-[1001]">
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="manual">Tanks</SelectItem>
                  <SelectItem value="agbot">Agbot</SelectItem>
                </SelectContent>
              </Select>

              <Select value={mapStyle} onValueChange={setMapStyle}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Map Style" />
                </SelectTrigger>
                <SelectContent className="z-[1001]">
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="satellite">Satellite</SelectItem>
                  <SelectItem value="terrain">Terrain</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      </div>

      {/* Collapsible Legend Panel */}
      <div className="absolute bottom-4 left-4 z-[1000]">
        <div className="flex flex-col items-start gap-2">
          {showLegend && (
            <Card className="p-3 shadow-lg backdrop-blur-sm bg-white/95 dark:bg-gray-900/95 border-gray-200 dark:border-gray-700 animate-in slide-in-from-bottom-2 duration-200">
              <div className="space-y-3 text-sm">
                <div>
                  <div className="font-medium mb-2 text-gray-700 dark:text-gray-300">Manual Tanks</div>
                  <div className="flex flex-wrap gap-3">
                    <span className="flex items-center gap-1.5">
                      <div className="w-3 h-3 bg-red-600 rounded" />
                      <span className="text-gray-600 dark:text-gray-400">Critical</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <div className="w-3 h-3 bg-orange-500 rounded" />
                      <span className="text-gray-600 dark:text-gray-400">Low</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <div className="w-3 h-3 bg-green-600 rounded" />
                      <span className="text-gray-600 dark:text-gray-400">Normal</span>
                    </span>
                  </div>
                </div>
                <div>
                  <div className="font-medium mb-2 text-gray-700 dark:text-gray-300">Agbot Devices</div>
                  <div className="flex flex-wrap gap-3">
                    <span className="flex items-center gap-1.5">
                      <Signal className="w-3 h-3 text-red-600" />
                      <span className="text-gray-600 dark:text-gray-400">≤20%</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Signal className="w-3 h-3 text-orange-500" />
                      <span className="text-gray-600 dark:text-gray-400">≤50%</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Signal className="w-3 h-3 text-green-600" />
                      <span className="text-gray-600 dark:text-gray-400">&gt;50%</span>
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          )}
          <Button
            variant="outline"
            size="sm"
            className="shadow-lg bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm"
            onClick={() => setShowLegend(!showLegend)}
          >
            <Info className="h-4 w-4 mr-1.5" />
            Legend
            <ChevronUp className={cn(
              "h-4 w-4 ml-1.5 transition-transform duration-200",
              !showLegend && "rotate-180"
            )} />
          </Button>
        </div>
      </div>

      {/* Full-bleed Map */}
      <div className="flex-1 w-full">
        <MapContainer
          key={`map-${selectedGroup}-${mapStyle}`}
          center={defaultCenter}
          zoom={10}
          zoomControl={false}
          style={{ height: '100%', width: '100%' }}
        >
          <ZoomControl position="bottomleft" />
          <TileLayer
            key={mapStyle}
            url={mapStyles[mapStyle].url}
            attribution={mapStyles[mapStyle].attribution}
          />

          {/* Heatmap layer (togglable) */}
          <HeatmapLayer show={showHeatmap} data={heatmapData} />

          {/* Only render clusters when we have data (fixes 0,0 bug) */}
          {filteredItems.length > 0 && (
            <MarkerClusterGroup
              chunkedLoading
              iconCreateFunction={createClusterCustomIcon}
              maxClusterRadius={60}
              spiderfyOnMaxZoom={true}
              showCoverageOnHover={false}
              animate={true}
              animateAddingMarkers={true}
            >
              <MapMarkers
                items={filteredItems}
                openModal={openTankModalFromMap}
                openModalFromMap={openAgbotModalFromMap}
              />
            </MarkerClusterGroup>
          )}
        </MapContainer>
      </div>
    </div>
  );
}

export default MapView;