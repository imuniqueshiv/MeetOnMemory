/**
 * Format icebreaker type for display
 */
export const formatIcebreakerType = (type) => {
  const typeMap = {
    fun_fact: 'Fun Fact',
    would_you_rather: 'Would You Rather',
    two_truths_one_lie: 'Two Truths One Lie',
    icebreaker_question: 'Icebreaker Question',
    word_association: 'Word Association',
    quick_poll: 'Quick Poll',
    brain_teaser: 'Brain Teaser',
  };
  return typeMap[type] || type.replace(/_/g, ' ');
};

/**
 * Get emoji for icebreaker type
 */
export const getIcebreakerEmoji = (type) => {
  const emojiMap = {
    fun_fact: '💡',
    would_you_rather: '🤔',
    two_truths_one_lie: '🕵️',
    icebreaker_question: '❓',
    word_association: '🔗',
    quick_poll: '📊',
    brain_teaser: '🧩',
  };
  return emojiMap[type] || '✨';
};

/**
 * Get color scheme for icebreaker type
 */
export const getIcebreakerColor = (type) => {
  const colorMap = {
    fun_fact: 'blue',
    would_you_rather: 'purple',
    two_truths_one_lie: 'green',
    icebreaker_question: 'indigo',
    word_association: 'orange',
    quick_poll: 'pink',
    brain_teaser: 'red',
  };
  return colorMap[type] || 'gray';
};

/**
 * Check if icebreaker is still active
 */
export const isIcebreakerActive = (icebreaker) => {
  if (!icebreaker) return false;
  if (icebreaker.status !== 'active') return false;
  if (icebreaker.expiresAt && new Date(icebreaker.expiresAt) < new Date()) {
    return false;
  }
  return true;
};

/**
 * Get time remaining on icebreaker
 */
export const getTimeRemaining = (icebreaker) => {
  if (!icebreaker || !icebreaker.expiresAt) return null;
  const now = new Date();
  const expiry = new Date(icebreaker.expiresAt);
  const diff = expiry - now;
  
  if (diff <= 0) return 'Expired';
  
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
};

/**
 * Get response rate percentage
 */
export const getResponseRate = (icebreaker, totalParticipants) => {
  if (!icebreaker || !totalParticipants || totalParticipants === 0) return 0;
  const responseCount = icebreaker.responses?.length || 0;
  return Math.round((responseCount / totalParticipants) * 100);
};

/**
 * Shuffle array (Fisher-Yates)
 */
export const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Generate a random icebreaker from templates
 */
export const getRandomIcebreaker = () => {
  const templates = [
    "What's the most interesting thing you learned this week?",
    "If you could have any superpower, what would it be?",
    "What's your favorite way to start the day?",
    "Share one thing on your bucket list.",
    "What's the best piece of advice you've ever received?",
    "If you could travel anywhere right now, where would you go?",
    "What's a skill you'd like to learn?",
    "What's the most memorable meeting you've ever had?",
  ];
  return templates[Math.floor(Math.random() * templates.length)];
};