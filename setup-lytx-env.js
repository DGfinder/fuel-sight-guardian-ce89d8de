// Quick setup script for LYTX API environment variables
// Run with: node setup-lytx-env.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envContent = `# LYTX API Configuration
VITE_LYTX_API_KEY=diCeZd54DgkVzV2aPumlLG1qcZflO0GS
VITE_LYTX_BASE_URL=https://lytx-api.prod7.lv.lytx.com

# Other environment variables can be added below
# VITE_SUPABASE_URL=your-supabase-url
# VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
`;

const envPath = path.join(__dirname, '.env');

console.log('🔧 Setting up LYTX API configuration...\n');

if (fs.existsSync(envPath)) {
  console.log('⚠️  .env file already exists');
  
  const existing = fs.readFileSync(envPath, 'utf8');
  
  if (existing.includes('VITE_LYTX_API_KEY')) {
    console.log('   LYTX configuration already present');
  } else {
    console.log('   Adding LYTX configuration to existing .env file');
    fs.appendFileSync(envPath, '\n' + envContent);
    console.log('✅ LYTX configuration added to .env file');
  }
} else {
  console.log('📝 Creating new .env file with LYTX configuration');
  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file created successfully');
}

console.log('\n📋 Next Steps:');
console.log('1. Restart your development server (npm run dev)');
console.log('2. Go to LYTX Safety Dashboard');
console.log('3. Click "Test Connection" button');
console.log('4. Verify API connection is successful');

console.log('\n🔍 Configuration Details:');
console.log('- API Key: diCeZd54DgkVzV2aPumlLG1qcZflO0GS');
console.log('- Base URL: https://lytx-api.prod7.lv.lytx.com');
console.log('- Endpoints: /vehicles/all, /video/safety/events, /video/safety/events/statuses, etc.');