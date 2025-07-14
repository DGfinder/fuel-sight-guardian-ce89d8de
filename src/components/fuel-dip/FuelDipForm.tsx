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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { isAfter } from "date-fns/isAfter";
import { isValid as isValidDate } from "date-fns/isValid";
import { parseISO } from "date-fns/parseISO";

//--------------------------------------------------
// Schema & types
//--------------------------------------------------
import { schemas } from "@/lib/validation";

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
    formState: { errors, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
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

  // Add to FuelDipForm component state:
  const [calendarOpen, setCalendarOpen] = useState(false);
  const today = new Date();
  const dateValue = watch("date");
  const [selectedDate, setSelectedDate] = useState(() => dateValue ? parseISO(dateValue) : new Date());
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
  // Submit handler
  //------------------------------------------------
  const onSubmit = async (data: FormData) => {
    if (readOnly) return;
    setLoading(true);
    const { error } = await supabase.from("dip_readings").insert({
      tank_id: data.tank,
      value: data.dip,
      created_at: data.date,
      recorded_by: user?.id ?? "unknown",
      notes: data.notes ?? null,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Success", description: "Dip submitted" });
    reset();
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

  //------------------------------------------------
  // Render
  //------------------------------------------------
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 w-full max-w-lg">
      {/* DEPOT GROUP */}
      <div>
        <label className="block text-sm font-medium mb-1">Depot Group *</label>
        <select
          {...register("group", { required: true })}
          className="w-full border rounded px-3 py-2 bg-white text-gray-900"
          disabled={readOnly}
        >
          <option value="">Select depot group…</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        {errors.group && <p className="text-xs text-red-600">{errors.group.message}</p>}
      </div>

      {/* SUBGROUP (conditionally rendered) */}
      {subgroupOptions.length > 1 && (
        <div>
          <label className="block text-sm font-medium mb-1">Subgroup</label>
          <select
            {...register("subgroup")}
            className="w-full border rounded px-3 py-2 bg-white text-gray-900"
            disabled={readOnly || subgroupOptions.length === 0}
          >
            <option value="">All</option>
            {subgroupOptions.map((sg) => (
              <option key={sg} value={sg}>
                {sg}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* TANK */}
      <div>
        <label className="block text-sm font-medium mb-1">Tank *</label>
        <select
          {...register("tank", { required: true })}
          className="w-full border rounded px-3 py-2 bg-white text-gray-900"
          disabled={readOnly || !watchedGroup}
        >
          <option value="">{watchedGroup ? "Select tank..." : "Choose group first"}</option>
          {tanksForDropdown.map((t) => (
            <option key={t.id} value={t.id}>
              {t.location} (Safe {typeof t.safe_level === 'number' ? t.safe_level.toLocaleString() : 'N/A'} L)
            </option>
          ))}
        </select>
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
          className="w-full border rounded px-3 py-2"
          disabled={readOnly}
        />
        {errors.dip && <p className="text-xs text-red-600">{errors.dip.message}</p>}
        {overfill && (
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
          disabled={loading || !isValid}
        >
          {loading ? "Submitting…" : "Submit Dip Reading"}
        </Button>
      )}
    </form>
  );
}
