import React from 'react';
import HandThumbUpIcon from './icons/HandThumbUpIcon';
import HandThumbDownIcon from './icons/HandThumbDownIcon';
import ChatBubbleLeftRightIcon from './icons/ChatBubbleLeftRightIcon';

interface PostInsightsProps {
  summary?: string;
  sentiment?: {
    positive: number;
    negative: number;
    neutral: number;
  };
}

const SentimentBar: React.FC<{ value: number, color: string, tooltip: string }> = ({ value, color, tooltip }) => (
    <div style={{ width: `${value * 100}%` }} className={`h-full ${color} transition-all duration-500`} title={tooltip}></div>
);

const PostInsights: React.FC<PostInsightsProps> = ({ summary, sentiment }) => {
  if (!summary) {
    return null;
  }
  
  return (
    <div className="p-4 bg-blue-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 rounded-b-lg fade-in">
        <h4 className="font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            تحليل الذكاء الاصطناعي
        </h4>
        <p className="text-gray-700 dark:text-gray-300 mb-4">{summary}</p>

        {sentiment && (
            <div>
                <h5 className="font-semibold text-gray-800 dark:text-white mb-2">تحليل المشاعر في التعليقات</h5>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3 flex overflow-hidden mb-2 shadow-inner">
                    <SentimentBar value={sentiment.positive} color="bg-green-500" tooltip={`إيجابي: ${(sentiment.positive * 100).toFixed(0)}%`} />
                    <SentimentBar value={sentiment.neutral} color="bg-gray-400" tooltip={`محايد: ${(sentiment.neutral * 100).toFixed(0)}%`} />
                    <SentimentBar value={sentiment.negative} color="bg-red-500" tooltip={`سلبي: ${(sentiment.negative * 100).toFixed(0)}%`} />
                </div>
                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                   <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                       <HandThumbUpIcon className="w-4 h-4" /> {(sentiment.positive * 100).toFixed(0)}%
                   </span>
                    <span className="flex items-center gap-1 font-medium">
                        <ChatBubbleLeftRightIcon className="w-4 h-4" /> {(sentiment.neutral * 100).toFixed(0)}%
                    </span>
                   <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                        <HandThumbDownIcon className="w-4 h-4" /> {(sentiment.negative * 100).toFixed(0)}%
                   </span>
                </div>
            </div>
        )}
    </div>
  );
};

export default PostInsights;
