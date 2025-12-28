import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useAuth} from '../../contexts/AuthContext';
import {createPuppy, CreatePuppyRequest} from '../../services/puppiesApi';
import {colors, spacing, layout, fontSize, fontWeight} from '../../theme';
import {RootStackParamList} from '../../navigation/RootNavigator';
import {
  PrimaryButton,
  FormInput,
  FormSection,
  SwitchRow,
} from '../../components';

type CreatePuppyScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CreatePuppy'>;
};

type VaccinationStatus = 'UNKNOWN' | 'PARTIAL' | 'COMPLETE';

export function CreatePuppyScreen({navigation}: CreatePuppyScreenProps) {
  const {getAccessToken} = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [weight, setWeight] = useState('');
  const [adoptionFee, setAdoptionFee] = useState('');
  const [location, setLocation] = useState('');
  const [requirements, setRequirements] = useState('');
  const [healthRecords, setHealthRecords] = useState('');
  const [vaccinationStatus, setVaccinationStatus] =
    useState<VaccinationStatus>('UNKNOWN');
  const [energyLevel, setEnergyLevel] = useState<'low' | 'medium' | 'high'>(
    'medium',
  );
  const [goodWithKids, setGoodWithKids] = useState(true);
  const [goodWithPets, setGoodWithPets] = useState(true);
  const [temperament, setTemperament] = useState('');

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim() || !breed.trim() || !location.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const data: CreatePuppyRequest = {
        name: name.trim(),
        description: description.trim(),
        breed: breed.trim(),
        location: location.trim(),
        age: age ? parseInt(age, 10) : undefined,
        gender: gender || undefined,
        weight: weight ? parseFloat(weight) : undefined,
        adoptionFee: adoptionFee ? parseInt(adoptionFee, 10) * 100 : undefined,
        requirements: requirements.trim() || undefined,
        healthRecords: healthRecords.trim() || undefined,
        vaccinationStatus,
        energyLevel,
        goodWithKids,
        goodWithPets,
        temperament: temperament.trim() || undefined,
      };

      await createPuppy(data, token);
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create posting');
    } finally {
      setIsLoading(false);
    }
  };

  const renderOptionButtons = <T extends string>(
    options: {label: string; value: T}[],
    selected: T,
    onSelect: (value: T) => void,
  ) => (
    <View style={styles.optionRow}>
      {options.map(option => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.optionButton,
            selected === option.value && styles.optionButtonSelected,
          ]}
          onPress={() => onSelect(option.value)}>
          <Text
            style={[
              styles.optionButtonText,
              selected === option.value && styles.optionButtonTextSelected,
            ]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <FormSection title="Basic Information">
          <FormInput
            label="Name *"
            placeholder="Puppy's name"
            value={name}
            onChangeText={setName}
            editable={!isLoading}
          />
          <FormInput
            label="Breed *"
            placeholder="e.g., Golden Retriever"
            value={breed}
            onChangeText={setBreed}
            editable={!isLoading}
          />
          <FormInput
            label="Location *"
            placeholder="City, State"
            value={location}
            onChangeText={setLocation}
            editable={!isLoading}
          />

          <View style={styles.row}>
            <View style={styles.flex1}>
              <FormInput
                label="Age (months)"
                placeholder="0"
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                editable={!isLoading}
              />
            </View>
            <View style={styles.flex1}>
              <FormInput
                label="Weight (lbs)"
                placeholder="0"
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                editable={!isLoading}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Gender</Text>
            {renderOptionButtons(
              [
                {label: 'Male', value: 'male'},
                {label: 'Female', value: 'female'},
              ],
              gender,
              setGender,
            )}
          </View>
        </FormSection>

        <FormSection title="Description">
          <FormInput
            label="About this puppy *"
            placeholder="Tell potential adopters about this puppy's personality, background, and what makes them special..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            editable={!isLoading}
          />
          <FormInput
            label="Temperament"
            placeholder="e.g., Friendly, playful, calm"
            value={temperament}
            onChangeText={setTemperament}
            editable={!isLoading}
          />

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Energy Level</Text>
            {renderOptionButtons(
              [
                {label: 'Low', value: 'low'},
                {label: 'Medium', value: 'medium'},
                {label: 'High', value: 'high'},
              ],
              energyLevel,
              setEnergyLevel,
            )}
          </View>

          <SwitchRow
            label="Good with kids"
            value={goodWithKids}
            onValueChange={setGoodWithKids}
          />
          <SwitchRow
            label="Good with other pets"
            value={goodWithPets}
            onValueChange={setGoodWithPets}
          />
        </FormSection>

        <FormSection title="Health & Adoption">
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Vaccination Status</Text>
            {renderOptionButtons(
              [
                {label: 'Unknown', value: 'UNKNOWN'},
                {label: 'Partial', value: 'PARTIAL'},
                {label: 'Complete', value: 'COMPLETE'},
              ],
              vaccinationStatus,
              setVaccinationStatus,
            )}
          </View>

          <FormInput
            label="Health Records"
            placeholder="Any health conditions, vet visits, medications..."
            value={healthRecords}
            onChangeText={setHealthRecords}
            multiline
            numberOfLines={3}
            editable={!isLoading}
          />
          <FormInput
            label="Adoption Fee ($)"
            placeholder="0"
            value={adoptionFee}
            onChangeText={setAdoptionFee}
            keyboardType="number-pad"
            editable={!isLoading}
          />
          <FormInput
            label="Adoption Requirements"
            placeholder="Any specific requirements for adopters (e.g., fenced yard, no young children)..."
            value={requirements}
            onChangeText={setRequirements}
            multiline
            numberOfLines={3}
            editable={!isLoading}
          />
        </FormSection>

        <PrimaryButton
          title="Create Posting"
          onPress={handleSubmit}
          loading={isLoading}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: layout.screenPadding,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  errorContainer: {
    backgroundColor: colors.errorLight,
    padding: spacing.md,
    borderRadius: layout.inputRadius,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.body,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flex1: {
    flex: 1,
  },
  inputGroup: {
    gap: spacing.sm - 2,
  },
  label: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  optionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  optionButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: layout.inputRadius,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  optionButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  optionButtonText: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  optionButtonTextSelected: {
    color: colors.primary,
  },
});
