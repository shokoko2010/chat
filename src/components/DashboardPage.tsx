
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Target, PublishedPost, Draft, ScheduledPost, BulkPostItem, ContentPlanItem, StrategyRequest, WeeklyScheduleSettings, PageProfile, PerformanceSummaryData, StrategyHistoryItem, InboxItem, AutoResponderSettings, InboxMessage } from '../types';
import Header from './Header';
import PostComposer from './PostComposer';
import PostPreview from './PostPreview';
import AnalyticsPage from './AnalyticsPage';
import DraftsList from './DraftsList';
import ContentCalendar from './ContentCalendar';
import BulkSchedulerPage from './BulkSchedulerPage';
import ContentPlannerPage from './ContentPlannerPage';
import ReminderCard from './ReminderCard';
import InboxPage from './InboxPage';
import { GoogleGenAI } from '@google/genai';
import { generateDescriptionForImage, generateContentPlan, generatePerformanceSummary, generateOptimalSchedule, enhanceProfileFromFacebookData, generateSmartReplies, generatePostInsights } from '../services/geminiService';

// Icons
import PencilSquareIcon from './icons/PencilSquareIcon';
import CalendarIcon from './icons/CalendarIcon';
import ArchiveBoxIcon from './icons/ArchiveBoxIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import QueueListIcon from './icons/QueueListIcon';
import BrainCircuitIcon from './icons/BrainCircuitIcon';
import InboxArrowDownIcon from './icons/InboxArrowDownIcon';


interface DashboardPageProps {
  managedTarget: Target;
  allTargets: Target[];
  onChangePage: () => void;
  onLogout: () => void;
  isSimulationMode: boolean;
  aiClient: GoogleGenAI | null;
  fetchWithPagination: (path: string) => Promise<any[]>;
}

const NavItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    active: boolean;
    onClick: () => void;
    notificationCount?: number;
}> = ({ icon, label, active, onClick, notificationCount }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition-colors text-right ${
            active
                ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
        }`}
    >
        {icon}
        <span className="flex-grow">{label}</span>
        {notificationCount && notificationCount > 0 ? (
            <span className="bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">{notificationCount}</span>
        ) : null}
    </button>
);


const DashboardPage: React.FC<DashboardPageProps> = ({ managedTarget, allTargets, onChangePage, onLogout, isSimulationMode, aiClient, fetchWithPagination }) => {
  const [view, setView] = useState<'composer' | 'calendar' | 'drafts' | 'analytics' | 'bulk' | 'planner' | 'inbox'>('composer');
  
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
  
  // Inbox State
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [isInboxLoading, setIsInboxLoading] = useState(true);
  const [autoResponderSettings, setAutoResponderSettings] = useState<AutoResponderSettings>({
    comments: { realtimeEnabled: false, keywords: 'السعر,بكم,تفاصيل,خاص', replyOncePerUser: true, publicReplyEnabled: false, publicReplyMessage: '', privateReplyEnabled: true, privateReplyMessage: 'أهلاً بك {user_name}، تم إرسال التفاصيل على الخاص 📩' },
    messages: { realtimeEnabled: false, keywords: 'السعر,بكم,تفاصيل', replyMessage: 'أهلاً بك {user_name}، سأرسل لك كل التفاصيل حول استفسارك خلال لحظات.' }
  });
  const [autoRepliedItems, setAutoRepliedItems] = useState<Set<string>>(new Set([]));
  const [repliedUsersPerPost, setRepliedUsersPerPost] = useState<Record<string, string[]>>({});


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

  const showNotification = useCallback((type: 'success' | 'error' | 'partial', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 8000);
  }, []);
  
  const handleFetchProfile = useCallback(async () => {
    if (isSimulationMode) {
      setPageProfile({
        description: 'متجر تجريبي يقدم أفضل المنتجات الوهمية.',
        services: 'منتجات, استشارات, تطوير',
        contactInfo: '123-456-7890, sim@example.com',
        website: 'https://example.com',
        currentOffers: 'خصم 20% على كل شيء',
        address: '123 شارع المحاكاة، مدينة وهمية',
        country: 'بلد المحاكاة'
      });
      showNotification('success', 'تم استرداد بيانات الصفحة التجريبية.');
      return;
    }

    if (!window.FB) return;
    setIsFetchingProfile(true);
    setPlanError(null);

    try {
        const fields = 'about,category,location,emails,phone,website,single_line_address';
        const fbResponse: any = await new Promise(resolve => {
            window.FB.api(
                `/${managedTarget.id}`, 
                { fields, access_token: managedTarget.access_token }, 
                (res: any) => resolve(res)
            );
        });

        if (fbResponse && !fbResponse.error) {
            const rawProfileData = {
                about: fbResponse.about || '',
                category: fbResponse.category || '',
                contact: [...(fbResponse.emails || []), fbResponse.phone || ''].filter(Boolean).join(', '),
                website: fbResponse.website || '',
                address: fbResponse.single_line_address || fbResponse.location?.street || '',
                country: fbResponse.location?.country || '',
            };

            if (aiClient) {
                showNotification('success', 'تم استرداد البيانات من فيسبوك، جاري تحسينها بالذكاء الاصطناعي...');
                const enhancedProfile = await enhanceProfileFromFacebookData(aiClient, rawProfileData);
                setPageProfile(prev => ({ ...enhancedProfile, currentOffers: prev.currentOffers })); 
                showNotification('success', 'تم استرداد وتحسين بيانات الصفحة بنجاح!');
            } else {
                setPageProfile(prev => ({
                    description: rawProfileData.about,
                    services: rawProfileData.category,
                    contactInfo: rawProfileData.contact,
                    website: rawProfileData.website,
                    address: rawProfileData.address,
                    country: rawProfileData.country,
                    currentOffers: prev.currentOffers,
                }));
                showNotification('success', 'تم استرداد بيانات الصفحة بنجاح من فيسبوك.');
            }
        } else {
            throw new Error(fbResponse?.error?.message || 'فشل استرداد بيانات الصفحة.');
        }
    } catch (e: any) {
        showNotification('error', `حدث خطأ: ${e.message}`);
        setPlanError(e.message);
    } finally {
        setIsFetchingProfile(false);
    }
  }, [managedTarget.id, managedTarget.access_token, isSimulationMode, aiClient, showNotification]);


  const rescheduleBulkPosts = useCallback((postsToReschedule: BulkPostItem[], strategy: 'even' | 'weekly', weeklySettings: WeeklyScheduleSettings) => {
    if (postsToReschedule.length === 0) return [];
    
    const existingTimestamps = [
        ...scheduledPosts.map(p => new Date(p.scheduledAt).getTime()),
        ...bulkPosts.filter(p => !postsToReschedule.some(pr => pr.id === p.id)).map(p => new Date(p.scheduleDate).getTime())
    ].filter(time => !isNaN(time));

    let lastScheduledTime = existingTimestamps.length > 0 ? Math.max(...existingTimestamps) : Date.now();

    const formatDateTimeForInputValue = (date: Date) => {
        const pad = (num: number) => num.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    if (strategy === 'even') {
        const firstScheduleDate = new Date(lastScheduledTime);
        firstScheduleDate.setDate(firstScheduleDate.getDate() + 1);
        firstScheduleDate.setHours(10, 0, 0, 0);

        const schedulingPeriodMs = 28 * 24 * 60 * 60 * 1000;
        const intervalMs = postsToReschedule.length > 1 ? (schedulingPeriodMs / (postsToReschedule.length)) : 0;

        return postsToReschedule.map((post, index) => {
            const scheduleTime = firstScheduleDate.getTime() + (index * intervalMs);
            return {
                ...post,
                scheduleDate: formatDateTimeForInputValue(new Date(scheduleTime))
            };
        });
    } else { // weekly strategy
        const sortedDays = weeklySettings.days.sort((a,b) => a-b);
        if (sortedDays.length === 0) return postsToReschedule;

        let lastDate = new Date(lastScheduledTime);
        
        return postsToReschedule.map(post => {
            let nextScheduleDate = new Date(lastDate);
            nextScheduleDate.setHours(parseInt(weeklySettings.time.split(':')[0]), parseInt(weeklySettings.time.split(':')[1]), 0, 0);

            while(true) {
                const currentDay = nextScheduleDate.getDay();
                const nextDayInCycle = sortedDays.find(d => d >= currentDay);

                if (nextDayInCycle !== undefined) {
                    nextScheduleDate.setDate(nextScheduleDate.getDate() + (nextDayInCycle - currentDay));
                } else {
                    nextScheduleDate.setDate(nextScheduleDate.getDate() + (7 - currentDay + sortedDays[0]));
                }
                
                if (nextScheduleDate <= lastDate || nextScheduleDate.getTime() < Date.now() + 10 * 60 * 1000) {
                   nextScheduleDate.setDate(nextScheduleDate.getDate() + 1);
                   continue;
                }
                
                lastDate = new Date(nextScheduleDate);
                break;
            }
            
            return {
                ...post,
                scheduleDate: formatDateTimeForInputValue(lastDate)
            };
        });
    }
  }, [scheduledPosts, bulkPosts]);

  const handleReschedule = useCallback(() => {
    if (bulkPosts.length === 0) return;
    const rescheduled = rescheduleBulkPosts(bulkPosts, schedulingStrategy, weeklyScheduleSettings);
    setBulkPosts(rescheduled);
  }, [bulkPosts, schedulingStrategy, weeklyScheduleSettings, rescheduleBulkPosts]);

    const saveStateToLocalStorage = useCallback(() => {
        try {
            const dataKey = `zex-pages-data-${managedTarget.id}`;
            const dataToSave = {
                pageProfile,
                drafts,
                scheduledPosts,
                bulkPosts,
                autoResponderSettings,
                strategyHistory,
                repliedUsersPerPost,
            };
            localStorage.setItem(dataKey, JSON.stringify(dataToSave));
        } catch (error) {
            console.error("Failed to save state to localStorage:", error);
            showNotification('error', 'فشل حفظ الحالة. قد لا يتم تذكر التغييرات.');
        }
    }, [managedTarget.id, pageProfile, drafts, scheduledPosts, bulkPosts, autoResponderSettings, strategyHistory, repliedUsersPerPost, showNotification]);

    useEffect(() => {
        window.addEventListener('beforeunload', saveStateToLocalStorage);
        return () => {
            window.removeEventListener('beforeunload', saveStateToLocalStorage);
            saveStateToLocalStorage();
        };
    }, [saveStateToLocalStorage]);


    const publishToTarget = useCallback(async (
        target: Target,
        text: string,
        imageFile: File | null,
        scheduleAt: Date | null,
        isReminder: boolean = false
    ): Promise<{ success: boolean, message: string }> => {
        if (isSimulationMode) {
            console.log(`SIMULATION: Publishing to ${target.name}`, { text, image: imageFile?.name, scheduleAt });
            return { success: true, message: `تمت محاكاة النشر بنجاح إلى ${target.name}.` };
        }

        if (target.type === 'instagram' && !imageFile) {
            return { success: false, message: 'فشل النشر على انستجرام: المنشورات تتطلب صورة.' };
        }

        if (target.type === 'instagram' && !scheduleAt) {
            return { success: false, message: "فشل النشر على انستجرام: النشر الفوري غير مدعوم. يرجى جدولة هذا المنشور بدلاً من ذلك لإنشاء تذكير." };
        }

        if (isReminder) {
            // Logic for saving as a reminder is handled by adding it to scheduledPosts array, not direct publishing.
            return { success: true, message: `تم حفظ تذكير النشر على ${target.name}.`};
        }
        
        const publishEndpoint = target.type === 'page' ? `/${target.id}/photos` : `/${target.id}/feed`;
        const publishMethod = imageFile ? 'POST' : 'POST'; // It's always POST

        let apiParams: any = {};
        if (target.access_token) {
            apiParams.access_token = target.access_token;
        }

        if (imageFile) {
            const formData = new FormData();
            formData.append('source', imageFile);
            if (text) formData.append('caption', text);
            if(scheduleAt) {
                apiParams.published = false;
                apiParams.scheduled_publish_time = Math.floor(scheduleAt.getTime() / 1000);
            }

            Object.keys(apiParams).forEach(key => formData.append(key, apiParams[key]));
            apiParams = formData;

        } else { // Text-only post
            if (target.type !== 'group') { 
               apiParams.message = text;
            } else {
                 return { success: false, message: `النشر النصي فقط غير مدعوم حاليًا للمجموعات.`};
            }
             if(scheduleAt) {
                apiParams.published = false;
                apiParams.scheduled_publish_time = Math.floor(scheduleAt.getTime() / 1000);
            }
        }
        
        try {
            const response: any = await new Promise(resolve => {
                window.FB.api(publishEndpoint, publishMethod, apiParams, (res: any) => resolve(res));
            });
            if (response && response.id) {
                return { success: true, message: `تم النشر بنجاح على ${target.name}.` };
            }
            const errorMessage = response?.error?.message || `خطأ غير معروف عند النشر على ${target.name}.`;
            return { success: false, message: `فشل النشر على ${target.name}: ${errorMessage}` };
        } catch (error: any) {
            return { success: false, message: `حدث خطأ فادح عند النشر على ${target.name}: ${error.message}` };
        }

    }, [isSimulationMode]);

    const handlePublish = useCallback(async (reminderToPublish?: ScheduledPost) => {
        let textToPublish = reminderToPublish ? reminderToPublish.text : postText;
        let imageToPublish = reminderToPublish ? reminderToPublish.imageFile : selectedImage;
        let scheduleDateToUse = isScheduled ? scheduleDate : '';
        let igTarget = reminderToPublish ? allTargets.find(t => t.id === reminderToPublish.targetId) : linkedInstagramTarget;
        
        if (!textToPublish && !imageToPublish) {
            setComposerError('لا يمكن نشر منشور فارغ. أضف نصًا أو صورة.');
            return;
        }

        if (includeInstagram && !igTarget) {
            setComposerError('لم يتم العثور على حساب انستجرام مرتبط لهذه الصفحة للنشر عليه.');
            return;
        }
        
        if(reminderToPublish) setPublishingReminderId(reminderToPublish.id);
        setIsPublishing(true);
        setComposerError('');

        let finalScheduleDate: Date | null = null;
        if (scheduleDateToUse) {
            const parsedDate = new Date(scheduleDateToUse);
            if (!isNaN(parsedDate.getTime())) {
                finalScheduleDate = parsedDate;
            }
        }

        const targetsToPublishTo: Target[] = [];
        if (reminderToPublish && igTarget) {
             targetsToPublishTo.push(igTarget);
        } else {
            targetsToPublishTo.push(managedTarget);
            if(includeInstagram && igTarget) {
                targetsToPublishTo.push(igTarget);
            }
        }

        const scheduledItems: ScheduledPost[] = [];
        const results = [];
        
        for (const target of targetsToPublishTo) {
            const isReminder = target.type === 'instagram' && !!finalScheduleDate;
            const result = await publishToTarget(target, textToPublish, imageToPublish || null, finalScheduleDate, isReminder);
            results.push(result);

            if (result.success && finalScheduleDate) {
                 scheduledItems.push({
                    id: `post_${Date.now()}_${Math.random()}`,
                    text: textToPublish,
                    imageUrl: imageToPublish ? URL.createObjectURL(imageToPublish) : undefined,
                    imageFile: imageToPublish || undefined,
                    scheduledAt: finalScheduleDate,
                    isReminder: isReminder,
                    targetId: target.id,
                    targetInfo: {
                        name: target.name,
                        avatarUrl: target.picture.data.url,
                        type: target.type,
                    }
                });
            }
        }
        
        const successfulResults = results.filter(r => r.success);
        const failedResults = results.filter(r => !r.success);

        if (failedResults.length === 0) {
            showNotification('success', scheduledItems.length > 0 ? 'تمت جدولة جميع المنشورات بنجاح!' : 'تم نشر جميع المنشورات بنجاح!');
            if (reminderToPublish) {
                 setScheduledPosts(prev => prev.filter(p => p.id !== reminderToPublish.id));
            } else {
                clearComposer();
            }
        } else if (successfulResults.length === 0) {
            showNotification('error', `فشل نشر أو جدولة جميع المنشورات. ${failedResults.map(r => r.message).join(' ')}`);
        } else {
            showNotification('partial', `تم نشر أو جدولة بعض المنشورات بنجاح، بينما فشل البعض الآخر. الأخطاء: ${failedResults.map(r => r.message).join(' ')}`);
        }
        
        if (scheduledItems.length > 0) {
            setScheduledPosts(prev => [...prev, ...scheduledItems]);
        }
        
        setIsPublishing(false);
        if(reminderToPublish) setPublishingReminderId(null);

    }, [postText, selectedImage, isScheduled, scheduleDate, includeInstagram, managedTarget, linkedInstagramTarget, allTargets, publishToTarget, showNotification, clearComposer]);

    const handleSaveDraft = useCallback(() => {
        const newDraft: Draft = {
            id: `draft_${Date.now()}`,
            text: postText,
            imageFile: selectedImage,
            imagePreview: imagePreview,
            targetId: managedTarget.id,
            isScheduled,
            scheduleDate,
            includeInstagram,
        };
        setDrafts(prev => [newDraft, ...prev]);
        clearComposer();
        showNotification('success', 'تم حفظ المسودة بنجاح.');
    }, [postText, selectedImage, imagePreview, managedTarget.id, isScheduled, scheduleDate, includeInstagram, clearComposer, showNotification]);

    const handleLoadDraft = useCallback((draftId: string) => {
        const draft = drafts.find(d => d.id === draftId);
        if (draft) {
            setPostText(draft.text);
            if (draft.imageFile) {
                setSelectedImage(draft.imageFile);
                setImagePreview(URL.createObjectURL(draft.imageFile));
            } else if (draft.imagePreview) {
                setSelectedImage(null);
                setImagePreview(draft.imagePreview);
            }
            else {
                setSelectedImage(null);
                setImagePreview(null);
            }
            setIsScheduled(draft.isScheduled);
            setScheduleDate(draft.scheduleDate);
            setIncludeInstagram(draft.includeInstagram);
            setDrafts(prev => prev.filter(d => d.id !== draftId));
            setView('composer');
            showNotification('success', 'تم تحميل المسودة.');
        }
    }, [drafts, showNotification]);

    const handleDeleteDraft = useCallback((draftId: string) => {
        setDrafts(prev => prev.filter(d => d.id !== draftId));
        showNotification('success', 'تم حذف المسودة.');
    }, [showNotification]);

    const handleImageChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            setSelectedImage(file);
            setImagePreview(URL.createObjectURL(file));
        }
    }, []);
    
    const handleImageGenerated = useCallback((file: File) => {
        setSelectedImage(file);
        setImagePreview(URL.createObjectURL(file));
    }, []);

    const handleImageRemove = useCallback(() => {
        setSelectedImage(null);
        setImagePreview(null);
    }, []);
    
    const handleAddBulkPosts = useCallback((files: FileList) => {
        const newItems: BulkPostItem[] = Array.from(files).map(file => ({
            id: `bulk_${file.name}_${Date.now()}_${Math.random()}`,
            imageFile: file,
            imagePreview: URL.createObjectURL(file),
            text: '',
            scheduleDate: '',
            targetIds: [managedTarget.id],
        }));
        const combined = [...bulkPosts, ...newItems];
        const rescheduled = rescheduleBulkPosts(combined, schedulingStrategy, weeklyScheduleSettings);
        setBulkPosts(rescheduled);
    }, [managedTarget.id, bulkPosts, rescheduleBulkPosts, schedulingStrategy, weeklyScheduleSettings]);

    const handleUpdateBulkPost = useCallback((id: string, updates: Partial<BulkPostItem>) => {
        setBulkPosts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    }, []);

    const handleRemoveBulkPost = useCallback((id: string) => {
        setBulkPosts(prev => prev.filter(p => p.id !== id));
    }, []);
    
    const handleGenerateBulkDescription = useCallback(async (id: string) => {
        const post = bulkPosts.find(p => p.id === id);
        if(!post || !post.imageFile || !aiClient) return;
        
        handleUpdateBulkPost(id, { isGeneratingDescription: true });
        try {
            const description = await generateDescriptionForImage(aiClient, post.imageFile, pageProfile);
            handleUpdateBulkPost(id, { text: description });
        } catch (e: any) {
            handleUpdateBulkPost(id, { error: e.message });
        } finally {
            handleUpdateBulkPost(id, { isGeneratingDescription: false });
        }
    }, [bulkPosts, aiClient, handleUpdateBulkPost, pageProfile]);
    
    const handleScheduleAllBulk = useCallback(async () => {
        setIsSchedulingAll(true);
        let validPosts = true;
        let updatedPosts = bulkPosts.map(p => {
            let error;
            if (p.targetIds.length === 0) error = "اختر وجهة واحدة على الأقل.";
            else if (!p.scheduleDate) error = "حدد تاريخ الجدولة.";
            if (error) validPosts = false;
            return { ...p, error };
        });
        
        if (!validPosts) {
            setBulkPosts(updatedPosts);
            showNotification('error', 'بعض المنشورات تحتوي على أخطاء. يرجى مراجعتها.');
            setIsSchedulingAll(false);
            return;
        }

        const scheduledItems: ScheduledPost[] = [];
        for (const post of bulkPosts) {
            const scheduleDate = new Date(post.scheduleDate);
            for (const targetId of post.targetIds) {
                const target = allTargets.find(t => t.id === targetId);
                if (target) {
                    const isReminder = target.type === 'instagram';
                    await publishToTarget(target, post.text, post.imageFile || null, scheduleDate, isReminder);
                    
                    scheduledItems.push({
                        id: `post_${targetId}_${Date.now()}_${Math.random()}`,
                        text: post.text,
                        imageUrl: post.imagePreview,
                        imageFile: post.imageFile || undefined,
                        scheduledAt: scheduleDate,
                        isReminder: isReminder,
                        targetId: target.id,
                        targetInfo: { name: target.name, avatarUrl: target.picture.data.url, type: target.type }
                    });
                }
            }
        }
        
        setScheduledPosts(prev => [...prev, ...scheduledItems]);
        setBulkPosts([]);
        setIsSchedulingAll(false);
        showNotification('success', `تمت جدولة ${bulkPosts.length} منشورًا بنجاح!`);
        setView('calendar');
    }, [bulkPosts, allTargets, publishToTarget, showNotification]);
    
    const handleDeleteScheduledPost = useCallback((postId: string) => {
        const postToDelete = scheduledPosts.find(p => p.id === postId);
        if (!postToDelete) return;

        const isReminder = postToDelete.isReminder;
        
        if (isReminder || isSimulationMode) {
             setScheduledPosts(prev => prev.filter(p => p.id !== postId));
             showNotification('success', 'تم حذف التذكير بنجاح.');
             return;
        }

        const fbPostId = postToDelete.id.startsWith('post_') ? null : postToDelete.id;
        if (!fbPostId) {
             console.error("Cannot delete scheduled post without a valid Facebook Post ID.");
             showNotification('error', "لا يمكن حذف هذا المنشور المجدول لأنه لا يملك معرف فيسبوك صالح.");
             return;
        }

        const target = allTargets.find(t => t.id === postToDelete.targetId);
        if (!target?.access_token) {
            showNotification('error', 'فشلت المصادقة لحذف المنشور.');
            return;
        }
        
        window.FB.api(
            fbPostId, 'DELETE', { access_token: target.access_token }, 
            (response: any) => {
                if(response && response.success) {
                    setScheduledPosts(prev => prev.filter(p => p.id !== postId));
                    showNotification('success', 'تم حذف المنشور المجدول من فيسبوك بنجاح.');
                } else {
                    showNotification('error', `فشل حذف المنشور: ${response?.error?.message}`);
                }
            }
        );

    }, [scheduledPosts, allTargets, showNotification, isSimulationMode]);
    
    // --- CONTENT PLANNER ---
    const handleGeneratePlan = useCallback(async (request: StrategyRequest, images?: File[]) => {
        if(!aiClient) return;
        setIsGeneratingPlan(true);
        setPlanError(null);
        setContentPlan(null);
        try {
            const plan = await generateContentPlan(aiClient, request, pageProfile, images);
            setContentPlan(plan);
            const summary = request.type === 'campaign' ? `حملة: ${request.campaignName}` : (request.type === 'occasion' ? `مناسبة: ${request.occasion}` : `خطة ${request.duration}`);
            setStrategyHistory(prev => [{ id: `hist_${Date.now()}`, request, plan, summary, createdAt: new Date().toISOString() }, ...prev]);
        } catch(e: any) {
            setPlanError(e.message);
        } finally {
            setIsGeneratingPlan(false);
        }
    }, [aiClient, pageProfile]);

    const handleSchedulePlan = useCallback(async () => {
        if (!contentPlan || !aiClient) return;
        setIsSchedulingStrategy(true);
        try {
            const schedule = await generateOptimalSchedule(aiClient, contentPlan);
            const newBulkItems: BulkPostItem[] = schedule.map((item, i) => ({
                id: `bulk_plan_${Date.now()}_${i}`,
                text: item.postSuggestion,
                scheduleDate: item.scheduledAt,
                targetIds: [managedTarget.id],
            }));
            setBulkPosts(prev => [...prev, ...newBulkItems]);
            showNotification('success', 'تم تحويل الخطة إلى جدول مجمع! راجعها في صفحة الجدولة المجمعة.');
            setContentPlan(null);
            setView('bulk');
        } catch (e: any) {
            setPlanError(e.message);
        } finally {
            setIsSchedulingStrategy(false);
        }
    }, [contentPlan, aiClient, managedTarget.id, showNotification]);

    const handleStartPostFromPlan = useCallback((planItem: ContentPlanItem) => {
        setPostText(planItem.postSuggestion);
        setView('composer');
        window.scrollTo(0, 0);
    }, []);

    const handleLoadPlanFromHistory = useCallback((plan: ContentPlanItem[]) => {
        setContentPlan(plan);
    }, []);
    const handleDeletePlanFromHistory = useCallback((id: string) => {
        setStrategyHistory(prev => prev.filter(h => h.id !== id));
    }, []);
    //--- End Content Planner ---

    //--- ANALYTICS ---
    const fetchPostAnalytics = useCallback(async (postId: string) => {
        if (isSimulationMode) return;
        setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, loading: true } } : p));
        try {
            const response: any = await new Promise(resolve => window.FB.api(`/${postId}/insights?metric=post_impressions_unique,post_engaged_users&access_token=${managedTarget.access_token}`, (res: any) => resolve(res)));
            const commentsResponse: any = await new Promise(resolve => window.FB.api(`/${postId}/comments?summary=true&access_token=${managedTarget.access_token}`, (res: any) => resolve(res)));
            const sharesResponse: any = await new Promise(resolve => window.FB.api(`/${postId}?fields=shares&access_token=${managedTarget.access_token}`, (res: any) => resolve(res)));
            
            if (response && response.data) {
                const reach = response.data.find((m: any) => m.name === 'post_impressions_unique')?.values[0]?.value ?? 0;
                const likes = response.data.find((m: any) => m.name === 'post_engaged_users')?.values[0]?.value ?? 0; // Not perfect, but a proxy
                const commentsCount = commentsResponse?.summary?.total_count ?? 0;
                const sharesCount = sharesResponse?.shares?.count ?? 0;

                setPublishedPosts(prev => prev.map(p => p.id === postId ? {
                    ...p,
                    analytics: {
                        ...p.analytics,
                        loading: false,
                        reach,
                        likes,
                        comments: commentsCount,
                        shares: sharesCount,
                        lastUpdated: new Date()
                    }
                } : p));
            } else { throw new Error(response.error?.message || "Unknown error"); }
        } catch (err: any) {
            showNotification('error', `فشل تحديث الإحصائيات: ${err.message}`);
            setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, loading: false } } : p));
        }
    }, [isSimulationMode, managedTarget.access_token, showNotification]);

    const handleGenerateInsights = useCallback(async (postId: string) => {
        const post = publishedPosts.find(p => p.id === postId);
        if(!post || !aiClient) return;

        setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, isGeneratingInsights: true } } : p));
        
        try {
            const commentsResponse: any = await fetchWithPagination(`/${postId}/comments?limit=50&access_token=${managedTarget.access_token}`);
            const comments = commentsResponse.map((c: any) => ({ message: c.message }));
            const insights = await generatePostInsights(aiClient, post.text, post.analytics, comments);

            setPublishedPosts(prev => prev.map(p => p.id === postId ? {
                ...p,
                analytics: {
                    ...p.analytics,
                    isGeneratingInsights: false,
                    aiSummary: insights.performanceSummary,
                    sentiment: insights.sentiment
                }
            } : p));
        } catch(e: any) {
            showNotification('error', `فشل توليد التحليل: ${e.message}`);
            setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, isGeneratingInsights: false } } : p));
        }
    }, [publishedPosts, aiClient, showNotification, managedTarget.access_token, fetchWithPagination]);

    const performanceSummaryData = useMemo<PerformanceSummaryData | null>(() => {
        const periodEndDate = new Date();
        const periodStartDate = new Date();
        periodStartDate.setDate(periodStartDate.getDate() - (analyticsPeriod === '7d' ? 7 : 30));

        const postsInPeriod = publishedPosts.filter(p => new Date(p.publishedAt) >= periodStartDate && new Date(p.publishedAt) <= periodEndDate);

        if (postsInPeriod.length === 0) return null;

        const totalReach = postsInPeriod.reduce((sum, p) => sum + (p.analytics.reach ?? 0), 0);
        const totalEngagement = postsInPeriod.reduce((sum, p) => sum + (p.analytics.likes ?? 0) + (p.analytics.comments ?? 0) + (p.analytics.shares ?? 0), 0);
        const engagementRate = totalReach > 0 ? totalEngagement / totalReach : 0;
        
        const topPosts = [...postsInPeriod]
            .sort((a, b) => ((b.analytics.likes ?? 0) + (b.analytics.comments ?? 0) + (b.analytics.shares ?? 0)) - ((a.analytics.likes ?? 0) + (a.analytics.comments ?? 0) + (a.analytics.shares ?? 0)))
            .slice(0, 3);
            
        return { totalReach, totalEngagement, engagementRate, topPosts, postCount: postsInPeriod.length };
    }, [publishedPosts, analyticsPeriod]);
    
    useEffect(() => {
        const generateSummary = async () => {
            if (!performanceSummaryData || !aiClient || isGeneratingSummary || performanceSummaryText) return;
            setIsGeneratingSummary(true);
            try {
                const summary = await generatePerformanceSummary(aiClient, performanceSummaryData, pageProfile, analyticsPeriod);
                setPerformanceSummaryText(summary);
            } catch(e: any) {
                showNotification('error', `فشل إنشاء ملخص الأداء: ${e.message}`);
            } finally {
                setIsGeneratingSummary(false);
            }
        };
        generateSummary();
    }, [performanceSummaryData, aiClient, pageProfile, analyticsPeriod, isGeneratingSummary, performanceSummaryText, showNotification]);

    useEffect(() => {
        setPerformanceSummaryText(''); // Reset on period change
    }, [analyticsPeriod]);
    // --- End Analytics ---
    
    //--- INBOX LOGIC (REFACTORED) ---

    // Effect to load all data from storage, and fetch live data for the current view
    useEffect(() => {
        // 1. Load all state from local storage on target change
        const dataKey = `zex-pages-data-${managedTarget.id}`;
        let savedData: any = {};
        try {
            const rawData = localStorage.getItem(dataKey);
            savedData = rawData ? JSON.parse(rawData) : {};
        } catch (e) { console.error("Failed to parse data from localStorage", e); }
    
        setPageProfile(savedData.pageProfile || { description: '', services: '', contactInfo: '', website: '', currentOffers: '', address: '', country: '' });
        setDrafts(savedData.drafts?.map((d: any) => ({...d, imageFile: null})) || []);
        setScheduledPosts(savedData.scheduledPosts?.map((p: any) => ({ ...p, scheduledAt: new Date(p.scheduledAt) })) || []);
        setBulkPosts(savedData.bulkPosts || []);
        setStrategyHistory(savedData.strategyHistory || []);
        setAutoResponderSettings(savedData.autoResponderSettings || {
            comments: { realtimeEnabled: false, keywords: 'السعر,بكم,تفاصيل,خاص', replyOncePerUser: true, publicReplyEnabled: false, publicReplyMessage: '', privateReplyEnabled: true, privateReplyMessage: 'أهلاً بك {user_name}، تم إرسال التفاصيل على الخاص 📩' },
            messages: { realtimeEnabled: false, keywords: 'السعر,بكم,تفاصيل', replyMessage: 'أهلاً بك {user_name}، سأرسل لك كل التفاصيل حول استفسارك خلال لحظات.' }
        });
        setRepliedUsersPerPost(savedData.repliedUsersPerPost || {});
        setIncludeInstagram(!!linkedInstagramTarget);
        
        // Load stored inbox items
        const storedInbox = savedData.inboxItems || [];
        const validInboxItems = storedInbox.filter((item: InboxItem) => item && item.timestamp && !isNaN(new Date(item.timestamp).getTime()));
        setInboxItems(validInboxItems);
        
        // 2. Fetch live data based on the current view
        const fetchLiveInboxData = async () => {
            if (isSimulationMode || !window.FB) {
                setIsInboxLoading(false);
                return;
            };
            setIsInboxLoading(true);
            try {
                const defaultPicture = 'https://via.placeholder.com/40/cccccc/ffffff?text=?';
                let fetchedItems: InboxItem[] = [];

                // Fetch FB Messages
                if (managedTarget.type === 'page' && managedTarget.access_token) {
                    const convosPath = `/${managedTarget.id}/conversations?fields=id,snippet,updated_time,participants,unread_count&limit=25&access_token=${managedTarget.access_token}`;
                    const allConvosData = await fetchWithPagination(convosPath);
                    fetchedItems.push(...allConvosData.map((convo: any): InboxItem => {
                        const participant = convo.participants.data.find((p: any) => p.id !== managedTarget.id);
                        const participantId = participant?.id;
                        return { id: convo.id, type: 'message', text: convo.snippet, authorName: participant?.name || 'مستخدم غير معروف', authorId: participantId || 'Unknown', authorPictureUrl: participantId ? `https://graph.facebook.com/${participantId}/picture?type=normal` : defaultPicture, timestamp: convo.updated_time, conversationId: convo.id };
                    }));
                }

                // Fetch FB Post Comments
                const postEdge = managedTarget.type === 'page' ? 'published_posts' : (managedTarget.type === 'group' ? 'feed' : '');
                if (postEdge) {
                    const commentFields = 'comments.limit(25){id,from{id,name,picture{url}},message,created_time,parent}';
                    const postBaseFields = `id,message,full_picture,created_time,from,${commentFields}`;
                    const postsPath = `/${managedTarget.id}/${postEdge}?fields=${postBaseFields}&limit=25${managedTarget.access_token ? `&access_token=${managedTarget.access_token}` : ''}`;
                    const allPostsData = await fetchWithPagination(postsPath);
                    allPostsData.forEach((post: any) => {
                        if (post.comments?.data) {
                            fetchedItems.push(...post.comments.data.map((comment: any): InboxItem => {
                                const authorId = comment.from?.id;
                                const authorPicture = comment.from?.picture?.data?.url;
                                return { id: comment.id, type: 'comment', text: comment.message, authorName: comment.from?.name || 'مستخدم غير معروف', authorId: authorId || 'Unknown', authorPictureUrl: authorPicture || (authorId ? `https://graph.facebook.com/${authorId}/picture?type=normal` : defaultPicture), timestamp: comment.created_time, post: { id: post.id, message: post.message, picture: post.full_picture }, isReply: !!comment.parent };
                            }));
                        }
                    });
                }
                
                // Fetch IG Comments
                if (linkedInstagramTarget?.access_token) {
                    const mediaPath = `/${linkedInstagramTarget.id}/media?fields=id,caption,media_url,timestamp,comments.limit(25){id,from{id,username},text,timestamp,user{id,username,profile_picture_url}}&limit=25&access_token=${linkedInstagramTarget.access_token}`;
                    const allMediaData = await fetchWithPagination(mediaPath);
                    allMediaData.forEach((media: any) => {
                        if (media.comments?.data) {
                            fetchedItems.push(...media.comments.data.map((comment: any): InboxItem => {
                                const author = comment.user || comment.from;
                                return { id: comment.id, type: 'comment', text: comment.text, authorName: author?.username || 'مستخدم انستجرام', authorId: author?.id || 'Unknown', authorPictureUrl: author?.profile_picture_url || defaultPicture, timestamp: comment.timestamp, post: { id: media.id, message: media.caption, picture: media.media_url } };
                            }));
                        }
                    });
                }
                
                setInboxItems(prevItems => {
                    const itemsMap = new Map<string, InboxItem>();
                    [...prevItems, ...fetchedItems].forEach(item => { if(item?.id) itemsMap.set(item.id, item) });
                    const validatedItems = Array.from(itemsMap.values()).filter(item => item?.timestamp && !isNaN(new Date(item.timestamp).getTime()));
                    return validatedItems.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                });
            } catch (err: any) {
                showNotification('error', `فشل تحديث البريد الوارد: ${err.message}`);
            } finally { setIsInboxLoading(false); }
        };

        const fetchInitialPosts = async () => {
            if (isSimulationMode || publishedPosts.length > 0) {
                 setPublishedPostsLoading(false);
                 return;
            };
            setPublishedPostsLoading(true);
            try {
                const path = `/${managedTarget.id}/published_posts?fields=id,message,full_picture,created_time,from,likes.summary(true),shares,comments.summary(true)&limit=25&access_token=${managedTarget.access_token}`;
                const posts = await fetchWithPagination(path);
                setPublishedPosts(posts.map((p: any): PublishedPost => ({ id: p.id, pageId: managedTarget.id, pageName: managedTarget.name, pageAvatarUrl: managedTarget.picture.data.url, text: p.message || '', imagePreview: p.full_picture, publishedAt: new Date(p.created_time), analytics: { likes: p.likes?.summary?.total_count ?? 0, comments: p.comments?.summary?.total_count ?? 0, shares: p.shares?.count ?? 0, reach: 0, loading: false, lastUpdated: null } })));
            } catch (e: any) {
                showNotification('error', `فشل جلب المنشورات: ${e.message}`);
            } finally {
                setPublishedPostsLoading(false);
            }
        };

        if (view === 'inbox') { fetchLiveInboxData(); } 
        else if (view === 'analytics') { fetchInitialPosts(); }
        else { setIsInboxLoading(false); setPublishedPostsLoading(false); }

    }, [managedTarget.id, view, isSimulationMode, fetchWithPagination, showNotification, linkedInstagramTarget]);


    const handleInboxReply = useCallback(async (item: InboxItem, message: string): Promise<boolean> => {
        if(isSimulationMode) {
            showNotification('success', 'تم إرسال الرد (محاكاة).');
            return true;
        }

        const endpoint = item.type === 'comment' ? `/${item.id}/comments` : `/${item.conversationId}/messages`;
        const params = { message, access_token: managedTarget.access_token };
        try {
            const response: any = await new Promise(resolve => window.FB.api(endpoint, 'POST', params, (res: any) => resolve(res)));
            if (response && response.id) {
                showNotification('success', 'تم إرسال الرد بنجاح.');
                if (item.type === 'message') {
                   const newMessage: InboxMessage = { id: response.id, from: { id: managedTarget.id, name: managedTarget.name }, message, created_time: new Date().toISOString() };
                   setInboxItems(prev => prev.map(i => i.id === item.id ? { ...i, messages: [...(i.messages || []), newMessage] } : i));
                }
                return true;
            }
            throw new Error(response?.error?.message || 'خطأ غير معروف');
        } catch(e: any) {
            showNotification('error', `فشل إرسال الرد: ${e.message}`);
            return false;
        }
    }, [managedTarget.access_token, showNotification, isSimulationMode, managedTarget.id, managedTarget.name]);
    
    // Effect for processing auto-replies. Runs ONLY when items or settings change.
    useEffect(() => {
        if (isSimulationMode || (!autoResponderSettings.comments.realtimeEnabled && !autoResponderSettings.messages.realtimeEnabled)) {
            return;
        }

        const process = async () => {
            const itemsToProcess = inboxItems.filter(item => !autoRepliedItems.has(item.id));
            if (itemsToProcess.length === 0) return;

            const { comments: commentSettings, messages: messageSettings } = autoResponderSettings;

            let repliedItemsThisRun = new Set<string>();
            let repliedUsersThisRun: Record<string, string[]> = {};

            const keywordsMatch = (text: string, keywordsStr: string) => {
                const keywords = keywordsStr.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
                if (keywords.length === 0) return true;
                return keywords.some(k => text.toLowerCase().includes(k));
            };
            const replaceUsername = (msg: string, name: string) => msg.replace(/\{user_name\}/g, name);

            for (const item of itemsToProcess) {
                 const postKey = item.post?.id || 'unknown_post';

                 if (item.type === 'comment' && commentSettings.realtimeEnabled && keywordsMatch(item.text, commentSettings.keywords)) {
                    if (commentSettings.replyOncePerUser && (repliedUsersPerPost[postKey]?.includes(item.authorId) || repliedUsersThisRun[postKey]?.includes(item.authorId))) {
                        continue;
                    }

                    if (commentSettings.publicReplyEnabled && commentSettings.publicReplyMessage) {
                        await handleInboxReply(item, replaceUsername(commentSettings.publicReplyMessage, item.authorName));
                    }
                    if (commentSettings.privateReplyEnabled && commentSettings.privateReplyMessage && managedTarget.type === 'page') {
                        await new Promise(resolve => window.FB.api(`/${item.id}/private_replies`, 'POST', { message: replaceUsername(commentSettings.privateReplyMessage, item.authorName), access_token: managedTarget.access_token }, (res: any) => resolve(res)));
                    }
                    
                    repliedItemsThisRun.add(item.id);
                    if (postKey) {
                        repliedUsersThisRun[postKey] = [...(repliedUsersThisRun[postKey] || []), item.authorId];
                    }

                } else if (item.type === 'message' && messageSettings.realtimeEnabled && keywordsMatch(item.text, messageSettings.keywords)) {
                    await handleInboxReply(item, replaceUsername(messageSettings.replyMessage, item.authorName));
                    repliedItemsThisRun.add(item.id);
                }
            }
            
            if (repliedItemsThisRun.size > 0) {
                setAutoRepliedItems(prev => new Set([...prev, ...repliedItemsThisRun]));
            }
            if(Object.keys(repliedUsersThisRun).length > 0) {
                setRepliedUsersPerPost(prev => {
                    const newRecord = {...prev};
                    for (const key in repliedUsersThisRun) {
                        newRecord[key] = [...(newRecord[key] || []), ...repliedUsersThisRun[key]];
                    }
                    return newRecord;
                });
            }
        };

        process();
    // Intentionally excluding autoRepliedItems and repliedUsersPerPost to prevent loops.
    // The logic inside correctly uses the latest values and filters processed items.
    }, [inboxItems, autoResponderSettings, handleInboxReply, managedTarget.type, managedTarget.access_token, isSimulationMode]);


    const handleGenerateSmartReplies = useCallback(async (commentText: string): Promise<string[]> => {
        if (!aiClient) {
            showNotification('error', 'مساعد الذكاء الاصطناعي غير متاح.');
            return [];
        }
        try {
            return await generateSmartReplies(aiClient, commentText, pageProfile);
        } catch (e: any) {
            showNotification('error', e.message);
            return [];
        }
    }, [aiClient, pageProfile, showNotification]);

    const handleFetchMessageHistory = useCallback(async (conversationId: string) => {
        if (isSimulationMode) return;
        const path = `/${conversationId}/messages?fields=id,from,message,created_time&limit=100&access_token=${managedTarget.access_token}`;
        try {
            const history = await fetchWithPagination(path);
            setInboxItems(prev => prev.map(item => item.id === conversationId ? { ...item, messages: history.reverse() } : item));
        } catch(e: any) {
            console.error("Error fetching message history:", e);
        }
    }, [isSimulationMode, managedTarget.access_token, fetchWithPagination]);

    const unreadCount = useMemo(() => {
        return inboxItems.filter(item => {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            return new Date(item.timestamp) > twentyFourHoursAgo;
        }).length;
    }, [inboxItems]);


  const renderView = () => {
    switch (view) {
      case 'composer':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <PostComposer
              onPublish={handlePublish}
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
             <div className="sticky top-24 h-fit">
                <PostPreview
                    isCrosspostingInstagram={includeInstagram && !!linkedInstagramTarget}
                    postText={postText}
                    imagePreview={imagePreview}
                    pageName={managedTarget.name}
                    pageAvatar={managedTarget.picture.data.url}
                />
             </div>
          </div>
        );
      case 'calendar':
        const reminders = scheduledPosts.filter(p => new Date(p.scheduledAt).toDateString() === new Date().toDateString() && p.isReminder);
        return (
             <div className="space-y-6">
                {reminders.length > 0 && (
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold text-yellow-600 dark:text-yellow-400">تذكيرات النشر اليوم</h3>
                        {reminders.map(post => (
                            <ReminderCard
                                key={post.id}
                                post={post}
                                onPublish={() => handlePublish(post)}
                                isPublishing={publishingReminderId === post.id}
                            />
                        ))}
                    </div>
                )}
                <ContentCalendar posts={scheduledPosts} onDelete={handleDeleteScheduledPost} />
            </div>
        );
      case 'drafts':
        return <DraftsList drafts={drafts} onLoad={handleLoadDraft} onDelete={handleDeleteDraft} />;
      case 'analytics':
        return <AnalyticsPage 
                    period={analyticsPeriod}
                    onPeriodChange={setAnalyticsPeriod}
                    summaryData={performanceSummaryData}
                    aiSummary={performanceSummaryText}
                    isGeneratingSummary={isGeneratingSummary}
                    posts={publishedPosts} 
                    isLoading={publishedPostsLoading}
                    onFetchAnalytics={fetchPostAnalytics}
                    onGenerateInsights={handleGenerateInsights}
                />;
      case 'bulk':
        return <BulkSchedulerPage
                  bulkPosts={bulkPosts}
                  onAddPosts={handleAddBulkPosts}
                  onUpdatePost={handleUpdateBulkPost}
                  onRemovePost={handleRemoveBulkPost}
                  onScheduleAll={handleScheduleAllBulk}
                  isSchedulingAll={isSchedulingAll}
                  targets={allTargets}
                  aiClient={aiClient}
                  onGenerateDescription={handleGenerateBulkDescription}
                  schedulingStrategy={schedulingStrategy}
                  onSchedulingStrategyChange={setSchedulingStrategy}
                  weeklyScheduleSettings={weeklyScheduleSettings}
                  onWeeklyScheduleSettingsChange={setWeeklyScheduleSettings}
                  onReschedule={handleReschedule}
                />;
      case 'planner':
        return <ContentPlannerPage 
                    aiClient={aiClient}
                    isGenerating={isGeneratingPlan}
                    isFetchingProfile={isFetchingProfile}
                    onFetchProfile={handleFetchProfile}
                    error={planError}
                    plan={contentPlan}
                    onGeneratePlan={handleGeneratePlan}
                    isSchedulingStrategy={isSchedulingStrategy}
                    onScheduleStrategy={handleSchedulePlan}
                    onStartPost={handleStartPostFromPlan}
                    pageProfile={pageProfile}
                    onProfileChange={setPageProfile}
                    strategyHistory={strategyHistory}
                    onLoadFromHistory={handleLoadPlanFromHistory}
                    onDeleteFromHistory={handleDeletePlanFromHistory}
                />;
      case 'inbox':
        return <InboxPage 
                    items={inboxItems}
                    isLoading={isInboxLoading}
                    onReply={handleInboxReply}
                    onGenerateSmartReplies={handleGenerateSmartReplies}
                    onFetchMessageHistory={handleFetchMessageHistory}
                    autoResponderSettings={autoResponderSettings}
                    onAutoResponderSettingsChange={setAutoResponderSettings}
                />;
      default:
        return null;
    }
  };

  return (
    <div>
      <Header
        onLogout={onLogout}
        isSimulationMode={isSimulationMode}
        pageName={managedTarget.name}
        onChangePage={onChangePage}
      />
      <div className="flex">
        <aside className="w-64 bg-gray-50 dark:bg-gray-800/50 p-4 space-y-2 border-l border-gray-200 dark:border-gray-700 h-screen sticky top-0">
          <NavItem icon={<PencilSquareIcon className="w-5 h-5"/>} label="إنشاء منشور" active={view === 'composer'} onClick={() => setView('composer')} />
          <NavItem icon={<CalendarIcon className="w-5 h-5"/>} label="تقويم المحتوى" active={view === 'calendar'} onClick={() => setView('calendar')} />
          <NavItem icon={<QueueListIcon className="w-5 h-5"/>} label="الجدولة المجمعة" active={view === 'bulk'} onClick={() => setView('bulk')} />
          <NavItem icon={<ArchiveBoxIcon className="w-5 h-5"/>} label="المسودات" active={view === 'drafts'} onClick={() => setView('drafts')} />
          <NavItem icon={<InboxArrowDownIcon className="w-5 h-5"/>} label="البريد الوارد" active={view === 'inbox'} onClick={() => setView('inbox')} notificationCount={unreadCount} />
          <NavItem icon={<BrainCircuitIcon className="w-5 h-5"/>} label="مخطط المحتوى (AI)" active={view === 'planner'} onClick={() => setView('planner')} />
          <NavItem icon={<ChartBarIcon className="w-5 h-5"/>} label="تحليل الأداء" active={view === 'analytics'} onClick={() => setView('analytics')} />
        </aside>
        <main className="flex-grow p-8 bg-gray-100 dark:bg-gray-900 min-h-screen">
          {notification && (
              <div className={`p-4 mb-4 rounded-lg shadow-md text-white ${notification.type === 'success' ? 'bg-green-500' : (notification.type === 'error' ? 'bg-red-500' : 'bg-yellow-500')} fade-in`}>
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
