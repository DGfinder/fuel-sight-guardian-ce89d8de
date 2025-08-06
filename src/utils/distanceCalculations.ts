/**
 * DISTANCE CALCULATION UTILITIES
 * 
 * Utilities for calculating distances between terminals and customers
 * for logistics analysis and delivery cost optimization
 */

// Known fuel terminal coordinates - AU TERM locations where trucks load fuel
export const TERMINAL_COORDINATES: Record<string, { lat: number; lng: number; name: string }> = {
  // Fuel Loading Terminals (Updated with AU TERM coordinates)
  'Kewdale': { lat: -31.981076196850736, lng: 115.9723248550286, name: 'Kewdale Terminal' },
  'Geraldton': { lat: -28.78226543395978, lng: 114.59626791553842, name: 'Geraldton Terminal' },
  'Kalgoorlie': { lat: -30.778741698920648, lng: 121.42510090094386, name: 'Kalgoorlie Terminal' },
  'Coogee Rockingham': { lat: -32.2233144927088, lng: 115.75948393680929, name: 'Coogee Rockingham Terminal' },
  'Merredin': { lat: -31.483243328052218, lng: 118.2526964695131, name: 'Merredin Terminal' },
  'Albany': { lat: -34.954554508791155, lng: 117.88980579777935, name: 'Albany Terminal' },
  'Wongan Hills': { lat: -30.89780974646496, lng: 116.71992488536, name: 'Wongan Hills Terminal' },
  
  // GSF Terminals (keep existing for now)
  'Esperance': { lat: -33.8614, lng: 121.8910, name: 'Esperance Terminal' },
  'Port Hedland': { lat: -20.3192, lng: 118.5717, name: 'Port Hedland Terminal' },
  'Karratha': { lat: -20.7364, lng: 116.8460, name: 'Karratha Terminal' },
  'Newman': { lat: -23.3586, lng: 119.7372, name: 'Newman Terminal' },
  'Broome': { lat: -17.9644, lng: 122.2304, name: 'Broome Terminal' }
};

// Customer location estimates (by region/area - simplified)
export const CUSTOMER_LOCATION_ESTIMATES: Record<string, { lat: number; lng: number }> = {
  // Major mining areas
  'Kalgoorlie Gold Fields': { lat: -30.7458, lng: 121.4715 },
  'Pilbara Region': { lat: -22.5, lng: 118.5 },
  'Goldfields': { lat: -30.0, lng: 121.0 },
  'Mid West': { lat: -28.5, lng: 115.5 },
  'South West': { lat: -33.5, lng: 115.5 },
  'Kimberley': { lat: -17.5, lng: 123.0 },
  'Great Southern': { lat: -34.5, lng: 117.5 },
  
  // Default locations for unknown customers (use Kewdale terminal)
  'Perth Metro': { lat: -31.981076196850736, lng: 115.9723248550286 },
  'Unknown': { lat: -31.981076196850736, lng: 115.9723248550286 }
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of first point
 * @param lng1 Longitude of first point  
 * @param lat2 Latitude of second point
 * @param lng2 Longitude of second point
 * @returns Distance in kilometers
 */
export function calculateHaversineDistance(
  lat1: number, 
  lng1: number, 
  lat2: number, 
  lng2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Estimate customer location based on customer name or region
 * @param customerName Name of the customer
 * @returns Estimated coordinates
 */
export function estimateCustomerLocation(customerName: string): { lat: number; lng: number } {
  const name = customerName.toLowerCase();
  
  // Check for specific regional keywords
  if (name.includes('kalgoorlie') || name.includes('goldfield')) {
    return CUSTOMER_LOCATION_ESTIMATES['Kalgoorlie Gold Fields'];
  }
  if (name.includes('pilbara') || name.includes('port hedland') || name.includes('newman')) {
    return CUSTOMER_LOCATION_ESTIMATES['Pilbara Region'];
  }
  if (name.includes('geraldton') || name.includes('mid west')) {
    return CUSTOMER_LOCATION_ESTIMATES['Mid West'];
  }
  if (name.includes('bunbury') || name.includes('south west')) {
    return CUSTOMER_LOCATION_ESTIMATES['South West'];
  }
  if (name.includes('broome') || name.includes('kimberley')) {
    return CUSTOMER_LOCATION_ESTIMATES['Kimberley'];
  }
  if (name.includes('albany') || name.includes('great southern')) {
    return CUSTOMER_LOCATION_ESTIMATES['Great Southern'];
  }
  if (name.includes('perth') || name.includes('kewdale')) {
    return CUSTOMER_LOCATION_ESTIMATES['Perth Metro'];
  }
  
  // Default to Kewdale (primary terminal) for unknown customers
  return CUSTOMER_LOCATION_ESTIMATES['Unknown'];
}

/**
 * Calculate distance from terminal to customer
 * @param terminalName Name of the terminal
 * @param customerName Name of the customer
 * @returns Distance object with one-way and return distances
 */
export function calculateTerminalToCustomerDistance(
  terminalName: string, 
  customerName: string
): {
  oneWayDistance: number;
  returnDistance: number;
  terminalCoords: { lat: number; lng: number } | null;
  customerCoords: { lat: number; lng: number };
} {
  const terminalCoords = TERMINAL_COORDINATES[terminalName];
  const customerCoords = estimateCustomerLocation(customerName);
  
  if (!terminalCoords) {
    return {
      oneWayDistance: 0,
      returnDistance: 0,
      terminalCoords: null,
      customerCoords
    };
  }
  
  const oneWayDistance = calculateHaversineDistance(
    terminalCoords.lat,
    terminalCoords.lng,
    customerCoords.lat,
    customerCoords.lng
  );
  
  return {
    oneWayDistance,
    returnDistance: oneWayDistance * 2,
    terminalCoords,
    customerCoords
  };
}

/**
 * Calculate total kilometers driven for multiple deliveries
 * @param deliveries Array of delivery data with terminal and customer info
 * @returns Total kilometers for all deliveries
 */
export function calculateTotalDeliveryDistance(
  deliveries: Array<{ terminal: string; customer: string; deliveryCount?: number }>
): {
  totalOneWayKm: number;
  totalReturnKm: number;
  deliveryDistances: Array<{
    terminal: string;
    customer: string;
    oneWayDistance: number;
    returnDistance: number;
    deliveryCount: number;
    totalKmForCustomer: number;
  }>;
} {
  let totalOneWayKm = 0;
  let totalReturnKm = 0;
  
  const deliveryDistances = deliveries.map(delivery => {
    const distance = calculateTerminalToCustomerDistance(delivery.terminal, delivery.customer);
    const deliveryCount = delivery.deliveryCount || 1;
    const totalKmForCustomer = distance.returnDistance * deliveryCount;
    
    totalOneWayKm += distance.oneWayDistance * deliveryCount;
    totalReturnKm += distance.returnDistance * deliveryCount;
    
    return {
      terminal: delivery.terminal,
      customer: delivery.customer,
      oneWayDistance: distance.oneWayDistance,
      returnDistance: distance.returnDistance,
      deliveryCount,
      totalKmForCustomer
    };
  });
  
  return {
    totalOneWayKm: Math.round(totalOneWayKm * 10) / 10,
    totalReturnKm: Math.round(totalReturnKm * 10) / 10,
    deliveryDistances
  };
}

/**
 * Find the nearest terminal to a customer
 * @param customerName Name of the customer
 * @returns Nearest terminal info
 */
export function findNearestTerminal(customerName: string): {
  terminalName: string;
  distance: number;
  terminalCoords: { lat: number; lng: number };
} | null {
  const customerCoords = estimateCustomerLocation(customerName);
  let nearestTerminal = null;
  let shortestDistance = Infinity;
  
  Object.entries(TERMINAL_COORDINATES).forEach(([terminalName, terminalCoords]) => {
    const distance = calculateHaversineDistance(
      terminalCoords.lat,
      terminalCoords.lng,
      customerCoords.lat,
      customerCoords.lng
    );
    
    if (distance < shortestDistance) {
      shortestDistance = distance;
      nearestTerminal = {
        terminalName,
        distance,
        terminalCoords
      };
    }
  });
  
  return nearestTerminal;
}

/**
 * Format distance for display
 * @param distance Distance in kilometers
 * @returns Formatted string
 */
export function formatDistance(distance: number): string {
  if (distance === 0) return 'N/A';
  if (distance < 1) return `${(distance * 1000).toFixed(0)}m`;
  return `${distance.toFixed(1)}km`;
}

/**
 * Calculate delivery efficiency metrics
 * @param volumeLitres Total volume delivered
 * @param totalDistance Total distance driven
 * @returns Efficiency metrics
 */
export function calculateDeliveryEfficiency(
  volumeLitres: number,
  totalDistance: number
): {
  litresPerKm: number;
  kmPerLitre: number;
  efficiency: 'High' | 'Medium' | 'Low';
} {
  const litresPerKm = totalDistance > 0 ? volumeLitres / totalDistance : 0;
  const kmPerLitre = volumeLitres > 0 ? totalDistance / volumeLitres : 0;
  
  let efficiency: 'High' | 'Medium' | 'Low' = 'Low';
  if (litresPerKm > 1000) efficiency = 'High';
  else if (litresPerKm > 500) efficiency = 'Medium';
  
  return {
    litresPerKm: Math.round(litresPerKm * 10) / 10,
    kmPerLitre: Math.round(kmPerLitre * 1000) / 1000,
    efficiency
  };
}