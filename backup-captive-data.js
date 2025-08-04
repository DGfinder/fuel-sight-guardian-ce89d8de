// Backup Current Captive Payment Data
// Run this before any data imports to create a safe backup

const fs = require('fs');
const path = require('path');

const FILES_TO_BACKUP = [
  'Inputdata_southern Fuel (3)(Carrier - SMB).csv',
  'Inputdata_southern Fuel (3)(Carrier - GSF).csv',
  'Captive Payments - SMB - Jun \'25(YYOITRM06_Q_R0001_WEEKLY_00000).csv',
  'Captive Payments - GSFS - Jun \'25(YYOITRM06_Q_R0001_WEEKLY_00000).csv'
];

function createFullBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = `captive_payments_backup_${timestamp}`;
  
  console.log(`📦 Creating captive payments backup: ${backupDir}`);
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  let backedUpFiles = 0;
  
  for (const filename of FILES_TO_BACKUP) {
    if (fs.existsSync(filename)) {
      const stats = fs.statSync(filename);
      fs.copyFileSync(filename, path.join(backupDir, filename));
      console.log(`   ✅ ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      backedUpFiles++;
    } else {
      console.log(`   ⚠️  ${filename} (not found)`);
    }
  }
  
  // Create backup manifest
  const manifest = {
    timestamp: new Date().toISOString(),
    backupDir,
    filesBackedUp: backedUpFiles,
    totalFiles: FILES_TO_BACKUP.length,
    files: FILES_TO_BACKUP.map(filename => ({
      filename,
      exists: fs.existsSync(filename),
      size: fs.existsSync(filename) ? fs.statSync(filename).size : 0
    }))
  };
  
  fs.writeFileSync(
    path.join(backupDir, 'backup_manifest.json'), 
    JSON.stringify(manifest, null, 2)
  );
  
  console.log(`\n✅ Backup completed: ${backedUpFiles}/${FILES_TO_BACKUP.length} files`);
  console.log(`📁 Backup location: ${path.resolve(backupDir)}`);
  
  return backupDir;
}

function listBackups() {
  console.log('📋 Available Backups:');
  
  const dirs = fs.readdirSync('.')
    .filter(name => name.startsWith('captive_payments_backup_'))
    .sort()
    .reverse();
  
  if (dirs.length === 0) {
    console.log('   No backups found');
    return;
  }
  
  dirs.forEach((dir, index) => {
    const manifestPath = path.join(dir, 'backup_manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      console.log(`   ${index + 1}. ${dir}`);
      console.log(`      Date: ${new Date(manifest.timestamp).toLocaleString()}`);
      console.log(`      Files: ${manifest.filesBackedUp}/${manifest.totalFiles}`);
    } else {
      console.log(`   ${index + 1}. ${dir} (no manifest)`);
    }
  });
}

function restoreFromBackup(backupDir) {
  console.log(`🔄 Restoring from backup: ${backupDir}`);
  
  if (!fs.existsSync(backupDir)) {
    throw new Error(`Backup directory not found: ${backupDir}`);
  }
  
  const manifestPath = path.join(backupDir, 'backup_manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Backup manifest not found: ${manifestPath}`);
  }
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  let restoredFiles = 0;
  
  for (const fileInfo of manifest.files) {
    const backupFilePath = path.join(backupDir, fileInfo.filename);
    
    if (fs.existsSync(backupFilePath)) {
      fs.copyFileSync(backupFilePath, fileInfo.filename);
      console.log(`   ✅ Restored: ${fileInfo.filename}`);
      restoredFiles++;
    } else {
      console.log(`   ⚠️  Not found in backup: ${fileInfo.filename}`);
    }
  }
  
  console.log(`\n✅ Restore completed: ${restoredFiles}/${manifest.files.length} files`);
  console.log(`📅 Backup was created: ${new Date(manifest.timestamp).toLocaleString()}`);
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'create':
    createFullBackup();
    break;
  case 'list':
    listBackups();
    break;
  case 'restore':
    const backupDir = process.argv[3];
    if (!backupDir) {
      console.log('Usage: node backup-captive-data.js restore <backup_directory>');
      process.exit(1);
    }
    restoreFromBackup(backupDir);
    break;
  default:
    console.log('📦 Captive Payments Data Backup Tool\n');
    console.log('Usage:');
    console.log('  node backup-captive-data.js create    - Create new backup');
    console.log('  node backup-captive-data.js list      - List available backups');
    console.log('  node backup-captive-data.js restore <dir> - Restore from backup');
    console.log('\nExamples:');
    console.log('  node backup-captive-data.js create');
    console.log('  node backup-captive-data.js restore captive_payments_backup_2025-01-04T12-30-00-000Z');
    break;
}