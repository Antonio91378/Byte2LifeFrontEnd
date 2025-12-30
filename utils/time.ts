export function parseDurationToHours(input: string): number {
  if (!input) return 0;
  
  // Normalize input
  const text = input.toLowerCase().trim();

  // Try "4h 30m" or "4h30m" or "4h" or "30m" format
  const hoursMatch = text.match(/(\d+)\s*h/);
  const minutesMatch = text.match(/(\d+)\s*m/);
  
  let totalHours = 0;
  let found = false;

  if (hoursMatch) {
    totalHours += parseInt(hoursMatch[1]);
    found = true;
  }
  if (minutesMatch) {
    totalHours += parseInt(minutesMatch[1]) / 60;
    found = true;
  }
  
  if (found) return totalHours;

  // Try "4:30" format
  if (text.includes(':')) {
    const parts = text.split(':');
    if (parts.length === 2) {
      const h = parseFloat(parts[0]);
      const m = parseFloat(parts[1]);
      if (!isNaN(h) && !isNaN(m)) {
        return h + (m / 60);
      }
    }
  }

  // Try simple number (assumes hours if just a number, or maybe user typed "4.5")
  const floatVal = parseFloat(text.replace(',', '.'));
  if (!isNaN(floatVal)) return floatVal;

  return 0;
}

export function formatHoursToDuration(totalHours: number): string {
  if (!totalHours || isNaN(totalHours)) return '';
  
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);
  
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}
