import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/lib/supabase';
import logo from '@/assets/logo.png';
import { useQueryClient } from '@tanstack/react-query';
import { semanticColors } from '@/lib/design-tokens';
import TruckHeroSection from '@/components/TruckHeroSection';
import SwooshBridge from '@/components/SwooshBridge';

// Custom theme matching the design spec
const customTheme = {
  default: {
    colors: {
      brand: semanticColors.primary,
      brandAccent: semanticColors.primaryDark,
      brandButtonText: '#ffffff',
      inputBorder: '#E9E9E9',
      inputText: '#161616',
    },
  },
};

export default function Login() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  return (
    <div className="min-h-screen flex relative">
      {/* Swoosh Bridge Element - Connecting Login to Hero */}
      <SwooshBridge className="hidden lg:block" />
      
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
              <div className="relative inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#008457] to-[#006b47] rounded-2xl mb-4 shadow-lg overflow-hidden">
                {/* Swoosh Background Pattern in Logo */}
                <div className="absolute inset-0 opacity-20">
                  <svg width="80" height="80" viewBox="0 0 80 80" className="w-full h-full">
                    <path
                      d="M10 40 Q30 30, 50 40 T80 35"
                      stroke="#FEDF19"
                      strokeWidth="3"
                      fill="none"
                      strokeLinecap="round"
                      opacity="0.6"
                    />
                  </svg>
                </div>
                <img 
                  src={logo} 
                  alt="Great Southern Fuels Logo" 
                  className="w-12 h-12 object-contain filter brightness-0 invert relative z-10"
                />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">TankAlert</h1>
              <p className="text-gray-600 text-sm">Real-time Fuel Monitoring</p>
              <p className="text-[#008457] text-xs font-medium mt-1">Great Southern Fuels</p>
            </div>

            {/* Auth Component */}
            <Auth
              supabaseClient={supabase}
              appearance={{
                theme: customTheme,
                className: {
                  container: 'w-full space-y-4',
                  button: 'w-full bg-gradient-to-r from-[#008457] to-[#006b47] hover:from-[#006b47] hover:to-[#005538] text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg',
                  input: 'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:border-[#008457] focus:ring-2 focus:ring-[#008457]/20 transition-all duration-300 bg-white/50 backdrop-blur-sm',
                  label: 'text-sm font-medium text-gray-700 mb-2 block',
                  anchor: 'text-sm text-[#008457] hover:text-[#006b47] hover:underline transition-colors duration-200',
                  loader: 'text-sm text-gray-600',
                  message: 'text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg p-3 mt-2',
                },
              }}
              localization={{
                variables: {
                  sign_in: {
                    email_label: 'Email Address',
                    password_label: 'Password',
                    button_label: 'Sign In',
                    link_text: "New to TankAlert? Contact your administrator",
                    email_input_placeholder: 'john.doe@greatsouthernfuels.com.au',
                  },
                  forgotten_password: {
                    link_text: 'Forgot your password?',
                  },
                },
              }}
              providers={[]}
              redirectTo={window.location.origin}
              view="sign_in"
              showLinks={true}
            />

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
    </div>
  );
}