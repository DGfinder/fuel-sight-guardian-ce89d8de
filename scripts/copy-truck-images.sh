#!/bin/bash

# Script to copy and optimize truck images for the login page
# Run this script from the project root directory

echo "🚛 Copying and optimizing truck images for TankAlert login page..."

# Create trucks directory if it doesn't exist
mkdir -p "src/assets/trucks"

# Source paths (update these to match your actual file locations)
SOURCE_1="D:/2 trip/Tuesday/DSCF1800.JPG"
SOURCE_2="D:/1 trip/Tuesday Moora/DSCF0948.JPG" 
SOURCE_3="D:/1 trip/Geralton T-F/DSCF1320.JPG"

# Destination paths
DEST_DIR="src/assets/trucks"

echo "📁 Copying original images..."

# Copy images to destination with new names
cp "$SOURCE_1" "$DEST_DIR/truck-1-original.jpg" 2>/dev/null || echo "⚠️  Could not copy $SOURCE_1 - please copy manually"
cp "$SOURCE_2" "$DEST_DIR/truck-2-original.jpg" 2>/dev/null || echo "⚠️  Could not copy $SOURCE_2 - please copy manually"
cp "$SOURCE_3" "$DEST_DIR/truck-3-original.jpg" 2>/dev/null || echo "⚠️  Could not copy $SOURCE_3 - please copy manually"

echo "🔄 Converting to WebP format..."

# Check if ImageMagick or cwebp is available for conversion
if command -v cwebp &> /dev/null; then
    echo "Using cwebp for conversion..."
    
    # Convert to WebP (high quality, optimized for web)
    if [ -f "$DEST_DIR/truck-1-original.jpg" ]; then
        cwebp -q 85 -resize 1920 1080 "$DEST_DIR/truck-1-original.jpg" -o "$DEST_DIR/truck-1.webp"
        # Create optimized JPG fallback
        convert "$DEST_DIR/truck-1-original.jpg" -resize 1920x1080^ -gravity center -extent 1920x1080 -quality 85 "$DEST_DIR/truck-1.jpg"
    fi
    
    if [ -f "$DEST_DIR/truck-2-original.jpg" ]; then
        cwebp -q 85 -resize 1920 1080 "$DEST_DIR/truck-2-original.jpg" -o "$DEST_DIR/truck-2.webp"
        convert "$DEST_DIR/truck-2-original.jpg" -resize 1920x1080^ -gravity center -extent 1920x1080 -quality 85 "$DEST_DIR/truck-2.jpg"
    fi
    
    if [ -f "$DEST_DIR/truck-3-original.jpg" ]; then
        cwebp -q 85 -resize 1920 1080 "$DEST_DIR/truck-3-original.jpg" -o "$DEST_DIR/truck-3.webp"
        convert "$DEST_DIR/truck-3-original.jpg" -resize 1920x1080^ -gravity center -extent 1920x1080 -quality 85 "$DEST_DIR/truck-3.jpg"
    fi
    
elif command -v convert &> /dev/null; then
    echo "Using ImageMagick for conversion..."
    
    # Convert using ImageMagick
    if [ -f "$DEST_DIR/truck-1-original.jpg" ]; then
        convert "$DEST_DIR/truck-1-original.jpg" -resize 1920x1080^ -gravity center -extent 1920x1080 -quality 85 "$DEST_DIR/truck-1.jpg"
        convert "$DEST_DIR/truck-1.jpg" "$DEST_DIR/truck-1.webp"
    fi
    
    if [ -f "$DEST_DIR/truck-2-original.jpg" ]; then
        convert "$DEST_DIR/truck-2-original.jpg" -resize 1920x1080^ -gravity center -extent 1920x1080 -quality 85 "$DEST_DIR/truck-2.jpg"
        convert "$DEST_DIR/truck-2.jpg" "$DEST_DIR/truck-2.webp"
    fi
    
    if [ -f "$DEST_DIR/truck-3-original.jpg" ]; then
        convert "$DEST_DIR/truck-3-original.jpg" -resize 1920x1080^ -gravity center -extent 1920x1080 -quality 85 "$DEST_DIR/truck-3.jpg"
        convert "$DEST_DIR/truck-3.jpg" "$DEST_DIR/truck-3.webp"
    fi
    
else
    echo "⚠️  No image conversion tools found (cwebp or ImageMagick)"
    echo "📝 Manual steps required:"
    echo "1. Copy your images to src/assets/trucks/ as truck-1.jpg, truck-2.jpg, truck-3.jpg"
    echo "2. Resize them to 1920x1080 resolution"
    echo "3. Optionally convert to WebP format for better performance"
fi

echo "🧹 Cleaning up original files..."
rm -f "$DEST_DIR/truck-1-original.jpg" "$DEST_DIR/truck-2-original.jpg" "$DEST_DIR/truck-3-original.jpg"

echo "✅ Image processing complete!"
echo "📊 File sizes:"
ls -lh "$DEST_DIR"/*.{jpg,webp} 2>/dev/null || echo "No optimized images found"

echo ""
echo "🚀 Next steps:"
echo "1. The truck images should now be ready in src/assets/trucks/"
echo "2. The TruckHeroSection component will be updated to use these images"
echo "3. Test the login page to see your trucks in action!"