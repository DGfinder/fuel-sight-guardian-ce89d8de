# GSF Depots User Access Management Guide

## Overview

This guide provides step-by-step instructions for safely granting new users access to specific subgroups within the GSF Depots tank groups. The system supports granular permissions, allowing users to access only specific depot locations rather than all GSF Depots.

## Prerequisites

✅ **System Requirements**
- Subgroup permissions system deployed (database tables, functions, RLS policies)
- Environment variables configured in `.env` file
- Access to Supabase dashboard or direct database access

✅ **Required Information**
- User's email address
- Specific subgroups they need access to
- Their role level (typically 'manager' for depot managers)

## Available GSF Depots Subgroups

Common subgroups in the GSF Depots group include:
- GSFS Narrogin
- GSFS Kalgoorlie  
- GSFS Geraldton
- GSFS Kewdale
- GSFS Perth
- (Run the verification script to get the current complete list)

## Step-by-Step Process

### Step 1: Verify System Deployment

Before creating users, verify the subgroup permissions system is properly deployed:

```bash
# Option A: Use the verification script
npm run script:gsf-user -- list-subgroups

# Option B: Run SQL verification queries
# Execute verify-subgroup-tables.sql in your database
```

**Expected Output:**
- ✅ user_subgroup_permissions table exists
- ✅ Required database functions exist
- ✅ List of available subgroups with tank counts

### Step 2: Create User with Subgroup Access

Use the management script to safely create users:

```bash
# Single subgroup access (most common)
npm run script:gsf-user -- create-user manager@narrogin.gsf.com "GSFS Narrogin"

# Multiple subgroups access (for area managers)
npm run script:gsf-user -- create-user area.manager@gsf.com "GSFS Narrogin" "GSFS Kalgoorlie"
```

**What this does:**
1. Creates user account with temporary password
2. Assigns 'manager' role
3. Grants access only to specified subgroups
4. Applies Row Level Security automatically

### Step 3: Verify User Permissions

Always verify the user has correct access:

```bash
npm run script:gsf-user -- check-user manager@narrogin.gsf.com
```

**Expected Output:**
```
👤 User Information:
📧 Email: manager@narrogin.gsf.com
🔑 Role: manager

🏪 Subgroup Access:
   • GSF Depots > GSFS Narrogin
```

### Step 4: Test User Access (Security Verification)

Have the user log in and verify they can only see their assigned tanks:

1. **User logs in** with temporary credentials
2. **Navigates to GSF Depots page**
3. **Confirms they only see** tanks from their assigned subgroup(s)
4. **Tests functionality**: dip entry, alerts, reporting
5. **User changes password** from temporary to secure password

## Safety Measures & Error Handling

### Database-Level Security
- **Row Level Security (RLS)** enforced at database level
- **No way to bypass** permissions through direct database access
- **Automatic enforcement** across all application features

### Verification Checklist
- [ ] User can log in successfully
- [ ] User sees only tanks from assigned subgroups
- [ ] User cannot access other GSF Depots subgroups
- [ ] Dip entry works for accessible tanks
- [ ] Alerts and reporting work correctly
- [ ] User changed temporary password

### Rollback Plan
If issues arise, you can:

```bash
# Check what permissions user currently has
npm run script:gsf-user -- check-user user@example.com

# Remove user entirely (if needed)
# Use Supabase dashboard or direct SQL to delete from:
# - user_subgroup_permissions
# - user_roles  
# - auth.users
```

## Common Use Cases

### Case 1: Single Depot Manager
**Scenario:** GSFS Narrogin needs a dedicated manager

```bash
npm run script:gsf-user -- create-user narrogin.manager@gsf.com "GSFS Narrogin"
```

**Result:** User can only access GSFS Narrogin tanks and data

### Case 2: Area Manager
**Scenario:** Regional manager oversees multiple depots

```bash
npm run script:gsf-user -- create-user regional.manager@gsf.com "GSFS Narrogin" "GSFS Kalgoorlie" "GSFS Geraldton"
```

**Result:** User can access tanks from all three specified depots

### Case 3: Upgrading to Full Access
**Scenario:** Promote depot manager to full GSF access

```typescript
// Use the updateUserRoles function for full group access
import { updateUserRoles } from './src/scripts/manage-user-roles';

await updateUserRoles(
  userId,
  'manager',
  ['GSF Depots'] // Full access to entire group
);
```

**Result:** User gains access to all GSF Depots subgroups

## Troubleshooting

### User Can't See Any Tanks
**Possible Causes:**
- Subgroup name mismatch (check exact spelling)
- User role not assigned correctly
- Database migration not applied

**Solution:**
```bash
# Check current permissions
npm run script:gsf-user -- check-user user@example.com

# Verify subgroup names match exactly
npm run script:gsf-user -- list-subgroups
```

### User Sees Wrong Tanks
**Possible Causes:**
- Multiple permission entries (both group and subgroup)
- Cached permissions in frontend

**Solution:**
- Check user_all_permissions view in database
- Clear browser cache and refresh application

### Permission Denied Errors
**Possible Causes:**
- RLS policies not properly applied
- User role insufficient for action

**Solution:**
- Verify user has 'manager' role minimum
- Check RLS policies in database

## Security Best Practices

### User Creation
1. **Always use temporary passwords** that users must change
2. **Verify subgroup names** before creating permissions
3. **Test access immediately** after creation
4. **Document the assignment** for future reference

### Ongoing Management
1. **Regular permission audits** - review who has access to what
2. **Monitor login activity** - watch for unusual access patterns
3. **Update permissions promptly** when roles change
4. **Remove access immediately** when users leave

### Data Protection
1. **Never grant broader access** than required
2. **Use subgroup permissions** instead of full group access when possible
3. **Verify user identity** before granting access
4. **Keep audit logs** of permission changes

## Emergency Procedures

### Immediate Access Removal
```sql
-- Remove all permissions for a user (emergency use)
DELETE FROM user_subgroup_permissions WHERE user_id = 'USER_ID';
DELETE FROM user_group_permissions WHERE user_id = 'USER_ID';
DELETE FROM user_roles WHERE user_id = 'USER_ID';
```

### System Rollback
If the subgroup system causes issues, existing group permissions will continue to work. The system is designed for backward compatibility.

## Script Reference

### Available Commands

```bash
# List all available subgroups
npm run script:gsf-user -- list-subgroups

# Create user with single subgroup access
npm run script:gsf-user -- create-user <email> "<subgroup>"

# Create user with multiple subgroup access
npm run script:gsf-user -- create-user <email> "<subgroup1>" "<subgroup2>"

# Check user permissions
npm run script:gsf-user -- check-user <email>

# Show help
npm run script:gsf-user -- help
```

### Manual Database Queries

```sql
-- Check if subgroup permissions system is deployed
SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_subgroup_permissions');

-- List available subgroups in GSF Depots
SELECT DISTINCT ft.subgroup, COUNT(*) as tank_count
FROM fuel_tanks ft
JOIN tank_groups tg ON ft.group_id = tg.id
WHERE tg.name = 'GSF Depots' AND ft.subgroup IS NOT NULL
GROUP BY ft.subgroup
ORDER BY ft.subgroup;

-- Check user's current permissions
SELECT * FROM user_all_permissions WHERE user_id = 'USER_ID';
```

## Conclusion

This system provides secure, granular access control for GSF Depots while maintaining:
- **Database-level security** that cannot be bypassed
- **Backward compatibility** with existing group permissions
- **Flexible management** supporting various use cases
- **Easy verification** and troubleshooting tools

The subgroup permissions system is the recommended approach for new user access in GSF Depots, providing better security and more appropriate access levels for most users.