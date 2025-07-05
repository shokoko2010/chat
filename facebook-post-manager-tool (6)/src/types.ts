
declare global {
  interface Window {
    FB: any;
  }
}

export interface Page {
  id: string;
  name: string;
  access_token: string;
  picture: {
    data: {
      url: string;
    }
  };
}