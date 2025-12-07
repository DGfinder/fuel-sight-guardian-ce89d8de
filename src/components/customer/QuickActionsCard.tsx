import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Truck, Bell, TrendingUp, Phone, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { staggerContainerVariants, fadeUpItemVariants, springs } from '@/lib/motion-variants';

interface QuickActionsCardProps {
  criticalTanks?: number;
  lowFuelTanks?: number;
  hasOperationsIntelligence?: boolean;
}

interface ActionButtonProps {
  icon: React.ElementType;
  label: string;
  description: string;
  to?: string;
  onClick?: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary';
  highlight?: boolean;
  color?: 'blue' | 'green' | 'orange' | 'red';
}

function ActionButton({
  icon: Icon,
  label,
  description,
  to,
  onClick,
  variant = 'outline',
  highlight = false,
  color = 'blue',
}: ActionButtonProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 group-hover:bg-green-100 dark:group-hover:bg-green-900/30',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400 group-hover:bg-orange-100 dark:group-hover:bg-orange-900/30',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 group-hover:bg-red-100 dark:group-hover:bg-red-900/30',
  };

  const buttonContent = (
    <motion.div
      className={cn(
        'group relative overflow-hidden rounded-lg border-2 p-4 transition-all duration-300',
        highlight
          ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-950/20 shadow-lg'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md'
      )}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={springs.responsive}
    >
      {/* Highlight pulse effect */}
      {highlight && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-red-400/10 to-orange-400/10"
          animate={{
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      <div className="relative z-10 flex items-start gap-3">
        {/* Icon */}
        <motion.div
          className={cn('p-2.5 rounded-lg transition-all', colorClasses[color])}
          whileHover={{ rotate: 5 }}
          transition={springs.bouncy}
        >
          <Icon className="h-5 w-5" />
        </motion.div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900 dark:text-white mb-0.5">{label}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            {description}
          </p>
        </div>

        {/* Highlight badge */}
        {highlight && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-600 text-white text-xs font-bold">
            <AlertTriangle className="h-3 w-3" />
            NOW
          </div>
        )}
      </div>
    </motion.div>
  );

  if (to) {
    return (
      <Link to={to} className="block">
        {buttonContent}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className="w-full text-left">
      {buttonContent}
    </button>
  );
}

export function QuickActionsCard({
  criticalTanks = 0,
  lowFuelTanks = 0,
  hasOperationsIntelligence = false,
}: QuickActionsCardProps) {
  const shouldHighlightDelivery = criticalTanks > 0 || lowFuelTanks > 2;

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainerVariants}>
      <Card className="relative overflow-hidden backdrop-blur-sm bg-gradient-to-br from-white/80 to-gray-50/80 dark:from-gray-900/80 dark:to-gray-950/80 border-gray-200/50 dark:border-gray-700/50">
        {/* Glass effect background */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent dark:from-gray-700/10 pointer-events-none" />

        <CardHeader className="relative z-10">
          <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Common tasks and shortcuts
          </p>
        </CardHeader>

        <CardContent className="relative z-10 space-y-3">
          <motion.div variants={fadeUpItemVariants}>
            <ActionButton
              icon={Truck}
              label="Request Delivery"
              description={
                criticalTanks > 0
                  ? `${criticalTanks} tank${criticalTanks > 1 ? 's' : ''} critically low - urgent delivery needed`
                  : 'Schedule fuel delivery for your tanks'
              }
              to="/customer/request"
              color={criticalTanks > 0 ? 'red' : 'blue'}
              highlight={shouldHighlightDelivery}
            />
          </motion.div>

          <motion.div variants={fadeUpItemVariants}>
            <ActionButton
              icon={Bell}
              label="View Alerts"
              description="Check weather alerts and system notifications"
              to="/customer/tanks"
              color="orange"
            />
          </motion.div>

          <motion.div variants={fadeUpItemVariants}>
            <ActionButton
              icon={TrendingUp}
              label="Operations Forecast"
              description={
                hasOperationsIntelligence
                  ? 'Harvest/seeding windows and fuel planning'
                  : 'View fuel consumption trends and insights'
              }
              to="/customer/tanks"
              color="green"
            />
          </motion.div>

          <motion.div variants={fadeUpItemVariants}>
            <ActionButton
              icon={Phone}
              label="Contact Support"
              description="Get help from our team - available 24/7"
              onClick={() => {
                window.location.href = 'tel:+61892502000';
              }}
              color="blue"
            />
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
