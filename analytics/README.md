# Fleet Analytics Platform

A separate analytics application for comprehensive fleet management data analysis, replacing PowerBI functionality.

## Overview

This analytics platform combines data from multiple sources:
- **Guardian**: Safety monitoring (distraction/fatigue events)
- **MYOB**: Delivery performance data (SMB & GSF carriers)
- **LYTX**: DriveCam safety incident reports

## Features

- **Multi-source Analytics**: Unified dashboard combining Guardian, MYOB, and LYTX data
- **Role-based Access Control**: Compliance managers, admins, and regular users
- **Monthly CFO Uploads**: Drag & drop interface for Excel/CSV files
- **Guardian Compliance**: Real-time safety event monitoring and verification
- **Delivery Analytics**: Performance insights for SMB and GSF carriers
- **Automated Reports**: Scheduled compliance and performance reporting

## Architecture

- **Separate Application**: Independent from main fuel app with shared authentication
- **Shared Database**: Uses same Supabase instance with extended RBAC
- **Port 3001**: Runs on separate port for independent deployment
- **React + TypeScript**: Modern frontend with TanStack Query for data management

## Quick Start

1. **Copy environment variables:**
   ```bash
   cp .env.example .env
   # Add your Supabase credentials (same as main app)
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development server:**
   ```bash
   npm run dev
   # Runs on http://localhost:3001
   ```

## Data Sources

### Guardian Events
- **Distraction Events**: 13,317 total (850 verified - 6.4% rate)
- **Fatigue Events**: 11,644 total (166 verified - 1.4% rate)
- **Real-time Monitoring**: System performance and calibration status

### MYOB Deliveries
- **SMB Carrier**: 21,706 delivery records
- **GSF Carrier**: 54,954 delivery records
- **Monthly Upload**: CFO-cleaned data with duplicate detection

### LYTX Safety
- **Safety Events**: 1,857 DriveCam incidents
- **Driver Performance**: Scoring and trending analysis

## Pages

- **Dashboard**: Overview with key metrics and quick actions
- **Guardian Compliance**: Safety event monitoring and verification workflow
- **Delivery Analytics**: MYOB performance analysis and trends
- **Data Import**: Monthly file upload with drag & drop interface
- **Reports**: Automated compliance and performance report generation

## Authentication

Uses shared authentication with the main fuel app:
- Same Supabase instance and user table
- Extended RBAC with `compliance_manager` role
- Session sharing across applications

## Development

```bash
# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check

# Linting
npm run lint
```

## Database Schema

The analytics system extends the existing database with:
- `guardian_events` - Safety monitoring data
- `carrier_deliveries` - MYOB delivery records  
- `lytx_safety_events` - DriveCam incident data
- `analytics_permissions` - Extended RBAC for analytics access

## Performance

- **Optimized Queries**: Proper indexing for large datasets (75K+ records)
- **Efficient Loading**: Skeleton states and lazy loading
- **Real-time Updates**: Supabase real-time subscriptions
- **Error Boundaries**: Comprehensive error handling and recovery

## Deployment

Deploy as a separate application:
1. Build the analytics app
2. Deploy to separate subdomain or path
3. Update main app navigation to link to analytics
4. Configure shared authentication

## Navigation Integration

The main fuel app includes navigation to the analytics platform:
- "Analytics" menu item in main app
- Seamless authentication transition
- Shared user session and permissions