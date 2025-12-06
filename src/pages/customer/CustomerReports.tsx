import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCustomerTanks, useCustomerAccount } from '@/hooks/useCustomerAuth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { KPICard } from '@/components/ui/KPICard';
import { Download, FileText, BarChart3, Fuel, Wifi, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { staggerContainerVariants, fadeUpItemVariants } from '@/lib/motion-variants';

export default function CustomerReports() {
  const { data: customerAccount } = useCustomerAccount();
  const { data: tanks, isLoading } = useCustomerTanks();
  const [selectedTank, setSelectedTank] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'7' | '30' | '90' | 'custom'>('30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Calculate date range
  const { start, end } = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end = now;

    if (dateRange === 'custom' && startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      const days = parseInt(dateRange) || 30;
      start = new Date(now);
      start.setDate(start.getDate() - days);
    }

    return { start, end };
  }, [dateRange, startDate, endDate]);

  // Filter tanks for report
  const reportTanks = useMemo(() => {
    if (selectedTank === 'all') return tanks || [];
    return (tanks || []).filter((t) => t.id === selectedTank);
  }, [tanks, selectedTank]);

  const handleExportCSV = () => {
    if (!reportTanks.length) {
      toast.error('No data to export');
      return;
    }

    const headers = [
      'Tank ID',
      'Location',
      'Address',
      'Current Level (%)',
      'Days Remaining',
      'Daily Consumption (L)',
      'Capacity (L)',
      'Device Status',
    ];

    const rows = reportTanks.map((tank) => [
      tank.location_id || '',
      tank.address1 || '',
      [tank.address1, tank.state].filter(Boolean).join(', '),
      (tank.latest_calibrated_fill_percentage || 0).toFixed(1),
      tank.asset_days_remaining?.toFixed(0) || 'N/A',
      tank.asset_daily_consumption?.toFixed(0) || 'N/A',
      tank.asset_profile_water_capacity?.toLocaleString() || 'N/A',
      tank.device_online ? 'Online' : 'Offline',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadFile(csv, `tank-report-${formatDateForFilename(new Date())}.csv`, 'text/csv');
    toast.success('CSV report downloaded');
  };

  const handleExportPDF = () => {
    // For now, create a simple printable HTML report
    const reportHtml = generatePrintableReport(
      customerAccount,
      reportTanks,
      start,
      end
    );

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(reportHtml);
      printWindow.document.close();
      printWindow.print();
    }
    toast.success('Print dialog opened');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Generate and download tank consumption reports
        </p>
      </div>

      {/* Report Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Report Settings</CardTitle>
          <CardDescription>Configure your report parameters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tank Selection */}
            <div>
              <Label>Tank</Label>
              <Select value={selectedTank} onValueChange={setSelectedTank}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select tank..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tanks</SelectItem>
                  {(tanks || []).map((tank) => (
                    <SelectItem key={tank.id} value={tank.id}>
                      {tank.location_id || tank.address1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div>
              <Label>Date Range</Label>
              <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Range */}
            {dateRange === 'custom' && (
              <>
                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Export Actions */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <Button onClick={handleExportCSV} variant="outline" className="gap-2">
              <Download size={16} />
              Download CSV
            </Button>
            <Button onClick={handleExportPDF} variant="outline" className="gap-2">
              <FileText size={16} />
              Print / PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 size={20} />
            Report Preview
          </CardTitle>
          <CardDescription>
            {selectedTank === 'all'
              ? `All ${reportTanks.length} tanks`
              : reportTanks[0]?.location_id || 'Selected tank'}{' '}
            | {start.toLocaleDateString()} - {end.toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reportTanks.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No tanks to display</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tank</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Level</TableHead>
                    <TableHead className="text-right">Days Remaining</TableHead>
                    <TableHead className="text-right">Daily Usage</TableHead>
                    <TableHead className="text-right">Capacity</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportTanks.map((tank) => (
                    <TableRow key={tank.id}>
                      <TableCell className="font-medium">
                        {tank.location_id || 'N/A'}
                      </TableCell>
                      <TableCell>{tank.address1}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            'font-medium',
                            (tank.latest_calibrated_fill_percentage || 0) < 15
                              ? 'text-red-600'
                              : (tank.latest_calibrated_fill_percentage || 0) < 25
                              ? 'text-yellow-600'
                              : 'text-green-600'
                          )}
                        >
                          {(tank.latest_calibrated_fill_percentage || 0).toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {tank.asset_days_remaining
                          ? `${Math.round(tank.asset_days_remaining)} days`
                          : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        {tank.asset_daily_consumption
                          ? `${tank.asset_daily_consumption.toFixed(0)}L`
                          : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        {tank.asset_profile_water_capacity
                          ? `${tank.asset_profile_water_capacity.toLocaleString()}L`
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                            tank.device_online
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          )}
                        >
                          {tank.device_online ? 'Online' : 'Offline'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {reportTanks.length > 0 && (
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
          initial="hidden"
          animate="visible"
          variants={staggerContainerVariants}
        >
          <motion.div variants={fadeUpItemVariants}>
            <KPICard
              title="Total Tanks"
              value={reportTanks.length}
              icon={Fuel}
              color="blue"
              trend="neutral"
            />
          </motion.div>
          <motion.div variants={fadeUpItemVariants}>
            <KPICard
              title="Average Level"
              value={`${(reportTanks.reduce((sum, t) => sum + (t.latest_calibrated_fill_percentage || 0), 0) / reportTanks.length).toFixed(1)}%`}
              icon={Fuel}
              color="green"
              trend="neutral"
            />
          </motion.div>
          <motion.div variants={fadeUpItemVariants}>
            <KPICard
              title="Online Devices"
              value={reportTanks.filter((t) => t.device_online).length}
              subtitle={`of ${reportTanks.length}`}
              icon={Wifi}
              color={reportTanks.filter((t) => t.device_online).length === reportTanks.length ? 'green' : 'yellow'}
              trend="neutral"
            />
          </motion.div>
          <motion.div variants={fadeUpItemVariants}>
            <KPICard
              title="Avg Days Remaining"
              value={
                reportTanks.some((t) => t.asset_days_remaining)
                  ? Math.round(
                      reportTanks.filter((t) => t.asset_days_remaining).reduce((sum, t) => sum + (t.asset_days_remaining || 0), 0) /
                      reportTanks.filter((t) => t.asset_days_remaining).length
                    )
                  : 'N/A'
              }
              subtitle={reportTanks.some((t) => t.asset_days_remaining) ? 'days' : ''}
              icon={Clock}
              color="blue"
              trend="neutral"
            />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDateForFilename(date: Date): string {
  return date.toISOString().split('T')[0];
}

function generatePrintableReport(
  customer: any,
  tanks: any[],
  start: Date,
  end: Date
): string {
  const rows = tanks
    .map(
      (tank) => `
      <tr>
        <td>${tank.location_id || 'N/A'}</td>
        <td>${tank.address1 || ''}</td>
        <td style="text-align: right;">${(tank.latest_calibrated_fill_percentage || 0).toFixed(1)}%</td>
        <td style="text-align: right;">${tank.asset_days_remaining ? Math.round(tank.asset_days_remaining) + ' days' : 'N/A'}</td>
        <td style="text-align: right;">${tank.asset_daily_consumption ? tank.asset_daily_consumption.toFixed(0) + 'L' : 'N/A'}</td>
        <td>${tank.device_online ? 'Online' : 'Offline'}</td>
      </tr>
    `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Tank Report - ${customer?.customer_name || 'Customer'}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #1a1a1a; }
        .header { margin-bottom: 30px; }
        .date-range { color: #666; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f5f5f5; font-weight: bold; }
        .footer { margin-top: 30px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Tank Status Report</h1>
        <p><strong>${customer?.customer_name || 'Customer'}</strong></p>
        <p class="date-range">Report Period: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}</p>
        <p>Generated: ${new Date().toLocaleString()}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th>Tank ID</th>
            <th>Location</th>
            <th style="text-align: right;">Level</th>
            <th style="text-align: right;">Days Remaining</th>
            <th style="text-align: right;">Daily Usage</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="footer">
        <p>Report generated by TankAlert - Great Southern Fuels</p>
      </div>
    </body>
    </html>
  `;
}
