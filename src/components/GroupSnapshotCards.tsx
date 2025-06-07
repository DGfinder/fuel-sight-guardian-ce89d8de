import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Droplets } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GroupSnapshot } from '@/types/fuel';

interface GroupSnapshotCardsProps {
  groups: GroupSnapshot[];
  onGroupClick: (groupId: string) => void;
  selectedGroup: string | null;
}

export function GroupSnapshotCards({ groups, onGroupClick, selectedGroup }: GroupSnapshotCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {groups.map((group) => (
        <Card
          key={group.id}
          className={cn(
            "cursor-pointer transition-colors hover:bg-gray-50",
            selectedGroup === group.id && "ring-2 ring-primary"
          )}
          onClick={() => onGroupClick(group.id)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{group.name}</CardTitle>
            <Droplets className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Total Tanks</p>
                <p className="text-2xl font-bold">{group.totalTanks}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Critical Tanks</p>
                <p className="text-2xl font-bold text-fuel-critical">{group.criticalTanks}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Level</p>
                <p className="text-2xl font-bold">{group.averageLevel}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Updated</p>
                <p className="text-sm font-medium">
                  {new Date(group.lastUpdated).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
