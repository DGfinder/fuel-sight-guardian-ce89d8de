/**
 * Hazard Report Floating Action Button
 * Fixed position button visible on all customer portal pages
 */

import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHazardReportContext } from '@/contexts/HazardReportContext';
import { cn } from '@/lib/utils';

interface HazardReportButtonProps {
  /** Whether we're on mobile (adjusts position for bottom nav) */
  isMobile?: boolean;
}

export function HazardReportButton({ isMobile = false }: HazardReportButtonProps) {
  const { openHazardReport } = useHazardReportContext();

  return (
    <motion.div
      className={cn(
        'fixed z-[500]',
        isMobile
          ? 'bottom-20 right-4' // Above mobile bottom nav
          : 'bottom-6 right-6'
      )}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.5, type: 'spring', stiffness: 260, damping: 20 }}
    >
      <Button
        onClick={() => openHazardReport()}
        size="lg"
        className={cn(
          'rounded-full shadow-lg hover:shadow-xl transition-shadow',
          'bg-orange-500 hover:bg-orange-600 text-white',
          'h-14 w-14 p-0',
          'group'
        )}
        title="Report a hazard"
      >
        <motion.div
          whileHover={{ rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 0.5 }}
        >
          <AlertTriangle className="h-6 w-6" />
        </motion.div>
      </Button>

      {/* Tooltip - only on desktop */}
      {!isMobile && (
        <motion.div
          className="absolute right-full mr-3 top-1/2 -translate-y-1/2 pointer-events-none"
          initial={{ opacity: 0, x: 10 }}
          whileHover={{ opacity: 1, x: 0 }}
        >
          <div className="bg-gray-900 dark:bg-gray-800 text-white text-sm px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
            Report Hazard
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
