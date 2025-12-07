import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion-variants';
import { useState } from 'react';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  id: string;
  label: string;
  options: FilterOption[];
  value?: string;
  onChange: (value: string) => void;
}

export interface FilterCardProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  onClearAll?: () => void;
  activeFilterCount?: number;
  defaultExpanded?: boolean;
  className?: string;
}

export function FilterCard({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  onClearAll,
  activeFilterCount = 0,
  defaultExpanded = true,
  className,
}: FilterCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const hasActiveFilters = activeFilterCount > 0 || searchValue.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.gentle}
      className={className}
    >
      <Card className="relative overflow-hidden backdrop-blur-2xl bg-gradient-to-br from-white/80 to-gray-50/80 dark:from-gray-900/80 dark:to-gray-950/80 border-gray-200/50 dark:border-gray-700/50">
        {/* Glass effect background */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent dark:from-gray-700/10 pointer-events-none" />

        <CardHeader className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <CardTitle className="text-sm font-semibold">Filters</CardTitle>
              {hasActiveFilters && (
                <motion.div
                  className="flex items-center justify-center h-5 w-5 rounded-full bg-blue-600 text-white text-xs font-bold"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={springs.bouncy}
                >
                  {activeFilterCount + (searchValue.length > 0 ? 1 : 0)}
                </motion.div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasActiveFilters && onClearAll && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={springs.responsive}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearAll}
                    className="h-7 px-2 text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear all
                  </Button>
                </motion.div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-7 w-7 p-0"
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={springs.gentle}
            >
              <CardContent className="relative z-10 space-y-3 pb-4">
                {/* Search Input */}
                {onSearchChange && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder={searchPlaceholder}
                      value={searchValue}
                      onChange={(e) => onSearchChange(e.target.value)}
                      className="pl-9 pr-9 h-9 backdrop-blur-sm bg-white/50 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600"
                    />
                    {searchValue && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={() => onSearchChange('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <X className="h-4 w-4" />
                      </motion.button>
                    )}
                  </div>
                )}

                {/* Filter Dropdowns */}
                {filters.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filters.map((filter) => (
                      <div key={filter.id} className="space-y-1">
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                          {filter.label}
                        </label>
                        <Select value={filter.value} onValueChange={filter.onChange}>
                          <SelectTrigger className="h-9 backdrop-blur-sm bg-white/50 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600">
                            <SelectValue placeholder={`Select ${filter.label.toLowerCase()}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {filter.options.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
