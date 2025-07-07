

import React, { useState } from 'react';
import { ContentPlanItem, ContentPlanRequest, Target } from '../types';
import Button from './ui/Button';
import ContentPlanCard from './ContentPlanCard';
import { GoogleGenAI } from '@google/genai';
import { analyzePageForContentPlan } from '../services/geminiService';
import SparklesIcon from './icons/SparklesIcon';

interface ContentPlannerPageProps {
  aiClient: GoogleGenAI | null;
  isGenerating: boolean;
  error: string | null;
  plan: ContentPlanItem[] | null;
  onGeneratePlan: (request: ContentPlanRequest) => void;
  onStartPost: (planItem: ContentPlanItem) => void;
  targets: Target[];
}

const ContentPlannerPage: React.FC<ContentPlannerPageProps> = ({ 
  aiClient,
  isGenerating,
  error,
  plan,
  onGeneratePlan,
  onStartPost,
  targets
}) => {
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');

  // State for the form fields
  const [planType, setPlanType] = useState<ContentPlanRequest['planType']>('engagement');
  const [audience, setAudience] = useState('');
  const [goals, setGoals] = useState('');
  const [tone, setTone] = useState('ودود ومرح');
  const [productInfo, setProductInfo] = useState('');
  const [formError, setFormError] = useState('');

  const handleAnalyze = async () => {
    if (!aiClient || !selectedTargetId) return;

    const target = targets.find(t => t.id === selectedTargetId);
    if (!target) return;

    setAnalysisError('');
    setIsAnalyzing(true);
    setFormError('');
    try {
        const analysis = await analyzePageForContentPlan(aiClient, target.name, target.type);
        setAudience(analysis.audience || '');
        setGoals(analysis.goals || '');
        const validTones = ["ودود ومرح", "احترافي ورسمي", "تعليمي وملهم", "مثير للحماس والطاقة"];
        setTone(validTones.includes(analysis.tone || '') ? analysis.tone! : 'ودود ومرح');
    } catch (e: any) {
        setAnalysisError(e.message);
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleGeneratePlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!audience || !goals) {
      setFormError('يرجى ملء حقلي الجمهور المستهدف والأهداف الرئيسية.');
      return;
    }
    setFormError('');
    onGeneratePlan({ planType, audience, goals, tone, productInfo });
  };
  
  const aiHelperText = !aiClient ? (
    <p className="text-yellow-600 dark:text-yellow-400 text-sm mt-4 text-center">
      ميزة الذكاء الاصطناعي معطلة. افتح الإعدادات ⚙️ لإضافة مفتاح API الخاص بك.
    </p>
  ) : null;

  return (
    <div className="space-y-8 fade-in max-w-5xl mx-auto">
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">المخطط الذكي للمحتوى</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          دع الذكاء الاصطناعي يقترح استراتيجية محتوى، ثم قم بإنشاء خطة أسبوعية كاملة بناءً عليها.
        </p>
        
        <div className="p-4 border border-dashed rounded-lg dark:border-gray-600 space-y-3 mb-6">
          <h3 className="font-bold text-lg text-gray-800 dark:text-white">الخطوة 1: تحليل أولي (اختياري)</h3>
           <p className="text-sm text-gray-500 dark:text-gray-400">
            يمكن للذكاء الاصطناعي تحليل اسم صفحتك لاقتراح جمهور وأهداف. يمكنك تعديلها في الخطوة التالية.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 items-end">
            <div className="flex-grow">
               <label htmlFor="target-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اختر صفحة لتحليلها</label>
                <select
                    id="target-select"
                    value={selectedTargetId}
                    onChange={e => setSelectedTargetId(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="" disabled>-- اختر صفحة أو مجموعة --</option>
                    {targets.map(target => (
                        <option key={target.id} value={target.id}>
                            {target.name}
                        </option>
                    ))}
                </select>
            </div>
            <Button
                onClick={handleAnalyze}
                isLoading={isAnalyzing}
                disabled={!aiClient || !selectedTargetId || isAnalyzing}
                className="w-full sm:w-auto"
            >
                <SparklesIcon className="w-5 h-5 ml-2"/>
                {isAnalyzing ? 'جاري التحليل...' : 'املأ الحقول تلقائياً'}
            </Button>
          </div>
           {analysisError && <p className="text-red-500 text-sm mt-2">{analysisError}</p>}
        </div>

        <form onSubmit={handleGeneratePlanSubmit} className="space-y-4">
            <h3 className="font-bold text-lg text-gray-800 dark:text-white">الخطوة 2: حدد تفاصيل الخطة</h3>
             <div>
                <label htmlFor="planType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نوع الخطة المطلوبة</label>
                <select id="planType" value={planType} onChange={(e) => setPlanType(e.target.value as ContentPlanRequest['planType'])} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800">
                    <option value="engagement">خطة تفاعل ومشاركة</option>
                    <option value="product_launch">خطة إطلاق منتج</option>
                    <option value="promotion">خطة عروض ترويجية</option>
                </select>
            </div>
            {(planType === 'product_launch' || planType === 'promotion') && (
                <div className="fade-in">
                    <label htmlFor="productInfo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {planType === 'product_launch' ? 'معلومات المنتج/الخدمة' : 'تفاصيل العرض الترويجي'}
                    </label>
                    <textarea id="productInfo" value={productInfo} onChange={(e) => setProductInfo(e.target.value)} placeholder="مثال: هاتف جديد بمواصفات كذا، خصم 20% على كل شيء..." className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 h-24"></textarea>
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="audience" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الجمهور المستهدف <span className="text-red-500">*</span></label>
                  <input id="audience" type="text" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="مثال: الشباب، العائلات..." className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800" />
                </div>
                 <div>
                  <label htmlFor="tone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">النبرة المفضلة</label>
                  <select id="tone" value={tone} onChange={(e) => setTone(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800">
                    <option>ودود ومرح</option>
                    <option>احترافي ورسمي</option>
                    <option>تعليمي وملهم</option>
                    <option>مثير للحماس والطاقة</option>
                  </select>
                </div>
            </div>
             <div>
                <label htmlFor="goals" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الأهداف الثانوية (اختياري)</label>
                <input id="goals" type="text" value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="مثال: زيادة المتابعين، بناء مجتمع..." className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800" />
             </div>
            {formError && <p className="text-red-500 text-sm">{formError}</p>}
            {aiHelperText}
            <div className="pt-2">
                <Button type="submit" size="lg" isLoading={isGenerating} disabled={!aiClient || !audience || isGenerating}>
                    {isGenerating ? 'جاري إنشاء الخطة...' : '🧠 أنشئ خطتي الأسبوعية'}
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
          <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">خطتك الأسبوعية جاهزة!</h3>
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