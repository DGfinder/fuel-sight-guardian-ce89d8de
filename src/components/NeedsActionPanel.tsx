import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, MapPin, Brain, ChevronDown, ChevronRight } from 'lucide-react';
import type { Tank } from '@/types/fuel';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

function getUrgency(tank: Tank) {
  if (tank.days_to_min_level !== null && tank.days_to_min_level <= 2) {
    return { color: 'bg-red-500', label: 'Critical', action: 'Schedule Delivery' };
  }
  if (tank.current_level_percent <= 20) {
    return { color: 'bg-orange-500', label: 'Watchlist', action: 'Watch Usage' };
  }
  return { color: 'bg-green-500', label: 'OK', action: 'Monitor' };
}

export function NeedsActionPanel({ tanks }: { tanks: Tank[] }) {
  const needsAction = tanks.filter(
    t => !!t.last_dip_ts && ((t.days_to_min_level !== null && t.days_to_min_level <= 2) || t.current_level_percent <= 0.2)
  );
  const [open, setOpen] = useState(needsAction.length <= 8);
  if (!needsAction.length) return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-6">
      <CollapsibleTrigger asChild>
        <div className="flex items-center gap-2 mb-2 cursor-pointer select-none">
          <AlertTriangle className="text-red-500" />
          <span className="font-bold text-lg">Needs Action</span>
          <span className="ml-2 text-sm font-medium text-gray-600">({needsAction.length} tank{needsAction.length !== 1 ? 's' : ''})</span>
          {open ? <ChevronDown className="ml-1 w-4 h-4" /> : <ChevronRight className="ml-1 w-4 h-4" />}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {needsAction.map(tank => {
            const urgency = getUrgency(tank);
            return (
              <div key={tank.id} className="flex items-center gap-4 p-3 rounded-lg bg-white shadow border">
                <div className={`w-2 h-10 rounded-full ${urgency.color}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span className="font-semibold text-gray-900">{tank.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm mt-1">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span>{tank.days_to_min_level ?? 'N/A'} days to min</span>
                    <Badge className={`ml-2 ${urgency.color} text-white`}>{urgency.label}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs mt-1">
                    <Brain className="w-3 h-3 text-blue-500" />
                    <span className="font-medium">{urgency.action}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
} 