// Simple API Connection Test
// This script tests your API integrations without requiring dotenv

console.log('🔍 Testing API Connections...\n');

// Test 1: Environment Variables
console.log('1️⃣  Environment Variables Check:');
console.log('   SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ SET' : '❌ NOT SET');
console.log('   SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ SET' : '❌ NOT SET');
console.log('   LYTX_API_KEY:', process.env.LYTX_API_KEY ? '✅ SET' : '❌ NOT SET');
console.log('   VITE_ATHARA_API_KEY:', process.env.VITE_ATHARA_API_KEY ? '✅ SET' : '❌ NOT SET');
console.log('   GASBOT_WEBHOOK_SECRET:', process.env.GASBOT_WEBHOOK_SECRET ? '✅ SET' : '❌ NOT SET');
console.log('');

// Test 2: Check if .env file exists
const fs = require('fs');
const path = require('path');

console.log('2️⃣  .env File Check:');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('   ✅ .env file exists');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  console.log(`   📄 Contains ${lines.length} environment variables`);
} else {
  console.log('   ❌ .env file does not exist');
  console.log('   💡 Run: ./create-complete-env-file.bat');
}
console.log('');

// Test 3: Node.js and fetch availability
console.log('3️⃣  Node.js Environment Check:');
console.log('   Node.js version:', process.version);
console.log('   Fetch available:', typeof fetch !== 'undefined' ? '✅' : '❌');
console.log('   Current directory:', __dirname);
console.log('');

// Test 4: Package.json check
console.log('4️⃣  Dependencies Check:');
const packagePath = path.join(__dirname, 'package.json');
if (fs.existsSync(packagePath)) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const deps = packageJson.dependencies || {};
  const devDeps = packageJson.devDependencies || {};
  
  console.log('   @supabase/supabase-js:', deps['@supabase/supabase-js'] ? '✅' : '❌');
  console.log('   dotenv:', deps.dotenv || devDeps.dotenv ? '✅' : '❌');
  console.log('   node-fetch:', deps['node-fetch'] ? '✅' : '❌');
} else {
  console.log('   ❌ package.json not found');
}
console.log('');

// Test 5: API files existence
console.log('5️⃣  API Files Check:');
const apiFiles = [
  'api/gasbot-webhook.mjs',
  'api/smartfill-sync.mjs',
  'api/lytx-proxy.js',
  'api/gasbot-sync.mjs'
];

apiFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  console.log(`   ${file}:`, fs.existsSync(filePath) ? '✅' : '❌');
});
console.log('');

// Summary and recommendations
console.log('📊 Summary:');
const missingEnv = !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY;
const missingEnvFile = !fs.existsSync(envPath);

if (missingEnvFile) {
  console.log('   🚨 CRITICAL: .env file is missing!');
  console.log('   💡 Solution: Run ./create-complete-env-file.bat');
} else if (missingEnv) {
  console.log('   ⚠️  WARNING: Environment variables not loaded');
  console.log('   💡 Solution: Restart your terminal or use dotenv');
} else {
  console.log('   ✅ Environment looks good');
}

console.log('\n🎯 Next Steps:');
console.log('   1. Run: ./create-complete-env-file.bat');
console.log('   2. Update your Supabase credentials in .env');
console.log('   3. Restart your development server');
console.log('   4. Test individual APIs with: node test-individual-api.js'); 