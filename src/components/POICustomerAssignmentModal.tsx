import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { MapPin, User, Building2, TrendingUp, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface CustomerMatch {
  customer_id: string;
  customer_name: string;
  customer_bp_id: string | null;
  match_method: string;
  confidence_score: number;
  distance_km: number;
  name_similarity: number;
  recommendation: string;
}

interface POI {
  id: string;
  actual_name: string;
  poi_type: string;
  confidence_score: number;
  trip_count: number;
  centroid_latitude: number;
  centroid_longitude: number;
  matched_customer_id?: string;
}

interface POICustomerAssignmentModalProps {
  poi: POI | null;
  isOpen: boolean;
  onClose: () => void;
  onAssign: (poiId: string, customerId: string, method: 'manual') => Promise<void>;
  onAutoAssign: (poiId: string) => Promise<void>;
  customerMatches: CustomerMatch[];
  isLoadingMatches: boolean;
}

export function POICustomerAssignmentModal({
  poi,
  isOpen,
  onClose,
  onAssign,
  onAutoAssign,
  customerMatches,
  isLoadingMatches
}: POICustomerAssignmentModalProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSelectedCustomerId(null);
      setSearchTerm('');
    }
  }, [isOpen]);

  if (!poi) return null;

  const filteredMatches = customerMatches.filter(match =>
    match.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    match.customer_bp_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleManualAssign = async () => {
    if (!selectedCustomerId) return;

    setIsAssigning(true);
    try {
      await onAssign(poi.id, selectedCustomerId, 'manual');
      onClose();
    } catch (error) {
      console.error('Error assigning customer:', error);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleAutoAssign = async () => {
    setIsAssigning(true);
    try {
      await onAutoAssign(poi.id);
      onClose();
    } catch (error) {
      console.error('Error auto-assigning customer:', error);
    } finally {
      setIsAssigning(false);
    }
  };

  const getConfidenceBadgeColor = (score: number) => {
    if (score >= 90) return 'bg-green-500 hover:bg-green-600';
    if (score >= 75) return 'bg-blue-500 hover:bg-blue-600';
    if (score >= 60) return 'bg-yellow-500 hover:bg-yellow-600';
    return 'bg-gray-500 hover:bg-gray-600';
  };

  const getRecommendationIcon = (recommendation: string) => {
    if (recommendation.includes('High Confidence')) {
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    }
    if (recommendation.includes('Good Match')) {
      return <TrendingUp className="h-4 w-4 text-blue-600" />;
    }
    return <AlertCircle className="h-4 w-4 text-yellow-600" />;
  };

  const topMatch = customerMatches[0];
  const hasHighConfidenceMatch = topMatch && topMatch.confidence_score >= 75;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Assign Customer to POI
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* POI Information */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-500">POI Name</Label>
                  <p className="font-medium">{poi.actual_name}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">POI Type</Label>
                  <p className="font-medium capitalize">{poi.poi_type}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Trip Count</Label>
                  <p className="font-medium">{poi.trip_count} trips</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">POI Confidence</Label>
                  <Badge className={getConfidenceBadgeColor(poi.confidence_score)}>
                    {poi.confidence_score}%
                  </Badge>
                </div>
                <div className="col-span-2">
                  <Label className="text-sm text-gray-500">GPS Location</Label>
                  <p className="flex items-center gap-1 text-sm">
                    <MapPin className="h-3 w-3" />
                    {poi.centroid_latitude.toFixed(6)}, {poi.centroid_longitude.toFixed(6)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Auto-Assign Recommendation */}
          {hasHighConfidenceMatch && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="flex items-center justify-between">
                <div>
                  <strong>High confidence match found:</strong> {topMatch.customer_name}
                  <span className="ml-2 text-sm text-gray-600">
                    ({topMatch.confidence_score}% confidence, {topMatch.distance_km.toFixed(2)}km away)
                  </span>
                </div>
                <Button
                  onClick={handleAutoAssign}
                  disabled={isAssigning}
                  size="sm"
                  className="ml-4"
                >
                  {isAssigning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Auto-Assign'
                  )}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <Separator />

          {/* Search */}
          <div>
            <Label htmlFor="customer-search">Search Customers</Label>
            <Input
              id="customer-search"
              placeholder="Search by name or BP ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mt-2"
            />
          </div>

          {/* Customer Matches */}
          <div>
            <Label className="mb-3 block">Customer Match Suggestions</Label>

            {isLoadingMatches ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Finding customer matches...</span>
              </div>
            ) : filteredMatches.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No customer matches found. Try adjusting the search or add a new customer to the system.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredMatches.map((match) => (
                  <Card
                    key={match.customer_id}
                    className={`cursor-pointer transition-all ${
                      selectedCustomerId === match.customer_id
                        ? 'ring-2 ring-blue-500 bg-blue-50'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedCustomerId(match.customer_id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="font-medium">{match.customer_name}</span>
                            {match.customer_bp_id && (
                              <Badge variant="outline" className="text-xs">
                                BP: {match.customer_bp_id}
                              </Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Distance:</span>
                              <span className="ml-1 font-medium">
                                {match.distance_km.toFixed(2)} km
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Name Match:</span>
                              <span className="ml-1 font-medium">{match.name_similarity}%</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Method:</span>
                              <span className="ml-1 font-medium capitalize">
                                {match.match_method.replace('auto_', '').replace('_', ' ')}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mt-2">
                            {getRecommendationIcon(match.recommendation)}
                            <span className="text-xs text-gray-600">{match.recommendation}</span>
                          </div>
                        </div>

                        <div className="ml-4">
                          <Badge className={getConfidenceBadgeColor(match.confidence_score)}>
                            {match.confidence_score}%
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose} disabled={isAssigning}>
              Cancel
            </Button>
            <Button
              onClick={handleManualAssign}
              disabled={!selectedCustomerId || isAssigning}
            >
              {isAssigning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Assign Selected Customer'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
