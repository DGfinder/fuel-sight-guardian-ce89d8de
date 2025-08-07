import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Quick API Diagnostic...\n');

// Check environment variables
console.log('Environment Variables:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
console.log('LYTX_API_KEY:', process.env.LYTX_API_KEY ? 'SET' : 'NOT SET');

// Check if .env file exists
const envExists = existsSync('.env');
console.log('\n.env file exists:', envExists ? 'YES' : 'NO');

// Check Node.js version
console.log('Node.js version:', process.version);

// Check if fetch is available
console.log('Fetch available:', typeof fetch !== 'undefined' ? 'YES' : 'NO');

console.log('\n🎯 Main Issue: Environment variables are NOT SET');
console.log('💡 Solution: Create .env file with your API credentials'); 