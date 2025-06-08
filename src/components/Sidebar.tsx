import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FuelDipForm } from "@/components/fuel-dip/FuelDipForm";
import { useAuth } from '@/hooks/useAuth';

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
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [dipModalOpen, setDipModalOpen] = useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth > 768) setOpen(false);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleToggle = () => setOpen((prev) => !prev);

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <>
      {/* Hamburger for mobile */}
      {isMobile && (
        <header className="flex items-center justify-between p-4 bg-white shadow-md md:hidden sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <img src={logo} alt="GSF Logo" className="h-8 w-auto" />
            <span className="font-bold text-base text-[#111111]">Fuel Sight Guardian</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open sidebar"
            onClick={handleToggle}
          >
            <Menu size={24} />
          </Button>
        </header>
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-[#008457] border-r-4 border-[#FEDF19] z-40 flex flex-col justify-between transition-transform duration-200",
          "rounded-r-xl shadow-lg",
          isMobile ? (open ? "translate-x-0" : "-translate-x-full") : "translate-x-0"
        )}
        aria-label="Sidebar"
        style={{ minHeight: '100vh' }}
      >
        <nav className="flex flex-col flex-1 gap-2 p-4 overflow-y-auto">
          {/* Branding */}
          <div className="flex flex-col items-center mb-8 select-none pt-2 pb-4 border-b border-white/20">
            <img
              src={logo}
              alt="Great Southern Fuels Logo"
              className="h-16 w-auto mb-2 bg-white rounded-lg p-2 shadow"
            />
            <span className="font-bold text-lg text-white text-center leading-tight tracking-wide">
              Fuel Sight Guardian
            </span>
            <span className="text-sm font-medium text-[#FEDF19] tracking-wide text-center">
              Great Southern Fuels
            </span>
          </div>

          {/* Nav Links */}
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
                        ? "bg-[#FEDF19] text-[#111111] shadow font-bold"
                        : "hover:bg-white/10 text-white",
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span
                      className={cn(
                        "transition-colors",
                        isActive ? "text-[#111111]" : "text-white"
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
              className="bg-[#008457] hover:bg-[#006b47] text-white font-bold text-base rounded-lg py-2 w-full border-2 border-[#FEDF19] shadow"
              size="lg"
              onClick={() => setDipModalOpen(true)}
            >
              <Plus className="mr-2" size={20} />
              Add Dip Reading
            </Button>
            <Button
              variant="outline"
              className="border-white text-white font-semibold rounded-lg py-2 w-full bg-transparent hover:bg-white/10 hover:text-white transition-colors"
              asChild
            >
              <Link to="/alerts">
                <Bell className="mr-2" size={20} />
                View Alerts
              </Link>
            </Button>
          </div>
        </nav>

        {/* Sticky Footer */}
        <div className="p-4 border-t border-white/20 flex items-center justify-between bg-[#008457] sticky bottom-0">
          <Link
            to="/settings"
            className="flex items-center gap-2 text-white hover:text-[#FEDF19] transition-colors"
            aria-label="Settings"
          >
            <Settings size={20} />
            <span className="text-sm font-medium">Settings</span>
          </Link>
          <button
            onClick={handleLogout}
            className="ml-4 text-white hover:text-[#FEDF19] text-sm font-medium transition-colors"
            aria-label="Logout"
          >
            Logout
          </button>
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

      {/* Dip Modal */}
      <Dialog open={dipModalOpen} onOpenChange={setDipModalOpen}>
        <DialogContent className="max-w-xl">
          <FuelDipForm />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Sidebar;
