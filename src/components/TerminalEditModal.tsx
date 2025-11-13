import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { useCreateTerminal, useUpdateTerminal } from '@/hooks/useTerminals';
import { getTerminalTypes, getCarriers, type Terminal, type TerminalInput } from '@/api/terminals';

interface TerminalEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  terminal?: Terminal | null;
  mode: 'create' | 'edit';
}

export default function TerminalEditModal({
  open,
  onOpenChange,
  terminal,
  mode
}: TerminalEditModalProps) {
  const [formData, setFormData] = useState<TerminalInput>({
    terminal_name: '',
    terminal_code: '',
    latitude: 0,
    longitude: 0,
    carrier_primary: 'SMB',
    terminal_type: 'Primary Fuel Terminal',
    active: true,
    service_radius_km: 50,
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useCreateTerminal();
  const updateMutation = useUpdateTerminal();

  // Load terminal data when editing
  useEffect(() => {
    if (mode === 'edit' && terminal) {
      setFormData({
        terminal_name: terminal.terminal_name,
        terminal_code: terminal.terminal_code || '',
        latitude: terminal.latitude,
        longitude: terminal.longitude,
        carrier_primary: terminal.carrier_primary || 'SMB',
        terminal_type: terminal.terminal_type,
        active: terminal.active,
        service_radius_km: terminal.service_radius_km,
        notes: terminal.notes || ''
      });
    } else if (mode === 'create') {
      // Reset form for create mode
      setFormData({
        terminal_name: '',
        terminal_code: '',
        latitude: 0,
        longitude: 0,
        carrier_primary: 'SMB',
        terminal_type: 'Primary Fuel Terminal',
        active: true,
        service_radius_km: 50,
        notes: ''
      });
    }
    setErrors({});
  }, [mode, terminal, open]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.terminal_name.trim()) {
      newErrors.terminal_name = 'Terminal name is required';
    }

    if (formData.latitude < -90 || formData.latitude > 90) {
      newErrors.latitude = 'Latitude must be between -90 and 90';
    }

    if (formData.longitude < -180 || formData.longitude > 180) {
      newErrors.longitude = 'Longitude must be between -180 and 180';
    }

    if (formData.service_radius_km < 1 || formData.service_radius_km > 500) {
      newErrors.service_radius_km = 'Service radius must be between 1 and 500 km';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      if (mode === 'create') {
        await createMutation.mutateAsync(formData);
      } else if (terminal) {
        await updateMutation.mutateAsync({
          id: terminal.id,
          updates: formData
        });
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Error saving terminal:', error);
    }
  };

  const handleChange = (field: keyof TerminalInput, value: unknown) => {
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

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add New Terminal' : 'Edit Terminal'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Add a new terminal location with GPS coordinates and service area.'
              : 'Update terminal information and service area settings.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Terminal Name */}
          <div className="space-y-2">
            <Label htmlFor="terminal_name">
              Terminal Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="terminal_name"
              value={formData.terminal_name}
              onChange={(e) => handleChange('terminal_name', e.target.value)}
              placeholder="e.g., Kewdale, Geraldton"
              disabled={isLoading}
            />
            {errors.terminal_name && (
              <p className="text-sm text-red-500">{errors.terminal_name}</p>
            )}
          </div>

          {/* Terminal Code */}
          <div className="space-y-2">
            <Label htmlFor="terminal_code">Terminal Code (Optional)</Label>
            <Input
              id="terminal_code"
              value={formData.terminal_code || ''}
              onChange={(e) => handleChange('terminal_code', e.target.value || null)}
              placeholder="e.g., KWD, GER"
              disabled={isLoading}
            />
          </div>

          {/* GPS Coordinates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="latitude">
                Latitude <span className="text-red-500">*</span>
              </Label>
              <Input
                id="latitude"
                type="number"
                step="0.000001"
                value={formData.latitude}
                onChange={(e) => handleChange('latitude', parseFloat(e.target.value))}
                placeholder="-31.981076"
                disabled={isLoading}
              />
              {errors.latitude && (
                <p className="text-sm text-red-500">{errors.latitude}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="longitude">
                Longitude <span className="text-red-500">*</span>
              </Label>
              <Input
                id="longitude"
                type="number"
                step="0.000001"
                value={formData.longitude}
                onChange={(e) => handleChange('longitude', parseFloat(e.target.value))}
                placeholder="115.972324"
                disabled={isLoading}
              />
              {errors.longitude && (
                <p className="text-sm text-red-500">{errors.longitude}</p>
              )}
            </div>
          </div>

          {/* Carrier & Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="carrier_primary">Primary Carrier</Label>
              <Select
                value={formData.carrier_primary || undefined}
                onValueChange={(value) => handleChange('carrier_primary', value)}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select carrier" />
                </SelectTrigger>
                <SelectContent>
                  {getCarriers().map((carrier) => (
                    <SelectItem key={carrier} value={carrier}>
                      {carrier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="terminal_type">Terminal Type</Label>
              <Select
                value={formData.terminal_type}
                onValueChange={(value) => handleChange('terminal_type', value)}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {getTerminalTypes().map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Service Radius */}
          <div className="space-y-2">
            <Label htmlFor="service_radius_km">
              Service Radius (km) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="service_radius_km"
              type="number"
              value={formData.service_radius_km}
              onChange={(e) => handleChange('service_radius_km', parseInt(e.target.value))}
              placeholder="50"
              min="1"
              max="500"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Trips within this radius will be matched to this terminal
            </p>
            {errors.service_radius_km && (
              <p className="text-sm text-red-500">{errors.service_radius_km}</p>
            )}
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              <Label htmlFor="active">Active Terminal</Label>
              <p className="text-xs text-muted-foreground">
                Inactive terminals will not be used for trip matching
              </p>
            </div>
            <Switch
              id="active"
              checked={formData.active}
              onCheckedChange={(checked) => handleChange('active', checked)}
              disabled={isLoading}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value || null)}
              placeholder="Additional information about this terminal..."
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
              {isLoading ? 'Saving...' : mode === 'create' ? 'Create Terminal' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
