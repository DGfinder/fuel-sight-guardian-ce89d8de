import { SystemName } from '@/types/fleet';

export interface NameMatchResult {
  driverId: string;
  confidence: number;
  matchedName: string;
  matchedSystem: SystemName;
  alternativeMatches?: Array<{
    driverId: string;
    confidence: number;
    matchedName: string;
    matchedSystem: SystemName;
  }>;
}

export interface DriverNameRecord {
  driverId: string;
  systemName: SystemName;
  mappedName: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}

export class DriverNameMatcher {
  private static readonly NAME_VARIATIONS = {
    // Common name abbreviations and variations
    'Michael': ['Mike', 'Mick', 'Mickey'],
    'William': ['Bill', 'Will', 'Billy', 'Willie'],
    'James': ['Jim', 'Jimmy', 'Jamie'],
    'Robert': ['Rob', 'Bob', 'Bobby', 'Robbie'],
    'Richard': ['Rick', 'Dick', 'Ricky', 'Rich'],
    'David': ['Dave', 'Davey'],
    'Christopher': ['Chris', 'Kris'],
    'Matthew': ['Matt', 'Matty'],
    'Andrew': ['Andy', 'Drew'],
    'Joseph': ['Joe', 'Joey'],
    'Daniel': ['Dan', 'Danny'],
    'Anthony': ['Tony', 'Ant'],
    'Steven': ['Steve', 'Stevie'],
    'Kenneth': ['Ken', 'Kenny'],
    'Joshua': ['Josh'],
    'Kevin': ['Kev'],
    'Brian': ['Bri'],
    'George': ['Georgie'],
    'Edward': ['Ed', 'Eddie', 'Ted'],
    'Ronald': ['Ron', 'Ronnie'],
    'Timothy': ['Tim', 'Timmy'],
    'Jason': ['Jay'],
    'Jeffrey': ['Jeff'],
    'Ryan': ['Ry'],
    'Jacob': ['Jake'],
    'Gary': ['Gar'],
    'Nicholas': ['Nick', 'Nicky'],
    'Eric': ['Rick'],
    'Jonathan': ['Jon', 'Johnny'],
    'Stephen': ['Steve', 'Stevie'],
    'Larry': ['Lawrence'],
    'Justin': ['Just'],
    'Scott': ['Scotty'],
    'Brandon': ['Brand'],
    'Benjamin': ['Ben', 'Benny'],
    'Samuel': ['Sam', 'Sammy'],
    'Gregory': ['Greg'],
    'Frank': ['Frankie'],
    'Raymond': ['Ray'],
    'Alexander': ['Alex', 'Al'],
    'Patrick': ['Pat', 'Paddy'],
    'Jack': ['John'],
    'Dennis': ['Denny'],
    'Jerry': ['Gerald'],
    'Tyler': ['Ty'],
    'Aaron': ['Aar'],
    'Jose': ['Joey'],
    'Henry': ['Hank', 'Harry'],
    'Adam': ['Ad'],
    'Douglas': ['Doug'],
    'Nathan': ['Nate'],
    'Peter': ['Pete'],
    'Zachary': ['Zach', 'Zack'],
    'Kyle': ['Ky'],
    'Walter': ['Walt'],
    'Harold': ['Harry', 'Hal'],
    'Carl': ['Karl'],
    'Arthur': ['Art', 'Artie'],
    'Gerald': ['Jerry', 'Gerry'],
    'Roger': ['Rog'],
    'Keith': ['Kieth'],
    'Jeremy': ['Jerry', 'Jer'],
    'Lawrence': ['Larry'],
    'Sean': ['Shaun', 'Shawn'],
    'Christian': ['Chris'],
    'Albert': ['Al', 'Bert'],
    'Wayne': ['Way'],
    'Eugene': ['Gene'],
    'Ralph': ['Ralphie'],
    'Roy': ['Royal'],
    'Louis': ['Lou', 'Louie'],
    'Philip': ['Phil'],
    'Johnny': ['John']
  };

  private static readonly COMMON_SUFFIXES = ['Jr', 'Sr', 'III', 'II', 'IV'];
  private static readonly NOISE_WORDS = ['the', 'and', 'or', 'of', 'in', 'at', 'to', 'for', 'with'];

  /**
   * Normalize a name for consistent matching
   */
  static normalizeName(name: string): string {
    if (!name) return '';
    
    return name
      .trim()
      .replace(/[^\w\s'-]/g, '') // Remove special characters except spaces, hyphens, apostrophes
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .toLowerCase()
      .split(' ')
      .filter(word => word.length > 0)
      .map(word => this.capitalizeWord(word))
      .join(' ');
  }

  private static capitalizeWord(word: string): string {
    // Handle hyphenated names
    if (word.includes('-')) {
      return word.split('-').map(part => 
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      ).join('-');
    }
    
    // Handle apostrophes (O'Connor, etc.)
    if (word.includes("'")) {
      return word.split("'").map((part, index) => 
        index === 0 
          ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
          : part.toUpperCase() // Second part is often uppercase (O'CONNOR)
      ).join("'");
    }
    
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }

  /**
   * Extract first and last name from full name, handling various formats
   */
  static extractNames(fullName: string): { firstName: string; lastName: string; middleName?: string } {
    const normalized = this.normalizeName(fullName);
    const parts = normalized.split(' ').filter(p => p.length > 0);
    
    if (parts.length === 0) {
      return { firstName: '', lastName: '' };
    }
    
    // Handle "Last, First" format
    if (parts.length === 2 && parts[0].endsWith(',')) {
      const lastName = parts[0].replace(',', '');
      const firstName = parts[1];
      return { firstName, lastName };
    }
    
    // Handle "Last, First Middle" format
    if (parts.length >= 3 && parts[0].endsWith(',')) {
      const lastName = parts[0].replace(',', '');
      const firstName = parts[1];
      const middleName = parts.slice(2).join(' ');
      return { firstName, lastName, middleName };
    }
    
    // Handle standard "First Last" or "First Middle Last" format
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: '' };
    } else if (parts.length === 2) {
      return { firstName: parts[0], lastName: parts[1] };
    } else {
      // Multiple parts - first is first name, last is last name, middle are middle names
      return { 
        firstName: parts[0], 
        lastName: parts[parts.length - 1],
        middleName: parts.slice(1, -1).join(' ')
      };
    }
  }

  /**
   * Generate name variations for better matching
   */
  static generateNameVariations(firstName: string, lastName: string): string[] {
    const variations = new Set<string>();
    
    // Original name
    variations.add(`${firstName} ${lastName}`.trim());
    
    // Common nickname variations
    const nicknames = this.NAME_VARIATIONS[firstName] || [];
    nicknames.forEach(nickname => {
      variations.add(`${nickname} ${lastName}`.trim());
    });
    
    // Reverse lookup - if the input is a nickname, try the full name
    Object.entries(this.NAME_VARIATIONS).forEach(([fullName, nicks]) => {
      if (nicks.includes(firstName)) {
        variations.add(`${fullName} ${lastName}`.trim());
      }
    });
    
    // First name only (for partial matches)
    if (firstName) variations.add(firstName);
    
    // Last name only (for partial matches)
    if (lastName) variations.add(lastName);
    
    // Initials + last name
    if (firstName && lastName) {
      variations.add(`${firstName.charAt(0)} ${lastName}`);
      variations.add(`${firstName.charAt(0)}. ${lastName}`);
    }
    
    return Array.from(variations).filter(v => v.length > 0);
  }

  /**
   * Calculate similarity score between two names using multiple algorithms
   */
  static calculateSimilarity(name1: string, name2: string): number {
    if (!name1 || !name2) return 0;
    
    const norm1 = this.normalizeName(name1).toLowerCase();
    const norm2 = this.normalizeName(name2).toLowerCase();
    
    // Exact match
    if (norm1 === norm2) return 1.0;
    
    // Extract name components
    const names1 = this.extractNames(name1);
    const names2 = this.extractNames(name2);
    
    // Component-based matching
    let componentScore = 0;
    let componentCount = 0;
    
    // First name matching (including nicknames)
    if (names1.firstName && names2.firstName) {
      componentCount++;
      if (names1.firstName.toLowerCase() === names2.firstName.toLowerCase()) {
        componentScore += 1.0;
      } else {
        // Check nickname variations
        const variations1 = this.generateNameVariations(names1.firstName, '');
        const variations2 = this.generateNameVariations(names2.firstName, '');
        
        const hasMatch = variations1.some(v1 => 
          variations2.some(v2 => v1.toLowerCase() === v2.toLowerCase())
        );
        
        if (hasMatch) {
          componentScore += 0.8; // High score for nickname matches
        } else {
          // Partial string similarity
          componentScore += this.levenshteinSimilarity(names1.firstName, names2.firstName) * 0.5;
        }
      }
    }
    
    // Last name matching
    if (names1.lastName && names2.lastName) {
      componentCount++;
      if (names1.lastName.toLowerCase() === names2.lastName.toLowerCase()) {
        componentScore += 1.0;
      } else {
        componentScore += this.levenshteinSimilarity(names1.lastName, names2.lastName) * 0.7;
      }
    }
    
    const componentAverage = componentCount > 0 ? componentScore / componentCount : 0;
    
    // Overall string similarity as fallback
    const overallSimilarity = this.levenshteinSimilarity(norm1, norm2);
    
    // Token-based similarity
    const tokenSimilarity = this.tokenSimilarity(norm1, norm2);
    
    // Weighted combination
    return Math.max(
      componentAverage * 0.6 + overallSimilarity * 0.2 + tokenSimilarity * 0.2,
      Math.max(componentAverage, overallSimilarity, tokenSimilarity) * 0.8
    );
  }

  /**
   * Calculate Levenshtein similarity (0-1 scale)
   */
  private static levenshteinSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : 1 - (distance / maxLength);
  }

  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate token-based similarity
   */
  private static tokenSimilarity(str1: string, str2: string): number {
    const tokens1 = new Set(str1.toLowerCase().split(/\s+/));
    const tokens2 = new Set(str2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);
    
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  /**
   * Find the best matching driver for a given name
   */
  static findBestMatch(
    searchName: string, 
    driverRecords: DriverNameRecord[],
    minimumConfidence: number = 0.7
  ): NameMatchResult | null {
    
    if (!searchName.trim() || driverRecords.length === 0) {
      return null;
    }

    const matches: Array<{
      driverId: string;
      confidence: number;
      matchedName: string;
      matchedSystem: SystemName;
      record: DriverNameRecord;
    }> = [];

    // Test against all driver records
    driverRecords.forEach(record => {
      const confidence = this.calculateSimilarity(searchName, record.mappedName);
      
      if (confidence >= minimumConfidence) {
        matches.push({
          driverId: record.driverId,
          confidence,
          matchedName: record.mappedName,
          matchedSystem: record.systemName,
          record
        });
      }
    });

    if (matches.length === 0) {
      return null;
    }

    // Sort by confidence (highest first)
    matches.sort((a, b) => b.confidence - a.confidence);

    const bestMatch = matches[0];
    const alternativeMatches = matches.slice(1, 4).map(match => ({
      driverId: match.driverId,
      confidence: match.confidence,
      matchedName: match.matchedName,
      matchedSystem: match.matchedSystem
    }));

    return {
      driverId: bestMatch.driverId,
      confidence: bestMatch.confidence,
      matchedName: bestMatch.matchedName,
      matchedSystem: bestMatch.matchedSystem,
      alternativeMatches: alternativeMatches.length > 0 ? alternativeMatches : undefined
    };
  }

  /**
   * Find all potential matches for a name (useful for disambiguation)
   */
  static findAllMatches(
    searchName: string,
    driverRecords: DriverNameRecord[],
    minimumConfidence: number = 0.5
  ): NameMatchResult[] {
    
    if (!searchName.trim() || driverRecords.length === 0) {
      return [];
    }

    const matches: NameMatchResult[] = [];

    driverRecords.forEach(record => {
      const confidence = this.calculateSimilarity(searchName, record.mappedName);
      
      if (confidence >= minimumConfidence) {
        matches.push({
          driverId: record.driverId,
          confidence,
          matchedName: record.mappedName,
          matchedSystem: record.systemName
        });
      }
    });

    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Validate if two names likely refer to the same person
   */
  static isSamePerson(name1: string, name2: string, threshold: number = 0.8): boolean {
    return this.calculateSimilarity(name1, name2) >= threshold;
  }

  /**
   * Clean and standardize name for database storage
   */
  static standardizeName(name: string): string {
    const normalized = this.normalizeName(name);
    const { firstName, lastName, middleName } = this.extractNames(normalized);
    
    if (middleName) {
      return `${firstName} ${middleName} ${lastName}`.trim();
    }
    
    return `${firstName} ${lastName}`.trim();
  }

  /**
   * Generate phonetic code for name (simplified Soundex)
   */
  static generatePhoneticCode(name: string): string {
    const normalized = this.normalizeName(name).toLowerCase();
    
    // Simple phonetic mapping
    let code = normalized
      .replace(/[aeiouyhw]/g, '0')
      .replace(/[bfpv]/g, '1')
      .replace(/[cgjkqsxz]/g, '2')
      .replace(/[dt]/g, '3')
      .replace(/[l]/g, '4')
      .replace(/[mn]/g, '5')
      .replace(/[r]/g, '6');
    
    // Remove zeros and duplicates
    code = code.replace(/0/g, '').replace(/(.)\1+/g, '$1');
    
    return code.slice(0, 4).padEnd(4, '0');
  }
}