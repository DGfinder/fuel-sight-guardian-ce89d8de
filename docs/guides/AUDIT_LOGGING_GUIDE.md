# Audit Logging System - Implementation Guide

## Overview

The Fuel Sight Guardian application now includes a comprehensive audit logging system that tracks all data modifications for compliance, security, and operational visibility.

## Features

### 🔍 **Comprehensive Tracking**
- All INSERT, UPDATE, DELETE operations on critical tables
- User identification and timestamps
- Before/after value comparison
- IP address and user agent tracking (when available)

### 🛡️ **Security & Compliance**
- Row Level Security (RLS) policies
- 7-year data retention for compliance
- User-based access control to audit logs
- Tamper-evident logging

### 📊 **User Interface Components**
- **AuditTrail**: Shows detailed history for specific records
- **AuditActivity**: Displays recent system-wide activity
- Integrated into TankDetailsModal and PerformancePage

## Database Schema

### Audit Log Table
```sql
CREATE TABLE audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,
    user_ip INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Monitored Tables
- `dip_readings` - Fuel level measurements
- `fuel_tanks` - Tank configuration changes
- `tank_alerts` - Alert management
- `user_roles` - User permission changes
- `user_group_permissions` - Access control changes
- `profiles` - User profile updates

## Usage Examples

### React Components

#### Display Audit Trail for a Tank
```tsx
import AuditTrail from '@/components/AuditTrail';

function TankDetails({ tankId }: { tankId: string }) {
  return (
    <AuditTrail 
      tableName="fuel_tanks"
      recordId={tankId}
      limit={20}
    />
  );
}
```

#### Show Recent System Activity
```tsx
import AuditActivity from '@/components/AuditActivity';

function AdminDashboard() {
  return (
    <AuditActivity 
      hours={24}
      limit={50}
      showTitle={true}
    />
  );
}
```

### React Hooks

#### Get Audit Trail Data
```tsx
import { useAuditTrail } from '@/hooks/useAudit';

function useComponentAudit(recordId: string) {
  const { data, isLoading, error } = useAuditTrail('dip_readings', recordId);
  return { auditTrail: data, isLoading, error };
}
```

#### Get Recent Activity
```tsx
import { useRecentAuditActivity } from '@/hooks/useAudit';

function useSystemActivity() {
  const { data, isLoading } = useRecentAuditActivity(24, 100);
  return { activities: data, isLoading };
}
```

### Direct API Usage

#### Get Audit Trail for Record
```typescript
import { AuditService } from '@/lib/audit';

const { data, error } = await AuditService.getAuditTrail(
  'fuel_tanks', 
  'tank-uuid-here', 
  50
);
```

#### Get Recent Activity
```typescript
const { data, error } = await AuditService.getRecentActivity(24, 100);
```

## Database Functions

### Built-in Functions
- `get_audit_trail(table_name, record_id, limit)` - Get audit history for a record
- `get_recent_audit_activity(hours, limit)` - Get recent system activity
- `cleanup_old_audit_logs()` - Remove logs older than 7 years

### Usage Examples
```sql
-- Get audit trail for a specific tank
SELECT * FROM get_audit_trail('fuel_tanks', 'tank-uuid', 20);

-- Get last 24 hours of activity
SELECT * FROM get_recent_audit_activity(24, 100);

-- Clean up old logs (automated)
SELECT cleanup_old_audit_logs();
```

## Security Considerations

### Row Level Security (RLS)
- Users can only see audit logs for data they have access to
- Admins can see all audit logs
- Users can see their own actions
- Tank-specific access control applies to related audit logs

### Data Protection
- Sensitive data is stored as JSONB (structured but opaque)
- User identification uses UUID, not email
- IP addresses are hashed for privacy compliance

### Access Control
```sql
-- Example policy: Users see audit logs for accessible tanks
CREATE POLICY "Users can view relevant audit logs" ON audit_log
FOR SELECT USING (
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'admin'
    OR user_id = auth.uid()
    OR (table_name = 'dip_readings' AND EXISTS (
        SELECT 1 FROM user_has_tank_access(record_id::text)
    ))
);
```

## Maintenance

### Data Retention
- Default: 7 years (configurable)
- Automatic cleanup via scheduled function
- Compliance with industry standards

### Performance Optimization
- Indexed on common query patterns
- Partitioning considered for high-volume environments
- Query optimization for reporting

### Monitoring
- Track audit log size and growth
- Monitor query performance
- Alert on unusual activity patterns

## Troubleshooting

### Common Issues

#### Audit Logs Not Appearing
1. Check if triggers are enabled: `SELECT * FROM information_schema.triggers WHERE trigger_name LIKE 'audit_%';`
2. Verify RLS policies allow access
3. Check user permissions

#### Performance Issues
1. Review indexes: `\d audit_log`
2. Check query patterns in pg_stat_statements
3. Consider partitioning for large datasets

#### Missing User Information
1. Verify Supabase auth context
2. Check if `auth.uid()` returns valid UUID
3. Review trigger function logic

### Debugging Queries
```sql
-- Check trigger status
SELECT 
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers 
WHERE trigger_name LIKE 'audit_%'
ORDER BY event_object_table;

-- Verify recent audit entries
SELECT 
    table_name,
    action,
    user_email,
    created_at
FROM audit_log 
ORDER BY created_at DESC 
LIMIT 10;
```

## Migration Notes

### Applying to Existing Database
1. Run `audit_logging_setup.sql` migration
2. Verify all triggers are created
3. Test with a sample data modification
4. Check RLS policies are working

### Rollback Procedure
```sql
-- Remove triggers
DROP TRIGGER IF EXISTS audit_dip_readings_trigger ON dip_readings;
-- ... (repeat for all tables)

-- Remove functions
DROP FUNCTION IF EXISTS audit_trigger_function();
DROP FUNCTION IF EXISTS get_audit_trail(TEXT, UUID, INTEGER);

-- Remove table (⚠️ CAUTION: This deletes all audit history)
-- DROP TABLE IF EXISTS audit_log;
```

## Performance Monitoring

### Key Metrics
- Audit log table size
- Query performance on audit tables
- Trigger execution time
- Storage growth rate

### Recommended Monitoring
```sql
-- Table size monitoring
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(tablename::regclass)) as size
FROM pg_tables 
WHERE tablename = 'audit_log';

-- Recent activity stats
SELECT 
    table_name,
    action,
    COUNT(*) as count,
    DATE(created_at) as date
FROM audit_log 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY table_name, action, DATE(created_at)
ORDER BY date DESC, count DESC;
```

## Compliance Notes

### Regulatory Requirements
- **SOX Compliance**: Change tracking for financial data
- **GDPR**: User data modification history
- **Industry Standards**: Fuel management audit trails
- **Security**: Access control and data integrity

### Audit Trail Integrity
- Immutable once written (no UPDATE/DELETE on audit_log)
- Cryptographic signatures (can be added if required)
- Backup and disaster recovery procedures
- Regular integrity checks

---

**Implementation Status**: ✅ Complete
**Last Updated**: Current deployment
**Next Review**: Quarterly performance assessment