import React, { useState, useEffect } from 'react';
import { useTanks } from '@/hooks/useTanks';
import AppLayout from '@/components/AppLayout';
import { KPICards } from '@/components/KPICards';
import { FuelTable } from '@/components/FuelTable';
import { TankDetailsModal } from '@/components/TankDetailsModal';
import { supabase } from '@/lib/supabase';
// NOTE: You must install 'react-chartjs-2' and 'chart.js' for the chart to work.
// import { Line } from 'react-chartjs-2';
// import { Chart, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js';
// Chart.register(LineElement, PointElement, LinearScale, CategoryScale);

const GERALDTON_GROUP_NAME = 'Geraldton';

export default function GeraldtonPage() {
  const { tanks, isLoading } = useTanks();
  const [selectedTankId, setSelectedTankId] = useState<string | null>(null);
  const [tankDetailsOpen, setTankDetailsOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user || null);
    };
    getSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  // Filter tanks to only Geraldton
  const geraldtonTanks = (tanks || []).filter(t => t.group_name === GERALDTON_GROUP_NAME);
  const selectedTank = geraldtonTanks.find(t => t.id === selectedTankId) || null;

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
    <AppLayout selectedGroup={GERALDTON_GROUP_NAME} onGroupSelect={() => {}}>
      <div className="min-h-screen w-full bg-muted">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-20">
          <div className="space-y-6 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Geraldton Dashboard</h1>
                <p className="text-gray-600 mt-1">Monitoring {geraldtonTanks.length} tanks in Geraldton</p>
              </div>
            </div>
            <KPICards tanks={geraldtonTanks} onCardClick={() => {}} selectedFilter={null} />
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Tank Status</h2>
            </div>
            <FuelTable
              tanks={geraldtonTanks}
              onTankClick={tank => {
                setSelectedTankId(tank.id);
                setTankDetailsOpen(true);
              }}
              defaultOpenGroup="Geraldton"
            />

            {/* Tank Details Modal */}
            <TankDetailsModal
              tank={selectedTank}
              open={tankDetailsOpen}
              onOpenChange={setTankDetailsOpen}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
} 