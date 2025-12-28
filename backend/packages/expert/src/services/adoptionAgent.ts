import {z} from 'zod';
import {StructuredTool} from '@langchain/core/tools';
import {HumanMessage, SystemMessage, AIMessage} from '@langchain/core/messages';
import {createLLM} from '../llm';
import {prisma, loggers} from '@puppy-store/shared';

/**
 * Schema for extracted preferences from user input
 */
export const PreferencesSchema = z.object({
  livingSpace: z.enum(['apartment', 'house', 'house_with_yard']).nullable(),
  activityLevel: z.enum(['low', 'medium', 'high']).nullable(),
  hasChildren: z.boolean().nullable(),
  childAge: z.number().nullable(),
  hasOtherPets: z.boolean().nullable(),
  otherPetTypes: z.array(z.string()).nullable(),
  experienceLevel: z.enum(['first_time', 'some_experience', 'experienced']).nullable(),
  budget: z.enum(['low', 'medium', 'high']).nullable(),
  breedPreference: z.array(z.string()).nullable(),
  breedStrict: z.boolean().nullable(), // true = only show this breed, false = prefer but show others too
  location: z.string().nullable(),
  additionalContext: z.string().nullable(),
});

export type ExtractedPreferences = z.infer<typeof PreferencesSchema>;

/**
 * User profile with saved preferences
 */
export interface UserWithPreferences {
  id: string;
  location: string | null;
  savedPreferences: ExtractedPreferences | null;
  preferencesUpdatedAt: Date | null;
}

/**
 * Required fields that must be filled before we can make recommendations
 */
const REQUIRED_FIELDS: (keyof ExtractedPreferences)[] = [
  'livingSpace',
  'activityLevel',
  'hasChildren',
  'hasOtherPets',
  'experienceLevel',
];

/**
 * Check if all required preferences have been collected
 */
export function hasAllRequiredPreferences(prefs: ExtractedPreferences): boolean {
  return REQUIRED_FIELDS.every(field => prefs[field] !== null);
}

/**
 * Get list of missing required fields
 */
export function getMissingFields(prefs: ExtractedPreferences): (keyof ExtractedPreferences)[] {
  return REQUIRED_FIELDS.filter(field => prefs[field] === null);
}

/**
 * Create empty preferences with only location from user profile
 */
export function createEmptyPreferences(location: string | null): ExtractedPreferences {
  return {
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
    location: location ?? null,
    additionalContext: null,
  };
}

/**
 * Create initial preferences from user profile
 * If user has saved preferences, returns those (for confirmation flow)
 * Otherwise returns empty preferences with location pre-filled
 */
export function createInitialPreferences(user: UserWithPreferences | null): ExtractedPreferences {
  if (user?.savedPreferences) {
    return user.savedPreferences;
  }
  return createEmptyPreferences(user?.location ?? null);
}

/**
 * Check if user has saved preferences from a previous session
 */
export function hasSavedPreferences(user: UserWithPreferences | null): boolean {
  return user?.savedPreferences !== null && user?.preferencesUpdatedAt !== null;
}

/**
 * Save user preferences to database
 */
export async function saveUserPreferences(
  userId: string,
  preferences: ExtractedPreferences
): Promise<void> {
  await prisma.user.update({
    where: {id: userId},
    data: {
      savedPreferences: preferences as object,
      preferencesUpdatedAt: new Date(),
      ...(preferences.location ? {location: preferences.location} : {}),
    },
  });
}

/**
 * Format saved preferences into a human-readable summary
 */
export function formatPreferencesSummary(prefs: ExtractedPreferences): string {
  const parts: string[] = [];

  if (prefs.livingSpace) {
    const spaceMap: Record<string, string> = {
      apartment: 'apartment',
      house: 'house',
      house_with_yard: 'house with yard',
    };
    parts.push(`Living in a ${spaceMap[prefs.livingSpace]}`);
  }

  if (prefs.activityLevel) {
    parts.push(`${prefs.activityLevel} activity lifestyle`);
  }

  if (prefs.hasChildren === true) {
    parts.push(prefs.childAge ? `${prefs.childAge}-year-old child` : 'has children');
  } else if (prefs.hasChildren === false) {
    parts.push('no children');
  }

  if (prefs.hasOtherPets === true) {
    parts.push(prefs.otherPetTypes?.length ? `has ${prefs.otherPetTypes.join(', ')}` : 'has other pets');
  } else if (prefs.hasOtherPets === false) {
    parts.push('no other pets');
  }

  if (prefs.experienceLevel) {
    const expMap: Record<string, string> = {
      first_time: 'first-time dog owner',
      some_experience: 'some dog experience',
      experienced: 'experienced dog owner',
    };
    parts.push(expMap[prefs.experienceLevel]);
  }

  if (prefs.budget) {
    const budgetMap: Record<string, string> = {
      low: 'budget under $200',
      medium: 'budget $200-500',
      high: 'budget over $500',
    };
    parts.push(budgetMap[prefs.budget]);
  }

  if (prefs.breedPreference?.length) {
    parts.push(`interested in ${prefs.breedPreference.join(', ')}`);
  }

  if (prefs.location) {
    parts.push(`in ${prefs.location}`);
  }

  return parts.join(', ');
}

/**
 * Generate the welcome message for returning users
 */
export function generateReturningUserMessage(
  prefs: ExtractedPreferences,
  updatedAt: Date
): string {
  const summary = formatPreferencesSummary(prefs);
  const timeAgo = getTimeAgo(updatedAt);

  return `Welcome back! Last time (${timeAgo}) you were looking for a puppy with these preferences:\n\n` +
    `${summary}\n\n` +
    `Should I search with these same preferences, or would you like to update anything?`;
}

/**
 * Get human-readable time ago string
 */
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)} weeks ago`;
  return `${Math.floor(seconds / 2592000)} months ago`;
}

/**
 * Schema for the updateUserPreferences tool input
 */
interface UpdatePreferencesInput {
  livingSpace?: 'apartment' | 'house' | 'house_with_yard';
  activityLevel?: 'low' | 'medium' | 'high';
  hasChildren?: boolean;
  childAge?: number;
  hasOtherPets?: boolean;
  otherPetTypes?: string[];
  experienceLevel?: 'first_time' | 'some_experience' | 'experienced';
  budget?: 'low' | 'medium' | 'high';
  breedPreference?: string[];
  location?: string;
  additionalContext?: string;
}

// Define schema outside class to avoid TypeScript depth issues
const updatePreferencesToolSchema = z.object({
  livingSpace: z.enum(['apartment', 'house', 'house_with_yard']).optional()
    .describe('Type of home: apartment, house, or house_with_yard'),
  activityLevel: z.enum(['low', 'medium', 'high']).optional()
    .describe('Activity level: low, medium, or high. Infer from lifestyle'),
  hasChildren: z.boolean().optional()
    .describe('Whether user has children. Set to false if they say "no kids"'),
  childAge: z.number().optional()
    .describe('Age of children in years, if mentioned'),
  hasOtherPets: z.boolean().optional()
    .describe('Whether user has other pets. Set to false if they say "no pets"'),
  otherPetTypes: z.array(z.string()).optional()
    .describe('Types of other pets (e.g., ["cat", "fish"])'),
  experienceLevel: z.enum(['first_time', 'some_experience', 'experienced']).optional()
    .describe('Dog ownership experience level'),
  budget: z.enum(['low', 'medium', 'high']).optional()
    .describe('Budget for adoption fee: low (under $200), medium ($200-500), high (over $500)'),
  breedPreference: z.array(z.string()).optional()
    .describe('Preferred breeds mentioned by user (e.g., ["golden retriever", "labrador"])'),
  location: z.string().optional()
    .describe('City or area where user lives'),
  additionalContext: z.string().optional()
    .describe('Any special needs, concerns, or context'),
});

/**
 * Tool class for updating user preferences during conversation
 */
// @ts-ignore - LangChain StructuredTool has complex type inference issues with zod
class UpdatePreferencesTool extends StructuredTool {
  name = 'updateUserPreferences';
  description = `Update user preferences based on information EXPLICITLY stated by the user.
Call this tool whenever the user mentions preference information.

CRITICAL RULES:
- ONLY include fields the user EXPLICITLY mentioned or that can be CLEARLY inferred
- NEVER guess or make up values. If they didn't mention experience level, DO NOT include it
- NEVER use placeholder values like "unknown", "none", "n/a", or empty strings
- For booleans: only set if user explicitly stated yes/no (e.g., "no kids" -> hasChildren: false)
- If unsure about a field, OMIT IT from the tool call entirely`;

  schema = updatePreferencesToolSchema;

  private userId: string | null;
  private currentPreferences: ExtractedPreferences;
  private onUpdate: (prefs: ExtractedPreferences) => void;

  constructor(
    userId: string | null,
    currentPreferences: ExtractedPreferences,
    onUpdate: (prefs: ExtractedPreferences) => void
  ) {
    super();
    this.userId = userId;
    this.currentPreferences = currentPreferences;
    this.onUpdate = onUpdate;
  }

  async _call(input: UpdatePreferencesInput): Promise<string> {
    loggers.adoption.debug({input}, 'UpdatePreferences tool called (raw)');

    // Filter out placeholder/invalid values that the LLM might hallucinate
    const invalidStrings = ['unknown', 'none', 'n/a', 'not specified', 'not mentioned', ''];
    const isValidString = (val: string | undefined): val is string =>
      val !== undefined && !invalidStrings.includes(val.toLowerCase().trim());

    // Clean the input - reject placeholder values
    const cleanInput: UpdatePreferencesInput = {
      livingSpace: input.livingSpace, // enum, can't have invalid strings
      activityLevel: input.activityLevel, // enum, can't have invalid strings
      hasChildren: input.hasChildren,
      childAge: input.childAge,
      hasOtherPets: input.hasOtherPets,
      otherPetTypes: input.otherPetTypes?.filter(t => isValidString(t)),
      experienceLevel: input.experienceLevel, // enum, can't have invalid strings
      budget: input.budget, // enum, can't have invalid strings
      breedPreference: input.breedPreference?.filter(t => isValidString(t)),
      location: isValidString(input.location) ? input.location : undefined,
      additionalContext: isValidString(input.additionalContext) ? input.additionalContext : undefined,
    };

    loggers.adoption.debug({cleanInput}, 'UpdatePreferences tool called (cleaned)');

    // Merge with current preferences (input fields take precedence if defined)
    const merged: ExtractedPreferences = {
      livingSpace: cleanInput.livingSpace ?? this.currentPreferences.livingSpace,
      activityLevel: cleanInput.activityLevel ?? this.currentPreferences.activityLevel,
      hasChildren: cleanInput.hasChildren !== undefined ? cleanInput.hasChildren : this.currentPreferences.hasChildren,
      childAge: cleanInput.childAge ?? this.currentPreferences.childAge,
      hasOtherPets: cleanInput.hasOtherPets !== undefined ? cleanInput.hasOtherPets : this.currentPreferences.hasOtherPets,
      otherPetTypes: cleanInput.otherPetTypes ?? this.currentPreferences.otherPetTypes,
      experienceLevel: cleanInput.experienceLevel ?? this.currentPreferences.experienceLevel,
      budget: cleanInput.budget ?? this.currentPreferences.budget,
      breedPreference: cleanInput.breedPreference ?? this.currentPreferences.breedPreference,
      breedStrict: this.currentPreferences.breedStrict, // Only set via special flow, not from tool
      location: cleanInput.location ?? this.currentPreferences.location,
      additionalContext: cleanInput.additionalContext ?? this.currentPreferences.additionalContext,
    };

    // Save to database if we have a user ID
    if (this.userId) {
      try {
        await saveUserPreferences(this.userId, merged);
        loggers.adoption.debug({userId: this.userId}, 'Preferences saved to database');
      } catch (err) {
        loggers.adoption.error({err, userId: this.userId}, 'Failed to save preferences');
      }
    }

    // Update local state
    this.onUpdate(merged);

    const missing = getMissingFields(merged);
    if (missing.length === 0) {
      return 'All required preferences collected. Ready to generate recommendations.';
    }
    return `Preferences updated. Still need: ${missing.join(', ')}`;
  }
}

const SYSTEM_PROMPT = `You are a friendly puppy adoption assistant helping users find their perfect match.

Your job is to have a natural conversation to collect the following information:

REQUIRED (must collect all 5):
1. Living situation (apartment, house, or house with yard)
2. Activity level / lifestyle (low, medium, or high)
3. Whether they have children (yes or no)
4. Whether they have other pets (yes or no)
5. Dog ownership experience level - you MUST explicitly ask: "Have you owned a dog before?"

OPTIONAL (ask once after required info, but don't push if they skip):
6. Budget for adoption fee (low/medium/high) - ask: "Do you have a budget in mind for the adoption fee?"
7. Breed preferences - ask: "Are there any specific breeds you're interested in, or are you open to suggestions?"

CRITICAL RULES:
- You MUST collect ALL 5 required pieces of information before asking optional questions
- After collecting required info, ask the optional questions naturally
- If user skips optional questions or says "no preference", that's fine - proceed to recommendations
- When the user shares preference info, call updateUserPreferences with ONLY the fields they mentioned
- NEVER guess or infer experienceLevel - you MUST ask them directly
- For "no kids", "no pets", "don't have children" - explicitly set boolean to FALSE
- Activity level CAN be inferred from lifestyle (busy nurse = low, marathon runner = high)
- Ask about 1-2 missing things at a time, naturally
- Keep asking until ALL required fields are filled
- Do NOT rush to recommendations - be thorough and patient

CLARIFICATION:
- If the user's answer is vague, unclear, or doesn't directly answer your question, ASK FOR CLARIFICATION
- Examples of when to clarify:
  - "I'm pretty active" -> Ask: "Would you say you do light exercise like walks, moderate activity, or intense workouts like running?"
  - "I have a place" -> Ask: "Is that an apartment, a house, or a house with a yard?"
  - "Maybe" or "sometimes" for yes/no questions -> Ask for a definitive answer
  - Off-topic responses -> Gently redirect: "That's interesting! But to help find the right puppy, could you tell me about..."
- Do NOT call updateUserPreferences if you're unsure what the user meant

Current preferences collected:
{currentPreferences}

STILL MISSING (you must ask about these before we can proceed):
{missingFields}`;

export interface AdoptionResult {
  preferences: ExtractedPreferences;
  isComplete: boolean;
  followUpQuestion: string | null;
}

/**
 * Process a user message through the adoption agent with tool calling
 */
export async function processAdoptionMessage(
  userMessage: string,
  currentPreferences: ExtractedPreferences,
  userId: string | null = null,
  conversationHistory: Array<{role: 'user' | 'assistant'; content: string}> = []
): Promise<AdoptionResult> {
  let updatedPreferences = {...currentPreferences};

  const prefsTool = new UpdatePreferencesTool(userId, currentPreferences, (prefs) => {
    updatedPreferences = prefs;
  });

  const llm = createLLM({temperature: 0.7});
  const llmWithTools = llm.bindTools([prefsTool]);

  const missingFields = getMissingFields(currentPreferences);
  const systemPrompt = SYSTEM_PROMPT
    .replace('{currentPreferences}', JSON.stringify(currentPreferences, null, 2))
    .replace('{missingFields}', missingFields.length > 0 ? missingFields.join(', ') : 'None - all collected!');

  // Build message history
  const messages: (SystemMessage | HumanMessage | AIMessage)[] = [
    new SystemMessage(systemPrompt),
  ];

  for (const msg of conversationHistory) {
    if (msg.role === 'user') {
      messages.push(new HumanMessage(msg.content));
    } else {
      messages.push(new AIMessage(msg.content));
    }
  }
  messages.push(new HumanMessage(userMessage));

  // First call - may include tool calls
  const response = await llmWithTools.invoke(messages);

  // Handle tool calls
  if (response.tool_calls && response.tool_calls.length > 0) {
    for (const toolCall of response.tool_calls) {
      if (toolCall.name === 'updateUserPreferences') {
        await prefsTool.invoke(toolCall.args);
      }
    }

    // Get follow-up response after tool execution
    const updatedMissing = getMissingFields(updatedPreferences);
    const isComplete = updatedMissing.length === 0;

    if (isComplete) {
      return {
        preferences: updatedPreferences,
        isComplete: true,
        followUpQuestion: null,
      };
    }

    // Ask LLM for a follow-up question
    const followUpSystemPrompt = SYSTEM_PROMPT
      .replace('{currentPreferences}', JSON.stringify(updatedPreferences, null, 2))
      .replace('{missingFields}', updatedMissing.join(', '));

    const followUpMessages = [
      new SystemMessage(followUpSystemPrompt),
      ...messages.slice(1), // Skip old system message
      new AIMessage('I\'ve noted that information.'),
      new HumanMessage('What else do you need to know?'),
    ];

    const followUpResponse = await llm.invoke(followUpMessages);
    const followUpContent = typeof followUpResponse.content === 'string'
      ? followUpResponse.content
      : 'Could you tell me more about your living situation?';

    return {
      preferences: updatedPreferences,
      isComplete: false,
      followUpQuestion: followUpContent,
    };
  }

  // No tool calls - just a conversational response
  // Never mark as complete without tool calls - we need explicit preference extraction
  const responseContent = typeof response.content === 'string'
    ? response.content
    : 'Could you tell me about your living situation and lifestyle?';

  return {
    preferences: updatedPreferences,
    isComplete: false,  // Only complete after tool calls confirm all fields
    followUpQuestion: responseContent,
  };
}
