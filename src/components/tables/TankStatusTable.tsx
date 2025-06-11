import PercentBar from './PercentBar';
import { Tank } from '@/types/fuel';

interface TankStatusTableProps {
  rows: Tank[];
  handleTankClick: (tank: Tank) => void;
}

export default function TankStatusTable({ rows, handleTankClick }: TankStatusTableProps) {
  return (
    <table className="w-full">
      <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
        {/* ...columns... */}
      </thead>
      <tbody className="[&>tr:nth-child(even)]:bg-gray-50/50 hover:[&>tr]:bg-gray-50">
        {rows.map(row => (
          <tr
            key={row.id}
            className="cursor-pointer hover:bg-emerald-50 transition-colors"
            onClick={() => handleTankClick(row)}
          >
            {/* ...other cells... */}
            <td className="w-32">
              <PercentBar percent={Math.round(row.current_level_percent * 100)} />
              <span className="text-xs text-gray-700">{Math.round(row.current_level_percent * 100)}%</span>
            </td>
            {/* ...other cells... */}
          </tr>
        ))}
      </tbody>
    </table>
  );
} 