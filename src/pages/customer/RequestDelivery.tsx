import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCustomerTanks,
  useCreateDeliveryRequest,
} from '@/hooks/useCustomerAuth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { FuelQuantitySelector } from '@/components/customer/FuelQuantitySelector';
import { calculateUrgency, getUrgencyClasses } from '@/lib/urgency-calculator';
import { Truck, Calendar, AlertTriangle, CheckCircle, ArrowLeft, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { springs, fadeUpItemVariants } from '@/lib/motion-variants';
import { WeatherStrip } from '@/components/ui/WeatherStrip';

const requestSchema = z.object({
  tankId: z.string().min(1, 'Please select a tank'),
  requestType: z.enum(['standard', 'urgent', 'scheduled']),
  requestedDate: z.string().optional(),
  purchaseOrder: z.string().max(100).optional(),
  requestedLitres: z.number().optional(),
  notes: z.string().optional(),
});

type RequestFormData = z.infer<typeof requestSchema>;

export default function RequestDelivery() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedTank = searchParams.get('tank');

  const { data: tanks, isLoading: tanksLoading } = useCustomerTanks();
  const createRequest = useCreateDeliveryRequest();
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      tankId: preselectedTank || '',
      requestType: 'standard',
      purchaseOrder: '',
      notes: '',
    },
  });

  // Set preselected tank when tanks load
  useEffect(() => {
    if (preselectedTank && tanks?.find((t) => t.id === preselectedTank)) {
      setValue('tankId', preselectedTank);
    }
  }, [preselectedTank, tanks, setValue]);

  const selectedTankId = watch('tankId');
  const requestType = watch('requestType');
  const requestedLitres = watch('requestedLitres');
  const selectedTank = tanks?.find((t) => t.id === selectedTankId);

  // Filter to only tanks with request_delivery permission
  const requestableTanks = tanks?.filter(
    (t) => t.access_level === 'request_delivery' || t.access_level === 'admin'
  );

  const onSubmit = async (data: RequestFormData) => {
    try {
      await createRequest.mutateAsync({
        agbot_location_id: data.tankId,
        request_type: data.requestType,
        requested_date: data.requestedDate,
        purchase_order: data.purchaseOrder,
        requested_litres: data.requestedLitres,
        current_level_pct: selectedTank?.latest_calibrated_fill_percentage,
        notes: data.notes,
      });

      setSubmitted(true);
      toast.success('Delivery request submitted successfully');
    } catch (error) {
      console.error('Failed to submit request:', error);
      toast.error('Failed to submit request. Please try again.');
    }
  };

  if (tanksLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner />
      </div>
    );
  }

  // Success state with celebration animation
  if (submitted) {
    return (
      <div className="max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={springs.bouncy}
        >
          <Card className="relative overflow-hidden border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 dark:border-green-800 shadow-xl">
            {/* Celebration sparkles */}
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute"
                  initial={{
                    opacity: 0,
                    scale: 0,
                    x: '50%',
                    y: '50%',
                  }}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0, 1.5, 0],
                    x: `${50 + Math.cos((i / 12) * Math.PI * 2) * 40}%`,
                    y: `${50 + Math.sin((i / 12) * Math.PI * 2) * 40}%`,
                  }}
                  transition={{
                    duration: 1.5,
                    delay: i * 0.05,
                    ease: 'easeOut',
                  }}
                >
                  <Sparkles className="h-4 w-4 text-green-500" />
                </motion.div>
              ))}
            </div>

            <CardContent className="pt-8 pb-6 text-center relative z-10">
              <motion.div
                className="w-20 h-20 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 flex items-center justify-center mx-auto mb-4 shadow-lg"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, ...springs.bouncy }}
              >
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
                </motion.div>
              </motion.div>
              <motion.h2
                className="text-2xl font-bold text-green-800 dark:text-green-200 mb-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                Request Submitted!
              </motion.h2>
              <motion.p
                className="text-green-700 dark:text-green-300 mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                Your delivery request has been submitted successfully. Great Southern Fuels
                will review your request and schedule a delivery.
              </motion.p>
              <motion.div
                className="flex gap-3 justify-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Button variant="outline" onClick={() => navigate('/customer/history')}>
                  View Request History
                </Button>
                <Button onClick={() => navigate('/customer')}>Back to Dashboard</Button>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // No tanks available for delivery requests
  if (!requestableTanks || requestableTanks.length === 0) {
    return (
      <div className="max-w-lg mx-auto">
        <Card>
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">No Tanks Available</h2>
            <p className="text-gray-500 mb-6">
              You don't have permission to request deliveries for any tanks. Please
              contact Great Southern Fuels to enable delivery requests.
            </p>
            <Button variant="outline" onClick={() => navigate('/customer')}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Request Fuel Delivery
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Submit a request for fuel delivery to one of your tanks
          </p>
        </div>
      </div>

      {/* Weather Strip - Show when tank selected with location */}
      {selectedTank?.lat && selectedTank?.lng && (
        <WeatherStrip
          lat={selectedTank.lat}
          lng={selectedTank.lng}
          context="delivery"
        />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Tank Selection - Step 1 with glassmorphism */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.gentle}
        >
          <Card className="relative overflow-hidden backdrop-blur-sm bg-gradient-to-br from-white/80 to-gray-50/80 dark:from-gray-900/80 dark:to-gray-950/80 border-gray-200/50 dark:border-gray-700/50">
            {/* Glass effect background */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent dark:from-gray-700/10 pointer-events-none" />

            <CardHeader className="relative z-10">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs font-bold text-blue-600 dark:text-blue-400">
                  1
                </div>
                <CardTitle className="text-lg">Select Tank</CardTitle>
              </div>
              <CardDescription>Choose which tank needs a fuel delivery</CardDescription>
            </CardHeader>
            <CardContent className="relative z-10">
            <Select
              value={selectedTankId}
              onValueChange={(value) => setValue('tankId', value)}
            >
              <SelectTrigger className={cn(errors.tankId && 'border-red-500')}>
                <SelectValue placeholder="Select a tank..." />
              </SelectTrigger>
              <SelectContent>
                {requestableTanks.map((tank) => {
                  const urgency = calculateUrgency(tank.asset_days_remaining ?? null);
                  const urgencyClasses = getUrgencyClasses(urgency);

                  return (
                    <SelectItem key={tank.id} value={tank.id}>
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            urgencyClasses.bg,
                            urgencyClasses.text
                          )}
                        >
                          {(tank.latest_calibrated_fill_percentage || 0).toFixed(0)}%
                        </span>
                        <span>{tank.location_id || tank.address1}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {errors.tankId && (
              <p className="text-sm text-red-500 mt-1">{errors.tankId.message}</p>
            )}

            {/* Selected Tank Info with animation */}
            <AnimatePresence>
              {selectedTank && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={springs.gentle}
                  className="mt-4"
                >
                  <div className="p-4 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-850 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{selectedTank.location_id || selectedTank.address1}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{selectedTank.address1}</p>
                      </div>
                      <div className="text-right">
                        <motion.p
                          className="text-3xl font-bold tabular-nums"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={springs.bouncy}
                        >
                          {(selectedTank.latest_calibrated_fill_percentage || 0).toFixed(0)}%
                        </motion.p>
                        {selectedTank.asset_days_remaining && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            ~{Math.round(selectedTank.asset_days_remaining)} days remaining
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
        </motion.div>

        {/* Request Type - Step 2 with glassmorphism */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: 0.1 }}
        >
          <Card className="relative overflow-hidden backdrop-blur-sm bg-gradient-to-br from-white/80 to-gray-50/80 dark:from-gray-900/80 dark:to-gray-950/80 border-gray-200/50 dark:border-gray-700/50">
            {/* Glass effect background */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent dark:from-gray-700/10 pointer-events-none" />

            <CardHeader className="relative z-10">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs font-bold text-blue-600 dark:text-blue-400">
                  2
                </div>
                <CardTitle className="text-lg">Delivery Priority</CardTitle>
              </div>
              <CardDescription>How urgent is this delivery?</CardDescription>
            </CardHeader>
            <CardContent className="relative z-10">
            <RadioGroup
              value={requestType}
              onValueChange={(value) =>
                setValue('requestType', value as 'standard' | 'urgent' | 'scheduled')
              }
              className="space-y-3"
            >
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={springs.responsive}
              >
                <div
                  className={cn(
                    'flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer',
                    requestType === 'standard'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  )}
                  onClick={() => setValue('requestType', 'standard')}
                >
                  <RadioGroupItem value="standard" id="standard" />
                  <Label htmlFor="standard" className="flex-1 cursor-pointer">
                    <div className="font-semibold">Standard</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Delivery within normal schedule (2-5 business days)
                    </div>
                  </Label>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={springs.responsive}
              >
                <div
                  className={cn(
                    'flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer',
                    requestType === 'urgent'
                      ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 shadow-md'
                      : 'border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10 hover:bg-yellow-100 dark:hover:bg-yellow-900/20'
                  )}
                  onClick={() => setValue('requestType', 'urgent')}
                >
                  <RadioGroupItem value="urgent" id="urgent" />
                  <Label htmlFor="urgent" className="flex-1 cursor-pointer">
                    <div className="font-semibold text-yellow-800 dark:text-yellow-200">
                      Urgent
                    </div>
                    <div className="text-sm text-yellow-700 dark:text-yellow-300">
                      Priority delivery (1-2 business days)
                    </div>
                  </Label>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={springs.responsive}
              >
                <div
                  className={cn(
                    'flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer',
                    requestType === 'scheduled'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  )}
                  onClick={() => setValue('requestType', 'scheduled')}
                >
                  <RadioGroupItem value="scheduled" id="scheduled" />
                  <Label htmlFor="scheduled" className="flex-1 cursor-pointer">
                    <div className="font-semibold">Scheduled</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Request delivery for a specific date
                    </div>
                  </Label>
                </div>
              </motion.div>
            </RadioGroup>

            {/* Scheduled Date Input with animation */}
            <AnimatePresence>
              {requestType === 'scheduled' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={springs.gentle}
                  className="mt-4"
                >
                  <Label htmlFor="requestedDate">Preferred Date</Label>
                  <Input
                    type="date"
                    id="requestedDate"
                    {...register('requestedDate')}
                    min={new Date().toISOString().split('T')[0]}
                    className="mt-1"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
        </motion.div>

        {/* Purchase Order - Optional field */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: 0.15 }}
        >
          <Card className="relative overflow-hidden backdrop-blur-sm bg-gradient-to-br from-white/80 to-gray-50/80 dark:from-gray-900/80 dark:to-gray-950/80 border-gray-200/50 dark:border-gray-700/50">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent dark:from-gray-700/10 pointer-events-none" />
            <CardContent className="pt-6 relative z-10">
              <Label htmlFor="purchaseOrder" className="text-sm font-medium">
                Purchase Order Number <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="purchaseOrder"
                placeholder="e.g., PO-2024-001234"
                {...register('purchaseOrder')}
                className="mt-1.5"
                maxLength={100}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                Add a PO number for your records and invoicing
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Additional Details - Step 3 with glassmorphism */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: 0.2 }}
        >
          <Card className="relative overflow-hidden backdrop-blur-sm bg-gradient-to-br from-white/80 to-gray-50/80 dark:from-gray-900/80 dark:to-gray-950/80 border-gray-200/50 dark:border-gray-700/50">
            {/* Glass effect background */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent dark:from-gray-700/10 pointer-events-none" />

            <CardHeader className="relative z-10">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs font-bold text-blue-600 dark:text-blue-400">
                  3
                </div>
                <CardTitle className="text-lg">Fuel Quantity</CardTitle>
              </div>
              <CardDescription>How much fuel do you need?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 relative z-10">
            {/* Fuel Quantity Selector - Visual tank + options */}
            {selectedTank && selectedTank.asset_profile_water_capacity ? (
              <FuelQuantitySelector
                currentLevelLiters={
                  selectedTank.asset_current_level_liters ||
                  ((selectedTank.latest_calibrated_fill_percentage || 0) / 100) * selectedTank.asset_profile_water_capacity
                }
                currentLevelPercent={selectedTank.latest_calibrated_fill_percentage || 0}
                capacityLiters={selectedTank.asset_profile_water_capacity}
                value={requestedLitres ?? null}
                onChange={(litres) => setValue('requestedLitres', litres ?? undefined)}
              />
            ) : (
              <div>
                <Label htmlFor="requestedLitres">Estimated Litres Needed (optional)</Label>
                <Input
                  type="number"
                  id="requestedLitres"
                  placeholder="e.g., 5000"
                  {...register('requestedLitres', { valueAsNumber: true })}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {selectedTank ? 'Enter the amount of fuel you need' : 'Select a tank above to see capacity details'}
                </p>
              </div>
            )}
            <div>
              <Label htmlFor="notes">Notes / Special Instructions</Label>
              <Textarea
                id="notes"
                placeholder="Any special access instructions, contact person, etc."
                {...register('notes')}
                className="mt-1"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
        </motion.div>

        {/* Submit buttons with animation */}
        <motion.div
          className="flex gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: 0.3 }}
        >
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => navigate(-1)}
          >
            Cancel
          </Button>
          <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              type="submit"
              className="w-full gap-2"
              disabled={isSubmitting || createRequest.isPending}
            >
              {isSubmitting || createRequest.isPending ? (
                <>
                  <LoadingSpinner className="h-4 w-4" />
                  Submitting...
                </>
              ) : (
                <>
                  <Truck size={16} />
                  Submit Request
                </>
              )}
            </Button>
          </motion.div>
        </motion.div>
      </form>
    </div>
  );
}
