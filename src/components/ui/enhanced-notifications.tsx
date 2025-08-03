import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle, Fuel } from 'lucide-react';
import { cn } from '@/lib/utils';

// Enhanced toast notification system
interface ToastProps {
  id: string;
  title?: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'fuel-alert';
  duration?: number;
  persistent?: boolean;
  onClose?: () => void;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline';
  }>;
}

export function Toast({ 
  id,
  title,
  message, 
  type, 
  duration = 5000,
  persistent = false,
  onClose,
  actions
}: ToastProps) {
  const [isVisible, setIsVisible] = React.useState(true);

  React.useEffect(() => {
    if (!persistent && duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose?.(), 300);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, persistent, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
      case 'fuel-alert':
        return <Fuel className="h-5 w-5 text-orange-500" />;
      default:
        return null;
    }
  };

  const getColors = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-amber-50 border-amber-200 text-amber-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'fuel-alert':
        return 'bg-orange-50 border-orange-200 text-orange-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={cn(
            'relative flex items-start space-x-3 p-4 border rounded-lg shadow-lg max-w-md',
            getColors()
          )}
        >
          {getIcon()}
          
          <div className="flex-1 min-w-0">
            {title && (
              <div className="font-medium text-sm mb-1">{title}</div>
            )}
            <div className="text-sm">{message}</div>
            
            {actions && actions.length > 0 && (
              <div className="flex space-x-2 mt-3">
                {actions.map((action, index) => (
                  <button
                    key={index}
                    onClick={action.onClick}
                    className={cn(
                      'px-3 py-1 text-xs font-medium rounded transition-colors',
                      action.variant === 'outline'
                        ? 'border border-current bg-transparent hover:bg-current hover:bg-opacity-10'
                        : 'bg-current bg-opacity-20 hover:bg-opacity-30'
                    )}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!persistent && (
            <button
              onClick={() => {
                setIsVisible(false);
                setTimeout(() => onClose?.(), 300);
              }}
              className="flex-shrink-0 p-1 hover:bg-black hover:bg-opacity-10 rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Progress bar for timed notifications */}
          {!persistent && duration > 0 && (
            <motion.div
              className="absolute bottom-0 left-0 h-1 bg-current bg-opacity-30 rounded-b"
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: duration / 1000, ease: "linear" }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Toast container for managing multiple toasts
interface ToastContainerProps {
  toasts: ToastProps[];
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center';
  className?: string;
}

export function ToastContainer({ 
  toasts, 
  position = 'top-right',
  className 
}: ToastContainerProps) {
  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'fixed top-4 right-4 z-50';
      case 'top-left':
        return 'fixed top-4 left-4 z-50';
      case 'bottom-right':
        return 'fixed bottom-4 right-4 z-50';
      case 'bottom-left':
        return 'fixed bottom-4 left-4 z-50';
      case 'top-center':
        return 'fixed top-4 left-1/2 transform -translate-x-1/2 z-50';
      default:
        return 'fixed top-4 right-4 z-50';
    }
  };

  return (
    <div className={cn(getPositionClasses(), className)}>
      <div className="flex flex-col space-y-2">
        <AnimatePresence>
          {toasts.map((toast, index) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 300 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Toast {...toast} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Enhanced alert banner for critical fuel alerts
interface FuelAlertBannerProps {
  tanks: Array<{
    id: string;
    name: string;
    level: number;
    daysToEmpty?: number;
    location: string;
  }>;
  onDismiss?: () => void;
  onViewDetails?: (tankId: string) => void;
  className?: string;
}

export function FuelAlertBanner({ 
  tanks, 
  onDismiss, 
  onViewDetails,
  className 
}: FuelAlertBannerProps) {
  if (tanks.length === 0) return null;

  const criticalTanks = tanks.filter(t => t.level <= 10);
  const lowTanks = tanks.filter(t => t.level <= 20 && t.level > 10);

  return (
    <motion.div
      initial={{ opacity: 0, y: -100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -100 }}
      className={cn(
        'relative bg-gradient-to-r from-red-500 to-orange-500 text-white p-4 shadow-lg',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Fuel className="h-6 w-6" />
          </motion.div>
          
          <div>
            <div className="font-semibold text-lg">
              Fuel Alert: {criticalTanks.length + lowTanks.length} Tank{tanks.length > 1 ? 's' : ''} Require Attention
            </div>
            <div className="text-sm opacity-90">
              {criticalTanks.length > 0 && (
                <span className="font-medium">
                  {criticalTanks.length} Critical
                </span>
              )}
              {criticalTanks.length > 0 && lowTanks.length > 0 && ' • '}
              {lowTanks.length > 0 && (
                <span className="font-medium">
                  {lowTanks.length} Low
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="hidden md:flex space-x-2">
            {tanks.slice(0, 3).map((tank) => (
              <motion.button
                key={tank.id}
                onClick={() => onViewDetails?.(tank.id)}
                className="px-3 py-1 bg-white bg-opacity-20 hover:bg-opacity-30 rounded text-sm font-medium transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {tank.name} ({tank.level.toFixed(0)}%)
              </motion.button>
            ))}
            {tanks.length > 3 && (
              <div className="px-3 py-1 bg-white bg-opacity-20 rounded text-sm">
                +{tanks.length - 3} more
              </div>
            )}
          </div>

          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          style={{ width: '50%' }}
        />
      </div>
    </motion.div>
  );
}

// Status badge with animation
interface StatusBadgeProps {
  status: 'critical' | 'low' | 'normal' | 'unknown';
  animated?: boolean;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StatusBadge({ 
  status, 
  animated = true,
  showIcon = true,
  size = 'md',
  className 
}: StatusBadgeProps) {
  const getConfig = () => {
    switch (status) {
      case 'critical':
        return {
          color: 'bg-red-500 text-white border-red-600',
          icon: AlertCircle,
          pulseColor: 'shadow-red-500/50'
        };
      case 'low':
        return {
          color: 'bg-amber-500 text-white border-amber-600',
          icon: AlertTriangle,
          pulseColor: 'shadow-amber-500/50'
        };
      case 'normal':
        return {
          color: 'bg-green-500 text-white border-green-600',
          icon: CheckCircle,
          pulseColor: 'shadow-green-500/50'
        };
      default:
        return {
          color: 'bg-gray-500 text-white border-gray-600',
          icon: Info,
          pulseColor: 'shadow-gray-500/50'
        };
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-2 py-1 text-xs';
      case 'lg':
        return 'px-4 py-2 text-base';
      default:
        return 'px-3 py-1.5 text-sm';
    }
  };

  const config = getConfig();
  const Icon = config.icon;

  return (
    <motion.div
      className={cn(
        'inline-flex items-center space-x-1 font-medium rounded-full border',
        config.color,
        getSizeClasses(),
        animated && status === 'critical' && 'animate-pulse',
        className
      )}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.2 }}
      {...(animated && status === 'critical' && {
        animate: { 
          scale: [1, 1.05, 1],
          boxShadow: [
            '0 0 0 0 rgba(239, 68, 68, 0)',
            '0 0 0 10px rgba(239, 68, 68, 0.1)',
            '0 0 0 0 rgba(239, 68, 68, 0)'
          ]
        },
        transition: { duration: 2, repeat: Infinity }
      })}
    >
      {showIcon && <Icon className={size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} />}
      <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
    </motion.div>
  );
}

// Interactive notification center
interface NotificationCenterProps {
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    type: ToastProps['type'];
    timestamp: Date;
    read: boolean;
    priority: 'low' | 'medium' | 'high' | 'critical';
  }>;
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onClear?: (id: string) => void;
  className?: string;
}

export function NotificationCenter({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClear,
  className
}: NotificationCenterProps) {
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className={cn('bg-white border border-gray-200 rounded-lg shadow-lg max-w-md', className)}>
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-2">
          <h3 className="font-semibold text-gray-900">Notifications</h3>
          {unreadCount > 0 && (
            <motion.span
              className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              key={unreadCount}
            >
              {unreadCount}
            </motion.span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllAsRead}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <div className="text-4xl mb-2">🔔</div>
            <div>No notifications</div>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification, index) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  'p-4 hover:bg-gray-50 cursor-pointer relative',
                  !notification.read && 'bg-blue-50'
                )}
                onClick={() => onMarkAsRead?.(notification.id)}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    {notification.type === 'fuel-alert' && <Fuel className="h-5 w-5 text-orange-500" />}
                    {notification.type === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
                    {notification.type === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-500" />}
                    {notification.type === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
                    {notification.type === 'info' && <Info className="h-5 w-5 text-blue-500" />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {notification.title}
                      </p>
                      {notification.priority === 'critical' && (
                        <motion.div
                          className="w-2 h-2 bg-red-500 rounded-full"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        />
                      )}
                    </div>
                    <p className="text-gray-600 text-sm mt-1">{notification.message}</p>
                    <p className="text-gray-400 text-xs mt-2">
                      {notification.timestamp.toLocaleString()}
                    </p>
                  </div>

                  {onClear && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onClear(notification.id);
                      }}
                      className="flex-shrink-0 p-1 hover:bg-gray-200 rounded transition-colors"
                    >
                      <X className="h-4 w-4 text-gray-400" />
                    </button>
                  )}
                </div>

                {!notification.read && (
                  <div className="absolute left-2 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}