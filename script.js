/** Utilidades de fecha. Se persiste en ISO 8601 (UTC) y se muestra en hora local. */

const dateFormatter = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' });
const fullFormatter = new Intl.DateTimeFormat('es', { dateStyle: 'full', timeStyle: 'short' });

const pad = (n) => String(n).padStart(2, '0');

/** Date → "AAAA-MM-DD" en hora local (formato de <input type="date">). */
export function toDateInputValue(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayInputValue() {
  return toDateInputValue(new Date());
}

/**
 * "AAAA-MM-DD" → ISO string. Conserva la hora actual para mantener el orden
 * cronológico entre tareas registradas el mismo día.
 */
export function dateInputToIso(value, timeSource = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d, timeSource.getHours(), timeSource.getMinutes(), timeSource.getSeconds());
  // Rechaza fechas desbordadas (p. ej. 2026-02-31)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date.toISOString();
}

export function isValidIso(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/** Etiqueta legible: "Hoy", "Ayer" o "4 nov 2026". */
export function formatRelativeDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Fecha desconocida';
  const today = todayInputValue();
  const value = toDateInputValue(date);
  if (value === today) return 'Hoy';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (value === toDateInputValue(yesterday)) return 'Ayer';
  return dateFormatter.format(date);
}

export function formatFullDate(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : fullFormatter.format(date);
}
