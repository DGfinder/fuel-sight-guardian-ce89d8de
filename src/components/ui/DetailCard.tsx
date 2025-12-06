import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion-variants';
import { useState } from 'react';

export interface DetailItem {
  label: string;
  value: string | number | React.ReactNode;
  icon?: React.ElementType;
  copyable?: boolean;
}

export interface DetailSection {
  title?: string;
  items: DetailItem[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export interface DetailCardProps {
  title?: string;
  description?: string;
  sections: DetailSection[];
  variant?: 'glass' | 'solid';
  isLoading?: boolean;
  className?: string;
}

export function DetailCard({
  title,
  description,
  sections,
  variant = 'glass',
  isLoading = false,
  className,
}: DetailCardProps) {
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>(
    sections.reduce((acc, section, idx) => {
      acc[idx] = section.defaultExpanded ?? true;
      return acc;
    }, {} as Record<number, boolean>)
  );

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
      setTimeout(() => setCopiedValue(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const toggleSection = (idx: number) => {
    setExpandedSections((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const cardClasses = cn(
    'relative overflow-hidden',
    variant === 'glass' &&
      'backdrop-blur-2xl bg-gradient-to-br from-white/80 to-gray-50/80 dark:from-gray-900/80 dark:to-gray-950/80 border-gray-200/50 dark:border-gray-700/50',
    variant === 'solid' && 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700',
    className
  );

  if (isLoading) {
    return (
      <Card className={cardClasses}>
        <CardHeader>
          {title && <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />}
          {description && (
            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2" />
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.gentle}
    >
      <Card className={cardClasses}>
        {/* Glass effect background */}
        {variant === 'glass' && (
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent dark:from-gray-700/10 pointer-events-none" />
        )}

        {(title || description) && (
          <CardHeader className="relative z-10">
            {title && <CardTitle className="text-lg font-semibold">{title}</CardTitle>}
            {description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
            )}
          </CardHeader>
        )}

        <CardContent className="relative z-10 space-y-4">
          {sections.map((section, sectionIdx) => (
            <div key={sectionIdx} className="space-y-3">
              {section.title && (
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {section.title}
                  </h3>
                  {section.collapsible && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSection(sectionIdx)}
                      className="h-6 w-6 p-0"
                    >
                      {expandedSections[sectionIdx] ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              )}

              <AnimatePresence>
                {(!section.collapsible || expandedSections[sectionIdx]) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={springs.gentle}
                    className="space-y-2"
                  >
                    {section.items.map((item, itemIdx) => (
                      <div
                        key={itemIdx}
                        className="flex items-start justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {item.icon && (
                            <item.icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          )}
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex-shrink-0">
                            {item.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white text-right">
                            {item.value}
                          </span>
                          {item.copyable && typeof item.value === 'string' && (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleCopy(item.value as string)}
                              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                              {copiedValue === item.value ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3 text-gray-400" />
                              )}
                            </motion.button>
                          )}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}
