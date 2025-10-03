-- =====================================================
-- Test Fixed get_vehicle_driver_associations_summary Function
-- =====================================================
-- Tests the corrected function that eliminates "anonymous composite types" error
--
-- Author: Claude Code
-- Created: 2025-08-25

-- Test the fixed function with Wayne Bowron's data
SELECT get_vehicle_driver_associations_summary(
    '202f3cb3-adc6-4af9-bfbb-069b87505287'::UUID,
    '1IDB419',
    180
) as function_result;