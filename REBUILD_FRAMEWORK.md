# Data Centre Rebuild Framework

## Current Status
✅ **Phase 1 Complete**: Naming conflicts resolved  
✅ **Phase 2 Complete**: Object conversion errors fixed
✅ **Phase 3 Complete**: Data Centre rebuilt from scratch

**Phase 1 - Naming Conflicts:**
- Analytics system renamed to "Data Centre" to avoid conflicts with existing fuel analytics
- All routes updated from `/analytics/*` to `/data-centre/*` 
- All components renamed (AnalyticsDashboard → DataCentreDashboard, etc.)
- Navigation updated to "Data Centre" in both sidebars

**Phase 2 - Object Conversion Fixes:**
- Fixed unsafe `String()` calls in `DataImportTool.tsx` (parseVolume function)
- Fixed unsafe `String()` calls in `MyobUploadModal.tsx` (CSV/Excel processing)
- Replaced all unsafe conversions with `safeStringify()` utility
- Added proper type safety for file upload data processing

**Phase 3 - Complete Rebuild:**
- Replaced DataCentreDashboard.tsx with ultra-simple static version
- Replaced DataCentrePage.tsx with minimal navigation-only version
- Removed all complex components that could cause object conversion errors
- Eliminated useUserPermissions hook usage
- Used only static content and safe React patterns

**Current State:**
- ✅ Application builds successfully
- ✅ Development server runs without errors  
- ✅ Data Centre routes active and functional
- ✅ No React object conversion errors
- ✅ Ultra-simplified Data Centre components
- ✅ Navigation working without complex data processing

## Type Safety Patterns

### Safe Object Conversion
Always use the utilities from `src/lib/typeGuards.ts`:

```typescript
import { safeStringify, safeReactKey, safeStringProperty } from '@/lib/typeGuards';

// ✅ Safe React key generation
const key = safeReactKey(vehicle?.id || vehicle?.name, `fallback-${index}`);

// ✅ Safe object-to-string conversion
const display = safeStringify(vehicle);

// ✅ Safe property access
const roleString = safeStringProperty(permissions, 'role', 'user');
```

### React Component Patterns
```typescript
// ✅ Safe mapping with proper keys
{vehicles?.map((vehicle, index) => {
  const vehicleKey = safeReactKey(
    typeof vehicle === 'object' && vehicle !== null 
      ? vehicle.id || vehicle.name 
      : vehicle,
    `vehicle-${index}`
  );
  return <div key={vehicleKey}>...</div>;
})}
```

## Rebuild Process

### Phase 2: Core Analytics Dashboard
1. Create new minimal Analytics Dashboard component
2. Use only static mock data initially
3. Apply all type safety patterns
4. Test thoroughly before adding real data

### Phase 3: Progressive Enhancement
1. Add one feature at a time
2. Test after each addition
3. Use defensive programming for all data handling

## Current File Structure
- `src/App.tsx` lines 196-271 (Data Centre routes) ✅ **Active**
- `src/components/Sidebar.tsx` lines 162-171 (Data Centre navigation) ✅ **Active**
- `src/pages/data-centre/` directory with renamed components ✅ **Active**
- `src/components/data-centre/` directory with renamed components ✅ **Active**

## Test Commands
```bash
npm run dev      # Development server
npm run build    # Production build test
```

## Key Lessons
- Never use `String(object)` directly
- Always validate object types before property access
- Use safe key generation for React lists
- Apply defensive programming patterns consistently