// Automated Moderation & Decency Engine (PRD Section 18 & US-004)
// Protects internal workspace psychological safety while allowing playful banter.

const BANNED_KEYWORDS = [
  // Severe Harassment & Profanities
  'abuse', 'bastard', 'bitch', 'asshole', 'fucker', 'motherfucker', 'retard', 'cunt', 'dickhead', 'moron',
  'idiot', 'stupid', 'worthless', 'kill yourself', 'die', 'threat', 'slap you', 'beat you',
  // Hindi & Indian Vulgar / Abusive Slang
  'gaali', 'chutiya', 'harami', 'kamina', 'saala', 'madarchod', 'behenchod', 'gandu', 'bhadwe', 'laude',
  'bhosdike', 'kaminey', 'kutta', 'randi', 'terimaaki', 'ullu ke patthe', 'tatti', 'suar',
  // Discriminatory / Targeted Workplace Bullying
  'fire him', 'fire her', 'useless piece', 'ugly', 'fat', 'loser', 'scam artist', 'fraudulent', 'thief',
  'stealing credit', 'toxic creep', 'harasser', 'casteist', 'racist'
];

// Leetspeak normalization map
const LEET_MAP = {
  '@': 'a',
  '4': 'a',
  '8': 'b',
  '3': 'e',
  '1': 'i',
  '!': 'i',
  '0': 'o',
  '$': 's',
  '5': 's',
  '7': 't',
  '+': 't'
};

function normalizeText(text) {
  if (!text) return '';
  let normalized = text.toLowerCase();
  for (const [leet, char] of Object.entries(LEET_MAP)) {
    normalized = normalized.split(leet).join(char);
  }
  // Strip non-alphanumeric except space
  normalized = normalized.replace(/[^a-z0-9\s]/g, ' ');
  return normalized;
}

function checkDecency(text) {
  if (!text || typeof text !== 'string') {
    return { allowed: true, flaggedWords: [] };
  }

  const normalized = normalizeText(text);
  const wordsInText = normalized.split(/\s+/).filter(Boolean);
  const flaggedWords = [];

  for (const banned of BANNED_KEYWORDS) {
    const bannedNormalized = banned.toLowerCase();
    
    // Check multi-word phrase
    if (bannedNormalized.includes(' ')) {
      if (normalized.includes(bannedNormalized)) {
        flaggedWords.push(banned);
      }
    } else {
      // Single word check
      if (wordsInText.includes(bannedNormalized) || normalized.includes(` ${bannedNormalized} `) || normalized.startsWith(`${bannedNormalized} `) || normalized.endsWith(` ${bannedNormalized}`) || normalized === bannedNormalized) {
        flaggedWords.push(banned);
      }
    }
  }

  const allowed = flaggedWords.length === 0;

  return {
    allowed,
    flaggedWords,
    category: allowed ? null : 'Prohibited Workplace Language',
    reason: allowed ? null : `Decency Engine Intercept: Your text contains prohibited or toxic language (${flaggedWords.join(', ')}). Please align with workplace decency guidelines.`
  };
}

module.exports = {
  checkDecency,
  BANNED_KEYWORDS
};
