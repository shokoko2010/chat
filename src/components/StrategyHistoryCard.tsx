import React from 'react';
import { StrategyHistoryItem, ContentPlanItem } from '../types';
import Button from './ui/Button';
import TrashIcon from './icons/TrashIcon';
import EyeIcon from './icons/EyeIcon';

interface StrategyHistoryCardProps {
  item: StrategyHistoryItem;
  onLoad: (plan: ContentPlanItem[]) => void;
  onDelete: (id: string) => void;
}

const StrategyHistoryCard: React.FC<StrategyHistoryCardProps> = ({ item, onLoad, onDelete }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg flex flex-col h-full overflow-hidden border border-gray-200 dark:border-gray-700">
      <div className="p-5 flex-grow">
        <h4 className="font-bold text-gray-900 dark:text-white mb-1 truncate" title={item.summary}>
          {item.summary}
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          تم الإنشاء في: {new Date(item.createdAt).toLocaleDateString('ar-EG')}
        </p>
        <div className="space-y-2 border-t border-gray-100 dark:border-gray-700 pt-3">
          {item.plan.slice(0, 2).map((planItem, index) => (
            <div key={index} className="text-xs p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
              <p className="font-semibold text-gray-800 dark:text-gray-200 truncate" title={planItem.headline}>{planItem.headline}</p>
              <p className="text-gray-600 dark:text-gray-400 truncate" title={planItem.body}>{planItem.body}</p>
            </div>
          ))}
          {item.plan.length > 2 && <p className="text-xs text-center text-gray-400">...</p>}
        </div>
      </div>
      <div className="p-2 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700/50 flex justify-between items-center gap-2">
        <Button
          variant="danger"
          size="sm"
          onClick={() => onDelete(item.id)}
          className="!p-2"
          aria-label="Delete strategy from history"
        >
          <TrashIcon className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          onClick={() => onLoad(item.plan)}
          className="flex-grow"
        >
          <EyeIcon className="w-4 h-4 ml-2" />
          عرض وتحميل
        </Button>
      </div>
    </div>
  );
};

export default StrategyHistoryCard;