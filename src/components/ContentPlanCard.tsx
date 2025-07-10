
import React from 'react';
import { ContentPlanItem } from '../types';
import Button from './ui/Button';

interface ContentPlanCardProps {
  item: ContentPlanItem;
  onStartPost: (item: ContentPlanItem) => void;
}

const ContentPlanCard: React.FC<ContentPlanCardProps> = ({ item, onStartPost }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg flex flex-col h-full fade-in">
      <div className="p-5 flex-grow">
        <div className="mb-3">
          <h4 className="text-xl font-bold text-blue-600 dark:text-blue-400">{item.day}</h4>
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{item.theme}</p>
        </div>
        <p className="text-gray-700 dark:text-gray-300 mb-4 text-base leading-relaxed">
          {item.postSuggestion}
        </p>
        <div className="space-y-2 text-sm">
           <p><span className="font-bold">نوع المحتوى:</span> {item.contentType}</p>
           <p><span className="font-bold">دعوة للعمل:</span> {item.cta}</p>
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
