import { useCallback, useMemo } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface RatingInputProps {
  value: number | null;
  onChange: (value: number) => void;
  minRanking: number;
  maxRanking: number;
  increments: number;
  rankIcon: string;
}

/**
 * Configurable rating input that adapts to the group's ranking settings.
 * - For star icon with small range (≤10 steps): shows tappable star icons
 * - For other icons or large ranges: shows a step-based slider
 */
export default function RatingInput({
  value,
  onChange,
  minRanking,
  maxRanking,
  increments,
  rankIcon,
}: RatingInputProps) {
  const steps = useMemo(() => {
    const result: number[] = [];
    for (let i = minRanking; i <= maxRanking; i += increments) {
      result.push(Math.round(i * 100) / 100); // avoid floating point drift
    }
    return result;
  }, [minRanking, maxRanking, increments]);

  const useStarMode = rankIcon === 'star' && maxRanking <= 10;

  if (useStarMode) {
    return (
      <StarRating
        steps={steps}
        value={value}
        onChange={onChange}
        maxRanking={maxRanking}
      />
    );
  }

  return (
    <SliderRating
      steps={steps}
      value={value}
      onChange={onChange}
      minRanking={minRanking}
      maxRanking={maxRanking}
      rankIcon={rankIcon}
    />
  );
}

// ─── Star Rating ─────────────────────────────────────────────────────────────

interface StarRatingProps {
  steps: number[];
  value: number | null;
  onChange: (value: number) => void;
  maxRanking: number;
}

function StarRating({ steps, value, onChange, maxRanking }: StarRatingProps) {
  // Render one star per whole number from 1 to maxRanking.
  // Each star supports tap (whole value) and half-fill display.
  // If increments allow half-stars (e.g., 0.5), tapping the left half gives X.5.
  const wholeStars = Array.from({ length: Math.round(maxRanking) }, (_, i) => i + 1);
  const hasHalfSteps = steps.some((s) => s % 1 !== 0);

  return (
    <View style={styles.starContainer}>
      <View style={styles.starsRow}>
        {wholeStars.map((starNum) => {
          const isFilled = value !== null && starNum <= value;
          const isHalf = value !== null && !isFilled && starNum - 0.5 <= value && starNum > value;

          return (
            <Pressable
              key={starNum}
              onPress={() => {
                // If half-steps are supported and this star is already fully filled,
                // tapping it again sets to half (toggling between full and half).
                if (hasHalfSteps && value === starNum) {
                  onChange(starNum - 0.5);
                } else {
                  onChange(starNum);
                }
              }}
              onLongPress={
                hasHalfSteps
                  ? () => onChange(starNum - 0.5)
                  : undefined
              }
              accessibilityLabel={`Rate ${starNum} of ${maxRanking}`}
              accessibilityRole="button"
              style={styles.starButton}
            >
              <MaterialCommunityIcons
                name={isFilled ? 'star' : isHalf ? 'star-half-full' : 'star-outline'}
                size={36}
                color={isFilled || isHalf ? '#FFB300' : '#90caf9'}
              />
            </Pressable>
          );
        })}
      </View>
      <Text variant="bodyMedium" style={styles.valueLabel}>
        {value !== null ? `${value} / ${maxRanking}` : 'Tap to rate'}
      </Text>
    </View>
  );
}

// ─── Slider Rating ───────────────────────────────────────────────────────────

interface SliderRatingProps {
  steps: number[];
  value: number | null;
  onChange: (value: number) => void;
  minRanking: number;
  maxRanking: number;
  rankIcon: string;
}

function SliderRating({ steps, value, onChange, minRanking, maxRanking, rankIcon }: SliderRatingProps) {
  const selectedIndex = value !== null ? steps.indexOf(value) : -1;
  const fillPercent = selectedIndex >= 0 ? (selectedIndex / (steps.length - 1)) * 100 : 0;

  const handleStepPress = useCallback(
    (step: number) => {
      onChange(step);
    },
    [onChange]
  );

  // Map common rank icons to MaterialCommunityIcons names
  const iconName = getIconName(rankIcon);

  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderHeader}>
        <MaterialCommunityIcons name={iconName} size={24} color="#1976d2" />
        <Text variant="titleMedium" style={styles.sliderValue}>
          {value !== null ? value : '—'}
        </Text>
        <Text variant="bodySmall" style={styles.sliderRange}>
          {minRanking} – {maxRanking}
        </Text>
      </View>

      {/* Track */}
      <View style={styles.track}>
        <View style={[styles.trackFill, { width: `${fillPercent}%` }]} />
      </View>

      {/* Step buttons */}
      <View style={styles.stepsRow}>
        {steps.map((step, index) => (
          <Pressable
            key={step}
            onPress={() => handleStepPress(step)}
            style={[styles.stepDot, selectedIndex === index && styles.stepDotActive]}
            accessibilityLabel={`Rate ${step}`}
            accessibilityRole="button"
          />
        ))}
      </View>

      {/* Labels */}
      <View style={styles.labelsRow}>
        <Text variant="bodySmall" style={styles.labelText}>{minRanking}</Text>
        <Text variant="bodySmall" style={styles.labelText}>{maxRanking}</Text>
      </View>
    </View>
  );
}

function getIconName(rankIcon: string): React.ComponentProps<typeof MaterialCommunityIcons>['name'] {
  const iconMap: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
    star: 'star',
    beer: 'glass-mug-variant',
    wine: 'glass-wine',
    coffee: 'coffee',
    food: 'food',
    heart: 'heart',
    thumb: 'thumb-up',
    fire: 'fire',
    trophy: 'trophy',
  };
  return iconMap[rankIcon] || 'star';
}

const styles = StyleSheet.create({
  // Star Rating styles
  starContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  starButton: {
    padding: 4,
  },
  valueLabel: {
    marginTop: 8,
    color: '#1a1c1e',
  },

  // Slider Rating styles
  sliderContainer: {
    paddingVertical: 8,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sliderValue: {
    fontWeight: '700',
    color: '#1976d2',
    flex: 1,
  },
  sliderRange: {
    color: '#546e7a',
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#bbdefb',
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    backgroundColor: '#1976d2',
    borderRadius: 3,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#bbdefb',
    borderWidth: 2,
    borderColor: '#90caf9',
  },
  stepDotActive: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  labelText: {
    color: '#546e7a',
  },
});
