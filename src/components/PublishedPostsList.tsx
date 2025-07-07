

import React, { useState } from 'react';
import { PublishedPost } from '../types';
import Button from './ui/Button';
import HandThumbUpIcon from './icons/HandThumbUpIcon';
import ChatBubbleOvalLeftEllipsisIcon from './icons/ChatBubbleOvalLeftEllipsisIcon';
import ShareIcon from './icons/ShareIcon';
import ArrowPathIcon from './icons/ArrowPathIcon';
import LightBulbIcon from './icons/LightBulbIcon';
import PostInsights from './PostInsights';

interface PublishedPostsListProps {
  posts: PublishedPost[];
  onFetchAnalytics: (postId: string) => void;
  onGenerateInsights: (postId: string) => void;
}

const StatCard: React.FC<{ icon: React.ReactNode, value?: number, label: string }> = ({ icon, value, label }) => (
    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        {icon}
        <span className="font-bold">{value ?? '-'}</span>
        <span>{label}</span>
    </div>
);

const PublishedPostsList: React.FC<PublishedPostsListProps> = ({ posts, onFetchAnalytics, onGenerateInsights }) => {
  const [openInsightsPostId, setOpenInsightsPostId] = useState<string | null>(null);

  const toggleInsights = (postId: string) => {
    if (openInsightsPostId === postId) {
      setOpenInsightsPostId(null);
    } else {
      const post = posts.find(p => p.id === postId);
      // If insights are not yet generated, generate them. Also check if there's no summary yet, to allow re-generation.
      if (post && !post.analytics.aiSummary && !post.analytics.isGeneratingInsights) {
        onGenerateInsights(postId);
      }
      setOpenInsightsPostId(postId);
    }
  };


  if (posts.length === 0) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 p-8 border-2 border-dashed rounded-lg fade-in">
        <h3 className="font-semibold text-2xl text-gray-700 dark:text-gray-300 mb-2">لا توجد منشورات منشورة بعد</h3>
        <p className="text-lg">عندما تنشر منشورًا جديدًا، سيظهر هنا لتتمكن من تتبع أدائه.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {posts.map(post => (
        <div key={post.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="p-5">
            <div className="flex items-center mb-4">
              <img src={post.pageAvatarUrl} alt={post.pageName} className="w-10 h-10 rounded-full object-cover" />
              <div className="mr-3">
                <p className="font-bold text-gray-900 dark:text-white">{post.pageName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(post.publishedAt).toLocaleString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words mb-4">
              {post.text}
            </p>

            {post.imagePreview && (
              <div className="mb-4 rounded-lg overflow-hidden max-w-sm">
                <img src={post.imagePreview} alt="Post image" className="w-full h-auto object-cover" />
              </div>
            )}
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-6">
                    <StatCard icon={<HandThumbUpIcon className="w-5 h-5 text-blue-500" />} value={post.analytics.likes} label="إعجاب" />
                    <StatCard icon={<ChatBubbleOvalLeftEllipsisIcon className="w-5 h-5 text-gray-500" />} value={post.analytics.comments} label="تعليق" />
                    <StatCard icon={<ShareIcon className="w-5 h-5 text-green-500" />} value={post.analytics.shares} label="مشاركة" />
                </div>
                <div className="flex items-center gap-2">
                     <Button
                        variant="secondary"
                        onClick={() => toggleInsights(post.id)}
                        isLoading={post.analytics.isGeneratingInsights}
                        disabled={post.analytics.loading || post.analytics.comments === 0}
                        title={post.analytics.comments === 0 ? "لا يمكن تحليل منشور بدون تعليقات" : ""}
                    >
                        <LightBulbIcon className="w-5 h-5 ml-2" />
                        {post.analytics.isGeneratingInsights ? 'جاري التحليل...' : (openInsightsPostId === post.id ? 'إخفاء التحليل' : 'عرض التحليل')}
                    </Button>
                    <Button 
                        variant="secondary"
                        onClick={() => onFetchAnalytics(post.id)}
                        isLoading={post.analytics.loading}
                        disabled={post.analytics.isGeneratingInsights}
                    >
                        <ArrowPathIcon className="w-5 h-5 ml-2" />
                        تحديث الإحصائيات
                    </Button>
                </div>
            </div>
             {post.analytics.lastUpdated && 
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    آخر تحديث: {new Date(post.analytics.lastUpdated).toLocaleTimeString('ar-EG')}
                </p>
            }
          </div>
           {openInsightsPostId === post.id && (
                <PostInsights
                    summary={post.analytics.aiSummary}
                    sentiment={post.analytics.sentiment}
                />
            )}
        </div>
      ))}
    </div>
  );
};

export default PublishedPostsList;