import type {
  Puppy as PrismaPuppy,
  User as PrismaUser,
  Application as PrismaApplication,
  PuppyPhoto as PrismaPuppyPhoto,
} from '@prisma/client';
import {
  PuppyStatus,
  ApplicationStatus,
  VaccinationStatus,
} from '@prisma/client';

export type Puppy = PrismaPuppy;
export type User = PrismaUser;
export type Application = PrismaApplication;
export type PuppyPhoto = PrismaPuppyPhoto;

export {PuppyStatus, ApplicationStatus, VaccinationStatus};

export type PuppySummary = Pick<Puppy, 'id' | 'name' | 'description'>;

export type UserPublic = Pick<User, 'id' | 'name'>;

export interface AuthResponse {
  user: UserPublic & {email: string};
  accessToken: string;
  refreshToken: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PuppyPreferences {
  livingSpace?: 'apartment' | 'house' | 'house_with_yard';
  activityLevel?: 'low' | 'medium' | 'high';
  hasChildren?: boolean;
  hasOtherPets?: boolean;
  experienceLevel?: 'first_time' | 'some_experience' | 'experienced';
  location?: string;
}

export interface RecommendationResponse {
  recommendations: Array<{
    puppy: PuppySummary;
    matchScore: number;
    reasons: string[];
  }>;
  explanation: string;
}

export interface GeneratedDescription {
  description: string;
  generatedAt: Date;
  puppyId: string;
}
