import React, { useState, useMemo } from 'react';
import { AlertCircle, CheckCircle2, Save, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useBulkDipEntry } from '@/hooks/useBulkDipEntry';
import { businessRules } from '@/lib/validation';
import type { Tank } from '@/types/fuel';
import { cn } from '@/lib/utils';

interface SubgroupEntry {
  tankId: string;
  tankLocation: string;
  safeLevel: number;
  currentLevel: number;
  dipValue: string;
  error?: string;
  success?: boolean;
}

interface SubgroupQuickEntryProps {
  subgroup: string;
  tanks: Tank[];
  dipDate: Date;
  userId: string | null;
  userProfile: any;
  onSuccess: () => void;
}

export default function SubgroupQuickEntry({
  subgroup,
  tanks,
  dipDate,
  userId,
  userProfile,
  onSuccess,
}: SubgroupQuickEntryProps) {
  const { toast } = useToast();
  const { submitBulkReadings, isSubmitting, progress } = useBulkDipEntry();
  const [entries, setEntries] = useState<Record<string, SubgroupEntry>>(() => {
    const initial: Record<string, SubgroupEntry> = {};
    tanks.forEach(tank => {
      initial[tank.id] = {
        tankId: tank.id,
        tankLocation: tank.location || 'Unknown',
        safeLevel: tank.safe_level || 0,
        currentLevel: tank.current_level || 0,
        dipValue: '',
        error: undefined,
        success: false,
      };
    });
    return initial;
  });

  const handleDipValueChange = (tankId: string, value: string) => {
    setEntries(prev => {
      const entry = prev[tankId];
      if (!entry) return prev;

      // Validate against safe fill level
      let error: string | undefined;
      if (value && !isNaN(Number(value))) {
        const validation = businessRules.validateDipReading(Number(value), entry.safeLevel);
        error = validation.valid ? undefined : validation.error;
      }

      return {
        ...prev,
        [tankId]: {
          ...entry,
          dipValue: value,
          error,
          success: false,
        },
      };
    });
  };

  const getValidEntries = () => {
    return Object.values(entries).filter(
      entry => entry.dipValue && !entry.error && !isNaN(Number(entry.dipValue))
    );
  };

  const handleSubmit = async () => {
    const validEntries = getValidEntries();
    if (validEntries.length === 0) {
      toast({
        title: 'No valid entries',
        description: 'Please enter at least one valid dip reading',
        variant: 'destructive',
      });
      return;
    }

    const readings = validEntries.map(entry => ({
      tank_id: entry.tankId,
      value: Number(entry.dipValue),
      created_at: dipDate.toISOString(),
      recorded_by: userId,
      created_by_name: userProfile?.full_name || null,
      notes: `Quick entry for ${subgroup}`,
    }));

    submitBulkReadings(readings);
    
    // Mark all entries as successful (the hook will handle success/error state)
    setEntries(prev => {
      const updated = { ...prev };
      validEntries.forEach(entry => {
        updated[entry.tankId] = {
          ...updated[entry.tankId],
          success: true,
          error: undefined,
        };
      });
      return updated;
    });
    
    onSuccess();
  };

  const clearAll = () => {
    setEntries(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(tankId => {
        updated[tankId] = {
          ...updated[tankId],
          dipValue: '',
          error: undefined,
          success: false,
        };
      });
      return updated;
    });
  };

  const entriesWithValues = Object.values(entries).filter(e => e.dipValue);
  const entriesWithErrors = Object.values(entries).filter(e => e.error);
  const entriesSuccessful = Object.values(entries).filter(e => e.success);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{subgroup}</CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">
              {tanks.length} tanks
            </Badge>
            {entriesWithValues.length > 0 && (
              <Badge variant="outline" className="text-xs text-blue-700">
                {entriesWithValues.length} entered
              </Badge>
            )}
            {entriesWithErrors.length > 0 && (
              <Badge variant="outline" className="text-xs text-red-700">
                {entriesWithErrors.length} errors
              </Badge>
            )}
            {entriesSuccessful.length > 0 && (
              <Badge variant="outline" className="text-xs text-green-700">
                {entriesSuccessful.length} saved
              </Badge>
            )}
          </div>
        </div>
        {isSubmitting && (
          <div className="space-y-2">
            <Progress value={progress} className="h-1" />
            <p className="text-xs text-center text-muted-foreground">
              Saving readings... {Math.round(progress)}%
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {tanks.map(tank => {
          const entry = entries[tank.id];
          if (!entry) return null;

          const ullage = entry.dipValue && !isNaN(Number(entry.dipValue))
            ? Math.max(0, entry.safeLevel - Number(entry.dipValue))
            : null;

          return (
            <div
              key={tank.id}
              className={cn(
                'grid grid-cols-12 gap-3 items-center p-3 rounded-lg border',
                entry.success && 'bg-green-50 border-green-200',
                entry.error && 'bg-red-50 border-red-200'
              )}
            >
              <div className="col-span-5">
                <div className="font-medium text-sm">{entry.tankLocation}</div>
                <div className="text-xs text-muted-foreground">
                  Safe: {entry.safeLevel.toLocaleString()}L | Current: {entry.currentLevel.toLocaleString()}L
                </div>
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  placeholder="Enter dip"
                  value={entry.dipValue}
                  onChange={(e) => handleDipValueChange(tank.id, e.target.value)}
                  min={0}
                  max={entry.safeLevel}
                  className={cn(
                    'w-full text-sm',
                    entry.error && 'border-red-500'
                  )}
                  disabled={isSubmitting || entry.success}
                />
              </div>
              <div className="col-span-4 flex items-center gap-2">
                {ullage !== null && !entry.error && (
                  <div className="text-xs text-muted-foreground">
                    Ullage: {ullage.toLocaleString()}L
                  </div>
                )}
                {entry.error && (
                  <div className="flex items-center gap-1 text-red-600 text-xs">
                    <AlertCircle className="h-3 w-3" />
                    {entry.error}
                  </div>
                )}
                {entry.success && (
                  <div className="flex items-center gap-1 text-green-600 text-xs">
                    <CheckCircle2 className="h-3 w-3" />
                    Saved
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            disabled={isSubmitting || entriesWithValues.length === 0}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Clear All
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || getValidEntries().length === 0}
          >
            <Save className="h-3 w-3 mr-1" />
            Save {getValidEntries().length} Readings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}