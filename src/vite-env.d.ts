/// <reference types="vite/client" />

declare module '@canva/button' {
  import * as React from 'react';

  // The result can be for a single design or multiple designs
  type CanvaPublishResult = {
    exportUrl: string;
  } | {
    designs: {
      exportUrl: string;
    }[];
  };
  
  // Props for the CanvaButton component
  interface CanvaButtonProps {
    apiKey: string;
    designType: 'SocialMedia' | 'Presentation' | 'Poster' | 'Card' | 'Logo' | string;
    onPublish: (result: CanvaPublishResult) => void;
    children: (props: { launch: () => void; isLoading: boolean }) => React.ReactNode;
  }

  export const CanvaButton: React.FC<CanvaButtonProps>;
}
