import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { useTanks } from '@/hooks/useTanks';
import { useTankModal } from '@/contexts/TankModalContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const { openModal } = useTankModal();
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

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
      <div className="absolute top-2 left-2 z-[1000] bg-white p-2 rounded shadow-lg flex gap-2">
        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by group..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Groups</SelectItem>
            {uniqueGroups.map(group => (
              <SelectItem key={group} value={group}>{group}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter by status..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="critical">Critical (&le;20%)</SelectItem>
            <SelectItem value="low">Low (21-40%)</SelectItem>
            <SelectItem value="normal">Normal (&gt;40%)</SelectItem>
          </SelectContent>
        </Select>
      </div>
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
                <strong>Map View:</strong> {filteredTanks?.length || 0} tanks with coordinates displayed.
                {tanks && tanks.length > 0 && (
                  <span> Total tanks: {tanks.length}.</span>
                )}
                {(selectedGroup !== 'all' || statusFilter !== 'all') && (
                  <span> Active filters: {selectedGroup !== 'all' ? selectedGroup : ''}{selectedGroup !== 'all' && statusFilter !== 'all' ? ', ' : ''}{statusFilter !== 'all' ? statusFilter : ''}.</span>
                )}
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
            {/* Tank markers with coordinate data */}
            {filteredTanks?.map((tank) => (
              <Marker
                key={tank.id}
                position={[Number(tank.latitude), Number(tank.longitude)]}
                eventHandlers={{
                  click: () => {
                    openModal(tank);
                  },
                }}
              />
            ))}
            {/* Default marker when no tank coordinates are available */}
            {(!filteredTanks || filteredTanks.length === 0) && (
              <Marker position={defaultCenter} />
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
} 