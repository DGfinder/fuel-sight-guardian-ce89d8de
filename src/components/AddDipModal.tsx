
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useTanks } from "@/hooks/useTanks";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface AddDipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddDipModal({ open, onOpenChange }: AddDipModalProps) {
  const [selectedTankId, setSelectedTankId] = useState<string>('');
  const [dipValue, setDipValue] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { tanks, isLoading } = useTanks();
  const { user } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTankId || !dipValue || !user) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('dip_readings')
        .insert([{
          tank_id: selectedTankId,
          value: parseInt(dipValue),
          recorded_by: user.id,
          notes: notes || null,
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Dip reading added successfully",
      });

      // Reset form
      setSelectedTankId('');
      setDipValue('');
      setNotes('');
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding dip reading:', error);
      toast({
        title: "Error",
        description: "Failed to add dip reading",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Dip Reading</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tank">Tank</Label>
            {isLoading ? (
              <LoadingSpinner size={16} text="Loading tanks..." />
            ) : (
              <Select value={selectedTankId} onValueChange={setSelectedTankId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a tank" />
                </SelectTrigger>
                <SelectContent>
                  {tanks?.map((tank) => (
                    <SelectItem key={tank.id} value={tank.id}>
                      {tank.location} - {tank.product_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="dipValue">Dip Reading (Litres)</Label>
            <Input
              id="dipValue"
              type="number"
              value={dipValue}
              onChange={(e) => setDipValue(e.target.value)}
              placeholder="Enter dip reading in litres"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes..."
              rows={3}
            />
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !selectedTankId || !dipValue}
              style={{ backgroundColor: '#008457' }}
              className="text-white hover:bg-green-700"
            >
              {isSubmitting ? <LoadingSpinner size={16} /> : 'Add Reading'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
