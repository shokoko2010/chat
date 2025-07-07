

import React, { useState, useCallback } from 'react';
import { ContentPlanItem, ContentPlanRequest, PageProfile } from '../types';
import Button from './ui/Button';
import ContentPlanCard from './ContentPlanCard';
import { GoogleGenAI } from '@google/genai';
import BrainCircuitIcon from './icons/BrainCircuitIcon';
import PhotoIcon from './icons/PhotoIcon';

interface ContentPlannerPageProps {
  aiClient: GoogleGenAI | null;
  isGenerating: boolean;
  error: string | null;
  plan: ContentPlanItem[] | null;
  onGeneratePlan: (request: ContentPlanRequest, images?: File[]) => void;
  onStartPost: (planItem: ContentPlanItem) => void;
  pageProfile: PageProfile;
}

const ContentPlannerPage: React.FC<ContentPlannerPageProps> = ({ 
  aiClient,
  isGenerating,
  error,
  plan,
  onGeneratePlan,
  onStartPost,
  pageProfile
}) => {
  const [sourceType, setSourceType] = useState<ContentPlanRequest['sourceType']>('profile');
  const [planDuration, setPlanDuration] = useState<ContentPlanRequest['planDuration']>('weekly');
  
  const [audience, setAudience] = useState('');
  const [goals, setGoals] = useState('');
  const [tone, setTone] = useState('ودود ومرح');
  
  const [planImages, setPlanImages] = useState<File[]>([]);
  const [planImagePreviews, setPlanImagePreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  const [formError, setFormError] = useState('');

  const handleGeneratePlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!audience || !goals) {
      setFormError('يرجى ملء حقلي الجمهور المستهدف والأهداف الرئيسية.');
      return;
    }
    if (sourceType === 'images' && planImages.length === 0) {
      setFormError('يرجى رفع صورة واحدة على الأقل لإنشاء خطة بناءً عليها.');
      return;
    }
    setFormError('');
    onGeneratePlan({ sourceType, planDuration, audience, goals, tone }, planImages);
  };
  
  const handleFileChange = (files: FileList | null) => {
    if (files) {
      const fileArray = Array.from(files);
      setPlanImages(prev => [...prev, ...fileArray]);
      const previewUrls = fileArray.map(file => URL.createObjectURL(file));
      setPlanImagePreviews(prev => [...prev, ...previewUrls]);
    }
  };
  
  const handleDragEvents = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = (e: React.DragEvent) => { handleDragEvents(e); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { handleDragEvents(e); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    handleDragEvents(e);
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFileChange(e.dataTransfer.files);
    }
  };
  
  const removeImage = (index: number) => {
    setPlanImages(prev => prev.filter((_, i) => i !== index));
    setPlanImagePreviews(prev => prev.filter((_, i) => i !== index));
  };
  
  const aiHelperText = !aiClient ? (
    <p className="text-yellow-600 dark:text-yellow-400 text-sm mt-4 text-center">
      ميزة الذكاء الاصطناعي معطلة. افتح الإعدادات ⚙️ لإضافة مفتاح API الخاص بك.
    </p>
  ) : null;

  return (
    <div className="space-y-8 fade-in max-w-5xl mx-auto">
      <div className="p-6 sm:p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div className="text-center">
            <BrainCircuitIcon className="w-16 h-16 mx-auto text-blue-500 mb-4" />
            <h2 className="text-3xl font-extrabold text-gray-800 dark:text-white mb-2">محرك استراتيجيات المحتوى</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            حوّل أفكارك إلى خطط محتوى احترافية وشاملة، سواء كانت أسبوعية أو شهرية.
            </p>
        </div>
        
        <form onSubmit={handleGeneratePlanSubmit} className="space-y-6">
            <div className="p-4 border border-dashed rounded-lg dark:border-gray-600 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">1. اختر أساس الاستراتيجية:</label>
                <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  <button type="button" onClick={() => setSourceType('profile')} className={`w-1/2 p-2 rounded-md text-sm font-semibold transition-colors ${sourceType === 'profile' ? 'bg-white dark:bg-gray-900 shadow text-blue-600' : 'text-gray-600 dark:text-gray-300'}`}>
                    ملف الصفحة
                  </button>
                  <button type="button" onClick={() => setSourceType('images')} className={`w-1/2 p-2 rounded-md text-sm font-semibold transition-colors ${sourceType === 'images' ? 'bg-white dark:bg-gray-900 shadow text-blue-600' : 'text-gray-600 dark:text-gray-300'}`}>
                    مجموعة صور
                  </button>
                </div>
              </div>

              {sourceType === 'images' && (
                <div className="fade-in">
                  <div onDragEnter={handleDragEnter} onDragOver={handleDragEvents} onDragLeave={handleDragLeave} onDrop={handleDrop} className={`p-6 border-2 border-dashed ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-gray-700/50' : 'border-gray-300 dark:border-gray-600'} rounded-lg text-center`}>
                    <PhotoIcon className="w-12 h-12 mx-auto text-gray-400" />
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      اسحب وأفلت صورك هنا، أو
                      <label htmlFor="plan-images-upload" className="text-blue-600 dark:text-blue-400 font-semibold cursor-pointer"> تصفح الملفات</label>
                    </p>
                    <input id="plan-images-upload" type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFileChange(e.target.files)} />
                  </div>
                  {planImagePreviews.length > 0 && (
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 mt-4">
                      {planImagePreviews.map((src, index) => (
                        <div key={index} className="relative aspect-square">
                          <img src={src} alt={`preview ${index}`} className="w-full h-full object-cover rounded-md"/>
                          <button onClick={() => removeImage(index)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 w-5 h-5 flex items-center justify-center text-xs">&times;</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="p-4 border border-dashed rounded-lg dark:border-gray-600 space-y-4">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">2. حدد تفاصيل الخطة:</label>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="audience" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الجمهور المستهدف <span className="text-red-500">*</span></label>
                      <input id="audience" type="text" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="مثال: الشباب، العائلات..." className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800" />
                    </div>
                     <div>
                      <label htmlFor="goals" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الأهداف الرئيسية <span className="text-red-500">*</span></label>
                      <input id="goals" type="text" value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="مثال: زيادة المتابعين، بناء مجتمع..." className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800" />
                     </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="tone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">النبرة المفضلة</label>
                      <select id="tone" value={tone} onChange={(e) => setTone(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800">
                        <option>ودود ومرح</option>
                        <option>احترافي ورسمي</option>
                        <option>تعليمي وملهم</option>
                        <option>مثير للحماس والطاقة</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="planDuration" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">مدة الخطة</label>
                      <select id="planDuration" value={planDuration} onChange={(e) => setPlanDuration(e.target.value as ContentPlanRequest['planDuration'])} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800">
                        <option value="weekly">أسبوعية (7 أيام)</option>
                        <option value="monthly">شهرية (4 أسابيع)</option>
                      </select>
                    </div>
                </div>
            </div>
            {formError && <p className="text-red-500 text-sm text-center">{formError}</p>}
            {aiHelperText}
            <div className="pt-2 text-center">
                <Button type="submit" size="lg" isLoading={isGenerating} disabled={!aiClient || isGenerating}>
                    {isGenerating ? 'جاري إنشاء الخطة...' : `🧠 أنشئ استراتيجيتي ${planDuration === 'weekly' ? 'الأسبوعية' : 'الشهرية'}`}
                </Button>
            </div>
        </form>
      </div>
      
      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg shadow">
          <p className="font-bold">حدث خطأ</p>
          <p>{error}</p>
        </div>
      )}

      {plan && (
        <div className="max-w-7xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">خطتك جاهزة!</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {plan.map((item, index) => (
              <ContentPlanCard key={index} item={item} onStartPost={onStartPost} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentPlannerPage;