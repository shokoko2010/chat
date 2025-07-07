
import React from 'react';
import { BulkPostItem, Target } from '../types';
import Button from './ui/Button';
import BulkPostItemCard from './BulkPostItemCard';
import { GoogleGenAI } from '@google/genai';

interface BulkSchedulerPageProps {
  bulkPosts: BulkPostItem[];
  onAddPosts: (files: FileList) => void;
  onUpdatePost: (id: string, updates: Partial<BulkPostItem>) => void;
  onRemovePost: (id: string) => void;
  onScheduleAll: () => void;
  isSchedulingAll: boolean;
  targets: Target[];
  aiClient: GoogleGenAI | null;
  onGenerateDescription: (id: string) => void;
}

const BulkSchedulerPage: React.FC<BulkSchedulerPageProps> = ({
  bulkPosts,
  onAddPosts,
  onUpdatePost,
  onRemovePost,
  onScheduleAll,
  isSchedulingAll,
  targets,
  aiClient,
  onGenerateDescription
}) => {

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddPosts(e.target.files);
      e.target.value = ''; // Reset file input
    }
  };

  return (
    <div className="space-y-8 fade-in">
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">الجدولة المجمعة للمنشورات</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          ارفع صورًا متعددة، وقم بتخصيص كل منشور، ثم قم بجدولتها جميعًا دفعة واحدة لتوفير الوقت والجهد.
        </p>
        <div className="flex items-center gap-4">
            <input
                type="file"
                id="bulkImageUpload"
                className="hidden"
                accept="image/*"
                multiple
                onChange={handleFileChange}
            />
            <Button
                size="lg"
                onClick={() => document.getElementById('bulkImageUpload')?.click()}
            >
                اختر صورًا للجدولة
            </Button>
            {bulkPosts.length > 0 && (
                 <Button
                    size="lg"
                    variant="primary"
                    onClick={onScheduleAll}
                    isLoading={isSchedulingAll}
                >
                    {isSchedulingAll ? 'جاري الجدولة...' : `جدولة كل المنشورات (${bulkPosts.length})`}
                </Button>
            )}
        </div>
      </div>

      {bulkPosts.length === 0 && (
         <div className="text-center text-gray-500 dark:text-gray-400 p-12 border-2 border-dashed rounded-lg">
            <h3 className="font-semibold text-2xl text-gray-700 dark:text-gray-300 mb-2">ابدأ بإضافة الصور</h3>
            <p className="text-lg">سيتم عرض الصور التي تختارها هنا كقائمة من المنشورات الجاهزة للجدولة.</p>
        </div>
      )}
      
      {bulkPosts.length > 0 && (
        <div className="space-y-6">
          {bulkPosts.map(post => (
            <BulkPostItemCard
              key={post.id}
              item={post}
              onUpdate={onUpdatePost}
              onRemove={onRemovePost}
              targets={targets}
              aiClient={aiClient}
              onGenerateDescription={onGenerateDescription}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default BulkSchedulerPage;
