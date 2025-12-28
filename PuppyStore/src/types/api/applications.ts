import {Application} from '../models/Application';
import {PaginatedResponse} from './common';

export interface CreateApplicationRequest {
  puppyId: string;
  contactPhone: string;
  contactEmail: string;
  livingSituation: string;
  hasYard: boolean;
  hasFence: boolean;
  petExperience: string;
  otherPets?: string;
  message?: string;
}

export type ApplicationsResponse = PaginatedResponse<Application>;
