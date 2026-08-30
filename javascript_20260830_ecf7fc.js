import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from './logger.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const ICEBREAKER_TEMPLATES = {
  fun_fact: {
    prompt: (context) =>
      `Generate an interesting fun fact related to ${context.topic || 'meetings or teamwork'}.
       The fact should be surprising, educational, and spark conversation.
       Keep it to 1-2 sentences.`,
    options: false,
  },
  would_you_rather: {
    prompt: (context) =>
      `Create a "Would You Rather" question about ${context.topic || 'workplace scenarios'}.
       Format as "Would you rather [option A] or [option B]?".
       Make it fun and relevant to the team.`,
    options: true,
  },
  two_truths_one_lie: {
    prompt: (context) =>
      `Generate a "Two Truths and a Lie" about ${context.topic || 'professional life'}.
       Provide 2 true statements and 1 false statement.
       Mix of professional and personal facts.`,
    options: true,
  },
  icebreaker_question: {
    prompt: (context) =>
      `Create an engaging icebreaker question for a team meeting about ${context.topic || 'workplace connections'}.
       The question should help team members learn about each other.
       Make it thoughtful and inclusive.`,
    options: false,
  },
  word_association: {
    prompt: (context) =>
      `Generate a word association game starter for ${context.topic || 'team collaboration'}.
       Provide a key word that team members can associate with.
       Include 3-4 related words as examples.`,
    options: true,
  },
  quick_poll: {
    prompt: (context) =>
      `Create a quick poll question for ${context.topic || 'team preferences'}.
       Include 4 options that team members can vote on.
       Make it light and fun.`,
    options: true,
  },
  brain_teaser: {
    prompt: (context) =>
      `Create a short brain teaser or riddle related to ${context.topic || 'problem solving'}.
       Keep it easy to understand and solve in under 60 seconds.
       Provide the answer separately.`,
    options: false,
  },
};

export const generateIcebreakerWithAI = async (meeting, options = {}) => {
  try {
    const type = options.type || 'icebreaker_question';
    const template = ICEBREAKER_TEMPLATES[type] || ICEBREAKER_TEMPLATES.icebreaker_question;

    const context = {
      topic: meeting.topic || meeting.title || 'team collaboration',
      teamSize: meeting.participants?.length || 5,
      meetingType: meeting.type || 'standup',
      ...options.context,
    };

    const prompt = `
      You are a team engagement expert creating icebreakers for meetings.

      ${template.prompt(context)}

      Requirements:
      - Keep it professional and inclusive
      - Avoid controversial or sensitive topics
      - Make it engaging for teams of ${context.teamSize} people
      - Response must be in JSON format

      Return JSON:
      {
        "question": "The main question or prompt",
        ${template.options ? '"options": ["Option 1", "Option 2", ...],' : ''}
        "tags": ["tag1", "tag2"],
        "difficulty": "easy" | "medium" | "hard",
        "metadata": {
          "category": "string",
          "estimatedTime": "seconds"
        }
      }
    `;

    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid AI response format');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Add default options if not provided but expected
    if (template.options && !parsed.options) {
      parsed.options = generateDefaultOptions(type);
    }

    // Ensure minimum content
    if (!parsed.question || parsed.question.length < 5) {
      throw new Error('Generated question too short');
    }

    return parsed;
  } catch (error) {
    logger.error('AI icebreaker generation failed:', error);
    // Fallback to template-based generation
    return generateFallbackIcebreaker(options.type || 'icebreaker_question');
  }
};

const generateDefaultOptions = (type) => {
  const optionsMap = {
    would_you_rather: [
      'Work from home permanently',
      'Work from office with team',
      'Have unlimited coffee breaks',
      'Have 4-day work weeks',
    ],
    two_truths_one_lie: [
      'I have traveled to 10+ countries',
      'I speak 3 languages fluently',
      'I once met a celebrity',
      'I can juggle (this one is false)',
    ],
    word_association: ['Innovation', 'Collaboration', 'Excellence', 'Growth'],
    quick_poll: [
      'Morning person',
      'Night owl',
      'Afternoon peak',
      'All of the above',
    ],
    brain_teaser: ['Think outside the box', 'Creative problem solving', 'Innovative thinking'],
  };
  return optionsMap[type] || ['Option A', 'Option B'];
};

const generateFallbackIcebreaker = (type) => {
  const fallbacks = {
    fun_fact: {
      question: "Did you know? The average person spends 13 years of their life at work!",
      tags: ['fun', 'work'],
      difficulty: 'easy',
      metadata: { category: 'fun_fact', estimatedTime: '15' },
    },
    would_you_rather: {
      question: "Would you rather have unlimited time but limited money, or unlimited money but limited time?",
      options: ['Unlimited time', 'Unlimited money'],
      tags: ['philosophical', 'preferences'],
      difficulty: 'medium',
      metadata: { category: 'preferences', estimatedTime: '30' },
    },
    icebreaker_question: {
      question: "What's the most interesting thing you've learned this month?",
      tags: ['learning', 'reflection'],
      difficulty: 'easy',
      metadata: { category: 'reflection', estimatedTime: '45' },
    },
  };
  return fallbacks[type] || fallbacks.icebreaker_question;
};

export default { generateIcebreakerWithAI };