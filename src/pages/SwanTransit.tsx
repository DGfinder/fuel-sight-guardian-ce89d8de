import React, { useState, useEffect } from 'react';
import { useTanks } from '@/hooks/useTanks';
import AppLayout from '@/components/AppLayout';
import { KPICards } from '@/components/KPICards';
import { TankStatusTable } from '@/components/TankStatusTable';
import { TankDetailsModal } from '@/components/TankDetailsModal';
import { supabase } from '@/lib/supabase';
// NOTE: You must install 'react-chartjs-2' and 'chart.js' for the chart to work.
// import { Line } from 'react-chartjs-2';
// import { Chart, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js';
// Chart.register(LineElement, PointElement, LinearScale, CategoryScale);

const SWAN_TRANSIT_GROUP_NAME = 'Swan Transit';

export default function SwanTransitPage() {
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

  // Filter tanks to only Swan Transit
  const swanTanks = (tanks || []).filter(t => t.group_name === SWAN_TRANSIT_GROUP_NAME);
  const selectedTank = swanTanks.find(t => t.id === selectedTankId) || null;

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
    <AppLayout selectedGroup={SWAN_TRANSIT_GROUP_NAME} onGroupSelect={() => {}}>
      <div className="min-h-screen w-full bg-muted">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-20">
          <section className="pt-4 pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Swan Transit Dashboard</h1>
                <p className="text-gray-600 mt-1 break-words max-w-full">Monitoring {swanTanks.length} tanks in Swan Transit</p>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <div className="flex gap-4 flex-nowrap w-full">
                <KPICards tanks={swanTanks} onCardClick={() => {}} selectedFilter={null} />
              </div>
            </div>
          </section>
          <section className="pt-2 pb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Tank Status</h2>
            </div>
            <div className="overflow-x-auto">
              <TankStatusTable
                tanks={swanTanks}
                onTankClick={tank => {
                  setSelectedTankId(tank.id);
                  setTankDetailsOpen(true);
                }}
              />
            </div>
          </section>

          {/* Tank Details Modal */}
          <TankDetailsModal
            tank={selectedTank}
            open={tankDetailsOpen}
            onOpenChange={setTankDetailsOpen}
          />
        </div>
      </div>
    </AppLayout>
  );
} 