export function formatMinutesHuman(totalMinutes) {
  if (totalMinutes == null || isNaN(totalMinutes)) return '—';
  const mins = Math.max(0, Math.floor(Number(totalMinutes)));
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const minutes = mins % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(' ');
}

export function formatMinutesVerbose(totalMinutes) {
  if (totalMinutes == null || isNaN(totalMinutes)) return 'No recorded downtime';
  const mins = Math.max(0, Math.floor(Number(totalMinutes)));
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const minutes = mins % 60;

  const parts = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
  return parts.join(', ');
}
