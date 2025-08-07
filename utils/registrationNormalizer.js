/**
 * Registration Normalization and Fuzzy Matching Utility
 * 
 * Handles inconsistent vehicle registration formatting by:
 * - Normalizing registrations to canonical format
 * - Implementing fuzzy matching for similar registrations
 * - Providing deduplication logic for import scripts
 */

/**
 * Normalize a vehicle registration to canonical format
 * @param {string} registration - Raw registration string
 * @returns {string} Normalized registration
 */
function normalizeRegistration(registration) {
  if (!registration || typeof registration !== 'string') {
    return '';
  }
  
  // Remove all whitespace and convert to uppercase
  let normalized = registration.trim().replace(/\s+/g, '').toUpperCase();
  
  // Handle common formatting patterns
  normalized = normalized
    // Remove common prefixes/suffixes that might be inconsistent
    .replace(/^[^A-Z0-9]/, '') // Remove leading non-alphanumeric
    .replace(/[^A-Z0-9]$/, '') // Remove trailing non-alphanumeric
    // Standardize common character substitutions
    .replace(/O/g, '0') // Replace O with 0 where it might be a number
    .replace(/I/g, '1') // Replace I with 1 where it might be a number
    // Remove any remaining non-alphanumeric characters
    .replace(/[^A-Z0-9]/g, '');
  
  return normalized;
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 
 * @param {string} str2 
 * @returns {number} Edit distance
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  // Initialize matrix
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Calculate similarity score between two registrations (0-1, higher is more similar)
 * @param {string} reg1 
 * @param {string} reg2 
 * @returns {number} Similarity score
 */
function calculateSimilarity(reg1, reg2) {
  const norm1 = normalizeRegistration(reg1);
  const norm2 = normalizeRegistration(reg2);
  
  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;
  
  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen === 0) return 0.0;
  
  const distance = levenshteinDistance(norm1, norm2);
  return 1 - (distance / maxLen);
}

/**
 * Check if two registrations are likely the same vehicle
 * @param {string} reg1 
 * @param {string} reg2 
 * @param {number} threshold - Similarity threshold (default 0.85)
 * @returns {boolean} True if likely the same vehicle
 */
function areSimilarRegistrations(reg1, reg2, threshold = 0.85) {
  // Exact match after normalization
  const norm1 = normalizeRegistration(reg1);
  const norm2 = normalizeRegistration(reg2);
  
  if (norm1 === norm2) return true;
  
  // Fuzzy match for similar registrations
  const similarity = calculateSimilarity(reg1, reg2);
  return similarity >= threshold;
}

/**
 * Find the canonical registration for a given registration from a list
 * @param {string} registration - Registration to find canonical form for
 * @param {Array<string>} registrationList - List of existing registrations
 * @param {number} threshold - Similarity threshold
 * @returns {string|null} Canonical registration or null if no match
 */
function findCanonicalRegistration(registration, registrationList, threshold = 0.85) {
  const normalized = normalizeRegistration(registration);
  
  // First try exact normalized match
  for (const existing of registrationList) {
    if (normalizeRegistration(existing) === normalized) {
      return existing;
    }
  }
  
  // Then try fuzzy matching
  let bestMatch = null;
  let bestScore = 0;
  
  for (const existing of registrationList) {
    const similarity = calculateSimilarity(registration, existing);
    if (similarity >= threshold && similarity > bestScore) {
      bestScore = similarity;
      bestMatch = existing;
    }
  }
  
  return bestMatch;
}

/**
 * Deduplicate a list of vehicle records based on registration similarity
 * @param {Array<Object>} vehicles - Array of vehicle objects with registration field
 * @param {string} registrationField - Name of registration field (default 'registration')
 * @param {number} threshold - Similarity threshold
 * @returns {Object} { deduplicated: Array, duplicates: Array, mapping: Map }
 */
function deduplicateVehicles(vehicles, registrationField = 'registration', threshold = 0.85) {
  const deduplicated = [];
  const duplicates = [];
  const mapping = new Map(); // Maps original registration -> canonical registration
  const canonicalRegistrations = new Set();
  
  for (const vehicle of vehicles) {
    const registration = vehicle[registrationField];
    if (!registration) continue;
    
    // Check if this registration is similar to any existing canonical registration
    const existingCanonical = findCanonicalRegistration(
      registration, 
      Array.from(canonicalRegistrations), 
      threshold
    );
    
    if (existingCanonical) {
      // This is a duplicate, map it to the canonical version
      duplicates.push({
        ...vehicle,
        originalRegistration: registration,
        canonicalRegistration: existingCanonical,
        similarity: calculateSimilarity(registration, existingCanonical)
      });
      mapping.set(registration, existingCanonical);
    } else {
      // This is a new unique vehicle
      const normalized = normalizeRegistration(registration);
      deduplicated.push({
        ...vehicle,
        [registrationField]: registration, // Keep original format as canonical
        normalizedRegistration: normalized
      });
      canonicalRegistrations.add(registration);
      mapping.set(registration, registration);
    }
  }
  
  return {
    deduplicated,
    duplicates,
    mapping,
    stats: {
      original: vehicles.length,
      unique: deduplicated.length,
      duplicates: duplicates.length,
      deduplicationRate: ((duplicates.length / vehicles.length) * 100).toFixed(1) + '%'
    }
  };
}

/**
 * Create a lookup map for fast registration matching
 * @param {Array<Object>} vehicles - Array of vehicle objects
 * @param {string} registrationField - Name of registration field
 * @param {string} valueField - Field to use as lookup value
 * @returns {Map} Lookup map with normalized keys
 */
function createRegistrationLookupMap(vehicles, registrationField = 'registration', valueField = 'fleet') {
  const lookupMap = new Map();
  const registrationVariants = new Map(); // Track all variants of each registration
  
  // First pass: collect all registrations and their variants
  for (const vehicle of vehicles) {
    const registration = vehicle[registrationField];
    if (!registration) continue;
    
    const normalized = normalizeRegistration(registration);
    
    if (!registrationVariants.has(normalized)) {
      registrationVariants.set(normalized, []);
    }
    registrationVariants.get(normalized).push({
      original: registration,
      vehicle: vehicle
    });
  }
  
  // Second pass: create lookup map with all variants pointing to the same value
  for (const [normalized, variants] of registrationVariants.entries()) {
    // Use the first variant as the canonical one
    const canonicalVehicle = variants[0].vehicle;
    const value = canonicalVehicle[valueField];
    
    // Map the normalized key
    lookupMap.set(normalized, value);
    
    // Map all original registration variants
    for (const variant of variants) {
      lookupMap.set(variant.original.toUpperCase(), value);
      lookupMap.set(normalizeRegistration(variant.original), value);
    }
  }
  
  return lookupMap;
}

/**
 * Enhanced fleet lookup function that handles registration variations
 * @param {string} vehicleRegistration - Registration to look up
 * @param {Map} fleetLookupMap - Fleet lookup map created by createRegistrationLookupMap
 * @returns {string|null} Fleet name or null if not found
 */
function lookupVehicleFleet(vehicleRegistration, fleetLookupMap) {
  if (!vehicleRegistration || !fleetLookupMap) return null;
  
  // Try exact match first
  const exactMatch = fleetLookupMap.get(vehicleRegistration.toUpperCase());
  if (exactMatch) return exactMatch;
  
  // Try normalized match
  const normalized = normalizeRegistration(vehicleRegistration);
  const normalizedMatch = fleetLookupMap.get(normalized);
  if (normalizedMatch) return normalizedMatch;
  
  // Try fuzzy matching against all keys
  const allKeys = Array.from(fleetLookupMap.keys());
  const fuzzyMatch = findCanonicalRegistration(vehicleRegistration, allKeys, 0.85);
  if (fuzzyMatch) {
    return fleetLookupMap.get(fuzzyMatch);
  }
  
  return null;
}

export {
  normalizeRegistration,
  calculateSimilarity,
  areSimilarRegistrations,
  findCanonicalRegistration,
  deduplicateVehicles,
  createRegistrationLookupMap,
  lookupVehicleFleet,
  levenshteinDistance
};