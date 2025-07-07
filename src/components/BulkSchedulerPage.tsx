import React, { useState, useCallback } from 'react';
import { BulkPostItem, Target, WeeklyScheduleSettings } from '../types';
import Button from './ui/Button';
import BulkPostItemCard from './BulkPostItemCard';
import BulkSchedulingOptions from './BulkSchedulingOptions';
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
  schedulingStrategy: 'even' | 'weekly';
  onSchedulingStrategyChange: (strategy: 'even' | 'weekly') => void;
  weeklyScheduleSettings: WeeklyScheduleSettings;
  onWeeklyScheduleSettingsChange: (settings: WeeklyScheduleSettings) => void;
  onReschedule: () => void;
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
  onGenerateDescription,
  schedulingStrategy,
  onSchedulingStrategyChange,
  weeklyScheduleSettings,
  onWeeklyScheduleSettingsChange,
  onReschedule
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddPosts(e.target.files);
      e.target.value = ''; // Reset file input
    }
  };

  const handleDragEvents = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = (e: React.DragEvent) => {
    handleDragEvents(e);
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    handleDragEvents(e);
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    handleDragEvents(e);
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAddPosts(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-8 fade-in">
      <div 
        className={`p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg border-2 border-dashed ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-gray-700/50' : 'border-gray-300 dark:border-gray-600'} transition-all duration-300`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragEvents}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">الجدولة المجمعة للمنشورات</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          اسحب وأفلت صورًا متعددة هنا، أو اخترها يدويًا. سيقوم النظام بجدولتها بذكاء على مدار الشهر القادم.
        </p>
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
      </div>

      {bulkPosts.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3 space-y-6">
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
          <div className="xl:col-span-1">
            <div className="sticky top-24 space-y-6">
              <BulkSchedulingOptions
                strategy={schedulingStrategy}
                onStrategyChange={onSchedulingStrategyChange}
                settings={weeklyScheduleSettings}
                onSettingsChange={onWeeklyScheduleSettingsChange}
                onReschedule={onReschedule}
              />
              <Button
                size="lg"
                variant="primary"
                onClick={onScheduleAll}
                isLoading={isSchedulingAll}
                className="w-full"
              >
                {isSchedulingAll ? 'جاري الجدولة...' : `جدولة كل المنشورات (${bulkPosts.length})`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkSchedulerPage;