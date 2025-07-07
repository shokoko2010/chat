
import React from 'react';
import { BulkPostItem, Target } from '../types';
import Button from './ui/Button';
import TrashIcon from './icons/TrashIcon';
import SparklesIcon from './icons/SparklesIcon';
import { GoogleGenAI } from '@google/genai';

interface BulkPostItemCardProps {
  item: BulkPostItem;
  onUpdate: (id: string, updates: Partial<BulkPostItem>) => void;
  onRemove: (id: string) => void;
  targets: Target[];
  aiClient: GoogleGenAI | null;
  onGenerateDescription: (id: string) => void;
}

const BulkPostItemCard: React.FC<BulkPostItemCardProps> = ({
  item,
  onUpdate,
  onRemove,
  targets,
  aiClient,
  onGenerateDescription
}) => {

  const handleTargetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
    onUpdate(item.id, { targetIds: selectedOptions });
  };

  return (
    <div className={`p-5 bg-white dark:bg-gray-800 rounded-lg shadow-lg border-l-4 ${item.error ? 'border-red-500' : 'border-transparent'}`}>
      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-1/4 flex-shrink-0">
          <img src={item.imagePreview} alt="Post preview" className="rounded-lg w-full h-auto object-cover aspect-square" />
        </div>
        <div className="flex-grow space-y-4">
          <div>
            <label htmlFor={`text-${item.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              وصف المنشور
            </label>
            <textarea
              id={`text-${item.id}`}
              value={item.text}
              onChange={(e) => onUpdate(item.id, { text: e.target.value })}
              placeholder="اكتب وصفًا للصورة هنا..."
              className="w-full h-24 p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700"
            />
            <Button
                variant="secondary"
                size="sm"
                className="mt-1"
                onClick={() => onGenerateDescription(item.id)}
                isLoading={item.isGeneratingDescription}
                disabled={!aiClient || item.isGeneratingDescription}
            >
                <SparklesIcon className="w-4 h-4 ml-2" />
                {item.isGeneratingDescription ? 'جاري التفكير...' : '✨ ولّد وصفاً'}
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor={`schedule-${item.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                تاريخ النشر
              </label>
              <input
                id={`schedule-${item.id}`}
                type="datetime-local"
                value={item.scheduleDate}
                onChange={(e) => onUpdate(item.id, { scheduleDate: e.target.value })}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor={`targets-${item.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                الوجهات (يمكن اختيار أكثر من واحد)
              </label>
              <select
                id={`targets-${item.id}`}
                multiple
                value={item.targetIds}
                onChange={handleTargetChange}
                className="w-full h-24 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-blue-500 focus:border-blue-500"
              >
                {targets.map(target => (
                  <option key={target.id} value={target.id}>
                    {target.name} ({target.type === 'page' ? 'صفحة' : (target.type === 'group' ? 'مجموعة' : 'انستجرام')})
                  </option>
                ))}
              </select>
            </div>
          </div>
           {item.error && <p className="text-red-500 text-sm">{item.error}</p>}
        </div>
        <div className="flex-shrink-0">
          <Button
            variant="danger"
            onClick={() => onRemove(item.id)}
            className="!p-2"
            aria-label="Remove post from bulk list"
          >
            <TrashIcon className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BulkPostItemCard;