

declare global {
  interface Window {
    FB: any;
  }
}

export interface Target {
  id: string;
  name: string;
  type: 'page' | 'group';
  access_token?: string; // Optional: Pages have this, groups use user token
  picture: {
    data: {
      url: string;
    }
  };
}

export interface ScheduledPost {
  id: string;
  text: string;
  imageUrl?: string;
  scheduledAt: Date;
  targets: Target[];
}

export interface Draft {
  id: string;
  text: string;
  imageFile: File | null;
  imagePreview: string | null;
  selectedTargetIds: string[];
}

export interface PostAnalytics {
  likes?: number;
  comments?: number;
  shares?: number;
  loading: boolean;
  lastUpdated: Date | null;
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

export interface BulkPostItem {
  id: string;
  imageFile: File;
  imagePreview: string;
  text: string;
  scheduleDate: string; // ISO string format
  targetIds: string[]; // Array of selected target IDs
  error?: string; // For per-item validation errors
  isGeneratingDescription?: boolean;
}

// Types for AI Content Planner
export interface ContentPlanRequest {
  pageType: string;
  audience: string;
  goals: string;
  tone: string;
}

export interface ContentPlanItem {
  day: string; // e.g., "الاثنين"
  theme: string; // e.g., "نصيحة الأسبوع"
  postSuggestion: string; // The full suggested post text
  contentType: string; // e.g., "صورة عالية الجودة", "سؤال تفاعلي"
  cta: string; // e.g., "ما رأيكم؟ شاركونا في التعليقات!"
}
