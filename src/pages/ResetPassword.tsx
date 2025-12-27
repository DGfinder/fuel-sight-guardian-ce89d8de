import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PasswordStrengthIndicator } from "@/components/customer/PasswordStrengthIndicator";
import { validatePassword } from "@/utils/passwordGenerator";
import { logPasswordChange } from "@/lib/activityLogger";
import { Eye, EyeOff, Check, X } from "lucide-react";
import logo from "@/assets/logo.png";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  // Password validation
  const passwordValidation = validatePassword(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const canSubmit = passwordValidation.valid && passwordsMatch;

  useEffect(() => {
    // Wait for Supabase to process the hash and set the session
    const checkSession = async () => {
      setLoading(true);
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        setSession(null);
        setError("Invalid or expired reset link. Please request a new password reset.");
      } else {
        setSession(data.session);
        setError(null);
      }
      setLoading(false);
    };
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate password strength
    if (!passwordValidation.valid) {
      toast({
        title: "Password too weak",
        description: passwordValidation.errors[0],
        variant: "destructive"
      });
      return;
    }

    // Validate passwords match
    if (!passwordsMatch) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      // Log password change to activity log
      await logPasswordChange(true).catch(console.error);
      toast({ title: "Password updated", description: "You can now log in with your new password." });
      navigate("/login");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 p-4">
        <LoadingSpinner size={32} text="Checking reset link..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 p-4">
        <Card className="w-full max-w-md text-center shadow-xl border-0">
          <CardHeader className="pb-2">
            <div className="flex justify-center mb-4">
              <div className="bg-white p-3 rounded-xl shadow-md">
                <img src={logo} alt="Great Southern Fuels" className="h-12 w-auto" />
              </div>
            </div>
            <CardTitle className="font-heading text-xl text-gray-900">Password Reset Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 mb-6 text-sm">{error}</p>
            <Button
              onClick={() => navigate('/login')}
              className="bg-gradient-to-r from-[#008457] to-[#006b47] hover:from-[#006b47] hover:to-[#005538] text-white"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
        <p className="mt-8 text-sm text-gray-500">
          Powered by <span className="text-[#008457] font-semibold">Great Southern Fuels</span>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="pb-2">
          <div className="flex justify-center mb-4">
            <div className="bg-white p-3 rounded-xl shadow-md">
              <img src={logo} alt="Great Southern Fuels" className="h-12 w-auto" />
            </div>
          </div>
          <CardTitle className="font-heading text-xl text-gray-900 text-center">Reset Your Password</CardTitle>
          <p className="text-sm text-gray-500 text-center mt-1">Enter your new password below</p>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-4">
            {/* Password field with toggle */}
            <div className="space-y-2">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="New password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={submitting}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <PasswordStrengthIndicator password={password} />
            </div>

            {/* Confirm password field */}
            <div className="relative">
              <Input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                disabled={submitting}
                className="h-11 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmPassword && (
              <p className={`text-xs flex items-center gap-1 ${passwordsMatch ? 'text-green-600' : 'text-red-600'}`}>
                {passwordsMatch ? <Check size={12} /> : <X size={12} />}
                {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
              </p>
            )}

            {/* Password requirements */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-1">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Password requirements:</p>
              {[
                { met: password.length >= 8, text: 'At least 8 characters' },
                { met: /[A-Z]/.test(password), text: 'One uppercase letter' },
                { met: /[a-z]/.test(password), text: 'One lowercase letter' },
                { met: /[0-9]/.test(password), text: 'One number' },
                { met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password), text: 'One special character' },
              ].map(({ met, text }) => (
                <p key={text} className={`text-xs flex items-center gap-1.5 ${met ? 'text-green-600' : 'text-gray-500'}`}>
                  {met ? <Check size={12} /> : <X size={12} className="text-gray-400" />}
                  {text}
                </p>
              ))}
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-4">
            <Button
              type="submit"
              className="w-full h-11 bg-gradient-to-r from-[#008457] to-[#006b47] hover:from-[#006b47] hover:to-[#005538] text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
              disabled={submitting || !canSubmit}
            >
              {submitting ? "Updating..." : "Set New Password"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-sm text-gray-500 hover:text-[#008457]"
              onClick={() => navigate('/login')}
            >
              Back to Login
            </Button>
          </CardFooter>
        </form>
      </Card>
      <p className="mt-8 text-sm text-gray-500">
        Powered by <span className="text-[#008457] font-semibold">Great Southern Fuels</span>
      </p>
    </div>
  );
}
