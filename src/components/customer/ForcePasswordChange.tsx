import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { validatePassword } from '@/utils/passwordGenerator';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { Eye, EyeOff, Lock } from 'lucide-react';

interface ForcePasswordChangeProps {
  onComplete: () => void;
}

/**
 * Force Password Change Dialog
 *
 * Shown to customers on first login to enforce changing their
 * temporary admin-generated password to a secure one of their choice.
 *
 * This dialog is non-dismissible until password is changed.
 */
export function ForcePasswordChange({ onComplete }: ForcePasswordChangeProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async () => {
    // Validate passwords match
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    // Validate password strength
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      toast.error(validation.errors[0]); // Show first error
      return;
    }

    setSaving(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Update password via Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (authError) {
        throw authError;
      }

      // Update customer account to clear force flag and set changed timestamp
      const { error: updateError } = await supabase
        .from('customer_accounts')
        .update({
          password_changed_at: new Date().toISOString(),
          force_password_change: false,
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error updating customer account:', updateError);
        // Don't fail - password was changed successfully in Auth
      }

      toast.success('Password updated successfully');
      onComplete();
    } catch (error) {
      console.error('Password change error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to change password'
      );
    } finally {
      setSaving(false);
    }
  };

  const canSubmit =
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    newPassword === confirmPassword &&
    validatePassword(newPassword).valid;

  return (
    <Dialog open={true} modal={true}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Lock size={20} />
            <DialogTitle>Change Your Password</DialogTitle>
          </div>
          <DialogDescription>
            For security, please change your temporary password before accessing your
            account. Choose a strong password you'll remember.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* New Password */}
          <div>
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative mt-1">
              <Input
                id="new-password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Password strength indicator */}
            <div className="mt-2">
              <PasswordStrengthIndicator password={newPassword} />
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <div className="relative mt-1">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="pr-10"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmit && !saving) {
                    handleChangePassword();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Show mismatch error */}
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                Passwords do not match
              </p>
            )}
          </div>

          {/* Requirements info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">
              Password Requirements:
            </p>
            <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-0.5 ml-4 list-disc">
              <li>At least 8 characters long</li>
              <li>Include uppercase and lowercase letters</li>
              <li>Include at least one number</li>
              <li>Include at least one special character (!@#$%^&*)</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleChangePassword}
            disabled={!canSubmit || saving}
            className="w-full"
          >
            {saving ? 'Updating Password...' : 'Update Password'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
