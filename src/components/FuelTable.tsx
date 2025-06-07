import React, { useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Card, CardContent, CardHeader, CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, Clock, Droplets, Filter, TrendingDown,
  TrendingUp, CheckCircle, Loader2
} from "lucide-react";
import { Tank } from "@/types/fuel";
import { cn } from "@/lib/utils";

interface FuelTableProps {
  tanks?: Tank[];
  onTankClick?: (tank: Tank) => void;
}

function TankStatusBadge({ level, daysToEmpty }: { level: number; daysToEmpty: number }) {
  if (level <= 10) return <Badge variant="destructive">Critical</Badge>;
  if (level <= 20) return <Badge variant="secondary">Low</Badge>;
  if (daysToEmpty <= 7) return <Badge variant="secondary">Low Days</Badge>;
  return <Badge variant="default">Normal</Badge>;
}

export function FuelTable({ tanks = [], onTankClick }: FuelTableProps) {
  if (!tanks?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No tanks found
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Group</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Current Level</TableHead>
            <TableHead className="text-right">% Full</TableHead>
            <TableHead className="text-right">Days to Empty</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tanks.map((tank) => (
            <TableRow
              key={tank.id}
              className={cn(
                "cursor-pointer hover:bg-muted/50",
                onTankClick && "cursor-pointer"
              )}
              onClick={() => onTankClick?.(tank)}
            >
              <TableCell>{tank.tank_groups?.name || tank.group_id}</TableCell>
              <TableCell>{tank.location}</TableCell>
              <TableCell>{tank.product_type}</TableCell>
              <TableCell>
                <TankStatusBadge
                  level={tank.current_level_percent}
                  daysToEmpty={tank.days_to_min_level ?? 0}
                />
              </TableCell>
              <TableCell className="text-right">
                <strong>{tank.current_level.toLocaleString()} L</strong>
                <span className="text-xs text-muted-foreground"> of {tank.safe_level.toLocaleString()} L</span>
              </TableCell>
              <TableCell className="text-right">
                {tank.current_level_percent}%
              </TableCell>
              <TableCell className="text-right">{tank.days_to_min_level ?? 'N/A'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
