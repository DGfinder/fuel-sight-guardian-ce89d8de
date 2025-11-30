import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  useCanRequestDelivery,
} from '@/hooks/useCustomerAuth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { calculateUrgency, getUrgencyClasses } from '@/lib/urgency-calculator';
import { Truck, Calendar, AlertTriangle, CheckCircle, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const requestSchema = z.object({
  tankId: z.string().min(1, 'Please select a tank'),
  requestType: z.enum(['standard', 'urgent', 'scheduled']),
  requestedDate: z.string().optional(),
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

  // Success state
  if (submitted) {
    return (
      <div className="max-w-lg mx-auto">
        <Card className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-green-800 dark:text-green-200 mb-2">
              Request Submitted
            </h2>
            <p className="text-green-700 dark:text-green-300 mb-6">
              Your delivery request has been submitted successfully. Great Southern Fuels
              will review your request and schedule a delivery.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate('/customer/history')}>
                View Request History
              </Button>
              <Button onClick={() => navigate('/customer')}>Back to Dashboard</Button>
            </div>
          </CardContent>
        </Card>
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Tank Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Tank</CardTitle>
            <CardDescription>Choose which tank needs a fuel delivery</CardDescription>
          </CardHeader>
          <CardContent>
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

            {/* Selected Tank Info */}
            {selectedTank && (
              <div className="mt-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selectedTank.location_id || selectedTank.address1}</p>
                    <p className="text-sm text-gray-500">{selectedTank.address1}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      {(selectedTank.latest_calibrated_fill_percentage || 0).toFixed(0)}%
                    </p>
                    {selectedTank.asset_days_remaining && (
                      <p className="text-sm text-gray-500">
                        ~{Math.round(selectedTank.asset_days_remaining)} days remaining
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Request Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Delivery Priority</CardTitle>
            <CardDescription>How urgent is this delivery?</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={requestType}
              onValueChange={(value) =>
                setValue('requestType', value as 'standard' | 'urgent' | 'scheduled')
              }
              className="space-y-3"
            >
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                <RadioGroupItem value="standard" id="standard" />
                <Label htmlFor="standard" className="flex-1 cursor-pointer">
                  <div className="font-medium">Standard</div>
                  <div className="text-sm text-gray-500">
                    Delivery within normal schedule (2-5 business days)
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 cursor-pointer">
                <RadioGroupItem value="urgent" id="urgent" />
                <Label htmlFor="urgent" className="flex-1 cursor-pointer">
                  <div className="font-medium text-yellow-800 dark:text-yellow-200">
                    Urgent
                  </div>
                  <div className="text-sm text-yellow-700 dark:text-yellow-300">
                    Priority delivery (1-2 business days)
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                <RadioGroupItem value="scheduled" id="scheduled" />
                <Label htmlFor="scheduled" className="flex-1 cursor-pointer">
                  <div className="font-medium">Scheduled</div>
                  <div className="text-sm text-gray-500">
                    Request delivery for a specific date
                  </div>
                </Label>
              </div>
            </RadioGroup>

            {/* Scheduled Date Input */}
            {requestType === 'scheduled' && (
              <div className="mt-4">
                <Label htmlFor="requestedDate">Preferred Date</Label>
                <Input
                  type="date"
                  id="requestedDate"
                  {...register('requestedDate')}
                  min={new Date().toISOString().split('T')[0]}
                  className="mt-1"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Additional Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Additional Details</CardTitle>
            <CardDescription>Optional information for the delivery team</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                Leave blank for a full tank delivery
              </p>
            </div>
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

        {/* Submit */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => navigate(-1)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1 gap-2"
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
        </div>
      </form>
    </div>
  );
}
