import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { useIsMobile } from "@/hooks/use-mobile";

const SETTINGS_SECTIONS = [
  { key: "account", label: "Account Settings" },
  { key: "preferences", label: "Preferences" },
  { key: "notifications", label: "Notifications" },
  { key: "user-management", label: "User Management", adminOnly: true },
  { key: "permissions", label: "Permissions Summary", adminOrScheduler: true },
  { key: "api", label: "API / Developer Tools", adminOnly: true },
  { key: "danger", label: "Danger Zone" },
];

const NotFound = () => {
  const location = useLocation();
  const isMobile = useIsMobile();

  // Filter sections based on RBAC
  const visibleSections = SETTINGS_SECTIONS.filter(section => {
    if (section.adminOnly) return false;
    if (section.adminOrScheduler) return false;
    return true;
  });

  // Section content placeholders
  const sectionContent = {
    account: (
      <div>
        <h2 className="font-semibold text-lg mb-2">Account Settings</h2>
        <div className="space-y-2">
          <div>Full Name: <span className="font-mono">[Editable]</span></div>
          <div>Email: <span className="font-mono">[Read-only]</span></div>
          <div>Role: <span className="font-mono">[Role]</span></div>
          <div>Depot Access: <span className="font-mono">[List]</span></div>
          <div>[Request depot change button if allowed]</div>
        </div>
      </div>
    ),
    preferences: (
      <div>
        <h2 className="font-semibold text-lg mb-2">Preferences</h2>
        <div className="space-y-2">
          <div>Theme: [Light / Dark / System]</div>
          <div>Default Depot Group: [Dropdown]</div>
          <div>Default Timezone: [Dropdown]</div>
        </div>
      </div>
    ),
    notifications: (
      <div>
        <h2 className="font-semibold text-lg mb-2">Notifications</h2>
        <div className="space-y-2">
          <div>Email Alerts: [Toggles]</div>
          <div>SMS Alerts: [Toggle]</div>
          <div>Webhook/Slack Alerts: [Optional]</div>
        </div>
      </div>
    ),
    "user-management": (
      <div>
        <h2 className="font-semibold text-lg mb-2">User Management</h2>
        <div className="space-y-2">
          <div>Invite new user [Form]</div>
          <div>Reset password [Link]</div>
          <div>Remove/deactivate users [List]</div>
          <div>Change user roles [Dropdown]</div>
          <div>Export user list [Button]</div>
        </div>
      </div>
    ),
    permissions: (
      <div>
        <h2 className="font-semibold text-lg mb-2">Permissions Summary</h2>
        <div>[Role matrix table]</div>
      </div>
    ),
    api: (
      <div>
        <h2 className="font-semibold text-lg mb-2">API / Developer Tools</h2>
        <div className="space-y-2">
          <div>API token management [Section]</div>
          <div>Webhook secret [Section]</div>
          <div>Example queries/docs [Section]</div>
        </div>
      </div>
    ),
    danger: (
      <div>
        <h2 className="font-semibold text-lg mb-2">Danger Zone</h2>
        <div className="space-y-2">
          <div>Change password [Button]</div>
          <div>Delete account [Button, admin-guarded]</div>
          <div>Download user data [Button]</div>
        </div>
      </div>
    ),
  };

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-4">Oops! Page not found</p>
        <a href="/" className="text-blue-500 hover:text-blue-700 underline">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
