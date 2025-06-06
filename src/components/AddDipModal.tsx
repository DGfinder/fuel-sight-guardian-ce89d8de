
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Droplets, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTanks } from "@/hooks/useTanks";
import { useUserRole } from "@/hooks/useUserRole";

interface AddDipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedTank?: string;
}

export function AddDipModal({ open, onOpenChange, preSelectedTank }: AddDipModalProps) {
  const [formData, setFormData] = useState({
    tankId: preSelectedTank || '',
    dipReading: '',
    notes: '',
    timestamp: new Date().toISOString().slice(0, 16)
  });

  const { data: userRole, isLoading: roleLoading } = useUserRole();
  const { data: tanks, isLoading: tanksLoading, error: tanksError } = useTanks(userRole?.depot_id || undefined);
  
  const [selectedTank, setSelectedTank] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update selected tank when tank ID changes
  useEffect(() => {
    if (formData.tankId && tanks) {
      const tank = tanks.find(t => t.id === formData.tankId);
      setSelectedTank(tank);
    } else {
      setSelectedTank(null);
    }
  }, [formData.tankId, tanks]);

  // Set preselected tank when modal opens
  useEffect(() => {
    if (preSelectedTank && open) {
      setFormData(prev => ({ ...prev, tankId: preSelectedTank }));
    }
  }, [preSelectedTank, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.tankId || !formData.dipReading) {
      toast({
        title: "Missing Information",
        description: "Please select a tank and enter a dip reading.",
        variant: "destructive"
      });
      return;
    }

    const reading = parseFloat(formData.dipReading);
    if (isNaN(reading) || reading < 0) {
      toast({
        title: "Invalid Reading",
        description: "Please enter a valid fuel level reading.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      // Prepare data for swan_dips table (only the allowed fields)
      const dipData = {
        tank_id: formData.tankId,
        dip_litres: reading,
        created_at: formData.timestamp,
        notes: formData.notes || null,
        user_id: user.id
      };

      console.log('Inserting dip data:', dipData);

      const { error: insertError } = await supabase
        .from('swan_dips')
        .insert([dipData]);

      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }

      // Build success message with tank details
      const tankDisplay = selectedTank 
        ? `${selectedTank.depot_name || 'Unknown'} – ${selectedTank.location}`
        : 'Selected tank';

      toast({
        title: "Dip Reading Added",
        description: `${reading.toLocaleString()}L recorded for ${tankDisplay}`,
      });

      // Reset form and close modal
      setFormData({
        tankId: '',
        dipReading: '',
        notes: '',
        timestamp: new Date().toISOString().slice(0, 16)
      });
      onOpenChange(false);

    } catch (error: any) {
      console.error('Error submitting dip:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to record dip reading. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTankChange = (tankId: string) => {
    setFormData(prev => ({ ...prev, tankId }));
  };

  if (roleLoading || tanksLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <Droplets className="w-8 h-8 text-primary mx-auto mb-2 animate-pulse" />
              <p className="text-sm text-gray-500">Loading tanks...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (tanksError) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
              <p className="text-sm text-gray-500">Error loading tanks. Please try again.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-primary" />
            Add Dip Reading
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tank">Tank *</Label>
            <Select value={formData.tankId} onValueChange={handleTankChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select tank" />
              </SelectTrigger>
              <SelectContent>
                {tanks?.map((tank) => (
                  <SelectItem key={tank.id} value={tank.id}>
                    {tank.depot_name || 'Unknown Depot'} – {tank.location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTank && (
            <div className="space-y-2">
              <Label>Product Type</Label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700">
                {selectedTank.product_type || 'Unknown Product'}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="dipReading">Dip Reading (Litres) *</Label>
            <Input
              id="dipReading"
              type="number"
              placeholder="Enter fuel level in litres"
              value={formData.dipReading}
              onChange={(e) => setFormData({...formData, dipReading: e.target.value})}
              min="0"
              step="1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timestamp">Date & Time</Label>
            <Input
              id="timestamp"
              type="datetime-local"
              value={formData.timestamp}
              onChange={(e) => setFormData({...formData, timestamp: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes or observations..."
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              type="submit" 
              className="flex-1 bg-primary hover:bg-primary/90"
              disabled={isSubmitting}
            >
              <Plus className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Adding...' : 'Add Reading'}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
