import {Annotation} from '@langchain/langgraph';
import {BaseMessage} from '@langchain/core/messages';
import type {RecommendationResponse} from '@puppy-store/shared';
import type {ExtractedPreferences} from '../../preferences';

/**
 * Agent types
 */
export type AgentType = 'router' | 'adoption' | 'expert';

/**
 * LangGraph state annotation
 */
export const AgentState = Annotation.Root({
  // Message history
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  // Current active agent
  currentAgent: Annotation<AgentType>({
    reducer: (_, y) => y,
    default: () => 'router',
  }),
  // User preferences (for adoption)
  preferences: Annotation<ExtractedPreferences>({
    reducer: (_, y) => y,
    default: () => ({
      livingSpace: null,
      activityLevel: null,
      hasChildren: null,
      childAge: null,
      hasOtherPets: null,
      otherPetTypes: null,
      experienceLevel: null,
      budget: null,
      breedPreference: null,
      breedStrict: null,
      location: null,
      additionalContext: null,
    }),
  }),
  // User ID for persistence
  userId: Annotation<string | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),
  // Recommendations (after adoption completes)
  recommendations: Annotation<RecommendationResponse | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),
  // Response to return to user
  response: Annotation<string>({
    reducer: (_, y) => y,
    default: () => '',
  }),
  // Whether adoption flow is complete
  adoptionComplete: Annotation<boolean>({
    reducer: (_, y) => y,
    default: () => false,
  }),
});

export type AgentStateType = typeof AgentState.State;
