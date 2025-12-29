import React, {useEffect, useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert} from 'react-native';
import {useSettings} from '../../contexts/SettingsContext';
import {useAuth} from '../../contexts/AuthContext';
import {colors, spacing, layout, fontSize, fontWeight, cardStyles, optionStyles, buttonStyles} from '../../theme';
import {formatRelativeTime} from '../../utils';
import Icon from 'react-native-vector-icons/Ionicons';
import type {PuppyPreferences} from '../../types';

function OptionButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[optionStyles.button, selected && optionStyles.buttonSelected]}
      onPress={onPress}
    >
      <Text style={[optionStyles.text, selected && optionStyles.textSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function PreferenceRow({icon, label, value}: {icon: string; label: string; value: string}) {
  return (
    <View style={styles.preferenceRow}>
      <Icon name={icon} size={18} color={colors.primary} />
      <Text style={styles.preferenceLabel}>{label}</Text>
      <Text style={styles.preferenceValue}>{value}</Text>
    </View>
  );
}

function formatPreferences(prefs: PuppyPreferences): Array<{icon: string; label: string; value: string}> {
  const items: Array<{icon: string; label: string; value: string}> = [];

  if (prefs.livingSpace) {
    const spaceMap: Record<string, string> = {
      apartment: 'Apartment',
      house: 'House',
      house_with_yard: 'House with yard',
    };
    items.push({icon: 'home-outline', label: 'Living Space', value: spaceMap[prefs.livingSpace] || prefs.livingSpace});
  }

  if (prefs.activityLevel) {
    const levelMap: Record<string, string> = {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
    };
    items.push({icon: 'fitness-outline', label: 'Activity Level', value: levelMap[prefs.activityLevel] || prefs.activityLevel});
  }

  if (prefs.hasChildren !== null && prefs.hasChildren !== undefined) {
    items.push({icon: 'people-outline', label: 'Has Children', value: prefs.hasChildren ? 'Yes' : 'No'});
  }

  if (prefs.hasOtherPets !== null && prefs.hasOtherPets !== undefined) {
    items.push({icon: 'paw-outline', label: 'Has Other Pets', value: prefs.hasOtherPets ? 'Yes' : 'No'});
  }

  if (prefs.experienceLevel) {
    const expMap: Record<string, string> = {
      first_time: 'First-time owner',
      some_experience: 'Some experience',
      experienced: 'Experienced',
    };
    items.push({icon: 'ribbon-outline', label: 'Experience', value: expMap[prefs.experienceLevel] || prefs.experienceLevel});
  }

  if (prefs.budget) {
    const budgetMap: Record<string, string> = {
      low: 'Under $200',
      medium: '$200-500',
      high: 'Over $500',
    };
    items.push({icon: 'wallet-outline', label: 'Budget', value: budgetMap[prefs.budget] || prefs.budget});
  }

  if (prefs.breedPreference?.length) {
    items.push({icon: 'heart-outline', label: 'Breeds', value: prefs.breedPreference.join(', ')});
  }

  return items;
}

export function SettingsScreen() {
  const {settings, setWeightUnit} = useSettings();
  const {user, logout, refreshUser, clearPreferences} = useAuth();
  const [isClearing, setIsClearing] = useState(false);

  // Refresh user data when screen mounts to get latest preferences
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const hasPreferences = user?.savedPreferences && Object.values(user.savedPreferences).some(v => v !== null);
  const preferenceItems = user?.savedPreferences ? formatPreferences(user.savedPreferences) : [];

  const handleClearPreferences = () => {
    Alert.alert(
      'Clear Preferences',
      'Are you sure you want to clear your adoption preferences? You will need to answer the questions again in the chat.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setIsClearing(true);
            try {
              await clearPreferences();
            } catch (error) {
              Alert.alert('Error', 'Failed to clear preferences. Please try again.');
            } finally {
              setIsClearing(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={cardStyles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          {user?.location && (
            <View style={styles.locationRow}>
              <Icon name="location-outline" size={14} color={colors.textMuted} />
              <Text style={styles.userLocation}>{user.location}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={cardStyles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Adoption Preferences</Text>
          {user?.preferencesUpdatedAt && (
            <Text style={styles.updatedAt}>Updated {formatRelativeTime(user.preferencesUpdatedAt)}</Text>
          )}
        </View>
        {hasPreferences && preferenceItems.length > 0 ? (
          <>
            <View style={styles.preferencesContainer}>
              {preferenceItems.map((item, index) => (
                <PreferenceRow key={index} icon={item.icon} label={item.label} value={item.value} />
              ))}
            </View>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearPreferences}
              disabled={isClearing}
            >
              <Icon name="trash-outline" size={16} color={colors.error} />
              <Text style={styles.clearButtonText}>
                {isClearing ? 'Clearing...' : 'Clear Preferences'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.noPreferences}>
            <Icon name="chatbubbles-outline" size={24} color={colors.textMuted} />
            <Text style={styles.noPreferencesText}>
              No preferences saved yet. Chat with the assistant to set your preferences!
            </Text>
          </View>
        )}
      </View>

      <View style={cardStyles.section}>
        <Text style={styles.sectionTitle}>Weight Unit</Text>
        <View style={optionStyles.container}>
          <OptionButton
            label="Pounds (lbs)"
            selected={settings.weightUnit === 'lbs'}
            onPress={() => setWeightUnit('lbs')}
          />
          <OptionButton
            label="Kilograms (kg)"
            selected={settings.weightUnit === 'kg'}
            onPress={() => setWeightUnit('kg')}
          />
        </View>
      </View>

      <TouchableOpacity style={buttonStyles.danger} onPress={logout}>
        <Text style={buttonStyles.dangerText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: layout.screenPadding,
    gap: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  updatedAt: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  userInfo: {
    gap: spacing.xs,
  },
  userName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  userEmail: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  userLocation: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  preferencesContainer: {
    gap: spacing.sm,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  preferenceLabel: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    flex: 1,
  },
  preferenceValue: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  noPreferences: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  noPreferencesText: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  clearButtonText: {
    fontSize: fontSize.body,
    color: colors.error,
  },
});
