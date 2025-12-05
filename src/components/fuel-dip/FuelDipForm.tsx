// FuelDipForm.tsx — fully patched version
// --------------------------------------------------
// * Stable dropdown behaviour (no flicker / jump)
// * Proper subgroup handling
// * Single source‑of‑truth numeric dipValue
// * Groups always referenced by `id` (never `location`)
// * Subgroup field returned from Supabase query
// --------------------------------------------------

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { useQuery } from '@tanstack/react-query';
import type { Tables } from '@/types/supabase';
import { useToast } from "@/hooks/use-toast";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { isAfter } from "date-fns/isAfter";
import { isValid as isValidDate } from "date-fns/isValid";
import { parseISO } from "date-fns/parseISO";
import { getPerthToday } from '@/utils/timezone';

//--------------------------------------------------
// Schema & types
//--------------------------------------------------
import { schemas, businessRules, validateAndFormat } from "@/lib/validation";

const schema = schemas.fuelDip;

export type FormData = z.infer<typeof schema>;

export interface FuelDipFormProps {
  /** preset depot group id (optional) */
  initialDepot?: string;
  /** preset subgroup name (optional) */
  initialSubgroup?: string;
  /** preset tank id (optional) */
  initialTank?: string;
  readOnly?: boolean;
}

//--------------------------------------------------
// Data models returned from DB
//--------------------------------------------------
type TankGroup = { id: string; name: string };

export interface Tank {
  id: string;
  location: string;
  group_id: string;
  subgroup: string | null;
  safe_level: number;
  current_level: number;
  current_level_percent: number; // calculated client‑side
  min_level?: number | null;
}

// Narrow type for the minimal fields we read when checking same-day dips
type ExistingDipSummary = {
  id: string;
  value: number;
  created_at: string;
  created_by_name: string | null;
};

type DipReading = { value: number; created_at: string };

const LOCAL_STORAGE_KEY = "fuel-dip-form-last-used";

//--------------------------------------------------
// Component
//--------------------------------------------------
export function FuelDipForm({
  initialDepot,
  initialSubgroup,
  initialTank,
  readOnly = false,
}: FuelDipFormProps) {
  //------------------------------------------------
  // React‑hook‑form setup
  //------------------------------------------------
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    control,
    formState: { errors, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      date: getPerthToday(), // Use Perth timezone for default date
    },
  });

  //------------------------------------------------
  // Local state
  //------------------------------------------------
  const { toast } = useToast();
  const [user, setUser] = useState<null | { id: string; email: string }>(null);
  const [loading, setLoading] = useState(false);

  // dropdown data
  const [groups, setGroups] = useState<TankGroup[]>([]);
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [tanksLoading, setTanksLoading] = useState(false);

  // same-day dip handling
  const [existingSameDayDip, setExistingSameDayDip] = useState<ExistingDipSummary | null>(null);
  const [showSameDayDialog, setShowSameDayDialog] = useState(false);
  const [safeFillError, setSafeFillError] = useState<string>("");

  // Add to FuelDipForm component state:
  const [calendarOpen, setCalendarOpen] = useState(false);
  // Use Perth timezone for "today" calculation
  const today = useMemo(() => {
    const perthToday = getPerthToday();
    return parseISO(perthToday);
  }, []);
  const dateValue = watch("date");
  const [selectedDate, setSelectedDate] = useState(() => dateValue ? parseISO(dateValue) : today);
  useEffect(() => {
    // Keep local state in sync with form value
    if (dateValue && (!selectedDate || format(selectedDate, "yyyy-MM-dd") !== dateValue)) {
      setSelectedDate(parseISO(dateValue));
    }
  }, [dateValue, selectedDate]);

  //------------------------------------------------
  // Fetch groups once
  //------------------------------------------------
  useEffect(() => {
    if (initialDepot) {
      setGroups([{ id: initialDepot, name: initialDepot }]);
      return;
    }

    supabase
      .from("tank_groups")
      .select("id,name")
      .then(({ data, error }) => {
        if (error) {
          toast({
            title: "Error fetching groups",
            description: error.message,
            variant: "destructive",
          });
          return;
        }
        setGroups(data ?? []);
      });
  }, [initialDepot, toast]);

  //------------------------------------------------
  // Fetch tanks once
  //------------------------------------------------
  useEffect(() => {
    setTanksLoading(true);
    supabase
      .from("fuel_tanks")
      .select(
        "id,location,group_id,subgroup,safe_level,current_level,min_level"
      )
      .eq('status', 'active')
      .then(({ data, error }) => {
        setTanksLoading(false);
        if (error) {
          toast({ title: "Error", description: error.message, variant: "destructive" });
          return;
        }
        const mapped: Tank[] = (data ?? []).map((t) => ({
          ...t,
          current_level_percent: Math.round((t.current_level / t.safe_level) * 100),
        }));
        setTanks(mapped);
      });
  }, [toast]);

  //------------------------------------------------
  // Persist / hydrate last selections
  //------------------------------------------------
  useEffect(() => {
    if (initialDepot || initialTank) return; // skip hydration when presets supplied
    const last = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!last) return;
    try {
      const { group, subgroup, tank } = JSON.parse(last);
      if (group) setValue("group", group);
      if (subgroup) setValue("subgroup", subgroup);
      if (tank) setValue("tank", tank);
    } catch (_) {
      /* ignore */
    }
  }, [setValue, initialDepot, initialTank]);

  // Persist on each change (non‑readonly only)
  const watchedGroup = watch("group", "");
  const watchedSubgroup = watch("subgroup", "");
  const watchedTank = watch("tank", "");
  useEffect(() => {
    if (readOnly) return;
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({ group: watchedGroup, subgroup: watchedSubgroup, tank: watchedTank })
    );
  }, [watchedGroup, watchedSubgroup, watchedTank, readOnly]);

  //------------------------------------------------
  // Derived dropdown lists (memoised)
  //------------------------------------------------
  const filteredTanks = useMemo(() => {
    if (!watchedGroup) return [];
    return tanks.filter((t) => t.group_id === watchedGroup);
  }, [tanks, watchedGroup]);

  const subgroupOptions = useMemo(() => {
    return Array.from(new Set(filteredTanks.map((t) => t.subgroup).filter(Boolean))) as string[];
  }, [filteredTanks]);

  const tanksForDropdown = useMemo(() => {
    if (!watchedGroup) return [];
    if (!watchedSubgroup) return filteredTanks;
    return filteredTanks.filter((t) => t.subgroup === watchedSubgroup);
  }, [filteredTanks, watchedSubgroup, watchedGroup]);

  //------------------------------------------------
  // Live feedback helpers
  //------------------------------------------------
  const dipValue = watch("dip");
  const selectedTank = useMemo(() => tanks.find((t) => t.id === watchedTank) ?? null, [tanks, watchedTank]);
  const overfill = !!selectedTank && !!dipValue && dipValue > selectedTank.safe_level;
  const ullage =
    selectedTank && typeof dipValue === "number"
      ? Math.max(0, selectedTank.safe_level - dipValue)
      : null;

  //------------------------------------------------
  // Enhanced validation for safe fill level
  //------------------------------------------------
  useEffect(() => {
    if (selectedTank && typeof dipValue === "number") {
      const validation = businessRules.validateDipReading(dipValue, selectedTank.safe_level);
      setSafeFillError(validation.valid ? "" : validation.error || "");
    } else {
      setSafeFillError("");
    }
  }, [dipValue, selectedTank]);

  //------------------------------------------------
  // Same-day dip checking
  //------------------------------------------------
  const checkForSameDayDip = async (tankId: string, date: string) => {
    const dateOnly = validateAndFormat.formatDateOnly(date);
    
    const { data, error } = await supabase
      .from('ta_tank_dips')
      .select('id, level_liters, created_at, measured_by_name')
      .eq('tank_id', tankId)
      .gte('created_at', dateOnly + 'T00:00:00')
      .lt('created_at', dateOnly + 'T23:59:59')
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error checking for same-day dip:', error);
      return null;
    }

    // Transform to match expected format
    if (data && data.length > 0) {
      const dip = data[0];
      return {
        id: dip.id,
        value: dip.level_liters,
        created_at: dip.created_at,
        created_by_name: dip.measured_by_name
      };
    }
    return null;
  };

  //------------------------------------------------
  // Submit handler
  //------------------------------------------------
  const onSubmit = async (data: FormData) => {
    if (readOnly) return;

    // Validate against safe fill level first
    if (safeFillError) {
      toast({ 
        title: "Validation Error", 
        description: safeFillError, 
        variant: "destructive" 
      });
      return;
    }

    setLoading(true);

    try {
      // Check for existing same-day dip
      const existingDip = await checkForSameDayDip(data.tank, data.date);
      
      if (existingDip) {
        setExistingSameDayDip(existingDip);
        setShowSameDayDialog(true);
        setLoading(false);
        return;
      }

      // No same-day dip found, proceed with normal submission
      await submitDipReading(data);
    } catch (error) {
      setLoading(false);
      toast({ 
        title: "Error", 
        description: "Failed to check for existing dip reading", 
        variant: "destructive" 
      });
    }
  };

  const submitDipReading = async (data: FormData, replaceSameDay = false) => {
    try {
      // If replacing same-day dip, archive the existing one first
      if (replaceSameDay && existingSameDayDip) {
        const { error: archiveError } = await supabase
          .from('ta_tank_dips')
          .update({ archived_at: new Date().toISOString() })
          .eq('id', existingSameDayDip.id);

        if (archiveError) {
          throw new Error(`Failed to archive existing dip: ${archiveError.message}`);
        }
      }

      // Fetch business_id for the tank
      const { data: tankData } = await supabase
        .from('ta_tanks')
        .select('business_id')
        .eq('id', data.tank)
        .single();

      // Insert new dip reading - always use Perth time regardless of user's computer timezone
      const now = new Date();
      const perthOffset = 8 * 60; // Perth is UTC+8
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const perthTime = new Date(utc + (perthOffset * 60000));
      const createdAtIso = perthTime.toISOString();

      const { error } = await supabase.from("ta_tank_dips").insert({
        tank_id: data.tank,
        business_id: tankData.business_id,
        level_liters: data.dip,
        measured_at: createdAtIso,
        measured_by: user?.id ?? "unknown",
        measured_by_name: userProfile?.full_name || null,
        method: 'manual',
        source_channel: 'web',
        quality_status: 'ok',
        notes: data.notes ?? null,
      });

      if (error) {
        throw new Error(error.message);
      }

      setLoading(false);
      setShowSameDayDialog(false);
      setExistingSameDayDip(null);
      
      toast({ 
        title: "Success", 
        description: replaceSameDay 
          ? "Dip reading updated (previous reading archived)" 
          : "Dip reading submitted" 
      });
      
      reset();
    } catch (error: unknown) {
      setLoading(false);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to submit dip reading", 
        variant: "destructive" 
      });
    }
  };

  //------------------------------------------------
  // Ensure we have a user (for recorded_by)
  //------------------------------------------------
  useEffect(() => {
    if (readOnly) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.id && data.session?.user?.email) {
        setUser({ 
          id: data.session.user.id,
          email: data.session.user.email 
        });
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s?.user?.id && s?.user?.email) {
        setUser({ 
          id: s.user.id,
          email: s.user.email 
        });
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [readOnly]);

  // Fetch user profile to get full name
  const { data: userProfile } = useQuery<Tables<'profiles'> | null>({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (error) return null;
        return data as Tables<'profiles'>;
      } catch {
        return null;
      }
    },
    enabled: !!user?.id,
    retry: false,
  });

  //------------------------------------------------
  // Render
  //------------------------------------------------
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 w-full max-w-lg">
      {/* DEPOT GROUP */}
      <div>
        <label className="block text-sm font-medium mb-1">Depot Group *</label>
        <Controller
          name="group"
          control={control}
          rules={{ required: true }}
          render={({ field }) => (
            <Select
              value={field.value || ""}
              onValueChange={field.onChange}
              disabled={readOnly}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select depot group…" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.group && <p className="text-xs text-red-600">{errors.group.message}</p>}
      </div>

      {/* SUBGROUP (conditionally rendered) */}
      {subgroupOptions.length > 1 && (
        <div>
          <label className="block text-sm font-medium mb-1">Subgroup</label>
          <Controller
            name="subgroup"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value || ""}
                onValueChange={field.onChange}
                disabled={readOnly || subgroupOptions.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  {subgroupOptions.map((sg) => (
                    <SelectItem key={sg} value={sg}>
                      {sg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

      {/* TANK */}
      <div>
        <label className="block text-sm font-medium mb-1">Tank *</label>
        <Controller
          name="tank"
          control={control}
          rules={{ required: true }}
          render={({ field }) => (
            <Select
              value={field.value || ""}
              onValueChange={field.onChange}
              disabled={readOnly || !watchedGroup}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={watchedGroup ? "Select tank..." : "Choose group first"} />
              </SelectTrigger>
              <SelectContent>
                {tanksForDropdown.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.location} (Safe {typeof t.safe_level === 'number' ? t.safe_level.toLocaleString() : 'N/A'} L)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.tank && <p className="text-xs text-red-600">{errors.tank.message}</p>}
      </div>

      {/* DATE (Advanced Picker) */}
      <div>
        <label className="block text-sm font-medium mb-1">Date *</label>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={"w-full justify-start text-left font-normal" + (errors.date ? " border-red-500" : "")}
              onClick={() => setCalendarOpen(true)}
            >
              {selectedDate && isValidDate(selectedDate)
                ? format(selectedDate, "yyyy-MM-dd")
                : <span className="text-muted-foreground">Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="p-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={date => {
                if (date && !isAfter(date, today)) {
                  setSelectedDate(date);
                  setValue("date", format(date, "yyyy-MM-dd"), { shouldValidate: true, shouldDirty: true, shouldTouch: true });
                  setCalendarOpen(false);
                }
              }}
              disabled={{ after: today }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {errors.date && <p className="text-xs text-red-600">{errors.date.message}</p>}
      </div>

      {/* DIP */}
      <div>
        <label className="block text-sm font-medium mb-1">Dip Reading (litres) *</label>
        <input
          type="number"
          step={1}
          min={0}
          {...register("dip", { required: true, valueAsNumber: true })}
          className={`w-full border rounded px-3 py-2 ${safeFillError ? 'border-red-500' : ''}`}
          disabled={readOnly}
        />
        {errors.dip && <p className="text-xs text-red-600">{errors.dip.message}</p>}
        {safeFillError && (
          <p className="text-xs text-red-600 mt-1 font-medium">
            {safeFillError}
          </p>
        )}
        {overfill && !safeFillError && (
          <p className="text-xs text-orange-600 mt-1">
            Warning: above safe fill ({selectedTank?.safe_level !== undefined && selectedTank?.safe_level !== null ? selectedTank.safe_level.toLocaleString() : 'N/A'} L)
          </p>
        )}
      </div>

      {/* NOTES */}
      <div>
        <label className="block text-sm font-medium mb-1">Notes</label>
        <textarea {...register("notes")} rows={2} className="w-full border rounded px-3 py-2" />
      </div>

      {/* LIVE CARD */}
      {selectedTank && typeof dipValue === "number" && (
        <div className="border rounded p-3 bg-white flex flex-wrap gap-6 shadow-sm text-sm">
          <span>Safe&nbsp;Fill&nbsp;<strong>{selectedTank.safe_level !== undefined && selectedTank.safe_level !== null ? selectedTank.safe_level.toLocaleString() : 'N/A'} L</strong></span>
          <span>Dip&nbsp;<strong>{dipValue !== undefined && dipValue !== null && !isNaN(Number(dipValue)) ? Number(dipValue).toLocaleString() : 'N/A'} L</strong></span>
          <span>Ullage&nbsp;<strong>{ullage !== undefined && ullage !== null && !isNaN(Number(ullage)) ? Number(ullage).toLocaleString() : '-'} L</strong></span>
        </div>
      )}

      {!readOnly && (
        <Button
          type="submit"
          className="w-full bg-green-700 hover:bg-green-800 text-white"
          disabled={loading || !isValid || !!safeFillError}
        >
          {loading ? "Submitting…" : "Submit Dip Reading"}
        </Button>
      )}

      {/* Same-day dip confirmation dialog */}
      <AlertDialog open={showSameDayDialog} onOpenChange={setShowSameDayDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace Existing Dip Reading?</AlertDialogTitle>
            <AlertDialogDescription>
              A dip reading already exists for this tank on {existingSameDayDip?.created_at ? format(new Date(existingSameDayDip.created_at), 'yyyy-MM-dd') : 'this date'}:
              <br />
              <br />
              <strong>Current reading:</strong> {existingSameDayDip?.value?.toLocaleString()} L
              <br />
              <strong>Recorded by:</strong> {existingSameDayDip?.created_by_name || 'Unknown'}
              <br />
              <strong>New reading:</strong> {dipValue?.toLocaleString()} L
              <br />
              <br />
              The previous reading will be archived (not deleted) and your new reading will become the active one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setShowSameDayDialog(false);
                setExistingSameDayDip(null);
                setLoading(false);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const currentFormData = {
                  group: watchedGroup,
                  subgroup: watchedSubgroup || "",
                  tank: watchedTank,
                  date: dateValue,
                  dip: dipValue || 0,
                  notes: watch("notes") || "",
                };
                submitDipReading(currentFormData, true);
              }}
              className="bg-green-700 hover:bg-green-800"
            >
              Replace Reading
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
