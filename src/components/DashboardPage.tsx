import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Target, PublishedPost, Draft, ScheduledPost, BulkPostItem, ContentPlanItem, StrategyRequest, WeeklyScheduleSettings, PageProfile, PerformanceSummaryData, StrategyHistoryItem } from '../types';
import Header from './Header';
import PostComposer from './PostComposer';
import PostPreview from './PostPreview';
import AnalyticsPage from './AnalyticsPage';
import DraftsList from './DraftsList';
import ContentCalendar from './ContentCalendar';
import BulkSchedulerPage from './BulkSchedulerPage';
import ContentPlannerPage from './ContentPlannerPage';
import ReminderCard from './ReminderCard';
import { GoogleGenAI } from '@google/genai';
import { generateDescriptionForImage, generateContentPlan, generatePerformanceSummary, generateOptimalSchedule, generatePostInsights } from '../services/geminiService';
import { v4 as uuidv4 } from 'uuid';


// Icons
import PencilSquareIcon from './icons/PencilSquareIcon';
import CalendarIcon from './icons/CalendarIcon';
import ArchiveBoxIcon from './icons/ArchiveBoxIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import QueueListIcon from './icons/QueueListIcon';
import BrainCircuitIcon from './icons/BrainCircuitIcon';
import UserCircleIcon from './icons/UserCircleIcon';


interface DashboardPageProps {
  managedTarget: Target;
  allTargets: Target[];
  onChangePage: () => void;
  onLogout: () => void;
  isSimulationMode: boolean;
  aiClient: GoogleGenAI | null;
  onSettingsClick: () => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ managedTarget, allTargets, onChangePage, onLogout, isSimulationMode, aiClient, onSettingsClick }) => {
  const [view, setView] = useState<'composer' | 'calendar' | 'drafts' | 'analytics' | 'bulk' | 'planner' | 'profile'>('composer');
  
  // Composer state
  const [postText, setPostText] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [composerError, setComposerError] = useState('');
  const [includeInstagram, setIncludeInstagram] = useState(false);

  // Publishing state
  const [isPublishing, setIsPublishing] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'partial', message: string} | null>(null);
  const [publishingReminderId, setPublishingReminderId] = useState<string | null>(null);
  
  // Data state, managed per target
  const [pageProfile, setPageProfile] = useState<PageProfile>({ description: '', services: '', contactInfo: '', website: '', currentOffers: '', address: '', country: '' });
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  
  // Bulk Scheduler State
  const [bulkPosts, setBulkPosts] = useState<BulkPostItem[]>([]);
  const [isSchedulingAll, setIsSchedulingAll] = useState(false);
  const [schedulingStrategy, setSchedulingStrategy] = useState<'even' | 'weekly'>('even');
  const [weeklyScheduleSettings, setWeeklyScheduleSettings] = useState<WeeklyScheduleSettings>({
    days: [1, 3, 5], // Mon, Wed, Fri
    time: '19:00',
  });

  // Content Planner State
  const [contentPlan, setContentPlan] = useState<ContentPlanItem[] | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [isSchedulingStrategy, setIsSchedulingStrategy] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [strategyHistory, setStrategyHistory] = useState<StrategyHistoryItem[]>([]);


  // Analytics State
  const [publishedPosts, setPublishedPosts] = useState<PublishedPost[]>([]);
  const [publishedPostsLoading, setPublishedPostsLoading] = useState(true);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'7d' | '30d'>('30d');
  const [performanceSummaryText, setPerformanceSummaryText] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);


  const linkedInstagramTarget = useMemo(() => {
    if (managedTarget.type !== 'page') return null;
    return allTargets.find(t => t.type === 'instagram' && t.parentPageId === managedTarget.id) || null;
  }, [managedTarget, allTargets]);

  const clearComposer = useCallback(() => {
    setPostText(''); setSelectedImage(null); setImagePreview(null);
    setScheduleDate(''); setComposerError('');
    setIsScheduled(false);
    setIncludeInstagram(!!linkedInstagramTarget);
  }, [linkedInstagramTarget]);

  const showNotification = (type: 'success' | 'error' | 'partial', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 8000);
  };
  
  const handleFetchProfile = useCallback(async () => {
    if (isSimulationMode) {
      setPageProfile({
        description: 'متجر إلكتروني متخصص في بيع الملابس العصرية للنساء والرجال. نقدم أحدث التصاميم بجودة عالية وأسعار منافسة.',
        services: 'ملابس نسائية, ملابس رجالية, اكسسوارات, أحذية',
        contactInfo: 'support@zex-pages.com',
        website: 'https://zex-pages.com',
        currentOffers: 'خصم 15% على مجموعة الصيف',
        address: 'الرياض, السعودية',
        country: 'المملكة العربية السعودية',
      });
      return;
    }
    if (!managedTarget) return;

    setIsFetchingProfile(true);
    try {
      const response: any = await new Promise(resolve => 
        window.FB.api(
          `/${managedTarget.id}?fields=about,description,products,location,contact_address,website,single_line_address,country_page_likes`,
          (res: any) => resolve(res)
        )
      );

      if (response && !response.error) {
        setPageProfile(prev => ({
          ...prev,
          description: response.about || response.description || prev.description,
          services: response.products ? response.products.map((p: any) => p.name).join(', ') : prev.services,
          contactInfo: response.contact_address || prev.contactInfo,
          website: response.website || prev.website,
          address: response.single_line_address || (response.location ? `${response.location.city}, ${response.location.country}` : prev.address),
          country: response.location?.country || prev.country
        }));
      }
    } catch(err) {
      console.error("Failed to fetch page profile", err);
    } finally {
      setIsFetchingProfile(false);
    }
  }, [managedTarget, isSimulationMode]);
  
  
    // Effect to load all data when the managed target changes
  useEffect(() => {
    if (!managedTarget) return;

    const loadData = () => {
        const savedProfile = localStorage.getItem(`profile_${managedTarget.id}`);
        if (savedProfile) {
          setPageProfile(JSON.parse(savedProfile));
        } else {
          setPageProfile({ description: '', services: '', contactInfo: '', website: '', currentOffers: '', address: '', country: '' });
          handleFetchProfile();
        }
        
        const savedDrafts = localStorage.getItem(`drafts_${managedTarget.id}`);
        setDrafts(savedDrafts ? JSON.parse(savedDrafts) : []);

        const savedScheduled = localStorage.getItem(`scheduled_${managedTarget.id}`);
        setScheduledPosts(savedScheduled ? JSON.parse(savedScheduled) : []);

        const savedBulkPosts = localStorage.getItem(`bulk_${managedTarget.id}`);
        setBulkPosts(savedBulkPosts ? JSON.parse(savedBulkPosts) : []);
        
        const savedHistory = localStorage.getItem(`history_${managedTarget.id}`);
        setStrategyHistory(savedHistory ? JSON.parse(savedHistory) : []);
        
        setPublishedPosts([]);
        setAnalyticsPeriod('30d');
        setPerformanceSummaryText('');

        clearComposer();
        setView('composer');
    };

    loadData();

  }, [managedTarget, clearComposer, handleFetchProfile]);

  // Effects to save data to local storage on change
  useEffect(() => { if (managedTarget) localStorage.setItem(`profile_${managedTarget.id}`, JSON.stringify(pageProfile));}, [pageProfile, managedTarget]);
  useEffect(() => { if (managedTarget) localStorage.setItem(`drafts_${managedTarget.id}`, JSON.stringify(drafts));}, [drafts, managedTarget]);
  useEffect(() => { if (managedTarget) localStorage.setItem(`scheduled_${managedTarget.id}`, JSON.stringify(scheduledPosts));}, [scheduledPosts, managedTarget]);
  useEffect(() => { if (managedTarget) localStorage.setItem(`bulk_${managedTarget.id}`, JSON.stringify(bulkPosts));}, [bulkPosts, managedTarget]);
  useEffect(() => { if (managedTarget) localStorage.setItem(`history_${managedTarget.id}`, JSON.stringify(strategyHistory));}, [strategyHistory, managedTarget]);


  // === COMPOSER HANDLERS ===
  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };
  
  const handleImageGenerated = (file: File) => {
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleImageRemove = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };
  
  const handleSaveDraft = () => {
    const newDraft: Draft = {
        id: uuidv4(),
        text: postText,
        imageFile: selectedImage,
        imagePreview: imagePreview,
        targetId: managedTarget.id,
        isScheduled,
        scheduleDate,
        includeInstagram
    };
    setDrafts(prev => [newDraft, ...prev]);
    clearComposer();
    showNotification('success', 'تم حفظ المسودة بنجاح.');
    setView('drafts');
  };
  
  const handlePublish = async () => { /* Complex handler, will be added below */ };


  // === LAYOUT & RENDER ===
  
  const navItems = [
    { id: 'composer', label: 'إنشاء منشور', icon: <PencilSquareIcon className="w-6 h-6"/> },
    { id: 'calendar', label: 'تقويم المحتوى', icon: <CalendarIcon className="w-6 h-6"/> },
    { id: 'drafts', label: 'المسودات', icon: <ArchiveBoxIcon className="w-6 h-6"/> },
    { id: 'analytics', label: 'تحليلات الأداء', icon: <ChartBarIcon className="w-6 h-6"/> },
    { id: 'bulk', label: 'جدولة مجمعة', icon: <QueueListIcon className="w-6 h-6"/> },
    { id: 'planner', label: 'مخطط المحتوى', icon: <BrainCircuitIcon className="w-6 h-6"/> },
    { id: 'profile', label: 'ملف الصفحة', icon: <UserCircleIcon className="w-6 h-6"/> },
  ];

  const renderView = () => {
    switch (view) {
        case 'composer':
            return (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <PostComposer
                    onPublish={() => {/*TODO: Call handlePublish */}}
                    onSaveDraft={handleSaveDraft}
                    isPublishing={isPublishing}
                    postText={postText}
                    onPostTextChange={setPostText}
                    onImageChange={handleImageChange}
                    onImageGenerated={handleImageGenerated}
                    onImageRemove={handleImageRemove}
                    imagePreview={imagePreview}
                    isScheduled={isScheduled}
                    onIsScheduledChange={setIsScheduled}
                    scheduleDate={scheduleDate}
                    onScheduleDateChange={setScheduleDate}
                    error={composerError}
                    aiClient={aiClient}
                    managedTarget={managedTarget}
                    linkedInstagramTarget={linkedInstagramTarget}
                    includeInstagram={includeInstagram}
                    onIncludeInstagramChange={setIncludeInstagram}
                    pageProfile={pageProfile}
                  />
                </div>
                <div>
                  <PostPreview 
                    type={includeInstagram ? 'instagram' : 'facebook'}
                    postText={postText}
                    imagePreview={imagePreview}
                    pageName={managedTarget.name}
                    pageAvatar={managedTarget.picture.data.url}
                  />
                </div>
              </div>
            );
        // Add other cases here...
        case 'calendar': return <ContentCalendar posts={scheduledPosts} />;
        case 'drafts': return <DraftsList drafts={drafts} onLoad={() => {}} onDelete={() => {}} />;
        case 'analytics': return <AnalyticsPage period={analyticsPeriod} onPeriodChange={setAnalyticsPeriod} summaryData={null} aiSummary={performanceSummaryText} isGeneratingSummary={isGeneratingSummary} posts={publishedPosts} isLoading={publishedPostsLoading} onFetchAnalytics={() => {}} onGenerateInsights={() => {}} />;
        case 'bulk': return <BulkSchedulerPage bulkPosts={bulkPosts} onAddPosts={() => {}} onUpdatePost={() => {}} onRemovePost={() => {}} onScheduleAll={() => {}} isSchedulingAll={isSchedulingAll} targets={allTargets} aiClient={aiClient} onGenerateDescription={() => {}} schedulingStrategy={schedulingStrategy} onSchedulingStrategyChange={setSchedulingStrategy} weeklyScheduleSettings={weeklyScheduleSettings} onWeeklyScheduleSettingsChange={setWeeklyScheduleSettings} onReschedule={()=>{}} />;
        case 'planner': return <ContentPlannerPage aiClient={aiClient} isGenerating={isGeneratingPlan} isFetchingProfile={isFetchingProfile} onFetchProfile={handleFetchProfile} error={planError} plan={contentPlan} onGeneratePlan={()=>{}} isSchedulingStrategy={isSchedulingStrategy} onScheduleStrategy={async () => {}} onStartPost={()=>{}} pageProfile={pageProfile} onProfileChange={setPageProfile} strategyHistory={strategyHistory} onLoadFromHistory={() => {}} onDeleteFromHistory={() => {}} />;
        case 'profile': return <PageProfilePage profile={pageProfile} onProfileChange={setPageProfile} />;

      default: return <div>Select a view</div>;
    }
  };

  const NavButton: React.FC<{item: typeof navItems[0]}> = ({ item }) => (
    <button
        onClick={() => setView(item.id as any)}
        className={`w-full flex items-center gap-3 p-3 rounded-md text-right font-semibold transition-colors duration-200 ${
            view === item.id 
                ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' 
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
        }`}
    >
        {item.icon}
        <span>{item.label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col">
      <Header 
        onLogout={onLogout}
        onSettingsClick={onSettingsClick}
        isSimulationMode={isSimulationMode}
        pageName={managedTarget.name}
        onChangePage={onChangePage}
      />
      
      {/* TODO: Add Reminders section */}

      <div className="flex-grow flex flex-col md:flex-row">
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-white dark:bg-gray-800 p-4 space-y-2 flex-shrink-0 border-b md:border-b-0 md:border-r dark:border-gray-700">
            <nav className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible space-x-2 md:space-x-0 md:space-y-2">
              {navItems.map(item => <NavButton key={item.id} item={item} />)}
            </nav>
        </aside>
        
        {/* Main Content */}
        <main className="flex-grow p-4 sm:p-8 overflow-y-auto">
             {notification && (
                <div className={`p-4 mb-6 rounded-lg ${notification.type === 'success' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}`}>
                    {notification.message}
                </div>
             )}
             {renderView()}
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;
