

import React from 'react';
import { ContentPlanItem } from '../types';
import Button from './ui/Button';

interface ContentPlanCardProps {
  item: ContentPlanItem;
  onStartPost: (item: ContentPlanItem) => void;
}

const ContentPlanCard: React.FC<ContentPlanCardProps> = ({ item, onStartPost }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg flex flex-col h-full border border-gray-200 dark:border-gray-700 fade-in">
      <div className="p-5 flex-grow">
        <h4 className="text-lg font-bold text-blue-600 dark:text-blue-400">{item.day}</h4>
        
        <div className="mt-3 space-y-4 text-sm">
          <div>
            <p className="font-bold text-gray-500 dark:text-gray-400">🎣 الهوك:</p>
            <p className="text-gray-700 dark:text-gray-300">{item.hook}</p>
          </div>
          <div>
            <p className="font-bold text-gray-500 dark:text-gray-400">📰 العنوان:</p>
            <p className="text-gray-700 dark:text-gray-300 font-semibold">{item.headline}</p>
          </div>
          <div>
            <p className="font-bold text-gray-500 dark:text-gray-400">✍️ النص التسويقي:</p>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap line-clamp-3">{item.body}</p>
          </div>
          <div>
            <p className="font-bold text-gray-500 dark:text-gray-400">🎨 فكرة التصميم:</p>
            <p className="text-gray-700 dark:text-gray-300 line-clamp-2">{item.imageIdea}</p>
          </div>
        </div>
      </div>
      <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700/50">
        <Button onClick={() => onStartPost(item)} className="w-full">
          🚀 ابدأ بهذا المنشور
        </Button>
      </div>
    </div>
  );
};

export default ContentPlanCard;
