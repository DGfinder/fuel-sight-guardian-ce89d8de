import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  CreditCard, 
  AlertTriangle, 
  Upload, 
  BarChart3, 
  TrendingUp,
  Users,
  FileText
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import DataCentreLayout from '@/components/DataCentreLayout';
import { useVehicles } from '@/hooks/useVehicles';

const DataCentrePage = () => {
  const { data: vehicles = [], isLoading } = useVehicles();
  
  const fleetStats = useMemo(() => {
    if (vehicles.length === 0) {
      return {
        totalVehicles: 0,
        averageEfficiency: 0,
        activeVehicles: 0,
        averageSafetyScore: 0
      };
    }
    
    const activeVehicles = vehicles.filter(v => v.status === 'Active').length;
    const averageEfficiency = vehicles.reduce((sum, v) => sum + v.fuel_efficiency, 0) / vehicles.length;
    const averageSafetyScore = vehicles.reduce((sum, v) => sum + v.safety_score, 0) / vehicles.length;
    
    return {
      totalVehicles: vehicles.length,
      averageEfficiency: Math.round(averageEfficiency * 10) / 10,
      activeVehicles,
      averageSafetyScore: Math.round(averageSafetyScore * 10) / 10
    };
  }, [vehicles]);

  const analyticsCards = [
    {
      title: 'Guardian Compliance',
      description: 'Monitor distraction and fatigue events with verification workflows',
      icon: Shield,
      href: '/data-centre/guardian',
      metrics: { events: '13,317', verification: '6.4%' },
      color: 'bg-blue-500',
      available: true
    },
    {
      title: 'Captive Payments',
      description: 'Track SMB and GSF carrier performance and volume metrics',
      icon: CreditCard,
      href: '/data-centre/captive-payments',
      metrics: { records: '75,000+', carriers: '2' },
      color: 'bg-green-500',
      available: true
    },
    {
      title: 'LYTX Safety',
      description: 'Driver safety scores, coaching workflows, and risk assessment',
      icon: AlertTriangle,
      href: '/data-centre/safety',
      metrics: { drivers: '120+', score: '8.2/10' },
      color: 'bg-orange-500',
      available: true
    },
    {
      title: 'Data Import',
      description: 'Upload and process Excel/CSV files from multiple sources',
      icon: Upload,
      href: '/data-centre/import',
      metrics: { sources: '3', batches: '24' },
      color: 'bg-purple-500',
      available: true
    },
    {
      title: 'Reports & Analytics',
      description: 'Cross-source analytics and automated report generation',
      icon: BarChart3,
      href: '/data-centre/reports',
      metrics: { reports: '12', insights: 'Real-time' },
      color: 'bg-indigo-500',
      available: true
    },
    {
      title: 'Fleet Analytics',
      description: 'Comprehensive fleet performance and risk optimization',
      icon: TrendingUp,
      href: '/data-centre/fleet',
      metrics: { 
        vehicles: fleetStats.totalVehicles.toString(), 
        efficiency: `${fleetStats.averageEfficiency} km/L`
      },
      color: 'bg-teal-500',
      available: true
    }
  ];

  return (
    <DataCentreLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Data Centre Analytics Platform
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Comprehensive fleet analytics combining Guardian compliance, captive payments, and safety data
          </p>
          <div className="flex items-center gap-4 mt-4">
            <Badge variant="outline" className="text-green-600 border-green-200">
              <Users className="w-4 h-4 mr-1" />
              Multi-source Integration
            </Badge>
            <Badge variant="outline" className="text-blue-600 border-blue-200">
              <FileText className="w-4 h-4 mr-1" />
              Real-time Analytics
            </Badge>
          </div>
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {analyticsCards.map((card) => {
            const IconComponent = card.icon;
            
            return (
              <Card 
                key={card.href} 
                className={`relative overflow-hidden transition-all duration-200 hover:shadow-lg ${
                  card.available 
                    ? 'hover:scale-105 cursor-pointer' 
                    : 'opacity-60 cursor-not-allowed'
                }`}
              >
                {card.available ? (
                  <Link to={card.href} className="block h-full">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className={`p-2 rounded-lg ${card.color} text-white`}>
                          <IconComponent className="w-6 h-6" />
                        </div>
                        {card.available && (
                          <Badge variant="secondary" className="text-green-700 bg-green-100">
                            Available
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-xl">{card.title}</CardTitle>
                      <CardDescription className="text-sm">
                        {card.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center text-sm">
                        {Object.entries(card.metrics).map(([key, value]) => (
                          <div key={key} className="text-center">
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {value}
                            </div>
                            <div className="text-gray-500 capitalize">
                              {key}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Link>
                ) : (
                  <div className="h-full">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className={`p-2 rounded-lg ${card.color} text-white opacity-60`}>
                          <IconComponent className="w-6 h-6" />
                        </div>
                        <Badge variant="outline" className="text-gray-500 border-gray-300">
                          Coming Soon
                        </Badge>
                      </div>
                      <CardTitle className="text-xl text-gray-500">{card.title}</CardTitle>
                      <CardDescription className="text-sm text-gray-400">
                        {card.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center text-sm text-gray-400">
                        {Object.entries(card.metrics).map(([key, value]) => (
                          <div key={key} className="text-center">
                            <div className="font-semibold">
                              {value}
                            </div>
                            <div className="capitalize">
                              {key}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Quick Stats Summary */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Shield className="w-8 h-8 text-blue-500 mr-3" />
                <div>
                  <p className="text-2xl font-bold">13,317</p>
                  <p className="text-gray-600 text-sm">Guardian Events</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CreditCard className="w-8 h-8 text-green-500 mr-3" />
                <div>
                  <p className="text-2xl font-bold">75,000+</p>
                  <p className="text-gray-600 text-sm">Payment Records</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertTriangle className="w-8 h-8 text-orange-500 mr-3" />
                <div>
                  {isLoading ? (
                    <p className="text-2xl font-bold text-gray-400">Loading...</p>
                  ) : (
                    <p className="text-2xl font-bold">{fleetStats.averageSafetyScore}/10</p>
                  )}
                  <p className="text-gray-600 text-sm">Avg Safety Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="w-8 h-8 text-teal-500 mr-3" />
                <div>
                  {isLoading ? (
                    <p className="text-2xl font-bold text-gray-400">Loading...</p>
                  ) : (
                    <p className="text-2xl font-bold">{fleetStats.totalVehicles}</p>
                  )}
                  <p className="text-gray-600 text-sm">Total Vehicles</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Additional Fleet Insights */}
        {!isLoading && vehicles.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{fleetStats.activeVehicles}</p>
                    <p className="text-gray-600 text-sm">Active Vehicles</p>
                  </div>
                  <div className="text-green-500">
                    {Math.round((fleetStats.activeVehicles / fleetStats.totalVehicles) * 100)}%
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{fleetStats.averageEfficiency} km/L</p>
                    <p className="text-gray-600 text-sm">Avg Fuel Efficiency</p>
                  </div>
                  <div className="text-blue-500">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      {vehicles.filter(v => v.fleet === 'Stevemacs').length} / {vehicles.filter(v => v.fleet === 'Great Southern Fuels').length}
                    </p>
                    <p className="text-gray-600 text-sm">Stevemacs / GSF</p>
                  </div>
                  <div className="text-purple-500">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DataCentreLayout>
  );
};

export default DataCentrePage;