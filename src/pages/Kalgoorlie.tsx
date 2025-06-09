import React, { useState, useEffect } from 'react';
import { useTanks } from '@/hooks/useTanks';
import { supabase } from '@/lib/supabase';
import AppLayout from '@/components/AppLayout';
import { KPICards } from '@/components/KPICards';
import { TankStatusTable } from '@/components/TankStatusTable';
import { TankDetailsModal } from '@/components/TankDetailsModal';

const KALGOORLIE_GROUP_NAME = 'Kalgoorlie';

export default function KalgoorliePage() {
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

  // Filter tanks to only Kalgoorlie
  const kalgoorlieTanks = (tanks || []).filter(t => t.group_name === KALGOORLIE_GROUP_NAME);
  const selectedTank = kalgoorlieTanks.find(t => t.id === selectedTankId) || null;

  return (
    <AppLayout selectedGroup={KALGOORLIE_GROUP_NAME} onGroupSelect={() => {}}>
      <div className="min-h-screen w-full bg-muted">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-20">
          <div className="space-y-6 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Kalgoorlie Dashboard</h1>
                <p className="text-gray-600 mt-1">Monitoring {kalgoorlieTanks.length} tanks in Kalgoorlie</p>
              </div>
            </div>
            <KPICards tanks={kalgoorlieTanks} onCardClick={() => {}} selectedFilter={null} />
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Tank Status</h2>
            </div>
            <TankStatusTable
              tanks={kalgoorlieTanks}
              onTankClick={tank => {
                setSelectedTankId(tank.id);
                setTankDetailsOpen(true);
              }}
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