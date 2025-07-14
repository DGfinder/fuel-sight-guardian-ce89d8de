import React, { useState, useEffect } from 'react';

interface TruckImage {
  id: string;
  src: string;
  webp?: string;
  alt: string;
  title: string;
  description: string;
  location: string;
}

// Import optimized truck images
import truck1Jpg from '@/assets/trucks/truck-1.jpg';
import truck1Webp from '@/assets/trucks/truck-1.webp';
import truck2Jpg from '@/assets/trucks/truck-2.jpg';
import truck2Webp from '@/assets/trucks/truck-2.webp';
import truck3Jpg from '@/assets/trucks/truck-3.jpg';
import truck3Webp from '@/assets/trucks/truck-3.webp';

// Actual truck images from Great Southern Fuels operations
const truckImages: TruckImage[] = [
  {
    id: '1',
    src: truck1Jpg,
    webp: truck1Webp,
    alt: 'Great Southern Fuels Delivery Truck',
    title: 'Professional Fuel Delivery',
    description: 'Reliable fuel delivery service across Western Australia',
    location: 'Regional Operations'
  },
  {
    id: '2', 
    src: truck2Jpg,
    webp: truck2Webp,
    alt: 'Great Southern Fuels Moora Service Truck',
    title: 'Moora Regional Coverage',
    description: 'Trusted fuel monitoring and delivery in the Moora region',
    location: 'Moora, WA'
  },
  {
    id: '3',
    src: truck3Jpg,
    webp: truck3Webp,
    alt: 'Great Southern Fuels Geraldton Service Vehicle',
    title: 'Geraldton Operations',
    description: 'Comprehensive fuel services for the Mid West region',
    location: 'Geraldton, WA'
  }
];

interface TruckImageComponentProps {
  image: TruckImage;
  isActive: boolean;
}

const TruckImageComponent: React.FC<TruckImageComponentProps> = ({ image, isActive }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <div 
      className={`absolute inset-0 transition-opacity duration-1000 ${
        isActive ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {!imageError ? (
        <picture>
          {/* WebP version for modern browsers */}
          <source 
            srcSet={image.webp} 
            type="image/webp"
            onLoad={() => setImageLoaded(true)}
          />
          {/* JPG fallback for older browsers */}
          <img 
            src={image.src}
            alt={image.alt}
            className={`w-full h-full object-cover transition-opacity duration-500 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            loading="lazy"
          />
        </picture>
      ) : (
        // Fallback gradient when image fails to load
        <div className="absolute inset-0 bg-gradient-to-br from-[#008457] to-[#006b47]" />
      )}
    </div>
  );
};

export const TruckHeroSection: React.FC = () => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-rotate images every 6 seconds
  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % truckImages.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const currentImage = truckImages[currentImageIndex];

  const handleDotClick = (index: number) => {
    setCurrentImageIndex(index);
    setIsAutoPlaying(false);
    // Resume auto-play after 10 seconds of manual control
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  return (
    <div className="hidden lg:flex flex-1 relative overflow-hidden animate-slide-in-right">
      {/* Gradient Overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#008457]/85 via-[#008457]/75 to-[#FEDF19]/60 z-20"></div>
      
      {/* Background Images */}
      <div className="absolute inset-0 z-10">
        {/* Fallback gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#008457] to-[#006b47]"></div>
        
        {/* Truck Images with smooth transitions */}
        {truckImages.map((image, index) => (
          <TruckImageComponent
            key={image.id}
            image={image}
            isActive={index === currentImageIndex}
          />
        ))}
      </div>
      
      {/* Content Overlay */}
      <div className="absolute inset-0 flex items-center justify-center z-30">
        <div className="text-center text-white space-y-6 px-8 animate-fade-in">
          {/* Location Badge */}
          <div className="inline-flex items-center px-4 py-2 bg-white/10 backdrop-blur-lg rounded-full border border-white/20 mb-4">
            <svg className="w-4 h-4 text-[#FEDF19] mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">{currentImage.location}</span>
          </div>

          {/* Truck Icon with brand colors */}
          <div className="inline-flex items-center justify-center w-32 h-32 bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 mb-8 transform transition-all duration-300 hover:scale-105 hover:bg-white/15">
            <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
              <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707L16 7.586A1 1 0 0015.414 7H14z"/>
            </svg>
          </div>
          
          {/* Dynamic content based on current image */}
          <h2 className="text-4xl font-bold leading-tight transition-all duration-500">
            {currentImage.title.split(' ').slice(0, -1).join(' ')}
            <br />
            <span className="text-[#FEDF19]">{currentImage.title.split(' ').slice(-1)}</span>
          </h2>
          
          <p className="text-xl text-white/90 max-w-md mx-auto leading-relaxed transition-all duration-500">
            {currentImage.description}
          </p>
          
          {/* Feature highlights */}
          <div className="flex items-center justify-center space-x-8 mt-8">
            <div className="text-center group">
              <div className="text-2xl font-bold text-[#FEDF19] transition-transform duration-300 group-hover:scale-110">24/7</div>
              <div className="text-sm text-white/80">Monitoring</div>
            </div>
            <div className="w-px h-12 bg-white/30"></div>
            <div className="text-center group">
              <div className="text-2xl font-bold text-[#FEDF19] transition-transform duration-300 group-hover:scale-110">Real-time</div>
              <div className="text-sm text-white/80">Alerts</div>
            </div>
            <div className="w-px h-12 bg-white/30"></div>
            <div className="text-center group">
              <div className="text-2xl font-bold text-[#FEDF19] transition-transform duration-300 group-hover:scale-110">Trusted</div>
              <div className="text-sm text-white/80">Service</div>
            </div>
          </div>
          
          {/* Image navigation dots */}
          <div className="flex justify-center space-x-3 mt-8">
            {truckImages.map((_, index) => (
              <button
                key={index}
                onClick={() => handleDotClick(index)}
                className={`transition-all duration-300 rounded-full ${
                  index === currentImageIndex 
                    ? 'bg-[#FEDF19] w-8 h-2 shadow-lg' 
                    : 'bg-white/40 hover:bg-white/60 w-2 h-2'
                }`}
                aria-label={`View ${truckImages[index].location} truck image`}
              />
            ))}
          </div>

          {/* Auto-play indicator */}
          <div className="flex items-center justify-center space-x-2 mt-4">
            <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${
              isAutoPlaying ? 'bg-[#FEDF19]' : 'bg-white/40'
            }`}></div>
            <span className="text-xs text-white/60">
              {isAutoPlaying ? 'Auto-playing' : 'Manual control'}
            </span>
          </div>
        </div>
      </div>

      {/* Decorative floating elements */}
      <div className="absolute top-20 right-20 w-32 h-32 bg-white/5 rounded-full blur-xl animate-pulse"></div>
      <div className="absolute bottom-20 left-20 w-24 h-24 bg-[#FEDF19]/20 rounded-full blur-lg animate-pulse" style={{ animationDelay: '3s' }}></div>
      
      {/* Additional floating elements for visual appeal */}
      <div className="absolute top-1/4 left-10 w-4 h-4 bg-[#FEDF19]/30 rounded-full animate-bounce" style={{ animationDelay: '1s' }}></div>
      <div className="absolute bottom-1/3 right-32 w-3 h-3 bg-white/20 rounded-full animate-bounce" style={{ animationDelay: '2s' }}></div>
      <div className="absolute top-3/4 left-1/4 w-2 h-2 bg-[#FEDF19]/40 rounded-full animate-pulse" style={{ animationDelay: '4s' }}></div>
    </div>
  );
};

export default TruckHeroSection;