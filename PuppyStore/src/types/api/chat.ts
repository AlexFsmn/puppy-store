import {AgentType} from '../enums';
import {PuppyPreferences} from '../models/Auth';

export interface RecommendationMatch {
  puppy: {
    id: string;
    name: string;
    description: string;
  };
  matchScore: number;
  reasons: string[];
}

export interface RecommendationResponse {
  recommendations: RecommendationMatch[];
  explanation: string;
}

export interface ChatSessionResponse {
  sessionId: string;
  message: string;
  isComplete?: false;
  isReturningUser?: boolean;
  savedPreferences?: PuppyPreferences;
}

export interface ChatMessageResponse {
  message?: string;
  activeAgent?: AgentType;
  recommendations?: RecommendationResponse;
  hasRecommendations?: boolean;
  isComplete?: boolean;
  preferences?: PuppyPreferences;
}

export interface ChatSessionState {
  sessionId: string;
  activeAgent: AgentType | null;
  hasRecommendations: boolean;
  recommendations?: RecommendationResponse;
  conversationHistory: Array<{role: 'user' | 'assistant'; content: string}>;
}

export interface ExpertResponse {
  answer: string;
  sources?: string[];
}

export interface GeneratedDescription {
  description: string;
  generatedAt: string;
  puppyId: string;
}

export interface ThumbsFeedbackResponse {
  success: boolean;
  feedbackId?: string;
}

export interface TrackingResponse {
  success: boolean;
}
