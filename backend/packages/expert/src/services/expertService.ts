import {StringOutputParser} from '@langchain/core/output_parsers';
import {createLLM} from '../llm';
import {
  expertQuestionPrompt,
  containsBlockedContent,
  sanitizeInput,
  getRefusalMessage,
} from '../prompts';
import type {ExpertResponse} from '@puppy-store/shared';

/**
 * Service for handling "Ask the Puppy Expert" questions
 */
export async function askExpert(question: string): Promise<ExpertResponse> {
  // Sanitize and validate input
  const cleanQuestion = sanitizeInput(question);

  // Check for blocked content
  if (containsBlockedContent(cleanQuestion)) {
    return {
      answer: getRefusalMessage(),
    };
  }

  // Create the chain
  const llm = createLLM({temperature: 0.7});
  const chain = expertQuestionPrompt.pipe(llm).pipe(new StringOutputParser());

  // Get the response
  const answer = await chain.invoke({
    question: cleanQuestion,
  });

  return {
    answer,
  };
}
