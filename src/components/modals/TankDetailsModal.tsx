import React from 'react';
import { DialogDescription } from '@/components/ui/dialog';

export function TankDetailsModal(props) {
  return (
    <div>
      <DialogDescription id="tank-desc" className="sr-only">Tank details and dip history</DialogDescription>
      {/* ...rest of modal... */}
    </div>
  );
} 