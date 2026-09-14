const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isDateString(value: string) {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function todayYmd() {
  return toYmd(new Date());
}

export function toYmd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

export function addDaysYmd(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return toYmd(date);
}

export function compareYmd(left: string, right: string) {
  return left.localeCompare(right);
}

export function datesBetweenNights(checkIn: string, checkOut: string) {
  const dates: string[] = [];
  let current = checkIn;

  while (compareYmd(current, checkOut) < 0) {
    dates.push(current);
    current = addDaysYmd(current, 1);
  }

  return dates;
}

export function normalizeCheckout(checkIn: string, checkOut: string) {
  return checkIn === checkOut ? addDaysYmd(checkOut, 1) : checkOut;
}
