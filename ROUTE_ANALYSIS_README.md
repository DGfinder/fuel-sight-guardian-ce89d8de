# Route Analysis Tool - Implementation Summary

## Overview
A comprehensive route analysis tool has been added to the Data Centre that allows users to upload Excel trip history reports and analyze average trip times and distances between terminals and customers. This helps business owners make informed decisions when setting delivery rates.

## Features Implemented

### 1. **Excel File Parser** (`src/utils/excelTripParser.ts`)
- Automatically detects column names from various Excel formats
- Supports flexible column naming (e.g., "Start Location", "Origin", "From Location")
- Validates data and provides detailed error reporting
- Handles date/time parsing from multiple formats
- Required columns: Vehicle, Start/End Locations, Start/End Times, Distance
- Optional column: Driver

### 2. **Route Analysis Engine** (`src/services/routeAnalysisService.ts`)
- **Groups trips by route** (Start Location → End Location)
- **Calculates comprehensive metrics per route:**
  - Average, median, min, max trip times
  - Time standard deviation for variability
  - Average and total distances
  - Date range of trips
  - Most common vehicles and drivers
  - Confidence level (High/Medium/Low based on sample size and variability)

- **Round-Trip Detection:**
  - Automatically identifies matching outbound/return routes
  - Calculates combined round-trip times and distances
  - Shows separate outbound and return metrics

- **Statistical Analysis:**
  - Mean, median, standard deviation calculations
  - Confidence scoring based on sample size and consistency

### 3. **User Interface Components**

#### **Upload Component** (`src/components/RouteAnalysisUpload.tsx`)
- Drag-and-drop file upload
- File type validation
- Visual feedback during processing
- Lists expected column formats
- Shows parsing errors and warnings

#### **Metrics Table** (`src/components/RouteMetricsTable.tsx`)
- Sortable columns (by route, trip count, time, distance)
- Displays all route metrics in a clean table
- Toggle view to show round-trip analysis
- Confidence badges (High/Medium/Low)
- Shows common vehicles per route
- Responsive design

#### **Main Page** (`src/pages/RouteAnalysisPage.tsx`)
- Summary cards showing:
  - Total trips analyzed
  - Unique routes discovered
  - Total distance covered
  - Total time spent
- Step-by-step usage instructions
- CSV export functionality
- Error/warning display
- Reset/upload new file option

### 4. **Data Types** (`src/types/routeAnalysis.ts`)
- Complete TypeScript type definitions
- RawTripData - Parsed Excel data
- RouteMetrics - Calculated route statistics
- RoundTripAnalysis - Paired route analysis
- RouteAnalysisResult - Complete analysis output
- ExcelParseResult - Parser output with errors

### 5. **Navigation Integration**
- Added "Route Analysis" option to Data Centre sidebar
- Route icon for visual identification
- Positioned between MtData Analytics and Master Data Config
- Protected route with authentication
- Uses existing DataCentreLayout

## How to Use

### For Users:
1. Navigate to **Data Centre → Route Analysis**
2. Upload an Excel file with trip history data
3. Review the parsed results and any warnings
4. Analyze route metrics and round-trip patterns
5. Export results to CSV for rate planning

### For Developers:
All files are documented with JSDoc comments. Key files:
- `/src/pages/RouteAnalysisPage.tsx` - Main entry point
- `/src/services/routeAnalysisService.ts` - Core analysis logic
- `/src/utils/excelTripParser.ts` - Excel parsing logic

## Excel File Format

### Required Columns:
| Column | Variations Accepted | Example |
|--------|-------------------|---------|
| Vehicle | vehicle, truck, rego, registration, unit, asset | "Truck 101" |
| Start Location | start location, origin, from location, departure | "Perth Terminal" |
| End Location | end location, destination, to location, arrival | "Customer XYZ" |
| Start Time | start time, start date, departure time | "2025-01-15 08:30" |
| End Time | end time, end date, arrival time | "2025-01-15 10:45" |
| Distance | distance, km, kilometers, kilometres | "125.5" |

### Optional Columns:
- Driver / Operator

### Example Data:
```
Vehicle | Start Location | End Location | Start Time | End Time | Distance
--------|---------------|--------------|------------|----------|----------
ABC123  | Perth Depot   | Customer A   | 2025-01-15 08:00 | 2025-01-15 10:30 | 145
ABC123  | Customer A    | Perth Depot  | 2025-01-15 11:00 | 2025-01-15 13:15 | 148
```

## Analysis Output

### Route Metrics:
- **Trip Count** - Number of times this route was traveled
- **Average Time** - Mean trip duration
- **Time Range** - Min to max trip times
- **Average Distance** - Mean distance traveled
- **Total Distance** - Sum of all trips on this route
- **Confidence Level** - Statistical confidence in the averages
- **Common Vehicles** - Most frequently used vehicles

### Round-Trip Analysis:
- Paired outbound and return routes
- Separate and combined metrics
- Useful for calculating full delivery cycle times

### CSV Export:
Includes all metrics in a business-friendly format:
- Summary statistics
- Per-route detailed metrics
- Round-trip analysis
- Ready for rate calculation

## Technical Details

### Dependencies Used:
- **xlsx** - Excel file parsing (already installed)
- **React** - UI framework
- **TypeScript** - Type safety
- **shadcn/ui** - UI components
- **Lucide React** - Icons
- **React Router** - Navigation

### Performance:
- Client-side processing (no server required)
- Handles large Excel files efficiently
- Statistical calculations optimized
- Responsive UI with loading states

### Error Handling:
- Comprehensive validation
- Detailed error messages
- Row-level error reporting
- Graceful degradation (skips invalid rows)

## Future Enhancements (Optional)

Potential improvements for future development:
1. **Database Integration** - Save analysis results to `mtdata_trip_history`
2. **Historical Comparison** - Compare current analysis with previous periods
3. **Route Visualization** - Map view showing routes on a geographic map
4. **Rate Calculator** - Built-in calculator to suggest rates based on analysis
5. **Automated Scheduling** - Regular import from configured sources
6. **Advanced Filtering** - Filter by date range, vehicle, driver, etc.
7. **Charts & Graphs** - Visual representations of route performance
8. **Outlier Detection** - Highlight unusual trips for investigation

## Support

For questions or issues with the Route Analysis tool:
1. Check the in-app instructions
2. Verify Excel file format matches expected columns
3. Review error messages for specific issues
4. Check browser console for technical errors

## File Summary

### Created Files (8):
1. `src/types/routeAnalysis.ts` - TypeScript type definitions
2. `src/utils/excelTripParser.ts` - Excel file parser
3. `src/services/routeAnalysisService.ts` - Analysis engine
4. `src/components/RouteAnalysisUpload.tsx` - Upload component
5. `src/components/RouteMetricsTable.tsx` - Results table
6. `src/pages/RouteAnalysisPage.tsx` - Main page
7. `ROUTE_ANALYSIS_README.md` - This documentation

### Modified Files (2):
1. `src/components/DataCentreSidebar.tsx` - Added navigation item
2. `src/App.tsx` - Added route configuration

## Testing Recommendations

1. **Test with sample Excel file** - Use the provided trip history report
2. **Verify column detection** - Try different column name variations
3. **Check error handling** - Upload invalid files to test error messages
4. **Test sorting** - Sort table by different columns
5. **Round-trip view** - Toggle between route and round-trip views
6. **CSV export** - Verify export contains all expected data
7. **Mobile responsiveness** - Test on different screen sizes

---

**Implementation Date:** 2025-11-12
**Status:** ✅ Complete and Ready for Use
