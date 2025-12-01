import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface DataPoint {
  date: Date;
  consumption: number;
  level: number;
  tankId: string;
  tankName: string;
}

interface FuelConsumptionChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  className?: string;
  animated?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
}

export function FuelConsumptionChart({
  data,
  width = 800,
  height = 400,
  className = '',
  animated = true,
  showGrid = true,
  showTooltip = true
}: FuelConsumptionChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null);
  const { shouldReduceMotion } = useReducedMotion();

  // Disable animations on mobile/slow networks for better performance
  const effectiveAnimated = animated && !shouldReduceMotion;

  useEffect(() => {
    if (!data.length || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 80, bottom: 40, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create main group
    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(data, d => d.date) as [Date, Date])
      .range([0, innerWidth]);

    const yScaleConsumption = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.consumption) || 0])
      .nice()
      .range([innerHeight, 0]);

    const yScaleLevel = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.level) || 100])
      .nice()
      .range([innerHeight, 0]);

    // Color scale for different tanks
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10)
      .domain([...new Set(data.map(d => d.tankId))]);

    // Grid lines
    if (showGrid) {
      // Vertical grid lines
      g.selectAll('.grid-line-vertical')
        .data(xScale.ticks())
        .enter()
        .append('line')
        .attr('class', 'grid-line-vertical')
        .attr('x1', d => xScale(d))
        .attr('x2', d => xScale(d))
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', '#e5e7eb')
        .attr('stroke-width', 0.5)
        .attr('opacity', 0.5);

      // Horizontal grid lines
      g.selectAll('.grid-line-horizontal')
        .data(yScaleConsumption.ticks())
        .enter()
        .append('line')
        .attr('class', 'grid-line-horizontal')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', d => yScaleConsumption(d))
        .attr('y2', d => yScaleConsumption(d))
        .attr('stroke', '#e5e7eb')
        .attr('stroke-width', 0.5)
        .attr('opacity', 0.5);
    }

    // Line generators
    const consumptionLine = d3.line<DataPoint>()
      .x(d => xScale(d.date))
      .y(d => yScaleConsumption(d.consumption))
      .curve(d3.curveMonotoneX);

    const levelLine = d3.line<DataPoint>()
      .x(d => xScale(d.date))
      .y(d => yScaleLevel(d.level))
      .curve(d3.curveMonotoneX);

    // Group data by tank
    const tankGroups = d3.group(data, d => d.tankId);

    // Draw consumption lines
    tankGroups.forEach((tankData, tankId) => {
      const path = g.append('path')
        .datum(tankData)
        .attr('fill', 'none')
        .attr('stroke', colorScale(tankId))
        .attr('stroke-width', 2)
        .attr('opacity', 0.8)
        .attr('d', consumptionLine);

      if (effectiveAnimated) {
        const totalLength = path.node()?.getTotalLength() || 0;
        path
          .attr('stroke-dasharray', totalLength + ' ' + totalLength)
          .attr('stroke-dashoffset', totalLength)
          .transition()
          .duration(1000) // Reduced from 2000ms for better performance
          .ease(d3.easeQuadInOut)
          .attr('stroke-dashoffset', 0);
      }
    });

    // Draw data points
    const circles = g.selectAll('.data-point')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'data-point')
      .attr('cx', d => xScale(d.date))
      .attr('cy', d => yScaleConsumption(d.consumption))
      .attr('r', effectiveAnimated ? 0 : 4)
      .attr('fill', d => colorScale(d.tankId))
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        if (showTooltip) {
          setHoveredPoint(d);
          d3.select(this)
            .transition()
            .duration(150)
            .attr('r', 6);
        }
      })
      .on('mouseout', function() {
        if (showTooltip) {
          setHoveredPoint(null);
          d3.select(this)
            .transition()
            .duration(150)
            .attr('r', 4);
        }
      });

    if (effectiveAnimated) {
      circles
        .transition()
        .duration(800) // Reduced from 2000ms
        .delay((d, i) => i * 20) // Reduced stagger from 50ms to 20ms
        .attr('r', 4);
    }

    // Axes
    const xAxis = d3.axisBottom(xScale)
      .tickFormat(d3.timeFormat('%m/%d'));

    const yAxisLeft = d3.axisLeft(yScaleConsumption)
      .tickFormat(d => `${d}L`);

    const yAxisRight = d3.axisRight(yScaleLevel)
      .tickFormat(d => `${d}%`);

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll('text')
      .style('font-size', '12px');

    g.append('g')
      .call(yAxisLeft)
      .selectAll('text')
      .style('font-size', '12px');

    g.append('g')
      .attr('transform', `translate(${innerWidth},0)`)
      .call(yAxisRight)
      .selectAll('text')
      .style('font-size', '12px');

    // Axis labels
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left + 20)
      .attr('x', 0 - (innerHeight / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('fill', '#374151')
      .text('Daily Consumption (L)');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', innerWidth + margin.right - 20)
      .attr('x', 0 - (innerHeight / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('fill', '#374151')
      .text('Fuel Level (%)');

    g.append('text')
      .attr('transform', `translate(${innerWidth / 2}, ${innerHeight + margin.bottom - 5})`)
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('fill', '#374151')
      .text('Date');

  }, [data, width, height, effectiveAnimated, showGrid]);

  return (
    <div className={`relative ${className}`}>
      <motion.svg
        ref={svgRef}
        width={width}
        height={height}
        initial={shouldReduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: shouldReduceMotion ? 0.1 : 0.5 }}
        className="overflow-visible"
      />

      {showTooltip && hoveredPoint && (
        <motion.div
          ref={tooltipRef}
          className="absolute bg-white border border-gray-200 rounded-lg shadow-lg p-3 pointer-events-none z-10"
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
          style={{
            left: `${width / 2}px`,
            top: `${height / 4}px`,
          }}
        >
          <div className="text-sm font-medium text-gray-900">
            {hoveredPoint.tankName}
          </div>
          <div className="text-xs text-gray-600">
            Date: {hoveredPoint.date.toLocaleDateString()}
          </div>
          <div className="text-xs text-gray-600">
            Consumption: {hoveredPoint.consumption.toLocaleString()} L
          </div>
          <div className="text-xs text-gray-600">
            Level: {hoveredPoint.level.toFixed(1)}%
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Tank level gauge component
interface TankGaugeProps {
  level: number;
  capacity: number;
  tankName: string;
  status: 'critical' | 'low' | 'normal';
  size?: number;
  animated?: boolean;
}

export function TankGauge({
  level,
  capacity,
  tankName,
  status,
  size = 200,
  animated = true
}: TankGaugeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { shouldReduceMotion } = useReducedMotion();
  const effectiveAnimated = animated && !shouldReduceMotion;

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = (size - 40) / 2;

    // Background circle
    svg.append('circle')
      .attr('cx', centerX)
      .attr('cy', centerY)
      .attr('r', radius)
      .attr('fill', '#f3f4f6')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 2);

    // Fuel level calculation
    const percentage = Math.min((level / capacity) * 100, 100);
    const angle = (percentage / 100) * 2 * Math.PI - Math.PI / 2;

    // Color based on status
    const colors = {
      critical: '#ef4444',
      low: '#f59e0b',
      normal: '#10b981'
    };

    // Create arc generator
    const arc = d3.arc()
      .innerRadius(radius - 20)
      .outerRadius(radius)
      .startAngle(-Math.PI / 2)
      .endAngle(angle);

    const path = svg.append('path')
      .attr('d', arc({ innerRadius: radius - 20, outerRadius: radius, startAngle: -Math.PI / 2, endAngle: angle }))
      .attr('transform', `translate(${centerX},${centerY})`)
      .attr('fill', colors[status]);

    if (effectiveAnimated) {
      const arcTween = (newAngle: number) => {
        return () => {
          const interpolate = d3.interpolate(-Math.PI / 2, newAngle);
          return (t: number) => {
            const currentAngle = interpolate(t);
            return d3.arc()({
              innerRadius: radius - 20,
              outerRadius: radius,
              startAngle: -Math.PI / 2,
              endAngle: currentAngle
            });
          };
        };
      };

      path
        .transition()
        .duration(800) // Reduced from 1500ms
        .ease(d3.easeQuadOut)
        .attrTween('d', arcTween(angle));
    }

    // Center text
    svg.append('text')
      .attr('x', centerX)
      .attr('y', centerY - 10)
      .attr('text-anchor', 'middle')
      .attr('font-size', '24px')
      .attr('font-weight', 'bold')
      .attr('fill', '#1f2937')
      .text(`${percentage.toFixed(1)}%`);

    svg.append('text')
      .attr('x', centerX)
      .attr('y', centerY + 15)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#6b7280')
      .text(tankName);

  }, [level, capacity, status, size, effectiveAnimated]);

  return (
    <motion.div
      className="relative"
      initial={shouldReduceMotion ? false : { scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: shouldReduceMotion ? 0.1 : 0.5 }}
    >
      <svg
        ref={svgRef}
        width={size}
        height={size}
        className="drop-shadow-sm"
      />
    </motion.div>
  );
}