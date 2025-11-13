import React, { useState, useEffect } from 'react';
import { MapPin, Navigation2, TrendingUp, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useClassifyPOI } from '@/hooks/usePoiDiscovery';
import { useTerminals } from '@/hooks/useTerminals';
import {
  type DiscoveredPOI,
  type POIType,
  type ClassifyPOIInput,
  getPOITypeLabel,
  suggestPOIType,
  formatAccuracy
} from '@/api/poiDiscovery';

interface POIClassificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poi: DiscoveredPOI | null;
}

const POI_TYPES: POIType[] = ['terminal', 'customer', 'rest_area', 'depot'];

export default function POIClassificationModal({
  open,
  onOpenChange,
  poi
}: POIClassificationModalProps) {
  const [formData, setFormData] = useState<ClassifyPOIInput>({
    poi_type: 'unknown',
    actual_name: '',
    address: '',
    service_radius_km: 50,
    notes: '',
    matched_terminal_id: null,
    matched_customer_id: null
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const classifyMutation = useClassifyPOI();
  const { data: terminals } = useTerminals(true); // Active terminals only

  // Initialize form when POI changes
  useEffect(() => {
    if (poi && open) {
      const suggestedType = suggestPOIType(poi);
      setFormData({
        poi_type: suggestedType,
        actual_name: poi.suggested_name || '',
        address: poi.address || '',
        service_radius_km: poi.service_radius_km || 50,
        notes: poi.notes || '',
        matched_terminal_id: poi.matched_terminal_id || null,
        matched_customer_id: poi.matched_customer_id || null
      });
      setErrors({});
    }
  }, [poi, open]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.actual_name.trim()) {
      newErrors.actual_name = 'Name is required';
    }

    if (formData.poi_type === 'unknown') {
      newErrors.poi_type = 'Please select a POI type';
    }

    if (formData.service_radius_km && (formData.service_radius_km < 1 || formData.service_radius_km > 500)) {
      newErrors.service_radius_km = 'Service radius must be between 1 and 500 km';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!poi || !validate()) return;

    try {
      await classifyMutation.mutateAsync({
        poiId: poi.id,
        classification: formData
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error classifying POI:', error);
    }
  };

  const handleChange = (field: keyof ClassifyPOIInput, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const isLoading = classifyMutation.isPending;

  if (!poi) return null;

  const suggestedType = suggestPOIType(poi);
  const startRatio = poi.trip_count > 0 ? (poi.start_point_count / poi.trip_count) * 100 : 0;
  const endRatio = poi.trip_count > 0 ? (poi.end_point_count / poi.trip_count) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Classify Discovered POI
          </DialogTitle>
          <DialogDescription>
            Review the discovered location and classify it as a terminal, customer site, or other location type.
          </DialogDescription>
        </DialogHeader>

        {/* POI Details Summary */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Location
                </p>
                <p className="font-medium">
                  {poi.centroid_latitude.toFixed(6)}, {poi.centroid_longitude.toFixed(6)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Trip Count
                </p>
                <p className="font-medium">{poi.trip_count} trips</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">
                  <Navigation2 className="h-3 w-3" />
                  Start/End
                </p>
                <p className="font-medium text-xs">
                  {poi.start_point_count}↑ / {poi.end_point_count}↓
                </p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Accuracy
                </p>
                <p className="font-medium text-xs">{formatAccuracy(poi.gps_accuracy_meters)}</p>
              </div>
            </div>

            {/* Trip Pattern Analysis */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Trip Start Points</span>
                <span className="font-medium">{startRatio.toFixed(0)}%</span>
              </div>
              <Progress value={startRatio} className="h-2" />

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Trip End Points</span>
                <span className="font-medium">{endRatio.toFixed(0)}%</span>
              </div>
              <Progress value={endRatio} className="h-2" />
            </div>

            {/* Suggested Type */}
            <div className="mt-3 flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-muted-foreground">
                Suggested type:
              </span>
              <Badge variant="outline">
                {getPOITypeLabel(suggestedType)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                (based on trip patterns)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Classification Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* POI Type */}
          <div className="space-y-2">
            <Label htmlFor="poi_type">
              POI Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.poi_type}
              onValueChange={(value) => handleChange('poi_type', value as POIType)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select POI type" />
              </SelectTrigger>
              <SelectContent>
                {POI_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {getPOITypeLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.poi_type && (
              <p className="text-sm text-red-500">{errors.poi_type}</p>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="actual_name">
              Location Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="actual_name"
              value={formData.actual_name}
              onChange={(e) => handleChange('actual_name', e.target.value)}
              placeholder="e.g., Kewdale Terminal, BHP Mine Site"
              disabled={isLoading}
            />
            {errors.actual_name && (
              <p className="text-sm text-red-500">{errors.actual_name}</p>
            )}
          </div>

          {/* Address (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="address">Address (Optional)</Label>
            <Input
              id="address"
              value={formData.address || ''}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="Street address or location description"
              disabled={isLoading}
            />
          </div>

          {/* Service Radius */}
          <div className="space-y-2">
            <Label htmlFor="service_radius_km">
              Service Radius (km)
            </Label>
            <Input
              id="service_radius_km"
              type="number"
              value={formData.service_radius_km || 50}
              onChange={(e) => handleChange('service_radius_km', parseInt(e.target.value))}
              placeholder="50"
              min="1"
              max="500"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Used for matching trips to this location
            </p>
            {errors.service_radius_km && (
              <p className="text-sm text-red-500">{errors.service_radius_km}</p>
            )}
          </div>

          {/* Terminal Matching (if type is terminal) */}
          {formData.poi_type === 'terminal' && terminals && terminals.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="matched_terminal_id">
                Match to Existing Terminal (Optional)
              </Label>
              <Select
                value={formData.matched_terminal_id || 'none'}
                onValueChange={(value) => handleChange('matched_terminal_id', value === 'none' ? null : value)}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select terminal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No matching terminal</SelectItem>
                  {terminals.map((terminal) => (
                    <SelectItem key={terminal.id} value={terminal.id}>
                      {terminal.terminal_name} ({terminal.terminal_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Link this POI to an existing terminal in the system
              </p>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Additional information about this location..."
              rows={3}
              disabled={isLoading}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Classifying...' : 'Classify POI'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
