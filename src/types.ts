export interface PersonaSpeechStyle {
  formality: number;
  verbosity: number;
  emotionality: number;
  humorLevel: number;
}

export interface PersonaBehavioralRules {
  dos: string[];
  donts: string[];
}

export interface PersonaKnownAboutUser {
  name?: string;
  interests?: string[];
  history?: string;
}

export interface ProductVariant {
  name: string;
  price?: string;
  stock?: number;
}

export interface BusinessProduct {
  name: string;
  description: string;
  price: string;
  category: string;
  stock?: number;
  variants?: ProductVariant[];
  dimensions?: string;
  weight?: string;
  sku?: string;
  imageUrl?: string;
}

export interface BusinessConfig {
  businessName: string;
  businessType: string;
  tagline?: string;
  products: BusinessProduct[];
  services?: string[];
  operatingHours?: string;
  location?: string;
  coverage?: string;
  policies?: string[];
  faq?: { question: string; answer: string }[];
  paymentMethods?: string[];
  socialLinks?: { platform: string; url: string }[];
}

export interface AffiliateProduct {
  name: string;
  description: string;
  price?: string;
  affiliateLink?: string;
  tags: string[];
}

export interface PersonaConfig {
  type: "personal" | "business";

  name: string;
  displayName?: string;
  age?: number;
  gender?: string;
  location?: string;
  occupation?: string;
  traits: string[];
  mbti?: string;
  values?: string[];
  quirks?: string[];
  hobbies?: string[];
  expertise?: string[];
  favoriteThings?: string[];
  dislikes?: string[];
  backstory: string;
  lifeGoals?: string[];
  recentExperiences?: string[];
  tone: "formal" | "santai" | "humoris" | "inspiratif" | "serius" | "hangat";
  language?: "indonesia" | "english" | "campur";
  speechStyle?: PersonaSpeechStyle;
  catchphrases?: string[];
  vocabularyStyle?: string[];
  greetingStyle?: string;
  conversationStarters?: string[];
  behavioralRules?: PersonaBehavioralRules;
  responsePatterns?: string[];
  relationshipToUser?: string;
  knownAboutUser?: PersonaKnownAboutUser;
  customSystemPrompt?: string;
  business?: BusinessConfig;
  products?: AffiliateProduct[];
  captionStyle?: CaptionStyle;
  visualStyle?: VisualStyle;
}

export interface CaptionStyle {
  platform: "instagram" | "tiktok" | "twitter" | "facebook" | "whatsapp";
  tone: string;
  maxLength?: number;
  hashtagCount?: number;
  emojiUsage: "none" | "minimal" | "moderate" | "heavy";
  callToAction?: string;
  formattingStyle?: string;
  examples?: string[];
}

export interface VisualStyle {
  aspectRatio: "1:1" | "4:5" | "16:9" | "9:16";
  lighting: "natural" | "studio" | "warm" | "cool" | "dramatic";
  background: "clean" | "lifestyle" | "minimal" | "outdoor" | "product-focused";
  colorPalette?: string[];
  mood: string;
  composition?: string;
  props?: string[];
}

export interface Persona extends PersonaConfig {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatSession {
  id: string;
  personaId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: number;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface ChatRequest {
  personaId: string;
  message: string;
  sessionId?: string;
}

export interface LLMConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
