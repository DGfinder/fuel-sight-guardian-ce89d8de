import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import logo from "@/assets/logo.png";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

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
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
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
            <Input
              type="password"
              placeholder="New password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={submitting}
              className="h-11"
            />
          </CardContent>
          <CardFooter className="flex-col gap-4">
            <Button
              type="submit"
              className="w-full h-11 bg-gradient-to-r from-[#008457] to-[#006b47] hover:from-[#006b47] hover:to-[#005538] text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              disabled={submitting}
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
