import React from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  FileText,
  Settings,
  Download,
  Upload,
  BarChart3,
  Users,
  Truck,
  Activity,
} from 'lucide-react';

interface ActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
  onClick: () => void;
}

const ActionCard: React.FC<ActionCardProps> = ({
  icon,
  title,
  description,
  gradient,
  onClick,
}) => {
  return (
    <GlassCard variant="subtle" hover onClick={onClick} className="group cursor-pointer">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} transition-transform duration-300 group-hover:scale-110`}>
          {icon}
        </div>
        <div className="flex-1">
          <h4 className="font-semibold mb-1 group-hover:text-primary transition-colors">
            {title}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {description}
          </p>
        </div>
      </div>
    </GlassCard>
  );
};

export const QuickActionsHub: React.FC = () => {
  const navigate = useNavigate();

  const actions = [
    {
      icon: <Search className="w-5 h-5 text-white" />,
      title: 'Search Drivers',
      description: 'Find driver profiles and performance data',
      gradient: 'from-blue-500 to-purple-600',
      onClick: () => navigate('/data-centre/drivers'),
    },
    {
      icon: <Truck className="w-5 h-5 text-white" />,
      title: 'Fleet Overview',
      description: 'View vehicle stats and assignments',
      gradient: 'from-teal-500 to-cyan-600',
      onClick: () => navigate('/data-centre/fleet'),
    },
    {
      icon: <BarChart3 className="w-5 h-5 text-white" />,
      title: 'Generate Report',
      description: 'Create custom analytics reports',
      gradient: 'from-indigo-500 to-blue-600',
      onClick: () => navigate('/data-centre/reports'),
    },
    {
      icon: <Activity className="w-5 h-5 text-white" />,
      title: 'Event Analysis',
      description: 'Deep dive into safety events',
      gradient: 'from-orange-500 to-yellow-500',
      onClick: () => navigate('/data-centre/events'),
    },
    {
      icon: <Upload className="w-5 h-5 text-white" />,
      title: 'Import Data',
      description: 'Upload new data sources',
      gradient: 'from-purple-500 to-pink-600',
      onClick: () => navigate('/data-centre/import'),
    },
    {
      icon: <Download className="w-5 h-5 text-white" />,
      title: 'Export Data',
      description: 'Download datasets and reports',
      gradient: 'from-green-500 to-teal-600',
      onClick: () => navigate('/data-centre/export'),
    },
    {
      icon: <Settings className="w-5 h-5 text-white" />,
      title: 'Data Sources',
      description: 'Configure integration settings',
      gradient: 'from-gray-500 to-gray-600',
      onClick: () => navigate('/data-centre/sources'),
    },
    {
      icon: <FileText className="w-5 h-5 text-white" />,
      title: 'Documentation',
      description: 'View API docs and guides',
      gradient: 'from-cyan-500 to-blue-600',
      onClick: () => navigate('/data-centre/docs'),
    },
  ];

  return (
    <div>
      <h3 className="text-xl font-bold mb-4">Quick Actions</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map((action, index) => (
          <ActionCard key={index} {...action} />
        ))}
      </div>
    </div>
  );
};
