/**
 * SERVER-SIDE CAPTIVE PAYMENTS CSV PROCESSOR
 * 
 * Processes captive payments CSV files for serverless API functions
 */

// Basic CSV processing function for serverless environment
export async function processCaptivePaymentsCsv(
  csvContent: string,
  options: {
    carrier?: 'SMB' | 'GSF';
    skipValidation?: boolean;
  } = {}
): Promise<{
  success: boolean;
  data?: any[];
  error?: string;
  stats?: {
    totalRows: number;
    processedRows: number;
    skippedRows: number;
  };
}> {
  try {
    // Simple CSV parsing for server-side
    const lines = csvContent.split('\n');
    const headers = lines[0]?.split(',').map(h => h.trim().replace(/"/g, '')) || [];
    
    if (lines.length < 2) {
      return {
        success: false,
        error: 'CSV file appears to be empty or invalid'
      };
    }
    
    const data = [];
    let processedRows = 0;
    let skippedRows = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        skippedRows++;
        continue;
      }
      
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      
      if (values.length !== headers.length) {
        skippedRows++;
        continue;
      }
      
      const row: Record<string, any> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      // Add metadata
      row._carrier = options.carrier || 'Unknown';
      row._processedAt = new Date().toISOString();
      
      data.push(row);
      processedRows++;
    }
    
    return {
      success: true,
      data,
      stats: {
        totalRows: lines.length - 1, // Exclude header
        processedRows,
        skippedRows
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Processing failed'
    };
  }
}

// Validation function
export function validateCaptivePaymentsCsv(data: any[]): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!Array.isArray(data) || data.length === 0) {
    errors.push('No data provided for validation');
    return { isValid: false, errors, warnings };
  }
  
  // Basic validation - can be extended
  const requiredFields = ['Terminal ID', 'Transaction Date', 'Amount'];
  const firstRow = data[0];
  
  for (const field of requiredFields) {
    if (!(field in firstRow)) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  if (data.length > 10000) {
    warnings.push('Large dataset detected. Processing may take longer.');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}