# Bulk Dip Reading Entry for Kalgoorlie Subgroups

## Overview
The Fuel Sight Guardian system now includes powerful bulk dip reading entry capabilities specifically designed for the Kalgoorlie location. This feature allows operators to quickly and efficiently enter multiple dip readings across different subgroups.

## Features

### 🚀 Quick Entry Page (`/kalgoorlie/bulk-entry`)
- **Subgroup-Based Organization**: Tanks are automatically grouped by their subgroups
- **Real-time Validation**: Instant feedback for readings that exceed safe levels
- **Progressive Saving**: Save readings subgroup by subgroup as you complete them
- **Visual Progress Tracking**: See which subgroups are complete at a glance
- **Responsive Design**: Works on desktop and mobile devices

### 📊 Bulk Entry Modal
- **Table-Based Entry**: See all tanks in a structured table format
- **Live Ullage Calculation**: Automatically calculates ullage (available space) as you type
- **Error Highlighting**: Clearly shows validation errors for each tank
- **Batch Processing**: Submit all readings at once with progress tracking
- **CSV Import/Export**: Import readings from Excel or export templates

### 📁 CSV Import/Export
- **Template Generation**: Download pre-filled CSV templates with current tank data
- **Validation**: Full validation of CSV data before import
- **Error Reporting**: Detailed error messages for invalid entries
- **Preview**: See what will be imported before committing

## How to Use

### Quick Entry Method (Recommended)
1. Navigate to the Kalgoorlie Dashboard
2. Click the **"Quick Entry"** button
3. Select the date for all readings
4. Complete each subgroup section:
   - Enter dip readings for each tank
   - See real-time ullage calculations
   - Fix any validation errors (red highlighting)
   - Click "Save X Readings" when subgroup is complete
5. Progress is saved automatically as you go
6. Return to dashboard when all subgroups are complete

### Bulk Entry Modal
1. From the Kalgoorlie Dashboard, click **"Bulk Entry"**
2. Select the date for all readings
3. Enter readings for all tanks across all subgroups
4. Use the accordion to navigate between subgroups
5. Click "Save X Readings" to submit all at once

### CSV Import
1. Open the Bulk Entry Modal
2. Click **"Import CSV"**
3. Download the template first if needed
4. Fill in the template with your readings
5. Upload the completed CSV file
6. Review the preview for errors
7. Click "Import X Readings" to complete

## Validation Rules

The system enforces the following validation rules:
- **Safe Level Check**: Readings cannot exceed the tank's safe fill level
- **Positive Values**: Readings must be 0 or greater
- **Required Fields**: Tank ID and dip value are required
- **User Permissions**: Only accessible tanks based on subgroup permissions

## User Permissions

Access to subgroups is controlled through the user permissions system:
- **Admin/Manager**: Access to all subgroups
- **Regular Users**: Access only to assigned subgroups
- **No Permission**: Cannot access bulk entry features

## Technical Details

### Database Operations
- **Batch Inserts**: Efficient database operations for multiple readings
- **Transaction Safety**: All-or-nothing approach for batch operations
- **Audit Trail**: Full logging of who entered what and when

### Performance Optimizations
- **Lazy Loading**: Components load only when needed
- **Virtualization**: Handles large numbers of tanks efficiently
- **Progress Tracking**: Real-time feedback during submission
- **Error Recovery**: Graceful handling of partial failures

### Data Structure
Each dip reading includes:
- Tank ID
- Reading value (litres)
- Date/time
- Recorded by (user ID and name)
- Notes (bulk entry identification)

## Error Handling

The system provides clear feedback for common issues:
- **Validation Errors**: Highlighted in red with specific messages
- **Network Issues**: Retry capabilities for failed submissions
- **Partial Failures**: Detailed reporting of which readings failed
- **Permission Errors**: Clear messages about access restrictions

## Best Practices

1. **Use Quick Entry for Daily Rounds**: The subgroup-based approach matches operational workflows
2. **Download CSV Templates**: Ensures correct format and current tank data
3. **Review Before Submitting**: Check all readings for accuracy
4. **Complete Subgroups**: Save progress as you complete each area
5. **Monitor Validation**: Address red-highlighted errors immediately

## Troubleshooting

### Common Issues
- **"Tank not found" errors**: Tank may have been removed or access revoked
- **"Exceeds safe level" warnings**: Check if reading is correct or if safe level needs updating
- **CSV import failures**: Ensure template format matches exactly
- **Permission denied**: Contact administrator to verify subgroup access

### Getting Help
- Check validation messages for specific guidance
- Use the "Export Template" feature to verify correct format
- Contact system administrator for permission issues
- Refer to the tank details modal for current safe levels

## Implementation Files

### Frontend Components
- `/src/components/modals/BulkDipModal.tsx` - Main bulk entry modal
- `/src/components/CSVImportModal.tsx` - CSV import functionality
- `/src/components/SubgroupQuickEntry.tsx` - Subgroup-focused entry cards
- `/src/pages/KalgoorlieBulkEntry.tsx` - Dedicated bulk entry page

### Hooks and Utilities
- `/src/hooks/useBulkDipEntry.ts` - Bulk submission logic
- `/src/lib/validation.ts` - Business rules and validation

### Database Schema
- `dip_readings` table - Stores individual readings
- `user_subgroup_permissions` table - Controls subgroup access
- Indexes on `tank_id` and `created_at` for performance

This feature significantly improves the efficiency of data entry for operators managing multiple tanks across different subgroups, while maintaining data integrity and security.