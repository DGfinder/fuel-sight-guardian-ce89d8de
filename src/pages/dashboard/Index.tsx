import React, { useState } from 'react';
import { Tank } from '@/types/fuel';
import { TankDetailsModal } from '@/components/TankDetailsModal';
import { TankStatusTable } from '@/components/TankStatusTable';

export default function DashboardPage() {
  const [activeTank, setActiveTank] = useState<Tank | null>(null);

  return (
    <>
      <TankStatusTable
        tanks={[]} // TODO: replace with actual tanks data
        onTankClick={setActiveTank}
      />
      {activeTank && (
        <TankDetailsModal
          tank={activeTank}
          open={!!activeTank}
          onOpenChange={(o) => !o && setActiveTank(null)}
        />
      )}
    </>
  );
} 