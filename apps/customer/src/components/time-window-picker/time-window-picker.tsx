import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components';
import { COLORS } from '@/lib/constants';
import { TIME_WINDOWS, type TimeWindowId } from '@/lib/time-windows';
import { styles } from './time-window-picker.styles';

type TimeWindowPickerProps = {
  selectedWindowId: TimeWindowId | null;
  onSelect: (windowId: TimeWindowId) => void;
};

export function TimeWindowPicker({
  selectedWindowId,
  onSelect,
}: TimeWindowPickerProps) {
  return (
    <View style={styles.list}>
      {TIME_WINDOWS.map((window) => {
        const isSelected = window.id === selectedWindowId;
        return (
          <Pressable
            key={window.id}
            style={[styles.card, isSelected && styles.cardSelected]}
            onPress={() => onSelect(window.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${window.title}, ${window.timeRange}`}
          >
            <View
              style={[
                styles.iconWrap,
                isSelected && styles.iconWrapSelected,
              ]}
            >
              <Ionicons
                name={window.icon}
                size={22}
                color={isSelected ? COLORS.primary : COLORS.textSecondary}
              />
            </View>

            <View style={styles.textBlock}>
              <AppText
                style={[styles.title, isSelected && styles.titleSelected]}
              >
                {window.title}
              </AppText>
              <AppText
                style={[
                  styles.timeRange,
                  isSelected && styles.timeRangeSelected,
                ]}
              >
                {window.timeRange}
              </AppText>
            </View>

            <View
              style={[
                styles.radioOuter,
                isSelected && styles.radioOuterSelected,
              ]}
            >
              {isSelected ? <View style={styles.radioInner} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
