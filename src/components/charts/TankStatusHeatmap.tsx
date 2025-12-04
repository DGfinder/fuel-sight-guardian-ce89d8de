import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';

interface HeatmapDataPoint {
  tankId: string;
  tankName: string;
  location: string;
  fuelLevel: number;
  status: 'critical' | 'low' | 'normal' | 'unknown';
  lastUpdated: Date;
  daysToEmpty?: number;
}

interface TankStatusHeatmapProps {
  data: HeatmapDataPoint[];
  width?: number;
  height?: number;
  className?: string;
  cellSize?: number;
  animated?: boolean;
}

export function TankStatusHeatmap({
  data,
  width = 800,
  height = 400,
  className = '',
  cellSize = 60,
  animated = true
}: TankStatusHeatmapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedCell, setSelectedCell] = useState<HeatmapDataPoint | null>(null);

  useEffect(() => {
    if (!data.length || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Group data by location
    const locationGroups = d3.group(data, d => d.location);
    const locations = Array.from(locationGroups.keys());
    
    const margin = { top: 40, right: 200, bottom: 40, left: 150 };
    const cellPadding = 2;
    
    // Calculate layout
    const maxTanksPerLocation = Math.max(...Array.from(locationGroups.values()).map(tanks => tanks.length));
    const totalWidth = maxTanksPerLocation * (cellSize + cellPadding) + margin.left + margin.right;
    const totalHeight = locations.length * (cellSize + cellPadding) + margin.top + margin.bottom;

    // Update SVG dimensions
    svg.attr('width', Math.max(width, totalWidth))
       .attr('height', Math.max(height, totalHeight));

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Color scale based on fuel level
    const colorScale = d3.scaleSequential(d3.interpolateRdYlGn)
      .domain([0, 100]);

    // Status-based color override
    const statusColors = {
      critical: '#ef4444',
      low: '#f59e0b', 
      normal: '#10b981',
      unknown: '#6b7280'
    };

    // Create cells for each tank
    locations.forEach((location, locationIndex) => {
      const tanks = locationGroups.get(location) || [];
      
      // Location label
      g.append('text')
        .attr('x', -10)
        .attr('y', locationIndex * (cellSize + cellPadding) + cellSize / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '14px')
        .attr('font-weight', '600')
        .attr('fill', '#374151')
        .text(location);

      // Tank cells
      tanks.forEach((tank, tankIndex) => {
        const x = tankIndex * (cellSize + cellPadding);
        const y = locationIndex * (cellSize + cellPadding);

        // Cell background
        const cell = g.append('rect')
          .attr('x', x)
          .attr('y', y)
          .attr('width', cellSize)
          .attr('height', cellSize)
          .attr('rx', 8)
          .attr('fill', tank.status === 'unknown' ? statusColors.unknown : colorScale(tank.fuelLevel))
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 2)
          .attr('opacity', animated ? 0 : 1)
          .style('cursor', 'pointer')
          .on('mouseover', function(event, d) {
            setSelectedCell(tank);
            d3.select(this)
              .transition()
              .duration(150)
              .attr('stroke-width', 3)
              .attr('stroke', '#1f2937');
          })
          .on('mouseout', function() {
            setSelectedCell(null);
            d3.select(this)
              .transition()
              .duration(150)
              .attr('stroke-width', 2)
              .attr('stroke', '#ffffff');
          });

        if (animated) {
          cell
            .transition()
            .duration(800)
            .delay(locationIndex * 100 + tankIndex * 50)
            .attr('opacity', 1);
        }

        // Status indicator (small circle in top-right)
        g.append('circle')
          .attr('cx', x + cellSize - 8)
          .attr('cy', y + 8)
          .attr('r', 4)
          .attr('fill', statusColors[tank.status])
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1)
          .attr('opacity', animated ? 0 : 1);

        if (animated) {
          g.select(`circle:nth-child(${(locationIndex * tanks.length + tankIndex + 1) * 2})`)
            .transition()
            .duration(500)
            .delay(locationIndex * 100 + tankIndex * 50 + 400)
            .attr('opacity', 1);
        }

        // Fuel level text
        g.append('text')
          .attr('x', x + cellSize / 2)
          .attr('y', y + cellSize / 2 - 5)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', '16px')
          .attr('font-weight', 'bold')
          .attr('fill', tank.fuelLevel < 50 ? '#ffffff' : '#1f2937')
          .attr('opacity', animated ? 0 : 1)
          .text(`${tank.fuelLevel.toFixed(0)}%`);

        // Tank name (smaller text below percentage)
        g.append('text')
          .attr('x', x + cellSize / 2)
          .attr('y', y + cellSize / 2 + 12)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', '10px')
          .attr('fill', tank.fuelLevel < 50 ? '#ffffff' : '#6b7280')
          .attr('opacity', animated ? 0 : 1)
          .text(tank.tankName.slice(0, 8) + (tank.tankName.length > 8 ? '...' : ''));

        if (animated) {
          g.selectAll(`text:nth-child(${(locationIndex * tanks.length + tankIndex + 1) * 2 + 1}), text:nth-child(${(locationIndex * tanks.length + tankIndex + 1) * 2 + 2})`)
            .transition()
            .duration(500)
            .delay(locationIndex * 100 + tankIndex * 50 + 600)
            .attr('opacity', 1);
        }
      });
    });

    // Legend
    const legendG = g.append('g')
      .attr('transform', `translate(${maxTanksPerLocation * (cellSize + cellPadding) + 20}, 0)`);

    // Fuel level legend
    const legendHeight = 200;
    const legendWidth = 20;
    const legendSteps = 20;

    const legendScale = d3.scaleLinear()
      .domain([0, 100])
      .range([legendHeight, 0]);

    // Create gradient
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'fuel-gradient')
      .attr('x1', 0)
      .attr('y1', 1)
      .attr('x2', 0)
      .attr('y2', 0);

    gradient.selectAll('stop')
      .data(d3.range(0, 101, 5))
      .enter()
      .append('stop')
      .attr('offset', d => `${d}%`)
      .attr('stop-color', d => colorScale(d));

    // Legend rectangle
    legendG.append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .attr('fill', 'url(#fuel-gradient)')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 1);

    // Legend axis
    const legendAxis = d3.axisRight(legendScale)
      .tickSize(5)
      .tickFormat(d => `${d}%`);

    legendG.append('g')
      .attr('transform', `translate(${legendWidth}, 0)`)
      .call(legendAxis);

    // Legend title
    legendG.append('text')
      .attr('x', legendWidth / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('fill', '#374151')
      .text('Fuel Level');

    // Status legend
    const statusLegendG = legendG.append('g')
      .attr('transform', `translate(0, ${legendHeight + 40})`);

    statusLegendG.append('text')
      .attr('x', 0)
      .attr('y', -10)
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('fill', '#374151')
      .text('Status');

    Object.entries(statusColors).forEach(([status, color], index) => {
      const statusY = index * 20;
      
      statusLegendG.append('circle')
        .attr('cx', 8)
        .attr('cy', statusY + 8)
        .attr('r', 6)
        .attr('fill', color);

      statusLegendG.append('text')
        .attr('x', 20)
        .attr('y', statusY + 8)
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '11px')
        .attr('fill', '#374151')
        .text(status.charAt(0).toUpperCase() + status.slice(1));
    });

  }, [data, width, height, cellSize, animated]);

  return (
    <div className={`relative ${className}`}>
      <motion.svg
        ref={svgRef}
        className="overflow-visible"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      />
      
      {selectedCell && (
        <motion.div
          className="absolute bg-white border border-gray-200 rounded-lg shadow-lg p-4 pointer-events-none z-10"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          style={{
            left: '50%',
            top: '20px',
            transform: 'translateX(-50%)',
          }}
        >
          <div className="text-sm font-semibold text-gray-900 mb-2">
            {selectedCell.tankName}
          </div>
          <div className="text-xs text-gray-600 space-y-1">
            <div>Location: {selectedCell.location}</div>
            <div>Fuel Level: {selectedCell.fuelLevel.toFixed(1)}%</div>
            <div>Status: <span className={`font-medium ${
              selectedCell.status === 'critical' ? 'text-red-600' :
              selectedCell.status === 'low' ? 'text-amber-600' :
              selectedCell.status === 'normal' ? 'text-green-600' :
              'text-gray-600'
            }`}>{selectedCell.status}</span></div>
            {selectedCell.daysToEmpty && (
              <div>Days to Empty: {selectedCell.daysToEmpty.toFixed(1)}</div>
            )}
            <div>Last Updated: {selectedCell.lastUpdated.toLocaleString()}</div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Real-time tank monitoring component
interface RealtimeTankMonitorProps {
  tanks: HeatmapDataPoint[];
  className?: string;
  refreshInterval?: number;
}

export function RealtimeTankMonitor({
  tanks,
  className = '',
  refreshInterval = 30000
}: RealtimeTankMonitorProps) {
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  const criticalTanks = tanks.filter(t => t.status === 'critical').length;
  const lowTanks = tanks.filter(t => t.status === 'low').length;
  const normalTanks = tanks.filter(t => t.status === 'normal').length;

  return (
    <motion.div
      className={`bg-white rounded-lg border p-6 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Real-time Tank Status</h3>
        <div className="text-xs text-gray-500">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="text-center">
          <motion.div 
            className="text-2xl font-bold text-gray-900"
            key={tanks.length}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            {tanks.length}
          </motion.div>
          <div className="text-xs text-gray-600">Total Tanks</div>
        </div>
        <div className="text-center">
          <motion.div 
            className="text-2xl font-bold text-red-600"
            key={criticalTanks}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            {criticalTanks}
          </motion.div>
          <div className="text-xs text-gray-600">Critical</div>
        </div>
        <div className="text-center">
          <motion.div 
            className="text-2xl font-bold text-amber-600"
            key={lowTanks}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            {lowTanks}
          </motion.div>
          <div className="text-xs text-gray-600">Low</div>
        </div>
        <div className="text-center">
          <motion.div 
            className="text-2xl font-bold text-green-600"
            key={normalTanks}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            {normalTanks}
          </motion.div>
          <div className="text-xs text-gray-600">Normal</div>
        </div>
      </div>

      <TankStatusHeatmap 
        data={tanks}
        width={600}
        height={300}
        cellSize={40}
        animated={false}
      />
    </motion.div>
  );
}