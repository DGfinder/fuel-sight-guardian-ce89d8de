import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion-variants';
import { StatusBadge, StatusType } from './StatusBadge';
import { useState } from 'react';
import { format } from 'date-fns';

export interface TimelineEvent {
  id: string;
  date: Date;
  title: string;
  description?: string;
  status: StatusType;
  statusLabel: string;
  icon?: React.ElementType;
  details?: Array<{
    label: string;
    value: string | number;
  }>;
  metadata?: React.ReactNode;
  weatherContext?: React.ReactNode;
}

export interface TimelineCardProps {
  events: TimelineEvent[];
  variant?: 'vertical' | 'compact';
  expandable?: boolean;
  defaultExpandedIds?: string[];
  showConnector?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function TimelineCard({
  events,
  variant = 'vertical',
  expandable = true,
  defaultExpandedIds = [],
  showConnector = true,
  emptyMessage = 'No events to display',
  className,
}: TimelineCardProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(defaultExpandedIds));

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (events.length === 0) {
    return (
      <Card className={cn('backdrop-blur-sm bg-white/50 dark:bg-gray-900/50', className)}>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-0', className)}>
      {events.map((event, idx) => {
        const isExpanded = expandedIds.has(event.id);
        const isLast = idx === events.length - 1;

        return (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05, ...springs.gentle }}
            className="relative"
          >
            {/* Timeline connector */}
            {showConnector && !isLast && variant === 'vertical' && (
              <div className="absolute left-[21px] top-12 bottom-0 w-0.5 bg-gradient-to-b from-gray-300 to-transparent dark:from-gray-700" />
            )}

            <Card
              className={cn(
                'relative overflow-hidden backdrop-blur-sm bg-white/80 dark:bg-gray-900/80 border-gray-200 dark:border-gray-700 transition-all duration-300',
                isExpanded && 'shadow-md',
                !isLast && variant === 'vertical' && 'mb-4'
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Icon / Status Indicator */}
                  <div className="flex-shrink-0">
                    {event.icon ? (
                      <motion.div
                        className={cn(
                          'flex items-center justify-center h-10 w-10 rounded-full',
                          event.status === 'success' && 'bg-green-100 dark:bg-green-950/40',
                          event.status === 'warning' && 'bg-yellow-100 dark:bg-yellow-950/40',
                          event.status === 'error' && 'bg-red-100 dark:bg-red-950/40',
                          event.status === 'info' && 'bg-blue-100 dark:bg-blue-950/40',
                          event.status === 'neutral' && 'bg-gray-100 dark:bg-gray-800'
                        )}
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={springs.bouncy}
                      >
                        <event.icon
                          className={cn(
                            'h-5 w-5',
                            event.status === 'success' && 'text-green-600 dark:text-green-400',
                            event.status === 'warning' && 'text-yellow-600 dark:text-yellow-400',
                            event.status === 'error' && 'text-red-600 dark:text-red-400',
                            event.status === 'info' && 'text-blue-600 dark:text-blue-400',
                            event.status === 'neutral' && 'text-gray-600 dark:text-gray-400'
                          )}
                        />
                      </motion.div>
                    ) : (
                      <div
                        className={cn(
                          'h-10 w-10 rounded-full border-4',
                          event.status === 'success' && 'border-green-500 bg-green-50 dark:bg-green-950/20',
                          event.status === 'warning' && 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20',
                          event.status === 'error' && 'border-red-500 bg-red-50 dark:bg-red-950/20',
                          event.status === 'info' && 'border-blue-500 bg-blue-50 dark:bg-blue-950/20',
                          event.status === 'neutral' && 'border-gray-400 bg-gray-50 dark:bg-gray-900/20'
                        )}
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-1">
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
                          {event.title}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {format(event.date, 'MMM d, yyyy • h:mm a')}
                        </p>
                      </div>
                      <StatusBadge
                        status={event.status}
                        label={event.statusLabel}
                        size="sm"
                        variant="subtle"
                      />
                    </div>

                    {event.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                        {event.description}
                      </p>
                    )}

                    {/* Metadata (always visible) */}
                    {event.metadata && (
                      <div className="mt-2">
                        {event.metadata}
                      </div>
                    )}

                    {/* Expandable details */}
                    {expandable && (event.details || event.weatherContext) && (
                      <>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={springs.gentle}
                              className="mt-3 space-y-3"
                            >
                              {/* Details grid */}
                              {event.details && event.details.length > 0 && (
                                <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                  {event.details.map((detail, detailIdx) => (
                                    <div key={detailIdx} className="space-y-0.5">
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {detail.label}
                                      </p>
                                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {detail.value}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Weather context slot */}
                              {event.weatherContext && (
                                <div>{event.weatherContext}</div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(event.id)}
                          className="mt-2 h-7 px-2 text-xs"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-3 w-3 mr-1" />
                              Show less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3 w-3 mr-1" />
                              Show details
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
