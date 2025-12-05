import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { getValidSessionToken } from '@/lib/auth/tokenValidator';
import { Mail, UserPlus, Power, PowerOff, Edit, Trash2, Send, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Format a timestamp as relative time (e.g., "5 minutes ago")
 */
function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;

  return new Date(timestamp).toLocaleDateString('en-AU');
}

interface Subscription {
  id: string; // subscription ID (customer_contact_tanks.id)
  contact_id: string;
  contact_name: string | null;
  contact_email: string;
  customer_name: string;
  tank_id: string;
  tank_name: string;
  tank_address: string | null;
  tank_fill_level: number | null;
  report_frequency: string;
  preferred_send_hour: number;
  enabled: boolean;
  alert_threshold_percent: number;
  cc_emails: string | null;
  last_email_sent_at: string | null;
  created_at: string;
}

interface Contact {
  id: string;
  contact_email: string;
  contact_name: string | null;
  customer_name: string;
  unsubscribe_token: string;
}

interface Tank {
  id: string;
  name: string;
  address: string | null;
  customer_name: string;
  calibrated_fill_level: number | null;
}

interface CustomerContactsAdminProps {
  className?: string;
}

export default function CustomerContactsAdmin({ className }: CustomerContactsAdminProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);

  // Available contacts and tanks for creating new subscriptions
  const [availableContacts, setAvailableContacts] = useState<Contact[]>([]);
  const [availableTanks, setAvailableTanks] = useState<Tank[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    contact_id: '',
    tank_id: '',
    report_frequency: 'daily',
    preferred_send_hour: 7,
    enabled: true,
    alert_threshold_percent: 30,
    cc_emails: ''
  });

  // Test email state
  const [sendingTestEmail, setSendingTestEmail] = useState<string | null>(null);

  // Form submission state
  const [saving, setSaving] = useState(false);

  // Filter state
  const [filterCustomer, setFilterCustomer] = useState<string>('all');
  const [filterEnabled, setFilterEnabled] = useState<string>('all');
  const [uniqueCustomers, setUniqueCustomers] = useState<string[]>([]);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  useEffect(() => {
    if (isDialogOpen) {
      fetchAvailableContacts();
      fetchAvailableTanks();
    }
  }, [isDialogOpen]);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customer_contact_tanks')
        .select(`
          id,
          customer_contact_id,
          agbot_location_id,
          report_frequency,
          preferred_send_hour,
          enabled,
          alert_threshold_percent,
          cc_emails,
          last_email_sent_at,
          created_at,
          customer_contacts!inner (
            id,
            contact_email,
            contact_name,
            customer_name,
            unsubscribe_token
          ),
          ta_agbot_locations!inner (
            id,
            name,
            address,
            customer_name,
            calibrated_fill_level
          )
        `)
        .order('customer_contacts(customer_name)', { ascending: true })
        .order('ta_agbot_locations(name)', { ascending: true });

      if (error) throw error;

      // Transform data
      const transformedData: Subscription[] = (data || []).map((row: any) => {
        const contact = Array.isArray(row.customer_contacts)
          ? row.customer_contacts[0]
          : row.customer_contacts;
        const tank = Array.isArray(row.ta_agbot_locations)
          ? row.ta_agbot_locations[0]
          : row.ta_agbot_locations;

        return {
          id: row.id,
          contact_id: contact.id,
          contact_name: contact.contact_name,
          contact_email: contact.contact_email,
          customer_name: contact.customer_name,
          tank_id: tank.id,
          tank_name: tank.name,
          tank_address: tank.address,
          tank_fill_level: tank.calibrated_fill_level,
          report_frequency: row.report_frequency || 'daily',
          preferred_send_hour: row.preferred_send_hour ?? 7,
          enabled: row.enabled ?? true,
          alert_threshold_percent: row.alert_threshold_percent ?? 30,
          cc_emails: row.cc_emails,
          last_email_sent_at: row.last_email_sent_at,
          created_at: row.created_at
        };
      });

      setSubscriptions(transformedData);

      // Extract unique customers for filter
      const customers = [...new Set(transformedData.map(s => s.customer_name))];
      setUniqueCustomers(customers.sort());
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      toast.error('Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_contacts')
        .select('id, contact_email, contact_name, customer_name, unsubscribe_token')
        .eq('enabled', true)
        .order('customer_name')
        .order('contact_email');

      if (error) throw error;
      setAvailableContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast.error('Failed to load contacts');
    }
  };

  const fetchAvailableTanks = async () => {
    try {
      const { data, error } = await supabase
        .from('ta_agbot_locations')
        .select('id, name, address, customer_name, calibrated_fill_level')
        .eq('is_disabled', false)
        .order('customer_name')
        .order('name');

      if (error) throw error;
      setAvailableTanks(data || []);
    } catch (error) {
      console.error('Error fetching tanks:', error);
      toast.error('Failed to load tanks');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingSubscription) {
        // Update existing subscription
        const { error } = await supabase
          .from('customer_contact_tanks')
          .update({
            report_frequency: formData.report_frequency,
            preferred_send_hour: formData.preferred_send_hour,
            enabled: formData.enabled,
            alert_threshold_percent: formData.alert_threshold_percent,
            cc_emails: formData.cc_emails || null
          })
          .eq('id', editingSubscription.id);

        if (error) throw error;
        toast.success('Subscription updated successfully');
      } else {
        // Create new subscription
        if (!formData.contact_id || !formData.tank_id) {
          toast.error('Please select both a contact and a tank');
          return;
        }

        // Check if subscription already exists
        const { data: existing } = await supabase
          .from('customer_contact_tanks')
          .select('id')
          .eq('customer_contact_id', formData.contact_id)
          .eq('agbot_location_id', formData.tank_id)
          .maybeSingle();

        if (existing) {
          toast.error('This subscription already exists');
          return;
        }

        const { error } = await supabase
          .from('customer_contact_tanks')
          .insert([{
            customer_contact_id: formData.contact_id,
            agbot_location_id: formData.tank_id,
            report_frequency: formData.report_frequency,
            preferred_send_hour: formData.preferred_send_hour,
            enabled: formData.enabled,
            alert_threshold_percent: formData.alert_threshold_percent,
            cc_emails: formData.cc_emails || null
          }]);

        if (error) throw error;
        toast.success('Subscription created successfully');
      }

      setIsDialogOpen(false);
      setEditingSubscription(null);
      resetForm();
      fetchSubscriptions();
    } catch (error) {
      console.error('Error saving subscription:', error);
      toast.error('Failed to save subscription');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (subscription: Subscription) => {
    try {
      const { error } = await supabase
        .from('customer_contact_tanks')
        .update({ enabled: !subscription.enabled })
        .eq('id', subscription.id);

      if (error) throw error;
      toast.success(`Subscription ${!subscription.enabled ? 'enabled' : 'disabled'}`);
      fetchSubscriptions();
    } catch (error) {
      console.error('Error toggling subscription:', error);
      toast.error('Failed to update subscription status');
    }
  };

  const handleDelete = async (subscription: Subscription) => {
    if (!confirm(`Delete subscription for ${subscription.contact_email} → ${subscription.tank_name}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('customer_contact_tanks')
        .delete()
        .eq('id', subscription.id);

      if (error) throw error;
      toast.success('Subscription deleted');
      fetchSubscriptions();
    } catch (error) {
      console.error('Error deleting subscription:', error);
      toast.error('Failed to delete subscription');
    }
  };

  const handleTestEmail = async (subscription: Subscription) => {
    try {
      setSendingTestEmail(subscription.id);

      // Get a validated, fresh token
      const token = await getValidSessionToken();

      const response = await fetch('/api/test-send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          contact_id: subscription.contact_id,
          frequency: subscription.report_frequency
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMessage = data.message || data.error || 'Failed to send test email';
        throw new Error(errorMessage);
      }

      toast.success(
        `✅ Test email sent to ${subscription.contact_email}!\nTanks: ${data.tanks_count}\nID: ${data.email_id?.substring(0, 8)}...`,
        { duration: 6000 }
      );

      fetchSubscriptions();
    } catch (error) {
      console.error('Error sending test email:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to send test email: ${message}`);
    } finally {
      setSendingTestEmail(null);
    }
  };

  const handleEdit = (subscription: Subscription) => {
    setEditingSubscription(subscription);
    setFormData({
      contact_id: subscription.contact_id,
      tank_id: subscription.tank_id,
      report_frequency: subscription.report_frequency,
      preferred_send_hour: subscription.preferred_send_hour,
      enabled: subscription.enabled,
      alert_threshold_percent: subscription.alert_threshold_percent,
      cc_emails: subscription.cc_emails || ''
    });
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditingSubscription(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      contact_id: '',
      tank_id: '',
      report_frequency: 'daily',
      preferred_send_hour: 7,
      enabled: true,
      alert_threshold_percent: 30,
      cc_emails: ''
    });
  };

  // Filtered subscriptions
  const filteredSubscriptions = subscriptions.filter(sub => {
    if (filterCustomer !== 'all' && sub.customer_name !== filterCustomer) return false;
    if (filterEnabled === 'enabled' && !sub.enabled) return false;
    if (filterEnabled === 'disabled' && sub.enabled) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Email Subscriptions</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage tank monitoring email subscriptions. Each subscription = one contact receiving reports for one tank.
          </p>
        </div>
        <Button onClick={handleAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          New Subscription
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <Label htmlFor="filter-customer" className="sr-only">Filter by Customer</Label>
          <Select value={filterCustomer} onValueChange={setFilterCustomer}>
            <SelectTrigger id="filter-customer">
              <SelectValue placeholder="All Customers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              {uniqueCustomers.map(customer => (
                <SelectItem key={customer} value={customer}>{customer}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Label htmlFor="filter-enabled" className="sr-only">Filter by Status</Label>
          <Select value={filterEnabled} onValueChange={setFilterEnabled}>
            <SelectTrigger id="filter-enabled">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="enabled">Enabled Only</SelectItem>
              <SelectItem value="disabled">Disabled Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Total Subscriptions</div>
          <div className="text-2xl font-bold">{subscriptions.length}</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Enabled</div>
          <div className="text-2xl font-bold text-green-600">
            {subscriptions.filter(s => s.enabled).length}
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Disabled</div>
          <div className="text-2xl font-bold text-gray-400">
            {subscriptions.filter(s => !s.enabled).length}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Tank</TableHead>
              <TableHead>Fill Level</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Send Hour</TableHead>
              <TableHead>Alert %</TableHead>
              <TableHead>Last Sent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSubscriptions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  No subscriptions found. Click "New Subscription" to create one.
                </TableCell>
              </TableRow>
            ) : (
              filteredSubscriptions.map((subscription) => (
                <TableRow key={subscription.id}>
                  {/* Customer */}
                  <TableCell className="font-medium">
                    {subscription.customer_name}
                  </TableCell>

                  {/* Contact */}
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{subscription.contact_email}</span>
                      {subscription.contact_name && (
                        <span className="text-xs text-muted-foreground">
                          {subscription.contact_name}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Tank */}
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{subscription.tank_name}</span>
                      {subscription.tank_address && (
                        <span className="text-xs text-muted-foreground">
                          {subscription.tank_address}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Fill Level */}
                  <TableCell>
                    {subscription.tank_fill_level !== null ? (
                      <Badge
                        variant={
                          subscription.tank_fill_level <= subscription.alert_threshold_percent
                            ? 'destructive'
                            : subscription.tank_fill_level <= 50
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {subscription.tank_fill_level.toFixed(0)}%
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>

                  {/* Frequency */}
                  <TableCell>
                    <Badge variant="outline">
                      {subscription.report_frequency}
                    </Badge>
                  </TableCell>

                  {/* Send Hour */}
                  <TableCell>
                    {subscription.preferred_send_hour}:00
                  </TableCell>

                  {/* Alert Threshold */}
                  <TableCell>
                    {subscription.alert_threshold_percent}%
                  </TableCell>

                  {/* Last Sent */}
                  <TableCell>
                    {subscription.last_email_sent_at ? (
                      <span className="text-sm">
                        {formatRelativeTime(subscription.last_email_sent_at)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">Never</span>
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Badge
                      variant={subscription.enabled ? 'default' : 'secondary'}
                      className={subscription.enabled ? 'bg-green-100 text-green-800' : ''}
                    >
                      {subscription.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Test Email */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTestEmail(subscription)}
                        disabled={sendingTestEmail === subscription.id}
                        title="Send test email"
                      >
                        {sendingTestEmail === subscription.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>

                      {/* Toggle Enabled */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleEnabled(subscription)}
                        title={subscription.enabled ? 'Disable' : 'Enable'}
                      >
                        {subscription.enabled ? (
                          <PowerOff className="h-4 w-4" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                      </Button>

                      {/* Edit */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(subscription)}
                        title="Edit subscription"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(subscription)}
                        title="Delete subscription"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingSubscription ? 'Edit Subscription' : 'New Subscription'}
            </DialogTitle>
            <DialogDescription>
              {editingSubscription
                ? 'Update subscription settings for this contact-tank pair.'
                : 'Create a new subscription by selecting a contact and a tank, then configure notification settings.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              {/* Contact Selection (only for new subscriptions) */}
              {!editingSubscription && (
                <div className="grid gap-2">
                  <Label htmlFor="contact">Contact *</Label>
                  <Select
                    value={formData.contact_id}
                    onValueChange={(value) => setFormData({ ...formData, contact_id: value })}
                  >
                    <SelectTrigger id="contact">
                      <SelectValue placeholder="Select a contact..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableContacts.map(contact => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.customer_name} - {contact.contact_email}
                          {contact.contact_name && ` (${contact.contact_name})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Tank Selection (only for new subscriptions) */}
              {!editingSubscription && (
                <div className="grid gap-2">
                  <Label htmlFor="tank">Tank *</Label>
                  <Select
                    value={formData.tank_id}
                    onValueChange={(value) => setFormData({ ...formData, tank_id: value })}
                  >
                    <SelectTrigger id="tank">
                      <SelectValue placeholder="Select a tank..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTanks.map(tank => (
                        <SelectItem key={tank.id} value={tank.id}>
                          {tank.customer_name} - {tank.name}
                          {tank.address && ` (${tank.address})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Show current contact and tank for editing */}
              {editingSubscription && (
                <div className="bg-muted p-4 rounded-lg">
                  <div className="grid gap-2 text-sm">
                    <div>
                      <span className="font-medium">Contact:</span>{' '}
                      {editingSubscription.contact_email}
                    </div>
                    <div>
                      <span className="font-medium">Tank:</span>{' '}
                      {editingSubscription.tank_name}
                    </div>
                  </div>
                </div>
              )}

              {/* Report Frequency */}
              <div className="grid gap-2">
                <Label htmlFor="frequency">Report Frequency *</Label>
                <Select
                  value={formData.report_frequency}
                  onValueChange={(value) => setFormData({ ...formData, report_frequency: value })}
                >
                  <SelectTrigger id="frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly (Mondays)</SelectItem>
                    <SelectItem value="monthly">Monthly (1st of month)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Preferred Send Hour */}
              <div className="grid gap-2">
                <Label htmlFor="send-hour">Send Hour (Perth Time) *</Label>
                <Select
                  value={formData.preferred_send_hour.toString()}
                  onValueChange={(value) =>
                    setFormData({ ...formData, preferred_send_hour: parseInt(value) })
                  }
                >
                  <SelectTrigger id="send-hour">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={i.toString()}>
                        {i.toString().padStart(2, '0')}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Alert Threshold */}
              <div className="grid gap-2">
                <Label htmlFor="threshold">Alert Threshold (%) *</Label>
                <Input
                  id="threshold"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.alert_threshold_percent}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      alert_threshold_percent: parseInt(e.target.value) || 30
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Email will highlight tanks below this fuel level
                </p>
              </div>

              {/* CC Emails */}
              <div className="grid gap-2">
                <Label htmlFor="cc-emails">CC Emails (comma-separated)</Label>
                <Input
                  id="cc-emails"
                  type="text"
                  placeholder="email1@example.com, email2@example.com"
                  value={formData.cc_emails}
                  onChange={(e) => setFormData({ ...formData, cc_emails: e.target.value })}
                />
              </div>

              {/* Enabled */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="enabled" className="cursor-pointer">
                  Enabled (subscription will send emails)
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setEditingSubscription(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : editingSubscription ? (
                  'Update Subscription'
                ) : (
                  'Create Subscription'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
