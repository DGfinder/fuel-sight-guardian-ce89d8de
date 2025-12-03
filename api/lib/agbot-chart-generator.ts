/**
 * AgBot Chart Generator - Generate chart images for email reports
 * Uses QuickChart API (free, no auth required) to generate charts as images
 */

import type { TankConsumptionData, FleetSummary } from './agbot-email-analytics.js';

const QUICKCHART_API = 'https://quickchart.io/chart';

/**
 * Generate a 7-day consumption trend chart for a single tank
 */
export function generate7DayTrendChartUrl(tankData: TankConsumptionData): string {
  // Generate actual day names for the past 7 days
  const labels = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toLocaleDateString('en-AU', { weekday: 'short' });
  });

  const chartConfig = {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Daily Consumption (L)',
          data: tankData.sparkline_7d,
          borderColor: '#2d7a2e',
          backgroundColor: 'rgba(45, 122, 46, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false,
        },
        title: {
          display: true,
          text: `${tankData.tank_name} - 7 Day Consumption`,
          font: {
            size: 14,
            weight: 'bold',
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Litres',
          },
        },
      },
    },
  };

  const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig));
  return `${QUICKCHART_API}?width=500&height=250&c=${encodedConfig}`;
}

/**
 * Generate a sparkline chart URL (small inline chart)
 */
export function generateSparklineUrl(values: number[], color = '#2d7a2e'): string {
  const chartConfig = {
    type: 'line',
    data: {
      labels: values.map((_, i) => ''),
      datasets: [
        {
          data: values,
          borderColor: color,
          borderWidth: 1.5,
          fill: false,
          pointRadius: 0,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: false },
      },
      scales: {
        x: { display: false },
        y: { display: false },
      },
    },
  };

  const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig));
  return `${QUICKCHART_API}?width=120&height=30&c=${encodedConfig}`;
}

/**
 * Generate a weekly pattern bar chart
 */
export function generateWeeklyPatternChartUrl(
  dailyValues: number[],
  tankName: string
): string {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date().getDay();

  // Rotate to start from current day of week
  const rotatedLabels = [...labels.slice(today - 6), ...labels.slice(0, today - 6)];
  const rotatedValues = [...dailyValues.slice(today - 6), ...dailyValues.slice(0, today - 6)];

  const chartConfig = {
    type: 'bar',
    data: {
      labels: rotatedLabels,
      datasets: [
        {
          label: 'Consumption (L)',
          data: rotatedValues,
          backgroundColor: '#2d7a2e',
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: `${tankName} - Weekly Pattern`,
          font: { size: 14, weight: 'bold' },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Litres',
          },
        },
      },
    },
  };

  const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig));
  return `${QUICKCHART_API}?width=500&height=250&c=${encodedConfig}`;
}

/**
 * Generate fleet consumption comparison chart
 */
export function generateFleetComparisonChartUrl(tanksData: TankConsumptionData[]): string {
  // Sort by consumption and take top 10
  const topTanks = [...tanksData]
    .sort((a, b) => b.consumption_24h_litres - a.consumption_24h_litres)
    .slice(0, 10);

  const labels = topTanks.map((t) => {
    // Truncate long tank names
    const name = t.tank_name;
    return name.length > 20 ? name.substring(0, 17) + '...' : name;
  });

  const values = topTanks.map((t) => t.consumption_24h_litres);

  const chartConfig = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: '24h Consumption (L)',
          data: values,
          backgroundColor: '#2d7a2e',
        },
      ],
    },
    options: {
      indexAxis: 'y', // Horizontal bars
      responsive: true,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Top 10 Tanks by 24h Consumption',
          font: { size: 14, weight: 'bold' },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Litres',
          },
        },
      },
    },
  };

  const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig));
  return `${QUICKCHART_API}?width=500&height=400&c=${encodedConfig}`;
}

/**
 * Generate a simple fuel gauge chart
 */
export function generateFuelGaugeUrl(percentage: number, size = 100): string {
  const color = percentage < 15 ? '#dc2626' : percentage < 30 ? '#d97706' : '#059669';

  const chartConfig = {
    type: 'doughnut',
    data: {
      datasets: [
        {
          data: [percentage, 100 - percentage],
          backgroundColor: [color, '#e5e7eb'],
          borderWidth: 0,
        },
      ],
    },
    options: {
      circumference: 180,
      rotation: 270,
      cutout: '75%',
      plugins: {
        legend: { display: false },
        title: { display: false },
        doughnutlabel: {
          labels: [
            {
              text: `${Math.round(percentage)}%`,
              font: { size: size / 5 },
            },
          ],
        },
      },
    },
  };

  const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig));
  return `${QUICKCHART_API}?width=${size}&height=${size}&c=${encodedConfig}`;
}

/**
 * Generate ASCII sparkline for text emails
 */
export function generateAsciiSparkline(values: number[]): string {
  if (values.length === 0) return '';

  const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  return values
    .map((v) => {
      const normalized = (v - min) / range;
      const index = Math.min(Math.floor(normalized * chars.length), chars.length - 1);
      return chars[index];
    })
    .join('');
}

/**
 * Generate trend indicator emoji/character
 */
export function getTrendEmoji(direction: 'increasing' | 'decreasing' | 'stable'): string {
  switch (direction) {
    case 'increasing':
      return '📈';
    case 'decreasing':
      return '📉';
    case 'stable':
      return '➡️';
  }
}
