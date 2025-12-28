import {VaccinationStatus} from '../enums';
import {MyPuppy, PuppySummary} from '../models/Puppy';
import {PaginatedResponse} from './common';

export interface CreatePuppyRequest {
  name: string;
  description: string;
  breed: string;
  age?: number;
  gender?: string;
  weight?: number;
  adoptionFee?: number;
  requirements?: string;
  location: string;
  healthRecords?: string;
  vaccinationStatus?: VaccinationStatus;
  energyLevel?: string;
  goodWithKids?: boolean;
  goodWithPets?: boolean;
  temperament?: string;
  photos?: string[];
}

export type PuppiesResponse = PaginatedResponse<PuppySummary>;
export type MyPuppiesResponse = PaginatedResponse<MyPuppy>;
