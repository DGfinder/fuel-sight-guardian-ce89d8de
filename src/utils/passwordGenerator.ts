/**
 * Password Generation and Validation Utilities
 *
 * Provides secure password generation and strength validation
 * for customer account creation.
 */

/**
 * Generate a cryptographically secure random password
 *
 * @param length - Length of password (default: 12)
 * @returns A randomly generated password meeting complexity requirements
 *
 * Password includes:
 * - Uppercase letters (excluding O, I for clarity)
 * - Lowercase letters (excluding l for clarity)
 * - Numbers (excluding 0, 1 for clarity)
 * - Special characters (!@#$%^&*)
 */
export function generateSecurePassword(length: number = 12): string {
  // Character sets - exclude ambiguous characters (0, O, l, 1, I)
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const special = '!@#$%^&*';

  // Ensure at least one character from each set
  let password = '';
  password += getRandomChar(uppercase);
  password += getRandomChar(lowercase);
  password += getRandomChar(numbers);
  password += getRandomChar(special);

  // Fill remaining length with random characters from all sets
  const allChars = uppercase + lowercase + numbers + special;
  for (let i = password.length; i < length; i++) {
    password += getRandomChar(allChars);
  }

  // Shuffle the password to avoid predictable pattern (first chars always same type)
  return shuffleString(password);
}

/**
 * Get a cryptographically random character from a string
 */
function getRandomChar(chars: string): string {
  const randomIndex = crypto.getRandomValues(new Uint32Array(1))[0] % chars.length;
  return chars[randomIndex];
}

/**
 * Shuffle a string using Fisher-Yates algorithm with crypto random
 */
function shuffleString(str: string): string {
  const arr = str.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}

/**
 * Validation result with errors
 */
export interface PasswordValidation {
  valid: boolean;
  errors: string[];
  strength: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong';
}

/**
 * Validate password strength and requirements
 *
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 *
 * @param password - Password to validate
 * @returns Validation result with errors and strength rating
 */
export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];

  // Length check
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Uppercase check
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must include at least one uppercase letter');
  }

  // Lowercase check
  if (!/[a-z]/.test(password)) {
    errors.push('Password must include at least one lowercase letter');
  }

  // Number check
  if (!/[0-9]/.test(password)) {
    errors.push('Password must include at least one number');
  }

  // Special character check
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must include at least one special character');
  }

  // Calculate strength
  const strength = calculatePasswordStrength(password);

  return {
    valid: errors.length === 0,
    errors,
    strength,
  };
}

/**
 * Calculate password strength rating
 *
 * Factors:
 * - Length (8+ = 1 point, 12+ = 2 points)
 * - Character variety (mixed case = 1 point)
 * - Numbers (1 point)
 * - Special characters (1 point)
 *
 * @param password - Password to rate
 * @returns Strength rating (0-5 scale mapped to labels)
 */
export function calculatePasswordStrength(
  password: string
): 'very-weak' | 'weak' | 'fair' | 'good' | 'strong' {
  let score = 0;

  // Length scoring
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;

  // Character variety
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;

  // Numbers
  if (/[0-9]/.test(password)) score++;

  // Special characters
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  // Map score to strength label
  if (score === 0) return 'very-weak';
  if (score === 1) return 'weak';
  if (score === 2 || score === 3) return 'fair';
  if (score === 4) return 'good';
  return 'strong';
}

/**
 * Get password strength details for UI display
 *
 * @param password - Password to analyze
 * @returns Object with score, label, color, and percentage
 */
export function getPasswordStrengthDetails(password: string): {
  score: number;
  label: string;
  color: string;
  percentage: number;
} {
  const strength = calculatePasswordStrength(password);

  const strengthMap = {
    'very-weak': { score: 1, label: 'Very Weak', color: 'red', percentage: 20 },
    'weak': { score: 2, label: 'Weak', color: 'orange', percentage: 40 },
    'fair': { score: 3, label: 'Fair', color: 'yellow', percentage: 60 },
    'good': { score: 4, label: 'Good', color: 'blue', percentage: 80 },
    'strong': { score: 5, label: 'Strong', color: 'green', percentage: 100 },
  };

  return strengthMap[strength];
}
