import React, { useState, useEffect } from 'react';
import { useTanks } from '@/hooks/useTanks';
import AppLayout from '@/components/AppLayout';
import { KPICards } from '@/components/KPICards';
import { TankStatusTable } from '@/components/TankStatusTable';
import { TankDetailsModal } from '@/components/TankDetailsModal';
import EditDipModal from '@/components/modals/EditDipModal';
import BulkDipModal from '@/components/modals/BulkDipModal';
import { Button } from '@/components/ui/button';
import { Zap, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useTankGroups } from '@/hooks/useTankGroups';
import type { Tank } from '@/types/fuel';

const GERALDTON_LINEHAUL_GROUP_NAME = 'Geraldton Linehaul';

export default function GeraldtonLinehaulPage() {
  const navigate = useNavigate();
  const { tanks, isLoading } = useTanks();
  const { data: groups } = useTankGroups();
  const [selectedTankId, setSelectedTankId] = useState<string | null>(null);
  const [tankDetailsOpen, setTankDetailsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [editDipModalOpen, setEditDipModalOpen] = useState(false);
  const [editDipTank, setEditDipTank] = useState<Tank | null>(null);
  const [bulkDipModalOpen, setBulkDipModalOpen] = useState(false);

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

  const geraldtonLinehaulTanks = (tanks || []).filter(
    t => (
      (t.group_name && t.group_name.trim().toLowerCase() === 'geraldton linehaul')
    )
  );
  const geraldtonLinehaulGroup = groups?.find(g => g.name === GERALDTON_LINEHAUL_GROUP_NAME);
  const selectedTank = geraldtonLinehaulTanks.find(t => t.id === selectedTankId) || null;

  return (
    <AppLayout selectedGroup={GERALDTON_LINEHAUL_GROUP_NAME} onGroupSelect={() => {}}>
      <div className="min-h-screen w-full bg-muted">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-20">
          <div className="space-y-6 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Geraldton Linehaul Dashboard</h1>
                <p className="text-gray-600 mt-1">Monitoring {geraldtonLinehaulTanks.length} tanks in Geraldton Linehaul</p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => navigate('/geraldton-linehaul/bulk-entry')}
                  className="flex items-center gap-2"
                >
                  <Zap className="h-4 w-4" />
                  Quick Entry
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setBulkDipModalOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Bulk Entry
                </Button>
              </div>
            </div>
            <KPICards tanks={geraldtonLinehaulTanks} onCardClick={() => {}} selectedFilter={null} />
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Tank Status</h2>
            </div>
            <TankStatusTable
              tanks={geraldtonLinehaulTanks}
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
      {geraldtonLinehaulGroup && (
        <BulkDipModal
          open={bulkDipModalOpen}
          onOpenChange={setBulkDipModalOpen}
          groupId={geraldtonLinehaulGroup.id}
          groupName={geraldtonLinehaulGroup.name}
        />
      )}
    </AppLayout>
  );
}