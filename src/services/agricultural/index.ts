/**
 * Agricultural Intelligence Services
 *
 * Services for proactive delivery recommendations and operation detection
 * for farming customers.
 */

export * from './baseline-calculator';
export * from './operation-detector';
export * from './delivery-recommender';

export { default as baselineCalculator } from './baseline-calculator';
export { default as operationDetector } from './operation-detector';
export { default as deliveryRecommender } from './delivery-recommender';
