import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, HelpCircle } from "lucide-react";
import logo from "@/assets/logo.png";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 p-4">
      {/* Logo */}
      <div className="mb-8">
        <div className="bg-white p-4 rounded-xl shadow-lg">
          <img src={logo} alt="Great Southern Fuels" className="h-16 w-auto" />
        </div>
      </div>

      {/* Error Content */}
      <div className="text-center max-w-md">
        <h1 className="font-heading text-8xl font-bold text-[#008457] mb-4">404</h1>
        <h2 className="font-heading text-2xl font-semibold text-gray-900 mb-2">
          Page Not Found
        </h2>
        <p className="text-gray-600 mb-8">
          Sorry, we couldn't find the page you're looking for. It may have been moved or doesn't exist.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            asChild
            className="bg-gradient-to-r from-[#008457] to-[#006b47] hover:from-[#006b47] hover:to-[#005538] text-white shadow-lg"
          >
            <Link to="/">
              <Home className="w-4 h-4 mr-2" />
              Go to Dashboard
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-[#008457] text-[#008457] hover:bg-[#008457]/10"
          >
            <Link to="/login">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Link>
          </Button>
        </div>

        {/* Help Link */}
        <div className="mt-8">
          <a
            href="mailto:support@greatsouthernfuel.com.au"
            className="inline-flex items-center text-sm text-gray-500 hover:text-[#008457] transition-colors"
          >
            <HelpCircle className="w-4 h-4 mr-1" />
            Need help? Contact support
          </a>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-12 text-sm text-gray-500">
        Powered by <span className="text-[#008457] font-semibold">Great Southern Fuels</span>
      </p>
    </div>
  );
};

export default NotFound;
