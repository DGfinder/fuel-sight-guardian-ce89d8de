import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCustomerTank, useCustomerAccount } from '@/hooks/useCustomerAuth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Fuel,
  ClipboardEdit,
  CheckCircle,
  AlertCircle,
  Calculator,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPerthToday, perthTimeFormatter } from '@/utils/timezone';

export default function CustomerRecordDip() {
  const { tankId } = useParams<{ tankId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: tank, isLoading: tankLoading } = useCustomerTank(tankId);
  const { data: customerAccount } = useCustomerAccount();

  // Form state
  const [dipValue, setDipValue] = useState('');
  const [inputMode, setInputMode] = useState<'litres' | 'percent'>('litres');
  const [dipDate, setDipDate] = useState(getPerthToday());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Calculate litres from percentage or vice versa
  const calculatedValues = useMemo(() => {
    if (!tank?.asset_profile_water_capacity || !dipValue) {
      return { litres: null, percent: null };
    }
    const capacity = tank.asset_profile_water_capacity;
    const numValue = parseFloat(dipValue);
    if (isNaN(numValue)) {
      return { litres: null, percent: null };
    }

    if (inputMode === 'litres') {
      const percent = (numValue / capacity) * 100;
      return { litres: numValue, percent: Math.min(100, percent) };
    } else {
      const litres = (numValue / 100) * capacity;
      return { litres, percent: Math.min(100, numValue) };
    }
  }, [dipValue, inputMode, tank?.asset_profile_water_capacity]);

  // Validation
  const validationError = useMemo(() => {
    if (!dipValue) return null;
    const numValue = parseFloat(dipValue);
    if (isNaN(numValue)) return 'Please enter a valid number';
    if (numValue < 0) return 'Value cannot be negative';

    if (inputMode === 'percent' && numValue > 100) {
      return 'Percentage cannot exceed 100%';
    }

    if (inputMode === 'litres' && tank?.asset_profile_water_capacity) {
      if (numValue > tank.asset_profile_water_capacity * 1.1) {
        return `Value exceeds tank capacity (${tank.asset_profile_water_capacity.toLocaleString()}L)`;
      }
    }

    return null;
  }, [dipValue, inputMode, tank?.asset_profile_water_capacity]);

  const canSubmit = dipValue && !validationError && calculatedValues.litres !== null;

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !tank) return;

    setSubmitError(null);
    setSaving(true);

    try {
      // Create timestamp in Perth timezone
      const timePart = perthTimeFormatter.format(new Date()).slice(0, 5);
      const perthIso = `${dipDate}T${timePart}:00+08:00`;
      const measuredAtIso = new Date(perthIso).toISOString();

      // Get user ID from current session
      const { data: { user } } = await supabase.auth.getUser();

      // Get business_id from ta_tanks (not in unified view)
      const { data: tankData, error: tankError } = await supabase
        .from('ta_tanks')
        .select('business_id')
        .eq('id', tank.id)
        .single();

      if (tankError || !tankData?.business_id) {
        console.error('Failed to get business_id:', tankError);
        setSubmitError('Could not determine business for this tank. Please try again.');
        setSaving(false);
        return;
      }

      // Insert dip reading
      const insertData = {
        tank_id: tank.id, // Use the tank UUID from customer_tanks_unified
        business_id: tankData.business_id,
        level_liters: Math.round(calculatedValues.litres!),
        level_percent: calculatedValues.percent,
        measured_at: measuredAtIso,
        measured_by: user?.id || null,
        measured_by_name: customerAccount?.contact_name || customerAccount?.customer_name || null,
        method: 'dipstick',
        source_channel: 'customer_portal',
        quality_status: 'ok',
        notes: notes.trim() || null,
      };

      const { error } = await supabase.from('ta_tank_dips').insert(insertData);

      if (error) {
        console.error('Dip insert error:', error);
        setSubmitError(`Failed to save: ${error.message}`);
        return;
      }

      // Invalidate queries to refresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['customer-tank', tankId] }),
        queryClient.invalidateQueries({ queryKey: ['customer-tanks'] }),
        queryClient.invalidateQueries({ queryKey: ['tank-readings'] }),
      ]);

      setSubmitSuccess(true);

      // Navigate back after short delay
      setTimeout(() => {
        navigate(`/customer/tanks/${tankId}`);
      }, 1500);

    } catch (err) {
      console.error('Submit error:', err);
      setSubmitError('An unexpected error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (tankLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner />
      </div>
    );
  }

  if (!tank) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Tank Not Found
        </h2>
        <p className="text-gray-500 mb-4">
          This tank may not be assigned to your account.
        </p>
        <Link to="/customer/tanks">
          <Button variant="outline">Back to Tanks</Button>
        </Link>
      </div>
    );
  }

  if (submitSuccess) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
        >
          <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <CardContent className="pt-8 pb-8 text-center">
              <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-green-800 dark:text-green-200 mb-2">
                Dip Reading Saved!
              </h2>
              <p className="text-green-700 dark:text-green-300">
                Redirecting you back to the tank details...
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Record Dip Reading
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {tank.location_id || tank.address1}
          </p>
        </div>
      </div>

      {/* Current Level Card */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Fuel className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="text-blue-800 dark:text-blue-200">Current Level</span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {Math.round(tank.latest_calibrated_fill_percentage || 0)}%
              </span>
              {tank.asset_profile_water_capacity && (
                <span className="text-sm text-blue-700 dark:text-blue-300 ml-2">
                  ({Math.round((tank.latest_calibrated_fill_percentage || 0) / 100 * tank.asset_profile_water_capacity).toLocaleString()}L)
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardEdit className="h-5 w-5" />
            New Reading
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error display */}
            {submitError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm">{submitError}</span>
              </div>
            )}

            {/* Input Mode Toggle */}
            <div className="space-y-2">
              <Label>Enter reading as</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={inputMode === 'litres' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setInputMode('litres');
                    setDipValue('');
                  }}
                >
                  Litres
                </Button>
                <Button
                  type="button"
                  variant={inputMode === 'percent' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setInputMode('percent');
                    setDipValue('');
                  }}
                >
                  Percentage
                </Button>
              </div>
            </div>

            {/* Dip Value Input */}
            <div className="space-y-2">
              <Label htmlFor="dipValue">
                {inputMode === 'litres' ? 'Fuel Level (Litres)' : 'Fuel Level (%)'}
                <span className="text-red-500 ml-1">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="dipValue"
                  type="number"
                  min="0"
                  max={inputMode === 'percent' ? 100 : undefined}
                  step={inputMode === 'percent' ? 1 : 10}
                  value={dipValue}
                  onChange={(e) => setDipValue(e.target.value)}
                  placeholder={inputMode === 'litres' ? 'e.g. 5000' : 'e.g. 45'}
                  className={cn(
                    'pr-12',
                    validationError && 'border-red-500 focus:ring-red-500'
                  )}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                  {inputMode === 'litres' ? 'L' : '%'}
                </span>
              </div>
              {validationError && (
                <p className="text-sm text-red-600">{validationError}</p>
              )}
            </div>

            {/* Calculated Value Display */}
            {calculatedValues.litres !== null && calculatedValues.percent !== null && (
              <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <Calculator className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {inputMode === 'litres' ? (
                    <>= {calculatedValues.percent.toFixed(1)}% of tank capacity</>
                  ) : (
                    <>= {Math.round(calculatedValues.litres).toLocaleString()} litres</>
                  )}
                </span>
              </div>
            )}

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="dipDate">Date</Label>
              <Input
                id="dipDate"
                type="date"
                value={dipDate}
                onChange={(e) => setDipDate(e.target.value)}
                max={getPerthToday()}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes about this reading..."
                rows={2}
              />
            </div>

            {/* Tank Capacity Reference */}
            {tank.asset_profile_water_capacity && (
              <div className="text-sm text-gray-500 dark:text-gray-400 border-t pt-4">
                Tank capacity: {tank.asset_profile_water_capacity.toLocaleString()} litres
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => navigate(-1)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={!canSubmit || saving}
              >
                {saving ? 'Saving...' : 'Save Reading'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
