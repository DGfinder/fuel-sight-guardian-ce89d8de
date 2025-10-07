// Helper function to format timestamp with Australian timezone (Perth/AWST default)
export function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return 'No data';

  try {
    return formatRelativeTimeUtil(timestamp);
  } catch (error) {
    console.error('Error formatting timestamp:', error, timestamp);
    return 'Invalid date';
  }
}
