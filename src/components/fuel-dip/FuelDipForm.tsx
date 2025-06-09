import * as React from "react";
import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
  CommandGroup,
  CommandSeparator,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';

const schema = z.object({
  group: z.string().min(1, 'Select a depot group'),
  subgroup: z.string().optional(),
  tank: z.string().min(1, 'Select a tank'),
  date: z.string().min(1, 'Date required'),
  dip: z.number().positive('Enter a positive number'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type TankGroup = { id: string; name: string };
type Tank = {
  id: string;
  location: string;
  group_id: string;
  subgroup: string | null;
  safe_level: number;
  current_level: number;
  current_level_percent: number;
  min_level?: number;
};

type DipReading = { value: number; created_at: string };

const LOCALSTORAGE_KEY = 'fuel-dip-form-last-used';

interface FuelDipFormProps {
  initialDepot?: string;
  initialSubgroup?: string;
  initialTank?: string;
  readOnly?: boolean;
}

export function FuelDipForm({ initialDepot, initialSubgroup, initialTank, readOnly = false }: FuelDipFormProps) {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<TankGroup[]>([]);
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [filteredTanks, setFilteredTanks] = useState<Tank[]>([]);
  const [tankLoading, setTankLoading] = useState(false);
  const [groupLoading, setGroupLoading] = useState(false);
  const [recentDips, setRecentDips] = useState<DipReading[]>([]);
  const [submitAndAddAnother, setSubmitAndAddAnother] = useState(false);
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
    },
  });
  const [tankDropdownOpen, setTankDropdownOpen] = useState(false);
  const [tankSearch, setTankSearch] = useState('');
  const [user, setUser] = useState(null);

  // Persist last-used values (unless initial values are provided)
  useEffect(() => {
    if (initialDepot && initialSubgroup && initialTank) {
      setValue('group', initialDepot);
      setValue('subgroup', initialSubgroup);
      setValue('tank', initialTank);
    } else {
      const last = localStorage.getItem(LOCALSTORAGE_KEY);
      if (last) {
         const { group, subgroup, tank } = JSON.parse(last);
         if (group) setValue('group', group);
         if (subgroup) setValue('subgroup', subgroup);
         if (tank) setValue('tank', tank);
      }
    }
  }, [setValue, initialDepot, initialSubgroup, initialTank]);

  // Persist (if not in readOnly mode) on change
  useEffect(() => {
    if (!readOnly) {
      const group = watch('group');
      const subgroup = watch('subgroup');
      const tank = watch('tank');
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify({ group, subgroup, tank }));
    }
  }, [watch('group'), watch('subgroup'), watch('tank'), readOnly]);

  // Fetch groups (if not provided, fetch from supabase)
  useEffect(() => {
    if (initialDepot) {
      setGroups([{ id: initialDepot, name: initialDepot }]);
    } else {
      setGroupLoading(true);
      supabase.from('tank_groups').select('id, name').then(({ data }) => {
         if (data) setGroups(data);
         setGroupLoading(false);
      });
    }
  }, [initialDepot]);

  // Fetch tanks (if not provided, fetch from supabase)
  useEffect(() => {
    if (initialTank) {
      const tank = tanks.find(t => t.id === initialTank);
      if (tank) {
         setTanks([tank]);
         setFilteredTanks([tank]);
      } else {
         setTankLoading(true);
         supabase.from('fuel_tanks').select('id, location, group_id, safe_level, current_level').then(({ data, error }) => {
            if (!error && Array.isArray(data)) {
               const validTanks = data
                 .filter((t): t is { id: string; location: string; group_id: string; safe_level: number; current_level: number } => 
                   t != null && 
                   typeof t === 'object' &&
                   typeof (t as any).id === 'string' &&
                   typeof (t as any).location === 'string' &&
                   typeof (t as any).group_id === 'string' &&
                   typeof (t as any).safe_level === 'number' &&
                   typeof (t as any).current_level === 'number'
                 )
                 .map(t => ({
                   id: t.id,
                   location: t.location,
                   group_id: t.group_id,
                   subgroup: null,
                   safe_level: t.safe_level,
                   current_level: t.current_level,
                   current_level_percent: Math.round((t.current_level / t.safe_level) * 100)
                 }));
               setTanks(validTanks);
               if (initialTank) {
                  const tank = validTanks.find(t => t.id === initialTank);
                  if (tank) setFilteredTanks([tank]);
               }
            } else {
               setTanks([]);
            }
            setTankLoading(false);
         });
      }
    } else {
      setTankLoading(true);
      supabase.from('fuel_tanks').select('id, location, group_id, safe_level, current_level').then(({ data, error }) => {
         if (!error && Array.isArray(data)) {
            const validTanks = data
              .filter((t): t is { id: string; location: string; group_id: string; safe_level: number; current_level: number } => 
                t != null && 
                typeof t === 'object' &&
                typeof (t as any).id === 'string' &&
                typeof (t as any).location === 'string' &&
                typeof (t as any).group_id === 'string' &&
                typeof (t as any).safe_level === 'number' &&
                typeof (t as any).current_level === 'number'
              )
              .map(t => ({
                id: t.id,
                location: t.location,
                group_id: t.group_id,
                subgroup: null,
                safe_level: t.safe_level,
                current_level: t.current_level,
                current_level_percent: Math.round((t.current_level / t.safe_level) * 100)
              }));
            setTanks(validTanks);
         } else {
            setTanks([]);
         }
         setTankLoading(false);
      });
    }
  }, [initialTank, tanks]);

  // Filter tanks by group (unless in readOnly mode)
  const selectedGroup = watch('group');
  const selectedSubgroup = watch('subgroup');
  useEffect(() => {
    if (readOnly) return;
    if (selectedGroup) {
       setFilteredTanks(tanks.filter(t => t.group_id === selectedGroup));
       if (!initialSubgroup) setValue('subgroup', '');
       if (!initialTank) setValue('tank', '');
    } else {
       setFilteredTanks([]);
       if (!initialSubgroup) setValue('subgroup', '');
       if (!initialTank) setValue('tank', '');
    }
  }, [selectedGroup, tanks, setValue, readOnly, initialSubgroup, initialTank]);

  // Extract unique subgroups from filtered tanks (unless in readOnly mode)
  const subgroups = useMemo(() => {
    if (readOnly) {
      return initialSubgroup ? [initialSubgroup] : [];
    }
    return Array.from(new Set(filteredTanks.map(t => t.subgroup).filter(Boolean)));
  }, [filteredTanks, readOnly, initialSubgroup]);

  // Tanks to show in dropdown (unless in readOnly mode)
  const tanksForDropdown = useMemo(() => {
    if (readOnly) {
       if (initialTank) {
         const tank = tanks.find(t => t.id === initialTank);
         return tank ? [tank] : [];
       }
       return [];
    }
    if (subgroups.length > 0) {
       if (selectedSubgroup) {
         return filteredTanks.filter(t => t.subgroup === selectedSubgroup);
       }
       return [];
    }
    return filteredTanks;
  }, [filteredTanks, subgroups, selectedSubgroup, readOnly, initialTank, tanks]);

  // Fetch last 7 dips for selected tank (if not in readOnly mode)
  const selectedTankId = watch('tank');
  const selectedTank = tanks.find(t => t.id === selectedTankId);
  useEffect(() => {
    if (readOnly) return;
    if (selectedTankId) {
       supabase.from('dip_readings').select('value, created_at').eq('tank_id', selectedTankId).order('created_at', { ascending: false }).limit(7).then(({ data }) => {
         setRecentDips(data || []);
       });
    } else {
       setRecentDips([]);
    }
  }, [selectedTankId, readOnly]);

  // Overfill warning (if not in readOnly mode)
  const dipValue = watch('dip');
  const overfill = (readOnly ? false : (selectedTank && dipValue && dipValue > selectedTank.safe_level));

  // Live ullage preview (if not in readOnly mode)
  const ullage = (readOnly
    ? null
    : (selectedTank && typeof selectedTank.safe_level === 'number' && typeof dipValue === 'number' && !isNaN(dipValue)
        ? Math.max(0, selectedTank.safe_level - dipValue)
        : null));
  const percentFull = (readOnly ? null : (selectedTank && dipValue ? Math.round((dipValue / selectedTank.safe_level) * 100) : null));

  // Submission guard (if not in readOnly mode)
  const canSubmit = (readOnly ? (!!initialTank && dipValue > 0) : (isValid && selectedGroup && (!subgroups.length || selectedSubgroup) && selectedTankId && dipValue > 0));

  // Handle submit (if not in readOnly mode)
  const onSubmit = async (data: FormData) => {
    if (readOnly) return;
    setLoading(true);
    const tank = tanks.find(t => t.id === data.tank);
    const { error } = await supabase.from('dip_readings').insert({ tank_id: data.tank, value: data.dip, created_at: data.date, recorded_by: user?.email || 'unknown', notes: data.notes || null });
    setLoading(false);
    if (error) {
       toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
       toast({ title: 'Success', description: `Dip for ${tank?.location || 'tank'} submitted!`, variant: 'default' });
       if (submitAndAddAnother) {
         reset({ group: data.group, subgroup: data.subgroup, tank: data.tank, date: new Date().toISOString().slice(0, 10), dip: undefined, notes: '' });
       } else {
         reset();
       }
    }
  };

  // (Optional) Auto-select group if user has access to only one group (unless in readOnly mode)
  const userGroups = groups; // (Replace with user-specific group access if available)
  useEffect(() => {
    if (readOnly) return;
    if (userGroups.length === 1) {
       setValue('group', userGroups[0].id);
    }
  }, [userGroups, setValue, readOnly]);

  // (Optional) Conditional Subgroup & Tank Selection (unless in readOnly mode)
  const showSubgroup = (readOnly ? (!!initialSubgroup) : (selectedGroup && subgroups.length > 1));

  // (Optional) Fuel Insights Card (Post-Dip) (unless in readOnly mode)
  const showFuelInsight = !!selectedTank && !!dipValue;
  const minLevel = (readOnly ? null : (selectedTank?.min_level ?? null));
  let badge = null;
  if (minLevel !== null && dipValue > 0) {
    if (dipValue > minLevel) badge = <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs font-semibold ml-2">✅ Above Min Level</span>;
    else if (dipValue === minLevel) badge = <span className="inline-flex items-center px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs font-semibold ml-2">⚠️ Near Min Level</span>;
    else badge = <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-100 text-red-800 text-xs font-semibold ml-2">🔴 Below Min Level</span>;
  }

  // (Optional) Fetch user session (if not in readOnly mode)
  useEffect(() => {
    if (readOnly) return;
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user || null);
    };
    getSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => { listener?.subscription.unsubscribe(); };
  }, [readOnly]);

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-lg w-full mx-auto flex flex-col gap-y-4 p-0 overflow-y-auto opacity-100"
      aria-label="Add Fuel Dip Reading Form"
      tabIndex={0}
    >
      {/* Depot Group Dropdown */}
      <div>
        <label htmlFor="group" className="block text-sm font-medium mb-1">Depot Group <span className="text-red-500">*</span></label>
        <select
          id="group"
          aria-label="Depot Group"
          className="w-full border rounded-md shadow-sm px-3 py-2 focus:ring focus:ring-blue-500 focus:border-blue-500"
          {...register('group', { required: true })}
          value={selectedGroup || ''}
          onChange={e => setValue('group', e.target.value)}
          disabled={readOnly}
        >
          <option value="">Select depot group...</option>
          {groups.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        {errors.group && <span className="text-xs text-red-500">{errors.group.message}</span>}
      </div>

      {/* Subgroup Dropdown (only if group selected and more than one subgroup) */}
      {showSubgroup && (
        <div>
          <label htmlFor="subgroup" className="block text-sm font-medium mb-1">Select Subgroup</label>
          {subgroups.length > 10 ? (
            <Command>
              <CommandInput placeholder="Search subgroups..." disabled={readOnly} />
              <CommandList>
                {subgroups.map(sg => (
                  <CommandItem key={sg} onSelect={() => setValue('subgroup', sg)} disabled={readOnly}>
                    {sg}
                  </CommandItem>
                ))}
                <CommandEmpty>No subgroups found.</CommandEmpty>
              </CommandList>
            </Command>
          ) : (
            <select
              id="subgroup"
              aria-label="Subgroup"
              className="w-full border rounded-md shadow-sm px-3 py-2 focus:ring focus:ring-blue-500 focus:border-blue-500"
              {...register('subgroup')}
              value={selectedSubgroup || ''}
              onChange={e => setValue('subgroup', e.target.value)}
              disabled={readOnly}
            >
              <option value="">Select subgroup...</option>
              {subgroups.map(sg => (
                <option key={sg} value={sg}>{sg}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Tank Dropdown (filtered by subgroup if present) */}
      <div>
        <label htmlFor="tank" className="block text-sm font-medium mb-1">Tank <span className="text-red-500">*</span></label>
        {tanksForDropdown.length > 10 ? (
          <Command>
            <CommandInput
              placeholder="Search tanks..."
              value={selectedTank ? selectedTank.location : tankSearch}
              onValueChange={setTankSearch}
              aria-label="Tank"
              disabled={readOnly}
            />
            <CommandList>
              {tanksForDropdown.map(t => (
                <CommandItem key={t.id} onSelect={() => { setValue('tank', t.id); setTankSearch(''); }} disabled={readOnly}>
                  <span className="flex flex-col">
                    <span>{t.location}</span>
                    <span className="text-xs text-gray-500">Safe: {t.safe_level.toLocaleString()} L</span>
                  </span>
                </CommandItem>
              ))}
              <CommandEmpty>No tanks found.</CommandEmpty>
            </CommandList>
          </Command>
        ) : (
          <select
            id="tank"
            aria-label="Tank"
            className="w-full border rounded-md shadow-sm px-3 py-2 focus:ring focus:ring-blue-500 focus:border-blue-500"
            {...register('tank', { required: true })}
            value={selectedTankId || ''}
            onChange={e => setValue('tank', e.target.value)}
            disabled={readOnly}
          >
            <option value="">Select tank...</option>
            {tanksForDropdown.map(t => (
              <option key={t.id} value={t.id}>
                {t.location} (Safe: {t.safe_level.toLocaleString()} L)
              </option>
            ))}
          </select>
        )}
        {errors.tank && <span className="text-xs text-red-500">{errors.tank.message}</span>}
      </div>

      {/* Date of Dip */}
      <div>
        <label htmlFor="date" className="block text-sm font-medium mb-1">Date of Dip <span className="text-red-500">*</span></label>
        <input
          id="date"
          type="date"
          aria-label="Date of Dip"
          className="w-full border rounded-md shadow-sm px-3 py-2 focus:ring focus:ring-blue-500 focus:border-blue-500"
          {...register('date', { required: true })}
        />
        {errors.date && <span className="text-xs text-red-500">{errors.date.message}</span>}
      </div>

      {/* Dip Reading */}
      <div>
        <label htmlFor="dip" className="block text-sm font-medium mb-1">Dip Reading (litres) <span className="text-red-500">*</span></label>
        <input
          id="dip"
          type="number"
          min={0}
          step={1}
          aria-label="Dip Reading (litres)"
          className="w-full border rounded-md shadow-sm px-3 py-2 focus:ring focus:ring-blue-500 focus:border-blue-500"
          {...register('dip', { required: true, valueAsNumber: true })}
        />
        {errors.dip && <span className="text-xs text-red-500">{errors.dip.message}</span>}
        {overfill && (
          <span className="text-xs text-orange-600">Warning: this reading exceeds the tank's safe fill level ({selectedTank?.safe_level.toLocaleString()} L).</span>
        )}
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium mb-1">Notes</label>
        <textarea
          id="notes"
          aria-label="Notes"
          className="w-full border rounded-md shadow-sm px-3 py-2 focus:ring focus:ring-blue-500 focus:border-blue-500"
          {...register('notes')}
          rows={2}
        />
      </div>

      {/* Fuel Insights Card (Post-Dip) (if not in readOnly mode) */}
      {showFuelInsight && (
        <div className="border rounded-md p-3 mt-4 bg-white flex flex-wrap gap-6 items-center justify-between shadow-sm transition-all duration-300 ease-in-out opacity-100">
          <div className="flex flex-col items-center">
            <span className="text-xs text-gray-500">Safe Fill</span>
            <span className="font-bold text-green-700 text-lg">{selectedTank.safe_level.toLocaleString()} L</span>
          </div>
          {minLevel !== null && (
            <div className="flex flex-col items-center">
              <span className="text-xs text-gray-500">Min Level</span>
              <span className="font-bold text-yellow-700 text-lg">{minLevel.toLocaleString()} L</span>
            </div>
          )}
          <div className="flex flex-col items-center">
            <span className="text-xs text-gray-500">Dip (L)</span>
            <span className="font-bold text-blue-700 text-lg">{dipValue.toLocaleString()} L</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs text-gray-500">Ullage</span>
            <span className="font-bold text-yellow-900 text-lg">{dipValue && ullage !== null && !isNaN(ullage) ? ullage.toLocaleString() + ' L' : 'N/A'}</span>
          </div>
          {badge}
        </div>
      )}

      {/* Submit Button (if not in readOnly mode) */}
      {!readOnly && (
        <Button
          type="submit"
          className="w-full bg-[#008457] hover:bg-[#006b47] text-white font-bold text-base rounded-md shadow-sm py-2 mt-2 transition-all"
          disabled={!canSubmit || loading}
          aria-label="Submit Dip Reading"
        >
          {loading ? 'Submitting...' : 'Submit Dip Reading'}
        </Button>
      )}
    </form>
  );
} 