import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
  ChartData,
} from 'chart.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkeletonChart } from '@/components/ui/skeleton';
import { TrendingUp, Activity, Timer } from 'lucide-react';
import { AgbotHistoricalReading } from '@/hooks/useAgbotReadingHistory';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface AgbotReadingChartsProps {
  readings: AgbotHistoricalReading[];
  isLoading?: boolean;
  showLitres?: boolean;
  maxReadings?: number; // Optional limit - if not set, shows all readings
  capacity?: number; // Tank capacity for percentage calculation when API returns 0
}

export function AgbotReadingCharts({ readings, isLoading, showLitres = true, maxReadings, capacity }: AgbotReadingChartsProps) {
  // Sort readings chronologically
  const sortedReadings = useMemo(() => {
    return [...readings].sort(
      (a, b) => new Date(a.reading_timestamp).getTime() - new Date(b.reading_timestamp).getTime()
    );
  }, [readings]);

  // Get readings for charts - use maxReadings limit if provided, otherwise show all
  const chartReadings = useMemo(() => {
    if (maxReadings && sortedReadings.length > maxReadings) {
      return sortedReadings.slice(-maxReadings);
    }
    return sortedReadings;
  }, [sortedReadings, maxReadings]);

  // Keep last30Readings as alias for backward compatibility
  const last30Readings = chartReadings;

  // Helper to get effective percentage - calculates from litres if API returns 0
  const getEffectivePercentage = (r: AgbotHistoricalReading): number => {
    // If we have a valid calibrated percentage, use it
    if (r.calibrated_fill_percentage > 0) {
      return r.calibrated_fill_percentage;
    }
    // If API returned 0 but we have litres and capacity, calculate percentage
    if (r.asset_reported_litres && capacity && capacity > 0) {
      return (r.asset_reported_litres / capacity) * 100;
    }
    return r.calibrated_fill_percentage;
  };

  // Fuel level chart data
  const fuelLevelChartData: ChartData<'line'> = useMemo(() => {
    const datasets: any[] = [
      {
        label: 'Fuel Level (%)',
        data: last30Readings.length > 0
          ? last30Readings.map(r => getEffectivePercentage(r))
          : [0],
        borderColor: '#3b82f6', // blue-500
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointBorderWidth: 2,
        pointHoverRadius: 6,
        yAxisID: 'y',
      },
    ];

    // Add litres line if enabled and data available
    if (showLitres && last30Readings.some(r => r.asset_reported_litres !== null)) {
      datasets.push({
        label: 'Volume (L)',
        data: last30Readings.length > 0
          ? last30Readings.map(r => r.asset_reported_litres || 0)
          : [0],
        borderColor: '#10b981', // green-500
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
        pointBorderWidth: 2,
        pointHoverRadius: 6,
        yAxisID: 'y1',
      });
    }

    // Add critical level reference line at 20%
    datasets.push({
      label: 'Critical Level',
      data: Array(last30Readings.length || 1).fill(20),
      borderColor: '#dc2626', // red-600
      backgroundColor: 'rgba(220, 38, 38, 0.2)',
      borderWidth: 3,
      borderDash: [5, 5],
      pointRadius: 0,
      fill: false,
      tension: 0,
      pointHoverRadius: 0,
      pointHitRadius: 0,
      yAxisID: 'y',
    });

    return {
      labels: last30Readings.length > 0
        ? last30Readings.map(r => {
            try {
              return format(new Date(r.reading_timestamp), 'MMM d');
            } catch (e) {
              return 'Invalid Date';
            }
          })
        : ['No Data'],
      datasets,
    };
  }, [last30Readings, showLitres, capacity]);

  const fuelLevelChartOptions: ChartOptions<'line'> = useMemo(() => {
    const options: ChartOptions<'line'> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
          labels: {
            usePointStyle: true,
            font: { size: 12, weight: 'bold' },
            padding: 20,
          },
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          cornerRadius: 8,
          padding: 12,
          callbacks: {
            title: function(tooltipItems) {
              // Get the full timestamp from the reading
              const index = tooltipItems[0]?.dataIndex;
              if (index !== undefined && last30Readings[index]?.reading_timestamp) {
                return format(new Date(last30Readings[index].reading_timestamp), 'MMM d, yyyy h:mm a');
              }
              return tooltipItems[0]?.label || '';
            }
          }
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Date',
            font: { size: 12, weight: 'bold' },
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)',
          },
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Percentage (%)',
            font: { size: 12, weight: 'bold' },
          },
          beginAtZero: true,
          max: 100,
          grid: {
            color: 'rgba(0, 0, 0, 0.1)',
          },
        },
      },
      interaction: {
        intersect: false,
        mode: 'index',
      },
    };

    // Add second y-axis if showing litres
    if (showLitres && last30Readings.some(r => r.asset_reported_litres !== null)) {
      options.scales!.y1 = {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Volume (L)',
          font: { size: 12, weight: 'bold' },
        },
        beginAtZero: true,
        grid: {
          drawOnChartArea: false,
        },
      };
    }

    return options;
  }, [showLitres, last30Readings]);

  // Daily consumption chart data
  const consumptionChartData: ChartData<'line'> = useMemo(() => {
    const readingsWithConsumption = last30Readings.filter(r => r.daily_consumption !== null);

    return {
      labels: readingsWithConsumption.length > 0
        ? readingsWithConsumption.map(r => {
            try {
              return format(new Date(r.reading_timestamp), 'MMM d');
            } catch (e) {
              return 'Invalid Date';
            }
          })
        : ['No Data'],
      datasets: [
        {
          label: 'Daily Consumption (%/day)',
          data: readingsWithConsumption.length > 0
            ? readingsWithConsumption.map(r => r.daily_consumption!)
            : [0],
          borderColor: '#f59e0b', // amber-500
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          fill: true,
          tension: 0.4,
          pointBorderWidth: 2,
          pointHoverRadius: 6,
        },
      ],
    };
  }, [last30Readings]);

  const consumptionChartOptions: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          font: { size: 12, weight: 'bold' },
          padding: 20,
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        cornerRadius: 8,
        padding: 12,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y.toFixed(2) + '%/day';
            }
            return label;
          }
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Date',
          font: { size: 12, weight: 'bold' },
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Consumption (%/day)',
          font: { size: 12, weight: 'bold' },
        },
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
  }), []);

  // Days remaining chart data
  const daysRemainingChartData: ChartData<'line'> = useMemo(() => {
    const readingsWithDays = last30Readings.filter(r => r.days_remaining !== null && r.days_remaining > 0);

    return {
      labels: readingsWithDays.length > 0
        ? readingsWithDays.map(r => {
            try {
              return format(new Date(r.reading_timestamp), 'MMM d');
            } catch (e) {
              return 'Invalid Date';
            }
          })
        : ['No Data'],
      datasets: [
        {
          label: 'Days Until Empty',
          data: readingsWithDays.length > 0
            ? readingsWithDays.map(r => r.days_remaining!)
            : [0],
          borderColor: '#8b5cf6', // violet-500
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          fill: true,
          tension: 0.4,
          pointBorderWidth: 2,
          pointHoverRadius: 6,
        },
        // Add 7-day warning line
        {
          label: '7 Day Warning',
          data: Array(readingsWithDays.length || 1).fill(7),
          borderColor: '#f97316', // orange-500
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          tension: 0,
        },
      ],
    };
  }, [last30Readings]);

  const daysRemainingChartOptions: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          font: { size: 12, weight: 'bold' },
          padding: 20,
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        cornerRadius: 8,
        padding: 12,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += Math.round(context.parsed.y) + ' days';
            }
            return label;
          }
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Date',
          font: { size: 12, weight: 'bold' },
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Days',
          font: { size: 12, weight: 'bold' },
        },
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
  }), []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Fuel Level Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SkeletonChart />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (readings.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No Data Available</p>
        <p className="text-sm">Historical data will appear here when available.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Fuel Level Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Fuel Level Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <Line data={fuelLevelChartData} options={fuelLevelChartOptions} />
          </div>
        </CardContent>
      </Card>

      {/* Consumption Chart */}
      {last30Readings.some(r => r.daily_consumption !== null) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-600" />
              Daily Consumption Pattern
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <Line data={consumptionChartData} options={consumptionChartOptions} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Days Remaining Chart */}
      {last30Readings.some(r => r.days_remaining !== null && r.days_remaining > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-violet-600" />
              Days Until Empty Projection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <Line data={daysRemainingChartData} options={daysRemainingChartOptions} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
