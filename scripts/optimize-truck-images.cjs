#!/usr/bin/env node

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'src', 'assets', 'trucks');
const TARGET_WIDTH = 1920;
const TARGET_HEIGHT = 1080;
const JPG_QUALITY = 85;
const WEBP_QUALITY = 85;

async function optimizeImage(inputPath, outputBaseName) {
  console.log(`🔄 Processing ${inputPath}...`);
  
  try {
    // Get image info
    const metadata = await sharp(inputPath).metadata();
    console.log(`   Original: ${metadata.width}x${metadata.height}, ${Math.round(metadata.size / 1024 / 1024 * 10) / 10}MB`);
    
    const jpgPath = path.join(ASSETS_DIR, `${outputBaseName}.jpg`);
    const webpPath = path.join(ASSETS_DIR, `${outputBaseName}.webp`);
    
    // Create optimized JPG
    await sharp(inputPath)
      .resize(TARGET_WIDTH, TARGET_HEIGHT, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ 
        quality: JPG_QUALITY,
        progressive: true,
        mozjpeg: true
      })
      .toFile(jpgPath);
    
    // Create WebP version
    await sharp(inputPath)
      .resize(TARGET_WIDTH, TARGET_HEIGHT, {
        fit: 'cover', 
        position: 'center'
      })
      .webp({ 
        quality: WEBP_QUALITY,
        effort: 6
      })
      .toFile(webpPath);
    
    // Get file sizes
    const jpgStats = fs.statSync(jpgPath);
    const webpStats = fs.statSync(webpPath);
    
    console.log(`   ✅ JPG: ${Math.round(jpgStats.size / 1024)}KB`);
    console.log(`   ✅ WebP: ${Math.round(webpStats.size / 1024)}KB`);
    console.log(`   💾 Size reduction: ${Math.round((1 - jpgStats.size / metadata.size) * 100)}%`);
    
    return {
      jpg: { path: jpgPath, size: jpgStats.size },
      webp: { path: webpPath, size: webpStats.size },
      original: { size: metadata.size, width: metadata.width, height: metadata.height }
    };
    
  } catch (error) {
    console.error(`❌ Error processing ${inputPath}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('🚛 TankAlert Truck Image Optimizer');
  console.log('=====================================');
  
  const images = [
    { input: 'truck-1-original.JPG', output: 'truck-1' },
    { input: 'truck-2-original.JPG', output: 'truck-2' },
    { input: 'truck-3-original.JPG', output: 'truck-3' }
  ];
  
  let totalOriginalSize = 0;
  let totalOptimizedSize = 0;
  const results = [];
  
  for (const { input, output } of images) {
    const inputPath = path.join(ASSETS_DIR, input);
    
    if (!fs.existsSync(inputPath)) {
      console.log(`⚠️  Skipping ${input} - file not found`);
      continue;
    }
    
    try {
      const result = await optimizeImage(inputPath, output);
      results.push({ input, output, ...result });
      
      totalOriginalSize += result.original.size;
      totalOptimizedSize += result.jpg.size;
      
    } catch (error) {
      console.error(`Failed to process ${input}`);
    }
    
    console.log('');
  }
  
  // Summary
  console.log('📊 Optimization Summary');
  console.log('=======================');
  console.log(`Images processed: ${results.length}`);
  console.log(`Original total size: ${Math.round(totalOriginalSize / 1024 / 1024 * 10) / 10}MB`);
  console.log(`Optimized total size: ${Math.round(totalOptimizedSize / 1024 * 10) / 10}KB`);
  console.log(`Total size reduction: ${Math.round((1 - totalOptimizedSize / totalOriginalSize) * 100)}%`);
  
  // List generated files
  console.log('\\n📁 Generated Files:');
  results.forEach(result => {
    console.log(`   ${result.output}.jpg (${Math.round(result.jpg.size / 1024)}KB)`);
    console.log(`   ${result.output}.webp (${Math.round(result.webp.size / 1024)}KB)`);
  });
  
  console.log('\\n🎯 Ready for web deployment!');
  console.log('   - Images resized to 1920x1080');
  console.log('   - JPG quality: 85% with progressive encoding');
  console.log('   - WebP quality: 85% with high effort compression');
  console.log('   - Component will automatically use WebP with JPG fallback');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { optimizeImage };