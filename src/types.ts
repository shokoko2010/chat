
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
