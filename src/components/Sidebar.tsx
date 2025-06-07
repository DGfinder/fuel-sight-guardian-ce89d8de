import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Menu,
  Bell,
  Gauge,
  Building,
  MapPin,
  Home,
  Settings,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

const NAV_LINKS = [
  {
    label: "Global Dashboard",
    icon: <Gauge size={20} />,
    to: "/",
    key: "dashboard",
  },
  {
    label: "Swan Transit",
    icon: <Building size={20} />,
    to: "/swan-transit",
    key: "swan",
  },
  {
    label: "Kalgoorlie",
    icon: <MapPin size={20} />,
    to: "/kalgoorlie",
    key: "kalgoorlie",
  },
  {
    label: "Geraldton",
    icon: <MapPin size={20} />,
    to: "/geraldton",
    key: "geraldton",
  },
  {
    label: "GSF Depots",
    icon: <Home size={20} />,
    to: "/gsf-depots",
    key: "gsf",
  },
  {
    label: "BGC",
    icon: <Building size={20} />,
    to: "/bgc",
    key: "bgc",
  },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const [open, setOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth > 768) setOpen(true);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleToggle = () => setOpen((prev) => !prev);

  return (
    <>
      {/* Mobile header */}
      {isMobile && (
        <header className="flex items-center justify-between p-4 bg-white shadow-md md:hidden sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <img src={logo} alt="GSF Logo" className="h-8 w-auto" />
            <span className="font-bold text-base text-[#111111]">
              Fuel Sight Guardian
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={handleToggle}>
            <Menu size={24} />
          </Button>
        </header>
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-white border-r z-40 flex flex-col justify-between transition-transform duration-200",
          "rounded-r-xl shadow-md",
          isMobile ? (open ? "translate-x-0" : "-translate-x-full") : "translate-x-0"
        )}
        aria-label="Sidebar"
      >
        <nav className="flex flex-col flex-1 gap-2 p-4 overflow-y-auto">
          {/* Branding */}
          <div className="flex flex-col items-center mb-6 select-none">
            <img
              src={logo}
              alt="Great Southern Fuels Logo"
              className="h-14 w-auto mb-2 border border-[#008457] bg-white rounded-lg"
              style={{ boxShadow: "0 2px 8px 0 #00845722" }}
            />
            <span className="font-bold text-lg text-[#111111] text-center leading-tight">
              Fuel Sight Guardian
            </span>
            <span className="text-sm font-medium text-[#008457] tracking-wide text-center">
              Great Southern Fuels
            </span>
          </div>

          {/* Navigation */}
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <li key={link.key}>
                  <Link
                    to={link.to}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2 rounded-lg font-medium transition-colors",
                      isActive
                        ? "bg-[#008457] text-white shadow"
                        : "text-[#111111] hover:bg-[#FEDF19]/20"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span
                      className={cn(
                        "transition-colors",
                        isActive ? "text-white" : "text-[#008457]"
                      )}
                    >
                      {link.icon}
                    </span>
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Quick Actions */}
          <div className="flex flex-col gap-2 mt-8">
            <Button
              className="bg-[#008457] hover:bg-[#008457]/90 text-white font-bold text-base rounded-lg py-2"
              size="lg"
              asChild
            >
              <Link to="/add-dip">
                <Plus className="mr-2" size={20} />
                Add Dip Reading
              </Link>
            </Button>
            <Button
              variant="outline"
              className="border-[#008457] text-[#008457] font-semibold rounded-lg py-2"
              asChild
            >
              <Link to="/alerts">
                <Bell className="mr-2" size={20} />
                View Alerts
              </Link>
            </Button>
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t bg-white sticky bottom-0">
          <Link
            to="/settings"
            className="flex items-center gap-2 text-[#111111] hover:text-[#008457] transition-colors"
            aria-label="Settings"
          >
            <Settings size={20} />
            <span className="text-sm font-medium">Settings</span>
          </Link>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isMobile && open && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={handleToggle}
          aria-label="Close sidebar overlay"
        />
      )}
    </>
  );
};

export default Sidebar;
