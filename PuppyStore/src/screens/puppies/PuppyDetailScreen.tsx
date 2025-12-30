import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../navigation/RootNavigator';
import {usePuppy} from '../../hooks/usePuppies';
import {getGeneratedDescription, GeneratedDescription} from '../../services/expertApi';
import {useSettings, WeightUnit} from '../../contexts/SettingsContext';
import {useAuth} from '../../contexts/AuthContext';
import {colors, spacing, layout, fontSize, fontWeight} from '../../theme';
import Icon from 'react-native-vector-icons/Ionicons';
import {getPuppyImageSource} from '../../utils';

type Props = NativeStackScreenProps<RootStackParamList, 'PuppyDetail'>;

function formatAge(months: number): string {
  if (months < 12) {
    return `${months}mo`;
  }
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem === 0 ? `${years}yr` : `${years}yr ${rem}mo`;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

function formatWeight(kg: number, unit: WeightUnit): string {
  if (unit === 'lbs') {
    return `${Math.round(kg * 2.20462)} lbs`;
  }
  return `${kg} kg`;
}

function StatBox({icon, label, value}: {icon: string; label: string; value: string}) {
  return (
    <View style={styles.statBox}>
      <Icon name={icon} size={20} color={colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function CompatibilityRow({label, compatible}: {label: string; compatible: boolean}) {
  return (
    <View style={styles.compatRow}>
      <Text style={styles.compatLabel}>{label}</Text>
      <View style={[styles.compatBadge, compatible ? styles.compatYes : styles.compatNo]}>
        <Text style={[styles.compatText, compatible ? styles.compatTextYes : styles.compatTextNo]}>
          {compatible ? 'Yes' : 'No'}
        </Text>
      </View>
    </View>
  );
}

function EnergyIndicator({level}: {level: string}) {
  const config: Record<string, {bars: number; color: string; label: string}> = {
    low: {bars: 1, color: colors.energyLow, label: 'Low'},
    medium: {bars: 2, color: colors.energyMedium, label: 'Medium'},
    high: {bars: 3, color: colors.energyHigh, label: 'High'},
  };
  const {bars, color, label} = config[level] || config.medium;

  return (
    <View style={styles.energyRow}>
      <Text style={styles.energyLabel}>Energy level</Text>
      <View style={styles.energyRight}>
        <View style={styles.energyBars}>
          {[1, 2, 3].map(i => (
            <View
              key={i}
              style={[
                styles.energyBar,
                {backgroundColor: i <= bars ? color : colors.border},
              ]}
            />
          ))}
        </View>
        <Text style={[styles.energyText, {color}]}>{label}</Text>
      </View>
    </View>
  );
}

export function PuppyDetailScreen({route, navigation}: Props) {
  const {id} = route.params;
  const {settings} = useSettings();
  const {user} = useAuth();
  const {data: puppy, isLoading: loading, error, refetch} = usePuppy(id);
  const [aiDescription, setAiDescription] = useState<GeneratedDescription | null>(null);
  const [aiDescriptionLoading, setAiDescriptionLoading] = useState(false);

  // Load AI description after puppy loads
  useEffect(() => {
    if (puppy?.id) {
      setAiDescriptionLoading(true);
      getGeneratedDescription(puppy.id)
        .then(setAiDescription)
        .catch(() => setAiDescription(null))
        .finally(() => setAiDescriptionLoading(false));
    }
  }, [puppy?.id]);

  const handleApply = () => {
    if (puppy) {
      navigation.navigate('Apply', {puppyId: puppy.id, puppyName: puppy.name});
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !puppy) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.errorIcon}>
          <Icon name="paw" size={28} color={colors.error} />
        </View>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>{error?.message || 'Puppy not found'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()} activeOpacity={0.8}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isAvailable = puppy.status === 'AVAILABLE';
  const isOwnPuppy = puppy.posterId === user?.id;
  const canApply = isAvailable && !isOwnPuppy;

  const imageSource = getPuppyImageSource(puppy.id, puppy.photos?.[0]?.url);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image */}
        <Image source={imageSource} style={styles.heroImage} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{puppy.name}</Text>
            {isAvailable ? (
              <View style={styles.availableBadge}>
                <View style={styles.availableDot} />
                <Text style={styles.availableText}>Available</Text>
              </View>
            ) : (
              <View style={styles.adoptedBadge}>
                <Text style={styles.adoptedText}>Adopted</Text>
              </View>
            )}
          </View>
          <Text style={styles.breed}>{puppy.breed}</Text>
          {puppy.temperament && (
            <Text style={styles.temperament}>{puppy.temperament}</Text>
          )}
          {puppy.location && (
            <View style={styles.locationRow}>
              <Icon name="location-outline" size={14} color={colors.textMuted} />
              <Text style={styles.locationText}>{puppy.location}</Text>
            </View>
          )}
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <StatBox icon="time-outline" label="Age" value={formatAge(puppy.age)} />
          <StatBox icon="barbell-outline" label="Weight" value={formatWeight(puppy.weight, settings.weightUnit)} />
          <StatBox icon={puppy.gender === 'male' ? 'male' : 'female'} label="Sex" value={puppy.gender === 'male' ? 'Male' : 'Female'} />
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.description}>{puppy.description}</Text>
        </View>

        {/* AI-Generated Description */}
        <View style={styles.section}>
          <View style={styles.aiTitleRow}>
            <Text style={styles.aiSectionTitle}>AI Summary</Text>
            <Icon name="sparkles" size={14} color={colors.primary} />
          </View>
          {aiDescriptionLoading ? (
            <View style={styles.aiLoadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.aiLoadingText}>Generating personalized summary...</Text>
            </View>
          ) : aiDescription ? (
            <View style={styles.aiDescriptionCard}>
              <Text style={styles.aiDescriptionText}>{aiDescription.description}</Text>
            </View>
          ) : (
            <View style={styles.aiDescriptionCard}>
              <Text style={styles.aiDescriptionPlaceholder}>AI summary unavailable</Text>
            </View>
          )}
        </View>

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailsCard}>
            <CompatibilityRow label="Good with children" compatible={puppy.goodWithKids} />
            <View style={styles.separator} />
            <CompatibilityRow label="Good with other pets" compatible={puppy.goodWithPets} />
            <View style={styles.separator} />
            <EnergyIndicator level={puppy.energyLevel} />
          </View>
        </View>

        {/* Requirements */}
        {puppy.requirements && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Requirements</Text>
            <View style={styles.requirementsCard}>
              <Text style={styles.requirementsText}>{puppy.requirements}</Text>
            </View>
          </View>
        )}

        {/* Posted by */}
        {puppy.poster && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Posted by</Text>
            <View style={styles.posterCard}>
              <Icon name="person-circle-outline" size={32} color={colors.textMuted} />
              <Text style={styles.posterName}>{puppy.poster.name}</Text>
              {isOwnPuppy && (
                <View style={styles.youBadge}>
                  <Text style={styles.youBadgeText}>You</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Sticky CTA */}
      {isAvailable && (
        <View style={styles.ctaContainer}>
          <View style={styles.priceSection}>
            <Text style={styles.priceLabel}>Adoption fee</Text>
            <Text style={styles.price}>{formatPrice(puppy.adoptionFee)}</Text>
          </View>
          {canApply ? (
            <TouchableOpacity
              style={styles.ctaButton}
              activeOpacity={0.85}
              onPress={handleApply}>
              <Text style={styles.ctaText}>Apply to Adopt</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.ctaButtonDisabled}>
              <Text style={styles.ctaTextDisabled}>
                {isOwnPuppy ? 'Your Posting' : 'Apply'}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  heroImage: {
    width: '100%',
    height: 280,
    marginBottom: spacing.xxl,
  },
  header: {
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.xl,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
    backgroundColor: colors.background,
  },

  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  name: {
    fontSize: fontSize.hero,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  breed: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  temperament: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  locationText: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  availableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 10,
    gap: 5,
  },
  availableDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  availableText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  adoptedBadge: {
    backgroundColor: colors.negativeLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 10,
  },
  adoptedText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl + spacing.xs,
    paddingHorizontal: spacing.xxl,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginTop: spacing.sm,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Sections
  section: {
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xxl,
  },
  sectionTitle: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 23,
  },

  // AI Description
  aiTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  aiSectionTitle: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aiLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: layout.cardRadius,
    padding: spacing.md,
  },
  aiLoadingText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontStyle: 'italic',
  },
  aiDescriptionCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: layout.cardRadius,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  aiDescriptionText: {
    fontSize: fontSize.body,
    color: colors.text,
    lineHeight: 22,
  },
  aiDescriptionPlaceholder: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    fontStyle: 'italic',
  },

  // Details card
  detailsCard: {
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  compatLabel: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  compatBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
  },
  compatYes: {
    backgroundColor: colors.primaryLight,
  },
  compatNo: {
    backgroundColor: colors.negativeLight,
  },
  compatText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  compatTextYes: {
    color: colors.primary,
  },
  compatTextNo: {
    color: colors.textMuted,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  energyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  energyLabel: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  energyRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  energyBars: {
    flexDirection: 'row',
    gap: 3,
  },
  energyBar: {
    width: 16,
    height: 6,
    borderRadius: 3,
  },
  energyText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    width: 50,
  },

  // Requirements
  requirementsCard: {
    backgroundColor: colors.infoLight,
    borderRadius: layout.cardRadius,
    padding: spacing.md,
  },
  requirementsText: {
    fontSize: fontSize.body,
    color: colors.info,
    lineHeight: 20,
  },

  // Poster
  posterCard: {
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  posterName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text,
    flex: 1,
  },
  youBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: layout.badgeRadius,
  },
  youBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },

  // CTA
  bottomSpacer: {
    height: 110,
  },
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  priceSection: {
    marginRight: spacing.lg,
  },
  priceLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  price: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  ctaButton: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 3,
    borderRadius: layout.cardRadius,
  },
  ctaText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  ctaButtonDisabled: {
    flex: 1,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 3,
    borderRadius: layout.cardRadius,
  },
  ctaTextDisabled: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },

  // Error state
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  errorTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  errorText: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 10,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
});
