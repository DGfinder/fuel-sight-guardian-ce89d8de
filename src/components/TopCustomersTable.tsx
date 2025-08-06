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
  Users, 
  Search, 
  ArrowUpDown, 
  TrendingUp, 
  Download,
  Eye
} from 'lucide-react';
import { CustomerAnalytics } from '@/types/captivePayments';
// TODO: Will integrate mtdata API for real trip distance data in the future

interface TopCustomersTableProps {
  customers: CustomerAnalytics[];
  totalDeliveries: number;
  onCustomerClick: (customer: CustomerAnalytics) => void;
  isLoading?: boolean;
  className?: string;
}

type SortField = 'customer' | 'total_deliveries' | 'total_volume_megalitres' | 'avg_delivery' | 'percentage';
type SortDirection = 'asc' | 'desc';

const TopCustomersTable: React.FC<TopCustomersTableProps> = ({
  customers,
  totalDeliveries,
  onCustomerClick,
  isLoading = false,
  className
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('total_volume_megalitres');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedAndFilteredCustomers = useMemo(() => {
    const filtered = customers.filter(customer =>
      customer.customer.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortField) {
        case 'customer':
          aValue = a.customer;
          bValue = b.customer;
          break;
        case 'total_deliveries':
          aValue = a.total_deliveries;
          bValue = b.total_deliveries;
          break;
        case 'total_volume_megalitres':
          aValue = a.total_volume_megalitres;
          bValue = b.total_volume_megalitres;
          break;
        case 'avg_delivery':
          aValue = a.total_volume_litres / a.total_deliveries;
          bValue = b.total_volume_litres / b.total_deliveries;
          break;
        case 'percentage':
          aValue = (a.total_deliveries / totalDeliveries) * 100;
          bValue = (b.total_deliveries / totalDeliveries) * 100;
          break;
        default:
          aValue = a.total_volume_megalitres;
          bValue = b.total_volume_megalitres;
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
  }, [customers, searchTerm, sortField, sortDirection, totalDeliveries]);

  const handleExportCSV = () => {
    const csvData = sortedAndFilteredCustomers.map((customer, index) => {
      const percentage = ((customer.total_deliveries / totalDeliveries) * 100).toFixed(1);
      const avgDelivery = (customer.total_volume_litres / customer.total_deliveries).toFixed(0);
      
      const primaryTerminal = customer.terminals_list?.[0] || 'Kewdale';
      
      return {
        Rank: index + 1,
        Customer: customer.customer,
        'Total Deliveries': customer.total_deliveries,
        'Volume (ML)': customer.total_volume_megalitres.toFixed(2),
        'Volume (L)': customer.total_volume_litres.toLocaleString(),
        'Avg per Delivery (L)': avgDelivery,
        'Percentage of Total': `${percentage}%`,
        'Primary Terminal': primaryTerminal,
        'Terminals Served': customer.terminals_served,
        'First Delivery': customer.first_delivery_date,
        'Last Delivery': customer.last_delivery_date
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
    a.download = `smb-top-customers-${new Date().toISOString().split('T')[0]}.csv`;
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
            <Users className="w-5 h-5" />
            Top SMB Customers
          </CardTitle>
          <CardDescription>Loading customer data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array(8).fill(0).map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="h-12 bg-gray-200 rounded"></div>
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
              <Users className="w-5 h-5" />
              Top SMB Customers
            </CardTitle>
            <CardDescription>
              Highest volume customers served by SMB ({sortedAndFilteredCustomers.length} customers)
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
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          {searchTerm && (
            <Badge variant="secondary" className="text-xs">
              {sortedAndFilteredCustomers.length} found
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
                  <SortButton field="customer">Customer</SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="total_deliveries">Deliveries</SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="total_volume_megalitres">Volume (ML)</SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="avg_delivery">Avg/Delivery</SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="percentage">% of Total</SortButton>
                </TableHead>
                <TableHead className="text-center w-20">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAndFilteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    {searchTerm ? 'No customers found matching your search' : 'No customer data available'}
                  </TableCell>
                </TableRow>
              ) : (
                sortedAndFilteredCustomers.map((customer, index) => {
                  const percentage = ((customer.total_deliveries / totalDeliveries) * 100).toFixed(1);
                  const avgDelivery = (customer.total_volume_litres / customer.total_deliveries).toFixed(0);
                  
                  const primaryTerminal = customer.terminals_list?.[0] || 'Kewdale';
                  
                  return (
                    <TableRow 
                      key={customer.customer} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => onCustomerClick(customer)}
                    >
                      <TableCell>
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-medium text-blue-700">
                          {index + 1}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-gray-900">{customer.customer}</div>
                          <div className="text-xs text-gray-500">
                            Primary terminal: {primaryTerminal}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium">{customer.total_deliveries.toLocaleString()}</div>
                        {customer.deliveries_last_30_days > 0 && (
                          <div className="text-xs text-green-600 flex items-center justify-end gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {customer.deliveries_last_30_days} in 30d
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium">{customer.total_volume_megalitres.toFixed(2)}</div>
                        <div className="text-xs text-gray-500">
                          {customer.total_volume_litres.toLocaleString()}L
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-medium">{avgDelivery}L</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="text-xs">
                          {percentage}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCustomerClick(customer);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="sr-only">View details</span>
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
        {sortedAndFilteredCustomers.length > 0 && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Total Customers</div>
                <div className="font-medium">{sortedAndFilteredCustomers.length}</div>
              </div>
              <div>
                <div className="text-gray-500">Total Deliveries</div>
                <div className="font-medium">
                  {sortedAndFilteredCustomers.reduce((sum, c) => sum + c.total_deliveries, 0).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Total Volume</div>
                <div className="font-medium">
                  {sortedAndFilteredCustomers.reduce((sum, c) => sum + c.total_volume_megalitres, 0).toFixed(1)}ML
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TopCustomersTable;