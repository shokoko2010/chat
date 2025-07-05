
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
