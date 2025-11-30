/**
 * FuelTankDialog Component
 * Create/Edit dialog for Fuel Tanks
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fuelTankSchema, type FuelTankInput } from '@/lib/admin/schemas';
import type { FuelTank, TankGroup, ProductType, TankStatus } from '@/types/admin';

interface FuelTankDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tank: FuelTank | null;
  groups: Pick<TankGroup, 'id' | 'name'>[];
  subgroups: string[];
  onSave: (data: FuelTankInput) => void;
  isSaving: boolean;
}

const PRODUCT_TYPES: ProductType[] = ['Diesel', 'ULP', 'ULP98', 'ADF'];
const STATUSES: { value: TankStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
  { value: 'decommissioned', label: 'Decommissioned' },
];

export function FuelTankDialog({
  open,
  onOpenChange,
  tank,
  groups,
  subgroups,
  onSave,
  isSaving,
}: FuelTankDialogProps) {
  const [formData, setFormData] = useState<FuelTankInput>({
    location: '',
    group_id: '',
    subgroup: '',
    product_type: 'Diesel',
    safe_level: 0,
    min_level: 0,
    status: 'active',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customSubgroup, setCustomSubgroup] = useState('');

  // Reset form when dialog opens/closes or tank changes
  useEffect(() => {
    if (open) {
      setFormData({
        location: tank?.location || '',
        group_id: tank?.group_id || '',
        subgroup: tank?.subgroup || '',
        product_type: tank?.product_type || 'Diesel',
        safe_level: tank?.safe_level || 0,
        min_level: tank?.min_level || 0,
        status: tank?.status || 'active',
      });
      setCustomSubgroup('');
      setErrors({});
    }
  }, [open, tank]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Use custom subgroup if provided
    const dataToValidate = {
      ...formData,
      subgroup: customSubgroup || formData.subgroup || undefined,
    };

    // Validate
    const result = fuelTankSchema.safeParse(dataToValidate);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    onSave(result.data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tank ? 'Edit Fuel Tank' : 'Create Fuel Tank'}</DialogTitle>
          <DialogDescription>
            {tank ? 'Update the fuel tank details' : 'Add a new fuel tank to the system'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Location */}
            <div>
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => {
                  setFormData({ ...formData, location: e.target.value });
                  if (errors.location) setErrors({ ...errors, location: '' });
                }}
                placeholder="e.g., Main Depot - Tank 1"
                className="mt-1"
              />
              {errors.location && (
                <p className="text-sm text-red-500 mt-1">{errors.location}</p>
              )}
            </div>

            {/* Group */}
            <div>
              <Label htmlFor="group_id">Tank Group *</Label>
              <Select
                value={formData.group_id}
                onValueChange={(value) => {
                  setFormData({ ...formData, group_id: value });
                  if (errors.group_id) setErrors({ ...errors, group_id: '' });
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.group_id && (
                <p className="text-sm text-red-500 mt-1">{errors.group_id}</p>
              )}
            </div>

            {/* Subgroup */}
            <div>
              <Label htmlFor="subgroup">Subgroup</Label>
              <div className="flex gap-2 mt-1">
                <Select
                  value={formData.subgroup || ''}
                  onValueChange={(value) => {
                    setFormData({ ...formData, subgroup: value });
                    setCustomSubgroup('');
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select or type new" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {subgroups.map((sg) => (
                      <SelectItem key={sg} value={sg}>
                        {sg}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Or type new..."
                  value={customSubgroup}
                  onChange={(e) => {
                    setCustomSubgroup(e.target.value);
                    setFormData({ ...formData, subgroup: '' });
                  }}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Product Type & Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="product_type">Product Type *</Label>
                <Select
                  value={formData.product_type}
                  onValueChange={(value: ProductType) =>
                    setFormData({ ...formData, product_type: value })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map((pt) => (
                      <SelectItem key={pt} value={pt}>
                        {pt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: TankStatus) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Levels */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="safe_level">Safe Level (L) *</Label>
                <Input
                  id="safe_level"
                  type="number"
                  value={formData.safe_level || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, safe_level: parseFloat(e.target.value) || 0 });
                    if (errors.safe_level) setErrors({ ...errors, safe_level: '' });
                  }}
                  placeholder="e.g., 5000"
                  className="mt-1"
                />
                {errors.safe_level && (
                  <p className="text-sm text-red-500 mt-1">{errors.safe_level}</p>
                )}
              </div>

              <div>
                <Label htmlFor="min_level">Minimum Level (L) *</Label>
                <Input
                  id="min_level"
                  type="number"
                  value={formData.min_level || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, min_level: parseFloat(e.target.value) || 0 });
                    if (errors.min_level) setErrors({ ...errors, min_level: '' });
                  }}
                  placeholder="e.g., 1000"
                  className="mt-1"
                />
                {errors.min_level && (
                  <p className="text-sm text-red-500 mt-1">{errors.min_level}</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !formData.location.trim() || !formData.group_id}>
              {isSaving ? 'Saving...' : tank ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default FuelTankDialog;
