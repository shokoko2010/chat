
import React from 'react';
import { ScheduledPost } from '../types';
import Button from './ui/Button';

interface ReminderCardProps {
    post: ScheduledPost;
    onPublish: () => void;
    isPublishing: boolean;
}

const ReminderCard: React.FC<ReminderCardProps> = ({ post, onPublish, isPublishing }) => {
    const { targetInfo } = post;
    if (!targetInfo) {
        return null; // Should not happen with consistent data
    }
    
    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex items-center justify-between gap-4 border-l-4 border-yellow-500">
            <div className="flex items-center gap-4 flex-grow">
                {post.imageUrl && (
                    <img 
                        src={post.imageUrl}
                        alt="Post preview"
                        className="w-16 h-16 rounded-md object-cover flex-shrink-0"
                    />
                )}
                <div className="flex-grow">
                    <div className="flex items-center gap-2">
                         <img 
                            src={targetInfo.avatarUrl}
                            alt={targetInfo.name}
                            className="w-6 h-6 rounded-full"
                         />
                        <p className="font-bold text-gray-800 dark:text-white">{targetInfo.name}</p>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 truncate">
                        {post.text || 'منشور يحتوي على صورة فقط.'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        مجدول للنشر في: {new Date(post.scheduledAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit'})}
                    </p>
                </div>
            </div>
            <div className="flex-shrink-0">
                <Button
                    onClick={onPublish}
                    isLoading={isPublishing}
                    className="bg-green-600 hover:bg-green-700 focus:ring-green-500"
                >
                    {isPublishing ? 'جاري النشر...' : '🚀 انشر الآن'}
                </Button>
            </div>
        </div>
    );
};

export default ReminderCard;