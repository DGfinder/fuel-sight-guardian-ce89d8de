import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

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
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <LoadingSpinner size={32} text="Checking reset link..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Password Reset Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={() => navigate('/login')}>Back to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <Input
              type="password"
              placeholder="New password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={submitting}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Updating..." : "Set New Password"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 