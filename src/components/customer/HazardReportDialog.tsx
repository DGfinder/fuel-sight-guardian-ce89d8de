/**
 * Hazard Report Dialog
 * Modal form for customers to report access issues and safety hazards
 */

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { useCustomerTanks } from '@/hooks/useCustomerAuth';
import { useCreateHazardReport } from '@/hooks/useHazardReporting';
import { useHazardReportContext } from '@/contexts/HazardReportContext';
import { hazardReportSchema, type HazardReportFormData } from '@/lib/customer/schemas';
import {
  ACCESS_HAZARD_TYPES,
  SAFETY_HAZARD_TYPES,
  SEVERITY_CONFIG,
  type HazardCategory,
  type HazardSeverity,
} from '@/types/hazard';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  AlertTriangle,
  ShieldAlert,
  Lock,
  CheckCircle,
  Upload,
  X,
  ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion-variants';

export function HazardReportDialog() {
  const { isOpen, preselectedTank, closeHazardReport } = useHazardReportContext();
  const { data: tanks, isLoading: tanksLoading } = useCustomerTanks();
  const createHazardReport = useCreateHazardReport();

  const [submitted, setSubmitted] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<HazardReportFormData>({
    resolver: zodResolver(hazardReportSchema),
    defaultValues: {
      tank_id: null,
      hazard_category: 'access',
      hazard_type: '',
      severity: 'medium',
      description: '',
      location_description: '',
    },
  });

  // Set preselected tank when dialog opens
  useEffect(() => {
    if (isOpen && preselectedTank) {
      setValue('tank_id', preselectedTank.id);
    }
  }, [isOpen, preselectedTank, setValue]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        reset();
        setSubmitted(false);
        setPhotoFile(null);
        setPhotoPreview(null);
      }, 300);
    }
  }, [isOpen, reset]);

  const hazardCategory = watch('hazard_category') as HazardCategory;
  const selectedSeverity = watch('severity') as HazardSeverity;

  // Clear hazard type when category changes
  useEffect(() => {
    setValue('hazard_type', '');
  }, [hazardCategory, setValue]);

  const hazardTypes = hazardCategory === 'access' ? ACCESS_HAZARD_TYPES : SAFETY_HAZARD_TYPES;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        return;
      }
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const onSubmit = async (data: HazardReportFormData) => {
    try {
      await createHazardReport.mutateAsync({
        tank_id: data.tank_id,
        hazard_category: data.hazard_category,
        hazard_type: data.hazard_type,
        severity: data.severity,
        description: data.description,
        location_description: data.location_description,
        photo: photoFile || undefined,
      });
      setSubmitted(true);
    } catch (error) {
      console.error('Failed to submit hazard report:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeHazardReport()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <AnimatePresence mode="wait">
          {submitted ? (
            // Success state
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={springs.snappy}
              className="py-6 text-center"
            >
              <motion.div
                className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, ...springs.bouncy }}
              >
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </motion.div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Report Submitted
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Thank you for reporting this hazard. Our dispatch team has been notified
                and will take appropriate action.
              </p>
              <Button onClick={closeHazardReport}>Close</Button>
            </motion.div>
          ) : (
            // Form
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Report a Hazard
                </DialogTitle>
                <DialogDescription>
                  Report access issues or safety hazards at a tank location. Our dispatch
                  team will be notified immediately.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-4">
                {/* Tank Selection */}
                <div className="space-y-2">
                  <Label>Tank Location</Label>
                  <Select
                    value={watch('tank_id') || ''}
                    onValueChange={(value) => setValue('tank_id', value || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a tank (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {tanksLoading ? (
                        <div className="p-2 text-center">
                          <LoadingSpinner size="sm" />
                        </div>
                      ) : (
                        tanks?.map((tank) => (
                          <SelectItem key={tank.id} value={tank.id}>
                            {tank.location_id}
                            {tank.address1 && (
                              <span className="text-gray-500 ml-2">- {tank.address1}</span>
                            )}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Leave blank if the hazard is not at a specific tank
                  </p>
                </div>

                {/* Category Toggle */}
                <div className="space-y-2">
                  <Label>Hazard Category</Label>
                  <RadioGroup
                    value={hazardCategory}
                    onValueChange={(value) => setValue('hazard_category', value as HazardCategory)}
                    className="grid grid-cols-2 gap-3"
                  >
                    <Label
                      htmlFor="category-access"
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all',
                        hazardCategory === 'access'
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      )}
                    >
                      <RadioGroupItem value="access" id="category-access" className="sr-only" />
                      <Lock className="h-5 w-5 text-orange-500" />
                      <div>
                        <div className="font-medium">Access Issue</div>
                        <div className="text-xs text-gray-500">Gate, road, path</div>
                      </div>
                    </Label>
                    <Label
                      htmlFor="category-safety"
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all',
                        hazardCategory === 'safety'
                          ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      )}
                    >
                      <RadioGroupItem value="safety" id="category-safety" className="sr-only" />
                      <ShieldAlert className="h-5 w-5 text-red-500" />
                      <div>
                        <div className="font-medium">Safety Hazard</div>
                        <div className="text-xs text-gray-500">Spill, leak, damage</div>
                      </div>
                    </Label>
                  </RadioGroup>
                </div>

                {/* Hazard Type */}
                <div className="space-y-2">
                  <Label>Type of Hazard</Label>
                  <Select
                    value={watch('hazard_type')}
                    onValueChange={(value) => setValue('hazard_type', value)}
                  >
                    <SelectTrigger className={cn(errors.hazard_type && 'border-red-500')}>
                      <SelectValue placeholder="Select hazard type" />
                    </SelectTrigger>
                    <SelectContent>
                      {hazardTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div>
                            <div>{type.label}</div>
                            <div className="text-xs text-gray-500">{type.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.hazard_type && (
                    <p className="text-xs text-red-500">{errors.hazard_type.message}</p>
                  )}
                </div>

                {/* Severity */}
                <div className="space-y-2">
                  <Label>Severity</Label>
                  <RadioGroup
                    value={selectedSeverity}
                    onValueChange={(value) => setValue('severity', value as HazardSeverity)}
                    className="grid grid-cols-2 gap-2"
                  >
                    {(Object.entries(SEVERITY_CONFIG) as [HazardSeverity, typeof SEVERITY_CONFIG[HazardSeverity]][]).map(
                      ([value, config]) => (
                        <Label
                          key={value}
                          htmlFor={`severity-${value}`}
                          className={cn(
                            'flex flex-col p-3 rounded-lg border-2 cursor-pointer transition-all',
                            selectedSeverity === value
                              ? `${config.bgColor} border-current ${config.color}`
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                          )}
                        >
                          <RadioGroupItem
                            value={value}
                            id={`severity-${value}`}
                            className="sr-only"
                          />
                          <div className={cn('font-medium', selectedSeverity === value && config.color)}>
                            {config.label}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">{config.description}</div>
                        </Label>
                      )
                    )}
                  </RadioGroup>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the hazard in detail..."
                    className={cn('min-h-[100px]', errors.description && 'border-red-500')}
                    {...register('description')}
                  />
                  {errors.description && (
                    <p className="text-xs text-red-500">{errors.description.message}</p>
                  )}
                </div>

                {/* Photo Upload */}
                <div className="space-y-2">
                  <Label>Photo (optional)</Label>
                  {photoPreview ? (
                    <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                      <img
                        src={photoPreview}
                        alt="Hazard preview"
                        className="w-full h-40 object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8"
                        onClick={removePhoto}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label
                      htmlFor="photo-upload"
                      className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-gray-300 transition-colors"
                    >
                      <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-500">Click to upload a photo</span>
                      <span className="text-xs text-gray-400 mt-1">Max 10MB</span>
                    </label>
                  )}
                  <input
                    ref={fileInputRef}
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                </div>

                {/* Location Notes */}
                <div className="space-y-2">
                  <Label htmlFor="location_description">Additional Location Notes (optional)</Label>
                  <Textarea
                    id="location_description"
                    placeholder="Any additional details about the location..."
                    className="min-h-[60px]"
                    {...register('location_description')}
                  />
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={closeHazardReport}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-orange-600 hover:bg-orange-700"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Submit Report
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
