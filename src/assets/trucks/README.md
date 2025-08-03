# Truck Images for TankAlert Login Page

This folder contains truck images used in the login page hero section, showcasing Great Southern Fuels' operations across Western Australia.

## 🚛 Current Images

### Image Sources
Based on the provided files:

1. **truck-1.jpg** - General operations truck (from `DSCF1800.JPG`)
   - **Location**: Regional Operations
   - **Description**: Professional fuel delivery service across Western Australia

2. **truck-2.jpg** - Moora service truck (from `DSCF0948.JPG`)
   - **Location**: Moora, WA  
   - **Description**: Trusted fuel monitoring and delivery in the Moora region

3. **truck-3.jpg** - Geraldton operations vehicle (from `DSCF1320.JPG`)
   - **Location**: Geraldton, WA
   - **Description**: Comprehensive fuel services for the Mid West region

## 📋 Image Requirements

- **Format**: JPG primary, WebP preferred for optimization
- **Dimensions**: 1920x1080 (16:9 aspect ratio) recommended
- **File Size**: Target < 200KB per image after optimization
- **Quality**: 85% compression for optimal balance of quality/size

## 🔧 Adding Your Images

### Option 1: Run the Batch Script (Windows)
```bash
# From the project root directory
scripts\copy-truck-images.bat
```

### Option 2: Run the Shell Script (Linux/Mac/WSL)
```bash
# From the project root directory
chmod +x scripts/copy-truck-images.sh
./scripts/copy-truck-images.sh
```

### Option 3: Manual Copy
1. Copy your images to this folder as:
   - `truck-1.jpg` (from `D:\2 trip\Tuesday\DSCF1800.JPG`)
   - `truck-2.jpg` (from `D:\1 trip\Tuesday Moora\DSCF0948.JPG`)
   - `truck-3.jpg` (from `D:\1 trip\Geralton T-F\DSCF1320.JPG`)

## 🎨 Image Optimization

### Recommended Tools
- **Online**: [Squoosh.app](https://squoosh.app) - Free Google tool
- **Desktop**: ImageMagick, Adobe Photoshop, GIMP
- **Command Line**: `cwebp` for WebP conversion

### Optimization Steps
1. **Resize**: Scale to 1920x1080 pixels
2. **Compress**: Use 85% quality JPG or 85% quality WebP
3. **Verify**: Check file size is under 200KB

### Example ImageMagick Commands
```bash
# Resize and optimize JPG
convert original.jpg -resize 1920x1080^ -gravity center -extent 1920x1080 -quality 85 truck-1.jpg

# Convert to WebP
cwebp -q 85 -resize 1920 1080 truck-1.jpg -o truck-1.webp
```

## 🚀 Features

### Auto-Rotation
- Images automatically cycle every 6 seconds
- Users can manually control with navigation dots
- Auto-play resumes after 10 seconds of manual control

### WebP Support
- Modern browsers load WebP for better performance
- Automatic fallback to JPG for older browsers
- Graceful degradation to gradient background if images fail

### Dynamic Content
- Location badges update with each image
- Descriptions change based on current image
- Smooth transitions between images

### Responsive Design
- Images hidden on mobile devices (< 1024px width)
- Gradient fallback maintains brand consistency
- Optimized for desktop hero section

## 🛠️ Technical Implementation

### File Structure
```
src/assets/trucks/
├── truck-1.jpg          # Primary delivery operations
├── truck-1.webp         # WebP version (optional)
├── truck-2.jpg          # Moora regional service
├── truck-2.webp         # WebP version (optional)
├── truck-3.jpg          # Geraldton operations
├── truck-3.webp         # WebP version (optional)
└── README.md            # This documentation
```

### Component Location
The images are used in `/src/components/TruckHeroSection.tsx`

### URL Paths
Images are referenced as:
- `/src/assets/trucks/truck-1.jpg`
- `/src/assets/trucks/truck-1.webp`

## 🎯 Performance

### Load Strategy
- **Lazy Loading**: Images load as needed
- **Progressive Enhancement**: Start with gradient, overlay images
- **Error Handling**: Graceful fallback to brand gradient
- **Preloading**: First image preloaded for immediate display

### Expected File Sizes
- **Original JPGs**: 2-5MB each (typical camera output)
- **Optimized JPGs**: 100-200KB each (after resize/compress)
- **WebP versions**: 60-120KB each (40-60% smaller than JPG)

## 📱 Responsive Behavior

- **Desktop (≥1024px)**: Full hero section with truck images
- **Tablet/Mobile (<1024px)**: Hidden, login form takes full width
- **Fallback**: Brand gradient background if images unavailable

## 🔍 Troubleshooting

### Images Not Showing?
1. Check file paths match exactly: `truck-1.jpg`, `truck-2.jpg`, `truck-3.jpg`
2. Verify files are in `src/assets/trucks/` directory
3. Check browser developer tools for 404 errors
4. Ensure file sizes aren't too large (>1MB may cause issues)

### Performance Issues?
1. Optimize images further (target 100KB each)
2. Convert to WebP format
3. Check network tab for slow loading times

### Need Different Images?
1. Replace files with same names
2. Update descriptions in `TruckHeroSection.tsx` if needed
3. Maintain 16:9 aspect ratio for best results