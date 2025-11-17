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
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { supabase } from '@/lib/supabaseClient';
import { Mail, UserPlus, Power, PowerOff, Edit, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

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
    contact_name: '',
    contact_phone: '',
    contact_position: '',
    report_frequency: 'daily',
    report_format: 'summary',
    enabled: true
  });

  useEffect(() => {
    fetchContacts();
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const contactData = {
        ...formData,
        customer_guid: `customer-${formData.customer_name.toLowerCase().replace(/\s+/g, '-')}`
      };

      if (editingContact) {
        // Update existing contact
        const { error } = await supabase
          .from('customer_contacts')
          .update(contactData)
          .eq('id', editingContact.id);

        if (error) throw error;
        toast.success('Contact updated successfully');
      } else {
        // Create new contact
        const { error } = await supabase
          .from('customer_contacts')
          .insert([contactData]);

        if (error) throw error;
        toast.success('Contact added successfully');
      }

      setIsDialogOpen(false);
      setEditingContact(null);
      resetForm();
      fetchContacts();
    } catch (error) {
      console.error('Error saving contact:', error);
      toast.error('Failed to save contact');
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

  const handleEdit = (contact: CustomerContact) => {
    setEditingContact(contact);
    setFormData({
      customer_name: contact.customer_name,
      contact_email: contact.contact_email,
      contact_name: contact.contact_name || '',
      contact_phone: contact.contact_phone || '',
      contact_position: contact.contact_position || '',
      report_frequency: contact.report_frequency,
      report_format: contact.report_format,
      enabled: contact.enabled
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      customer_name: '',
      contact_email: '',
      contact_name: '',
      contact_phone: '',
      contact_position: '',
      report_frequency: 'daily',
      report_format: 'summary',
      enabled: true
    });
  };

  const handleAddNew = () => {
    setEditingContact(null);
    resetForm();
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
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAddNew}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingContact ? 'Edit Contact' : 'Add New Contact'}
              </DialogTitle>
              <DialogDescription>
                Configure email recipient for AgBot daily reports
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
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
                      placeholder="e.g., Indosolutions"
                      required
                    />
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
                <div className="grid grid-cols-2 gap-4">
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
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingContact(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingContact ? 'Update Contact' : 'Add Contact'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
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
                    <a
                      href={`mailto:${contact.contact_email}`}
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Mail className="h-3 w-3" />
                      {contact.contact_email}
                    </a>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {contact.report_frequency}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {contact.last_email_sent_at ? (
                      <div className="text-sm">
                        {new Date(contact.last_email_sent_at).toLocaleDateString('en-AU')}
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
