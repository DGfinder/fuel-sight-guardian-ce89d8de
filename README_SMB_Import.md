# Safe SMB Captive Payment Data Import Guide

## Overview
This guide helps you safely import the new SMB captive payment data file `Inputdata_southern Fuel (3)(Carrier - SMB) (1).csv` covering September 1, 2023 to June 30, 2025.

## 🔍 Current System
- **Dashboard**: `/data-centre/captive-payments` and `/data-centre/captive-payments/smb`
- **Current File**: `Inputdata_southern Fuel (3)(Carrier - SMB).csv` (1.8MB)
- **New File**: `Inputdata_southern Fuel (3)(Carrier - SMB) (1).csv` (1.9MB)
- **Expected Date Range**: September 1, 2023 - June 30, 2025

## 🛡️ Safety Scripts Provided

### 1. `validate-smb-data-import.js` - Data Validation
**Purpose**: Compare old vs new data files and validate compatibility
```bash
node validate-smb-data-import.js
```
**What it does**:
- Analyzes both files for record count, date coverage, volume totals
- Checks if new file covers required date range (Sept 1, 2023 - June 30, 2025)
- Provides import recommendations

### 2. `backup-captive-data.js` - Data Backup
**Purpose**: Create comprehensive backups before any changes
```bash
# Create backup
node backup-captive-data.js create

# List existing backups
node backup-captive-data.js list

# Restore from backup if needed
node backup-captive-data.js restore <backup_directory>
```

### 3. `safe-smb-import.js` - Safe Import Process
**Purpose**: Perform the actual import with validation and rollback
```bash
node safe-smb-import.js
```
**What it does**:
- Validates new file
- Creates automatic backup
- Replaces old file with new file
- Deploys to public directory
- Tests compatibility
- Provides rollback instructions if issues occur

## 📋 Step-by-Step Import Process

### Step 1: Validate New Data (REQUIRED)
```bash
node validate-smb-data-import.js
```
**Expected Output**:
- ✅ NEW FILE COVERS REQUIRED DATE RANGE
- ✅ SAFE TO PROCEED WITH IMPORT
- Shows record count increase and volume increase

**If validation fails, DO NOT proceed with import.**

### Step 2: Create Full Backup (REQUIRED)
```bash
node backup-captive-data.js create
```
**Expected Output**:
- Backup directory created with timestamp
- All captive payment files backed up
- Backup manifest created

### Step 3: Run Safe Import
```bash
node safe-smb-import.js
```
**Expected Output**:
- File validation passes
- Backup created
- File replacement successful
- Deployment to public directory complete
- Test compatibility passes

### Step 4: Verify Import
1. **Restart Development Server**:
   ```bash
   npm run dev
   ```

2. **Test Captive Payments Dashboard**:
   - Visit: `http://localhost:5173/data-centre/captive-payments`
   - Check that data loads without errors
   - Verify date range covers September 1, 2023 to June 30, 2025

3. **Test SMB-Specific Dashboard**:
   - Visit: `http://localhost:5173/data-centre/captive-payments/smb`
   - Verify SMB-specific metrics and data

### Step 5: Deploy to Production (After Local Testing)
1. **Commit Changes**:
   ```bash
   git add "Inputdata_southern Fuel (3)(Carrier - SMB).csv"
   git add "public/Inputdata_southern Fuel (3)(Carrier - SMB).csv"
   git commit -m "Update SMB captive payment data: Sept 2023 - June 2025"
   git push origin main
   ```

2. **Verify Production Deployment**:
   - Wait for Vercel deployment to complete
   - Test production captive payments dashboard
   - Verify data loads correctly

## 🔄 Rollback Process (If Needed)

### Automatic Rollback
If `safe-smb-import.js` fails, it will attempt automatic rollback.

### Manual Rollback
1. **List Available Backups**:
   ```bash
   node backup-captive-data.js list
   ```

2. **Restore from Backup**:
   ```bash
   node backup-captive-data.js restore <backup_directory_name>
   ```

3. **Redeploy to Public**:
   ```bash
   cp "Inputdata_southern Fuel (3)(Carrier - SMB).csv" "public/Inputdata_southern Fuel (3)(Carrier - SMB).csv"
   ```

4. **Restart Application**:
   ```bash
   npm run dev
   ```

## ⚠️ Important Notes

1. **File Size**: New file (1.9MB) is larger than current (1.8MB) - this is expected for additional data
2. **Date Coverage**: New file MUST cover September 1, 2023 to June 30, 2025
3. **Data Integrity**: System handles multiple date formats automatically
4. **Performance**: Data is cached, may need cache clearing after import
5. **Production**: Only deploy after successful local testing

## 🚨 Red Flags - DO NOT IMPORT IF:
- Validation script shows: "DO NOT PROCEED WITH IMPORT"
- New file has fewer records than current file
- New file doesn't cover required date range
- New file appears corrupted or has format errors

## 📞 Support
If any step fails or produces unexpected results:
1. Check console output for specific error messages
2. Use backup/rollback procedures
3. Review file contents manually
4. Test with smaller date ranges first

## 🎯 Success Criteria
- ✅ All validation scripts pass
- ✅ Captive payments dashboard loads without errors
- ✅ Date range picker shows September 1, 2023 to June 30, 2025
- ✅ SMB data appears in both main and SMB-specific dashboards
- ✅ Volume and delivery metrics are reasonable
- ✅ No console errors in browser developer tools