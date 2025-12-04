import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  Mail,
  Fuel,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  EyeOff,
  Key,
  UserPlus,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { generateSecurePassword } from '@/utils/passwordGenerator';

interface CustomerAccount {
  id: string;
  user_id: string | null;
  customer_name: string;
  customer_guid: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  company_name: string | null;
  account_type: string;
  is_active: boolean;
  email_notifications: boolean;
  created_at: string;
  last_login_at: string | null;
  assigned_tank_count?: number;
}

export default function CustomerAccountManagement() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CustomerAccount | null>(null);
  const [showTankAssignment, setShowTankAssignment] = useState<CustomerAccount | null>(null);
  const [showCreateLogin, setShowCreateLogin] = useState<CustomerAccount | null>(null);

  // Fetch customer accounts
  const { data: accounts, isLoading } = useQuery({
    queryKey: ['customer-accounts-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_accounts')
        .select(`
          *,
          customer_tank_access (count)
        `)
        .eq('account_type', 'customer')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching customer accounts:', error);
        throw error;
      }

      return (data || []).map((acc: any) => ({
        ...acc,
        assigned_tank_count: acc.customer_tank_access?.[0]?.count || 0,
      })) as CustomerAccount[];
    },
  });

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    if (!searchQuery) return accounts || [];
    const query = searchQuery.toLowerCase();
    return (accounts || []).filter(
      (acc) =>
        acc.customer_name.toLowerCase().includes(query) ||
        (acc.contact_name || '').toLowerCase().includes(query) ||
        (acc.company_name || '').toLowerCase().includes(query)
    );
  }, [accounts, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const all = accounts || [];
    return {
      total: all.length,
      active: all.filter((a) => a.is_active).length,
      recentLogin: all.filter((a) => {
        if (!a.last_login_at) return false;
        const diff = Date.now() - new Date(a.last_login_at).getTime();
        return diff < 7 * 24 * 60 * 60 * 1000; // 7 days
      }).length,
    };
  }, [accounts]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="h-6 w-6" />
            Customer Account Management
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage customer portal access and tank assignments
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus size={16} />
          Add Customer
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Customers" value={stats.total} icon={Users} color="blue" />
        <StatCard label="Active" value={stats.active} icon={CheckCircle} color="green" />
        <StatCard label="Recent Login (7d)" value={stats.recentLogin} icon={Clock} color="purple" />
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Customer Accounts</span>
            <Badge variant="outline">{filteredAccounts.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAccounts.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No customer accounts found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Tanks</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((account) => (
                    <AccountRow
                      key={account.id}
                      account={account}
                      onEdit={() => setEditingAccount(account)}
                      onAssignTanks={() => setShowTankAssignment(account)}
                      onCreateLogin={() => setShowCreateLogin(account)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      {(showCreateDialog || editingAccount) && (
        <CustomerAccountDialog
          account={editingAccount}
          onClose={() => {
            setShowCreateDialog(false);
            setEditingAccount(null);
          }}
        />
      )}

      {/* Tank Assignment Dialog */}
      {showTankAssignment && (
        <TankAssignmentDialog
          account={showTankAssignment}
          onClose={() => setShowTankAssignment(null)}
        />
      )}

      {/* Create Login Dialog */}
      {showCreateLogin && (
        <CreateLoginDialog
          account={showCreateLogin}
          onClose={() => setShowCreateLogin(null)}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'purple';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <div className={cn('p-2 rounded-lg', colorClasses[color])}>
            <Icon size={20} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AccountRow({
  account,
  onEdit,
  onAssignTanks,
  onCreateLogin,
}: {
  account: CustomerAccount;
  onEdit: () => void;
  onAssignTanks: () => void;
  onCreateLogin: () => void;
}) {
  const hasLogin = !!account.user_id;

  return (
    <TableRow>
      <TableCell>
        <div>
          <p className="font-medium">{account.customer_name}</p>
          {account.company_name && (
            <p className="text-sm text-gray-500">{account.company_name}</p>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div>
          <p>{account.contact_name || 'N/A'}</p>
          {account.contact_phone && (
            <p className="text-sm text-gray-500">{account.contact_phone}</p>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="gap-1">
          <Fuel size={12} />
          {account.assigned_tank_count || 0}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <Badge
            className={cn(
              account.is_active
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            )}
          >
            {account.is_active ? 'Active' : 'Inactive'}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              'text-xs',
              hasLogin
                ? 'border-green-300 text-green-700'
                : 'border-orange-300 text-orange-700'
            )}
          >
            {hasLogin ? 'Has Login' : 'No Login'}
          </Badge>
        </div>
      </TableCell>
      <TableCell>
        {account.last_login_at
          ? new Date(account.last_login_at).toLocaleDateString()
          : 'Never'}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          {!hasLogin && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCreateLogin}
              className="text-orange-600 border-orange-300 hover:bg-orange-50"
            >
              <UserPlus size={14} className="mr-1" />
              Create Login
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onAssignTanks}>
            <Fuel size={14} className="mr-1" />
            Tanks
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Edit size={14} />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function CustomerAccountDialog({
  account,
  onClose,
}: {
  account: CustomerAccount | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    customer_name: account?.customer_name || '',
    contact_name: account?.contact_name || '',
    contact_phone: account?.contact_phone || '',
    company_name: account?.company_name || '',
    is_active: account?.is_active ?? true,
    email_notifications: account?.email_notifications ?? true,
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    password: string;
    portalUrl: string;
  } | null>(null);
  const isEditing = !!account;

  const handleGeneratePassword = () => {
    const newPassword = generateSecurePassword(12);
    setPassword(newPassword);
    setShowPassword(true); // Show the generated password
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (account) {
        // Update existing
        const { error } = await supabase
          .from('customer_accounts')
          .update({
            customer_name: formData.customer_name,
            contact_name: formData.contact_name,
            contact_phone: formData.contact_phone,
            company_name: formData.company_name,
            is_active: formData.is_active,
            email_notifications: formData.email_notifications,
          })
          .eq('id', account.id);

        if (error) throw error;
        toast.success('Customer updated successfully');
      } else {
        // Create new customer with login credentials
        if (!email || !password) {
          toast.error('Email and password are required for new customers');
          setSaving(false);
          return;
        }

        if (password.length < 6) {
          toast.error('Password must be at least 6 characters');
          setSaving(false);
          return;
        }

        // Step 1: Create the customer account record first
        const { data: newAccount, error: insertError } = await supabase
          .from('customer_accounts')
          .insert({
            customer_name: formData.customer_name,
            contact_name: formData.contact_name,
            contact_phone: formData.contact_phone,
            company_name: formData.company_name,
            is_active: formData.is_active,
            email_notifications: formData.email_notifications,
            account_type: 'customer',
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Step 2: Create auth user via API route
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('Not authenticated');
        }

        const response = await fetch('/api/admin/create-customer-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email,
            password,
            customerAccountId: newAccount.id,
            customerName: formData.customer_name,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          // Delete the customer account if user creation failed
          await supabase.from('customer_accounts').delete().eq('id', newAccount.id);
          throw new Error(result.error || 'Failed to create login credentials');
        }

        // Show credentials dialog instead of just toast
        setCreatedCredentials({
          email,
          password,
          portalUrl: window.location.origin + '/customer',
        });
        setShowCredentials(true);
      }

      queryClient.invalidateQueries({ queryKey: ['customer-accounts-admin'] });
    } catch (error) {
      console.error('Error saving customer:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  // If showing credentials, render that instead
  if (showCredentials && createdCredentials) {
    return (
      <CredentialsDisplayDialog
        credentials={createdCredentials}
        customerName={formData.customer_name}
        onClose={() => {
          setShowCredentials(false);
          setCreatedCredentials(null);
          onClose(); // Close the parent dialog too
        }}
      />
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{account ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
          <DialogDescription>
            {account
              ? 'Update customer account details'
              : 'Create a new customer portal account'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Customer Name *</Label>
            <Input
              value={formData.customer_name}
              onChange={(e) =>
                setFormData({ ...formData, customer_name: e.target.value })
              }
              placeholder="Enter customer name"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Company Name</Label>
            <Input
              value={formData.company_name}
              onChange={(e) =>
                setFormData({ ...formData, company_name: e.target.value })
              }
              placeholder="Enter company name"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Contact Name</Label>
              <Input
                value={formData.contact_name}
                onChange={(e) =>
                  setFormData({ ...formData, contact_name: e.target.value })
                }
                placeholder="Contact person"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={formData.contact_phone}
                onChange={(e) =>
                  setFormData({ ...formData, contact_phone: e.target.value })
                }
                placeholder="Phone number"
                className="mt-1"
              />
            </div>
          </div>

          {/* Login Credentials - only for new customers */}
          {!isEditing && (
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                <Key size={14} />
                Login Credentials
              </h4>
              <div className="space-y-3">
                <div>
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="customer@example.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Password *</Label>
                  <div className="flex gap-2 mt-1">
                    <div className="relative flex-1">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGeneratePassword}
                      className="gap-1"
                    >
                      <Key size={14} />
                      Generate
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Customer will use this email and password to log in
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label>Active Account</Label>
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_active: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Email Notifications</Label>
            <Switch
              checked={formData.email_notifications}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, email_notifications: checked })
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              saving ||
              !formData.customer_name ||
              (!isEditing && (!email || !password || password.length < 6))
            }
          >
            {saving ? 'Saving...' : isEditing ? 'Save' : 'Create Customer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type AccessLevel = 'read' | 'request_delivery' | 'admin';

function TankAssignmentDialog({
  account,
  onClose,
}: {
  account: CustomerAccount;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [tankAccess, setTankAccess] = useState<Map<string, AccessLevel>>(new Map());
  const [copyFromAccount, setCopyFromAccount] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all AgBot locations
  const { data: allTanks, isLoading: tanksLoading } = useQuery({
    queryKey: ['agbot-locations-for-assignment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ta_agbot_locations')
        .select('id, name, address, customer_name, calibrated_fill_level, is_disabled')
        .eq('is_disabled', false)
        .order('customer_name');

      if (error) throw error;
      // Map new column names to old interface for compatibility
      return (data || []).map(d => ({
        id: d.id,
        location_id: d.name,
        address1: d.address,
        customer_name: d.customer_name,
        latest_calibrated_fill_percentage: d.calibrated_fill_level,
        disabled: d.is_disabled
      }));
    },
  });

  // Fetch all customer accounts for "copy from" dropdown
  const { data: otherAccounts } = useQuery({
    queryKey: ['other-customer-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_accounts')
        .select('id, customer_name, contact_name')
        .eq('account_type', 'customer')
        .neq('id', account.id)
        .order('customer_name');

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch current assignments
  const { data: currentAssignments } = useQuery({
    queryKey: ['tank-assignments', account.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_tank_access')
        .select('agbot_location_id, access_level')
        .eq('customer_account_id', account.id);

      if (error) throw error;
      return data || [];
    },
  });

  // Initialize tank access from current assignments
  React.useEffect(() => {
    if (currentAssignments) {
      const accessMap = new Map<string, AccessLevel>();
      currentAssignments.forEach((a) => {
        accessMap.set(a.agbot_location_id, a.access_level as AccessLevel);
      });
      setTankAccess(accessMap);
    }
  }, [currentAssignments]);

  // Handle copy from another account
  React.useEffect(() => {
    if (copyFromAccount) {
      const fetchTankAccess = async () => {
        const { data, error } = await supabase
          .from('customer_tank_access')
          .select('agbot_location_id, access_level')
          .eq('customer_account_id', copyFromAccount);

        if (!error && data) {
          const accessMap = new Map<string, AccessLevel>();
          data.forEach((a) => {
            accessMap.set(a.agbot_location_id, a.access_level as AccessLevel);
          });
          setTankAccess(accessMap);
          toast.success(`Copied ${data.length} tank assignments`);
        }
      };

      fetchTankAccess();
    }
  }, [copyFromAccount]);

  const handleToggleTank = (tankId: string) => {
    const newMap = new Map(tankAccess);
    if (newMap.has(tankId)) {
      newMap.delete(tankId);
    } else {
      newMap.set(tankId, 'request_delivery'); // Default access level
    }
    setTankAccess(newMap);
  };

  const handleChangeAccessLevel = (tankId: string, level: AccessLevel) => {
    const newMap = new Map(tankAccess);
    newMap.set(tankId, level);
    setTankAccess(newMap);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete existing assignments
      await supabase
        .from('customer_tank_access')
        .delete()
        .eq('customer_account_id', account.id);

      // Insert new assignments
      if (tankAccess.size > 0) {
        const assignments = Array.from(tankAccess.entries()).map(([tankId, accessLevel]) => ({
          customer_account_id: account.id,
          agbot_location_id: tankId,
          access_level: accessLevel,
        }));

        const { error } = await supabase
          .from('customer_tank_access')
          .insert(assignments);

        if (error) throw error;
      }

      toast.success(`Assigned ${tankAccess.size} tanks to customer`);
      queryClient.invalidateQueries({ queryKey: ['customer-accounts-admin'] });
      queryClient.invalidateQueries({ queryKey: ['tank-assignments'] });
      onClose();
    } catch (error) {
      console.error('Error saving assignments:', error);
      toast.error('Failed to save tank assignments');
    } finally {
      setSaving(false);
    }
  };

  // Filter tanks by search query
  const filteredTanks = useMemo(() => {
    if (!searchQuery) return allTanks || [];
    const query = searchQuery.toLowerCase();
    return (allTanks || []).filter(
      (tank) =>
        tank.location_id?.toLowerCase().includes(query) ||
        tank.address1?.toLowerCase().includes(query) ||
        tank.customer_name?.toLowerCase().includes(query)
    );
  }, [allTanks, searchQuery]);

  // Group filtered tanks by customer
  const tanksByCustomer = useMemo(() => {
    const grouped = new Map<string, typeof allTanks>();
    for (const tank of filteredTanks || []) {
      const customer = tank.customer_name || 'Unknown';
      if (!grouped.has(customer)) {
        grouped.set(customer, []);
      }
      grouped.get(customer)!.push(tank);
    }
    return grouped;
  }, [filteredTanks]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Assign Tanks - {account.customer_name}</DialogTitle>
          <DialogDescription>
            Select which tanks this customer can access and set permission levels
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pb-4">
          {/* Copy from existing user */}
          <div>
            <Label className="text-sm font-medium">Quick Assign</Label>
            <Select value={copyFromAccount} onValueChange={setCopyFromAccount}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Copy tank access from another user..." />
              </SelectTrigger>
              <SelectContent>
                {otherAccounts?.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.contact_name || acc.customer_name} ({acc.customer_name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search tanks */}
          <div>
            <Label className="text-sm font-medium">Search Tanks</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, address, or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tanksLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(tanksByCustomer.entries()).map(([customerName, tanks]) => (
                <div key={customerName} className="border rounded-lg p-3">
                  <h4 className="font-medium text-sm text-gray-500 mb-2">
                    {customerName} ({tanks.length} tanks)
                  </h4>
                  <div className="space-y-1">
                    {tanks.map((tank) => (
                      <div
                        key={tank.id}
                        className={cn(
                          'flex items-center gap-2 p-2 rounded transition-colors',
                          tankAccess.has(tank.id)
                            ? 'bg-green-50 dark:bg-green-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={tankAccess.has(tank.id)}
                          onChange={() => handleToggleTank(tank.id)}
                          className="rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {tank.location_id || tank.address1}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {tank.address1}
                          </p>
                        </div>
                        <Select
                          value={tankAccess.get(tank.id) || 'read'}
                          onValueChange={(value) => handleChangeAccessLevel(tank.id, value as AccessLevel)}
                          disabled={!tankAccess.has(tank.id)}
                        >
                          <SelectTrigger className="w-40 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="read">Read Only</SelectItem>
                            <SelectItem value="request_delivery">Request Delivery</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <Badge variant="outline" className="text-xs">
                          {(tank.latest_calibrated_fill_percentage || 0).toFixed(0)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <div className="flex items-center justify-between w-full">
            <span className="text-sm text-gray-500">
              {tankAccess.size} tanks selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Assignments'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateLoginDialog({
  account,
  onClose,
}: {
  account: CustomerAccount;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    password: string;
    portalUrl: string;
  } | null>(null);

  const handleGeneratePassword = () => {
    const newPassword = generateSecurePassword(12);
    setPassword(newPassword);
    setShowPassword(true); // Show the generated password
  };

  // If showing credentials, render that instead
  if (showCredentials && createdCredentials) {
    return (
      <CredentialsDisplayDialog
        credentials={createdCredentials}
        customerName={account.customer_name}
        onClose={() => {
          setShowCredentials(false);
          setCreatedCredentials(null);
          onClose(); // Close the parent dialog too
        }}
      />
    );
  }

  const handleCreate = async () => {
    if (!email || !password) {
      toast.error('Email and password are required');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/admin/create-customer-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email,
          password,
          customerAccountId: account.id,
          customerName: account.customer_name,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create login credentials');
      }

      // Show credentials dialog instead of just toast
      setCreatedCredentials({
        email,
        password,
        portalUrl: window.location.origin + '/customer',
      });
      setShowCredentials(true);

      queryClient.invalidateQueries({ queryKey: ['customer-accounts-admin'] });
    } catch (error) {
      console.error('Error creating login:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create login');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus size={18} />
            Create Login for {account.customer_name}
          </DialogTitle>
          <DialogDescription>
            Set up email and password so this customer can access the portal
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Email *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Password *</Label>
            <div className="flex gap-2 mt-1">
              <div className="relative flex-1">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleGeneratePassword}
                className="gap-1"
              >
                <Key size={14} />
                Generate
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              You'll need to share these credentials with the customer
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={saving || !email || !password || password.length < 6}
          >
            {saving ? 'Creating...' : 'Create Login'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Credentials Display Dialog
// ============================================================================
function CredentialsDisplayDialog({
  credentials,
  customerName,
  onClose,
}: {
  credentials: { email: string; password: string; portalUrl: string };
  customerName: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCopyAll = () => {
    const text = `
Customer Portal Login Credentials
Customer: ${customerName}

Portal URL: ${credentials.portalUrl}
Email: ${credentials.email}
Password: ${credentials.password}

IMPORTANT:
• Share these credentials securely with the customer
• Do not send via email (use phone or secure message)
• Customer will be required to change password on first login
    `.trim();

    navigator.clipboard.writeText(text);
    toast.success('All credentials copied to clipboard');
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle size={24} />
            <DialogTitle>Account Created Successfully</DialogTitle>
          </div>
          <DialogDescription>
            Login credentials for {customerName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Portal URL */}
          <CredentialField
            label="Portal URL"
            value={credentials.portalUrl}
            onCopy={() => handleCopy(credentials.portalUrl, 'url')}
            copied={copied === 'url'}
          />

          {/* Email */}
          <CredentialField
            label="Email"
            value={credentials.email}
            onCopy={() => handleCopy(credentials.email, 'email')}
            copied={copied === 'email'}
          />

          {/* Password */}
          <CredentialField
            label="Password"
            value={credentials.password}
            onCopy={() => handleCopy(credentials.password, 'password')}
            copied={copied === 'password'}
            isPassword
          />

          {/* Warning message */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
            <p className="text-sm text-amber-900 dark:text-amber-100 font-medium flex items-center gap-2">
              <AlertTriangle size={16} />
              Important
            </p>
            <ul className="text-xs text-amber-800 dark:text-amber-200 mt-2 space-y-1 ml-6 list-disc">
              <li>Share these credentials securely with the customer</li>
              <li>Do not send via email (use phone or secure message)</li>
              <li>Customer will be required to change password on first login</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCopyAll} className="gap-2">
            <Copy size={16} />
            Copy All
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CredentialField({
  label,
  value,
  onCopy,
  copied,
  isPassword,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  isPassword?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <Label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">
        {label}
      </Label>
      <div className="mt-1 flex gap-2">
        <Input
          type={isPassword && !showPassword ? 'password' : 'text'}
          value={value}
          readOnly
          className="font-mono text-sm bg-gray-50 dark:bg-gray-900"
        />
        {isPassword && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPassword(!showPassword)}
            type="button"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onCopy} className="gap-1" type="button">
          {copied ? (
            <>
              <Check size={14} className="text-green-600" />
              <span className="text-green-600">Copied</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              Copy
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
