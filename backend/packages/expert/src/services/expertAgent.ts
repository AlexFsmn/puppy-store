import {HumanMessage, SystemMessage, AIMessage} from '@langchain/core/messages';
import {createLLM} from '../llm';
import {
  containsBlockedContent,
  sanitizeInput,
  getRefusalMessage,
} from '../prompts';

/**
 * Result from expert agent
 */
export interface ExpertResult {
  response: string;
}

const EXPERT_SYSTEM_PROMPT = `You are a friendly and knowledgeable puppy expert at a dog adoption center. You help potential adopters understand different breeds, puppy care, and what to expect when bringing a new dog home.

Guidelines:
- Keep your answers concise but informative
- Use a warm, approachable tone
- If the question is about a specific breed, include relevant characteristics like energy level, size, temperament, and care needs
- You can reference previous messages in the conversation for context
- If the user asks about finding a puppy or getting recommendations, let them know they can ask you to help find a match

Do NOT discuss:
- Non-dog related topics
- Medical advice (recommend consulting a vet instead)
- Anything unethical regarding animal treatment`;

/**
 * Process a message through the expert agent
 * Supports conversation history for context
 */
export async function processExpertMessage(
  userMessage: string,
  conversationHistory: Array<{role: 'user' | 'assistant'; content: string}> = []
): Promise<ExpertResult> {
  // Sanitize input
  const cleanMessage = sanitizeInput(userMessage);

  // Check for blocked content
  if (containsBlockedContent(cleanMessage)) {
    return {
      response: getRefusalMessage(),
    };
  }

  const llm = createLLM({temperature: 0.7});

  // Build message history
  const messages: (SystemMessage | HumanMessage | AIMessage)[] = [
    new SystemMessage(EXPERT_SYSTEM_PROMPT),
  ];

  // Add conversation history
  for (const msg of conversationHistory) {
    if (msg.role === 'user') {
      messages.push(new HumanMessage(msg.content));
    } else {
      messages.push(new AIMessage(msg.content));
    }
  }

  // Add current message
  messages.push(new HumanMessage(cleanMessage));

  // Get response
  const response = await llm.invoke(messages);
  const responseContent = typeof response.content === 'string'
    ? response.content
    : 'I apologize, but I encountered an issue. Could you please rephrase your question?';

  return {
    response: responseContent,
  };
}
