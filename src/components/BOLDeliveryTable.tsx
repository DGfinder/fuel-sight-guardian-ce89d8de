import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  Filter,
  Download,
  Calendar,
  Truck,
  Building,
  User,
  Package,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react';

interface BOLDelivery {
  bolNumber: string;
  carrier: 'SMB' | 'GSF';
  terminal: string;
  customer: string;
  products: string[]; // Multiple products can be in one delivery
  totalQuantity: number; // Sum of all quantities for this BOL
  deliveryDate: string;
  driverName: string;
  vehicleId: string;
  recordCount: number; // Number of CSV rows that make up this delivery
}

interface BOLDeliveryTableProps {
  deliveries: BOLDelivery[];
  title?: string;
  showFilters?: boolean;
  isLoading?: boolean;
  error?: string;
}

const BOLDeliveryTable: React.FC<BOLDeliveryTableProps> = ({
  deliveries,
  title = "BOL Delivery Records",
  showFilters = true,
  isLoading = false,
  error = null
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('all');
  const [terminalFilter, setTerminalFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [dateSort, setDateSort] = useState<'asc' | 'desc' | null>('desc');
  const [volumeSort, setVolumeSort] = useState<'asc' | 'desc' | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Get unique values for filters
  const terminals = useMemo(() => 
    [...new Set(deliveries.map(d => d.terminal))].sort(), [deliveries]);
  const products = useMemo(() => 
    [...new Set(deliveries.flatMap(d => d.products || []))].sort(), [deliveries]); // Flatten products arrays with null safety

  // Filter and sort data
  const filteredAndSortedDeliveries = useMemo(() => {
    let filtered = deliveries.filter(delivery => {
      const matchesSearch = !searchTerm || 
        delivery.bolNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        delivery.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        delivery.driverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        delivery.vehicleId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (delivery.products || []).some(p => p.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCarrier = carrierFilter === 'all' || delivery.carrier === carrierFilter;
      const matchesTerminal = terminalFilter === 'all' || delivery.terminal === terminalFilter;
      const matchesProduct = productFilter === 'all' || (delivery.products || []).includes(productFilter);

      return matchesSearch && matchesCarrier && matchesTerminal && matchesProduct;
    });

    // Apply sorting
    if (dateSort) {
      filtered.sort((a, b) => {
        const dateA = new Date(a.deliveryDate).getTime();
        const dateB = new Date(b.deliveryDate).getTime();
        return dateSort === 'asc' ? dateA - dateB : dateB - dateA;
      });
    } else if (volumeSort) {
      filtered.sort((a, b) => {
        return volumeSort === 'asc' ? a.totalQuantity - b.totalQuantity : b.totalQuantity - a.totalQuantity;
      });
    }

    return filtered;
  }, [deliveries, searchTerm, carrierFilter, terminalFilter, productFilter, dateSort, volumeSort]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedDeliveries.length / itemsPerPage);
  const paginatedDeliveries = filteredAndSortedDeliveries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (column: 'date' | 'volume') => {
    if (column === 'date') {
      setDateSort(dateSort === 'asc' ? 'desc' : 'asc');
      setVolumeSort(null);
    } else {
      setVolumeSort(volumeSort === 'asc' ? 'desc' : 'asc');
      setDateSort(null);
    }
    setCurrentPage(1);
  };

  const handleExport = () => {
    const csvData = filteredAndSortedDeliveries.map(delivery => ({
      'BOL Number': delivery.bolNumber,
      'Carrier': delivery.carrier,
      'Terminal': delivery.terminal,
      'Customer': delivery.customer,
      'Products': (delivery.products || []).join(', '), // Join multiple products with null safety
      'Total Quantity (L)': delivery.totalQuantity,
      'Delivery Date': delivery.deliveryDate,
      'Driver': delivery.driverName,
      'Vehicle': delivery.vehicleId,
      'Record Count': delivery.recordCount // Show how many CSV rows made up this delivery
    }));
    
    console.log('Exporting BOL delivery data:', csvData);
    // In real implementation, this would trigger actual CSV export
  };

  const getCarrierColor = (carrier: string) => {
    switch (carrier) {
      case 'SMB': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'GSF': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setCarrierFilter('all');
    setTerminalFilter('all');
    setProductFilter('all');
    setDateSort('desc');
    setVolumeSort(null);
    setCurrentPage(1);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              {title}
            </CardTitle>
            <CardDescription>
              {filteredAndSortedDeliveries.length} of {deliveries.length} deliveries
              {searchTerm && ` matching "${searchTerm}"`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 pt-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search BOL, customer, driver..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Carrier Filter */}
            <Select value={carrierFilter} onValueChange={setCarrierFilter}>
              <SelectTrigger>
                <Truck className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Carriers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Carriers</SelectItem>
                <SelectItem value="SMB">SMB (Stevemacs)</SelectItem>
                <SelectItem value="GSF">GSF (Great Southern Fuels)</SelectItem>
              </SelectContent>
            </Select>

            {/* Terminal Filter */}
            <Select value={terminalFilter} onValueChange={setTerminalFilter}>
              <SelectTrigger>
                <Building className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Terminals" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Terminals</SelectItem>
                {terminals.map(terminal => (
                  <SelectItem key={terminal} value={terminal}>{terminal}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Product Filter */}
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger>
                <Package className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {products.map(product => (
                  <SelectItem key={product} value={product}>{product}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Reset Filters */}
            <Button variant="outline" onClick={resetFilters} className="w-full">
              <Filter className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">Loading delivery records...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center max-w-md">
              <div className="bg-red-100 rounded-full h-12 w-12 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Deliveries</h3>
              <p className="text-sm text-gray-600 mb-4">{error}</p>
              <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                Try Again
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>BOL Number</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Products</TableHead>
                <TableHead className="text-right">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleSort('volume')}
                    className="font-medium"
                  >
                    Total Quantity (L)
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleSort('date')}
                    className="font-medium"
                  >
                    Date
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>Driver & Vehicle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedDeliveries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <Package className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-sm font-medium">No deliveries found</p>
                      <p className="text-xs">Try adjusting your filters or search criteria</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedDeliveries.map((delivery) => (
                  <TableRow key={`${delivery.bolNumber}-${delivery.deliveryDate}-${delivery.customer}`}>
                    <TableCell className="font-mono font-medium">
                      <div>
                        {delivery.bolNumber || 'N/A'}
                        {delivery.recordCount > 1 && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {delivery.recordCount} lines
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getCarrierColor(delivery.carrier)}>
                        {delivery.carrier}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{delivery.terminal || 'Unknown Terminal'}</div>
                        <div className="text-gray-500">→ {delivery.customer || 'Unknown Customer'}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(delivery.products || []).length > 0 ? (
                          delivery.products.map((product, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {product}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">No products listed</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={delivery.totalQuantity < 0 ? 'text-red-600' : 'text-green-600'}>
                        {delivery.totalQuantity > 0 ? '+' : ''}{delivery.totalQuantity?.toLocaleString() || '0'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="w-3 h-3" />
                        {delivery.deliveryDate ? new Date(delivery.deliveryDate).toLocaleDateString() : 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {delivery.driverName || 'N/A'}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {delivery.vehicleId || 'N/A'}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between space-x-2 py-4">
              <div className="flex items-center space-x-2">
                <p className="text-sm font-medium">Rows per page</p>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => {
                    setItemsPerPage(Number(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {[10, 20, 30, 50, 100].map((pageSize) => (
                      <SelectItem key={pageSize} value={pageSize.toString()}>
                        {pageSize}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-6 lg:space-x-8">
                <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {filteredAndSortedDeliveries.length}
              </div>
              <div className="text-sm text-gray-500">Unique Deliveries</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {filteredAndSortedDeliveries
                  .reduce((sum, d) => sum + Math.max(0, d.totalQuantity), 0)
                  .toLocaleString()}L
              </div>
              <div className="text-sm text-gray-500">Total Volume</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {filteredAndSortedDeliveries.filter(d => d.carrier === 'SMB').length}
              </div>
              <div className="text-sm text-gray-500">SMB Deliveries</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {filteredAndSortedDeliveries.filter(d => d.carrier === 'GSF').length}
              </div>
              <div className="text-sm text-gray-500">GSF Deliveries</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {filteredAndSortedDeliveries
                  .reduce((sum, d) => sum + d.recordCount, 0)
                  .toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">CSV Records</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BOLDeliveryTable;