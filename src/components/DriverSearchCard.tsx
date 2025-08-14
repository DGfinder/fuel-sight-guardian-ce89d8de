/**
 * Driver Search Card Component
 * Provides driver search functionality with clickable cards that open the DriverProfileModal
 * Integrates with existing driver management system
 */

import React, { useState, useMemo } from 'react';
import { Search, User, MapPin, AlertTriangle, Shield, TrendingUp, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDriverSearch, useDriversRequiringAttention } from '@/hooks/useDriverProfile';
import DriverProfileModal from './DriverProfileModal';

interface DriverSearchCardProps {
  fleet?: 'Stevemacs' | 'Great Southern Fuels';
  showRequiringAttention?: boolean;
  title?: string;
  className?: string;
}

interface DriverCardProps {
  driver: {
    id: string;
    full_name: string;
    employee_id?: string;
    fleet: string;
    depot?: string;
    overall_safety_score?: number;
    guardian_risk_level?: 'Low' | 'Medium' | 'High' | 'Critical';
    high_risk_events_30d?: number;
    last_activity_date?: string;
    total_trips_30d?: number;
  };
  onClick: (driverId: string, driverName: string) => void;
  showMetrics?: boolean;
}

const DriverCard: React.FC<DriverCardProps> = ({ driver, onClick, showMetrics = false }) => (
  <div
    onClick={() => onClick(driver.id, driver.full_name)}
    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 cursor-pointer transition-all duration-200 hover:shadow-md"
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <User className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <h4 className="font-medium text-gray-900">{driver.full_name}</h4>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {driver.employee_id && (
              <span>ID: {driver.employee_id}</span>
            )}
            <span>•</span>
            <span>{driver.fleet}</span>
            {driver.depot && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>{driver.depot}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {showMetrics && (
          <>
            {/* Safety Score */}
            {driver.overall_safety_score !== undefined && (
              <div className="text-center">
                <p className={`text-sm font-bold ${
                  driver.overall_safety_score >= 80 ? 'text-green-600' :
                  driver.overall_safety_score >= 60 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {driver.overall_safety_score}
                </p>
                <p className="text-xs text-gray-500">Safety</p>
              </div>
            )}
            
            {/* Risk Level Badge */}
            {driver.guardian_risk_level && (
              <Badge 
                variant={
                  driver.guardian_risk_level === 'Critical' ? 'destructive' :
                  driver.guardian_risk_level === 'High' ? 'destructive' :
                  driver.guardian_risk_level === 'Medium' ? 'default' : 'secondary'
                }
                className="text-xs"
              >
                {driver.guardian_risk_level}
              </Badge>
            )}
            
            {/* High Risk Events */}
            {driver.high_risk_events_30d !== undefined && driver.high_risk_events_30d > 0 && (
              <div className="flex items-center gap-1 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">{driver.high_risk_events_30d}</span>
              </div>
            )}
          </>
        )}
        
        {/* Activity Indicator */}
        {driver.last_activity_date && (
          <div className="flex items-center gap-1 text-gray-500">
            <Clock className="h-3 w-3" />
            <span className="text-xs">
              {new Date(driver.last_activity_date).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
    </div>
    
    {/* Trip Count */}
    {showMetrics && driver.total_trips_30d !== undefined && (
      <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          <span>{driver.total_trips_30d} trips (30d)</span>
        </div>
      </div>
    )}
  </div>
);

export const DriverSearchCard: React.FC<DriverSearchCardProps> = ({
  fleet,
  showRequiringAttention = false,
  title = "Driver Search",
  className = ""
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedDriverName, setSelectedDriverName] = useState<string>('');

  // Search drivers
  const { 
    data: searchResults = [], 
    isLoading: isSearching 
  } = useDriverSearch(searchTerm, fleet, {
    enabled: searchTerm.length >= 2
  });

  // Drivers requiring attention
  const { 
    data: driversRequiringAttention = [], 
    isLoading: isLoadingAttention 
  } = useDriversRequiringAttention(fleet, {
    enabled: showRequiringAttention
  });

  // Combine and deduplicate results
  const displayedDrivers = useMemo(() => {
    const searchDrivers = searchResults.map(driver => ({
      ...driver,
      source: 'search' as const
    }));
    
    const attentionDrivers = showRequiringAttention 
      ? driversRequiringAttention.map(driver => ({
          ...driver,
          source: 'attention' as const
        }))
      : [];

    // If searching, prioritize search results
    if (searchTerm.length >= 2) {
      return searchDrivers;
    }

    // Otherwise show drivers requiring attention
    return attentionDrivers.slice(0, 10); // Limit to 10 for performance
  }, [searchResults, driversRequiringAttention, searchTerm, showRequiringAttention]);

  const handleDriverClick = (driverId: string, driverName: string) => {
    setSelectedDriverId(driverId);
    setSelectedDriverName(driverName);
  };

  const handleCloseModal = () => {
    setSelectedDriverId(null);
    setSelectedDriverName('');
  };

  const isLoading = isSearching || (showRequiringAttention && isLoadingAttention);

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            {title}
            {fleet && (
              <Badge variant="outline" className="ml-2">
                {fleet}
              </Badge>
            )}
          </CardTitle>
          
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search drivers by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading drivers...</span>
            </div>
          )}
          
          {/* Empty State */}
          {!isLoading && displayedDrivers.length === 0 && (
            <div className="text-center py-8">
              {searchTerm.length >= 2 ? (
                <>
                  <User className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">No drivers found matching "{searchTerm}"</p>
                  <p className="text-sm text-gray-500 mt-1">Try adjusting your search terms</p>
                </>
              ) : showRequiringAttention ? (
                <>
                  <Shield className="h-12 w-12 text-green-400 mx-auto mb-2" />
                  <p className="text-gray-600">No drivers require immediate attention</p>
                  <p className="text-sm text-gray-500 mt-1">All drivers are performing well</p>
                </>
              ) : (
                <>
                  <Search className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">Search for drivers to view their profiles</p>
                  <p className="text-sm text-gray-500 mt-1">Enter at least 2 characters to search</p>
                </>
              )}
            </div>
          )}
          
          {/* Driver List */}
          {!isLoading && displayedDrivers.length > 0 && (
            <div className="space-y-3">
              {/* Search Results Header */}
              {searchTerm.length >= 2 && (
                <div className="flex items-center justify-between text-sm text-gray-600 border-b pb-2">
                  <span>Search Results ({displayedDrivers.length})</span>
                  <span>Click to view profile</span>
                </div>
              )}
              
              {/* Attention Required Header */}
              {!searchTerm && showRequiringAttention && displayedDrivers.length > 0 && (
                <div className="flex items-center justify-between text-sm text-gray-600 border-b pb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <span>Requiring Attention ({displayedDrivers.length})</span>
                  </div>
                  <span>Click to view profile</span>
                </div>
              )}
              
              {/* Driver Cards */}
              {displayedDrivers.map((driver) => (
                <DriverCard
                  key={driver.id}
                  driver={driver}
                  onClick={handleDriverClick}
                  showMetrics={showRequiringAttention || searchTerm.length >= 2}
                />
              ))}
              
              {/* Show More for Search Results */}
              {searchTerm.length >= 2 && displayedDrivers.length >= 10 && (
                <div className="text-center pt-2">
                  <p className="text-sm text-gray-500">
                    Showing first 10 results. Refine search for more specific results.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Driver Profile Modal */}
      {selectedDriverId && selectedDriverName && (
        <DriverProfileModal
          driverId={selectedDriverId}
          driverName={selectedDriverName}
          isOpen={!!selectedDriverId}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
};

export default DriverSearchCard;