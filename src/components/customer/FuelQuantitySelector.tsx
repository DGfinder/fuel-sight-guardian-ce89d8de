import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Fuel, Droplets } from 'lucide-react';

interface FuelQuantitySelectorProps {
  currentLevelLiters: number;
  currentLevelPercent: number;
  capacityLiters: number;
  value: number | null; // null = fill tank
  onChange: (litres: number | null) => void;
}

export function FuelQuantitySelector({
  currentLevelLiters,
  currentLevelPercent,
  capacityLiters,
  value,
  onChange,
}: FuelQuantitySelectorProps) {
  const [mode, setMode] = useState<'fill' | 'partial'>(value === null ? 'fill' : 'partial');
  const [partialAmount, setPartialAmount] = useState<string>(value?.toString() || '');

  // Calculate amounts
  const remainingCapacity = Math.max(0, capacityLiters - currentLevelLiters);
  const fillAmount = mode === 'fill' ? remainingCapacity : (parseFloat(partialAmount) || 0);
  const resultingLevel = Math.min(capacityLiters, currentLevelLiters + fillAmount);
  const resultingPercent = capacityLiters > 0 ? (resultingLevel / capacityLiters) * 100 : 0;

  // Validation
  const isOverCapacity = fillAmount > remainingCapacity;
  const validPartialAmount = !isOverCapacity && fillAmount > 0;

  const handleModeChange = (newMode: 'fill' | 'partial') => {
    setMode(newMode);
    if (newMode === 'fill') {
      onChange(null); // null means fill tank
    } else {
      const amount = parseFloat(partialAmount) || 0;
      onChange(amount > 0 ? amount : null);
    }
  };

  const handlePartialChange = (inputValue: string) => {
    setPartialAmount(inputValue);
    const amount = parseFloat(inputValue) || 0;
    if (amount > 0 && amount <= remainingCapacity) {
      onChange(amount);
    } else if (amount === 0) {
      onChange(null);
    }
  };

  // SVG dimensions
  const tankHeight = 160;
  const tankWidth = 60;
  const tankPadding = 4;
  const innerHeight = tankHeight - tankPadding * 2;

  // Calculate fill heights
  const currentHeight = (currentLevelPercent / 100) * innerHeight;
  const addHeight = (fillAmount / capacityLiters) * innerHeight;

  return (
    <div className="flex gap-6 items-start">
      {/* Tank Visualization */}
      <div className="flex-shrink-0">
        <svg
          width={tankWidth + 40}
          height={tankHeight + 20}
          viewBox={`0 0 ${tankWidth + 40} ${tankHeight + 20}`}
          className="overflow-visible"
        >
          {/* Definitions */}
          <defs>
            {/* Gradient for current fuel */}
            <linearGradient id="fuelFill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#16a34a" />
            </linearGradient>

            {/* Gradient for fuel to add */}
            <linearGradient id="addFill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>

            {/* Striped pattern for fuel to add */}
            <pattern id="addStripes" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
              <rect width="4" height="8" fill="#3b82f6" opacity="0.8" />
              <rect x="4" width="4" height="8" fill="#60a5fa" opacity="0.6" />
            </pattern>

            {/* Tank shadow */}
            <filter id="tankShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
            </filter>
          </defs>

          {/* Tank body */}
          <g transform="translate(20, 10)">
            {/* Tank outline with shadow */}
            <rect
              x="0"
              y="0"
              width={tankWidth}
              height={tankHeight}
              rx="8"
              ry="8"
              fill="#f3f4f6"
              stroke="#d1d5db"
              strokeWidth="2"
              filter="url(#tankShadow)"
            />

            {/* Inner tank area (clipped) */}
            <clipPath id="tankClip">
              <rect
                x={tankPadding}
                y={tankPadding}
                width={tankWidth - tankPadding * 2}
                height={innerHeight}
                rx="4"
              />
            </clipPath>

            <g clipPath="url(#tankClip)">
              {/* Current fuel level (green) */}
              <motion.rect
                x={tankPadding}
                y={tankPadding + innerHeight - currentHeight}
                width={tankWidth - tankPadding * 2}
                height={currentHeight}
                fill="url(#fuelFill)"
                initial={{ height: 0, y: tankPadding + innerHeight }}
                animate={{
                  height: currentHeight,
                  y: tankPadding + innerHeight - currentHeight,
                }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />

              {/* Fuel to add (blue striped) */}
              {fillAmount > 0 && (
                <motion.rect
                  x={tankPadding}
                  y={tankPadding + innerHeight - currentHeight - addHeight}
                  width={tankWidth - tankPadding * 2}
                  height={addHeight}
                  fill="url(#addStripes)"
                  initial={{ height: 0, y: tankPadding + innerHeight - currentHeight }}
                  animate={{
                    height: Math.min(addHeight, innerHeight - currentHeight),
                    y: tankPadding + innerHeight - currentHeight - Math.min(addHeight, innerHeight - currentHeight),
                  }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              )}
            </g>

            {/* Tick marks */}
            {[25, 50, 75].map((pct) => {
              const y = tankPadding + innerHeight - (pct / 100) * innerHeight;
              return (
                <g key={pct}>
                  <line
                    x1={tankWidth - 8}
                    y1={y}
                    x2={tankWidth}
                    y2={y}
                    stroke="#9ca3af"
                    strokeWidth="1"
                  />
                  <text
                    x={tankWidth + 4}
                    y={y + 4}
                    fontSize="10"
                    fill="#6b7280"
                  >
                    {pct}%
                  </text>
                </g>
              );
            })}

            {/* Result percentage indicator */}
            {fillAmount > 0 && (
              <motion.g
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <line
                  x1={0}
                  y1={tankPadding + innerHeight - (resultingPercent / 100) * innerHeight}
                  x2={-8}
                  y2={tankPadding + innerHeight - (resultingPercent / 100) * innerHeight}
                  stroke="#2563eb"
                  strokeWidth="2"
                />
                <text
                  x={-12}
                  y={tankPadding + innerHeight - (resultingPercent / 100) * innerHeight + 4}
                  fontSize="10"
                  fill="#2563eb"
                  fontWeight="600"
                  textAnchor="end"
                >
                  {Math.round(resultingPercent)}%
                </text>
              </motion.g>
            )}
          </g>
        </svg>

        {/* Legend */}
        <div className="mt-2 space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span className="text-gray-600">Current</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500 opacity-70" style={{ background: 'repeating-linear-gradient(45deg, #3b82f6, #3b82f6 2px, #60a5fa 2px, #60a5fa 4px)' }} />
            <span className="text-gray-600">To Add</span>
          </div>
        </div>
      </div>

      {/* Options */}
      <div className="flex-1 space-y-4">
        <RadioGroup
          value={mode}
          onValueChange={(v) => handleModeChange(v as 'fill' | 'partial')}
          className="space-y-3"
        >
          {/* Fill Tank Option */}
          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
            <div
              className={cn(
                'flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer',
                mode === 'fill'
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20 shadow-sm'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
              onClick={() => handleModeChange('fill')}
            >
              <RadioGroupItem value="fill" id="fill" />
              <Label htmlFor="fill" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Fuel className="h-4 w-4 text-green-600" />
                  <span className="font-semibold">Fill Tank</span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Top up to 100% capacity
                </div>
                <div className="text-lg font-bold text-green-700 dark:text-green-400 mt-2">
                  +{remainingCapacity.toLocaleString()}L
                </div>
              </Label>
            </div>
          </motion.div>

          {/* Partial Fill Option */}
          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
            <div
              className={cn(
                'flex items-start space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer',
                mode === 'partial'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
              onClick={() => handleModeChange('partial')}
            >
              <RadioGroupItem value="partial" id="partial" className="mt-1" />
              <Label htmlFor="partial" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold">Specific Amount</span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Request a custom quantity
                </div>

                {/* Partial amount input */}
                <AnimatePresence>
                  {mode === 'partial' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={partialAmount}
                          onChange={(e) => handlePartialChange(e.target.value)}
                          placeholder="Enter litres"
                          className={cn(
                            'w-32',
                            isOverCapacity && 'border-red-500 focus:ring-red-500'
                          )}
                          min={0}
                          max={remainingCapacity}
                        />
                        <span className="text-gray-600 font-medium">L</span>
                      </div>
                      {isOverCapacity && (
                        <p className="text-xs text-red-500 mt-1">
                          Max: {remainingCapacity.toLocaleString()}L
                        </p>
                      )}
                      {validPartialAmount && (
                        <p className="text-xs text-blue-600 mt-1">
                          Will bring tank to {Math.round(resultingPercent)}%
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </Label>
            </div>
          </motion.div>
        </RadioGroup>

        {/* Current tank stats */}
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Current Level</span>
              <p className="font-semibold">
                {currentLevelLiters.toLocaleString()}L ({Math.round(currentLevelPercent)}%)
              </p>
            </div>
            <div>
              <span className="text-gray-500">Tank Capacity</span>
              <p className="font-semibold">{capacityLiters.toLocaleString()}L</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
