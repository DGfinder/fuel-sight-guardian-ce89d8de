import React, { useState, useMemo } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Building, 
  Search, 
  ArrowUpDown, 
  TrendingUp, 
  Download,
  Eye,
  Users,
  Package
} from 'lucide-react';
import type { TerminalAnalytics } from '@/api/captivePayments';

interface TerminalPerformanceTableProps {
  terminals: TerminalAnalytics[];
  totalDeliveries: number;
  onTerminalClick: (terminal: TerminalAnalytics) => void;
  isLoading?: boolean;
  className?: string;
  carrier?: string;
}

type SortField = 'terminal' | 'total_deliveries' | 'total_volume_megalitres' | 'percentage_of_carrier_volume' | 'unique_customers' | 'deliveries_last_30_days';
type SortDirection = 'asc' | 'desc';

const TerminalPerformanceTable: React.FC<TerminalPerformanceTableProps> = ({
  terminals,
  totalDeliveries,
  onTerminalClick,
  isLoading = false,
  className,
  carrier = 'SMB'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('percentage_of_carrier_volume');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedAndFilteredTerminals = useMemo(() => {
    const filtered = terminals.filter(terminal =>
      terminal.terminal.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortField) {
        case 'terminal':
          aValue = a.terminal;
          bValue = b.terminal;
          break;
        case 'total_deliveries':
          aValue = a.total_deliveries;
          bValue = b.total_deliveries;
          break;
        case 'total_volume_megalitres':
          aValue = a.total_volume_megalitres;
          bValue = b.total_volume_megalitres;
          break;
        case 'percentage_of_carrier_volume':
          aValue = a.percentage_of_carrier_volume;
          bValue = b.percentage_of_carrier_volume;
          break;
        case 'unique_customers':
          aValue = a.unique_customers;
          bValue = b.unique_customers;
          break;
        case 'deliveries_last_30_days':
          aValue = a.deliveries_last_30_days;
          bValue = b.deliveries_last_30_days;
          break;
        default:
          aValue = a.percentage_of_carrier_volume;
          bValue = b.percentage_of_carrier_volume;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc' 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

    return filtered;
  }, [terminals, searchTerm, sortField, sortDirection]);

  const handleExportCSV = () => {
    const csvData = sortedAndFilteredTerminals.map((terminal, index) => {
      const avgDeliverySize = terminal.total_deliveries > 0 
        ? (terminal.total_volume_litres / terminal.total_deliveries).toFixed(0) 
        : '0';
      
      return {
        Rank: index + 1,
        Terminal: terminal.terminal,
        Carrier: terminal.carrier,
        'Total Deliveries': terminal.total_deliveries,
        'Volume (ML)': terminal.total_volume_megalitres.toFixed(2),
        'Volume (L)': terminal.total_volume_litres.toLocaleString(),
        'Percentage of Carrier Volume': `${terminal.percentage_of_carrier_volume.toFixed(1)}%`,
        'Unique Customers': terminal.unique_customers,
        'Avg per Delivery (L)': avgDeliverySize,
        'Deliveries Last 30 Days': terminal.deliveries_last_30_days,
        'First Delivery': terminal.first_delivery_date,
        'Last Delivery': terminal.last_delivery_date
      };
    });

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${carrier.toLowerCase()}-terminal-performance-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const SortButton: React.FC<{ field: SortField; children: React.ReactNode }> = ({ field, children }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-0 font-medium hover:bg-transparent"
      onClick={() => handleSort(field)}
    >
      <span className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="w-3 h-3" />
      </span>
    </Button>
  );

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            Terminal Performance
          </CardTitle>
          <CardDescription>Loading terminal data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array(5).fill(0).map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="h-16 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              Terminal Performance
            </CardTitle>
            <CardDescription>
              Volume distribution across {carrier} fuel loading terminals ({sortedAndFilteredTerminals.length} terminals)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
        
        {/* Search Filter */}
        <div className="flex items-center gap-2 mt-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search terminals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          {searchTerm && (
            <Badge variant="secondary" className="text-xs">
              {sortedAndFilteredTerminals.length} found
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>
                  <SortButton field="terminal">Terminal</SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="percentage_of_carrier_volume">% of Volume</SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="total_deliveries">Deliveries</SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="total_volume_megalitres">Volume (ML)</SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="unique_customers">Customers</SortButton>
                </TableHead>
                <TableHead className="text-right">Avg/Delivery</TableHead>
                <TableHead className="text-center w-20">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAndFilteredTerminals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    {searchTerm ? 'No terminals found matching your search' : 'No terminal data available'}
                  </TableCell>
                </TableRow>
              ) : (
                sortedAndFilteredTerminals.map((terminal, index) => {
                  const avgDeliverySize = terminal.total_deliveries > 0 
                    ? (terminal.total_volume_litres / terminal.total_deliveries).toFixed(0)
                    : '0';
                  
                  // Determine terminal status based on recent activity
                  const isActive = terminal.deliveries_last_30_days > 0;
                  const isHighVolume = terminal.percentage_of_carrier_volume > 10;
                  
                  return (
                    <TableRow 
                      key={terminal.terminal} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => onTerminalClick(terminal)}
                    >
                      <TableCell>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          isHighVolume ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {index + 1}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-gray-900">{terminal.terminal}</div>
                          <div className="flex items-center gap-1 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {terminal.carrier}
                            </Badge>
                            {isActive && (
                              <Badge variant="default" className="text-xs bg-green-100 text-green-700 hover:bg-green-100">
                                Active
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-semibold text-blue-600">
                          {terminal.percentage_of_carrier_volume.toFixed(1)}%
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium">{terminal.total_deliveries.toLocaleString()}</div>
                        {terminal.deliveries_last_30_days > 0 && (
                          <div className="text-xs text-green-600 flex items-center justify-end gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {terminal.deliveries_last_30_days} in 30d
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium">{terminal.total_volume_megalitres.toFixed(2)}</div>
                        <div className="text-xs text-gray-500">
                          {terminal.total_volume_litres.toLocaleString()}L
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Users className="w-3 h-3 text-gray-400" />
                          <span className="font-medium">{terminal.unique_customers}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium">{avgDeliverySize}L</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTerminalClick(terminal);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="sr-only">View terminal details</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Summary Stats */}
        {sortedAndFilteredTerminals.length > 0 && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Total Terminals</div>
                <div className="font-medium">{sortedAndFilteredTerminals.length}</div>
              </div>
              <div>
                <div className="text-gray-500">Total Deliveries</div>
                <div className="font-medium">
                  {sortedAndFilteredTerminals.reduce((sum, t) => sum + t.total_deliveries, 0).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Total Volume</div>
                <div className="font-medium">
                  {sortedAndFilteredTerminals.reduce((sum, t) => sum + t.total_volume_megalitres, 0).toFixed(1)}ML
                </div>
              </div>
              <div>
                <div className="text-gray-500">Total Customers</div>
                <div className="font-medium">
                  {sortedAndFilteredTerminals.reduce((sum, t) => sum + t.unique_customers, 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TerminalPerformanceTable;