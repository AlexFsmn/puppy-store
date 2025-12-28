export interface PuppyPreferences {
  livingSpace?: 'apartment' | 'house' | 'house_with_yard' | null;
  activityLevel?: 'low' | 'medium' | 'high' | null;
  hasChildren?: boolean | null;
  hasOtherPets?: boolean | null;
  experienceLevel?: 'first_time' | 'some_experience' | 'experienced' | null;
  budget?: 'low' | 'medium' | 'high' | null;
  breedPreference?: string[] | null;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  location?: string | null;
  savedPreferences?: PuppyPreferences | null;
  preferencesUpdatedAt?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
