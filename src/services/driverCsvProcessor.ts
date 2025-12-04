import { Driver, DriverNameMapping, SystemName, FleetName } from '@/types/fleet';

export interface DriverCsvRow {
  fleet: string;
  standardDriverName: string;
  driverHoursDriverName: string;
  myobDriverName: string;
  myobDriverName2: string;
  mtDataName: string;
  fuelUsageSmartFuelName: string;
  lytxDriverName: string;
  depot: string;
  rowIndex: number;
  error?: string;
}

export interface ProcessedDriverData {
  drivers: Driver[];
  nameMappings: DriverNameMapping[];
  totalProcessed: number;
  uniqueDrivers: number;
  fleetDistribution: Array<{
    fleet: FleetName;
    count: number;
    percentage: number;
  }>;
  depotDistribution: Array<{
    depot: string;
    count: number;
    percentage: number;
  }>;
  duplicateNames: Array<{
    name: string;
    count: number;
    systems: SystemName[];
  }>;
  validationResults: {
    validRows: number;
    invalidRows: number;
    errors: Array<{
      row: number;
      error: string;
    }>;
  };
}

export interface DriverCsvProcessorOptions {
  skipDuplicates?: boolean;
  normalizeNames?: boolean;
  createIds?: boolean;
  validateFleets?: boolean;
}

export class DriverCsvProcessor {
  private static readonly EXPECTED_HEADERS = [
    'Fleet',
    'Standard Driver Name',
    'Driver Hours Driver Name',
    'MYOB Driver Name',
    'MYOB Driver Name 2',
    'MtData Name',
    'Fuel Usage/SmartFuel Name',
    'Lytx Driver Name',
    'Depot'
  ];

  private static readonly VALID_FLEETS: FleetName[] = ['Stevemacs', 'Great Southern Fuels'];

  static parseCsvContent(csvContent: string): DriverCsvRow[] {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must contain at least a header row and one data row');
    }

    const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const expectedHeaders = this.EXPECTED_HEADERS;
    
    // Validate headers
    const headerMismatch = expectedHeaders.some((expected, index) => 
      header[index] !== expected
    );
    
    if (headerMismatch) {
      console.warn('Header mismatch detected, expected:', expectedHeaders, 'got:', header);
    }

    return lines.slice(1).map((line, index) => {
      const values = this.parseCsvLine(line);
      
      return {
        fleet: values[0] || '',
        standardDriverName: values[1] || '',
        driverHoursDriverName: values[2] || '',
        myobDriverName: values[3] || '',
        myobDriverName2: values[4] || '',
        mtDataName: values[5] || '',
        fuelUsageSmartFuelName: values[6] || '',
        lytxDriverName: values[7] || '',
        depot: values[8] || '',
        rowIndex: index + 2, // +2 because we skip header and arrays are 0-indexed
      };
    }).filter(row => 
      // Filter out completely empty rows
      row.standardDriverName.trim() !== '' || 
      row.lytxDriverName.trim() !== '' ||
      row.fleet.trim() !== ''
    );
  }

  private static parseCsvLine(line: string): string[] {
    const values = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      
      if (char === '"' && !inQuotes) {
        inQuotes = true;
      } else if (char === '"' && inQuotes) {
        if (i + 1 < line.length && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = false;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
      i++;
    }
    
    values.push(current.trim());
    return values;
  }

  static validateRow(row: DriverCsvRow): string | null {
    // Must have at least a standard driver name
    if (!row.standardDriverName.trim()) {
      return 'Standard Driver Name is required';
    }

    // Must have a valid fleet (if provided)
    if (row.fleet.trim() && !this.VALID_FLEETS.includes(row.fleet as FleetName)) {
      return `Invalid fleet: ${row.fleet}. Must be one of: ${this.VALID_FLEETS.join(', ')}`;
    }

    // Must have a depot (if fleet is provided)
    if (row.fleet.trim() && !row.depot.trim()) {
      return 'Depot is required when fleet is specified';
    }

    return null;
  }

  static normalizeName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[^\w\s-']/g, '') // Remove special characters except spaces, hyphens, apostrophes
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  static extractFirstLastName(fullName: string): { firstName: string; lastName: string } {
    const normalized = this.normalizeName(fullName);
    const parts = normalized.split(' ').filter(p => p.length > 0);
    
    if (parts.length === 0) {
      return { firstName: '', lastName: '' };
    } else if (parts.length === 1) {
      return { firstName: parts[0], lastName: '' };
    } else {
      return { 
        firstName: parts[0], 
        lastName: parts.slice(1).join(' ') 
      };
    }
  }

  static processDriverData(
    csvRows: DriverCsvRow[], 
    options: DriverCsvProcessorOptions = {}
  ): ProcessedDriverData {
    const {
      skipDuplicates = true,
      normalizeNames = true,
      createIds = true,
      validateFleets = true
    } = options;

    const errors: Array<{ row: number; error: string }> = [];
    const validRows: DriverCsvRow[] = [];
    const seenDrivers = new Map<string, Driver>();
    const allNameMappings: DriverNameMapping[] = [];
    const duplicateTracker = new Map<string, { count: number; systems: Set<SystemName> }>();

    // Validate and process each row
    csvRows.forEach(row => {
      const error = this.validateRow(row);
      if (error) {
        errors.push({ row: row.rowIndex, error });
        return;
      }
      validRows.push(row);
    });

    // Process valid rows into drivers and mappings
    validRows.forEach(row => {
      const standardName = normalizeNames ? this.normalizeName(row.standardDriverName) : row.standardDriverName;
      const { firstName, lastName } = this.extractFirstLastName(standardName);
      
      // Use standard name as the key to group drivers
      const driverKey = standardName.toLowerCase();
      
      let driver: Driver;
      if (seenDrivers.has(driverKey)) {
        driver = seenDrivers.get(driverKey)!;
      } else {
        // Create new driver
        driver = {
          id: createIds ? crypto.randomUUID() : '',
          first_name: firstName,
          last_name: lastName,
          preferred_name: undefined,
          employee_id: undefined,
          fleet: (row.fleet as FleetName) || 'Great Southern Fuels',
          depot: row.depot || 'Unknown',
          hire_date: undefined,
          status: 'Active',
          email: undefined,
          phone: undefined,
          address: undefined,
          drivers_license: undefined,
          license_expiry: undefined,
          certifications: [],
          safety_score: 0,
          lytx_score: 0,
          guardian_score: 0,
          overall_performance_rating: undefined,
          notes: undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: undefined,
        };
        seenDrivers.set(driverKey, driver);
      }

      // Create name mappings for all systems
      const systemMappings: Array<{ system: SystemName; name: string }> = [
        { system: 'Standard', name: row.standardDriverName },
        { system: 'Hours', name: row.driverHoursDriverName },
        { system: 'MYOB', name: row.myobDriverName },
        { system: 'MtData', name: row.mtDataName },
        { system: 'SmartFuel', name: row.fuelUsageSmartFuelName },
        { system: 'LYTX', name: row.lytxDriverName },
      ];

      // Add second MYOB name if different
      if (row.myobDriverName2 && row.myobDriverName2 !== row.myobDriverName) {
        systemMappings.push({ system: 'MYOB', name: row.myobDriverName2 });
      }

      systemMappings.forEach(({ system, name }) => {
        if (name && name.trim()) {
          const cleanName = normalizeNames ? this.normalizeName(name) : name.trim();
          
          // Track duplicates
          const dupKey = `${system}:${cleanName.toLowerCase()}`;
          if (duplicateTracker.has(dupKey)) {
            const dup = duplicateTracker.get(dupKey)!;
            dup.count++;
            dup.systems.add(system);
          } else {
            duplicateTracker.set(dupKey, { count: 1, systems: new Set([system]) });
          }

          // Create name mapping
          allNameMappings.push({
            id: createIds ? crypto.randomUUID() : '',
            driver_id: driver.id,
            system_name: system,
            mapped_name: cleanName,
            is_primary: system === 'Standard',
            confidence_score: this.calculateConfidenceScore(cleanName, standardName),
            created_at: new Date().toISOString(),
            created_by: undefined,
          });
        }
      });
    });

    const drivers = Array.from(seenDrivers.values());
    
    // Calculate distributions
    const fleetCounts = new Map<FleetName, number>();
    const depotCounts = new Map<string, number>();
    
    drivers.forEach(driver => {
      fleetCounts.set(driver.fleet, (fleetCounts.get(driver.fleet) || 0) + 1);
      depotCounts.set(driver.depot, (depotCounts.get(driver.depot) || 0) + 1);
    });

    const fleetDistribution = Array.from(fleetCounts.entries()).map(([fleet, count]) => ({
      fleet,
      count,
      percentage: (count / drivers.length) * 100
    }));

    const depotDistribution = Array.from(depotCounts.entries()).map(([depot, count]) => ({
      depot,
      count,
      percentage: (count / drivers.length) * 100
    }));

    // Find actual duplicates (names appearing in multiple systems)
    const duplicateNames = Array.from(duplicateTracker.entries())
      .filter(([_, data]) => data.count > 1 || data.systems.size > 1)
      .map(([key, data]) => {
        const [system, name] = key.split(':');
        return {
          name: name,
          count: data.count,
          systems: Array.from(data.systems)
        };
      });

    return {
      drivers,
      nameMappings: allNameMappings,
      totalProcessed: csvRows.length,
      uniqueDrivers: drivers.length,
      fleetDistribution,
      depotDistribution,
      duplicateNames,
      validationResults: {
        validRows: validRows.length,
        invalidRows: errors.length,
        errors
      }
    };
  }

  private static calculateConfidenceScore(mappedName: string, standardName: string): number {
    if (mappedName.toLowerCase() === standardName.toLowerCase()) {
      return 1.0;
    }
    
    // Simple similarity check - could be enhanced with Levenshtein distance
    const mappedWords = mappedName.toLowerCase().split(' ');
    const standardWords = standardName.toLowerCase().split(' ');
    
    const commonWords = mappedWords.filter(word => 
      standardWords.some(stdWord => stdWord.includes(word) || word.includes(stdWord))
    );
    
    return Math.min(1.0, Math.max(0.3, commonWords.length / Math.max(mappedWords.length, standardWords.length)));
  }

  static generateCsvTemplate(): string {
    const headers = this.EXPECTED_HEADERS;
    const sampleRow = [
      'Great Southern Fuels',
      'John Smith',
      'John Smith', 
      'Smith, John',
      '',
      'John Smith',
      'John Smith',
      'John Smith',
      'Kewdale'
    ];
    
    return [headers.join(','), sampleRow.join(',')].join('\n');
  }

  static validateCsvStructure(csvContent: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      const lines = csvContent.trim().split('\n');
      
      if (lines.length < 2) {
        errors.push('CSV must contain at least a header row and one data row');
      }
      
      const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const expectedHeaders = this.EXPECTED_HEADERS;
      
      if (header.length !== expectedHeaders.length) {
        errors.push(`Expected ${expectedHeaders.length} columns, found ${header.length}`);
      }
      
      expectedHeaders.forEach((expected, index) => {
        if (header[index] !== expected) {
          errors.push(`Column ${index + 1}: Expected "${expected}", found "${header[index]}"`);
        }
      });
      
    } catch (error) {
      errors.push(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}