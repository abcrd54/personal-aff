import type { PersonaSpeechStyle } from "../types";

const VALID_TYPES = ["personal", "business"];
const VALID_TONES = ["formal", "santai", "humoris", "inspiratif", "serius", "hangat"];
const VALID_LANGUAGES = ["indonesia", "english", "campur"];

const MAX_STRING_LEN = 2000;
const MAX_ARRAY_LEN = 20;
const MAX_ITEM_LEN = 500;
const MAX_BACKSTORY_LEN = 5000;
const MAX_PRODUCTS = 50;

export interface ValidationError {
  field: string;
  message: string;
}

export function validatePersonaConfig(config: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!config || typeof config !== "object") {
    return [{ field: "root", message: "Request body must be an object" }];
  }

  if (!config.type || !VALID_TYPES.includes(config.type)) {
    errors.push({ field: "type", message: `Required. Must be one of: ${VALID_TYPES.join(", ")}` });
  }

  requiredString(errors, config, "name", 1, 100);
  requiredString(errors, config, "backstory", 1, MAX_BACKSTORY_LEN);

  if (config.traits && !Array.isArray(config.traits)) {
    errors.push({ field: "traits", message: "Must be an array of strings" });
  } else if (Array.isArray(config.traits)) {
    maxArrayLength(errors, "traits", config.traits, MAX_ARRAY_LEN);
    stringArrayItems(errors, "traits", config.traits);
  }

  if (config.hobbies !== undefined && !Array.isArray(config.hobbies)) {
    errors.push({ field: "hobbies", message: "Must be an array of strings" });
  } else if (Array.isArray(config.hobbies)) {
    maxArrayLength(errors, "hobbies", config.hobbies, MAX_ARRAY_LEN);
    stringArrayItems(errors, "hobbies", config.hobbies);
  }

  if (!config.tone || !VALID_TONES.includes(config.tone)) {
    errors.push({
      field: "tone",
      message: `Required. Must be one of: ${VALID_TONES.join(", ")}`,
    });
  }

  if (config.gender && !["pria", "wanita", "lainnya"].includes(config.gender)) {
    errors.push({
      field: "gender",
      message: 'Must be one of: pria, wanita, lainnya',
    });
  }

  if (config.language && !VALID_LANGUAGES.includes(config.language)) {
    errors.push({
      field: "language",
      message: `Must be one of: ${VALID_LANGUAGES.join(", ")}`,
    });
  }

  if (config.age !== undefined) {
    if (typeof config.age !== "number" || config.age < 1 || config.age > 150) {
      errors.push({
        field: "age",
        message: "Must be a number between 1 and 150",
      });
    }
  }

  if (config.speechStyle && typeof config.speechStyle === "object") {
    validateSpeechStyle(errors, config.speechStyle);
  }

  if (
    config.customSystemPrompt &&
    typeof config.customSystemPrompt === "string" &&
    config.customSystemPrompt.length > MAX_BACKSTORY_LEN
  ) {
    errors.push({
      field: "customSystemPrompt",
      message: `Max ${MAX_BACKSTORY_LEN} characters`,
    });
  }

  if (config.business && typeof config.business === "object") {
    validateBusinessConfig(errors, config.business);
  }

  if (config.captionStyle && typeof config.captionStyle === "object") {
    if (config.captionStyle.platform && !["instagram", "tiktok", "twitter", "facebook", "whatsapp"].includes(config.captionStyle.platform)) {
      errors.push({ field: "captionStyle.platform", message: "Must be one of: instagram, tiktok, twitter, facebook, whatsapp" });
    }
    if (config.captionStyle.emojiUsage && !["none", "minimal", "moderate", "heavy"].includes(config.captionStyle.emojiUsage)) {
      errors.push({ field: "captionStyle.emojiUsage", message: "Must be one of: none, minimal, moderate, heavy" });
    }
  }

  if (config.visualStyle && typeof config.visualStyle === "object") {
    if (config.visualStyle.aspectRatio && !["1:1", "4:5", "16:9", "9:16"].includes(config.visualStyle.aspectRatio)) {
      errors.push({ field: "visualStyle.aspectRatio", message: "Must be one of: 1:1, 4:5, 16:9, 9:16" });
    }
    if (config.visualStyle.lighting && !["natural", "studio", "warm", "cool", "dramatic"].includes(config.visualStyle.lighting)) {
      errors.push({ field: "visualStyle.lighting", message: "Must be one of: natural, studio, warm, cool, dramatic" });
    }
    if (config.visualStyle.background && !["clean", "lifestyle", "minimal", "outdoor", "product-focused"].includes(config.visualStyle.background)) {
      errors.push({ field: "visualStyle.background", message: "Must be one of: clean, lifestyle, minimal, outdoor, product-focused" });
    }
  }

  if (config.products && Array.isArray(config.products)) {
    for (let i = 0; i < Math.min(config.products.length, 50); i++) {
      const p = config.products[i];
      if (!p || typeof p !== "object") {
        errors.push({ field: `products[${i}]`, message: "Must be an object" });
        continue;
      }
      if (!p.name || typeof p.name !== "string") {
        errors.push({ field: `products[${i}].name`, message: "Required (string)" });
      }
      if (!p.description || typeof p.description !== "string") {
        errors.push({ field: `products[${i}].description`, message: "Required (string)" });
      }
      if (p.price && typeof p.price !== "string") {
        errors.push({ field: `products[${i}].price`, message: "Must be a string" });
      }
      if (!p.tags || !Array.isArray(p.tags)) {
        errors.push({ field: `products[${i}].tags`, message: "Required (array of strings)" });
      } else if (p.tags.length > 10) {
        errors.push({ field: `products[${i}].tags`, message: "Max 10 tags" });
      }
    }
  }

  optionalMaxStringArray(errors, config, "values", MAX_ARRAY_LEN, MAX_ITEM_LEN);
  optionalMaxStringArray(errors, config, "quirks", MAX_ARRAY_LEN, MAX_ITEM_LEN);
  optionalMaxStringArray(errors, config, "expertise", MAX_ARRAY_LEN, MAX_ITEM_LEN);
  optionalMaxStringArray(errors, config, "favoriteThings", MAX_ARRAY_LEN, MAX_ITEM_LEN);
  optionalMaxStringArray(errors, config, "dislikes", MAX_ARRAY_LEN, MAX_ITEM_LEN);
  optionalMaxStringArray(errors, config, "lifeGoals", MAX_ARRAY_LEN, MAX_ITEM_LEN);
  optionalMaxStringArray(errors, config, "recentExperiences", MAX_ARRAY_LEN, MAX_ITEM_LEN);
  optionalMaxStringArray(errors, config, "catchphrases", MAX_ARRAY_LEN, MAX_ITEM_LEN);
  optionalMaxStringArray(errors, config, "vocabularyStyle", MAX_ARRAY_LEN, MAX_ITEM_LEN);
  optionalMaxStringArray(errors, config, "conversationStarters", MAX_ARRAY_LEN, MAX_ITEM_LEN);
  optionalMaxStringArray(errors, config, "responsePatterns", MAX_ARRAY_LEN, MAX_ITEM_LEN);

  if (config.behavioralRules) {
    optionalMaxStringArray(errors, config.behavioralRules, "dos", MAX_ARRAY_LEN, MAX_ITEM_LEN);
    optionalMaxStringArray(errors, config.behavioralRules, "donts", MAX_ARRAY_LEN, MAX_ITEM_LEN);
  }

  optionalMaxString(errors, config, "displayName", MAX_STRING_LEN);
  optionalMaxString(errors, config, "location", MAX_STRING_LEN);
  optionalMaxString(errors, config, "occupation", MAX_STRING_LEN);
  optionalMaxString(errors, config, "relationshipToUser", MAX_STRING_LEN);
  optionalMaxString(errors, config, "greetingStyle", MAX_STRING_LEN);
  optionalMaxString(errors, config, "mbti", 4);

  return errors;
}

function validateBusinessConfig(errors: ValidationError[], biz: any) {
  requiredString(errors, biz, "businessName", 1, 200);
  requiredString(errors, biz, "businessType", 1, 200);

  if (biz.products && !Array.isArray(biz.products)) {
    errors.push({ field: "business.products", message: "Must be an array" });
  } else if (Array.isArray(biz.products)) {
    if (biz.products.length > MAX_PRODUCTS) {
      errors.push({ field: "business.products", message: `Max ${MAX_PRODUCTS} products` });
    }
    for (let i = 0; i < biz.products.length; i++) {
      const p = biz.products[i];
      if (!p || typeof p !== "object") {
        errors.push({ field: `business.products[${i}]`, message: "Must be an object" });
        continue;
      }
      if (!p.name || typeof p.name !== "string") {
        errors.push({ field: `business.products[${i}].name`, message: "Required (string)" });
      }
      if (!p.description || typeof p.description !== "string") {
        errors.push({ field: `business.products[${i}].description`, message: "Required (string)" });
      }
      if (!p.price || typeof p.price !== "string") {
        errors.push({ field: `business.products[${i}].price`, message: "Required (string)" });
      }
      if (!p.category || typeof p.category !== "string") {
        errors.push({ field: `business.products[${i}].category`, message: "Required (string)" });
      }
      if (p.stock !== undefined && (typeof p.stock !== "number" || p.stock < 0)) {
        errors.push({ field: `business.products[${i}].stock`, message: "Must be a positive number" });
      }
      if (p.variants && Array.isArray(p.variants)) {
        for (let j = 0; j < Math.min(p.variants.length, 20); j++) {
          const v = p.variants[j];
          if (!v?.name) errors.push({ field: `business.products[${i}].variants[${j}].name`, message: "Required" });
        }
      }
    }
  }

  optionalMaxString(errors, biz, "operatingHours", MAX_STRING_LEN);
  optionalMaxString(errors, biz, "location", MAX_STRING_LEN);
  optionalMaxString(errors, biz, "coverage", MAX_STRING_LEN);
  optionalMaxString(errors, biz, "tagline", 200);

  if (biz.services && Array.isArray(biz.services)) {
    optionalMaxStringArray(errors, biz, "services", MAX_ARRAY_LEN, MAX_ITEM_LEN);
  }

  if (biz.policies && Array.isArray(biz.policies)) {
    optionalMaxStringArray(errors, biz, "policies", MAX_ARRAY_LEN, MAX_ITEM_LEN);
  }

  if (biz.paymentMethods && Array.isArray(biz.paymentMethods)) {
    optionalMaxStringArray(errors, biz, "paymentMethods", MAX_ARRAY_LEN, MAX_ITEM_LEN);
  }

  if (biz.faq && Array.isArray(biz.faq)) {
    for (let i = 0; i < Math.min(biz.faq.length, MAX_ARRAY_LEN); i++) {
      const f = biz.faq[i];
      if (!f || typeof f !== "object") continue;
      if (f.question && typeof f.question !== "string") {
        errors.push({ field: `business.faq[${i}].question`, message: "Must be a string" });
      }
      if (f.answer && typeof f.answer !== "string") {
        errors.push({ field: `business.faq[${i}].answer`, message: "Must be a string" });
      }
    }
  }
}

export function validateChatMessage(message: any): ValidationError[] {
  const errors: ValidationError[] = [];
  const MAX_MESSAGE_LEN = 10000;

  if (!message || typeof message !== "string") {
    return [{ field: "message", message: "Message must be a string" }];
  }

  if (message.length < 1) {
    errors.push({ field: "message", message: "Message cannot be empty" });
  }

  if (message.length > MAX_MESSAGE_LEN) {
    errors.push({
      field: "message",
      message: `Message max ${MAX_MESSAGE_LEN} characters`,
    });
  }

  return errors;
}

function requiredString(
  errors: ValidationError[],
  obj: any,
  field: string,
  minLen: number,
  maxLen: number
) {
  const val = obj[field];
  if (val === undefined || val === null || typeof val !== "string") {
    errors.push({ field, message: `${field} is required (string)` });
    return;
  }
  if (val.length < minLen) {
    errors.push({ field, message: `${field} must be at least ${minLen} characters` });
  }
  if (val.length > maxLen) {
    errors.push({ field, message: `${field} max ${maxLen} characters` });
  }
}

function optionalMaxString(
  errors: ValidationError[],
  obj: any,
  field: string,
  maxLen: number
) {
  const val = obj[field];
  if (val === undefined || val === null) return;
  if (typeof val !== "string") {
    errors.push({ field, message: `${field} must be a string` });
    return;
  }
  if (val.length > maxLen) {
    errors.push({ field, message: `${field} max ${maxLen} characters` });
  }
}

function maxArrayLength(
  errors: ValidationError[],
  field: string,
  arr: any[],
  max: number
) {
  if (arr.length > max) {
    errors.push({ field, message: `${field} max ${max} items` });
  }
}

function stringArrayItems(
  errors: ValidationError[],
  field: string,
  arr: any[]
) {
  for (let i = 0; i < arr.length; i++) {
    if (typeof arr[i] !== "string") {
      errors.push({
        field: `${field}[${i}]`,
        message: `Must be a string`,
      });
    }
  }
}

function optionalMaxStringArray(
  errors: ValidationError[],
  obj: any,
  field: string,
  maxLen: number,
  maxItemLen: number
) {
  const arr = obj[field];
  if (arr === undefined || arr === null) return;
  if (!Array.isArray(arr)) {
    errors.push({ field, message: `${field} must be an array` });
    return;
  }
  if (arr.length > maxLen) {
    errors.push({ field, message: `${field} max ${maxLen} items` });
  }
  for (let i = 0; i < arr.length; i++) {
    if (typeof arr[i] !== "string") {
      errors.push({ field: `${field}[${i}]`, message: "Must be a string" });
    } else if (arr[i].length > maxItemLen) {
      errors.push({
        field: `${field}[${i}]`,
        message: `Max ${maxItemLen} characters per item`,
      });
    }
  }
}

function validateSpeechStyle(errors: ValidationError[], ss: PersonaSpeechStyle) {
  const ranges: Record<string, number> = {
    formality: 5,
    verbosity: 5,
    emotionality: 5,
    humorLevel: 5,
  };
  for (const [key, max] of Object.entries(ranges)) {
    const val = ss[key];
    if (val === undefined) continue;
    if (typeof val !== "number" || val < 1 || val > max) {
      errors.push({
        field: `speechStyle.${key}`,
        message: `Must be a number between 1 and ${max}`,
      });
    }
  }
}
