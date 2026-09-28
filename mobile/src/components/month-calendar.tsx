import { Pressable, Text, View } from 'react-native';

type MonthCalendarProps = {
  year: number;
  month: number;
  selected: Set<string>;
  onToggle?: (date: string) => void;
  onPressDate?: (date: string) => void;
  textColor: string;
  disabledDates?: Set<string>;
  bookedDates?: Set<string>;
};

const MONTH_NAMES = [
  '1-р сар', '2-р сар', '3-р сар', '4-р сар', '5-р сар', '6-р сар',
  '7-р сар', '8-р сар', '9-р сар', '10-р сар', '11-р сар', '12-р сар',
];

export function MonthCalendar({
  year,
  month,
  selected,
  onToggle,
  onPressDate,
  textColor,
  disabledDates = new Set(),
  bookedDates = new Set(),
}: MonthCalendarProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const pad = firstDay === 0 ? 6 : firstDay - 1;
  const cells: (number | null)[] = [];
  for (let index = 0; index < pad; index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);

  return (
    <View>
      <Text style={{ color: textColor, fontWeight: '700', marginBottom: 8, fontSize: 15 }}>
        {year} · {MONTH_NAMES[month]}
      </Text>
      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня'].map((day) => (
          <Text key={day} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#9CA3AF' }}>
            {day}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((day, index) => {
          if (!day) return <View key={`empty-${index}`} style={{ width: `${100 / 7}%` }} />;
          const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isPast = new Date(year, month, day) < today;
          const isBooked = bookedDates.has(date);
          const isDisabled = isPast || disabledDates.has(date) || isBooked;
          const isSelected = selected.has(date);
          const canPress = Boolean((onToggle && !isDisabled) || (onPressDate && (!isPast || isBooked)));

          return (
            <Pressable
              key={date}
              disabled={!canPress}
              onPress={() => {
                if (isBooked && onPressDate) onPressDate(date);
                else if (onToggle && !isDisabled) onToggle(date);
                else onPressDate?.(date);
              }}
              style={{
                width: `${100 / 7}%`, aspectRatio: 1,
                alignItems: 'center', justifyContent: 'center', padding: 2,
              }}>
              <View style={{
                width: 32, height: 32, borderRadius: 16,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: isBooked ? '#F87171' : isSelected ? '#16A34A' : 'transparent',
              }}>
                <Text style={{
                  fontSize: 13,
                  fontWeight: isSelected || isBooked ? '700' : '400',
                  color: isPast || (isDisabled && !isBooked)
                    ? '#D1D5DB'
                    : isSelected || isBooked ? '#FFFFFF' : textColor,
                }}>
                  {day}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
