import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { TextInput, Text } from 'react-native-paper';

interface AutocompleteInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  suggestions: string[];
}

/**
 * Text input with autocomplete dropdown.
 * Shows filtered suggestions as the user types.
 * Tapping a suggestion fills the input.
 */
export default function AutocompleteInput({
  label,
  value,
  onChangeText,
  suggestions,
}: AutocompleteInputProps) {
  const [focused, setFocused] = useState(false);

  const filtered = useMemo(() => {
    if (!value.trim() || !focused) return [];
    const query = value.toLowerCase();
    return suggestions
      .filter((s) => s.toLowerCase().includes(query) && s.toLowerCase() !== query)
      .slice(0, 5);
  }, [value, suggestions, focused]);

  const handleSelect = useCallback(
    (item: string) => {
      onChangeText(item);
      setFocused(false);
    },
    [onChangeText]
  );

  return (
    <View style={styles.container}>
      <TextInput
        label={label}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          // Delay to allow tap on suggestion to register
          setTimeout(() => setFocused(false), 150);
        }}
        mode="outlined"
        style={styles.input}
      />
      {filtered.length > 0 && (
        <View style={styles.dropdown}>
          {filtered.map((item) => (
            <Pressable
              key={item}
              onPress={() => handleSelect(item)}
              style={styles.suggestion}
              accessibilityRole="button"
              accessibilityLabel={`Select ${item}`}
            >
              <Text variant="bodyMedium" numberOfLines={1}>
                {item}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    zIndex: 1,
  },
  input: {
    backgroundColor: '#ffffff',
  },
  dropdown: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  suggestion: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
});
