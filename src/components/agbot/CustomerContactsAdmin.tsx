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
import { Checkbox } from '@/components/ui/checkbox';
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
import { getValidSessionToken, TokenValidationError } from '@/lib/auth/tokenValidator';
import { Mail, UserPlus, Power, PowerOff, Edit, Trash2, CheckCircle2, XCircle, Send, Loader2 } from 'lucide-react';
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

interface CustomerContact {
  id: string;
  customer_name: string;
  customer_guid: string | null;
  contact_email: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_position: string | null;
  report_frequency: string;
  report_format: string;
  preferred_send_hour: number;
  enabled: boolean;
  last_email_sent_at: string | null;
  created_at: string;
}

interface CustomerContactsAdminProps {
  className?: string;
}

export default function CustomerContactsAdmin({ className }: CustomerContactsAdminProps) {
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    customer_name: '',
    contact_email: '',
    cc_emails: '',
    contact_name: '',
    contact_phone: '',
    contact_position: '',
    report_frequency: 'daily',
    report_format: 'summary',
    preferred_send_hour: 7,
    enabled: true
  });

  // Tank assignment state
  const [availableTanks, setAvailableTanks] = useState<any[]>([]);
  const [availableCustomers, setAvailableCustomers] = useState<string[]>([]);
  const [selectedTankIds, setSelectedTankIds] = useState<string[]>([]);
  const [loadingTanks, setLoadingTanks] = useState(false);

  // Test email state
  const [sendingTestEmail, setSendingTestEmail] = useState<string | null>(null);

  // Form submission state
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, []);

  // Fetch all available tanks when dialog opens
  useEffect(() => {
    if (isDialogOpen) {
      fetchAvailableTanks();
    }
  }, [isDialogOpen]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customer_contacts')
        .select('*')
        .order('customer_name', { ascending: true });

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast.error('Failed to load customer contacts');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableTanks = async () => {
    try {
      setLoadingTanks(true);
      // Fetch ALL tanks from all customers for full flexibility
      const { data, error } = await supabase
        .from('ta_agbot_locations')
        .select('id, name, address, customer_name, calibrated_fill_level, is_disabled')
        .eq('is_disabled', false)
        .order('customer_name')
        .order('name');

      if (error) throw error;
      setAvailableTanks((data || []).map(d => ({
        id: d.id,
        location_id: d.name,
        address1: d.address,
        customer_name: d.customer_name,
        latest_calibrated_fill_percentage: d.calibrated_fill_level,
        disabled: d.is_disabled
      })));
    } catch (error) {
      console.error('Error fetching tanks:', error);
      toast.error('Failed to load tanks');
    } finally {
      setLoadingTanks(false);
    }
  };

  const fetchAvailableCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('ta_agbot_locations')
        .select('customer_name')
        .eq('is_disabled', false)
        .order('customer_name');

      if (error) throw error;

      // Get unique customer names
      const uniqueCustomers = [...new Set(data?.map((d) => d.customer_name) || [])];
      setAvailableCustomers(uniqueCustomers);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Failed to load customer list');
    }
  };

  const fetchAssignedTanks = async (contactId: string) => {
    try {
      const { data, error } = await supabase
        .from('customer_contact_tanks')
        .select('agbot_location_id')
        .eq('customer_contact_id', contactId);

      if (error) throw error;
      setSelectedTankIds(data?.map((t) => t.agbot_location_id) || []);
    } catch (error) {
      console.error('Error fetching assigned tanks:', error);
      setSelectedTankIds([]);
    }
  };

  const saveTankAssignments = async (contactId: string) => {
    try {
      // Delete existing assignments
      await supabase
        .from('customer_contact_tanks')
        .delete()
        .eq('customer_contact_id', contactId);

      // Insert new assignments if any tanks selected
      if (selectedTankIds.length > 0) {
        const assignments = selectedTankIds.map((tankId) => ({
          customer_contact_id: contactId,
          agbot_location_id: tankId
        }));

        const { error } = await supabase.from('customer_contact_tanks').insert(assignments);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error saving tank assignments:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const contactData = {
        ...formData,
        customer_guid: `customer-${formData.customer_name.toLowerCase().replace(/\s+/g, '-')}`
      };

      let contactId: string;

      if (editingContact) {
        // Update existing contact
        const { error } = await supabase
          .from('customer_contacts')
          .update(contactData)
          .eq('id', editingContact.id);

        if (error) throw error;
        contactId = editingContact.id;

        // Save tank assignments
        await saveTankAssignments(contactId);

        toast.success('Contact updated successfully');
      } else {
        // Create new contact - must include unsubscribe_token (NOT NULL in database)
        const unsubscribeToken = crypto.randomUUID();

        const { data, error } = await supabase
          .from('customer_contacts')
          .insert([{
            ...contactData,
            unsubscribe_token: unsubscribeToken
          }])
          .select()
          .single();

        if (error) throw error;
        contactId = data.id;

        // Save tank assignments
        await saveTankAssignments(contactId);

        toast.success('Contact added successfully');
      }

      setIsDialogOpen(false);
      setEditingContact(null);
      resetForm();
      fetchContacts();
    } catch (error) {
      console.error('Error saving contact:', error);
      toast.error('Failed to save contact');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (contact: CustomerContact) => {
    try {
      const { error } = await supabase
        .from('customer_contacts')
        .update({ enabled: !contact.enabled })
        .eq('id', contact.id);

      if (error) throw error;
      toast.success(`Contact ${!contact.enabled ? 'enabled' : 'disabled'}`);
      fetchContacts();
    } catch (error) {
      console.error('Error toggling contact:', error);
      toast.error('Failed to update contact status');
    }
  };

  const handleDelete = async (contact: CustomerContact) => {
    if (!confirm(`Are you sure you want to delete the contact for ${contact.customer_name}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('customer_contacts')
        .delete()
        .eq('id', contact.id);

      if (error) throw error;
      toast.success('Contact deleted');
      fetchContacts();
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast.error('Failed to delete contact');
    }
  };

  const handleTestEmail = async (contact: CustomerContact) => {
    try {
      setSendingTestEmail(contact.id);

      // Get a validated, fresh token (with automatic refresh if needed)
      const token = await getValidSessionToken();

      const response = await fetch('/api/test-send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ contact_id: contact.id })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMessage = data.message || data.error || 'Failed to send test email';
        throw new Error(errorMessage);
      }

      toast.success(
        `✅ Test email sent to ${contact.contact_email}!\nTanks included: ${data.tanks_count}\nEmail ID: ${data.email_id?.substring(0, 8)}...`,
        { duration: 6000 }
      );

      // Refresh contacts to update last_email_sent_at
      fetchContacts();
    } catch (error) {
      console.error('Failed to send test email:', (error as Error).message);

      // Handle authentication errors specifically
      if (error instanceof TokenValidationError) {
        if (error.code === 'NO_SESSION' || error.code === 'SESSION_ERROR') {
          toast.error(
            '🔒 Your session has expired. Please log in again.',
            { duration: 8000 }
          );
        } else if (error.code === 'REFRESH_FAILED') {
          toast.error(
            '🔒 Session refresh failed. Please log in again.',
            { duration: 8000 }
          );
        } else {
          toast.error(
            `❌ Authentication error: ${error.message}`,
            { duration: 8000 }
          );
        }
      } else {
        toast.error(
          `❌ Failed to send test email\n${(error as Error).message}`,
          { duration: 8000 }
        );
      }
    } finally {
      setSendingTestEmail(null);
    }
  };

  const handleEdit = async (contact: CustomerContact) => {
    setEditingContact(contact);
    setFormData({
      customer_name: contact.customer_name,
      contact_email: contact.contact_email,
      cc_emails: (contact as any).cc_emails || '',
      contact_name: contact.contact_name || '',
      contact_phone: contact.contact_phone || '',
      contact_position: contact.contact_position || '',
      report_frequency: contact.report_frequency,
      report_format: contact.report_format,
      preferred_send_hour: contact.preferred_send_hour ?? 7,
      enabled: contact.enabled
    });

    // Fetch available customers for autocomplete
    await fetchAvailableCustomers();
    // Fetch assigned tanks for this contact (all tanks fetched via useEffect when dialog opens)
    await fetchAssignedTanks(contact.id);

    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      customer_name: '',
      contact_email: '',
      cc_emails: '',
      contact_name: '',
      contact_phone: '',
      contact_position: '',
      report_frequency: 'daily',
      report_format: 'summary',
      preferred_send_hour: 7,
      enabled: true
    });
    setAvailableTanks([]);
    setSelectedTankIds([]);
  };

  const handleAddNew = () => {
    setEditingContact(null);
    resetForm();
    fetchAvailableCustomers();
    setIsDialogOpen(true);
  };

  if (loading) {
    return <div className="p-8 text-center">Loading customer contacts...</div>;
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Customer Email Contacts</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage customer contacts for AgBot daily email reports
          </p>
        </div>
        <Button onClick={handleAddNew}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add Contact
        </Button>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>
                {editingContact ? 'Edit Contact' : 'Add New Contact'}
              </DialogTitle>
              <DialogDescription>
                Configure email recipient for AgBot daily reports
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="overflow-y-auto flex-1 pr-2">
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer_name">Customer Name *</Label>
                    <Input
                      id="customer_name"
                      value={formData.customer_name}
                      onChange={(e) =>
                        setFormData({ ...formData, customer_name: e.target.value })
                      }
                      placeholder="Enter or select customer name"
                      list="customer-suggestions"
                      required
                    />
                    <datalist id="customer-suggestions">
                      {availableCustomers.map((customer) => (
                        <option key={customer} value={customer} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_email">Email *</Label>
                    <Input
                      id="contact_email"
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) =>
                        setFormData({ ...formData, contact_email: e.target.value })
                      }
                      placeholder="contact@example.com"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cc_emails">CC Emails (optional)</Label>
                  <Input
                    id="cc_emails"
                    value={formData.cc_emails}
                    onChange={(e) =>
                      setFormData({ ...formData, cc_emails: e.target.value })
                    }
                    placeholder="user1@example.com, user2@example.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Additional recipients will receive the same report. Separate multiple emails with commas.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact_name">Contact Name</Label>
                    <Input
                      id="contact_name"
                      value={formData.contact_name}
                      onChange={(e) =>
                        setFormData({ ...formData, contact_name: e.target.value })
                      }
                      placeholder="John Smith"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_position">Position</Label>
                    <Input
                      id="contact_position"
                      value={formData.contact_position}
                      onChange={(e) =>
                        setFormData({ ...formData, contact_position: e.target.value })
                      }
                      placeholder="Operations Manager"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_phone">Phone</Label>
                  <Input
                    id="contact_phone"
                    value={formData.contact_phone}
                    onChange={(e) =>
                      setFormData({ ...formData, contact_phone: e.target.value })
                    }
                    placeholder="+61 4XX XXX XXX"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="report_frequency">Report Frequency</Label>
                    <Select
                      value={formData.report_frequency}
                      onValueChange={(value) =>
                        setFormData({ ...formData, report_frequency: value })
                      }
                    >
                      <SelectTrigger id="report_frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="preferred_send_hour">Send Time (Perth)</Label>
                    <Select
                      value={String(formData.preferred_send_hour)}
                      onValueChange={(value) =>
                        setFormData({ ...formData, preferred_send_hour: parseInt(value) })
                      }
                    >
                      <SelectTrigger id="preferred_send_hour">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5:15 AM</SelectItem>
                        <SelectItem value="6">6:15 AM</SelectItem>
                        <SelectItem value="7">7:15 AM</SelectItem>
                        <SelectItem value="8">8:15 AM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="report_format">Report Format</Label>
                    <Select
                      value={formData.report_format}
                      onValueChange={(value) =>
                        setFormData({ ...formData, report_format: value })
                      }
                    >
                      <SelectTrigger id="report_format">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="summary">Summary</SelectItem>
                        <SelectItem value="detailed">Detailed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Tank Assignment Section */}
                <div className="space-y-2">
                  <Label>Assigned Tanks (Optional)</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Select specific tanks for this contact from any customer. If none selected, emails will include all tanks matching the customer name above.
                  </p>
                  {loadingTanks ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Loading available tanks...
                    </div>
                  ) : availableTanks.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground border rounded-md">
                      No tanks available in the system
                    </div>
                  ) : (
                    <div className="border rounded-md p-3 max-h-80 overflow-y-auto bg-muted/20">
                      {/* Group tanks by customer */}
                      {Object.entries(
                        availableTanks.reduce((groups: { [key: string]: typeof availableTanks }, tank) => {
                          const customer = tank.customer_name || 'Unknown Customer';
                          if (!groups[customer]) groups[customer] = [];
                          groups[customer].push(tank);
                          return groups;
                        }, {})
                      ).map(([customerName, tanks]) => (
                        <div key={customerName} className="mb-4 last:mb-0">
                          <div className="font-semibold text-sm text-muted-foreground mb-2 pb-1 border-b sticky top-0 bg-muted/20">
                            {customerName}
                            <span className="font-normal ml-2">({tanks.length} tank{tanks.length !== 1 ? 's' : ''})</span>
                          </div>
                          <div className="space-y-1 pl-2">
                            {tanks.map((tank) => (
                              <div
                                key={tank.id}
                                className="flex items-start space-x-3 p-2 rounded hover:bg-muted/50 transition-colors"
                              >
                                <Checkbox
                                  id={`tank-${tank.id}`}
                                  checked={selectedTankIds.includes(tank.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedTankIds([...selectedTankIds, tank.id]);
                                    } else {
                                      setSelectedTankIds(selectedTankIds.filter((id) => id !== tank.id));
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`tank-${tank.id}`}
                                  className="flex-1 cursor-pointer select-none"
                                >
                                  <div className="font-medium text-sm">
                                    {tank.location_id || tank.address1 || 'Unknown Tank'}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {tank.address1 && tank.location_id !== tank.address1
                                      ? tank.address1
                                      : ''}
                                    {tank.latest_calibrated_fill_percentage !== null &&
                                    tank.latest_calibrated_fill_percentage !== undefined ? (
                                      <span className="ml-2">
                                        • {tank.latest_calibrated_fill_percentage.toFixed(0)}% fuel
                                      </span>
                                    ) : null}
                                  </div>
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {selectedTankIds.length === 0 ? (
                      <span>✉️ No specific tanks selected - will use customer name matching</span>
                    ) : (
                      <span className="text-blue-600 font-medium">
                        ✅ {selectedTankIds.length} tank{selectedTankIds.length !== 1 ? 's' : ''} selected
                      </span>
                    )}
                  </div>
                </div>
              </div>
              </div>
              <DialogFooter className="pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingContact(null);
                    resetForm();
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving || !formData.customer_name || !formData.contact_email}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingContact ? 'Update Contact' : 'Add Contact'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Last Sent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No customer contacts configured. Click "Add Contact" to get started.
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">{contact.customer_name}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{contact.contact_name || 'N/A'}</div>
                      {contact.contact_position && (
                        <div className="text-xs text-muted-foreground">
                          {contact.contact_position}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <a
                        href={`mailto:${contact.contact_email}`}
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Mail className="h-3 w-3" />
                        {contact.contact_email}
                      </a>
                      {(contact as any).cc_emails && (
                        <div className="text-xs text-muted-foreground mt-1">
                          CC: {(contact as any).cc_emails}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {contact.report_frequency}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {contact.last_email_sent_at ? (
                      <div className="text-sm" title={new Date(contact.last_email_sent_at).toLocaleString('en-AU')}>
                        {formatRelativeTime(contact.last_email_sent_at)}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Never</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {contact.enabled ? (
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <XCircle className="h-3 w-3 mr-1" />
                        Disabled
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(contact)}
                        title="Edit contact"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleTestEmail(contact)}
                        disabled={sendingTestEmail === contact.id}
                        title="Send test email now"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        {sendingTestEmail === contact.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleEnabled(contact)}
                        title={contact.enabled ? 'Disable' : 'Enable'}
                      >
                        {contact.enabled ? (
                          <PowerOff className="h-4 w-4 text-orange-600" />
                        ) : (
                          <Power className="h-4 w-4 text-green-600" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(contact)}
                        title="Delete contact"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 text-sm text-muted-foreground">
        <p>
          <strong>Total Contacts:</strong> {contacts.length} |{' '}
          <strong>Active:</strong> {contacts.filter((c) => c.enabled).length} |{' '}
          <strong>Daily Reports:</strong>{' '}
          {contacts.filter((c) => c.enabled && c.report_frequency === 'daily').length}
        </p>
      </div>
    </div>
  );
}
