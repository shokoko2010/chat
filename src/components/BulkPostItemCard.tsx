import React from 'react';
import { BulkPostItem, Target } from '../types';
import Button from './ui/Button';
import TrashIcon from './icons/TrashIcon';
import SparklesIcon from './icons/SparklesIcon';
import PhotoIcon from './icons/PhotoIcon';
import { GoogleGenAI } from '@google/genai';
import FacebookIcon from './icons/FacebookIcon';
import InstagramIcon from './icons/InstagramIcon';

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

  const handleTargetToggle = (toggledId: string) => {
    const newTargetIds = item.targetIds.includes(toggledId)
      ? item.targetIds.filter(id => id !== toggledId)
      : [...item.targetIds, toggledId];
    onUpdate(item.id, { targetIds: newTargetIds });
  };

  return (
    <div className={`p-5 bg-white dark:bg-gray-800 rounded-lg shadow-lg border-l-4 ${item.error ? 'border-red-500' : 'border-transparent'}`}>
      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-1/4 flex-shrink-0">
          {item.imagePreview ? (
            <img src={item.imagePreview} alt="Post preview" className="rounded-lg w-full h-auto object-cover aspect-square" />
          ) : (
            <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center border border-dashed dark:border-gray-600">
                <div className="text-center text-gray-400 dark:text-gray-500">
                    <PhotoIcon className="w-12 h-12 mx-auto"/>
                    <p className="text-sm mt-2">لا توجد صورة</p>
                </div>
            </div>
          )}
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
                disabled={!aiClient || item.isGeneratingDescription || !item.imageFile}
                title={!item.imageFile ? "يجب وجود صورة لتوليد وصف" : ""}
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                الوجهات
              </label>
              <div className="space-y-3 mt-2">
                {targets.map(target => (
                    <div key={target.id} className="flex items-center">
                        <input
                            id={`target-${item.id}-${target.id}`}
                            type="checkbox"
                            checked={item.targetIds.includes(target.id)}
                            onChange={() => handleTargetToggle(target.id)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <label htmlFor={`target-${item.id}-${target.id}`} className="mr-2 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                            {target.type === 'page'
                                ? <FacebookIcon className="w-5 h-5 text-blue-600" />
                                : <InstagramIcon className="w-5 h-5" />
                            }
                            <span>{target.name}</span>
                        </label>
                    </div>
                ))}
              </div>
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
