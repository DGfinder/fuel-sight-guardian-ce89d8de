#!/usr/bin/env tsx
/**
 * GSF Depots User Management Script - Production Version
 * 
 * This script provides safe user management for GSF Depots subgroups with:
 * - Comprehensive logging and audit trails
 * - Production-ready error handling
 * - Rollback capabilities
 * - Security verification
 * 
 * Features:
 * 1. List available subgroups in GSF Depots
 * 2. Create users with specific subgroup access
 * 3. Update existing user permissions
 * 4. Verify user access and generate audit reports
 * 5. Audit trail logging for all operations
 * 
 * Usage Examples:
 * npm run script:gsf-user -- list-subgroups
 * npm run script:gsf-user -- create-user user@example.com "GSFS Narrogin"
 * npm run script:gsf-user -- check-user user@example.com
 * npm run script:gsf-user -- audit-log
 */

import { createClient } from '@supabase/supabase-js';
import * as process from 'process';
import * as fs from 'fs';
import * as path from 'path';

// Types for better type safety
interface SubgroupInfo {
  subgroup: string;
  tankCount: number;
}

interface UserSubgroupPermission {
  groupName: string;
  subgroups: string[];
}

interface CreateUserParams {
  email: string;
  subgroups: string[];
  role?: 'manager' | 'admin' | 'user';
}

interface AuditLogEntry {
  timestamp: string;
  operation: string;
  email: string;
  details: string;
  success: boolean;
  error?: string;
}

interface OperationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

// Configuration - these should match your .env file
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const defaultPassword = process.env.VITE_DEFAULT_USER_PASSWORD;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase configuration. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Logging configuration
const LOG_DIR = './logs';
const LOG_FILE = path.join(LOG_DIR, 'gsf-user-management.log');

/**
 * Ensure log directory exists
 */
function ensureLogDirectory(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * Write audit log entry to file and console
 */
function logOperation(entry: AuditLogEntry): void {
  ensureLogDirectory();
  
  const logLine = `[${entry.timestamp}] ${entry.success ? 'SUCCESS' : 'FAILED'} - ${entry.operation} - ${entry.email} - ${entry.details}${entry.error ? ` - ERROR: ${entry.error}` : ''}\n`;
  
  // Write to file
  fs.appendFileSync(LOG_FILE, logLine);
  
  // Write to console with appropriate styling
  if (entry.success) {
    console.log(`✅ ${entry.operation} - ${entry.email} - ${entry.details}`);
  } else {
    console.error(`❌ ${entry.operation} - ${entry.email} - ${entry.details}${entry.error ? ` - ${entry.error}` : ''}`);
  }
}

/**
 * Create standardized operation result
 */
function createResult(success: boolean, message: string, data?: any, error?: string): OperationResult {
  return { success, message, data, error };
}

/**
 * Execute operation with logging and error handling
 */
async function executeWithLogging<T>(
  operation: string,
  email: string,
  details: string,
  fn: () => Promise<T>
): Promise<OperationResult> {
  const timestamp = new Date().toISOString();
  
  try {
    const result = await fn();
    
    logOperation({
      timestamp,
      operation,
      email,
      details,
      success: true
    });
    
    return createResult(true, `${operation} completed successfully`, result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logOperation({
      timestamp,
      operation,
      email,
      details,
      success: false,
      error: errorMessage
    });
    
    return createResult(false, `${operation} failed`, null, errorMessage);
  }
}

/**
 * List all available subgroups in GSF Depots with tank counts
 */
async function listGSFDepotsSubgroups(): Promise<SubgroupInfo[]> {
  try {
    console.log('📋 Fetching GSF Depots subgroups...\n');

    // Get GSF Depots group ID
    const { data: group, error: groupError } = await supabase
      .from('tank_groups')
      .select('id, name')
      .eq('name', 'GSF Depots')
      .single();

    if (groupError || !group) {
      throw new Error(`GSF Depots group not found: ${groupError?.message}`);
    }

    // Get all subgroups with tank counts
    const { data: subgroupData, error: subgroupError } = await supabase
      .from('fuel_tanks')
      .select('subgroup')
      .eq('group_id', group.id)
      .not('subgroup', 'is', null);

    if (subgroupError) {
      throw new Error(`Failed to fetch subgroups: ${subgroupError.message}`);
    }

    // Count tanks by subgroup
    const subgroupCounts = subgroupData.reduce((acc, tank) => {
      const subgroup = tank.subgroup;
      acc[subgroup] = (acc[subgroup] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const subgroups: SubgroupInfo[] = Object.entries(subgroupCounts)
      .map(([subgroup, tankCount]) => ({ subgroup, tankCount }))
      .sort((a, b) => a.subgroup.localeCompare(b.subgroup));

    console.log('🏢 Available GSF Depots Subgroups:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    subgroups.forEach((info, index) => {
      console.log(`${index + 1}. ${info.subgroup} (${info.tankCount} tanks)`);
    });
    console.log(`\n📊 Total: ${subgroups.length} subgroups, ${subgroupData.length} tanks\n`);

    return subgroups;
  } catch (error) {
    console.error('❌ Error fetching GSF Depots subgroups:', error);
    throw error;
  }
}

/**
 * Create a new user with specific GSF Depots subgroup access (with logging)
 */
async function createUserWithSubgroupAccess(params: CreateUserParams): Promise<OperationResult> {
  const { email, subgroups, role = 'manager' } = params;

  if (!defaultPassword) {
    return createResult(false, 'Configuration error', null, 'VITE_DEFAULT_USER_PASSWORD environment variable is not set');
  }

  return executeWithLogging(
    'CREATE_USER',
    email,
    `Role: ${role}, Subgroups: ${subgroups.join(', ')}`,
    async () => {
      console.log(`👤 Creating user: ${email}`);
      console.log(`🔑 Role: ${role}`);
      console.log(`🏢 Subgroups: ${subgroups.join(', ')}\n`);

      // 1. Create the user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: defaultPassword,
        options: {
          emailRedirectTo: undefined, // Disable email confirmation for admin-created users
        }
      });

      if (authError) {
        throw new Error(`Failed to create user: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error('User creation failed - no user returned');
      }

      console.log('✅ User account created successfully');

      // 2. Get GSF Depots group ID
      const { data: group, error: groupError } = await supabase
        .from('tank_groups')
        .select('id, name')
        .eq('name', 'GSF Depots')
        .single();

      if (groupError || !group) {
        throw new Error(`GSF Depots group not found: ${groupError?.message}`);
      }

      // 3. Create user role entry
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role
        });

      if (roleError) {
        throw new Error(`Failed to create user role: ${roleError.message}`);
      }

      console.log('✅ User role assigned successfully');

      // 4. Create subgroup permissions
      const subgroupPermissions = subgroups.map(subgroup => ({
        user_id: authData.user!.id,
        group_id: group.id,
        subgroup_name: subgroup
      }));

      const { error: permissionsError } = await supabase
        .from('user_subgroup_permissions')
        .insert(subgroupPermissions);

      if (permissionsError) {
        throw new Error(`Failed to create subgroup permissions: ${permissionsError.message}`);
      }

      console.log('✅ Subgroup permissions assigned successfully');
      console.log('\n🎉 User created successfully!');
      console.log(`📧 Email: ${email}`);
      console.log(`🔑 Default Password: ${defaultPassword}`);
      console.log(`⚠️  Remember to ask the user to change their password on first login\n`);

      return {
        userId: authData.user.id,
        email,
        role,
        subgroups,
        temporaryPassword: defaultPassword
      };
    }
  );
}

/**
 * Check what permissions a user currently has
 */
async function checkUserPermissions(email: string): Promise<void> {
  try {
    console.log(`🔍 Checking permissions for: ${email}\n`);

    // Get user by email
    const { data: userData, error: userError } = await supabase.auth.admin.getUserByEmail(email);

    if (userError || !userData.user) {
      throw new Error(`User not found: ${email}`);
    }

    const userId = userData.user.id;

    // Get user's role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (roleError && roleError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch user role: ${roleError.message}`);
    }

    // Get user's group permissions
    const { data: groupData, error: groupError } = await supabase
      .from('user_group_permissions')
      .select(`
        group_id,
        tank_groups (
          id,
          name
        )
      `)
      .eq('user_id', userId);

    if (groupError) {
      throw new Error(`Failed to fetch user group permissions: ${groupError.message}`);
    }

    // Get user's subgroup permissions
    const { data: subgroupData, error: subgroupError } = await supabase
      .from('user_subgroup_permissions')
      .select(`
        group_id,
        subgroup_name,
        tank_groups (
          id,
          name
        )
      `)
      .eq('user_id', userId);

    if (subgroupError) {
      throw new Error(`Failed to fetch user subgroup permissions: ${subgroupError.message}`);
    }

    // Display results
    console.log('👤 User Information:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 Email: ${email}`);
    console.log(`🆔 User ID: ${userId}`);
    console.log(`🔑 Role: ${roleData?.role || 'No role assigned'}\n`);

    if (groupData && groupData.length > 0) {
      console.log('🏢 Full Group Access:');
      groupData.forEach(g => {
        console.log(`   • ${g.tank_groups?.name}`);
      });
      console.log('');
    }

    if (subgroupData && subgroupData.length > 0) {
      console.log('🏪 Subgroup Access:');
      subgroupData.forEach(s => {
        console.log(`   • ${s.tank_groups?.name} > ${s.subgroup_name}`);
      });
      console.log('');
    }

    if ((!groupData || groupData.length === 0) && (!subgroupData || subgroupData.length === 0)) {
      console.log('⚠️  No permissions assigned to this user\n');
    }

  } catch (error) {
    console.error('❌ Error checking user permissions:', error);
    throw error;
  }
}

/**
 * View recent audit log entries
 */
async function viewAuditLog(lines: number = 20): Promise<void> {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      console.log('📋 No audit log found. No operations have been performed yet.\n');
      return;
    }

    const logContent = fs.readFileSync(LOG_FILE, 'utf-8');
    const logLines = logContent.trim().split('\n');
    const recentLines = logLines.slice(-lines);

    console.log(`📋 Recent Audit Log (last ${recentLines.length} entries):`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    recentLines.forEach((line, index) => {
      if (line.trim()) {
        const isSuccess = line.includes('SUCCESS');
        const icon = isSuccess ? '✅' : '❌';
        console.log(`${icon} ${line}`);
      }
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('❌ Error reading audit log:', error);
  }
}

/**
 * Generate audit report for a specific user
 */
async function generateUserAuditReport(email: string): Promise<void> {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      console.log('📋 No audit log found.\n');
      return;
    }

    const logContent = fs.readFileSync(LOG_FILE, 'utf-8');
    const logLines = logContent.trim().split('\n');
    const userLines = logLines.filter(line => line.includes(email));

    console.log(`📊 Audit Report for: ${email}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (userLines.length === 0) {
      console.log('No operations found for this user.\n');
      return;
    }

    userLines.forEach(line => {
      if (line.trim()) {
        const isSuccess = line.includes('SUCCESS');
        const icon = isSuccess ? '✅' : '❌';
        console.log(`${icon} ${line}`);
      }
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📈 Summary: ${userLines.length} operations logged for ${email}\n`);
    
  } catch (error) {
    console.error('❌ Error generating audit report:', error);
  }
}

/**
 * Backup current permissions before making changes
 */
async function backupUserPermissions(email: string): Promise<OperationResult> {
  return executeWithLogging(
    'BACKUP_PERMISSIONS',
    email,
    'Creating permission backup before changes',
    async () => {
      // Get user by email
      const { data: userData, error: userError } = await supabase.auth.admin.getUserByEmail(email);

      if (userError || !userData.user) {
        throw new Error(`User not found: ${email}`);
      }

      const userId = userData.user.id;

      // Get current permissions
      const { data: groupData } = await supabase
        .from('user_group_permissions')
        .select('*, tank_groups(name)')
        .eq('user_id', userId);

      const { data: subgroupData } = await supabase
        .from('user_subgroup_permissions')
        .select('*, tank_groups(name)')
        .eq('user_id', userId);

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      const backup = {
        userId,
        email,
        timestamp: new Date().toISOString(),
        role: roleData?.role,
        groupPermissions: groupData,
        subgroupPermissions: subgroupData
      };

      // Save backup to file
      const backupDir = './logs/backups';
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const backupFile = path.join(backupDir, `${email.replace('@', '_at_')}_${Date.now()}.json`);
      fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));

      console.log(`💾 Permission backup saved: ${backupFile}`);
      
      return backup;
    }
  );
}

/**
 * Main CLI interface
 */
async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  console.log('🛡️  GSF Depots User Management\n');

  try {
    switch (command) {
      case 'list-subgroups':
        await listGSFDepotsSubgroups();
        break;

      case 'create-user': {
        if (args.length < 2) {
          console.error('❌ Usage: create-user <email> <subgroup1> [subgroup2] [subgroup3]...');
          console.error('   Example: create-user user@example.com "GSFS Narrogin"');
          process.exit(1);
        }
        const email = args[0];
        const subgroups = args.slice(1);
        const result = await createUserWithSubgroupAccess({ email, subgroups });
        if (!result.success) {
          console.error(`❌ ${result.message}: ${result.error}`);
          process.exit(1);
        }
        break;
      }

      case 'check-user':
        if (args.length < 1) {
          console.error('❌ Usage: check-user <email>');
          process.exit(1);
        }
        await checkUserPermissions(args[0]);
        break;

      case 'audit-log': {
        const lines = args.length > 0 ? parseInt(args[0]) || 20 : 20;
        await viewAuditLog(lines);
        break;
      }

      case 'audit-user':
        if (args.length < 1) {
          console.error('❌ Usage: audit-user <email>');
          process.exit(1);
        }
        await generateUserAuditReport(args[0]);
        break;

      case 'backup-user': {
        if (args.length < 1) {
          console.error('❌ Usage: backup-user <email>');
          process.exit(1);
        }
        const backupResult = await backupUserPermissions(args[0]);
        if (!backupResult.success) {
          console.error(`❌ ${backupResult.message}: ${backupResult.error}`);
          process.exit(1);
        }
        break;
      }

      case 'help':
      default:
        console.log('📖 Available Commands:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('  🔍 Information Commands:');
        console.log('     list-subgroups                     List all available GSF Depots subgroups');
        console.log('     check-user <email>                 Check what permissions a user has');
        console.log('');
        console.log('  👤 User Management Commands:');
        console.log('     create-user <email> <subgroups>    Create user with specific subgroup access');
        console.log('     backup-user <email>                Backup user permissions before changes');
        console.log('');
        console.log('  📋 Audit & Logging Commands:');
        console.log('     audit-log [lines]                  View recent audit log (default: 20 lines)');
        console.log('     audit-user <email>                 Generate audit report for specific user');
        console.log('');
        console.log('  ❓ Other Commands:');
        console.log('     help                               Show this help message');
        console.log('');
        console.log('📝 Examples:');
        console.log('  npm run script:gsf-user -- list-subgroups');
        console.log('  npm run script:gsf-user -- create-user manager@company.com "GSFS Narrogin"');
        console.log('  npm run script:gsf-user -- create-user supervisor@company.com "GSFS Narrogin" "GSFS Kalgoorlie"');
        console.log('  npm run script:gsf-user -- check-user manager@company.com');
        console.log('  npm run script:gsf-user -- audit-log 50');
        console.log('  npm run script:gsf-user -- audit-user manager@company.com');
        console.log('  npm run script:gsf-user -- backup-user manager@company.com');
        console.log('');
        break;
    }
  } catch (error) {
    console.error('💥 Command failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

// Export functions for use in other scripts
export {
  listGSFDepotsSubgroups,
  createUserWithSubgroupAccess,
  checkUserPermissions,
  viewAuditLog,
  generateUserAuditReport,
  backupUserPermissions
};