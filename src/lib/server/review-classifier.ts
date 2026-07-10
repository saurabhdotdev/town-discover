import { MoodAxis, MoodProfile } from "@/lib/mood-recommendations";

interface TrainingExample {
  text: string;
  mood: MoodAxis;
}

// Curated training corpus to seed token-class associations
const TRAINING_DATA: TrainingExample[] = [
  // Romantic
  { text: "perfect cozy date night dim lighting candlelight dinner romantic vibes rooftop sunset view couples", mood: "romantic" },
  { text: "very intimate and romantic setting great for anniversaries and quiet couples dinner", mood: "romantic" },
  { text: "gorgeous city views at sunset rooftop bar beautiful scenery romantic date", mood: "romantic" },
  { text: "cozy seating soft acoustic music great wines romantic evening with partner", mood: "romantic" },

  // Chill
  { text: "calm peaceful cafe quiet environment perfect for reading and remote work free high-speed wifi", mood: "chill" },
  { text: "slow walks in lush green gardens relaxing atmosphere away from city noise silent space", mood: "chill" },
  { text: "serene environment cozy reading corners delicious tea slow paced chill afternoon", mood: "chill" },
  { text: "great workspace friendly baristas quiet seating power sockets work friendly", mood: "chill" },

  // Foodie
  { text: "delicious authentic flavors spicy curry tasty dishes rich food street food bites snacks", mood: "foodie" },
  { text: "mouth-watering desserts ice cream kulfi gelato sweet treats culinary masterpiece", mood: "foodie" },
  { text: "best burgers fries gourmet dining culinary experience amazing chef special tasting menu", mood: "foodie" },
  { text: "traditional local street food stall spicy snacks tea local breakfast spot", mood: "foodie" },

  // Adventurous
  { text: "scenic hill trek hiking trails outdoor exploration adventurous walk panoramic views nature trip", mood: "adventurous" },
  { text: "exploring hidden caves trekking trails rocky pathways nature walks weekend adventure", mood: "adventurous" },
  { text: "scenic long drive ghats winding roads outdoor cycling trail exploration travel", mood: "adventurous" },
  { text: "waterfalls forest walks nature trails camping outdoor excursion active weekend", mood: "adventurous" },

  // Social
  { text: "fun lively hangout place with friends family gathering games boardgames groups laughing", mood: "social" },
  { text: "great group package friendly host community meetup board games lively conversation", mood: "social" },
  { text: "large seating area perfect for birthday party family dinners group meetups", mood: "social" },
  { text: "interactive games bowling multiplayer arcade group activities social space", mood: "social" },

  // Energetic
  { text: "lively nightclub dancing live music loud dj beats high energy drinks energetic crowd party", mood: "energetic" },
  { text: "lively concert gig acoustic band loud music dancing drinks craft beer brewpub night", mood: "energetic" },
  { text: "bars pubs high energy music dj set weekend dancefloor crowd is energetic", mood: "energetic" },
  { text: "live comedy show laughing event tonight happening crowded pub high energy", mood: "energetic" },

  // Budget
  { text: "cheap eats budget friendly very affordable low price discount deals free entry cheap snacks", mood: "budget" },
  { text: "pocket friendly delicious food cheap price student discount combo deals budget dining", mood: "budget" },
  { text: "free public park entry free historical site no ticket cost budget outing", mood: "budget" },
  { text: "wholesale market cheap shopping local snacks cheap price street bargains", mood: "budget" },

  // Cultural
  { text: "temple heritage site historic monuments ancient architecture museum gallery guide tour historical", mood: "cultural" },
  { text: "traditional art gallery handcraft exhibition cultural dance historical library learning", mood: "cultural" },
  { text: "ancient ruins tour guide historical background local heritage walk museum displays", mood: "cultural" },
  { text: "fort architecture temple sculptures traditional cultural heritage monument", mood: "cultural" },
];

const MOOD_AXES: MoodAxis[] = [
  "chill",
  "adventurous",
  "social",
  "foodie",
  "romantic",
  "cultural",
  "energetic",
  "budget",
];

// Tokenize text: lowercase, remove punctuation, split by whitespace, filter out short words
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(token => token.length > 2);
}

export class NaiveBayesClassifier {
  private vocab = new Set<string>();
  private classTokenCounts: Record<MoodAxis, Record<string, number>> = {} as any;
  private classTotalTokens: Record<MoodAxis, number> = {} as any;
  private classDocCounts: Record<MoodAxis, number> = {} as any;
  private totalDocs = 0;

  constructor() {
    // Initialize structures
    for (const mood of MOOD_AXES) {
      this.classTokenCounts[mood] = {};
      this.classTotalTokens[mood] = 0;
      this.classDocCounts[mood] = 0;
    }
    this.train(TRAINING_DATA);
  }

  /**
   * Train the classifier on training examples.
   */
  private train(data: TrainingExample[]) {
    for (const ex of data) {
      const tokens = tokenize(ex.text);
      const mood = ex.mood;

      this.classDocCounts[mood]++;
      this.totalDocs++;

      for (const token of tokens) {
        this.vocab.add(token);
        this.classTokenCounts[mood][token] = (this.classTokenCounts[mood][token] || 0) + 1;
        this.classTotalTokens[mood]++;
      }
    }
  }

  /**
   * Predict the MoodProfile for a given review text.
   */
  public classify(text: string): MoodProfile {
    const tokens = tokenize(text);
    const logProbs: Record<MoodAxis, number> = {} as any;
    const vocabSize = this.vocab.size;

    // Compute log probabilities for each class
    for (const mood of MOOD_AXES) {
      const classPrior = this.classDocCounts[mood] / this.totalDocs;
      let logProb = Math.log(classPrior);

      for (const token of tokens) {
        // Skip tokens not in vocabulary to avoid out-of-vocabulary bias
        if (!this.vocab.has(token)) continue;

        // Count occurrences of token in class
        const tokenCount = this.classTokenCounts[mood][token] || 0;
        // Laplace smoothing (add-one)
        const likelihood = (tokenCount + 1.0) / (this.classTotalTokens[mood] + vocabSize);
        logProb += Math.log(likelihood);
      }

      logProbs[mood] = logProb;
    }

    // Exponentiate and normalize using Log-Sum-Exp stability trick
    const maxLog = Math.max(...MOOD_AXES.map(mood => logProbs[mood]));
    const exponents = MOOD_AXES.map(mood => Math.exp(logProbs[mood] - maxLog));
    const sumExponents = exponents.reduce((sum, val) => sum + val, 0);

    const profile = {} as MoodProfile;
    MOOD_AXES.forEach((mood, i) => {
      profile[mood] = exponents[i] / sumExponents;
    });

    return profile;
  }
}

// Export singleton instance
export const reviewClassifier = new NaiveBayesClassifier();
