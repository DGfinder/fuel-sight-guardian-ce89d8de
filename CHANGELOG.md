# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2024-12-01

### Added
- Mobile performance optimizations with network-aware data fetching
- Force refresh feature for admin users to trigger hard refresh for all connected clients
- ResponsiveDialog component (Dialog on desktop, Drawer on mobile)
- Data skeleton loading components for improved perceived performance
- `useReducedMotion` hook for accessibility and performance

### Changed
- Mobile refetch interval increased to 2 minutes (desktop remains at 30 seconds)
- Disabled animations on mobile devices and when `prefers-reduced-motion` is set
- D3 chart animations optimized for mobile performance

### Fixed
- Mobile browser performance issues with excessive data polling
- Animation jank on low-end mobile devices

## [1.0.0] - 2024-11-01

### Added
- Fuel tank monitoring system with real-time dip readings
- Multi-tenant architecture with RBAC (Role-Based Access Control)
- Comprehensive audit logging system with 7-year retention
- AgBot and SmartFill telemetry integration
- Customer portal with email notifications
- Vehicle and driver management system
- MTdata trip history integration
- Guardian and LYTX safety event tracking
- Captive payments tracking system
- Interactive maps with Leaflet
- Dashboard with KPIs and charts
- Mobile-responsive design with PWA support
- Row-Level Security (RLS) on all sensitive tables

### Security
- Gitleaks secret scanning in CI/CD
- Sentry error monitoring integration
- Database audit triggers on critical tables
- JWT-based authentication via Supabase
