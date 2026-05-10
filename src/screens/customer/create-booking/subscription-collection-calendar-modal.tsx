import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Modal,
  TouchableOpacity,
  Pressable,
  StyleSheet,
} from "react-native";
import { AppText } from "@/components";
import { COLORS, VARS } from "@/lib/constants";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type SubscriptionCollectionCalendarModalProps = {
  visible: boolean;
  onClose: () => void;
  minimumDate: Date;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  /** Defaults match subscription first-collection copy */
  title?: string;
  subtitle?: string;
};

function startOfDayLocal(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildMonthGrid(year: number, month: number): (number | null)[][] {
  const dim = new Date(year, month + 1, 0).getDate();
  const startPad = new Date(year, month, 1).getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

const DEFAULT_TITLE = "First collection date";
const DEFAULT_SUBTITLE =
  "Pick a day for your first pickup. Recurring pickups follow this day of the week.";

export function SubscriptionCollectionCalendarModal({
  visible,
  onClose,
  minimumDate,
  selectedDate,
  onSelectDate,
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUBTITLE,
}: SubscriptionCollectionCalendarModalProps) {
  const minDay = useMemo(() => startOfDayLocal(minimumDate), [minimumDate]);

  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  useEffect(() => {
    if (visible) {
      const now = new Date();
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
    }
  }, [visible]);

  const weeks = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const todayStart = startOfDayLocal(new Date());

  const monthTitle = useMemo(
    () =>
      new Date(viewYear, viewMonth, 1).toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      }),
    [viewYear, viewMonth]
  );

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleDayPress = (day: number) => {
    const cell = new Date(viewYear, viewMonth, day, 12, 0, 0, 0);
    const cellStart = startOfDayLocal(cell);
    if (cellStart.getTime() < minDay.getTime()) return;
    onSelectDate(cellStart);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={modalStyles.overlay} onPress={onClose}>
        <Pressable style={modalStyles.sheet} onPress={(e) => e.stopPropagation()}>
          <AppText style={modalStyles.title}>{title}</AppText>
          <AppText style={modalStyles.subtitle}>{subtitle}</AppText>

          <View style={modalStyles.navRow}>
            <TouchableOpacity onPress={goPrevMonth} hitSlop={12}>
              <AppText style={modalStyles.navChevron}>‹</AppText>
            </TouchableOpacity>
            <AppText style={modalStyles.monthTitle}>{monthTitle}</AppText>
            <TouchableOpacity onPress={goNextMonth} hitSlop={12}>
              <AppText style={modalStyles.navChevron}>›</AppText>
            </TouchableOpacity>
          </View>

          <View style={modalStyles.weekHeaderRow}>
            {WEEKDAY_LABELS.map((w) => (
              <View key={w} style={modalStyles.weekHeaderCell}>
                <AppText style={modalStyles.weekHeaderText}>{w}</AppText>
              </View>
            ))}
          </View>

          {weeks.map((row, ri) => (
            <View key={ri} style={modalStyles.weekRow}>
              {row.map((day, di) => {
                if (day === null) {
                  return <View key={`e-${ri}-${di}`} style={modalStyles.dayCell} />;
                }
                const cellDate = new Date(viewYear, viewMonth, day, 12, 0, 0, 0);
                const cellStart = startOfDayLocal(cellDate);
                const disabled = cellStart.getTime() < minDay.getTime();
                const isToday = sameCalendarDay(cellStart, todayStart);
                const isSelected =
                  selectedDate != null &&
                  sameCalendarDay(cellStart, startOfDayLocal(selectedDate));

                return (
                  <TouchableOpacity
                    key={`d-${day}`}
                    style={[
                      modalStyles.dayCell,
                      !disabled && isToday && modalStyles.dayToday,
                      !disabled && isSelected && modalStyles.daySelected,
                      disabled && modalStyles.dayDisabled,
                    ]}
                    onPress={() => !disabled && handleDayPress(day)}
                    disabled={disabled}
                    activeOpacity={disabled ? 1 : 0.7}
                  >
                    <AppText
                      style={[
                        modalStyles.dayText,
                        disabled && modalStyles.dayTextDisabled,
                        !disabled && isSelected && modalStyles.dayTextSelected,
                        !disabled && !isSelected && isToday && modalStyles.dayTextToday,
                      ]}
                    >
                      {day}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          <TouchableOpacity style={modalStyles.cancelBtn} onPress={onClose}>
            <AppText style={modalStyles.cancelBtnText}>Cancel</AppText>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: VARS.medium,
  },
  sheet: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: COLORS.white,
    borderRadius: VARS.small,
    padding: VARS.medium,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: VARS.xxsmall,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: VARS.small,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: VARS.small,
  },
  navChevron: {
    fontSize: 28,
    color: COLORS.primary,
    fontWeight: "600",
    paddingHorizontal: VARS.small,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  weekHeaderRow: {
    flexDirection: "row",
    marginBottom: VARS.xxsmall,
  },
  weekHeaderCell: {
    flex: 1,
    alignItems: "center",
  },
  weekHeaderText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    margin: 2,
    borderRadius: 8,
  },
  dayToday: {
    borderWidth: 1,
    borderColor: COLORS.secondary,
    backgroundColor: "#F1F8E9",
  },
  daySelected: {
    backgroundColor: COLORS.primary,
    borderWidth: 0,
  },
  dayDisabled: {
    opacity: 0.35,
  },
  dayText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  dayTextDisabled: {
    color: COLORS.textSecondary,
    fontWeight: "400",
  },
  dayTextSelected: {
    color: COLORS.white,
  },
  dayTextToday: {
    color: COLORS.primary,
  },
  cancelBtn: {
    marginTop: VARS.medium,
    alignItems: "center",
    paddingVertical: VARS.xsmall,
  },
  cancelBtnText: {
    fontSize: 16,
    color: COLORS.error,
    fontWeight: "600",
  },
});
