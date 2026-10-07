export function getLocalDateString(date: Date = new Date(), timeZone: string = 'Asia/Makassar'): string {
  const formatter = new Intl.DateTimeFormat('id-ID', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}
