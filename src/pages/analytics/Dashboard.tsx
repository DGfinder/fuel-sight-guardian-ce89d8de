import React from 'react';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { safeStringProperty } from '@/lib/typeGuards';
import { 
  BarChart3, 
  Shield, 
  Truck, 
  Database, 
  FileText, 
  TrendingUp,
  AlertTriangle,
  Users,
  Calendar
} from 'lucide-react';

export function Dashboard() {
  const { data: permissions, isLoading } = useUserPermissions();
  
  // Mock user data - replace with actual user context if available
  const user = { email: 'user@example.com' };
  
  const checkPermission = (permission: string): boolean => {
    if (!permissions || typeof permissions !== 'object') return false;
    if (permissions.isAdmin === true) return true;

    const permissionMap: Record<string, string[]> = {
      'view_guardian': ['admin', 'manager', 'compliance_manager'],
      'manage_guardian': ['admin', 'manager', 'compliance_manager'],
      'view_deliveries': ['admin', 'manager'],
      'upload_data': ['admin', 'manager'],
      'generate_reports': ['admin', 'manager', 'compliance_manager'],
      'manage_settings': ['admin'],
    };

    const allowedRoles = permissionMap[permission] || [];
    const userRole = safeStringProperty(permissions, 'role', '');
    return allowedRoles.includes(userRole);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const stats = [
    {
      title: "Guardian Events",
      value: "24,961",
      change: "+2.5%",
      icon: Shield,
      color: "text-red-600",
      bgColor: "bg-red-50",
      description: "Total safety events monitored"
    },
    {
      title: "Delivery Records",
      value: "76,660",
      change: "+8.1%",
      icon: Truck,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      description: "MYOB delivery transactions"
    },
    {
      title: "LYTX Events",
      value: "1,857",
      change: "-4.2%",
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50",
      description: "DriveCam safety incidents"
    },
    {
      title: "Monthly Reports",
      value: "12",
      change: "0%",
      icon: FileText,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      description: "Generated this year"
    }
  ];

  const quickActions = [
    {
      title: "Guardian Compliance",
      description: "View safety monitoring and compliance rates",
      href: "/guardian",
      icon: Shield,
      permission: "view_guardian",
      color: "bg-red-500 hover:bg-red-600"
    },
    {
      title: "Delivery Analytics",
      description: "Analyze MYOB delivery performance",
      href: "/deliveries", 
      icon: Truck,
      permission: "view_deliveries",
      color: "bg-blue-500 hover:bg-blue-600"
    },
    {
      title: "Import Data",
      description: "Upload monthly CFO data files",
      href: "/import",
      icon: Database,
      permission: "upload_data",
      color: "bg-green-500 hover:bg-green-600"
    },
    {
      title: "Generate Reports",
      description: "Create compliance and performance reports",
      href: "/reports",
      icon: FileText,
      permission: "generate_reports",
      color: "bg-purple-500 hover:bg-purple-600"
    }
  ];

  const filteredActions = quickActions.filter(action => {
    try {
      return !action.permission || checkPermission(action.permission);
    } catch (error) {
      console.error('Error checking permission for action:', action.title, error);
      return false;
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Fleet Analytics Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Welcome back, {user?.email?.split('@')[0] || 'User'}. 
              Role: <span className="font-medium capitalize">{safeStringProperty(permissions, 'role', 'Loading...')}</span>
            </p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            <span>Last updated: {new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={`stat-${index}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`p-2 rounded-md ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <span className={`${stat.change.startsWith('+') ? 'text-green-600' : stat.change.startsWith('-') ? 'text-red-600' : 'text-gray-600'}`}>
                  {stat.change}
                </span>
                <span>from last month</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredActions.map((action, index) => (
            <Card key={`action-${index}`} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <div className={`w-12 h-12 rounded-lg ${action.color} flex items-center justify-center mb-3`}>
                  <action.icon className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-lg">{action.title}</CardTitle>
                <CardDescription>{action.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => window.location.href = action.href}
                >
                  Open
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5" />
            <span>System Status</span>
          </CardTitle>
          <CardDescription>
            Current system health and data freshness
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm">Guardian API Connected</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm">MYOB Data Current</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span className="text-sm">LYTX Data (24h delay)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}