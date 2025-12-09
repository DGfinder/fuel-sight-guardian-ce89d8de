/**
 * KalgoorlieTankMatcher
 * Maps Excel tank names from SharePoint to database tank IDs
 */

interface TankMapping {
  excelName: string;
  dbName: string;
  tankId: string;
}

const KALGOORLIE_TANK_MAPPINGS: TankMapping[] = [
  {
    excelName: 'MILLENNIUM STHP',
    dbName: 'Millennium STHP',
    tankId: '8b5ed106-5e1a-4a9c-8c5e-975f9fce459a',
  },
  {
    excelName: 'KUNDANA Gen 1',
    dbName: 'Mil KUNDANA Gen 1',
    tankId: '6bc0db19-4c82-4447-9531-2c0c957ab902',
  },
  {
    excelName: 'KUNDANA Gen 2',
    dbName: 'Mil KUNDANA Gen 2',
    tankId: 'df804603-fcad-4e4f-be4c-f530817b5b5f',
  },
  {
    excelName: 'RHP/RUBICON SURFACE',
    dbName: 'RUBICON SURFACE',
    tankId: '8f63f353-089b-4a94-b2b4-03de167d764f',
  },
  {
    excelName: 'RALEIGH SURFACE',
    dbName: 'RALEIGH SURFACE',
    tankId: '5aefc0ef-0fbb-4edf-8a84-801372179138',
  },
  {
    excelName: 'MLG Kundana',
    dbName: 'MLG Kundana',
    tankId: '38adbc1a-4236-4daa-a03a-d1f21f914f59',
  },
  {
    excelName: 'Paradigm O/P',
    dbName: 'Paradigm O/P',
    tankId: 'bcd39536-bac0-473d-879c-8a088c315f81',
  },
];

export class KalgoorlieTankMatcher {
  /**
   * Match an Excel tank name to a database tank ID
   * @param excelName Tank name from Excel/Power Automate
   * @returns Tank ID or null if no match found
   */
  static matchTankId(excelName: string): string | null {
    // Normalize input
    const normalized = excelName.trim();

    // Exact match
    const exactMatch = KALGOORLIE_TANK_MAPPINGS.find(
      (m) => m.excelName === normalized
    );
    if (exactMatch) {
      return exactMatch.tankId;
    }

    // Case-insensitive match
    const caseInsensitiveMatch = KALGOORLIE_TANK_MAPPINGS.find(
      (m) => m.excelName.toLowerCase() === normalized.toLowerCase()
    );
    if (caseInsensitiveMatch) {
      return caseInsensitiveMatch.tankId;
    }

    // Fuzzy match: remove special characters and compare
    const fuzzyNormalized = normalized.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const fuzzyMatch = KALGOORLIE_TANK_MAPPINGS.find((m) => {
      const fuzzyExcel = m.excelName.replace(/[^a-z0-9]/gi, '').toLowerCase();
      const fuzzyDb = m.dbName.replace(/[^a-z0-9]/gi, '').toLowerCase();
      return fuzzyExcel === fuzzyNormalized || fuzzyDb === fuzzyNormalized;
    });

    if (fuzzyMatch) {
      console.log(`[KalgoorlieTankMatcher] Fuzzy matched "${excelName}" to ${fuzzyMatch.dbName}`);
      return fuzzyMatch.tankId;
    }

    console.warn(`[KalgoorlieTankMatcher] No match found for tank: "${excelName}"`);
    return null;
  }

  /**
   * Get all mapped tank IDs (for validation)
   */
  static getAllTankIds(): string[] {
    return KALGOORLIE_TANK_MAPPINGS.map((m) => m.tankId);
  }

  /**
   * Get tank mapping info (for debugging)
   */
  static getTankMappings(): TankMapping[] {
    return KALGOORLIE_TANK_MAPPINGS;
  }
}
