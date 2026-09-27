/**
 * Timezone helpers for converting between local olympiad time and UTC.
 *
 * Round openTime/closeTime are stored as UTC in PostgreSQL but represent
 * a wall-clock moment in the olympiad's timezone. These helpers convert
 * between the two so organisers can enter times in their local zone and
 * the frontend can display them correctly.
 */

/**
 * Converts a local date/time in a given IANA timezone to a UTC Date.
 *
 * @param {string} localIso  ISO-8601 string without timezone info
 *                            (e.g. "2026-10-01T09:00:00")
 * @param {string} tz        IANA timezone name (e.g. "Africa/Johannesburg")
 * @returns {Date}           The equivalent UTC instant
 */
function toUTCDate(localIso, tz) {
  // Parse the input as UTC so we get the raw wall-clock numbers
  // regardless of the host system's timezone.
  const date = new Date(localIso.endsWith('Z') ? localIso : localIso + 'Z');
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date string: ${localIso}`);
  }

  // Format the date in the target timezone to find the offset
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;

  // Build the same wall-clock time as if it were UTC
  const asUTC = Date.UTC(
    Number(get('year')),
    Number(get('month')) - 1,
    Number(get('day')),
    Number(get('hour')) === 24 ? 0 : Number(get('hour')),
    Number(get('minute')),
    Number(get('second'))
  );

  // The offset is how far the timezone is ahead of UTC
  const offsetMs = asUTC - date.getTime();

  // Subtract the offset from the input to get the real UTC time
  return new Date(date.getTime() - offsetMs);
}

/**
 * Formats a UTC Date as a local date/time string in a given timezone.
 *
 * @param {Date|string} utcDate  UTC Date or ISO string
 * @param {string} tz            IANA timezone name
 * @returns {string}             ISO-like string in the target timezone
 */
function formatInTimezone(utcDate, tz) {
  const date = utcDate instanceof Date ? utcDate : new Date(utcDate);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${utcDate}`);
  }

  const formatter = new Intl.DateTimeFormat('en-ZA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return formatter.format(date);
}

module.exports = { toUTCDate, formatInTimezone };
