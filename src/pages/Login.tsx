import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import logo from '@/assets/logo.png';
import { useQueryClient } from '@tanstack/react-query';
import TruckHeroSection from '@/components/TruckHeroSection';

// shadcn UI components
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Icons
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

// Form validation schema
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Form state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Forgot password modal state
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [resetError, setResetError] = useState<string | null>(null);

  // React Hook Form setup
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Auth state listener
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        queryClient.invalidateQueries();
        navigate('/', { replace: true });
      }
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [navigate, queryClient]);

  // Sign in handler
  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        setError(error.message);
        setIsLoading(false);
      }
      // Success is handled by onAuthStateChange listener
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  // Password reset handler
  const handleResetPassword = async () => {
    if (!resetEmail) {
      setResetError('Please enter your email address');
      return;
    }

    setResetStatus('loading');
    setResetError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setResetStatus('error');
        setResetError(error.message);
      } else {
        setResetStatus('success');
      }
    } catch (err) {
      setResetStatus('error');
      setResetError('Failed to send reset email. Please try again.');
    }
  };

  // Reset forgot password modal state when closed
  const handleForgotPasswordOpenChange = (open: boolean) => {
    setForgotPasswordOpen(open);
    if (!open) {
      setResetEmail('');
      setResetStatus('idle');
      setResetError(null);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Login Form */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 relative overflow-hidden animate-slide-in-left">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-[#008457]/10 to-[#FEDF19]/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-[#FEDF19]/10 to-[#008457]/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>

        {/* Login Card */}
        <div className="relative z-10 w-full max-w-md px-6">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8 transform transition-all duration-500 hover:shadow-3xl">
            {/* Logo and Title */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#008457] to-[#006b47] rounded-2xl mb-4 shadow-lg">
                <img
                  src={logo}
                  alt="Great Southern Fuels Logo"
                  className="w-12 h-12 object-contain filter brightness-0 invert"
                />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">TankAlert</h1>
              <p className="text-gray-600 text-sm">Real-time Fuel Monitoring</p>
              <p className="text-[#008457] text-xs font-medium mt-1">Great Southern Fuels</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Error Alert */}
              {error && (
                <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    className="h-12 pl-10 rounded-xl border-gray-200 bg-white/50 backdrop-blur-sm focus:border-[#008457] focus:ring-2 focus:ring-[#008457]/20 transition-all duration-300"
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    className="h-12 pl-10 pr-10 rounded-xl border-gray-200 bg-white/50 backdrop-blur-sm focus:border-[#008457] focus:ring-2 focus:ring-[#008457]/20 transition-all duration-300"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>
                )}
              </div>

              {/* Remember Me & Forgot Password Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    className="border-gray-300 data-[state=checked]:bg-[#008457] data-[state=checked]:border-[#008457]"
                  />
                  <Label
                    htmlFor="remember"
                    className="text-sm text-gray-600 cursor-pointer select-none"
                  >
                    Remember me
                  </Label>
                </div>
                <button
                  type="button"
                  onClick={() => setForgotPasswordOpen(true)}
                  className="text-sm text-[#008457] hover:text-[#006b47] hover:underline transition-colors duration-200"
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-gradient-to-r from-[#008457] to-[#006b47] hover:from-[#006b47] hover:to-[#005538] text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </Button>

              {/* Admin Contact Link */}
              <p className="text-center text-sm text-gray-500 mt-4">
                New to TankAlert?{' '}
                <a href="mailto:admin@greatsouthernfuels.com.au" className="text-[#008457] hover:text-[#006b47] hover:underline">
                  Contact your administrator
                </a>
              </p>
            </form>

            {/* Footer */}
            <div className="text-center text-xs text-gray-500 mt-8 pt-6 border-t border-gray-200">
              <p>© {new Date().getFullYear()} Great Southern Fuels</p>
              <p className="mt-1 text-gray-400">Enterprise Fuel Monitoring Solution</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Truck Hero Image */}
      <TruckHeroSection />

      {/* Forgot Password Modal */}
      <Dialog open={forgotPasswordOpen} onOpenChange={handleForgotPasswordOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">Reset Password</DialogTitle>
            <DialogDescription className="text-gray-600">
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {resetStatus === 'success' ? (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">
                  Check your email for a password reset link. It may take a few minutes to arrive.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {resetError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{resetError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="reset-email" className="text-sm font-medium text-gray-700">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="Enter your email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="h-12 pl-10 rounded-xl border-gray-200 focus:border-[#008457] focus:ring-2 focus:ring-[#008457]/20"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleResetPassword}
                  disabled={resetStatus === 'loading'}
                  className="w-full h-12 bg-gradient-to-r from-[#008457] to-[#006b47] hover:from-[#006b47] hover:to-[#005538] text-white font-semibold rounded-xl transition-all duration-300"
                >
                  {resetStatus === 'loading' ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>
              </>
            )}

            {resetStatus === 'success' && (
              <Button
                variant="outline"
                onClick={() => handleForgotPasswordOpenChange(false)}
                className="w-full h-12 rounded-xl"
              >
                Back to Sign In
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
