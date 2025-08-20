/**
 * Driver Search Card Component
 * Reusable card for driver search functionality
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, User, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDriverSearch } from '@/hooks/useDriverProfile';

interface DriverSearchCardProps {
  fleet?: string;
  showRequiringAttention?: boolean;
  title: string;
  className?: string;
}

export const DriverSearchCard: React.FC<DriverSearchCardProps> = ({
  fleet,
  showRequiringAttention = false,
  title,
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  
  const {
    data: searchResults,
    isLoading: isSearching
  } = useDriverSearch(searchTerm, fleet, {
    enabled: searchTerm.length >= 2
  });

  const handleDriverClick = (driverId: string) => {
    // TODO: Open driver profile modal or navigate to driver detail page
    console.log('Opening driver profile:', driverId);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5 text-blue-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search drivers by name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {searchTerm.length < 2 ? (
          <div className="text-center py-8">
            <Search className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">Search for drivers to view their profiles</p>
            <p className="text-sm text-gray-500">Enter at least 2 characters to search</p>
          </div>
        ) : isSearching ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Searching...</p>
          </div>
        ) : searchResults && searchResults.length > 0 ? (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {searchResults.map((driver) => (
              <div
                key={driver.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => handleDriverClick(driver.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{driver.full_name}</p>
                    <p className="text-sm text-gray-600">
                      {driver.employee_id} • {driver.fleet} • {driver.depot}
                    </p>
                  </div>
                </div>
                <Eye className="h-4 w-4 text-gray-400" />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Search className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No drivers found</p>
            <p className="text-sm text-gray-500">Try a different search term</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DriverSearchCard;