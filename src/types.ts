

declare global {
  interface Window {
    FB: any;
  }
}

export interface Target {
  id: string;
  name:string;
  type: 'page' | 'group' | 'instagram';
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
  id: string;
  text: string;
  imageUrl?: string;
  imageFile?: File; // For reminder re-publishing
  scheduledAt: Date;
  isReminder: boolean;
  targetId: string; // ID of the target (page/group/ig)
  targetInfo: {
      name: string;
      avatarUrl: string;
      type: 'page' | 'group' | 'instagram';
  }
}

export interface Draft {
  id: string;
  text: string;
  imageFile: File | null;
  imagePreview: string | null;
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
  imageFile: File;
  imagePreview: string;
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

export interface PageProfile {
  description: string;
  services: string;
  contactInfo: string;
  website: string;
  currentOffers: string;
}

//--- Types for AI Content Planner ---

// Base for all strategy requests
interface BaseStrategyRequest {
  duration: 'weekly' | 'monthly' | 'annual';
  audience: string;
  goals: string;
  tone: string;
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
  day: string; // e.g., "الأسبوع 1 - الاثنين" or "يناير"
  theme: string; // e.g., "نصيحة الأسبوع" or "موضوع شهر يناير"
  postSuggestion: string; // The full suggested post text or theme description
  contentType: string; // e.g., "صورة عالية الجودة", "استطلاع رأي"
  cta: string; // e.g., "ما رأيكم؟ شاركونا في التعليقات!"
}