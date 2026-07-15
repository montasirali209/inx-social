const { DateTime } = require('luxon');

function generateSlots({
  timesOfDay,
  timezone = 'Europe/London',
  count,
  usedSlotKeys = new Set(),
  minLeadMinutes = 20,
  maxScheduleDays = null,
}) {
  const slots = [];
  const now = DateTime.now().setZone(timezone);
  const minTime = now.plus({ minutes: Number(minLeadMinutes || 20) });
  const sortedTimes = [...timesOfDay].map(normaliseTime).filter(Boolean).sort();
  if (!sortedTimes.length) throw new Error('No valid SCHEDULE_TIMES configured.');

  let cursor = now.startOf('day');
  const deadline = maxScheduleDays ? now.plus({ days: Number(maxScheduleDays) }).endOf('day') : null;

  while (slots.length < count) {
    if (deadline && cursor > deadline) break;

    for (const slotText of sortedTimes) {
      const [hour, minute] = slotText.split(':').map(Number);
      const slot = cursor.set({ hour, minute, second: 0, millisecond: 0 });
      const key = slot.toFormat('yyyy-LL-dd HH:mm');
      if (slot <= minTime || usedSlotKeys.has(key)) continue;
      slots.push(slot);
      usedSlotKeys.add(key);
      if (slots.length >= count) break;
    }

    cursor = cursor.plus({ days: 1 });
  }

  return slots;
}

function normaliseTime(value) {
  if (!value) return null;
  const raw = String(value).trim().toUpperCase();
  const twelve = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (twelve) {
    let hour = Number(twelve[1]);
    const minute = Number(twelve[2] || '0');
    if (hour === 12) hour = 0;
    if (twelve[3] === 'PM') hour += 12;
    if (hour > 23 || minute > 59) return null;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }
  const twentyFour = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!twentyFour) return null;
  const hour = Number(twentyFour[1]);
  const minute = Number(twentyFour[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

module.exports = { generateSlots, normaliseTime };
