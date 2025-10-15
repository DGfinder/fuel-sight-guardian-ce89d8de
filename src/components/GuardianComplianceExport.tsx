import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react';
import { guardianAnalytics, ComplianceMetrics, MonthlyTrend } from '@/services/guardianAnalyticsService';

interface GuardianComplianceExportProps {
  fleet?: 'Stevemacs' | 'Great Southern Fuels';
  dateRange?: { start: string; end: string };
}

const GuardianComplianceExport: React.FC<GuardianComplianceExportProps> = ({ fleet, dateRange }) => {
  const [exporting, setExporting] = useState(false);

  const exportToCSV = async () => {
    try {
      setExporting(true);

      // Fetch all data needed for export
      const [metrics, distractionTrends, fatigueTrends] = await Promise.all([
        guardianAnalytics.getComplianceMetrics(fleet, dateRange),
        guardianAnalytics.getMonthlyTrends('distraction', fleet, dateRange),
        guardianAnalytics.getMonthlyTrends('fatigue', fleet, dateRange),
      ]);

      // Combine trends data
      const monthlyData: Record<string, { month: string; distraction: number; distraction_verified: number; fatigue: number; fatigue_verified: number }> = {};

      distractionTrends.forEach((trend) => {
        if (!monthlyData[trend.month]) {
          monthlyData[trend.month] = {
            month: trend.month,
            distraction: 0,
            distraction_verified: 0,
            fatigue: 0,
            fatigue_verified: 0,
          };
        }
        monthlyData[trend.month].distraction = trend.total;
        monthlyData[trend.month].distraction_verified = trend.verified;
      });

      fatigueTrends.forEach((trend) => {
        if (!monthlyData[trend.month]) {
          monthlyData[trend.month] = {
            month: trend.month,
            distraction: 0,
            distraction_verified: 0,
            fatigue: 0,
            fatigue_verified: 0,
          };
        }
        monthlyData[trend.month].fatigue = trend.total;
        monthlyData[trend.month].fatigue_verified = trend.verified;
      });

      // Convert to array and sort by month
      const rows = Object.values(monthlyData).sort((a, b) => {
        const aDate = new Date(a.month);
        const bDate = new Date(b.month);
        return aDate.getTime() - bDate.getTime();
      });

      // Build CSV content
      let csvContent = 'Month,Total Distraction,Verified Distraction,Total Fatigue,Verified Fatigue,Distraction Verification Rate %,Fatigue Verification Rate %\n';

      rows.forEach((row) => {
        const distractionRate = row.distraction > 0 ? ((row.distraction_verified / row.distraction) * 100).toFixed(1) : '0.0';
        const fatigueRate = row.fatigue > 0 ? ((row.fatigue_verified / row.fatigue) * 100).toFixed(1) : '0.0';

        csvContent += `${row.month},${row.distraction},${row.distraction_verified},${row.fatigue},${row.fatigue_verified},${distractionRate},${fatigueRate}\n`;
      });

      // Add summary section
      csvContent += '\n';
      csvContent += 'SUMMARY\n';
      csvContent += `Fleet,${fleet || 'All Fleets'}\n`;
      csvContent += `Period,${dateRange ? `${new Date(dateRange.start).toLocaleDateString()} - ${new Date(dateRange.end).toLocaleDateString()}` : 'Last 12 Months'}\n`;
      csvContent += `Total Distraction Events,${metrics.distraction.total}\n`;
      csvContent += `Verified Distraction Events,${metrics.distraction.verified}\n`;
      csvContent += `Distraction Verification Rate,${metrics.distraction.verificationRate.toFixed(1)}%\n`;
      csvContent += `Total Fatigue Events,${metrics.fatigue.total}\n`;
      csvContent += `Verified Fatigue Events,${metrics.fatigue.verified}\n`;
      csvContent += `Fatigue Verification Rate,${metrics.fatigue.verificationRate.toFixed(1)}%\n`;
      csvContent += `Fatigue Events (Last 24h),${metrics.fatigue.last24h}\n`;
      csvContent += `Driver Attribution Coverage,${((metrics.distraction.driverAttributionRate + metrics.fatigue.driverAttributionRate) / 2).toFixed(1)}%\n`;

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `guardian-compliance-${fleet || 'all'}-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error('Error exporting to CSV:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = async () => {
    try {
      setExporting(true);

      // For now, show a message that PDF export is coming soon
      // In a full implementation, this would use jsPDF + html2canvas to capture the dashboard
      alert('PDF export is coming soon. Please use CSV export for now.');

    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
          disabled={exporting}
        >
          {exporting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToCSV} className="cursor-pointer">
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToPDF} className="cursor-pointer">
          <FileText className="w-4 h-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default GuardianComplianceExport;
