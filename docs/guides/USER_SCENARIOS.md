# RBAC User Scenarios - Fuel Sight Guardian

## User Experience Based on Permissions

### 1. **Narrogin Manager (GSF Depots)**
- **Access**: Only Narrogin depot tanks
- **Login Experience**: 
  - Dashboard shows only Narrogin tanks
  - KPI cards calculated from Narrogin data only
  - Cannot see Swan Transit, BGC, or other GSF depots
  - Can add dips only to Narrogin tanks
  - Alerts filtered to Narrogin only

### 2. **Kewdale Supervisor (Cross-Company)**
- **Access**: Swan Transit + BGC depots
- **Login Experience**:
  - Dashboard shows tanks from both companies
  - Group selection dropdown shows: Swan Transit, BGC
  - Can switch between Swan Transit and BGC views
  - Can add dips to tanks in both companies
  - Sees alerts from both Swan Transit and BGC

### 3. **Swan Transit Driver/Manager**
- **Access**: Swan Transit only
- **Login Experience**:
  - Simplified interface - no group selection needed
  - All displayed tanks are Swan Transit
  - Direct access to Swan Transit page
  - Cannot see other companies' data
  - Streamlined dip entry (pre-filtered to Swan Transit)

### 4. **GSF Area Manager**
- **Access**: Multiple GSF depots (Narrogin, Kalgoorlie, Geraldton)
- **Login Experience**:
  - Group dropdown shows accessible GSF depots
  - Can switch between different depot views
  - Cross-depot reporting and analytics
  - Can manage dips across multiple locations

### 5. **Admin User**
- **Access**: Everything (unchanged experience)
- **Login Experience**:
  - Full system access (current behavior)
  - Can see all companies and depots
  - User management capabilities
  - Global reporting and analytics

## Technical Implementation Details

### Database Security (RLS)
- Users **cannot** query tanks outside their assigned groups
- API calls automatically filtered at database level
- Even direct database access respects permissions
- Malicious users cannot bypass frontend restrictions

### Frontend Behavior
- Dropdown lists automatically filtered to user's groups
- Navigation menu items hidden if no access
- Error messages for unauthorized access attempts
- Graceful fallbacks for missing permissions

### Audit Trail
- All dip entries record user email
- User role changes logged
- Access attempts tracked
- Permission violations logged

## Permission Management

### Adding New Users
```typescript
// Single depot user
await createUserWithRole({
  email: 'newuser@depot.com',
  role: 'gsfs_depots',
  groupNames: ['Specific Depot Name']
});
```

### Changing User Access
```typescript
// Promote user to multi-depot access
await updateUserRoles(userId, 'gsfs_depots', ['Narrogin', 'Kewdale']);

// Restrict user to single depot
await updateUserRoles(userId, 'gsfs_depots', ['Narrogin']);
```

### Role Types Available
- `admin` - Full system access
- `swan_transit` - Swan Transit specific role
- `gsfs_depots` - GSF Depots role (can be single or multi-depot)
- `kalgoorlie` - Kalgoorlie specific role
- Custom roles can be added to enum

## Security Features

### Multi-Layer Protection
1. **Database RLS** - Core security at data level
2. **API Filtering** - Backend query optimization
3. **Frontend Guards** - UI protection and UX
4. **Route Protection** - Page-level access control

### Flexible Assignment
- One user, one depot: ✅ `['Narrogin']`
- One user, multiple depots: ✅ `['Narrogin', 'Kalgoorlie']`
- One user, cross-company: ✅ `['Swan Transit', 'BGC']`
- One user, everything: ✅ `admin` role

### Real-Time Updates
- Permission changes take effect immediately
- No app restart required
- User sessions automatically updated
- Cache invalidation handled automatically

## Common Management Tasks

### Scenario: New Narrogin Employee
```sql
-- 1. Create user account and assign single depot
await createUserWithRole({
  email: 'employee@narrogin.gsf.com',
  role: 'gsfs_depots',
  groupNames: ['Narrogin']
});
```

### Scenario: Promote to Area Manager
```sql
-- 2. Expand access to multiple depots
await updateUserRoles(userId, 'gsfs_depots', ['Narrogin', 'Kalgoorlie', 'Geraldton']);
```

### Scenario: Transfer to Different Company
```sql
-- 3. Move user from GSF to Swan Transit
await updateUserRoles(userId, 'swan_transit', ['Swan Transit']);
```

### Scenario: Kewdale Cross-Company Role
```sql
-- 4. Special oversight role
await createUserWithRole({
  email: 'supervisor@kewdale.com',
  role: 'admin', // or custom role
  groupNames: ['Swan Transit', 'BGC']
});
```

This system provides **complete flexibility** for any organizational structure or access pattern you need.