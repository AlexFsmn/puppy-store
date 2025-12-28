/**
 * Safety and content moderation for puppy expert prompts
 */

// Topics the expert should NOT answer
const BLOCKED_TOPICS = [
  'harm',
  'abuse',
  'fighting',
  'illegal',
  'breed ban',
  'kill',
  'poison',
  'attack',
  'dangerous',
];

// Keep responses focused on these domains
const ALLOWED_DOMAINS = [
  'dog breeds',
  'puppy care',
  'training',
  'nutrition',
  'health',
  'behavior',
  'grooming',
  'exercise',
  'adoption',
  'compatibility',
];

/**
 * Check if a question contains potentially harmful content
 */
export function containsBlockedContent(text: string): boolean {
  const lowerText = text.toLowerCase();
  return BLOCKED_TOPICS.some(topic => lowerText.includes(topic));
}

/**
 * System prompt additions for safety
 */
export const SAFETY_INSTRUCTIONS = `
IMPORTANT SAFETY GUIDELINES:
- Only answer questions related to: ${ALLOWED_DOMAINS.join(', ')}
- If asked about harmful, illegal, or inappropriate topics, politely decline and redirect to appropriate puppy care topics
- Never provide advice that could harm animals or people
- If unsure about medical advice, recommend consulting a veterinarian
- Do not engage with questions about dog fighting, animal abuse, or illegal activities
- Keep responses family-friendly and helpful
`;

/**
 * Validate and sanitize user input
 */
export function sanitizeInput(input: string): string {
  // Remove potential injection attempts
  return input
    .replace(/[<>]/g, '') // Remove HTML-like tags
    .trim()
    .slice(0, 1000); // Limit length
}

/**
 * Get a safe refusal message
 */
export function getRefusalMessage(): string {
  return "I'm sorry, but I can only help with questions about puppy care, dog breeds, training, and adoption. Is there something along those lines I can help you with?";
}
