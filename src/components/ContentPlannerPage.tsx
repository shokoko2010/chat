
import React, { useState, useCallback } from 'react';
import { ContentPlanItem, StrategyRequest, PageProfile, StrategyHistoryItem } from '../types';
import Button from './ui/Button';
import ContentPlanCard from './ContentPlanCard';
import { GoogleGenAI } from '@google/genai';
import BrainCircuitIcon from './icons/BrainCircuitIcon';
import PhotoIcon from './icons/PhotoIcon';
import CalendarCheckIcon from './icons/CalendarCheckIcon';
import CalendarPlusIcon from './icons/CalendarPlusIcon';
import StrategyHistoryModal from './StrategyHistoryModal';
import ClockHistoryIcon from './icons/ClockHistoryIcon';
import InformationCircleIcon from './icons/InformationCircleIcon';
import ArrowDownTrayIcon from './icons/ArrowDownTrayIcon';

interface ContentPlannerPageProps {
  aiClient: GoogleGenAI | null;
  isGenerating: boolean;
  error: string | null;
  plan: ContentPlanItem[] | null;
  onGeneratePlan: (request: StrategyRequest, images?: File[]) => void;
  isSchedulingStrategy: boolean;
  onScheduleStrategy: () => Promise<void>;
  onStartPost: (planItem: ContentPlanItem) => void;
  pageProfile: PageProfile;
  strategyHistory: StrategyHistoryItem[];
  onLoadFromHistory: (plan: ContentPlanItem[]) => void;
  onDeleteFromHistory: (id: string) => void;
}

const StrategyButton: React.FC<{label: string, icon: React.ReactNode, active: boolean, onClick: () => void}> = ({ label, icon, active, onClick }) => (
    <button type="button" onClick={onClick} className={`w-full p-3 rounded-lg text-sm font-semibold transition-all duration-300 flex flex-col items-center justify-center gap-2 border-2 ${active ? 'bg-white dark:bg-gray-900 shadow-lg text-blue-600 border-blue-500' : 'text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 border-transparent hover:border-blue-300'}`}>
      {icon}
      <span>{label}</span>
    </button>
);


const ContentPlannerPage: React.FC<ContentPlannerPageProps> = ({ 
  aiClient,
  isGenerating,
  error,
  plan,
  onGeneratePlan,
  isSchedulingStrategy,
  onScheduleStrategy,
  onStartPost,
  pageProfile,
  strategyHistory,
  onLoadFromHistory,
  onDeleteFromHistory,
}) => {
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
  const [monthlyPostCount, setMonthlyPostCount] = useState<8 | 12 | 16 | 30>(12);

  
  const [isDragging, setIsDragging] = useState(false);
  const [formError, setFormError] = useState('');
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const isProfileEmpty = !pageProfile.description && !pageProfile.services;


  const handleGeneratePlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiClient) {
      setFormError("مفتاح Gemini API غير مكوّن. يرجى إضافته في الإعدادات لتفعيل هذه الميزة.");
      return;
    }
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
    const baseRequest: any = { duration: planDuration, audience, goals, tone };
    
    if (planDuration === 'monthly') {
        baseRequest.postCount = monthlyPostCount;
    }

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
      ميزات الذكاء الاصطناعي معطلة. يرجى إدخال مفتاح Gemini API في الإعدادات لتفعيلها.
    </p>
  ) : null;

  const occasions = [
    'اليوم الوطني السعودي', 'يوم التأسيس السعودي', 'شهر رمضان', 'عيد الفطر', 'عيد الأضحى', 
    'العودة للمدارس', 'الجمعة البيضاء / Black Friday', 'اليوم العالمي للمرأة', 'يوم الحب / Valentine\'s Day',
    'حملة صيفية عامة', 'حملة شتوية عامة'
  ];

  const handleLoadAndClose = (plan: ContentPlanItem[]) => {
      onLoadFromHistory(plan);
      setIsHistoryModalOpen(false);
  };

  const handleDownloadExcel = () => {
    if (!plan || plan.length === 0) return;

    const escapeCSV = (field: string) => `"${field.replace(/"/g, '""')}"`;

    const csvHeaders = ['اليوم', 'الموضوع', 'اقتراح المنشور', 'نوع المحتوى', 'دعوة للعمل'];
    
    const rows = plan.map(item =>
      [
        escapeCSV(item.day),
        escapeCSV(item.theme),
        escapeCSV(item.postSuggestion),
        escapeCSV(item.contentType),
        escapeCSV(item.cta)
      ].join(',')
    );

    const csvContent = [csvHeaders.join(','), ...rows].join('\n');
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'content-strategy.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <>
    <div className="space-y-8 fade-in max-w-5xl mx-auto">
      <div className="p-6 sm:p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div className="text-center mb-4">
            <h2 className="text-3xl font-extrabold text-gray-800 dark:text-white mb-2">محرك استراتيجيات المحتوى</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
            حوّل أفكارك إلى خطط محتوى احترافية وشاملة في خطوات بسيطة.
            </p>
        </div>
         <div className="text-center mb-8">
            <Button variant="secondary" onClick={() => setIsHistoryModalOpen(true)} disabled={strategyHistory.length === 0}>
                <ClockHistoryIcon className="w-5 h-5 ml-2" />
                عرض سجل الاستراتيجيات ({strategyHistory.length})
            </Button>
        </div>
        
        {isProfileEmpty && (
            <div className="p-4 mb-6 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-lg flex items-start gap-3">
                <InformationCircleIcon className="w-6 h-6 flex-shrink-0 mt-0.5" />
                <div>
                    <h4 className="font-bold">ملف صفحتك فارغ!</h4>
                    <p>للحصول على أفضل استراتيجيات محتوى، نوصي بشدة بالذهاب إلى قسم <strong>"ملف الصفحة"</strong> وتعبئة بياناتك أولاً.</p>
                </div>
            </div>
        )}

        <form onSubmit={handleGeneratePlanSubmit} className="space-y-6">
            <div className="space-y-4 fade-in">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">1. اختر نوع الاستراتيجية</h3>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <StrategyButton label="خطة قياسية" icon={<BrainCircuitIcon className="w-8 h-8" />} active={strategyType === 'standard'} onClick={() => setStrategyType('standard')} />
                    <StrategyButton label="حملة تسويقية" icon={<CalendarCheckIcon className="w-8 h-8" />} active={strategyType === 'campaign'} onClick={() => setStrategyType('campaign')} />
                    <StrategyButton label="حملة لمناسبة" icon={<CalendarCheckIcon className="w-8 h-8 text-green-500" />} active={strategyType === 'occasion'} onClick={() => setStrategyType('occasion')} />
                    <StrategyButton label="محتوى محوري" icon={<BrainCircuitIcon className="w-8 h-8" />} active={strategyType === 'pillar'} onClick={() => setStrategyType('pillar')} />
                    <StrategyButton label="بناءً على صور" icon={<PhotoIcon className="w-8 h-8" />} active={strategyType === 'images'} onClick={() => setStrategyType('images')} />
                </div>
            </div>
            
            <div className="space-y-6 fade-in border-t dark:border-gray-700 pt-6">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">2. خصص الاستراتيجية</h3>
                {/* Strategy-specific fields */}
                {strategyType === 'standard' && <div className="fade-in"><label htmlFor="pillars" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">أعمدة المحتوى (اختياري)</label><input id="pillars" type="text" value={pillars} onChange={(e) => setPillars(e.target.value)} placeholder="مثال: نصائح، منتجات، وراء الكواليس" className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700" /></div>}
                {strategyType === 'campaign' && <div className="grid grid-cols-1 md:grid-cols-2 gap-4 fade-in"><div><label htmlFor="campaignName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اسم الحملة</label><input id="campaignName" type="text" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="مثال: حملة العودة للمدارس" className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700" /></div><div><label htmlFor="campaignObjective" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">هدف الحملة</label><input id="campaignObjective" type="text" value={campaignObjective} onChange={(e) => setCampaignObjective(e.target.value)} placeholder="مثال: بيع 100 وحدة" className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700" /></div></div>}
                {strategyType === 'occasion' && <div className="fade-in"><label htmlFor="occasion" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اختر المناسبة</label><select id="occasion" value={occasion} onChange={(e) => setOccasion(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"><option disabled>اختر مناسبة للحملة...</option>{occasions.map(o => <option key={o} value={o}>{o}</option>)}</select></div>}
                {strategyType === 'pillar' && <div className="fade-in"><label htmlFor="pillarTopic" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الموضوع المحوري الرئيسي</label><input id="pillarTopic" type="text" value={pillarTopic} onChange={(e) => setPillarTopic(e.target.value)} placeholder="مثال: الدليل الشامل للتسويق الرقمي" className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700" /></div>}
                {strategyType === 'images' && <div className="fade-in"><div onDragEnter={handleDragEnter} onDragOver={handleDragEvents} onDragLeave={handleDragLeave} onDrop={handleDrop} className={`p-6 border-2 border-dashed ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-gray-700/50' : 'border-gray-300 dark:border-gray-600'} rounded-lg text-center`}><PhotoIcon className="w-12 h-12 mx-auto text-gray-400" /><p className="mt-2 text-sm text-gray-600 dark:text-gray-400">اسحب وأفلت صورك هنا، أو<label htmlFor="plan-images-upload" className="text-blue-600 dark:text-blue-400 font-semibold cursor-pointer"> تصفح الملفات</label></p><input id="plan-images-upload" type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFileChange(e.target.files)} /></div>{planImagePreviews.length > 0 && (<div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 mt-4">{planImagePreviews.map((src, index) => (<div key={index} className="relative aspect-square"><img src={src} alt={`preview ${index}`} className="w-full h-full object-cover rounded-md"/><button onClick={() => removeImage(index)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 w-5 h-5 flex items-center justify-center text-xs">&times;</button></div>))}</div>)}</div>}
                
                {/* Common fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label htmlFor="audience" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الجمهور المستهدف <span className="text-red-500">*</span></label><input id="audience" type="text" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="مثال: الشباب، العائلات..." className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700" /></div><div><label htmlFor="goals" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الأهداف الرئيسية <span className="text-red-500">*</span></label><input id="goals" type="text" value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="مثال: زيادة المتابعين..." className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700" /></div></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label htmlFor="tone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">النبرة المفضلة</label><select id="tone" value={tone} onChange={(e) => setTone(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"><option>ودود ومرح</option><option>احترافي ورسمي</option><option>تعليمي وملهم</option><option>مثير للحماس والطاقة</option></select></div><div><label htmlFor="planDuration" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">مدة الخطة</label><select id="planDuration" value={planDuration} onChange={(e) => setPlanDuration(e.target.value as StrategyRequest['duration'])} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"><option value="weekly">أسبوعية</option><option value="monthly">شهرية</option>{strategyType !== 'occasion' && <option value="annual">سنوية (نظرة عامة)</option>}</select></div></div>
                {planDuration === 'monthly' && (
                    <div className="fade-in">
                        <label htmlFor="monthlyPostCount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">كثافة المحتوى (عدد المنشورات)</label>
                        <select id="monthlyPostCount" value={monthlyPostCount} onChange={(e) => setMonthlyPostCount(Number(e.target.value) as 8|12|16|30)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700">
                            <option value={8}>8 منشورات (قليل)</option>
                            <option value={12}>12 منشورًا (متوسط)</option>
                            <option value={16}>16 منشورًا (مكثف)</option>
                            <option value={30}>30 منشورًا (يومي تقريبًا)</option>
                        </select>
                    </div>
                )}
            </div>
            
            {formError && <p className="text-red-500 text-sm text-center">{formError}</p>}
            {aiHelperText}

            <div className="pt-6 flex justify-center items-center">
                <Button type="submit" size="lg" isLoading={isGenerating} disabled={!aiClient || isGenerating}>
                    {isGenerating ? 'جاري إنشاء الخطة...' : `🧠 أنشئ استراتيجيتي`}
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
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white">خطتك جاهزة!</h3>
            <p className="text-gray-600 dark:text-gray-400">يمكنك البدء بإنشاء المنشورات، أو تحويل الاستراتيجية الكاملة إلى جدول مجمع للمراجعة النهائية.</p>
          </div>
           <div className="flex justify-center flex-wrap gap-4">
                <Button
                    size="lg"
                    onClick={onScheduleStrategy}
                    isLoading={isSchedulingStrategy}
                    disabled={isSchedulingStrategy || !aiClient}
                    className="bg-green-600 hover:bg-green-700 focus:ring-green-500"
                >
                    <CalendarPlusIcon className="w-6 h-6 ml-2" />
                    {isSchedulingStrategy ? 'جاري العمل...' : 'تحويل الخطة إلى جدول مجمع'}
                </Button>
                <Button
                  size="lg"
                  onClick={handleDownloadExcel}
                  variant="secondary"
                  disabled={!plan || plan.length === 0}
                >
                  <ArrowDownTrayIcon className="w-6 h-6 ml-2" />
                  تحميل كملف Excel
                </Button>
           </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {plan.map((item, index) => (
              <ContentPlanCard key={index} item={item} onStartPost={onStartPost} />
            ))}
          </div>
        </div>
      )}
    </div>
    <StrategyHistoryModal 
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        history={strategyHistory}
        onLoad={handleLoadAndClose}
        onDelete={onDeleteFromHistory}
    />
    </>
  );
};

export default ContentPlannerPage;