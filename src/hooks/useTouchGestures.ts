import { useRef, useEffect, useCallback } from 'react';

export interface TouchGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onPinch?: (scale: number) => void;
  onTap?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  threshold?: number;
  longPressDelay?: number;
  enablePinch?: boolean;
  enableSwipe?: boolean;
  enableTap?: boolean;
  enableLongPress?: boolean;
}

interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

export function useTouchGestures(options: TouchGestureOptions = {}) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onPinch,
    onTap,
    onDoubleTap,
    onLongPress,
    threshold = 50,
    longPressDelay = 500,
    enablePinch = false,
    enableSwipe = true,
    enableTap = true,
    enableLongPress = false,
  } = options;

  const touchStartRef = useRef<TouchPoint | null>(null);
  const touchEndRef = useRef<TouchPoint | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialPinchDistanceRef = useRef<number>(0);
  const elementRef = useRef<HTMLElement | null>(null);

  const getDistance = useCallback((touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    const now = Date.now();
    
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: now,
    };

    // Handle pinch start
    if (enablePinch && e.touches.length === 2) {
      initialPinchDistanceRef.current = getDistance(e.touches[0], e.touches[1]);
    }

    // Handle long press
    if (enableLongPress && onLongPress) {
      longPressTimerRef.current = setTimeout(() => {
        onLongPress();
      }, longPressDelay);
    }
  }, [enablePinch, enableLongPress, onLongPress, longPressDelay, getDistance]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    // Cancel long press if finger moves
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // Handle pinch
    if (enablePinch && onPinch && e.touches.length === 2) {
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / initialPinchDistanceRef.current;
      onPinch(scale);
    }
  }, [enablePinch, onPinch, getDistance]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (!touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const now = Date.now();
    
    touchEndRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: now,
    };

    const deltaX = touchEndRef.current.x - touchStartRef.current.x;
    const deltaY = touchEndRef.current.y - touchStartRef.current.y;
    const deltaTime = touchEndRef.current.time - touchStartRef.current.time;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Handle tap gestures
    if (enableTap && distance < threshold && deltaTime < 300) {
      const timeSinceLastTap = now - lastTapTimeRef.current;
      
      if (onDoubleTap && timeSinceLastTap < 300) {
        onDoubleTap();
        lastTapTimeRef.current = 0; // Reset to prevent triple tap
      } else {
        lastTapTimeRef.current = now;
        // Delay single tap to allow for potential double tap
        setTimeout(() => {
          if (now === lastTapTimeRef.current && onTap) {
            onTap();
          }
        }, 300);
      }
    }

    // Handle swipe gestures
    if (enableSwipe && distance > threshold) {
      const isVerticalSwipe = Math.abs(deltaY) > Math.abs(deltaX);
      
      if (isVerticalSwipe) {
        if (deltaY < -threshold && onSwipeUp) {
          onSwipeUp();
        } else if (deltaY > threshold && onSwipeDown) {
          onSwipeDown();
        }
      } else {
        if (deltaX < -threshold && onSwipeLeft) {
          onSwipeLeft();
        } else if (deltaX > threshold && onSwipeRight) {
          onSwipeRight();
        }
      }
    }

    touchStartRef.current = null;
    touchEndRef.current = null;
  }, [
    enableTap,
    enableSwipe,
    threshold,
    onTap,
    onDoubleTap,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
  ]);

  const attachListeners = useCallback((element: HTMLElement) => {
    elementRef.current = element;
    
    // Use passive listeners for better performance
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const detachListeners = useCallback(() => {
    if (elementRef.current) {
      elementRef.current.removeEventListener('touchstart', handleTouchStart);
      elementRef.current.removeEventListener('touchmove', handleTouchMove);
      elementRef.current.removeEventListener('touchend', handleTouchEnd);
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  useEffect(() => {
    return () => {
      detachListeners();
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, [detachListeners]);

  return { attachListeners, detachListeners };
}

// Hook for touch-optimized scrolling
export function useTouchScroll() {
  const scrollRef = useRef<HTMLElement | null>(null);

  const attachScrollOptimization = useCallback((element: HTMLElement) => {
    scrollRef.current = element;
    
    // Add momentum scrolling for iOS
    element.style.webkitOverflowScrolling = 'touch';
    
    // Improve scroll performance
    element.style.transform = 'translateZ(0)';
    
    return () => {
      if (element) {
        element.style.webkitOverflowScrolling = '';
        element.style.transform = '';
      }
    };
  }, []);

  return { attachScrollOptimization };
}

// Hook for mobile-optimized modal gestures
export function useModalGestures(onClose?: () => void) {
  const { attachListeners } = useTouchGestures({
    onSwipeDown: onClose,
    enableSwipe: !!onClose,
    enableTap: false,
    threshold: 100,
  });

  return { attachListeners };
}