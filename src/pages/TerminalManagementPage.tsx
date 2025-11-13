import React, { useState } from 'react';
import { Plus, Edit, Trash2, MapPin, AlertCircle, Database } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import TerminalEditModal from '@/components/TerminalEditModal';
import { useTerminals, useDeleteTerminal, useTerminalTableExists } from '@/hooks/useTerminals';
import type { Terminal } from '@/api/terminals';

export default function TerminalManagementPage() {
  const { data: terminals, isLoading } = useTerminals();
  const { data: tableExists, isLoading: checkingTable } = useTerminalTableExists();
  const deleteMutation = useDeleteTerminal();

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editMode, setEditMode] = useState<'create' | 'edit'>('create');
  const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [terminalToDelete, setTerminalToDelete] = useState<Terminal | null>(null);

  const handleCreate = () => {
    setSelectedTerminal(null);
    setEditMode('create');
    setEditModalOpen(true);
  };

  const handleEdit = (terminal: Terminal) => {
    setSelectedTerminal(terminal);
    setEditMode('edit');
    setEditModalOpen(true);
  };

  const handleDeleteClick = (terminal: Terminal) => {
    setTerminalToDelete(terminal);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (terminalToDelete) {
      await deleteMutation.mutateAsync(terminalToDelete.id);
      setDeleteDialogOpen(false);
      setTerminalToDelete(null);
    }
  };

  // Show migration instructions if table doesn't exist
  if (!checkingTable && !tableExists) {
    return (
      <div className="flex-1 space-y-6 p-8 pt-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Terminal Management</h2>
          <p className="text-muted-foreground mt-2">
            Manage terminal locations, GPS coordinates, and service areas
          </p>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Terminal Table Not Found</AlertTitle>
          <AlertDescription>
            <p className="mb-4">
              The terminal_locations table has not been created in the database yet.
              Please run the migration to create the table and populate it with initial data.
            </p>
            <div className="bg-black/10 p-3 rounded font-mono text-sm mt-2">
              Run the SQL migration file:<br />
              <code>database/migrations/create_terminal_locations_lookup.sql</code>
            </div>
            <p className="mt-4 text-sm">
              This will create the table and populate it with 12 pre-configured terminals
              including Kewdale, Geraldton, Kalgoorlie, and more.
            </p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const activeTerminals = terminals?.filter(t => t.active).length || 0;
  const inactiveTerminals = terminals?.filter(t => !t.active).length || 0;

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Terminal Management</h2>
          <p className="text-muted-foreground mt-2">
            Manage terminal locations, GPS coordinates, and service areas
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Terminal
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Terminals</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{terminals?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {activeTerminals} active, {inactiveTerminals} inactive
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SMB Terminals</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {terminals?.filter(t => t.carrier_primary === 'SMB').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Stevemacs Business operations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">GSF Terminals</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {terminals?.filter(t => t.carrier_primary === 'GSF').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Great Southern Fuels network
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Terminals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Terminals</CardTitle>
          <CardDescription>
            View and manage all terminal locations in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : terminals && terminals.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Terminal Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Service Radius</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {terminals.map((terminal) => (
                    <TableRow key={terminal.id}>
                      <TableCell className="font-medium">
                        {terminal.terminal_name}
                      </TableCell>
                      <TableCell>
                        {terminal.terminal_code || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {terminal.terminal_type}
                      </TableCell>
                      <TableCell>
                        <Badge variant={terminal.carrier_primary === 'SMB' ? 'default' : 'secondary'}>
                          {terminal.carrier_primary || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {terminal.latitude.toFixed(4)}, {terminal.longitude.toFixed(4)}
                      </TableCell>
                      <TableCell>
                        {terminal.service_radius_km} km
                      </TableCell>
                      <TableCell>
                        <Badge variant={terminal.active ? 'default' : 'outline'}>
                          {terminal.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(terminal)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(terminal)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No terminals found. Click "Add Terminal" to create one.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <TerminalEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        terminal={selectedTerminal}
        mode={editMode}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Terminal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{terminalToDelete?.terminal_name}"?
              This action cannot be undone and may affect trip-to-terminal correlations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
