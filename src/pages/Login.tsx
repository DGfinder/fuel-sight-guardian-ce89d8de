import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/lib/supabase';
import logo from '@/assets/logo.png';

// Custom theme matching the design spec
const customTheme = {
  default: {
    colors: {
      brand: '#008457',
      brandAccent: '#006f45',
      brandButtonText: '#ffffff',
      inputBorder: '#E9E9E9',
      inputText: '#161616',
    },
  },
};

export default function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate('/', { replace: true });
      }
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#fdfdfd] overflow-hidden">
      {/* Main Content */}
      <div className="w-full flex items-center justify-center px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="relative w-[450px] h-[482px] flex flex-col items-center justify-center mx-auto" style={{maxWidth:'100%'}}>
          {/* Top Left Shapes (visible and overlapping card) */}
          <div className="hidden md:block" style={{position:'absolute', width:'150px', height:'150px', left:'-60px', top:'-40px', border:'1px solid rgba(0,132,87,0.16)', borderRadius:'20px', boxSizing:'border-box', zIndex:1}}></div>
          <div className="hidden md:block" style={{position:'absolute', width:'200px', height:'200px', left:'-90px', top:'20px', background:'rgba(0,132,87,0.08)', borderRadius:'10px', zIndex:0}}></div>
          {/* Bottom Right Shapes (visible and overlapping card) */}
          <div className="hidden md:block" style={{position:'absolute', width:'180px', height:'180px', right:'-60px', bottom:'-40px', border:'2px dashed rgba(0,132,87,0.16)', borderRadius:'20px', boxSizing:'border-box', zIndex:1}}></div>
          <div className="hidden md:block" style={{position:'absolute', width:'135px', height:'135px', right:'-30px', bottom:'-20px', background:'rgba(0,132,87,0.08)', borderRadius:'10px', zIndex:0}}></div>

          {/* Card Content */}
          <div className="w-full h-full bg-white shadow-md rounded-[6px] flex flex-col items-center p-8 gap-6 z-10">
            {/* Logo and Title Section */}
            <div className="text-center space-y-3 w-full">
              <img 
                src={logo} 
                alt="Great Southern Fuels Logo" 
                className="w-[186px] h-16 mx-auto"
              />
              <h1 className="text-[22px] font-bold text-gray-900 font-raleway leading-[30px]" style={{fontFamily: 'Raleway, sans-serif', textShadow: '0px 4px 4px rgba(0,0,0,0.25)'}}>Fuel Sight Guardian</h1>
              <p className="text-[15px] text-gray-600 font-montserrat leading-[22px]" style={{fontFamily: 'Montserrat, sans-serif'}}>Real-time Fuel Monitoring by Great Southern Fuels</p>
            </div>

            {/* Auth UI Component */}
            <Auth
              supabaseClient={supabase}
              appearance={{
                theme: customTheme,
                className: {
                  container: 'w-full',
                  button: 'w-full bg-[#008457] text-white font-bold tracking-wide rounded-md hover:bg-[#006f45] transition-colors duration-200 font-raleway',
                  input: 'w-full border border-[#E9E9E9] rounded-md px-4 py-2 text-sm text-[#161616] focus:border-[#008457] focus:ring-1 focus:ring-[#008457] font-montserrat',
                  label: 'text-sm font-medium text-[#161616] font-montserrat',
                  anchor: 'text-sm text-[#008457] hover:underline font-raleway',
                  loader: 'text-sm font-montserrat',
                  message: 'text-sm text-red-500 font-montserrat',
                },
              }}
              localization={{
                variables: {
                  sign_in: {
                    email_label: 'Email address',
                    password_label: 'Your password',
                    button_label: 'Sign in',
                    link_text: "New on our platform? Create an account",
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
            <div className="text-center text-xs text-gray-500 mt-4 font-raleway w-full" style={{fontFamily: 'Raleway, sans-serif'}}>
              <p>© {new Date().getFullYear()} Great Southern Fuels</p>
              <p className="mt-1">Enterprise-grade fuel monitoring solution</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 