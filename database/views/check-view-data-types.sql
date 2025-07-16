-- CHECK EXISTING VIEW DATA TYPES
-- We need to match exact data types to avoid the column type change error

SELECT 'CHECKING EXISTING VIEW DATA TYPES' as step;

-- Get exact data types from current view
SELECT 
    column_name,
    data_type,
    numeric_precision,
    numeric_scale,
    is_nullable,
    ordinal_position
FROM information_schema.columns 
WHERE table_name = 'tanks_with_rolling_avg'
ORDER BY ordinal_position;

-- Focus on problematic columns
SELECT 'PROBLEMATIC COLUMNS DATA TYPES' as focus;
SELECT 
    column_name,
    data_type,
    CASE 
        WHEN data_type = 'numeric' THEN 'CAST(value AS numeric)'
        WHEN data_type = 'integer' THEN 'CAST(value AS integer)' 
        WHEN data_type = 'double precision' THEN 'CAST(value AS double precision)'
        WHEN data_type = 'text' THEN 'CAST(value AS text)'
        ELSE 'CAST(value AS ' || data_type || ')'
    END as required_cast
FROM information_schema.columns 
WHERE table_name = 'tanks_with_rolling_avg'
AND column_name IN (
    'current_level', 
    'current_level_percent', 
    'rolling_avg', 
    'prev_day_used', 
    'days_to_min_level'
)
ORDER BY ordinal_position;