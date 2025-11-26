import React, { useState, useEffect } from 'react';
import { Mail, Phone, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FooterProps {
  className?: string;
}

export function Footer({ className }: FooterProps) {
  const [isVisible, setIsVisible] = useState(false);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <footer className={cn("w-full bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-2 animate-fade-in", className)}>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>© {currentYear} <span className="font-semibold text-[#008457]">Great Southern Fuels</span> - TankAlert</span>
        <div className="flex items-center gap-4">
          <a href="mailto:support@greatsouthernfuel.com.au" className="hover:text-[#008457] flex items-center gap-1">
            <Mail className="w-3 h-3" /> Support
          </a>
          <a href="tel:+61897214444" className="hover:text-[#008457] flex items-center gap-1">
            <Phone className="w-3 h-3" /> (08) 9721 4444
          </a>
          <a href="https://www.greatsouthernfuels.com.au" target="_blank" rel="noopener noreferrer" className="hover:text-[#008457] flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> Website
          </a>
        </div>
        <span>Powered by <span className="text-[#008457] font-medium">GSF Technology</span></span>
      </div>
    </footer>
  );
}
