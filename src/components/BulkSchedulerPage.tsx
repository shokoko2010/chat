import React, { useState, useCallback } from 'react';
import { BulkPostItem, Target, WeeklyScheduleSettings } from '../types';
import Button from './ui/Button';
import BulkPostItemCard from './BulkPostItemCard';
import BulkSchedulingOptions from './BulkSchedulingOptions';
import { GoogleGenAI } from '@google/genai';
import { CanvaButton } from '@canva/button';
import CanvaIcon from './icons/CanvaIcon';

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
  onGeneratePostFromText: (id: string) => void;
  schedulingStrategy: 'even' | 'weekly';
  onSchedulingStrategyChange: (strategy: 'even' | 'weekly') => void;
  weeklyScheduleSettings: WeeklyScheduleSettings;
  onWeeklyScheduleSettingsChange: (settings: WeeklyScheduleSettings) => void;
  onReschedule: () => void;
  canvaApiKey: string | null;
  onAddCanvaDesigns: (files: File[]) => void;
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
  onGeneratePostFromText,
  schedulingStrategy,
  onSchedulingStrategyChange,
  weeklyScheduleSettings,
  onWeeklyScheduleSettingsChange,
  onReschedule,
  canvaApiKey,
  onAddCanvaDesigns,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isImportingFromCanva, setIsImportingFromCanva] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddPosts(e.target.files);
      e.target.value = ''; // Reset file input
    }
  };

  const handleCanvaBulkPublish = async (result: any) => {
    let designs: { exportUrl: string }[] = [];

    if ('designs' in result && Array.isArray(result.designs)) {
      designs = result.designs;
    } else if ('exportUrl' in result && typeof result.exportUrl === 'string') {
      designs = [{ exportUrl: result.exportUrl }]; // Handle single design case
    }
    
    if (designs.length === 0) return;
    
    setIsImportingFromCanva(true);
    try {
        const files = await Promise.all(
            designs.map(async (design, index) => {
                const response = await fetch(design.exportUrl);
                if (!response.ok) throw new Error(`فشل جلب التصميم رقم ${index + 1}`);
                const blob = await response.blob();
                return new File([blob], `canva-design-${Date.now()}-${index}.jpeg`, { type: 'image/jpeg' });
            })
        );
        onAddCanvaDesigns(files);
    } catch (error) {
        console.error("Error importing from Canva:", error);
        alert(`حدث خطأ أثناء استيراد التصاميم من Canva: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        setIsImportingFromCanva(false);
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
          اسحب وأفلت صورًا متعددة هنا، أو اخترها يدويًا. يمكنك أيضًا استيراد مجموعة من التصاميم مباشرة من Canva.
        </p>
        <input
          type="file"
          id="bulkImageUpload"
          className="hidden"
          accept="image/*"
          multiple
          onChange={handleFileChange}
        />
        <div className="flex flex-wrap gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => document.getElementById('bulkImageUpload')?.click()}
              disabled={isImportingFromCanva}
            >
              اختر صورًا للجدولة
            </Button>
            {canvaApiKey ? (
              <CanvaButton
                apiKey={canvaApiKey}
                designType={'SocialMedia'}
                onPublish={handleCanvaBulkPublish}
              >
                {({ launch, isLoading: isCanvaLoading }) => (
                    <Button
                        size="lg"
                        variant="secondary"
                        onClick={launch}
                        isLoading={isCanvaLoading || isImportingFromCanva}
                        className="bg-[#00c4cc] hover:bg-[#00a2aa] text-white"
                    >
                        <CanvaIcon className="w-5 h-5 ml-2" />
                        استيراد مجموعة من Canva
                    </Button>
                )}
              </CanvaButton>
            ) : (
                <Button size="lg" variant="secondary" disabled title="أضف مفتاح Canva API في الإعدادات" className="bg-[#00c4cc] hover:bg-[#00a2aa] text-white">
                    <CanvaIcon className="w-5 h-5 ml-2" />
                    استيراد مجموعة من Canva
                </Button>
            )}
        </div>
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
                onGeneratePostFromText={onGeneratePostFromText}
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