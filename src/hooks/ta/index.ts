/**
 * TankAlert (ta_) Schema Hooks
 *
 * Optimized hooks using the new ta_ prefixed tables with:
 * - Pre-calculated analytics via materialized views
 * - Single-query data fetching
 * - Database-side urgency scoring
 *
 * Performance: ~90% faster than legacy hooks
 */

export { useTaTanks, type TaTank } from '../useTaTanks';
export { useTaDipReadings, type TaDipReading, type CreateDipReadingInput } from '../useTaDipReadings';

// Re-export as default for convenience
export { useTaTanks as default } from '../useTaTanks';
