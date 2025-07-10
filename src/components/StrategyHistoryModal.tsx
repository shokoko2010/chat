import React from 'react';
import { StrategyHistoryItem, ContentPlanItem } from '../types';
import StrategyHistoryCard from './StrategyHistoryCard';
import Button from './ui/Button';

interface StrategyHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: StrategyHistoryItem[];
  onLoad: (plan: ContentPlanItem[]) => void;
  onDelete: (id: string) => void;
}

const StrategyHistoryModal: React.FC<StrategyHistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onLoad,
  onDelete,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-start p-4 sm:p-8 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-gray-100 dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl my-8 fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">سجل الاستراتيجيات المحفوظة</h2>
          <p className="text-gray-600 dark:text-gray-400">
            يمكنك هنا عرض وتحميل أو حذف الاستراتيجيات التي قمت بإنشائها سابقًا.
          </p>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {history.length === 0 ? (
            <div className="text-center text-gray-500 py-10">
              <p>لا توجد استراتيجيات محفوظة حتى الآن.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {history.map((item) => (
                <StrategyHistoryCard
                  key={item.id}
                  item={item}
                  onLoad={onLoad}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            إغلاق
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StrategyHistoryModal;
