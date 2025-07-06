import React, { useState } from 'react';
import { ContentPlanItem, ContentPlanRequest } from '../types';
import Button from './ui/Button';
import ContentPlanCard from './ContentPlanCard';
import { GoogleGenAI } from '@google/genai';

interface ContentPlannerPageProps {
  aiClient: GoogleGenAI | null;
  isGenerating: boolean;
  error: string | null;
  plan: ContentPlanItem[] | null;
  onGeneratePlan: (request: ContentPlanRequest) => void;
  onStartPost: (planItem: ContentPlanItem) => void;
}

const ContentPlannerPage: React.FC<ContentPlannerPageProps> = ({ 
  aiClient,
  isGenerating,
  error,
  plan,
  onGeneratePlan,
  onStartPost
}) => {
  const [pageType, setPageType] = useState('');
  const [audience, setAudience] = useState('');
  const [goals, setGoals] = useState('');
  const [tone, setTone] = useState('ودود ومرح');
  const [formError, setFormError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageType || !audience || !goals) {
      setFormError('يرجى ملء جميع الحقول المطلوبة لوصف عملك.');
      return;
    }
    setFormError('');
    onGeneratePlan({ pageType, audience, goals, tone });
  };
  
  const aiHelperText = !aiClient ? (
    <p className="text-yellow-600 dark:text-yellow-400 text-sm mt-4">
      ميزة الذكاء الاصطناعي معطلة. افتح الإعدادات ⚙️ لإضافة مفتاح API الخاص بك لتتمكن من إنشاء خطة.
    </p>
  ) : null;

  return (
    <div className="space-y-8 fade-in">
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">المخطط الذكي للمحتوى</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          أجب عن بعض الأسئلة حول عملك، وسيقوم الذكاء الاصطناعي بإنشاء خطة محتوى إبداعية لمدة أسبوع كامل لمساعدتك على الانطلاق.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="pageType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نوع الصفحة/العمل <span className="text-red-500">*</span></label>
              <input
                id="pageType"
                type="text"
                value={pageType}
                onChange={(e) => setPageType(e.target.value)}
                placeholder="مثال: مطعم، متجر ملابس، مدرب شخصي"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="audience" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الجمهور المستهدف <span className="text-red-500">*</span></label>
              <input
                id="audience"
                type="text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="مثال: الشباب، العائلات، رواد الأعمال"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
             <div>
              <label htmlFor="tone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">النبرة المفضلة</label>
              <select
                id="tone"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-blue-500 focus:border-blue-500"
              >
                <option>ودود ومرح</option>
                <option>احترافي ورسمي</option>
                <option>تعليمي وملهم</option>
                <option>مثير للحماس والطاقة</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="goals" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الأهداف الرئيسية <span className="text-red-500">*</span></label>
            <input
              id="goals"
              type="text"
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder="مثال: زيادة المبيعات، بناء علامة تجارية، زيادة التفاعل"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
           {formError && <p className="text-red-500 text-sm">{formError}</p>}
           {aiHelperText}
          <div className="pt-2">
            <Button type="submit" size="lg" isLoading={isGenerating} disabled={!aiClient}>
              {isGenerating ? 'جاري إنشاء الخطة...' : '✨ أنشئ خطتي الأسبوعية'}
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
        <div>
          <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">خطتك الأسبوعية جاهزة!</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
