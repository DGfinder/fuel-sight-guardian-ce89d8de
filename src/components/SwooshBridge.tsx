import React from 'react';

interface SwooshBridgeProps {
  className?: string;
}

export const SwooshBridge: React.FC<SwooshBridgeProps> = ({ className = '' }) => {
  return (
    <div className={`absolute inset-0 pointer-events-none z-40 overflow-hidden ${className}`}>
      {/* Main Swoosh Element */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg
          width="400"
          height="300"
          viewBox="0 0 400 300"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="swoosh-main transform translate-x-8 opacity-90"
        >
          {/* Gradient Definitions */}
          <defs>
            <linearGradient id="swooshGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#008457" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#008457" stopOpacity="0.6" />
              <stop offset="80%" stopColor="#FEDF19" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#FEDF19" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="swooshGradientGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#008457" stopOpacity="0.1" />
              <stop offset="50%" stopColor="#008457" stopOpacity="0.3" />
              <stop offset="80%" stopColor="#FEDF19" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#FEDF19" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* Main Swoosh Path */}
          <path
            d="M0 150 Q100 120, 200 150 T400 140"
            stroke="url(#swooshGradient)"
            strokeWidth="12"
            fill="none"
            strokeLinecap="round"
            className="animate-pulse"
            style={{ animationDuration: '3s' }}
          />
          
          {/* Glow Effect */}
          <path
            d="M0 150 Q100 120, 200 150 T400 140"
            stroke="url(#swooshGradientGlow)"
            strokeWidth="24"
            fill="none"
            strokeLinecap="round"
            className="animate-pulse"
            style={{ animationDuration: '4s', animationDelay: '0.5s' }}
          />

          {/* Secondary Swoosh for Depth */}
          <path
            d="M-50 160 Q120 130, 220 160 T450 145"
            stroke="url(#swooshGradient)"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            opacity="0.4"
            className="animate-pulse"
            style={{ animationDuration: '5s', animationDelay: '1s' }}
          />
        </svg>
      </div>

      {/* Flowing Particles Effect */}
      <div className="absolute inset-0 flex items-center justify-center">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-gradient-to-r from-[#008457] to-[#FEDF19] rounded-full opacity-30"
            style={{
              left: `${20 + i * 40}px`,
              top: `${145 + Math.sin(i * 0.5) * 20}px`,
              animation: `float 6s ease-in-out infinite`,
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
      </div>

      {/* Large Background Swoosh for Visual Impact */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg
          width="600"
          height="400"
          viewBox="0 0 600 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="opacity-20 transform scale-150"
        >
          <defs>
            <radialGradient id="backgroundSwoosh" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#008457" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#FEDF19" stopOpacity="0.05" />
            </radialGradient>
          </defs>
          
          <path
            d="M0 200 Q150 160, 300 200 Q450 240, 600 200"
            fill="url(#backgroundSwoosh)"
            className="animate-pulse"
            style={{ animationDuration: '8s' }}
          />
        </svg>
      </div>

      {/* CSS for Custom Animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) translateX(0px);
            opacity: 0.3;
          }
          25% {
            transform: translateY(-8px) translateX(30px);
            opacity: 0.6;
          }
          50% {
            transform: translateY(0px) translateX(60px);
            opacity: 0.8;
          }
          75% {
            transform: translateY(8px) translateX(90px);
            opacity: 0.6;
          }
          100% {
            transform: translateY(0px) translateX(120px);
            opacity: 0.1;
          }
        }

        .swoosh-main {
          filter: drop-shadow(0 0 20px rgba(0, 132, 87, 0.3));
        }

        @media (max-width: 1024px) {
          .swoosh-main {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

export default SwooshBridge;