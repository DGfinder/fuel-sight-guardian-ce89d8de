# Map Weather Overlay Implementation Plan

## Overview
Add weather visualization to maps for both Admin and Customer portals.

---

## Scope

| Portal | Current State | Target |
|--------|--------------|--------|
| **Admin** (`/map`) | Full MapView exists | Add weather overlays |
| **Customer** (`/customer/map`) | Does not exist | Create new page + weather overlays |

---

## Phase 1: Weather in Tank Popups (Both Portals)
**Effort:** 2-3 hours

### Files to Modify
- `src/components/TankMapPopup.tsx` - Add weather section
- `src/components/AgbotMapPopup.tsx` - Add weather section
- `src/components/SmartFillMapPopup.tsx` - Add weather section

### Implementation
1. Import `useWeatherForecast` hook in popup components
2. Fetch weather using marker's lat/lng
3. Show compact weather: current temp, condition, rain indicator

---

## Phase 2: Customer Map Page (New)
**Effort:** 4-5 hours

### New Files
- `src/pages/customer/CustomerMap.tsx` - New map page
- `src/components/customer/CustomerTankPopup.tsx` - Customer-specific popup

### Implementation
1. Create `/customer/map` route
2. Reuse Leaflet map setup from MapView
3. Filter to show ONLY customer's assigned tanks (from `useCustomerTanks`)
4. Simpler UI than admin - no filters, just their tanks
5. Include weather in popups
6. Add nav link to customer sidebar

### Customer Map Features
- Their tanks only (AgBot + SmartFill + Manual)
- Click for tank details + weather
- Current fuel levels color-coded
- Link to tank detail page

---

## Phase 3: Rainfall Heatmap Layer (Both Portals)
**Effort:** 4-5 hours

### Files to Modify
- `src/pages/MapView.tsx` - Add rainfall layer toggle
- `src/pages/customer/CustomerMap.tsx` - Add rainfall layer toggle
- `src/services/weather/weather-api.ts` - Add grid-based fetch

### Implementation
1. Add "Rainfall" toggle to layer controls
2. Create grid of points across visible map bounds
3. Fetch weather for grid points (Open-Meteo, free)
4. Render using `leaflet.heat` (already installed)
5. Blue intensity = rain amount (mm)

---

## Phase 4: Weather Radar Tiles (Optional)
**Effort:** 2-3 hours

### Implementation
- Add RainViewer radar tiles (free, no API key)
- Toggle in layer controls
- Shows live rain radar overlay

---

## Implementation Order

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Weather in popups | 2-3 hrs |
| 2 | Customer map page | 4-5 hrs |
| 3 | Rainfall heatmap | 4-5 hrs |
| 4 | Radar tiles | 2-3 hrs |

**Total: ~14 hours**

---

## Files Summary

| File | Phase | Action |
|------|-------|--------|
| `src/components/TankMapPopup.tsx` | 1 | Add weather |
| `src/components/AgbotMapPopup.tsx` | 1 | Add weather |
| `src/components/SmartFillMapPopup.tsx` | 1 | Add weather |
| `src/pages/customer/CustomerMap.tsx` | 2 | **NEW** |
| `src/components/customer/CustomerTankPopup.tsx` | 2 | **NEW** |
| `src/App.tsx` or routes | 2 | Add route |
| `src/components/customer/CustomerSidebar.tsx` | 2 | Add nav link |
| `src/pages/MapView.tsx` | 3 | Add rainfall layer |
| `src/services/weather/weather-api.ts` | 3 | Grid fetch method |
| `src/hooks/useRainfallGrid.ts` | 3 | **NEW** hook |

---

## Customer Map Mockup

```
┌─────────────────────────────────────────────┐
│ 🗺️ Your Tank Locations                      │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐    │
│  │                                     │    │
│  │    [Map with tank markers]          │    │
│  │                                     │    │
│  │    🟢 Tank A (75%)                  │    │
│  │    🟡 Tank B (32%)                  │    │
│  │    🔴 Tank C (12%)                  │    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
│  Layers: [🗺️ Map] [🌧️ Rainfall]            │
└─────────────────────────────────────────────┘

Popup on click:
┌──────────────────────┐
│ Tank A - Main Site   │
│ 75% (7,500L)         │
│ ─────────────────    │
│ 🌡️ 19°C Clear        │
│ 7-day: ☀️☀️🌧️☀️☀️☀️☀️   │
│ [View Details →]     │
└──────────────────────┘
```

---

## No API Keys Needed
- Open-Meteo: Free, unlimited
- RainViewer: Free radar tiles
- Leaflet: Open source
