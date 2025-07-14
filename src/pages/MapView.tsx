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

// Memoized icon instances using design system colors
const TANK_ICONS = {
  critical: new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${semanticColors.tankCritical}" stroke="#ffffff" stroke-width="2"/>
        <circle cx="12" cy="9" r="3" fill="#ffffff"/>
      </svg>
    `)}`,
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  }),
  low: new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${semanticColors.tankLow}" stroke="#ffffff" stroke-width="2"/>
        <circle cx="12" cy="9" r="3" fill="#ffffff"/>
      </svg>
    `)}`,
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  }),
  normal: new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${semanticColors.tankNormal}" stroke="#ffffff" stroke-width="2"/>
        <circle cx="12" cy="9" r="3" fill="#ffffff"/>
      </svg>
    `)}`,
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  }),
  default: new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${semanticColors.tankUnknown}" stroke="#ffffff" stroke-width="2"/>
        <circle cx="12" cy="9" r="3" fill="#ffffff"/>
      </svg>
    `)}`,
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  }),
  user: new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
        <circle cx="12" cy="12" r="10" fill="${semanticColors.textPrimary}" stroke="#ffffff" stroke-width="3"/>
        <circle cx="12" cy="12" r="4" fill="#ffffff"/>
      </svg>
    `)}`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  }),
};

const getIconForTank = (tank: { current_level_percent?: number | null }) => {
  const percent = tank.current_level_percent ?? 0;
  if (percent <= 20) return TANK_ICONS.critical;
  if (percent <= 40) return TANK_ICONS.low;
  return TANK_ICONS.normal;
};

import { getFuelStatus, getFuelStatusText } from '@/components/ui/fuel-status';

const getTankStatus = (tank: { current_level_percent?: number | null }) => {
  const percent = tank.current_level_percent ?? 0;
  const status = getFuelStatus(percent);
  
  return {
    status: status,
    variant: status === 'critical' ? 'fuel-critical' : 
             status === 'low' ? 'fuel-low' :
             status === 'normal' ? 'fuel-normal' : 'fuel-unknown',
    text: getFuelStatusText(percent)
  };
};

// Custom popup component
const TankPopup = ({ 
  tank, 
  onViewDetails, 
  showRouteMode, 
  isSelected, 
  onToggleSelection 
}: { 
  tank: any; 
  onViewDetails: () => void;
  showRouteMode: boolean;
  isSelected: boolean;
  onToggleSelection: () => void;
}) => {
  const statusInfo = getTankStatus(tank);
  const percent = tank.current_level_percent ?? 0;
  
  return (
    <div className="min-w-[200px] p-2">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm truncate">{tank.name}</h3>
          <Badge variant={statusInfo.variant as any} size="sm">
            {statusInfo.text}
          </Badge>
        </div>
        
        <div className="space-y-1 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{tank.location || 'Unknown location'}</span>
          </div>
          <div className="flex items-center gap-1">
            <Fuel className="h-3 w-3" />
            <span>Level: {percent.toFixed(1)}%</span>
          </div>
          {tank.group_name && (
            <div className="text-gray-500">
              Group: {tank.group_name}
            </div>
          )}
        </div>
        
        <div className="flex gap-2 pt-2 border-t">
          <Button
            size="sm"
            onClick={onViewDetails}
            className="flex-1 h-7 text-xs"
          >
            <Eye className="h-3 w-3 mr-1" />
            Details
          </Button>
          
          {showRouteMode && (
            <Button
              size="sm"
              variant={isSelected ? "default" : "outline"}
              onClick={onToggleSelection}
              className="h-7 text-xs"
            >
              <Route className="h-3 w-3 mr-1" />
              {isSelected ? 'Selected' : 'Select'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// Heat map component
const HeatMapLayer = ({ tanks, enabled }: { tanks: any[]; enabled: boolean }) => {
  const map = useMap();

  useEffect(() => {
    if (!enabled || !tanks?.length) return;

    // Prepare heat map data - [lat, lng, intensity]
    const heatData = tanks.map(tank => {
      const lat = Number(tank.latitude);
      const lng = Number(tank.longitude);
      // Use inverse of fuel level percentage as intensity (lower fuel = higher heat)
      const intensity = Math.max(0.1, (100 - (tank.current_level_percent ?? 50)) / 100);
      return [lat, lng, intensity];
    });

    // Create heat layer
    const heatLayer = (L as any).heatLayer(heatData, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      gradient: {
        0.0: 'green',
        0.5: 'yellow',
        1.0: 'red'
      }
    }).addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, tanks, enabled]);

  return null;
};

// Map reference component
const MapRef = ({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) => {
  const map = useMap();
  
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  
  return null;
};

// Measurement tools component
const MeasurementTools = ({ 
  enabled, 
  onMeasurement,
  drawControlRef,
  drawnItemsRef
}: { 
  enabled: boolean;
  onMeasurement: (measurement: string) => void;
  drawControlRef: React.MutableRefObject<L.Control.Draw | null>;
  drawnItemsRef: React.MutableRefObject<L.FeatureGroup | null>;
}) => {
  const map = useMap();

  useEffect(() => {
    if (!enabled) {
      // Remove draw control and clear measurements
      if (drawControlRef.current) {
        map.removeControl(drawControlRef.current);
        drawControlRef.current = null;
      }
      if (drawnItemsRef.current) {
        drawnItemsRef.current.clearLayers();
      }
      return;
    }

    // Create feature group for drawn items
    if (!drawnItemsRef.current) {
      drawnItemsRef.current = new L.FeatureGroup();
      map.addLayer(drawnItemsRef.current);
    }

    // Create draw control
    const drawControl = new L.Control.Draw({
      edit: {
        featureGroup: drawnItemsRef.current,
        remove: true
      },
      draw: {
        polyline: {
          metric: true,
          feet: false,
          showLength: true
        },
        polygon: {
          metric: true,
          feet: false,
          showArea: true
        },
        circle: false,
        rectangle: {
          metric: true,
          feet: false,
          showArea: true
        },
        marker: false,
        circlemarker: false
      }
    });

    map.addControl(drawControl);
    drawControlRef.current = drawControl;

    // Handle draw events
    const handleDrawCreated = (e: any) => {
      const layer = e.layer;
      drawnItemsRef.current?.addLayer(layer);

      let measurement = '';
      if (e.layerType === 'polyline') {
        // Calculate total distance for polyline
        const latlngs = layer.getLatLngs();
        let totalDistance = 0;
        for (let i = 0; i < latlngs.length - 1; i++) {
          totalDistance += latlngs[i].distanceTo(latlngs[i + 1]);
        }
        const distanceKm = (totalDistance / 1000).toFixed(2);
        measurement = `Distance: ${distanceKm} km`;
      } else if (e.layerType === 'polygon' || e.layerType === 'rectangle') {
        // Calculate area
        const latlngs = layer.getLatLngs()[0];
        let area = 0;
        const coords = latlngs.map((ll: L.LatLng) => [ll.lat, ll.lng]);
        
        // Simple shoelace formula for polygon area
        for (let i = 0; i < coords.length; i++) {
          const j = (i + 1) % coords.length;
          area += coords[i][0] * coords[j][1];
          area -= coords[j][0] * coords[i][1];
        }
        area = Math.abs(area) / 2;
        
        // Convert to square kilometers (rough approximation)
        const areaKm = (area * 12400).toFixed(2); // Rough conversion factor
        measurement = `Area: ${areaKm} km²`;
      }

      if (measurement) {
        onMeasurement(measurement);
      }
    };

    const handleDrawDeleted = () => {
      // Could update measurements list here
    };

    map.on(L.Draw.Event.CREATED, handleDrawCreated);
    map.on(L.Draw.Event.DELETED, handleDrawDeleted);

    return () => {
      map.off(L.Draw.Event.CREATED, handleDrawCreated);
      map.off(L.Draw.Event.DELETED, handleDrawDeleted);
      if (drawControlRef.current) {
        map.removeControl(drawControlRef.current);
        drawControlRef.current = null;
      }
    };
  }, [map, enabled, onMeasurement, drawControlRef, drawnItemsRef]);

  return null;
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
  const { tanks, isLoading, refreshTanks } = useTanks();
  const { openModal } = useTankModal();
  const { preferences, updatePreferences, isLoading: preferencesLoading } = useUserPreferences();
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [mapStyle, setMapStyle] = useState<MapStyle>(preferences.preferred_map_style);
  const [searchQuery, setSearchQuery] = useState('');
  const [enableClustering, setEnableClustering] = useState(true);
  const [showHeatMap, setShowHeatMap] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [measurementMode, setMeasurementMode] = useState(false);
  const [measurements, setMeasurements] = useState<string[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [alertStatusFilter, setAlertStatusFilter] = useState('all');
  const [showRouteMode, setShowRouteMode] = useState(false);
  const [selectedTanks, setSelectedTanks] = useState<string[]>([]);
  const [routeLayer, setRouteLayer] = useState<L.Polyline | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);

  // Update map style when preferences load
  useEffect(() => {
    if (!preferencesLoading) {
      setMapStyle(preferences.preferred_map_style);
    }
  }, [preferences.preferred_map_style, preferencesLoading]);

  // Save map style preference when changed
  const handleMapStyleChange = (newStyle: MapStyle) => {
    setMapStyle(newStyle);
    updatePreferences({ preferred_map_style: newStyle });
  };

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refreshTanks();
      setLastRefresh(new Date());
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, refreshTanks]);

  // Manual refresh
  const handleManualRefresh = () => {
    refreshTanks();
    setLastRefresh(new Date());
  };

  // Geolocation functionality
  const handleFindMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser');
      return;
    }

    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLocation: [number, number] = [latitude, longitude];
        setUserLocation(newLocation);
        
        // Fly to user location if map is available
        if (mapRef.current) {
          mapRef.current.flyTo(newLocation, 12, {
            duration: 1.5
          });
        }
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Location access denied by user');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError('Location information is unavailable');
            break;
          case error.TIMEOUT:
            setLocationError('Location request timed out');
            break;
          default:
            setLocationError('An unknown error occurred');
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  };

  // Measurement handler
  const handleMeasurement = (measurement: string) => {
    setMeasurements(prev => [...prev, measurement]);
  };

  // Clear measurements
  const clearMeasurements = () => {
    setMeasurements([]);
    if (drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers();
    }
  };

  // Print map
  const handlePrintMap = () => {
    window.print();
  };

  // Export map as PDF
  const handleExportPDF = async () => {
    try {
      const mapContainer = document.querySelector('.leaflet-container') as HTMLElement;
      if (!mapContainer) {
        alert('Map not found');
        return;
      }

      // Create canvas from map
      const canvas = await html2canvas(mapContainer, {
        useCORS: true,
        backgroundColor: '#ffffff',
        scale: 1,
        width: mapContainer.offsetWidth,
        height: mapContainer.offsetHeight
      });

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // Add title
      pdf.setFontSize(16);
      pdf.text('Tank Locations Map', 20, 20);
      
      // Add timestamp
      pdf.setFontSize(10);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
      
      // Add tank count
      pdf.text(`Tanks displayed: ${filteredTanks?.length || 0} of ${tanks?.length || 0} total`, 20, 35);

      // Add map image
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 250; // A4 landscape width minus margins
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 20, 45, imgWidth, imgHeight);

      // Add legend
      const legendY = 45 + imgHeight + 10;
      pdf.setFontSize(12);
      pdf.text('Legend:', 20, legendY);
      
      pdf.setFontSize(8);
      pdf.setTextColor(220, 38, 38); // Critical color
      pdf.text('● Critical (≤20%)', 20, legendY + 5);
      
      pdf.setTextColor(245, 158, 11); // Low fuel color
      pdf.text('● Low (21-40%)', 20, legendY + 10);
      
      pdf.setTextColor(22, 163, 74); // Normal fuel color
      pdf.text('● Normal (>40%)', 20, legendY + 15);

      // Save PDF
      pdf.save(`tank-locations-map-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Error creating PDF. Please try again.');
    }
  };

  // Route optimization functions
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const optimizeRoute = (tanks: any[], startLocation?: [number, number]): any[] => {
    if (tanks.length <= 1) return tanks;

    const unvisited = [...tanks];
    const route = [];
    let currentLocation = startLocation || [Number(tanks[0].latitude), Number(tanks[0].longitude)];

    // Simple greedy nearest neighbor algorithm
    while (unvisited.length > 0) {
      let nearestIndex = 0;
      let shortestDistance = Infinity;

      unvisited.forEach((tank, index) => {
        const distance = calculateDistance(
          currentLocation[0], currentLocation[1],
          Number(tank.latitude), Number(tank.longitude)
        );
        if (distance < shortestDistance) {
          shortestDistance = distance;
          nearestIndex = index;
        }
      });

      const nearestTank = unvisited.splice(nearestIndex, 1)[0];
      route.push(nearestTank);
      currentLocation = [Number(nearestTank.latitude), Number(nearestTank.longitude)];
    }

    return route;
  };

  const handleTankSelection = (tankId: string) => {
    setSelectedTanks(prev => {
      const newSelection = prev.includes(tankId)
        ? prev.filter(id => id !== tankId)
        : [...prev, tankId];
      return newSelection;
    });
  };

  const generateOptimizedRoute = () => {
    if (selectedTanks.length < 2) {
      alert('Please select at least 2 tanks to generate a route');
      return;
    }

    const selectedTankData = filteredTanks?.filter(tank => selectedTanks.includes(tank.id)) || [];
    const optimizedTanks = optimizeRoute(selectedTankData, userLocation || undefined);

    // Remove existing route
    if (routeLayer && mapRef.current) {
      mapRef.current.removeLayer(routeLayer);
    }

    // Create new route polyline
    const routeCoords: [number, number][] = [];
    
    // Add user location as starting point if available
    if (userLocation) {
      routeCoords.push(userLocation);
    }
    
    // Add optimized tank coordinates
    optimizedTanks.forEach(tank => {
      routeCoords.push([Number(tank.latitude), Number(tank.longitude)]);
    });

    if (mapRef.current && routeCoords.length > 1) {
      const newRouteLayer = L.polyline(routeCoords, {
        color: semanticColors.textPrimary,
        weight: 3,
        opacity: 0.7,
        dashArray: '10, 5'
      }).addTo(mapRef.current);

      setRouteLayer(newRouteLayer);

      // Calculate total distance
      let totalDistance = 0;
      for (let i = 0; i < routeCoords.length - 1; i++) {
        totalDistance += calculateDistance(
          routeCoords[i][0], routeCoords[i][1],
          routeCoords[i + 1][0], routeCoords[i + 1][1]
        );
      }

      alert(`Route optimized! Total distance: ${totalDistance.toFixed(2)} km`);
    }
  };

  const clearRoute = () => {
    if (routeLayer && mapRef.current) {
      mapRef.current.removeLayer(routeLayer);
      setRouteLayer(null);
    }
    setSelectedTanks([]);
  };

  // Export filtered tanks as CSV
  const handleExportTanks = () => {
    if (!filteredTanks?.length) {
      alert('No tanks to export');
      return;
    }

    const headers = [
      'Tank Name', 'Location', 'Group', 'Customer', 'Current Level (%)', 
      'Status', 'Latitude', 'Longitude', 'Last Updated'
    ];

    const csvData = filteredTanks.map(tank => [
      tank.name || '',
      tank.location || '',
      tank.group_name || '',
      tank.customer_name || '',
      tank.current_level_percent?.toFixed(1) || '0',
      getTankStatus(tank).status,
      tank.latitude || '',
      tank.longitude || '',
      tank.last_reading_at ? new Date(tank.last_reading_at).toLocaleDateString() : ''
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `tank-locations-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  const uniqueGroups = useMemo(() => {
    if (!tanks) return [];
    return [...new Set(tanks.map(tank => tank.group_name).filter(Boolean))];
  }, [tanks]);

  const filteredTanks = useMemo(() => {
    if (!tanks) return [];

    let workingTanks = tanks.filter(
      (tank) => tank.latitude != null && tank.longitude != null
    );

    // Apply Search Filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      workingTanks = workingTanks.filter(tank => 
        tank.name?.toLowerCase().includes(query) ||
        tank.location?.toLowerCase().includes(query) ||
        tank.group_name?.toLowerCase().includes(query) ||
        tank.customer_name?.toLowerCase().includes(query)
      );
    }

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

    // Apply Date Range Filter
    if (dateRange.from || dateRange.to) {
      workingTanks = workingTanks.filter(tank => {
        if (!tank.last_dip?.created_at) return false;
        
        const tankDate = new Date(tank.last_dip.created_at);
        const fromDate = dateRange.from ? new Date(dateRange.from) : null;
        const toDate = dateRange.to ? new Date(dateRange.to) : null;
        
        if (fromDate && tankDate < fromDate) return false;
        if (toDate && tankDate > toDate) return false;
        
        return true;
      });
    }

    // Apply Alert Status Filter
    if (alertStatusFilter !== 'all') {
      workingTanks = workingTanks.filter(tank => {
        const percent = tank.current_level_percent ?? 0;
        const daysToMin = tank.days_to_min_level ?? Infinity;
        
        switch (alertStatusFilter) {
          case 'has_alerts':
            return percent <= 20 || daysToMin <= 7;
          case 'no_alerts':
            return percent > 20 && daysToMin > 7;
          case 'critical_alerts':
            return percent <= 10 || daysToMin <= 3;
          case 'low_fuel_alerts':
            return percent <= 20;
          case 'delivery_alerts':
            return daysToMin <= 7;
          default:
            return true;
        }
      });
    }

    return workingTanks;
  }, [tanks, selectedGroup, statusFilter, searchQuery, dateRange, alertStatusFilter]);

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
    <div className="relative h-[calc(100vh-theme(spacing.16))] w-full print:h-auto print:max-w-full">
      <div className="h-full flex flex-col print:h-auto">
        {/* Enhanced Info banner with filters */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-3 md:p-4 mb-4 print:hidden">
          {/* Mobile-first responsive layout */}
          <div className="space-y-3 md:space-y-0 md:flex md:items-center md:justify-between">
            {/* Tank count and filters */}
            <div className="space-y-3 md:space-y-0 md:flex md:items-center md:gap-4">
              <div className="text-sm text-blue-700 font-medium">
                <strong>Map View:</strong> {filteredTanks?.length || 0} tanks displayed
                {tanks && tanks.length > 0 && (
                  <span className="text-blue-600"> of {tanks.length} total</span>
                )}
                {lastRefresh && (
                  <div className="text-xs text-blue-600 mt-1">
                    <Clock className="h-3 w-3 inline mr-1" />
                    Last updated: {lastRefresh.toLocaleTimeString()}
                  </div>
                )}
              </div>
              
              {/* Search bar */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search tanks by name, location, or group..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10 h-9 text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              {/* Filter controls - responsive grid */}
              <div className="grid grid-cols-1 sm:grid-cols-5 lg:grid-cols-7 md:flex gap-2">
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger className="w-full md:w-[140px] h-9 md:h-8 text-sm md:text-xs">
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
                  <SelectTrigger className="w-full md:w-[120px] h-9 md:h-8 text-sm md:text-xs">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={mapStyle} onValueChange={handleMapStyleChange}>
                  <SelectTrigger className="w-full md:w-[100px] h-9 md:h-8 text-sm md:text-xs">
                    <SelectValue placeholder="Map Style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="satellite">Satellite</SelectItem>
                    <SelectItem value="terrain">Terrain</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button
                  variant={enableClustering ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEnableClustering(!enableClustering)}
                  className="h-9 md:h-8 text-sm md:text-xs whitespace-nowrap"
                >
                  {enableClustering ? "Clustered" : "Individual"}
                </Button>
                
                <Button
                  variant={showHeatMap ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowHeatMap(!showHeatMap)}
                  className="h-9 md:h-8 text-sm md:text-xs whitespace-nowrap"
                >
                  <Layers className="h-3 w-3 mr-1" />
                  {showHeatMap ? "Heat Map" : "Heat Map"}
                </Button>
                
                <Button
                  variant={autoRefresh ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className="h-9 md:h-8 text-sm md:text-xs whitespace-nowrap"
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${autoRefresh ? 'animate-spin' : ''}`} />
                  Auto
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualRefresh}
                  className="h-9 md:h-8 text-sm md:text-xs whitespace-nowrap"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Refresh
                </Button>
                
                <Button
                  variant={showAdvancedFilters ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="h-9 md:h-8 text-sm md:text-xs whitespace-nowrap"
                >
                  <Filter className="h-3 w-3 mr-1" />
                  Advanced
                </Button>
              </div>
            </div>
            
            {/* Advanced Filters Panel */}
            {showAdvancedFilters && (
              <div className="bg-gray-50 border-l-4 border-gray-400 p-3">
                <div className="text-sm font-medium text-gray-700 mb-3">
                  <Filter className="h-4 w-4 inline mr-1" />
                  Advanced Filters
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Date Range Filter */}
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Last Reading Date Range</label>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={dateRange.from}
                        onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                        className="h-8 text-xs"
                        placeholder="From"
                      />
                      <Input
                        type="date"
                        value={dateRange.to}
                        onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                        className="h-8 text-xs"
                        placeholder="To"
                      />
                    </div>
                  </div>
                  
                  {/* Alert Status Filter */}
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Alert Status</label>
                    <Select value={alertStatusFilter} onValueChange={setAlertStatusFilter}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="All Alerts" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tanks</SelectItem>
                        <SelectItem value="has_alerts">Has Alerts</SelectItem>
                        <SelectItem value="no_alerts">No Alerts</SelectItem>
                        <SelectItem value="critical_alerts">Critical Alerts</SelectItem>
                        <SelectItem value="low_fuel_alerts">Low Fuel Alerts</SelectItem>
                        <SelectItem value="delivery_alerts">Delivery Alerts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Clear Filters */}
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDateRange({ from: '', to: '' });
                        setAlertStatusFilter('all');
                        setSelectedGroup('all');
                        setStatusFilter('all');
                        setSearchQuery('');
                      }}
                      className="h-8 text-xs"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Clear All
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Legend and controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 md:gap-4">
              <div className="flex flex-wrap items-center gap-3 md:gap-4 text-xs text-blue-600">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-fuel-critical"></div>
                  <span className="hidden sm:inline">Critical (≤20%)</span>
                  <span className="sm:hidden">Critical</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-fuel-low"></div>
                  <span className="hidden sm:inline">Low (21-40%)</span>
                  <span className="sm:hidden">Low</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-fuel-normal"></div>
                  <span className="hidden sm:inline">Normal (&gt;40%)</span>
                  <span className="sm:hidden">Normal</span>
                </div>
                {userLocation && (
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-primary"></div>
                    <span className="hidden sm:inline">My Location</span>
                    <span className="sm:hidden">Me</span>
                  </div>
                )}
              </div>
              
              {/* Control buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFindMyLocation}
                  className="h-8 text-xs"
                >
                  <Navigation className="h-3 w-3 mr-1" />
                  Find Me
                </Button>
                
                <Button
                  variant={measurementMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMeasurementMode(!measurementMode)}
                  className="h-8 text-xs"
                >
                  <Ruler className="h-3 w-3 mr-1" />
                  Measure
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrintMap}
                  className="h-8 text-xs"
                >
                  <Printer className="h-3 w-3 mr-1" />
                  Print
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPDF}
                  className="h-8 text-xs"
                >
                  <FileText className="h-3 w-3 mr-1" />
                  PDF
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportTanks}
                  disabled={!filteredTanks?.length}
                  className="h-8 text-xs"
                >
                  <Download className="h-3 w-3 mr-1" />
                  CSV
                </Button>
                
                <Button
                  variant={showRouteMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setShowRouteMode(!showRouteMode);
                    if (showRouteMode) {
                      clearRoute();
                    }
                  }}
                  className="h-8 text-xs"
                >
                  <Route className="h-3 w-3 mr-1" />
                  Route
                </Button>
              </div>
            </div>
            
            {/* Location error message */}
            {locationError && (
              <div className="bg-red-50 border-l-4 border-red-400 p-2 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                {locationError}
              </div>
            )}
            
            {/* Measurement results */}
            {measurementMode && measurements.length > 0 && (
              <div className="bg-green-50 border-l-4 border-green-400 p-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-green-700 font-medium">
                    <Ruler className="h-4 w-4 inline mr-1" />
                    Measurements:
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearMeasurements}
                    className="h-6 text-xs"
                  >
                    Clear
                  </Button>
                </div>
                <div className="mt-1 text-xs text-green-600">
                  {measurements.map((measurement, index) => (
                    <div key={index}>{measurement}</div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Route optimization panel */}
            {showRouteMode && (
              <div className="bg-purple-50 border-l-4 border-purple-400 p-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-purple-700 font-medium">
                    <Route className="h-4 w-4 inline mr-1" />
                    Route Planning: {selectedTanks.length} tanks selected
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateOptimizedRoute}
                      disabled={selectedTanks.length < 2}
                      className="h-6 text-xs"
                    >
                      Optimize
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearRoute}
                      className="h-6 text-xs"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="mt-1 text-xs text-purple-600">
                  Click on tank markers to select them for route planning. 
                  {userLocation && ' Your current location will be used as the starting point.'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Map container */}
        <div className="flex-1 touch-manipulation print:h-[600px]">
          <MapContainer 
            center={defaultCenter} 
            zoom={7} 
            style={{ 
              height: '100%', 
              width: '100%',
              touchAction: 'manipulation' // Better touch performance
            }}
            className="rounded-lg md:rounded-none shadow-sm print:rounded-none print:shadow-none"
          >
            {/* Map reference component */}
            <MapRef mapRef={mapRef} />
            
            {/* Measurement tools */}
            <MeasurementTools 
              enabled={measurementMode}
              onMeasurement={handleMeasurement}
              drawControlRef={drawControlRef}
              drawnItemsRef={drawnItemsRef}
            />
            
            <TileLayer
              key={mapStyle}
              url={mapStyles[mapStyle].url}
              attribution={mapStyles[mapStyle].attribution}
            />
            
            {/* Heat map layer */}
            <HeatMapLayer tanks={filteredTanks || []} enabled={showHeatMap} />
            
            {/* User location marker */}
            {userLocation && (
              <Marker position={userLocation} icon={TANK_ICONS.user}>
                <Popup>
                  <div className="text-center p-1">
                    <div className="font-semibold text-sm">Your Location</div>
                    <div className="text-xs text-gray-600">
                      {userLocation[0].toFixed(6)}, {userLocation[1].toFixed(6)}
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}
            
            {/* Tank markers with optional clustering - hidden when heat map is active */}
            {!showHeatMap && (
              enableClustering ? (
                <MarkerClusterGroup
                  chunkedLoading
                  spiderfyOnMaxZoom={true}
                  showCoverageOnHover={false}
                  zoomToBoundsOnClick={true}
                  maxClusterRadius={50}
                >
                  {filteredTanks?.map((tank) => (
                    <Marker
                      key={tank.id}
                      position={[Number(tank.latitude), Number(tank.longitude)]}
                      icon={getIconForTank(tank)}
                    >
                      <Popup>
                        <TankPopup 
                          tank={tank} 
                          onViewDetails={() => openModal(tank)} 
                          showRouteMode={showRouteMode}
                          isSelected={selectedTanks.includes(tank.id)}
                          onToggleSelection={() => handleTankSelection(tank.id)}
                        />
                      </Popup>
                    </Marker>
                  ))}
                </MarkerClusterGroup>
              ) : (
                filteredTanks?.map((tank) => (
                  <Marker
                    key={tank.id}
                    position={[Number(tank.latitude), Number(tank.longitude)]}
                    icon={getIconForTank(tank)}
                  >
                    <Popup>
                      <TankPopup 
                        tank={tank} 
                        onViewDetails={() => openModal(tank)} 
                        showRouteMode={showRouteMode}
                        isSelected={selectedTanks.includes(tank.id)}
                        onToggleSelection={() => handleTankSelection(tank.id)}
                      />
                    </Popup>
                  </Marker>
                ))
              )
            )}
            
            {/* Default marker when no tank coordinates are available */}
            {(!filteredTanks || filteredTanks.length === 0) && (
              <Marker 
                position={defaultCenter} 
                icon={TANK_ICONS.default}
              />
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
} 