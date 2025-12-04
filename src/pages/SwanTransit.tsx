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

const SWAN_TRANSIT_GROUP_NAME = 'Swan Transit';

export default function SwanTransitPage() {
  const { tanks, isLoading, error } = useTanks();
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

  const swanTanks = (tanks || []).filter(t => t.group_name === SWAN_TRANSIT_GROUP_NAME);
  const selectedTank = swanTanks.find(t => t.id === selectedTankId) || null;

  // Handle error state
  if (error) {
    // Safely extract error message from various error types
    const errorMessage = (() => {
      if (typeof error === 'string') return error;
      if (error && typeof error === 'object') {
        if ('message' in error && typeof error.message === 'string') return error.message;
        if ('details' in error && typeof error.details === 'string') return error.details;
        if ('code' in error) return `Database error (${error.code})`;
      }
      return 'Unable to load Swan Transit data. Please check your connection and try again.';
    })();

    return (
      <AppLayout selectedGroup={SWAN_TRANSIT_GROUP_NAME} onGroupSelect={() => {}}>
        <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
          <div className="p-6 text-center space-y-4 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 shadow-sm">
            <div className="w-16 h-16 text-red-500 mx-auto">⚠️</div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Error loading Swan Transit data</h3>
              <p className="text-red-600 mt-1">{errorMessage}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Reload Page
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Handle loading state
  if (isLoading) {
    return (
      <AppLayout selectedGroup={SWAN_TRANSIT_GROUP_NAME} onGroupSelect={() => {}}>
        <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <div className="text-lg">Loading Swan Transit data...</div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout selectedGroup={SWAN_TRANSIT_GROUP_NAME} onGroupSelect={() => {}}>
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-20 py-6 space-y-6">
          {/* Header Section */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Swan Transit Dashboard</h1>
                <p className="text-gray-600 mt-1">Monitoring {swanTanks.length} tanks in Swan Transit</p>
              </div>
            </div>
            <div className="mt-6">
              <KPICards tanks={swanTanks} onCardClick={() => {}} selectedFilter={null} />
            </div>
          </div>

          {/* Tank Status Section */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 shadow-sm">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900">Tank Status</h2>
            </div>
            <div className="overflow-x-auto">
              <TankStatusTable
                tanks={swanTanks}
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