import React, { useState, useEffect } from 'react';
import { useTaTanksCompat as useTanks } from '@/hooks/useTaTanksCompat';
import AppLayout from '@/components/AppLayout';
import { KPICards } from '@/components/KPICards';
import { TankStatusTable } from '@/components/TankStatusTable';
import { TankDetailsModal } from '@/components/TankDetailsModal';
import { supabase } from '@/lib/supabase';
// NOTE: You must install 'react-chartjs-2' and 'chart.js' for the chart to work.
// import { Line } from 'react-chartjs-2';
// import { Chart, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js';
// Chart.register(LineElement, PointElement, LinearScale, CategoryScale);

const BGC_GROUP_NAME = 'BGC';

export default function BGCPage() {
  const { tanks, isLoading } = useTanks();
  const [selectedTankId, setSelectedTankId] = useState<string | null>(null);
  const [tankDetailsOpen, setTankDetailsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [editDipModalOpen, setEditDipModalOpen] = useState(false);
  const [editDipTank, setEditDipTank] = useState(null);

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

  const bgcTanks = (tanks || []).filter(t => t.group_name === BGC_GROUP_NAME);
  const selectedTank = bgcTanks.find(t => t.id === selectedTankId) || null;

  return (
    <AppLayout selectedGroup={BGC_GROUP_NAME} onGroupSelect={() => {}}>
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-20 py-6 space-y-6">
          {/* Header Section */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">BGC Dashboard</h1>
                <p className="text-gray-600 mt-1">Monitoring {bgcTanks.length} tanks in BGC</p>
              </div>
            </div>
            <div className="mt-6">
              <KPICards tanks={bgcTanks} onCardClick={() => {}} selectedFilter={null} />
            </div>
          </div>

          {/* Tank Status Section */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 shadow-sm">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900">Tank Status</h2>
            </div>
            <div className="overflow-x-auto">
              <TankStatusTable
                tanks={bgcTanks}
                onTankClick={tank => {
                  setSelectedTankId(tank.id);
                  setTankDetailsOpen(true);
                }}
                setEditDipTank={setEditDipTank}
                setEditDipModalOpen={setEditDipModalOpen}
              />
            </div>
          </div>

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