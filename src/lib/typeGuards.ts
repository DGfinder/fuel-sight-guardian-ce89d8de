/**
 * Type guards and safe conversion utilities to prevent React "Cannot convert object to primitive value" errors
 */

/**
 * Safely converts any value to a string, handling complex objects and circular references
 */
export function safeStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'string') {
    return value;
  }
  
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  
  if (typeof value === 'object') {
    try {
      // For arrays, join elements safely
      if (Array.isArray(value)) {
        return value.map(item => safeStringify(item)).join(', ');
      }
      
      // For objects, try JSON.stringify with circular reference handling
      return JSON.stringify(value, (key, val) => {
        if (typeof val === 'object' && val !== null) {
          // Simple circular reference detection
          if (val.constructor === Object && Object.keys(val).length > 10) {
            return '[Complex Object]';
          }
        }
        return val;
      });
    } catch (error) {
      // Fallback for circular references or other JSON errors
      return '[Object]';
    }
  }
  
  // Fallback for any other type
  try {
    return String(value);
  } catch {
    return '[Unknown]';
  }
}

/**
 * Safely extracts a string property from an object
 */
export function safeStringProperty(obj: unknown, property: string, fallback: string = ''): string {
  if (obj && typeof obj === 'object' && obj !== null) {
    const value = (obj as Record<string, unknown>)[property];
    return safeStringify(value) || fallback;
  }
  return fallback;
}

/**
 * Checks if a value is a valid React key (string or number)
 */
export function isValidReactKey(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number';
}

/**
 * Safely generates a React key from any value
 */
export function safeReactKey(value: unknown, fallback: string = 'unknown'): string {
  if (isValidReactKey(value)) {
    return String(value);
  }
  return fallback;
}

/**
 * Safely extracts a number from any value
 */
export function safeNumber(value: unknown, fallback: number = 0): number {
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? fallback : parsed;
  }
  
  return fallback;
}

/**
 * Type guard to check if an object has a specific property of a given type
 */
export function hasStringProperty(obj: unknown, property: string): obj is Record<string, string> {
  return obj !== null && 
         typeof obj === 'object' && 
         property in obj && 
         typeof (obj as Record<string, unknown>)[property] === 'string';
}

/**
 * Type guard to check if an object has a specific number property
 */
export function hasNumberProperty(obj: unknown, property: string): obj is Record<string, number> {
  return obj !== null && 
         typeof obj === 'object' && 
         property in obj && 
         typeof (obj as Record<string, unknown>)[property] === 'number';
}

/**
 * Safely checks if an object is a plain object (not array, null, etc.)
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && 
         typeof value === 'object' && 
         !Array.isArray(value) && 
         value.constructor === Object;
}