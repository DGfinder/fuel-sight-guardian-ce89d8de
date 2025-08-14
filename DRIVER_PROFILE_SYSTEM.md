# Driver Profile System Implementation

## Overview

A comprehensive driver profile system that provides deep-dive analytics by correlating data from multiple sources:
- **MtData**: Trip history, distance traveled, vehicle utilization
- **LYTX Safety**: Safety events, coaching sessions, risk scores  
- **Guardian Monitoring**: Distraction, fatigue, and field-of-view events

## 🚀 Features

### ✅ Unified Driver Analytics
- Cross-system data correlation with fuzzy driver name matching
- Real-time performance metrics and safety scoring
- Fleet-based comparisons and rankings
- Privacy-compliant data aggregation with RLS

### ✅ Interactive Driver Profile Modals
- **Overview Tab**: Driver summary, key metrics, risk assessment
- **Trip Analytics Tab**: MtData trip statistics, vehicle usage, route patterns
- **LYTX Safety Tab**: Safety events, coaching history, resolution tracking
- **Guardian Events Tab**: Distraction/fatigue events, severity trends
- **Performance Tab**: Fleet comparisons, strengths, improvement areas

### ✅ Advanced Search & Discovery
- Real-time driver search with autocomplete
- "Drivers Requiring Attention" highlighting high-risk cases
- Clickable driver cards with safety metrics preview
- Fleet-specific filtering (Stevemacs vs GSF)

### ✅ Security & Performance
- Row Level Security (RLS) with fleet-based access control
- React Query caching with optimized invalidation
- Database functions for efficient cross-system analytics
- Role-based permissions and audit logging

## 🗂️ Architecture

### Core Components

```
src/
├── services/
│   └── driverProfileService.ts      # Unified data aggregation service
├── components/
│   ├── DriverProfileModal.tsx       # Main modal with tabbed interface
│   └── DriverSearchCard.tsx         # Search and attention cards
├── hooks/
│   └── useDriverProfile.ts          # React Query hooks with caching
├── pages/
│   └── DriverManagementPage.tsx     # Full management dashboard
└── database/migrations/
    └── create_driver_profile_analytics.sql  # Database functions
```

### Database Functions

- `get_driver_profile_summary()` - Aggregate driver metrics
- `get_driver_trip_analytics()` - MtData trip analysis
- `get_driver_lytx_analytics()` - LYTX safety event analytics
- `get_driver_guardian_analytics()` - Guardian monitoring data
- `get_driver_performance_comparison()` - Fleet ranking and comparison
- `get_drivers_requiring_attention()` - High-risk driver identification

## 🔧 Usage

### Navigation Routes

```
/data-centre/drivers                    # All fleets driver management
/data-centre/drivers/stevemacs          # Stevemacs-specific drivers
/data-centre/drivers/gsf                # GSF-specific drivers
```

### React Component Usage

```tsx
import DriverProfileModal from '@/components/DriverProfileModal';
import DriverSearchCard from '@/components/DriverSearchCard';
import { useDriverProfile } from '@/hooks/useDriverProfile';

// Driver Profile Modal
<DriverProfileModal
  driverId={driverId}
  driverName={driverName}
  isOpen={isOpen}
  onClose={onClose}
  timeframe="30d"
/>

// Driver Search Component
<DriverSearchCard
  fleet="Stevemacs"
  showRequiringAttention={true}
  title="Driver Search"
/>

// Driver Profile Hook
const { data: profile, isLoading } = useDriverProfile(driverId, '30d');
```

### Service Layer Usage

```tsx
import DriverProfileService from '@/services/driverProfileService';

// Get comprehensive driver profile
const profile = await DriverProfileService.getDriverProfile(driverId, '30d');

// Search drivers
const results = await DriverProfileService.searchDrivers('John', 'Stevemacs');

// Get drivers requiring attention
const attention = await DriverProfileService.getDriversRequiringAttention('Stevemacs');
```

## 🔒 Security Features

### Row Level Security (RLS)
- Fleet-based access control automatically filters data
- User permissions checked at database level
- Audit logging for all driver data access

### Privacy Compliance
- Aggregated analytics only (no raw event details without permissions)
- Time-limited data access with automatic cleanup
- Anonymized performance comparisons

### Data Access Controls
```sql
-- RLS policy example
CREATE POLICY driver_fleet_access ON driver_profiles
FOR SELECT USING (
  fleet = ANY(get_user_fleet_access(auth.uid()))
);
```

## 📊 Analytics Capabilities

### Cross-System Correlation
- **Driver Name Matching**: Fuzzy matching across MtData, LYTX, Guardian systems
- **Performance Synthesis**: Combined safety scores from multiple sources
- **Incident Correlation**: Automatic linking of safety events to driver profiles
- **Trend Analysis**: Time-based performance and risk assessment

### Key Metrics
- Overall safety score (0-100)
- Trip counts and distance traveled (30d/90d/1y)
- LYTX safety events and resolution rates
- Guardian distraction/fatigue event counts
- Fleet ranking and percentile positioning
- Coaching effectiveness tracking

### Real-time Alerts
- Critical risk drivers requiring immediate attention
- High-risk event notifications
- Coaching opportunity identification
- Performance deterioration warnings

## 🔧 Configuration

### Environment Setup
Ensure these permissions are configured in your RLS policies:
- `view_analytics_dashboard` - Access to driver analytics
- `view_lytx_events` - LYTX safety data access
- `view_guardian_events` - Guardian monitoring data access

### Database Setup
Run the migration to create analytics functions:
```bash
# Apply the driver profile analytics migration
psql -f database/migrations/create_driver_profile_analytics.sql
```

### React Query Configuration
The system uses optimized caching:
- Driver profiles: 5 minute stale time
- Search results: 2 minute stale time  
- Attention drivers: 10 minute stale time with auto-refresh

## 🚦 Performance Optimizations

### Caching Strategy
- **React Query**: Stale-while-revalidate with intelligent invalidation
- **Database Views**: Pre-computed analytics for complex queries
- **Indexed Queries**: Optimized for driver names and time ranges
- **Lazy Loading**: Modal components and chart data loaded on demand

### Database Optimizations
```sql
-- Performance indexes
CREATE INDEX idx_mtdata_trip_history_driver_time ON mtdata_trip_history(driver_name, start_time);
CREATE INDEX idx_lytx_safety_events_driver_time ON lytx_safety_events(driver_name, event_datetime);
CREATE INDEX idx_guardian_events_driver_time ON guardian_events(driver_name, detection_time);
```

## 📈 Export & Reporting

### Driver Profile Export
- Comprehensive JSON reports with all analytics
- Individual driver performance summaries
- Fleet-wide management reports
- Coaching effectiveness tracking

### Report Format
```json
{
  "driver": { "name": "John Smith", "fleet": "Stevemacs" },
  "analytics": {
    "trips": { "total": 45, "km": 1250 },
    "safety": { "lytx_events": 3, "guardian_events": 1 },
    "performance": { "fleet_rank": 12, "percentile": 85 }
  },
  "generated": "2024-12-19T10:30:00Z",
  "timeframe": "30d"
}
```

## 🔍 Implementation Details

### Database Schema Integration
- Leverages existing `drivers` (via `driver_profiles` view), `lytx_safety_events`, `guardian_events`, `mtdata_trip_history` tables
- No schema changes required - uses views and functions for analytics
- Maintains data integrity and existing application compatibility

### React Integration
- Fully integrated with existing Data Centre navigation
- Uses shadcn/ui components for consistent styling
- Responsive design with mobile-friendly modals
- Error boundaries for graceful failure handling

### Security Implementation
- Fleet-based RLS automatically applied to all queries
- User permissions checked before data access
- Secure driver name correlation without exposing raw data
- Audit trail for compliance and monitoring

## 🎯 Future Enhancements

### Planned Features
- PDF report generation with charts and insights
- Real-time driver performance dashboards
- Machine learning risk prediction models
- Integration with external coaching platforms
- Mobile app for driver self-service profiles

### Extensibility
The modular architecture supports easy addition of:
- New data sources (fuel efficiency, maintenance, etc.)
- Additional analytics tabs in driver profiles  
- Custom risk assessment algorithms
- Integration with third-party systems

## 🆘 Troubleshooting

### Common Issues

**Driver not found errors:**
- Verify driver exists in `driver_profiles` table
- Check fleet access permissions via RLS
- Confirm driver name mapping across systems

**Performance issues:**
- Check database indexes are created
- Monitor React Query cache hit rates
- Verify RLS policies are optimized

**Permission errors:**
- Validate user has required permissions
- Check fleet assignment in user profile
- Verify RLS policies are correctly applied

This implementation provides a comprehensive, secure, and performant driver management system that scales with your fleet operations while maintaining data privacy and security.