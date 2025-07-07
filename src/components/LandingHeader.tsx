
import React from 'react';
import Button from './ui/Button';

interface LandingHeaderProps {
    onLoginClick: () => void;
}

const LandingHeader: React.FC<LandingHeaderProps> = ({ onLoginClick }) => {
    return (
        <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-40 border-b border-gray-200 dark:border-gray-700/50">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex-shrink-0">
                        <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                           zex-pages
                        </span>
                    </div>
                    <div className="flex items-center">
                         <Button onClick={onLoginClick} variant="primary">
                           تسجيل الدخول
                        </Button>
                    </div>
                </div>
            </div>
        </header>
    );
}

export default LandingHeader;
