
import React, { useState, useMemo } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Card, CardContent, CardHeader, CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger
} from "@/components/ui/collapsible";
import {
  ChevronDown, ChevronRight, Droplets, AlertTriangle, Clock
} from "lucide-react";
import { Tank } from "@/types/fuel";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface FuelTableProps {
  tanks?: Tank[];
  onTankClick?: (tank: Tank) => void;
}

function TankStatusBadge({ level, daysToEmpty }: { level: number; daysToEmpty: number }) {
  if (level <= 10) return <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">Critical</Badge>;
  if (level <= 20) return <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">Low</Badge>;
  if (daysToEmpty <= 7) return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">Low Days</Badge>;
  return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">Normal</Badge>;
}

function GroupSection({ groupName, tanks, onTankClick }: { 
  groupName: string; 
  tanks: Tank[]; 
  onTankClick?: (tank: Tank) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  
  const criticalCount = tanks.filter(t => t.current_level_percent <= 10).length;
  const lowCount = tanks.filter(t => t.current_level_percent <= 20 && t.current_level_percent > 10).length;
  
  return (
    <Card className="mb-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <CardTitle className="text-lg font-semibold">{groupName}</CardTitle>
                <Badge variant="outline" className="ml-2">
                  {tanks.length} tank{tanks.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {criticalCount > 0 && (
                  <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">
                    {criticalCount} Critical
                  </Badge>
                )}
                {lowCount > 0 && (
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                    {lowCount} Low
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Current Level</TableHead>
                    <TableHead className="text-right">% Full</TableHead>
                    <TableHead className="text-right">Days to Empty</TableHead>
                    <TableHead className="text-right">Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tanks.map((tank) => (
                    <TableRow
                      key={tank.id}
                      className={cn(
                        "cursor-pointer hover:bg-muted/50 transition-colors",
                        tank.current_level_percent <= 10 && "bg-red-50 hover:bg-red-100",
                        tank.current_level_percent <= 20 && tank.current_level_percent > 10 && "bg-orange-50 hover:bg-orange-100"
                      )}
                      onClick={() => onTankClick?.(tank)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Droplets className="h-4 w-4 text-primary" />
                          <span className="font-medium">{tank.location}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {tank.product_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <TankStatusBadge
                          level={tank.current_level_percent}
                          daysToEmpty={tank.days_to_min_level ?? 0}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-lg">
                            {tank.current_level.toLocaleString()} L
                          </span>
                          <span className="text-xs text-muted-foreground">
                            of {tank.safe_level.toLocaleString()} L
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-lg">
                            {tank.current_level_percent}%
                          </span>
                          <div className="w-16 h-2 bg-gray-200 rounded-full mt-1">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all",
                                tank.current_level_percent <= 10 ? "bg-red-500" :
                                tank.current_level_percent <= 20 ? "bg-orange-500" :
                                tank.current_level_percent <= 30 ? "bg-yellow-500" : "bg-green-500"
                              )}
                              style={{ width: `${Math.max(tank.current_level_percent, 2)}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium">
                          {tank.days_to_min_level ?? 'N/A'}
                          {tank.days_to_min_level && ' days'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {tank.last_dip_date ? format(new Date(tank.last_dip_date), 'MMM d, HH:mm') : 'No data'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export function FuelTable({ tanks = [], onTankClick }: FuelTableProps) {
  const groupedTanks = useMemo(() => {
    if (!tanks?.length) return {};
    
    return tanks.reduce((groups, tank) => {
      const groupName = tank.tank_groups?.name || tank.group_id || 'Unknown Group';
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(tank);
      return groups;
    }, {} as Record<string, Tank[]>);
  }, [tanks]);

  if (!tanks?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Droplets className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Tanks Found</h3>
          <p className="text-muted-foreground text-center">
            No fuel tanks are available for your current access level.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(groupedTanks).map(([groupName, groupTanks]) => (
        <GroupSection
          key={groupName}
          groupName={groupName}
          tanks={groupTanks}
          onTankClick={onTankClick}
        />
      ))}
    </div>
  );
}
