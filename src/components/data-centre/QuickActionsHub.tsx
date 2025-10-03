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
    <GlassCard variant="subtle" hover onClick={onClick} className="group cursor-pointer border border-slate-200/50 dark:border-slate-700/50">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 transition-all duration-300 group-hover:bg-slate-200 dark:group-hover:bg-slate-700">
          {icon}
        </div>
        <div className="flex-1">
          <h4 className="font-semibold mb-1 text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {title}
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
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
      icon: <Search className="w-5 h-5 text-slate-600 dark:text-slate-400" />,
      title: 'Search Drivers',
      description: 'Find driver profiles and performance data',
      gradient: '',
      onClick: () => navigate('/data-centre/drivers'),
    },
    {
      icon: <Truck className="w-5 h-5 text-slate-600 dark:text-slate-400" />,
      title: 'Fleet Overview',
      description: 'View vehicle stats and assignments',
      gradient: '',
      onClick: () => navigate('/data-centre/fleet'),
    },
    {
      icon: <BarChart3 className="w-5 h-5 text-slate-600 dark:text-slate-400" />,
      title: 'Generate Report',
      description: 'Create custom analytics reports',
      gradient: '',
      onClick: () => navigate('/data-centre/reports'),
    },
    {
      icon: <Activity className="w-5 h-5 text-slate-600 dark:text-slate-400" />,
      title: 'Event Analysis',
      description: 'Deep dive into safety events',
      gradient: '',
      onClick: () => navigate('/data-centre/events'),
    },
    {
      icon: <Upload className="w-5 h-5 text-slate-600 dark:text-slate-400" />,
      title: 'Import Data',
      description: 'Upload new data sources',
      gradient: '',
      onClick: () => navigate('/data-centre/import'),
    },
    {
      icon: <Download className="w-5 h-5 text-slate-600 dark:text-slate-400" />,
      title: 'Export Data',
      description: 'Download datasets and reports',
      gradient: '',
      onClick: () => navigate('/data-centre/export'),
    },
    {
      icon: <Settings className="w-5 h-5 text-slate-600 dark:text-slate-400" />,
      title: 'Data Sources',
      description: 'Configure integration settings',
      gradient: '',
      onClick: () => navigate('/data-centre/sources'),
    },
    {
      icon: <FileText className="w-5 h-5 text-slate-600 dark:text-slate-400" />,
      title: 'Documentation',
      description: 'View API docs and guides',
      gradient: '',
      onClick: () => navigate('/data-centre/docs'),
    },
  ];

  return (
    <div>
      <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-slate-100">Quick Actions</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map((action, index) => (
          <ActionCard key={index} {...action} />
        ))}
      </div>
    </div>
  );
};
