/**
 * Test Driver Search Page
 * Simple page to test driver search functionality
 */

import React, { useState } from 'react';
import { Search, User, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useDriverSearch } from '@/hooks/useDriverProfile';

export const TestDriverSearch: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFleet, setSelectedFleet] = useState<string>('');

  const {
    data: searchResults,
    isLoading: isSearching,
    error
  } = useDriverSearch(searchTerm, selectedFleet, {
    enabled: searchTerm.length >= 2
  });

  const handleDriverClick = (driverId: string) => {
    console.log('Opening driver profile:', driverId);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Test Driver Search</h1>
        <p className="text-gray-600">Testing driver search functionality with real data</p>
      </div>

      {/* Fleet Filter */}
      <div className="flex gap-4">
        <select
          value={selectedFleet}
          onChange={(e) => setSelectedFleet(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Fleets</option>
          <option value="Stevemacs">Stevemacs</option>
          <option value="Great Southern Fuels">Great Southern Fuels</option>
        </select>
      </div>

      {/* Search Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-500" />
            Driver Search Test
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
          
          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-medium">Error:</p>
              <p className="text-red-600 text-sm">{error.message}</p>
            </div>
          )}
          
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
            <div className="space-y-3">
              <div className="text-sm text-gray-600 border-b pb-2">
                Found {searchResults.length} driver(s)
              </div>
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

      {/* Debug Info */}
      <Card>
        <CardHeader>
          <CardTitle>Debug Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>Search Term:</strong> "{searchTerm}"</p>
            <p><strong>Selected Fleet:</strong> {selectedFleet || 'All Fleets'}</p>
            <p><strong>Search Enabled:</strong> {searchTerm.length >= 2 ? 'Yes' : 'No'}</p>
            <p><strong>Is Loading:</strong> {isSearching ? 'Yes' : 'No'}</p>
            <p><strong>Results Count:</strong> {searchResults?.length || 0}</p>
            {error && (
              <p><strong>Error:</strong> {error.message}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestDriverSearch;
