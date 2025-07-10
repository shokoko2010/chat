import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Target, PublishedPost, Draft, ScheduledPost, BulkPostItem, ContentPlanItem, StrategyRequest, WeeklyScheduleSettings, PageProfile, PerformanceSummaryData, StrategyHistoryItem, InboxItem, AutoResponderSettings, AutoResponderRule, AutoResponderAction } from '../types';
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
import { generateDescriptionForImage, generateContentPlan, generatePerformanceSummary, generateOptimalSchedule, generatePostInsights, enhanceProfileFromFacebookData, generateSmartReplies, generateAutoReply } from '../services/geminiService';
import PageProfilePage from './PageProfilePage';
import Button from './ui/Button';

// Icons
import PencilSquareIcon from './icons/PencilSquareIcon';
import CalendarIcon from './icons/CalendarIcon';
import ArchiveBoxIcon from './icons/ArchiveBoxIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import QueueListIcon from './icons/QueueListIcon';
import BrainCircuitIcon from './icons/BrainCircuitIcon';
import InboxArrowDownIcon from './icons/InboxArrowDownIcon';
import UserCircleIcon from './icons/UserCircleIcon';
import TrashIcon from './icons/TrashIcon';


interface DashboardPageProps {
  managedTarget: Target;
  allTargets: Target[];
  onChangePage: () => void;
  onLogout: () => void;
  isSimulationMode: boolean;
  aiClient: GoogleGenAI | null;
  onSettingsClick: () => void;
  fetchWithPagination: (path: string, accessToken?: string) => Promise<any[]>;
  onSyncHistory: (target: Target) => Promise<void>;
  syncingTargetId: string | null;
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

const initialAutoResponderSettings: AutoResponderSettings = {
  rules: [],
  fallback: {
    mode: 'off',
    staticMessage: 'شكرًا على رسالتك! سيقوم أحد ممثلينا بالرد عليك في أقرب وقت ممكن.',
  },
};


const DashboardPage: React.FC<DashboardPageProps> = ({ managedTarget, allTargets, onChangePage, onLogout, isSimulationMode, aiClient, onSettingsClick, fetchWithPagination, onSyncHistory, syncingTargetId }) => {
  const [view, setView] = useState<'composer' | 'calendar' | 'drafts' | 'analytics' | 'bulk' | 'planner' | 'inbox' | 'profile'>('composer');
  
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
  const [isReplying, setIsReplying] = useState(false);
  
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
  const [autoResponderSettings, setAutoResponderSettings] = useState<AutoResponderSettings>(initialAutoResponderSettings);
  const [repliedUsersPerPost, setRepliedUsersPerPost] = useState<Record<string, string[]>>({});
  const isProcessingReplies = useRef(false);


  const linkedInstagramTarget = useMemo(() => {
    if (managedTarget.type !== 'page') return null;
    return allTargets.find(t => t.type === 'instagram' && t.parentPageId === managedTarget.id) || null;
  }, [managedTarget, allTargets]);

  const bulkSchedulerTargets = useMemo(() => {
    const targets = [managedTarget];
    if (linkedInstagramTarget) {
        targets.push(linkedInstagramTarget);
    }
    return targets;
  }, [managedTarget, linkedInstagramTarget]);

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
            window.FB.api(`/${managedTarget.id}?fields=${fields}`, (res: any) => resolve(res));
        });

        if (fbResponse && !fbResponse.error) {
            const rawProfileData = {
                about: fbResponse.about || '',
                category: fbResponse.category || '',
                contact: [...(fbResponse.emails || []), fbResponse.phone || ''].filter(Boolean).join(', '),
                website: fbResponse.website || '',
                address: fbResponse.single_line_address || '',
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
            throw new Error(fbResponse?.error?.message || 'فشل استرداد بيانات الصفحة. تأكد من صلاحيات الوصول.');
        }
    } catch (e: any) {
        showNotification('error', `فشل جلب بيانات الصفحة: ${e.message}`);
        setPlanError(e.message);
    } finally {
        setIsFetchingProfile(false);
    }
  }, [managedTarget.id, isSimulationMode, aiClient, showNotification]);


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

  useEffect(() => {
    const dataKey = `zex-pages-data-${managedTarget.id}`;
    let savedData;
    try {
        const rawData = localStorage.getItem(dataKey);
        savedData = rawData ? JSON.parse(rawData) : {};
    } catch(e) {
        console.error("Failed to parse localStorage data, starting fresh.", e);
        savedData = {};
    }

    const loadedSettings = savedData.autoResponderSettings;

    // --- Data Migration Logic for AutoResponder ---
    const migrateSettings = (settings: any): AutoResponderSettings => {
        // If settings have `rules`, they are likely new or already migrated.
        // We just need to ensure new fields are present.
        if (settings && Array.isArray(settings.rules)) {
            const migratedRules = settings.rules.map((rule: any) => ({
                ...rule,
                enabled: typeof rule.enabled === 'boolean' ? rule.enabled : true,
                replyOncePerUser: typeof rule.replyOncePerUser === 'boolean'
                    ? rule.replyOncePerUser
                    : (rule.trigger.source === 'comment' ? settings.replyOncePerUser ?? true : undefined),
            }));
            return {
                rules: migratedRules,
                fallback: settings.fallback || initialAutoResponderSettings.fallback,
            };
        }
        
        // Handle very old structure (pre-IFTTT)
        const newRules: AutoResponderRule[] = [];
        const globalReplyOnce = settings?.replyOncePerUser ?? true;

        if (settings?.comments?.rules) {
             settings.comments.rules.forEach((oldRule: any) => {
                const actions: AutoResponderAction[] = [];
                if (oldRule.publicReplyMessage) actions.push({ type: 'public_reply', enabled: true, messageVariations: [oldRule.publicReplyMessage] });
                if (oldRule.privateReplyMessage) actions.push({ type: 'private_reply', enabled: true, messageVariations: [oldRule.privateReplyMessage] });
                
                if (actions.length > 0) {
                    newRules.push({
                        id: oldRule.id || `migrated_c_${Date.now()}_${Math.random()}`,
                        name: `قاعدة تعليقات لـ "${oldRule.keywords}"`,
                        enabled: settings.comments.enabled ?? true,
                        replyOncePerUser: globalReplyOnce,
                        trigger: {
                            source: 'comment',
                            matchType: 'any',
                            keywords: (oldRule.keywords || '').split(',').map((k:string) => k.trim()).filter(Boolean),
                            negativeKeywords: [],
                        },
                        actions,
                    });
                }
            });
        }
         if (settings?.messages?.rules) {
            settings.messages.rules.forEach((oldRule: any) => {
                 if (oldRule.messageReply) {
                     newRules.push({
                        id: oldRule.id || `migrated_m_${Date.now()}_${Math.random()}`,
                        name: `قاعدة رسائل لـ "${oldRule.keywords}"`,
                        enabled: settings.messages.enabled ?? true,
                        trigger: {
                            source: 'message',
                            matchType: 'any',
                            keywords: (oldRule.keywords || '').split(',').map((k:string) => k.trim()).filter(Boolean),
                            negativeKeywords: [],
                        },
                        actions: [{ type: 'direct_message', enabled: true, messageVariations: [oldRule.messageReply] }],
                    });
                 }
            });
        }

        return {
            rules: newRules,
            fallback: settings?.fallback || initialAutoResponderSettings.fallback,
        };
    };

    let finalSettings: AutoResponderSettings;
    if (loadedSettings) {
        const isOldStructure = loadedSettings.comments || loadedSettings.messages || typeof loadedSettings.replyOncePerUser === 'boolean';
        const needsMigration = loadedSettings.rules && loadedSettings.rules.some((r:any) => typeof r.enabled !== 'boolean');

        if (isOldStructure || needsMigration) {
            finalSettings = migrateSettings(loadedSettings);
            if (isOldStructure) { // Only show notification for major migrations
                 showNotification('success', 'تم تحديث نظام الرد التلقائي! يرجى مراجعة إعداداتك الجديدة.');
            }
        } else {
             finalSettings = {
                ...initialAutoResponderSettings,
                ...loadedSettings,
            };
        }
    } else {
        finalSettings = initialAutoResponderSettings;
    }
    setAutoResponderSettings(finalSettings);
    // --- End of Data Migration ---

    setPageProfile(savedData.pageProfile || { description: '', services: '', contactInfo: '', website: '', currentOffers: '', address: '', country: '' });
    setDrafts(savedData.drafts?.map((d: any) => ({...d, imageFile: null})) || []);
    setScheduledPosts(savedData.scheduledPosts?.map((p: any) => ({...p, scheduledAt: new Date(p.scheduledAt), imageFile: null })) || []);
    setContentPlan(savedData.contentPlan || null);
    setStrategyHistory(savedData.strategyHistory || []);
    setPublishedPosts(savedData.publishedPosts?.map((p:any) => ({...p, publishedAt: new Date(p.publishedAt)})) || []);
    
    // Compatibility: Initialize `isReplied` and `platform`.
    const oldAutoRepliedItems = new Set(savedData.autoRepliedItems || []);
    setRepliedUsersPerPost(savedData.repliedUsersPerPost || {});
    setInboxItems(savedData.inboxItems?.map((i:any) => ({
        ...i,
        platform: i.platform || 'facebook', // Add platform for old data
        timestamp: new Date(i.timestamp).toISOString(),
        isReplied: oldAutoRepliedItems.has(i.id) || i.isReplied,
    })) || []);
    
    setBulkPosts([]);
    clearComposer();
    setPublishedPostsLoading(true);
    setView('composer');

    if (isSimulationMode) {
      setPublishedPostsLoading(false);
      return;
    }
    
    if (!savedData.publishedPosts || savedData.publishedPosts.length === 0) {
        const endpoint = 'published_posts';
        const fields = 'id,message,full_picture,created_time,likes.summary(true),comments.summary(true),shares,insights.metric(post_impressions_unique){values}';

        fetchWithPagination(`/${managedTarget.id}/${endpoint}?fields=${fields}&limit=100`, managedTarget.access_token)
        .then((response: any) => {
            if (response) {
            const fetchedPosts: PublishedPost[] = response.map((post: any) => ({
                id: post.id, pageId: managedTarget.id, pageName: managedTarget.name, pageAvatarUrl: managedTarget.picture.data.url, text: post.message || '',
                imagePreview: post.full_picture || null, publishedAt: new Date(post.created_time),
                analytics: {
                likes: post.likes?.summary?.total_count ?? 0, comments: post.comments?.summary?.total_count ?? 0, shares: post.shares?.count ?? 0,
                reach: post.insights?.data?.[0]?.values?.[0]?.value ?? 0,
                loading: false, lastUpdated: new Date(), isGeneratingInsights: false
                }
            }));
            setPublishedPosts(fetchedPosts);
            }
        }).catch(error => console.error(error)).finally(() => setPublishedPostsLoading(false));
    } else {
        setPublishedPostsLoading(false);
    }
  }, [managedTarget.id, managedTarget.access_token, isSimulationMode, clearComposer, fetchWithPagination, managedTarget.name, managedTarget.picture.data.url, showNotification]);
  
  useEffect(() => {
    try {
        const dataKey = `zex-pages-data-${managedTarget.id}`;
        const dataToStore = { 
            pageProfile,
            drafts: drafts.map(({ imageFile, ...rest }) => ({...rest, imageFile: null, imagePreview: imageFile ? rest.imagePreview : null })), 
            scheduledPosts: scheduledPosts.map(({ imageFile, ...rest }) => ({...rest, imageFile: null, imageUrl: imageFile ? rest.imageUrl : null })),
            contentPlan,
            strategyHistory,
            publishedPosts,
            inboxItems,
            autoResponderSettings,
            repliedUsersPerPost
        };
        localStorage.setItem(dataKey, JSON.stringify(dataToStore));
    } catch(e) {
        console.error("Could not save data to localStorage:", e);
    }
  }, [pageProfile, drafts, scheduledPosts, contentPlan, strategyHistory, publishedPosts, inboxItems, autoResponderSettings, repliedUsersPerPost, managedTarget.id]);

  const filteredPosts = useMemo(() => {
    const now = new Date();
    const daysToFilter = analyticsPeriod === '7d' ? 7 : 30;
    const cutoffDate = new Date(new Date().setDate(now.getDate() - daysToFilter));
    return publishedPosts.filter(p => new Date(p.publishedAt) >= cutoffDate);
  }, [publishedPosts, analyticsPeriod]);

  const summaryData: PerformanceSummaryData | null = useMemo(() => {
    if (filteredPosts.length === 0) return null;
    const summary = filteredPosts.reduce((acc, post) => {
        const engagement = (post.analytics.likes ?? 0) + (post.analytics.comments ?? 0) + (post.analytics.shares ?? 0);
        acc.totalReach += post.analytics.reach ?? 0;
        acc.totalEngagement += engagement;
        return acc;
    }, { totalReach: 0, totalEngagement: 0 });
    const topPosts = [...filteredPosts].sort((a, b) => {
        const engagementA = (a.analytics.likes ?? 0) + (a.analytics.comments ?? 0) + (a.analytics.shares ?? 0);
        const engagementB = (b.analytics.likes ?? 0) + (b.analytics.comments ?? 0) + (b.analytics.shares ?? 0);
        return engagementB - engagementA;
    }).slice(0, 3);
    return {
        totalReach: summary.totalReach,
        totalEngagement: summary.totalEngagement,
        engagementRate: summary.totalReach > 0 ? summary.totalEngagement / summary.totalReach : 0,
        topPosts,
        postCount: filteredPosts.length
    };
  }, [filteredPosts]);

  useEffect(() => {
    if (summaryData && aiClient) {
        const generateSummary = async () => {
            setIsGeneratingSummary(true);
            try {
                const summaryText = await generatePerformanceSummary(aiClient, summaryData, pageProfile, analyticsPeriod);
                setPerformanceSummaryText(summaryText);
            } catch (e: any) {
                setPerformanceSummaryText(`فشل إنشاء الملخص: ${e.message}`);
            } finally {
                setIsGeneratingSummary(false);
            }
        };
        generateSummary();
    }
  }, [summaryData, aiClient, pageProfile, analyticsPeriod]);
  
  const handleSendMessage = useCallback(async (conversationId: string, message: string): Promise<boolean> => {
    return new Promise(resolve => {
        if(isSimulationMode) { resolve(true); return; }
        window.FB.api(`/${conversationId}/messages`, 'POST', { message, access_token: managedTarget.access_token }, (response: any) => {
            if(response && !response.error) {
                fetchMessageHistory(conversationId);
                resolve(true);
            } else {
                const errorMsg = response?.error?.message || 'فشل إرسال الرسالة';
                console.error(`Failed to send message to ${conversationId}:`, response?.error);
                showNotification('error', `فشل إرسال الرسالة: ${errorMsg}`);
                resolve(false); 
            }
        });
    });
  }, [isSimulationMode, managedTarget.access_token, showNotification]);

  const handleReplyToComment = useCallback(async (commentId: string, message: string): Promise<boolean> => {
    return new Promise(resolve => {
        if(isSimulationMode) { resolve(true); return; }
        window.FB.api(`/${commentId}/comments`, 'POST', { message, access_token: managedTarget.access_token }, (response: any) => {
            if (response && !response.error) {
                resolve(true);
            } else {
                const errorMsg = response?.error?.message || 'فشل الرد على التعليق';
                console.error(`Failed to reply to comment ${commentId}:`, response?.error);
                showNotification('error', `فشل الرد على التعليق: ${errorMsg}`);
                resolve(false);
            }
        });
    });
  }, [isSimulationMode, managedTarget.access_token, showNotification]);

  const handlePrivateReplyToComment = useCallback(async (commentId: string, message: string): Promise<boolean> => {
    return new Promise(resolve => {
        if (isSimulationMode) { resolve(true); return; }
        window.FB.api(`/${commentId}/private_replies`, 'POST', { message, access_token: managedTarget.access_token }, (response: any) => {
            if (response && response.success) {
                resolve(true);
            } else {
                const error = response?.error;
                let errorMsg = error?.message || 'فشل إرسال الرد الخاص';
                if (error && error.code === 100) {
                    errorMsg = `لا يمكن إرسال رد خاص. الأسباب المحتملة: 
1) مر أكثر من 7 أيام على التعليق.
2) هذا التعليق هو رد على تعليق آخر.
3) المستخدم لا يسمح بالرسائل من الصفحة.
4) قد تكون صلاحيات الصفحة غير كافية (تحقق من صلاحية pages_messaging).`;
                }
                console.error(`Failed to send private reply to ${commentId}:`, error || response);
                showNotification('error', `فشل الرد الخاص: ${errorMsg}`);
                resolve(false);
            }
        });
    });
  }, [isSimulationMode, managedTarget.access_token, showNotification]);

  const processAutoReplies = useCallback(async () => {
    if (isProcessingReplies.current) return;
    isProcessingReplies.current = true;

    try {
        const { rules, fallback } = autoResponderSettings;
        if (rules.length === 0 && fallback.mode === 'off') return;

        const itemsToProcess = inboxItems.filter(item => 
            !item.isReplied && 
            item.authorId !== managedTarget.id && 
            (!linkedInstagramTarget || item.authorId !== linkedInstagramTarget.id)
        );

        if (itemsToProcess.length === 0) return;

        const newRepliedUsers = JSON.parse(JSON.stringify(repliedUsersPerPost));
        const newlyRepliedItemIds = new Set<string>();
        
        for (const item of itemsToProcess) {
            let itemHandled = false;
            const lowerCaseText = item.text.toLowerCase();

            // Find the first matching, enabled rule
            for (const rule of rules) {
                if (!rule.enabled || rule.trigger.source !== item.type) {
                    continue;
                }
                
                const postId = item.post?.id || 'dm'; // 'dm' for direct messages
                if (item.type === 'comment' && rule.replyOncePerUser) {
                    if ((newRepliedUsers[postId] || []).includes(item.authorId)) {
                        continue;
                    }
                }

                const hasNegative = rule.trigger.negativeKeywords.filter(Boolean).some(nk => lowerCaseText.includes(nk.toLowerCase().trim()));
                if (hasNegative) {
                    continue;
                }

                const keywords = rule.trigger.keywords.filter(Boolean).map(k => k.toLowerCase().trim());
                let matched = false;
                if (keywords.length === 0) {
                    matched = true; // Rule with no keywords matches everything
                } else {
                    const matchType = rule.trigger.matchType;
                    if (matchType === 'any') {
                        matched = keywords.some(k => lowerCaseText.includes(k));
                    } else if (matchType === 'all') {
                        matched = keywords.every(k => lowerCaseText.includes(k));
                    } else if (matchType === 'exact') {
                        matched = keywords.some(k => lowerCaseText === k);
                    }
                }

                if (matched) {
                    let ruleMatchedAndActed = false;
                    const enabledActions = rule.actions.filter(a => a.enabled && a.messageVariations.length > 0 && a.messageVariations[0].trim() !== '');

                    for (const action of enabledActions) {
                        const messageToSend = action.messageVariations[Math.floor(Math.random() * action.messageVariations.length)];
                        const finalMessage = messageToSend.replace('{user_name}', item.authorName);

                        let success = false;
                        if (action.type === 'public_reply' && item.type === 'comment') {
                            success = await handleReplyToComment(item.id, finalMessage);
                        } else if (action.type === 'private_reply' && item.type === 'comment') {
                            if (item.platform === 'facebook' && item.can_reply_privately) {
                                success = await handlePrivateReplyToComment(item.id, finalMessage);
                            }
                        } else if (action.type === 'direct_message' && item.type === 'message') {
                            success = await handleSendMessage(item.conversationId || item.id, finalMessage);
                        }
                        
                        if (success) {
                            ruleMatchedAndActed = true;
                        }
                    }

                    if (ruleMatchedAndActed) {
                        itemHandled = true;
                        newlyRepliedItemIds.add(item.id);

                        if (item.type === 'comment' && rule.replyOncePerUser) {
                            if (!newRepliedUsers[postId]) newRepliedUsers[postId] = [];
                            if (!newRepliedUsers[postId].includes(item.authorId)) {
                                newRepliedUsers[postId].push(item.authorId);
                            }
                        }
                        break; // Found a matching rule that acted, move to next item.
                    }
                }
            }

            if (!itemHandled && item.type === 'message' && fallback.mode !== 'off') {
                let fallbackMessage = '';
                if (fallback.mode === 'static') {
                    fallbackMessage = fallback.staticMessage;
                } else if (fallback.mode === 'ai' && aiClient) {
                    try {
                        fallbackMessage = await generateAutoReply(aiClient, item.text, pageProfile);
                    } catch (e) { console.error("AI fallback failed:", e); }
                }
                if (fallbackMessage) {
                    const success = await handleSendMessage(item.conversationId || item.id, fallbackMessage.replace('{user_name}', item.authorName));
                    if (success) {
                       itemHandled = true;
                       newlyRepliedItemIds.add(item.id);
                    }
                }
            }
        }

        if(newlyRepliedItemIds.size > 0) {
            setInboxItems(prev => prev.map(i => newlyRepliedItemIds.has(i.id) ? { ...i, isReplied: true } : i));
            setRepliedUsersPerPost(newRepliedUsers);
            showNotification('success', `تم إرسال ${newlyRepliedItemIds.size} ردًا تلقائيًا.`);
        }
    } catch(e: any) {
        console.error("Critical error in auto-reply processor:", e);
        showNotification('error', `حدث خطأ جسيم في نظام الرد التلقائي: ${e.message}`);
    } finally {
        isProcessingReplies.current = false;
    }
  }, [inboxItems, autoResponderSettings, repliedUsersPerPost, aiClient, pageProfile, showNotification, handleReplyToComment, handlePrivateReplyToComment, handleSendMessage, managedTarget.id, linkedInstagramTarget]);


  const fetchMessageHistory = async (conversationId: string) => {
    const response: any = await new Promise(resolve => window.FB.api(`/${conversationId}/messages`, { fields: 'id,message,from,created_time', access_token: managedTarget.access_token }, (res: any) => resolve(res)));
    if (response && response.data) {
        setInboxItems(prev => prev.map(item => item.conversationId === conversationId ? { ...item, messages: response.data.reverse() } : item));
    } else {
        console.error("Failed to fetch message history:", response?.error);
        showNotification('error', `فشل تحميل سجل الرسائل: ${response?.error?.message}`);
    }
  };
  
   const handleSmartReply = async (item: InboxItem, message: string): Promise<boolean> => {
    setIsReplying(true);
    const success = await (item.type === 'comment'
      ? handleReplyToComment(item.id, message)
      : handleSendMessage(item.conversationId!, message));

    if (success) {
      showNotification('success', 'تم إرسال الرد بنجاح.');
      // Mark as replied locally for immediate feedback
      setInboxItems(prev => prev.map(i => i.id === item.id ? { ...i, isReplied: true } : i));
    }
    // Notification for failure is handled inside the reply functions
    setIsReplying(false);
    return success;
  };
  
  const handleStartPostFromPlan = useCallback((item: ContentPlanItem) => {
    setPostText(item.postSuggestion);
    setView('composer');
    showNotification('success', 'تم نسخ اقتراح المنشور إلى أداة الإنشاء. يمكنك الآن تعديله ونشره.');
  }, [showNotification]);

  const handleDeleteDraft = (draftId: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذه المسودة؟')) {
        setDrafts(prev => prev.filter(d => d.id !== draftId));
        showNotification('success', 'تم حذف المسودة.');
    }
  };
  
  const handleLoadDraft = (draftId: string) => {
    const draft = drafts.find(d => d.id === draftId);
    if(draft) {
      setPostText(draft.text);
      setImagePreview(draft.imagePreview);
      setSelectedImage(draft.imageFile); // Note: file handle might be lost on refresh
      setIsScheduled(draft.isScheduled);
      setScheduleDate(draft.scheduleDate);
      setIncludeInstagram(draft.includeInstagram);
      setView('composer');
      showNotification('success', 'تم تحميل المسودة.');
    }
  };
  
  const handleDeleteScheduledPost = (postId: string) => {
      if (window.confirm('هل أنت متأكد من إلغاء جدولة هذا المنشور؟')) {
        setScheduledPosts(prev => prev.filter(p => p.id !== postId));
        showNotification('success', 'تم إلغاء جدولة المنشور.');
    }
  };
  
  const handleScheduleStrategy = useCallback(async () => {
    if (!aiClient || !contentPlan) return;
    setIsSchedulingStrategy(true);
    setPlanError(null);
    try {
      const schedule = await generateOptimalSchedule(aiClient, contentPlan);
      const newBulkPosts: BulkPostItem[] = schedule.map((item, index) => ({
        id: `plan_${Date.now()}_${index}`,
        text: item.postSuggestion,
        scheduleDate: item.scheduledAt,
        targetIds: [managedTarget.id],
      }));
      setBulkPosts(newBulkPosts);
      setView('bulk');
      showNotification('success', 'تم تحويل الخطة إلى جدول مجمع! راجع التواريخ وانشر.');
    } catch(e: any) {
      setPlanError(e.message);
      showNotification('error', `فشل إنشاء جدول تلقائي: ${e.message}`);
    } finally {
      setIsSchedulingStrategy(false);
    }
  }, [aiClient, contentPlan, managedTarget.id, showNotification]);

  const handlePublish = async () => {
    setIsPublishing(true);
    setComposerError('');

    let fbError: Error | null = null;
    let igError: Error | null = null;
    let fbPostId: string | null = null;
    const isReminder = includeInstagram && isScheduled;

    if (!postText && !selectedImage) {
      setComposerError('لا يمكن نشر منشور فارغ. أضف نصًا أو صورة.');
      setIsPublishing(false);
      return;
    }
     if (includeInstagram && !selectedImage) {
      setComposerError('منشورات انستجرام تتطلب وجود صورة.');
      setIsPublishing(false);
      return;
    }

    try {
        const postData: any = {};
        if (postText) postData.message = postText;
        if (isScheduled && !isReminder) postData.scheduled_publish_time = Math.floor(new Date(scheduleDate).getTime() / 1000);
        
        // Publish to Facebook
        if (selectedImage) {
            postData.source = selectedImage;
            const endpoint = isScheduled && !isReminder ? `/${managedTarget.id}/photos` : `/${managedTarget.id}/photos`;
            const response: any = await new Promise(resolve => window.FB.api(endpoint, 'POST', postData, (res: any) => resolve(res)));
             if (response.error) {
                console.error("Facebook post error:", response.error);
                fbError = new Error(`(فيسبوك) ${response.error.message}`);
            } else {
                fbPostId = response.post_id || response.id;
            }
        } else {
            const endpoint = `/${managedTarget.id}/feed`;
            const response: any = await new Promise(resolve => window.FB.api(endpoint, 'POST', postData, (res: any) => resolve(res)));
            if (response.error) {
                console.error("Facebook post error:", response.error);
                fbError = new Error(`(فيسبوك) ${response.error.message}`);
            } else {
                fbPostId = response.id;
            }
        }

        // Publish to Instagram
        if (includeInstagram && linkedInstagramTarget && selectedImage && !fbError) {
             try {
                const igContainerParams: any = {
                    image_url: `https://graph.facebook.com/${fbPostId}?fields=images`, // Requires page public content access
                    caption: postText
                };
                const igContainerResponse: any = await new Promise(resolve => {
                    window.FB.api(`/${linkedInstagramTarget.id}/media`, 'POST', igContainerParams, (res: any) => resolve(res));
                });
                
                if (igContainerResponse.error) {
                    throw new Error(igContainerResponse.error.message);
                }
                
                const igPublishResponse: any = await new Promise(resolve => {
                    window.FB.api(`/${linkedInstagramTarget.id}/media_publish`, 'POST', { creation_id: igContainerResponse.id }, (res: any) => resolve(res));
                });

                if (igPublishResponse.error) {
                    throw new Error(igPublishResponse.error.message);
                }
             } catch(e: any) {
                console.error("Instagram post error:", e);
                igError = new Error(`(انستجرام) ${e.message}`);
             }
        }
        
        const errorMessages: string[] = [];
        if (fbError) errorMessages.push(fbError.message);
        if (igError) errorMessages.push(igError.message);

        if (errorMessages.length > 0) {
            const fullErrorMessage = errorMessages.join(' و ');
             if ((fbError && igError) || (fbError && !includeInstagram) || (igError && !fbPostId)) {
                showNotification('error', `فشل النشر بالكامل. الأسباب: ${fullErrorMessage}`);
                setComposerError(fullErrorMessage);
             } else {
                showNotification('partial', `نجاح جزئي: فشل النشر على أحد الحسابات. السبب: ${fullErrorMessage}`);
             }
        } else { // Full success
            if(isScheduled) {
                 const newScheduledPost: ScheduledPost = {
                    id: fbPostId || `local_${Date.now()}`,
                    text: postText,
                    imageUrl: imagePreview || undefined,
                    imageFile: selectedImage || undefined,
                    scheduledAt: new Date(scheduleDate),
                    isReminder: isReminder,
                    targetId: isReminder ? linkedInstagramTarget!.id : managedTarget.id,
                    targetInfo: {
                      name: isReminder ? linkedInstagramTarget!.name : managedTarget.name,
                      avatarUrl: isReminder ? linkedInstagramTarget!.picture.data.url : managedTarget.picture.data.url,
                      type: isReminder ? 'instagram' : 'page'
                    }
                };
                if(isReminder) {
                     setScheduledPosts(prev => [...prev, newScheduledPost]);
                     showNotification('success', `تم جدولة المنشور على فيسبوك بنجاح، وتم إنشاء تذكير للنشر على انستجرام.`);
                } else {
                     setScheduledPosts(prev => [...prev, newScheduledPost]);
                     showNotification('success', 'تم جدولة المنشور بنجاح!');
                }
            } else {
                showNotification('success', 'تم النشر بنجاح!');
            }
            clearComposer();
        }
    } catch (e: any) {
      console.error("Unhandled publishing error:", e);
      const errorMessage = e.message || "حدث خطأ غير متوقع أثناء عملية النشر.";
      setComposerError(errorMessage);
      showNotification('error', `فشل النشر: ${errorMessage}`);
    } finally {
      setIsPublishing(false);
    }
  };
  
    const handleSaveDraft = () => {
        if (!postText && !selectedImage) {
            setComposerError('لا يمكن حفظ مسودة فارغة.');
            return;
        }
        const newDraft: Draft = {
            id: `draft_${Date.now()}`,
            text: postText,
            imageFile: selectedImage,
            imagePreview: imagePreview,
            targetId: managedTarget.id,
            isScheduled: isScheduled,
            scheduleDate: scheduleDate,
            includeInstagram: includeInstagram,
        };
        setDrafts(prev => [newDraft, ...prev]);
        showNotification('success', 'تم حفظ المسودة بنجاح.');
        clearComposer();
    };
    
    const onBulkAdd = (files: FileList) => {
        const newItems: BulkPostItem[] = Array.from(files).map((file, index) => ({
            id: `bulk_${Date.now()}_${index}`,
            imageFile: file,
            imagePreview: URL.createObjectURL(file),
            text: '',
            scheduleDate: '',
            targetIds: bulkSchedulerTargets.map(t => t.id),
        }));
        
        const combinedPosts = [...bulkPosts, ...newItems];
        const rescheduled = rescheduleBulkPosts(combinedPosts, schedulingStrategy, weeklyScheduleSettings);
        setBulkPosts(rescheduled);
        showNotification('success', `تمت إضافة ${files.length} صورة بنجاح وجدولتها مبدئيًا.`);
    };

    const onBulkUpdate = (id: string, updates: Partial<BulkPostItem>) => {
        setBulkPosts(prev => prev.map(p => p.id === id ? { ...p, ...updates, error: undefined } : p));
    };

    const onBulkRemove = (id: string) => {
        setBulkPosts(prev => prev.filter(p => p.id !== id));
    };

    const handleGenerateBulkDescription = async (id: string) => {
        const item = bulkPosts.find(p => p.id === id);
        if (!item || !item.imageFile || !aiClient) return;
        
        onBulkUpdate(id, { isGeneratingDescription: true });
        try {
            const description = await generateDescriptionForImage(aiClient, item.imageFile, pageProfile);
            onBulkUpdate(id, { text: description });
        } catch(e: any) {
            showNotification('error', `فشل توليد الوصف: ${e.message}`);
        } finally {
            onBulkUpdate(id, { isGeneratingDescription: false });
        }
    };
    
    const onBulkScheduleAll = async () => {
        let hasError = false;
        const postsToSchedule: ScheduledPost[] = [];
        let updatedBulkPosts = [...bulkPosts];

        for (const item of bulkPosts) {
            if (!item.imageFile || item.targetIds.length === 0) {
                updatedBulkPosts = updatedBulkPosts.map(p => p.id === item.id ? { ...p, error: 'الرجاء إضافة صورة واختيار وجهة واحدة على الأقل.'} : p);
                hasError = true;
                continue;
            }
             if (new Date(item.scheduleDate).getTime() < Date.now()) {
                updatedBulkPosts = updatedBulkPosts.map(p => p.id === item.id ? { ...p, error: 'تاريخ الجدولة يجب أن يكون في المستقبل.' } : p);
                hasError = true;
                continue;
            }
        }
        
        setBulkPosts(updatedBulkPosts);

        if (hasError) {
            showNotification('error', 'يرجى إصلاح الأخطاء في القائمة قبل المتابعة.');
            return;
        }
        
        setIsSchedulingAll(true);
        let successCount = 0;
        
        for (const item of bulkPosts) {
            for (const targetId of item.targetIds) {
                const target = bulkSchedulerTargets.find(t => t.id === targetId);
                if (!target) continue;

                const postData: any = { message: item.text, source: item.imageFile };
                const isReminder = target.type === 'instagram';
                
                if (!isReminder) { // Can only schedule on Facebook pages directly
                    postData.scheduled_publish_time = Math.floor(new Date(item.scheduleDate).getTime() / 1000);
                }

                const endpoint = `/${target.type === 'page' ? target.id : target.parentPageId}/photos`;
                const response: any = await new Promise(resolve => window.FB.api(endpoint, 'POST', postData, (res: any) => resolve(res)));

                if (response && !response.error) {
                    const newScheduledPost: ScheduledPost = {
                        id: response.id,
                        text: item.text,
                        imageUrl: item.imagePreview,
                        imageFile: item.imageFile,
                        scheduledAt: new Date(item.scheduleDate),
                        isReminder: isReminder,
                        targetId: target.id,
                        targetInfo: { name: target.name, avatarUrl: target.picture.data.url, type: target.type }
                    };
                    postsToSchedule.push(newScheduledPost);
                    successCount++;
                } else {
                     onBulkUpdate(item.id, { error: `فشل الجدولة: ${response.error.message}` });
                     hasError = true;
                }
            }
        }
        
        setScheduledPosts(prev => [...prev, ...postsToSchedule]);
        setIsSchedulingAll(false);
        if(hasError) {
            showNotification('partial', `تم جدولة ${successCount} منشورًا بنجاح، لكن بعضها فشل.`);
        } else {
            showNotification('success', `تم جدولة جميع المنشورات (${successCount}) بنجاح!`);
            setBulkPosts([]);
        }
    };
    
    const handleGenerateInsights = async (postId: string) => {
        const post = publishedPosts.find(p => p.id === postId);
        if (!post || !aiClient || post.analytics.comments === 0) return;

        setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, isGeneratingInsights: true } } : p));
        try {
            const commentsResponse: any = await fetchWithPagination(`/${postId}/comments?fields=message&limit=100`, managedTarget.access_token);
            const comments = commentsResponse.map((c: any) => ({ message: c.message }));
            const insights = await generatePostInsights(aiClient, post.text, post.analytics, comments);
            setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, aiSummary: insights.performanceSummary, sentiment: insights.sentiment } } : p));
        } catch(e:any) {
            showNotification('error', `فشل تحليل المنشور: ${e.message}`);
        } finally {
            setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, isGeneratingInsights: false } } : p));
        }
    };
    
    const handleFetchPostAnalytics = async (postId: string) => {
        setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, loading: true } } : p));
        try {
            const fields = 'likes.summary(true),comments.summary(true),shares,insights.metric(post_impressions_unique){values}';
            const response: any = await new Promise(resolve => window.FB.api(`/${postId}?fields=${fields}`, (res: any) => resolve(res)));
            if(response && !response.error) {
                setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: {
                    ...p.analytics,
                    likes: response.likes?.summary?.total_count ?? 0,
                    comments: response.comments?.summary?.total_count ?? 0,
                    shares: response.shares?.count ?? 0,
                    reach: response.insights?.data?.[0]?.values?.[0]?.value ?? 0,
                    lastUpdated: new Date()
                } } : p));
                showNotification('success', 'تم تحديث إحصائيات المنشور.');
            } else {
                throw new Error(response?.error?.message || 'فشل جلب الإحصائيات');
            }
        } catch(e: any) {
            showNotification('error', `فشل تحديث الإحصائيات: ${e.message}`);
        } finally {
            setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, loading: false } } : p));
        }
    };
    
    const unreadCount = useMemo(() => inboxItems.filter(item => !item.isReplied).length, [inboxItems]);
    
    useEffect(() => {
        const interval = setInterval(() => {
           const reminders = scheduledPosts.filter(p => p.isReminder && new Date(p.scheduledAt) <= new Date());
           reminders.forEach(r => {
               showNotification('success', `🔔 حان وقت نشر تذكير انستجرام: "${r.text.substring(0,20)}..."`);
           });
        }, 60 * 1000); // Check every minute
        return () => clearInterval(interval);
    }, [scheduledPosts, showNotification]);

    useEffect(() => {
        if (view === 'inbox') {
            const processor = setTimeout(() => {
                processAutoReplies();
            }, 3000); // Wait 3 seconds before processing
            return () => clearTimeout(processor);
        }
    }, [view, inboxItems, autoResponderSettings, processAutoReplies]);
    
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
                    onImageChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            setSelectedImage(file);
                            setImagePreview(URL.createObjectURL(file));
                            if (aiClient) { // Auto-generate description
                                onBulkUpdate('temp', { isGeneratingDescription: true });
                                generateDescriptionForImage(aiClient, file, pageProfile)
                                    .then(desc => setPostText(desc))
                                    .catch(err => setComposerError(err.message))
                                    .finally(() => onBulkUpdate('temp', { isGeneratingDescription: false }));
                            }
                        }
                    }}
                    onImageGenerated={(file) => {
                        setSelectedImage(file);
                        setImagePreview(URL.createObjectURL(file));
                    }}
                    onImageRemove={() => { setSelectedImage(null); setImagePreview(null); }}
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
                <PostPreview
                  type={includeInstagram ? 'instagram' : 'facebook'}
                  postText={postText}
                  imagePreview={imagePreview}
                  pageName={includeInstagram ? linkedInstagramTarget?.name : managedTarget.name}
                  pageAvatar={includeInstagram ? linkedInstagramTarget?.picture.data.url : managedTarget.picture.data.url}
                />
            </div>
        );
      case 'drafts':
        return <DraftsList drafts={drafts} onLoad={handleLoadDraft} onDelete={handleDeleteDraft} />;
      case 'calendar':
        const now = new Date();
        const reminders = scheduledPosts.filter(p => p.isReminder && new Date(p.scheduledAt).toDateString() === now.toDateString());
        return (
            <div className="space-y-6">
                {reminders.length > 0 && (
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">تذكيرات النشر لهذا اليوم</h3>
                        <div className="space-y-4">
                            {reminders.map(post => (
                                <ReminderCard 
                                    key={post.id}
                                    post={post}
                                    onPublish={() => {
                                        setPublishingReminderId(post.id);
                                        // Simplified publish logic here, could be expanded
                                        showNotification('success', `جاري محاولة نشر "${post.text.substring(0, 20)}..."`);
                                        // This would ideally trigger the full publish flow
                                        setTimeout(() => setPublishingReminderId(null), 2000);
                                    }}
                                    isPublishing={publishingReminderId === post.id}
                                />
                            ))}
                        </div>
                    </div>
                )}
                <ContentCalendar posts={scheduledPosts} onDelete={handleDeleteScheduledPost} />
            </div>
        );
      case 'analytics':
        return <AnalyticsPage 
                    period={analyticsPeriod} 
                    onPeriodChange={setAnalyticsPeriod}
                    summaryData={summaryData}
                    aiSummary={performanceSummaryText}
                    isGeneratingSummary={isGeneratingSummary}
                    posts={filteredPosts}
                    isLoading={publishedPostsLoading}
                    onFetchAnalytics={handleFetchPostAnalytics}
                    onGenerateInsights={handleGenerateInsights}
                />;
      case 'bulk':
        return <BulkSchedulerPage
                    bulkPosts={bulkPosts}
                    onAddPosts={onBulkAdd}
                    onUpdatePost={onBulkUpdate}
                    onRemovePost={onBulkRemove}
                    onScheduleAll={onBulkScheduleAll}
                    isSchedulingAll={isSchedulingAll}
                    targets={bulkSchedulerTargets}
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
                  error={planError}
                  plan={contentPlan}
                  onGeneratePlan={async (request, images) => {
                      setIsGeneratingPlan(true);
                      setPlanError(null);
                      try {
                          const plan = await generateContentPlan(aiClient!, request, pageProfile, images);
                          setContentPlan(plan);
                          const historyItem: StrategyHistoryItem = {
                              id: `hist_${Date.now()}`,
                              request,
                              plan,
                              summary: `خطة ${request.type} - ${new Date().toLocaleString()}`,
                              createdAt: new Date().toISOString()
                          };
                          setStrategyHistory(prev => [historyItem, ...prev.slice(0, 19)]);
                      } catch (e: any) {
                          setPlanError(e.message);
                      } finally {
                          setIsGeneratingPlan(false);
                      }
                  }}
                  isSchedulingStrategy={isSchedulingStrategy}
                  onScheduleStrategy={handleScheduleStrategy}
                  onStartPost={handleStartPostFromPlan}
                  pageProfile={pageProfile}
                  strategyHistory={strategyHistory}
                  onLoadFromHistory={(plan) => { setContentPlan(plan); showNotification('success', 'تم تحميل الخطة من السجل.'); }}
                  onDeleteFromHistory={(id) => setStrategyHistory(prev => prev.filter(h => h.id !== id))}
              />
      case 'inbox':
        return <InboxPage 
                  items={inboxItems}
                  isLoading={isInboxLoading}
                  onReply={handleSmartReply}
                  onGenerateSmartReplies={(text) => generateSmartReplies(aiClient!, text, pageProfile)}
                  onFetchMessageHistory={fetchMessageHistory}
                  autoResponderSettings={autoResponderSettings}
                  onAutoResponderSettingsChange={setAutoResponderSettings}
                  onSync={async () => {
                      await onSyncHistory(managedTarget);
                      // Force a re-fetch of inbox items after sync
                      const dataKey = `zex-pages-data-${managedTarget.id}`;
                      const rawData = localStorage.getItem(dataKey);
                      if (rawData) {
                          const savedData = JSON.parse(rawData);
                           setInboxItems(savedData.inboxItems?.map((i:any) => ({
                                ...i, platform: i.platform || 'facebook',
                                timestamp: new Date(i.timestamp).toISOString()
                            })) || []);
                      }
                  }}
                  isSyncing={!!syncingTargetId}
                  aiClient={aiClient}
               />;
      case 'profile':
        return <PageProfilePage 
                    profile={pageProfile} 
                    onProfileChange={setPageProfile}
                    onFetchProfile={handleFetchProfile}
                    isFetchingProfile={isFetchingProfile}
                />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen">
      <Header
        onLogout={onLogout}
        isSimulationMode={isSimulationMode}
        pageName={managedTarget.name}
        onChangePage={onChangePage}
        onSettingsClick={onSettingsClick}
      />
      <div className="relative">
         {notification && (
            <div className={`fixed top-20 right-5 p-4 rounded-lg shadow-lg z-50 text-white animate-fadeIn ${notification.type === 'success' ? 'bg-green-500' : notification.type === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`}>
                {notification.message}
                <button onClick={() => setNotification(null)} className="absolute top-1 right-2 text-white font-bold">&times;</button>
            </div>
        )}
      </div>
      
      <main className="flex flex-col md:flex-row">
        <aside className="w-full md:w-64 bg-white dark:bg-gray-800 p-4 border-l dark:border-gray-700/50 flex-shrink-0">
          <nav className="space-y-2">
            <NavItem icon={<PencilSquareIcon className="w-5 h-5"/>} label="إنشاء منشور" active={view === 'composer'} onClick={() => setView('composer')} />
            <NavItem icon={<CalendarIcon className="w-5 h-5"/>} label="تقويم المحتوى" active={view === 'calendar'} onClick={() => setView('calendar')} />
            <NavItem icon={<ArchiveBoxIcon className="w-5 h-5"/>} label="المسودات" active={view === 'drafts'} onClick={() => setView('drafts')} />
            <NavItem icon={<QueueListIcon className="w-5 h-5"/>} label="الجدولة المجمعة" active={view === 'bulk'} onClick={() => setView('bulk')} />
            <NavItem icon={<ChartBarIcon className="w-5 h-5"/>} label="التحليلات" active={view === 'analytics'} onClick={() => setView('analytics')} />
            <NavItem icon={<InboxArrowDownIcon className="w-5 h-5"/>} label="البريد الوارد" active={view === 'inbox'} onClick={() => setView('inbox')} notificationCount={unreadCount} />
            <div className="pt-2 mt-2 border-t dark:border-gray-700">
                <h4 className="text-xs font-bold uppercase text-gray-400 mb-2 px-3">ميزات الذكاء الاصطناعي</h4>
                 <NavItem icon={<BrainCircuitIcon className="w-5 h-5"/>} label="مخطط المحتوى" active={view === 'planner'} onClick={() => setView('planner')} />
                 <NavItem icon={<UserCircleIcon className="w-5 h-5"/>} label="ملف الصفحة" active={view === 'profile'} onClick={() => setView('profile')} />
            </div>
             <div className="pt-2 mt-2 border-t dark:border-gray-700">
                <Button onClick={() => onSyncHistory(managedTarget)} isLoading={!!syncingTargetId} disabled={!!syncingTargetId} className="w-full" variant="secondary">
                  🔄 {syncingTargetId ? 'جاري المزامنة...' : 'مزامنة السجل الكامل'}
                </Button>
            </div>
          </nav>
        </aside>

        <div className="flex-grow p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900">
            {renderView()}
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;