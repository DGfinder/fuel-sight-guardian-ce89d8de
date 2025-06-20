import React, { useState, useEffect } from 'react';
import { useTanks } from '@/hooks/useTanks';
import AppLayout from '@/components/AppLayout';
import { KPICards } from '@/components/KPICards';
import { TankStatusTable } from '@/components/TankStatusTable';
import { TankDetailsModal } from '@/components/TankDetailsModal';
import EditDipModal from '@/components/modals/EditDipModal';
import { supabase } from '@/lib/supabase';
// NOTE: You must install 'react-chartjs-2' and 'chart.js' for the chart to work.
// import { Line } from 'react-chartjs-2';
// import { Chart, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js';
// Chart.register(LineElement, PointElement, LinearScale, CategoryScale);

const GSF_DEPOTS_GROUP_NAME = 'GSF Depots';

export default function GSFDepotsPage() {
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

  const gsfDepotsTanks = (tanks || []).filter(t => t.group_name === GSF_DEPOTS_GROUP_NAME);
  const selectedTank = gsfDepotsTanks.find(t => t.id === selectedTankId) || null;

  return (
    <AppLayout selectedGroup={GSF_DEPOTS_GROUP_NAME} onGroupSelect={() => {}}>
      <div className="min-h-screen w-full bg-muted">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-20">
          <div className="space-y-6 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">GSF Depots Dashboard</h1>
                <p className="text-gray-600 mt-1">Monitoring {gsfDepotsTanks.length} tanks in GSF Depots</p>
              </div>
            </div>
            <KPICards tanks={gsfDepotsTanks} onCardClick={() => {}} selectedFilter={null} />
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Tank Status</h2>
            </div>
            <TankStatusTable
              tanks={gsfDepotsTanks}
              onTankClick={tank => {
                setSelectedTankId(tank.id);
                setTankDetailsOpen(true);
              }}
              setEditDipTank={setEditDipTank}
              setEditDipModalOpen={setEditDipModalOpen}
            />

            <TankDetailsModal
              tank={selectedTank}
              open={tankDetailsOpen}
              onOpenChange={setTankDetailsOpen}
            />
            
            <EditDipModal
              isOpen={editDipModalOpen}
              onClose={() => setEditDipModalOpen(false)}
              initialTankId={editDipTank?.id}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
} 