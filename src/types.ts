
declare global {
  interface Window {
    FB: any;
  }
}

export interface Target {
  id: string;
  name:string;
  type: 'page' | 'instagram';
  access_token?: string;
  picture: {
    data: {
      url: string;
    }
  };
  parentPageId?: string;
  published_posts?: { data: any[] }; // To match FB API response for IG
}

export interface ScheduledPost {
  id: string; // This can be the local ID or the Facebook post ID after syncing
  postId?: string; // The definitive Facebook Post ID
  text: string;
  imageUrl?: string;
  imageFile?: File; // For reminder re-publishing
  hasImage?: boolean; // To track if an image exists, even if preview is gone
  scheduledAt: Date;
  isReminder: boolean;
  targetId: string; // ID of the target (page/group/ig)
  targetInfo: {
      name: string;
      avatarUrl: string;
      type: 'page' | 'instagram';
  }
  publishedAt?: string; // ISO string for when it was actually published
  isSynced?: boolean; // To indicate it's synced with Facebook's scheduler
}

export interface Draft {
  id: string;
  text: string;
  imageFile: File | null;
  imagePreview: string | null;
  hasImage?: boolean; // To track if an image exists, even if preview is gone
  targetId: string; // The managed target this draft was saved for
  isScheduled: boolean;
  scheduleDate: string;
  includeInstagram: boolean;
}

export interface PostAnalytics {
  likes?: number;
  comments?: number;
  shares?: number;
  reach?: number; // Added reach metric
  loading: boolean;
  lastUpdated: Date | null;
  // New AI fields
  aiSummary?: string;
  sentiment?: {
    positive: number;
    negative: number;
    neutral: number;
  };
  isGeneratingInsights?: boolean;
}

export interface PublishedPost {
  id: string; // The Facebook post ID
  pageId: string;
  pageName: string;
  pageAvatarUrl: string;
  text: string;
  imagePreview: string | null;
  publishedAt: Date;
  analytics: PostAnalytics;
}

export interface PerformanceSummaryData {
    totalReach: number;
    totalEngagement: number;
    engagementRate: number;
    topPosts: PublishedPost[];
    postCount: number;
}

export interface WeeklyScheduleSettings {
  days: number[]; // 0 for Sunday, 1 for Monday, etc.
  time: string; // "HH:MM" format
}

export interface BulkPostItem {
  id:string;
  imageFile?: File;
  imagePreview?: string;
  hasImage?: boolean;
  text: string;
  scheduleDate: string; // ISO string format
  targetIds: string[]; // List of target IDs to post to
  error?: string; // For per-item validation errors
  isGeneratingDescription?: boolean;
}

export interface Business {
  id: string;
  name: string;
}

export interface Link {
  id: string;
  label: string;
  url: string;
}

export interface PageProfile {
  description: string;
  services: string;
  contactInfo: string;
  website: string;
  links?: Link[];
  currentOffers: string;
  address: string;
  country: string;
  language: 'ar' | 'en' | 'mixed';
  contentGenerationLanguages: ('ar' | 'en')[];
}

//--- Types for AI Content Planner ---

// Base for all strategy requests
interface BaseStrategyRequest {
  duration: 'weekly' | 'monthly' | 'annual';
  audience: string;
  goals: string;
  tone: string;
  postCount?: 8 | 12 | 16 | 30;
}

export interface StandardContentRequest extends BaseStrategyRequest {
  type: 'standard';
  pillars: string; // e.g. "Tips, Products, Behind the Scenes"
}

export interface CampaignRequest extends BaseStrategyRequest {
  type: 'campaign';
  campaignName: string;
  campaignObjective: string;
}

export interface OccasionCampaignRequest extends BaseStrategyRequest {
    type: 'occasion';
    occasion: string; // e.g., "اليوم الوطني", "رمضان"
}

export interface PillarContentRequest extends BaseStrategyRequest {
  type: 'pillar';
  pillarTopic: string;
}

export interface ImageBasedRequest extends BaseStrategyRequest {
  type: 'images';
  // images are handled as a separate parameter in the service
}

// The main type for the form
export type StrategyRequest = StandardContentRequest | CampaignRequest | PillarContentRequest | ImageBasedRequest | OccasionCampaignRequest;


export interface ContentPlanItem {
  day: string;
  hook: string;
  headline: string;
  body: string;
  imageIdea: string;
}

export interface StrategyHistoryItem {
  id: string;
  request: StrategyRequest;
  plan: ContentPlanItem[];
  summary: string;
  createdAt: string; // ISO date string
}

// --- Types for Inbox ---
export interface InboxMessage {
  id: string;
  from: { name: string; id: string };
  message: string;
  created_time: string;
}
export interface InboxItem {
  id: string; // comment_id or conversation_id
  platform: 'facebook' | 'instagram';
  type: 'comment' | 'message';
  text: string; // last message snippet
  authorName: string;
  authorId: string;
  authorPictureUrl: string;
  timestamp: string; // ISO string
  post?: { // a small summary of the post the comment is on
    id: string; // post_id
    message?: string;
    picture?: string;
  };
  parentId?: string; // The ID of the parent comment, if this is a reply
  can_reply_privately?: boolean; // From Facebook API
  conversationId?: string; // For messages
  messages?: InboxMessage[]; // For message history
  isReplied?: boolean; // To show reply status icon
}

// --- Types for Auto-Responder (New IFTTT-style) ---

export type AutoResponderTriggerSource = 'comment' | 'message';
export type AutoResponderMatchType = 'any' | 'all' | 'exact';
export type AutoResponderActionType = 'public_reply' | 'private_reply' | 'direct_message';

export interface AutoResponderTrigger {
  source: AutoResponderTriggerSource;
  matchType: AutoResponderMatchType;
  keywords: string[];
  negativeKeywords: string[];
}

export interface AutoResponderAction {
  type: AutoResponderActionType;
  enabled: boolean;
  messageVariations: string[];
}

export interface AutoResponderRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: AutoResponderTrigger;
  actions: AutoResponderAction[];
  replyOncePerUser?: boolean; // Now per-rule for comments
}

export interface AutoResponderFallback {
  mode: 'ai' | 'static' | 'off';
  staticMessage: string;
}

// Top-level settings, REPLACING the old structure.
export interface AutoResponderSettings {
  rules: AutoResponderRule[];
  fallback: AutoResponderFallback;
}
