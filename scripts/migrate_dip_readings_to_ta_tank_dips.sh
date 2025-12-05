#!/bin/bash
# Script to migrate all dip_readings references to ta_tank_dips
# Date: 2025-12-05

echo "Starting migration of dip_readings to ta_tank_dips..."

# List of files to migrate (excluding already migrated ones)
FILES=(
  "src/hooks/useTankHistory.ts"
  "src/components/fuel-dip/FuelDipForm.tsx"
  "src/components/RecentActivity.tsx"
  "src/pages/admin/FuelManagement.tsx"
  "src/hooks/admin/useDipReadingsCrud.ts"
  "src/components/modals/EditDipModal.tsx"
  "src/components/modals/BulkDipModal.tsx"
  "supabase/functions/fuel-analytics/index.ts"
)

# Field mappings:
# dip_readings.value → ta_tank_dips.level_liters
# dip_readings.recorded_by → ta_tank_dips.measured_by
# dip_readings.created_by_name → ta_tank_dips.measured_by_name

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Migrating $file..."

    # Create backup
    cp "$file" "$file.backup"

    # Replace table name in .from() calls
    sed -i "s/\.from('dip_readings')/.from('ta_tank_dips')/g" "$file"
    sed -i 's/\.from("dip_readings")/.from("ta_tank_dips")/g' "$file"

    echo "  ✓ Updated table name"
  else
    echo "  ✗ File not found: $file"
  fi
done

echo ""
echo "Migration complete!"
echo "NOTE: You'll need to manually update field names:"
echo "  - value → level_liters"
echo "  - recorded_by → measured_by"
echo "  - created_by_name → measured_by_name"
echo ""
echo "Backup files created with .backup extension"
