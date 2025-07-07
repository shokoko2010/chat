

import React, { useState, useCallback } from 'react';
import { ContentPlanItem, StrategyRequest, PageProfile } from '../types';
import Button from './ui/Button';
import ContentPlanCard from './ContentPlanCard';
import { GoogleGenAI } from '@google/genai';
import BrainCircuitIcon from './icons/BrainCircuitIcon';
import PhotoIcon from './icons/PhotoIcon';
import CalendarCheckIcon from './icons/CalendarCheckIcon';

interface ContentPlannerPageProps {
  aiClient: GoogleGenAI | null;
  isGenerating: boolean;
  error: string | null;
  plan: ContentPlanItem[] | null;
  onGeneratePlan: (request: StrategyRequest, images?: File[]) => void;
  onStartPost: (planItem: ContentPlanItem) => void;
  pageProfile: PageProfile;
  onProfileChange: (newProfile: PageProfile) => void;
}

const StrategyButton: React.FC<{label: string, icon: React.ReactNode, active: boolean, onClick: () => void}> = ({ label, icon, active, onClick }) => (
    <button type="button" onClick={onClick} className={`w-full p-3 rounded-lg text-sm font-semibold transition-all duration-300 flex flex-col items-center justify-center gap-2 border-2 ${active ? 'bg-white dark:bg-gray-900 shadow-lg text-blue-600 border-blue-500' : 'text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 border-transparent hover:border-blue-300'}`}>
      {icon}
      <span>{label}</span>
    </button>
);

const StepIndicator: React.FC<{step: number, title: string, active: boolean}> = ({step, title, active}) => (
    <div className="flex items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors ${active ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
            {step}
        </div>
        <span className={`mr-3 font-semibold ${active ? 'text-gray-800 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>{title}</span>
    </div>
);


const ContentPlannerPage: React.FC<ContentPlannerPageProps> = ({ 
  aiClient,
  isGenerating,
  error,
  plan,
  onGeneratePlan,
  onStartPost,
  pageProfile,
  onProfileChange
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  
  const [strategyType, setStrategyType] = useState<StrategyRequest['type']>('standard');
  const [planDuration, setPlanDuration] = useState<StrategyRequest['duration']>('weekly');
  
  // Common fields
  const [audience, setAudience] = useState('');
  const [goals, setGoals] = useState('');
  const [tone, setTone] = useState('ودود ومرح');

  // Strategy-specific fields
  const [pillars, setPillars] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [campaignObjective, setCampaignObjective] = useState('');
  const [occasion, setOccasion] = useState('اليوم الوطني السعودي');
  const [pillarTopic, setPillarTopic] = useState('');
  const [planImages, setPlanImages] = useState<File[]>([]);
  const [planImagePreviews, setPlanImagePreviews] = useState<string[]>([]);
  
  const [isDragging, setIsDragging] = useState(false);
  const [formError, setFormError] = useState('');

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onProfileChange({
      ...pageProfile,
      [e.target.name]: e.target.value,
    });
  };

  const handleGeneratePlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!audience || !goals) {
      setFormError('يرجى ملء حقلي الجمهور المستهدف والأهداف.');
      return;
    }
    if (strategyType === 'images' && planImages.length === 0) {
      setFormError('يرجى رفع صورة واحدة على الأقل لهذه الاستراتيجية.');
      return;
    }
    setFormError('');

    let request: StrategyRequest;
    const baseRequest = { duration: planDuration, audience, goals, tone };

    switch (strategyType) {
      case 'standard': request = { ...baseRequest, type: 'standard', pillars }; break;
      case 'campaign': request = { ...baseRequest, type: 'campaign', campaignName, campaignObjective }; break;
      case 'occasion': request = { ...baseRequest, type: 'occasion', occasion }; break;
      case 'pillar': request = { ...baseRequest, type: 'pillar', pillarTopic }; break;
      case 'images': request = { ...baseRequest, type: 'images' }; break;
      default: return;
    }

    onGeneratePlan(request, planImages);
  };
  
  const handleFileChange = (files: FileList | null) => {
    if (files) {
      const fileArray = Array.from(files);
      setPlanImages(prev => [...prev, ...fileArray]);
      const previewUrls = fileArray.map(file => URL.createObjectURL(file));
      setPlanImagePreviews(prev => [...prev, ...previewUrls]);
    }
  };
  
  const handleDragEvents = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDragEnter = (e: React.DragEvent) => { handleDragEvents(e); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { handleDragEvents(e); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    handleDragEvents(e);
    setIsDragging(false);
    if (e.dataTransfer.files) handleFileChange(e.dataTransfer.files);
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

  const occasions = [
    'اليوم الوطني السعودي', 'يوم التأسيس السعودي', 'شهر رمضان', 'عيد الفطر', 'عيد الأضحى', 
    'العودة للمدارس', 'الجمعة البيضاء / Black Friday', 'اليوم العالمي للمرأة', 'يوم الحب / Valentine\'s Day',
    'حملة صيفية عامة', 'حملة شتوية عامة'
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: // Page Profile
        return (
          <div className="space-y-6 fade-in">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">تحديث ملف الصفحة</h3>
              <p className="text-gray-600 dark:text-gray-400">هذه البيانات هي "دماغ" الذكاء الاصطناعي. كلما كانت أكثر دقة، كانت الاستراتيجيات أفضل. يتم حفظها تلقائيًا.</p>
              <div><label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">وصف العمل / من نحن؟</label><textarea id="description" name="description" value={pageProfile.description} onChange={handleProfileChange} rows={3} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700" placeholder="صف بإيجاز ما تقدمه شركتك." /></div>
              <div><label htmlFor="services" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">المنتجات والخدمات الرئيسية</label><textarea id="services" name="services" value={pageProfile.services} onChange={handleProfileChange} rows={3} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700" placeholder="قائمة بالمنتجات أو الخدمات، افصل بينها بفاصلة." /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label htmlFor="contactInfo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">معلومات الاتصال</label><input type="text" id="contactInfo" name="contactInfo" value={pageProfile.contactInfo} onChange={handleProfileChange} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700" placeholder="هاتف، بريد، عنوان..." /></div><div><label htmlFor="website" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الموقع الإلكتروني</label><input type="url" id="website" name="website" value={pageProfile.website} onChange={handleProfileChange} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700" placeholder="https://example.com" /></div></div>
              <div><label htmlFor="currentOffers" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">عروض خاصة أو كلمات مفتاحية</label><input type="text" id="currentOffers" name="currentOffers" value={pageProfile.currentOffers} onChange={handleProfileChange} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700" placeholder="مثال: خصم 20%، #حملة_الصيف" /></div>
          </div>
        );
      case 2: // Choose Strategy
        return (
          <div className="space-y-4 fade-in">
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">اختر نوع الاستراتيجية</h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  <StrategyButton label="خطة قياسية" icon={<BrainCircuitIcon className="w-8 h-8" />} active={strategyType === 'standard'} onClick={() => setStrategyType('standard')} />
                  <StrategyButton label="حملة تسويقية" icon={<CalendarCheckIcon className="w-8 h-8" />} active={strategyType === 'campaign'} onClick={() => setStrategyType('campaign')} />
                  <StrategyButton label="حملة لمناسبة" icon={<CalendarCheckIcon className="w-8 h-8 text-green-500" />} active={strategyType === 'occasion'} onClick={() => setStrategyType('occasion')} />
                  <StrategyButton label="محتوى محوري" icon={<BrainCircuitIcon className="w-8 h-8" />} active={strategyType === 'pillar'} onClick={() => setStrategyType('pillar')} />
                  <StrategyButton label="بناءً على صور" icon={<PhotoIcon className="w-8 h-8" />} active={strategyType === 'images'} onClick={() => setStrategyType('images')} />
              </div>
          </div>
        );
      case 3: // Configure Strategy
        return (
          <div className="space-y-6 fade-in">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">تخصيص الاستراتيجية</h3>
            {/* Strategy-specific fields */}
            {strategyType === 'standard' && <div className="fade-in"><label htmlFor="pillars" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">أعمدة المحتوى (اختياري)</label><input id="pillars" type="text" value={pillars} onChange={(e) => setPillars(e.target.value)} placeholder="مثال: نصائح، منتجات، وراء الكواليس" className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700" /></div>}
            {strategyType === 'campaign' && <div className="grid grid-cols-1 md:grid-cols-2 gap-4 fade-in"><div><label htmlFor="campaignName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اسم الحملة</label><input id="campaignName" type="text" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="مثال: حملة العودة للمدارس" className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700" /></div><div><label htmlFor="campaignObjective" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">هدف الحملة</label><input id="campaignObjective" type="text" value={campaignObjective} onChange={(e) => setCampaignObjective(e.target.value)} placeholder="مثال: بيع 100 وحدة" className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700" /></div></div>}
            {strategyType === 'occasion' && <div className="fade-in"><label htmlFor="occasion" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اختر المناسبة</label><select id="occasion" value={occasion} onChange={(e) => setOccasion(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"><option disabled>اختر مناسبة للحملة...</option>{occasions.map(o => <option key={o} value={o}>{o}</option>)}</select></div>}
            {strategyType === 'pillar' && <div className="fade-in"><label htmlFor="pillarTopic" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الموضوع المحوري الرئيسي</label><input id="pillarTopic" type="text" value={pillarTopic} onChange={(e) => setPillarTopic(e.target.value)} placeholder="مثال: الدليل الشامل للتسويق الرقمي" className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700" /></div>}
            {strategyType === 'images' && <div className="fade-in"><div onDragEnter={handleDragEnter} onDragOver={handleDragEvents} onDragLeave={handleDragLeave} onDrop={handleDrop} className={`p-6 border-2 border-dashed ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-gray-700/50' : 'border-gray-300 dark:border-gray-600'} rounded-lg text-center`}><PhotoIcon className="w-12 h-12 mx-auto text-gray-400" /><p className="mt-2 text-sm text-gray-600 dark:text-gray-400">اسحب وأفلت صورك هنا، أو<label htmlFor="plan-images-upload" className="text-blue-600 dark:text-blue-400 font-semibold cursor-pointer"> تصفح الملفات</label></p><input id="plan-images-upload" type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFileChange(e.target.files)} /></div>{planImagePreviews.length > 0 && (<div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 mt-4">{planImagePreviews.map((src, index) => (<div key={index} className="relative aspect-square"><img src={src} alt={`preview ${index}`} className="w-full h-full object-cover rounded-md"/><button onClick={() => removeImage(index)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 w-5 h-5 flex items-center justify-center text-xs">&times;</button></div>))}</div>)}</div>}
            
            {/* Common fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label htmlFor="audience" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الجمهور المستهدف <span className="text-red-500">*</span></label><input id="audience" type="text" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="مثال: الشباب، العائلات..." className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700" /></div><div><label htmlFor="goals" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الأهداف الرئيسية <span className="text-red-500">*</span></label><input id="goals" type="text" value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="مثال: زيادة المتابعين..." className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700" /></div></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label htmlFor="tone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">النبرة المفضلة</label><select id="tone" value={tone} onChange={(e) => setTone(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"><option>ودود ومرح</option><option>احترافي ورسمي</option><option>تعليمي وملهم</option><option>مثير للحماس والطاقة</option></select></div><div><label htmlFor="planDuration" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">مدة الخطة</label><select id="planDuration" value={planDuration} onChange={(e) => setPlanDuration(e.target.value as StrategyRequest['duration'])} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"><option value="weekly">أسبوعية</option><option value="monthly">شهرية</option>{strategyType !== 'occasion' && <option value="annual">سنوية (نظرة عامة)</option>}</select></div></div>
          </div>
        );
      default: return null;
    }
  }

  return (
    <div className="space-y-8 fade-in max-w-5xl mx-auto">
      <div className="p-6 sm:p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div className="text-center mb-8">
            <h2 className="text-3xl font-extrabold text-gray-800 dark:text-white mb-2">محرك استراتيجيات المحتوى</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
            حوّل أفكارك إلى خطط محتوى احترافية وشاملة في خطوات بسيطة.
            </p>
        </div>
        
        {/* Step Indicators */}
        <div className="flex justify-center items-center space-x-2 sm:space-x-4 mb-8">
            <StepIndicator step={1} title="ملف الصفحة" active={currentStep >= 1} />
            <div className="flex-grow h-px bg-gray-200 dark:bg-gray-700"></div>
            <StepIndicator step={2} title="الاستراتيجية" active={currentStep >= 2} />
            <div className="flex-grow h-px bg-gray-200 dark:bg-gray-700"></div>
            <StepIndicator step={3} title="التخصيص" active={currentStep >= 3} />
        </div>

        <form onSubmit={handleGeneratePlanSubmit} className="space-y-6">
            <div className="p-6 border border-dashed rounded-lg dark:border-gray-600 min-h-[300px]">
              {renderStepContent()}
            </div>
            
            {formError && <p className="text-red-500 text-sm text-center">{formError}</p>}
            {aiHelperText}

            <div className="pt-2 flex justify-between items-center">
                <Button type="button" variant="secondary" onClick={() => setCurrentStep(p => p - 1)} disabled={currentStep === 1}>
                    السابق
                </Button>
                {currentStep < 3 ? (
                  <Button type="button" onClick={() => setCurrentStep(p => p + 1)}>
                    التالي
                  </Button>
                ) : (
                  <Button type="submit" size="lg" isLoading={isGenerating} disabled={!aiClient || isGenerating}>
                      {isGenerating ? 'جاري إنشاء الخطة...' : `🧠 أنشئ استراتيجيتي`}
                  </Button>
                )}
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