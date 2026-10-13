import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/theme';
import { useHaptics } from '@/hooks/useHaptics';

export interface PickerOption<T> {
  value: T;
  label: string;
}

interface OptionPickerModalProps<T> {
  visible: boolean;
  options: PickerOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  onClose: () => void;
  closeLabel: string;
}

/**
 * Netflix's full-screen category picker: a dimmed overlay with one big,
 * centered, scrollable list of choices and a round close button at the
 * bottom. Selecting an option applies it and closes the picker.
 */
export function OptionPickerModal<T>({ visible, options, selected, onSelect, onClose, closeLabel }: OptionPickerModalProps<T>) {
  const insets = useSafeAreaInsets();
  const { selection } = useHaptics();

  // Unmount entirely when closed rather than toggling <Modal visible>: on web
  // a closed Modal's portal has been seen lingering over the next screen.
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={[styles.list, { paddingTop: insets.top + spacing.xxl }]} showsVerticalScrollIndicator={false}>
          {options.map((option) => {
            const isSelected = option.value === selected;
            return (
              <Pressable
                key={String(option.value)}
                onPress={() => {
                  selection();
                  onSelect(option.value);
                  onClose();
                }}
                style={styles.option}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={[styles.closeWrap, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Pressable onPress={onClose} style={styles.closeButton} accessibilityRole="button" accessibilityLabel={closeLabel} hitSlop={8}>
            <Ionicons name="close" size={28} color={colors.textInverse} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(8,6,10,0.94)' },
  list: { alignItems: 'center', paddingBottom: spacing.xl, gap: spacing.xs },
  option: { paddingVertical: spacing.sm, paddingHorizontal: spacing.xl },
  optionText: { ...typography.h3, color: colors.textTertiary, textAlign: 'center' },
  optionTextSelected: { ...typography.h2, color: colors.textPrimary },
  closeWrap: { alignItems: 'center', paddingTop: spacing.md },
  closeButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
