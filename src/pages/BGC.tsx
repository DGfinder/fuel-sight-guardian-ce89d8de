import React, { useState } from 'react';
import { useTanks } from '@/hooks/useTanks';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { KPICards } from '@/components/KPICards';
import { FuelTable } from '@/components/FuelTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, PlusCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
// NOTE: You must install 'react-chartjs-2' and 'chart.js' for the chart to work.
// import { Line } from 'react-chartjs-2';
// import { Chart, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js';
// Chart.register(LineElement, PointElement, LinearScale, CategoryScale);

const BGC_GROUP_NAME = 'BGC';

export default function BGCPage() {
  const { tanks, isLoading } = useTanks();
  const { user } = useAuth();
  const [selectedTankId, setSelectedTankId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Filter tanks to only BGC
  const bgcTanks = (tanks || []).filter(t => t.group_name === BGC_GROUP_NAME);
  const selectedTank = bgcTanks.find(t => t.id === selectedTankId) || null;

  // Mock chart data for 30-day trend
  const chartData = {
    labels: Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`),
    datasets: [
      {
        label: 'Fuel Level (L)',
        data: Array.from({ length: 30 }, () => Math.floor(Math.random() * 30000) + 10000),
        borderColor: '#008457',
        backgroundColor: 'rgba(0,132,87,0.1)',
        tension: 0.3,
      },
    ],
  };

  return (
    <AppLayout selectedGroup={BGC_GROUP_NAME} onGroupSelect={() => {}}>
      <div className="space-y-6 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">BGC Dashboard</h1>
            <p className="text-gray-600 mt-1">Monitoring {bgcTanks.length} tanks in BGC</p>
          </div>
        </div>
        <KPICards tanks={bgcTanks} onCardClick={() => {}} selectedFilter={null} />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Tank Status</h2>
        </div>
        <FuelTable
          tanks={bgcTanks}
          onTankClick={tank => {
            setSelectedTankId(tank.id);
            setModalOpen(true);
          }}
          defaultOpenGroup="BGC"
        />
        {/* Tank Insights Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Tank Insights</DialogTitle>
            </DialogHeader>
            {selectedTank && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg">{selectedTank.location}</span>
                  <Badge>{selectedTank.product_type}</Badge>
                </div>
                <div className="h-40">
                  {/* If chart lib is not installed, show a placeholder */}
                  {/* <Line data={chartData} options={{ plugins: { legend: { display: false } } }} /> */}
                  <div className="flex items-center justify-center h-full text-gray-400">[Install chart.js for trend graph]</div>
                </div>
                <div className="flex flex-col gap-1 text-sm">
                  <div>Rolling Avg Usage: <span className="font-bold">{selectedTank.rolling_avg ?? 'N/A'} L/day</span></div>
                  <div>Safe Fill: <span className="font-bold">{selectedTank.safe_level.toLocaleString()} L</span></div>
                  <div>Current Dip: <span className="font-bold">{selectedTank.current_level.toLocaleString()} L</span></div>
                  <div>Ullage: <span className="font-bold">{(selectedTank.safe_level - selectedTank.current_level).toLocaleString()} L</span></div>
                </div>
                {/* Mock active alerts */}
                <div className="flex items-center gap-2">
                  <Bell className="text-red-500" />
                  <span className="text-red-700 font-medium">No active alerts</span>
                </div>
                <Button className="w-full bg-[#008457] text-white hover:bg-green-700"
                  onClick={() => {/* Link to Add Dip with prefill */}}>
                  <PlusCircle className="w-4 h-4 mr-2 inline" /> Add Dip Reading
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
} 