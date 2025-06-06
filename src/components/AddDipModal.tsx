import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Calendar, Droplets } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface AddDipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedTank?: string;
  preSelectedLocation?: string;
}

export function AddDipModal({ open, onOpenChange, preSelectedTank, preSelectedLocation }: AddDipModalProps) {
  const [formData, setFormData] = useState({
    location: preSelectedLocation || '',
    productType: '',
    dipReading: '',
    notes: '',
    timestamp: new Date().toISOString().slice(0, 16)
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.location || !formData.productType || !formData.dipReading) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
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

    try {
      const { error } = await supabase.from("swan_dips").insert({
        location: formData.location,
        product: formData.productType,
        dip_litres: reading,
        created_at: new Date(formData.timestamp).toISOString(),
        notes: formData.notes
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Dip Reading Added",
        description: `Successfully recorded ${reading}L for ${formData.location}`,
      });

      // Reset form and close modal
      setFormData({
        location: '',
        productType: '',
        dipReading: '',
        notes: '',
        timestamp: new Date().toISOString().slice(0, 16)
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Error Adding Dip",
        description: err.message || "An error occurred while saving the dip.",
        variant: "destructive"
      });
    }
  };

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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Select 
                value={formData.location} 
                onValueChange={(value) => setFormData({...formData, location: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="canningvale-1">Canningvale 1</SelectItem>
                  <SelectItem value="canningvale-2">Canningvale 2</SelectItem>
                  <SelectItem value="kalgoorlie-main">Kalgoorlie Main</SelectItem>
                  <SelectItem value="geraldton-depot">Geraldton Depot</SelectItem>
                  <SelectItem value="swan-transit-1">Swan Transit 1</SelectItem>
                  <SelectItem value="swan-transit-2">Swan Transit 2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="productType">Product Type *</Label>
              <Select 
                value={formData.productType} 
                onValueChange={(value) => setFormData({...formData, productType: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADF">ADF</SelectItem>
                  <SelectItem value="ULP">ULP</SelectItem>
                  <SelectItem value="Premium">Premium</SelectItem>
                  <SelectItem value="Diesel">Diesel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

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
            <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Add Reading
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
