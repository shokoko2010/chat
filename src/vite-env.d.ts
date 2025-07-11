declare module '@canva/button' {
    import React from 'react';

    export type CanvaPublishResult =
        | { designs: { exportUrl: string }[] }
        | { exportUrl: string };

    interface CanvaButtonProps {
        apiKey: string;
        designType: 'SocialMedia' | string;
        onPublish: (result: CanvaPublishResult) => void | Promise<void>;
        children: (props: {
            launch: () => void;
            isLoading: boolean;
        }) => React.ReactNode;
    }

    export const CanvaButton: React.FC<CanvaButtonProps>;
}