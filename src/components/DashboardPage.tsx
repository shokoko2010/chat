
import React, { useState, useEffect, useMemo, useCallback, useRef, SetStateAction, Dispatch } from 'react';
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
import { generateDescriptionForImage, generateContentPlan, generatePerformanceSummary, generateOptimalSchedule, generatePostInsights, enhanceProfileFromFacebookData, generateSmartReplies, generateAutoReply, generatePostSuggestion, generateHashtags } from '../services/geminiService';
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
import ArrowPathIcon from './icons/ArrowPathIcon';


interface DashboardPageProps {
  managedTarget: Target;
  allTargets: Target[];
  onChangePage: () => void;
  onLogout: () => void;
  isSimulationMode: boolean;
  aiClient: GoogleGenAI | null;
  stabilityApiKey: string | null;
  onSettingsClick: () => void;
  fetchWithPagination: (path: string, accessToken?: string) => Promise<any[]>;
  onSyncHistory: (target: Target) => Promise<void>;
  syncingTargetId: string | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const NavItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    active: boolean;
    onClick: () => void;
    notificationCount?: number;
    isPolling?: boolean;
}> = ({ icon, label, active, onClick, notificationCount, isPolling }) => (
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
        {isPolling && <ArrowPathIcon className="w-4 h-4 text-gray-400 animate-spin mr-1" />}
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

const initialPageProfile: PageProfile = {
    description: '',
    services: '',
    contactInfo: '',
    website: '',
    currentOffers: '',
    address: '',
    country: '',
    language: 'ar',
    contentGenerationLanguages: ['ar'],
};


const DashboardPage: React.FC<DashboardPageProps> = ({ managedTarget, allTargets, onChangePage, onLogout, isSimulationMode, aiClient, stabilityApiKey, onSettingsClick, fetchWithPagination, onSyncHistory, syncingTargetId, theme, onToggleTheme }) => {
  const [view, setView] = useState<'composer' | 'calendar' | 'drafts' | 'analytics' | 'bulk' | 'planner' | 'inbox' | 'profile'>('composer');
  
  // Composer state
  const [postText, setPostText] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [composerError, setComposerError] = useState('');
  const [includeInstagram, setIncludeInstagram] = useState(false);
  const [editingScheduledPostId, setEditingScheduledPostId] = useState<string | null>(null);

  // Publishing state
  const [isPublishing, setIsPublishing] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'partial', message: string, onUndo?: () => void} | null>(null);
  const [publishingReminderId, setPublishingReminderId] = useState<string | null>(null);
  const [isReplying, setIsReplying] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Data state, managed per target
  const [pageProfile, setPageProfile] = useState<PageProfile>(initialPageProfile);
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
  
  // Real-time sync refs
  const lastSyncTimestamp = useRef<number>(Math.floor(Date.now() / 1000));
  const pollingIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingReplies = useRef(false);
  const [isPolling, setIsPolling] = useState(false);
  const [isSyncingScheduled, setIsSyncingScheduled] = useState(false);


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
    setEditingScheduledPostId(null);
  }, [linkedInstagramTarget]);

  const showNotification = useCallback((type: 'success' | 'error' | 'partial', message: string, onUndo?: () => void) => {
    setNotification({ type, message, onUndo });
    // Only set a dismiss timer for non-undoable notifications
    if (!onUndo) {
        setTimeout(() => {
            setNotification(currentNotif => (currentNotif?.message === message ? null : currentNotif));
        }, 5000);
    }
  }, []);
  
  const handleFetchProfile = useCallback(async () => {
    if (isSimulationMode) {
      setPageProfile({
        ...initialPageProfile,
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
                setPageProfile(prev => ({ ...prev, ...enhancedProfile, currentOffers: prev.currentOffers })); 
                showNotification('success', 'تم استرداد وتحسين بيانات الصفحة بنجاح!');
            } else {
                setPageProfile(prev => ({
                    ...prev,
                    description: rawProfileData.about,
                    services: rawProfileData.category,
                    contactInfo: rawProfileData.contact,
                    website: rawProfileData.website,
                    address: rawProfileData.address,
                    country: rawProfileData.country,
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

  const syncScheduledPosts = useCallback(async () => {
    if (isSimulationMode || managedTarget.type !== 'page') return;
    setIsSyncingScheduled(true);
    try {
        const path = `/${managedTarget.id}/scheduled_posts?fields=id,message,scheduled_publish_time&limit=100`;
        const fbPosts = await fetchWithPagination(path, managedTarget.access_token);

        const syncedPosts: ScheduledPost[] = fbPosts.map((post: any) => ({
            id: post.id,
            postId: post.id,
            text: post.message || 'منشور بصورة مجدول',
            scheduledAt: new Date(post.scheduled_publish_time * 1000),
            isReminder: false,
            isSynced: true,
            targetId: managedTarget.id,
            targetInfo: {
                name: managedTarget.name,
                avatarUrl: managedTarget.picture.data.url,
                type: 'page',
            },
        }));

        setScheduledPosts(prevPosts => {
            const localOnlyPosts = prevPosts.filter(p => !p.isSynced);
            const mergedMap = new Map<string, ScheduledPost>();

            syncedPosts.forEach(p => mergedMap.set(p.id, p));
            localOnlyPosts.forEach(p => mergedMap.set(p.id, p));

            return Array.from(mergedMap.values()).sort((a,b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
        });
        showNotification('success', 'تمت مزامنة التقويم مع فيسبوك.');
    } catch (e: any) {
        console.error('Failed to sync scheduled posts:', e);
        showNotification('error', `فشل مزامنة التقويم: ${e.message}`);
    } finally {
        setIsSyncingScheduled(false);
    }
  }, [managedTarget, isSimulationMode, fetchWithPagination, showNotification]);

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

    const loadedProfile = savedData.pageProfile || {};
    setPageProfile({ ...initialPageProfile, ...loadedProfile });

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
  
  const fetchMessageHistory = useCallback(async (conversationId: string) => {
    if (!conversationId) return;
    const response: any = await new Promise(resolve => window.FB.api(`/${conversationId}/messages`, { fields: 'id,message,from,created_time', access_token: managedTarget.access_token }, (res: any) => resolve(res)));
    if (response && response.data) {
        setInboxItems(prev => prev.map(item => item.conversationId === conversationId ? { ...item, messages: response.data.reverse() } : item));
    } else {
        console.error("Failed to fetch message history:", response?.error);
        showNotification('error', `فشل تحميل سجل الرسائل: ${response?.error?.message}`);
    }
  }, [managedTarget.access_token, showNotification]);

  const handleSendMessage = useCallback(async (recipientId: string, message: string, conversationId?: string): Promise<boolean> => {
    return new Promise(resolve => {
        if(isSimulationMode) { 
            if (conversationId) fetchMessageHistory(conversationId);
            resolve(true); 
            return; 
        }

        const requestBody = {
            recipient: { id: recipientId },
            message: { text: message },
            messaging_type: 'RESPONSE',
            access_token: managedTarget.access_token
        };

        window.FB.api(`/${managedTarget.id}/messages`, 'POST', requestBody, (response: any) => {
            if(response && !response.error) {
                if (conversationId) fetchMessageHistory(conversationId);
                resolve(true);
            } else {
                const errorMsg = response?.error?.message || 'فشل إرسال الرسالة';
                console.error(`Failed to send message to recipient ${recipientId} in conversation ${conversationId || 'new'}:`, response?.error);
                showNotification('error', `فشل إرسال الرسالة: ${errorMsg}`);
                resolve(false); 
            }
        });
    });
  }, [isSimulationMode, managedTarget.id, managedTarget.access_token, showNotification, fetchMessageHistory]);

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

  const processAutoReplies = useCallback(async () => {
    if (isProcessingReplies.current) return;
    isProcessingReplies.current = true;

    try {
        const { rules, fallback } = autoResponderSettings;
        if (rules.length === 0 && fallback.mode === 'off') {
            isProcessingReplies.current = false;
            return;
        }

        const itemsToProcess = inboxItems.filter(item => 
            !item.isReplied && 
            item.authorId !== managedTarget.id && 
            (!linkedInstagramTarget || item.authorId !== linkedInstagramTarget.id)
        );

        if (itemsToProcess.length === 0) {
            isProcessingReplies.current = false;
            return;
        }

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const newRepliedUsers = JSON.parse(JSON.stringify(repliedUsersPerPost));
        const newlyRepliedItemIds = new Set<string>();
        
        for (const item of itemsToProcess) {
            let itemHandled = false;
            const lowerCaseText = item.text.toLowerCase();
            const isRecentEnoughForPrivateReply = new Date(item.timestamp) > sevenDaysAgo;

            for (const rule of rules) {
                if (!rule.enabled || rule.trigger.source !== item.type) continue;
                
                const postId = item.post?.id || 'dm';
                if (item.type === 'comment' && rule.replyOncePerUser && (newRepliedUsers[postId] || []).includes(item.authorId)) {
                    continue;
                }

                const hasNegative = rule.trigger.negativeKeywords.filter(Boolean).some(nk => lowerCaseText.includes(nk.toLowerCase().trim()));
                if (hasNegative) continue;

                const keywords = rule.trigger.keywords.filter(Boolean).map(k => k.toLowerCase().trim());
                let matched = false;
                if (keywords.length === 0) {
                    matched = true;
                } else {
                    const matchType = rule.trigger.matchType;
                    if (matchType === 'any') matched = keywords.some(k => lowerCaseText.includes(k));
                    else if (matchType === 'all') matched = keywords.every(k => lowerCaseText.includes(k));
                    else if (matchType === 'exact') matched = keywords.some(k => lowerCaseText === k);
                }
                
                if (matched) {
                    let ruleMatchedAndActed = false;

                    // Handle Actions Sequentially
                    if (item.type === 'comment') {
                        const publicAction = rule.actions.find(a => a.type === 'public_reply' && a.enabled && a.messageVariations?.[0]);
                        const privateAction = rule.actions.find(a => a.type === 'private_reply' && a.enabled && a.messageVariations?.[0]);
                        
                        let publicReplySuccess = false;
                        if (publicAction) {
                            const message = publicAction.messageVariations[Math.floor(Math.random() * publicAction.messageVariations.length)];
                            const success = await handleReplyToComment(item.id, message.replace('{user_name}', item.authorName));
                            if (success) {
                                publicReplySuccess = true;
                                ruleMatchedAndActed = true;
                                showNotification('success', 'تم إرسال الرد العام بنجاح.');
                            }
                        }

                        if (privateAction && isRecentEnoughForPrivateReply) {
                            if (publicReplySuccess) {
                                await new Promise(resolve => setTimeout(resolve, 5000));
                            }
                            const message = privateAction.messageVariations[Math.floor(Math.random() * privateAction.messageVariations.length)];
                            const success = await handleSendMessage(item.authorId, message.replace('{user_name}', item.authorName));
                            if (success) {
                                ruleMatchedAndActed = true;
                                showNotification('success', 'تم إرسال الرسالة الخاصة بنجاح.');
                            }
                        }
                    } else if (item.type === 'message') {
                        const messageAction = rule.actions.find(a => a.type === 'direct_message' && a.enabled && a.messageVariations?.[0]);
                        if (messageAction) {
                            const message = messageAction.messageVariations[Math.floor(Math.random() * messageAction.messageVariations.length)];
                            const success = await handleSendMessage(item.authorId, message.replace('{user_name}', item.authorName), item.conversationId || item.id);
                            if (success) {
                                ruleMatchedAndActed = true;
                                showNotification('success', 'تم إرسال الرسالة الخاصة بنجاح.');
                            }
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
                        break; // Rule matched and acted, move to next item
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
                    const success = await handleSendMessage(item.authorId, fallbackMessage.replace('{user_name}', item.authorName), item.conversationId || item.id);
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
        }
    } catch(e: any) {
        console.error("Critical error in auto-reply processor:", e);
        showNotification('error', `حدث خطأ جسيم في نظام الرد التلقائي: ${e.message}`);
    } finally {
        isProcessingReplies.current = false;
    }
  }, [inboxItems, autoResponderSettings, repliedUsersPerPost, aiClient, pageProfile, showNotification, handleReplyToComment, handleSendMessage, managedTarget.id, linkedInstagramTarget]);


  
  const handleSmartReply = async (item: InboxItem, message: string): Promise<boolean> => {
    setIsReplying(true);
    const success = await (item.type === 'comment'
      ? handleReplyToComment(item.id, message)
      : handleSendMessage(item.authorId, message, item.conversationId!));

    if (success) {
      showNotification('success', 'تم إرسال الرد بنجاح.');
      // Mark as replied locally for immediate feedback
      setInboxItems(prev => prev.map(i => i.id === item.id ? { ...i, isReplied: true } : i));
    }
    // Notification for failure is handled inside the reply functions
    setIsReplying(false);
    return success;
  };
  
  const handleMarkAsDone = (itemId: string) => {
    setInboxItems(prev => prev.map(i => i.id === itemId ? { ...i, isReplied: true } : i));
    showNotification('success', 'تم تحديد المحادثة كمكتملة.');
  };

  const handleStartPostFromPlan = useCallback((item: ContentPlanItem) => {
    const fullText = `${item.hook}\n\n${item.headline}\n\n${item.body}`;
    setPostText(fullText);
    setView('composer');
    showNotification('success', 'تم نسخ اقتراح المنشور إلى أداة الإنشاء. يمكنك الآن تعديله ونشره.');
  }, [showNotification]);

  const handleDeleteDraft = (draftId: string) => {
    const draftToDelete = drafts.find(d => d.id === draftId);
    if (!draftToDelete) return;

    if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
    }
    
    setDrafts(prev => prev.filter(d => d.id !== draftId));

    const handleUndo = () => {
        setDrafts(prev => {
            const newDrafts = [draftToDelete, ...prev];
            return newDrafts.sort((a,b) => parseInt(b.id.split('_')[1]) - parseInt(a.id.split('_')[1]));
        });
        if (undoTimerRef.current) {
            clearTimeout(undoTimerRef.current);
            undoTimerRef.current = null;
        }
        setNotification(null);
    };
    
    showNotification('success', 'تم حذف المسودة.', handleUndo);

    undoTimerRef.current = setTimeout(() => {
        setNotification(null);
        undoTimerRef.current = null;
    }, 8000);
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
  
  const handleDeleteScheduledPost = async (postId: string) => {
    const postToDelete = scheduledPosts.find(p => p.id === postId || p.postId === postId);
    if (!postToDelete) return;

    if (postToDelete.isSynced && postToDelete.postId) {
        try {
            const response: any = await new Promise(resolve => window.FB.api(`/${postToDelete.postId}`, 'DELETE', { access_token: managedTarget.access_token }, (res: any) => resolve(res)));
            if (!response || response.error) {
                throw new Error(response?.error?.message || 'فشل حذف المنشور من فيسبوك.');
            }
            setScheduledPosts(prev => prev.filter(p => p.id !== postToDelete.id));
            showNotification('success', 'تم حذف المنشور المجدول من فيسبوك بنجاح.');
        } catch (e: any) {
            showNotification('error', `فشل الحذف من فيسبوك: ${e.message}`);
        }
    } else {
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        setScheduledPosts(prev => prev.filter(d => d.id !== postId));

        const handleUndo = () => {
            setScheduledPosts(prev => {
                const newPosts = [postToDelete, ...prev].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
                return newPosts;
            });
            if (undoTimerRef.current) {
                clearTimeout(undoTimerRef.current);
                undoTimerRef.current = null;
            }
            setNotification(null);
        };
        
        showNotification('success', 'تم إلغاء جدولة المنشور.', handleUndo);

        undoTimerRef.current = setTimeout(() => {
            setNotification(null);
            undoTimerRef.current = null;
        }, 8000);
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

  const handleEditFromCalendar = (postId: string) => {
        const postToLoad = scheduledPosts.find(p => p.id === postId);
        if (!postToLoad) {
            showNotification('error', 'لم يتم العثور على المنشور المجدول.');
            return;
        }

        if (postToLoad.publishedAt) {
            showNotification('error', 'لا يمكن تعديل منشور تم نشره بالفعل.');
            return;
        }

        if (postToLoad.imageUrl && !postToLoad.imageFile && !postToLoad.isSynced) {
            showNotification('error', 'لا يمكن تعديل منشور الصورة هذا لأنه تم تحميله في جلسة سابقة. يرجى إعادة إنشائه.');
            return;
        }

        setPostText(postToLoad.text);
        setImagePreview(postToLoad.imageUrl || null);
        setSelectedImage(postToLoad.imageFile || null);
        
        setIsScheduled(false);
        setScheduleDate('');
        
        setIncludeInstagram(postToLoad.targetInfo.type === 'instagram');
        
        setEditingScheduledPostId(postToLoad.id);
        
        setView('composer');
        showNotification('success', 'تم تحميل المنشور للتعديل. يمكنك نشره الآن.');
    };
    
  const handlePublish = async () => {
    setIsPublishing(true);
    setComposerError('');

    let fbError: Error | null = null;
    let igError: Error | null = null;
    let fbPostId: string | null = null;
    let igPostId: string | null = null;
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
        const postData: any = { access_token: managedTarget.access_token };
        if (postText) postData.message = postText;
        if (isScheduled && !isReminder) {
            postData.scheduled_publish_time = Math.floor(new Date(scheduleDate).getTime() / 1000);
            postData.published = false; // Important for scheduled photo posts
        }

        // Publish to Facebook
        if (selectedImage) {
            postData.source = selectedImage;
            const endpoint = `/${managedTarget.id}/photos`;
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

        // Publish to Instagram (if selected, image exists, and FB post was successful)
        if (fbPostId && includeInstagram && linkedInstagramTarget && selectedImage && !isReminder && !fbError) {
            try {
                // We need the public URL of the image just posted to Facebook.
                const postDetailsResponse: any = await new Promise(resolve => {
                    window.FB.api(`/${fbPostId}?fields=full_picture`, { access_token: managedTarget.access_token }, (res: any) => resolve(res));
                });

                if (postDetailsResponse.error || !postDetailsResponse.full_picture) {
                    throw new Error(`Failed to get image URL from Facebook post: ${postDetailsResponse.error?.message || 'URL not found'}`);
                }

                const igContainerParams: any = {
                    image_url: postDetailsResponse.full_picture,
                    caption: postText,
                    access_token: linkedInstagramTarget.access_token
                };

                const igContainerResponse: any = await new Promise(resolve => {
                    window.FB.api(`/${linkedInstagramTarget.id}/media`, 'POST', igContainerParams, (res: any) => resolve(res));
                });

                if (igContainerResponse.error) {
                    throw new Error(igContainerResponse.error.message);
                }

                const creationId = igContainerResponse.id;
                let igPublishResponse: any = {};
                
                // Poll for container readiness
                let pollCount = 0;
                while (pollCount < 15) { // Poll for up to 45 seconds
                    const statusResponse: any = await new Promise(resolve => {
                       window.FB.api(`/${creationId}?fields=status_code`, { access_token: linkedInstagramTarget.access_token }, (res: any) => resolve(res));
                    });

                    if (statusResponse.status_code === 'FINISHED') {
                        igPublishResponse = await new Promise(resolve => {
                            window.FB.api(`/${linkedInstagramTarget.id}/media_publish`, 'POST', { creation_id: creationId, access_token: linkedInstagramTarget.access_token }, (res: any) => resolve(res));
                        });
                        break;
                    } else if (statusResponse.status_code === 'ERROR' || statusResponse.status_code === 'EXPIRED') {
                        throw new Error(`Instagram media container failed with status: ${statusResponse.status_code}`);
                    }
                    
                    pollCount++;
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }

                if (!igPublishResponse.id) {
                     throw new Error('Instagram media publishing timed out or failed after container creation.');
                }
                if (igPublishResponse.error) {
                    throw new Error(igPublishResponse.error.message);
                } else {
                    igPostId = igPublishResponse.id;
                }
            } catch (e: any) {
                console.error("Instagram post error:", e);
                igError = new Error(`(انستجرام) ${e.message}`);
            }
        }
        
        const errorMessages: string[] = [];
        if (fbError) errorMessages.push(fbError.message);
        if (igError) errorMessages.push(igError.message);

        if (errorMessages.length > 0) {
            const fullErrorMessage = errorMessages.join(' و ');
            if (fbError) {
                showNotification('error', `فشل النشر. السبب الرئيسي: ${fullErrorMessage}`);
                setComposerError(fullErrorMessage);
            } else {
                showNotification('partial', `تم النشر على فيسبوك بنجاح، لكن فشل على انستجرام: ${igError!.message}`);
                clearComposer();
            }
        } else { // Full success
            if (isScheduled) {
                const newScheduledPost: ScheduledPost = {
                    id: fbPostId || `local_${Date.now()}`,
                    postId: fbPostId || undefined,
                    isSynced: !!fbPostId,
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
                if (isReminder) {
                    setScheduledPosts(prev => [...prev, newScheduledPost]);
                    showNotification('success', `تم حفظ تذكير للنشر على انستجرام بنجاح.`);
                } else {
                    setScheduledPosts(prev => [...prev, newScheduledPost]);
                    showNotification('success', 'تم جدولة المنشور بنجاح!');
                }
            } else {
                 if (editingScheduledPostId) {
                    setScheduledPosts(prev => 
                        prev.map(p => 
                            p.id === editingScheduledPostId 
                            ? { ...p, publishedAt: new Date().toISOString() } 
                            : p
                        )
                    );
                    if(fbPostId) {
                         const newPublishedPost: PublishedPost = {
                            id: fbPostId, pageId: managedTarget.id, pageName: managedTarget.name, pageAvatarUrl: managedTarget.picture.data.url,
                            text: postText, imagePreview: imagePreview, publishedAt: new Date(),
                            analytics: { likes: 0, comments: 0, shares: 0, reach: 0, loading: false, lastUpdated: new Date(), isGeneratingInsights: false }
                        };
                        setPublishedPosts(prev => [newPublishedPost, ...prev]);
                    }
                    showNotification('success', 'تم نشر المنشور المجدول وتحديثه في التقويم.');
                } else {
                    if (fbPostId) {
                        const newFbPost: PublishedPost = {
                            id: fbPostId, pageId: managedTarget.id, pageName: managedTarget.name, pageAvatarUrl: managedTarget.picture.data.url,
                            text: postText, imagePreview: imagePreview, publishedAt: new Date(),
                            analytics: { likes: 0, comments: 0, shares: 0, reach: 0, loading: false, lastUpdated: new Date(), isGeneratingInsights: false }
                        };
                        setPublishedPosts(prev => [newFbPost, ...prev]);
                    }
                    if (igPostId && linkedInstagramTarget) {
                        const newIgPost: PublishedPost = {
                            id: igPostId, pageId: linkedInstagramTarget.id, pageName: linkedInstagramTarget.name, pageAvatarUrl: linkedInstagramTarget.picture.data.url,
                            text: postText, imagePreview: imagePreview, publishedAt: new Date(),
                            analytics: { likes: 0, comments: 0, shares: 0, reach: 0, loading: false, lastUpdated: new Date(), isGeneratingInsights: false }
                        };
                        setPublishedPosts(prev => [newIgPost, ...prev]);
                    }
                    showNotification('success', 'تم النشر بنجاح على جميع المنصات!');
                }
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
        if (!postText.trim() && !imagePreview) return;
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
        clearComposer();
        showNotification('success', 'تم حفظ المنشور كمسودة.');
    };

    const handleFetchPostAnalytics = useCallback(async (postId: string) => {
      if (isSimulationMode) return;
      setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, loading: true } } : p));
      try {
          const fields = 'likes.summary(true),comments.summary(true),shares,insights.metric(post_impressions_unique){values}';
          const response: any = await new Promise(resolve => window.FB.api(`/${postId}?fields=${fields}`, { access_token: managedTarget.access_token }, (res: any) => resolve(res)));
          if (response && !response.error) {
              const updatedAnalytics = {
                  likes: response.likes?.summary?.total_count ?? 0,
                  comments: response.comments?.summary?.total_count ?? 0,
                  shares: response.shares?.count ?? 0,
                  reach: response.insights?.data?.[0]?.values?.[0]?.value ?? 0,
                  loading: false,
                  lastUpdated: new Date(),
              };
              setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, ...updatedAnalytics } } : p));
              showNotification('success', 'تم تحديث إحصائيات المنشور.');
          } else {
              throw new Error(response.error?.message || 'Failed to fetch post analytics.');
          }
      } catch (e: any) {
          console.error(`Failed to fetch analytics for post ${postId}:`, e);
          showNotification('error', `فشل تحديث الإحصائيات: ${e.message}`);
          setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, loading: false } } : p));
      }
    }, [isSimulationMode, managedTarget.access_token, showNotification]);

    const handleGeneratePostInsights = useCallback(async (postId: string) => {
        if (!aiClient) return;
        const post = publishedPosts.find(p => p.id === postId);
        if (!post) return;

        setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, isGeneratingInsights: true } } : p));
        try {
            let comments: { message: string }[] = [];
            if (post.analytics.comments && post.analytics.comments > 0) {
                const fetchedComments = await fetchWithPagination(`/${postId}/comments?fields=message&limit=100`, managedTarget.access_token);
                comments = fetchedComments.map(c => ({ message: c.message }));
            }
            
            const insights = await generatePostInsights(aiClient, post.text, post.analytics, comments);
            
            setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, isGeneratingInsights: false, aiSummary: insights.performanceSummary, sentiment: insights.sentiment } } : p));
        } catch (e: any) {
            console.error(`Failed to generate insights for post ${postId}:`, e);
            showNotification('error', `فشل تحليل المنشور: ${e.message}`);
            setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, isGeneratingInsights: false, aiSummary: `فشل التحليل: ${e.message}` } } : p));
        }
    }, [aiClient, publishedPosts, fetchWithPagination, managedTarget.access_token, showNotification]);
    
    const handleAddBulkPosts = useCallback((files: FileList) => {
        const newItems: BulkPostItem[] = Array.from(files).map(file => ({
            id: `bulk_${Date.now()}_${Math.random()}`,
            imageFile: file,
            imagePreview: URL.createObjectURL(file),
            text: '',
            scheduleDate: '',
            targetIds: [managedTarget.id],
        }));
        
        const postsToSchedule = [...bulkPosts, ...newItems];
        const rescheduled = rescheduleBulkPosts(postsToSchedule, schedulingStrategy, weeklyScheduleSettings);
        setBulkPosts(rescheduled);

    }, [bulkPosts, managedTarget.id, rescheduleBulkPosts, schedulingStrategy, weeklyScheduleSettings]);

    const handleUpdateBulkPost = (id: string, updates: Partial<BulkPostItem>) => {
        setBulkPosts(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)));
    };

    const handleRemoveBulkPost = (id: string) => {
        setBulkPosts(prev => prev.filter(p => p.id !== id));
    };

    const handleGenerateBulkDescription = useCallback(async (id: string) => {
        if (!aiClient) return;
        const item = bulkPosts.find(p => p.id === id);
        if (!item || !item.imageFile) return;

        handleUpdateBulkPost(id, { isGeneratingDescription: true });
        try {
            const description = await generateDescriptionForImage(aiClient, item.imageFile, pageProfile);
            handleUpdateBulkPost(id, { text: description, isGeneratingDescription: false });
        } catch(e: any) {
            handleUpdateBulkPost(id, { error: e.message, isGeneratingDescription: false });
        }
    }, [aiClient, bulkPosts, pageProfile]);

    const handleGenerateBulkPostFromText = useCallback(async (id: string) => {
        if (!aiClient) return;
        const item = bulkPosts.find(p => p.id === id);
        if (!item || !item.text) return;
        
        handleUpdateBulkPost(id, { isGeneratingDescription: true }); // Using same loading state
        try {
            const suggestion = await generatePostSuggestion(aiClient, item.text, pageProfile);
            handleUpdateBulkPost(id, { text: suggestion, isGeneratingDescription: false });
        } catch(e: any) {
            handleUpdateBulkPost(id, { error: e.message, isGeneratingDescription: false });
        }
    }, [aiClient, bulkPosts, pageProfile]);


    const handleScheduleAllBulk = useCallback(async () => {
        setIsSchedulingAll(true);
        const postsToSchedule = bulkPosts.filter(p => !p.error);
        const newScheduledPosts: ScheduledPost[] = [];
        
        for (const item of postsToSchedule) {
            if (!item.scheduleDate || item.targetIds.length === 0) {
                handleUpdateBulkPost(item.id, { error: "الرجاء تحديد تاريخ النشر ووجهة واحدة على الأقل."});
                continue;
            }

            // This is a simplified local scheduling. A real app would hit the API.
            item.targetIds.forEach(targetId => {
                const target = allTargets.find(t => t.id === targetId);
                if (target) {
                    newScheduledPosts.push({
                        id: `scheduled_${item.id}_${targetId}`,
                        text: item.text,
                        imageUrl: item.imagePreview,
                        imageFile: item.imageFile,
                        scheduledAt: new Date(item.scheduleDate),
                        isReminder: target.type === 'instagram',
                        targetId: target.id,
                        isSynced: false,
                        targetInfo: {
                            name: target.name,
                            avatarUrl: target.picture.data.url,
                            type: target.type
                        }
                    });
                }
            });
        }

        setScheduledPosts(prev => [...prev, ...newScheduledPosts].sort((a,b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()));
        setBulkPosts(prev => prev.filter(p => p.error));
        setIsSchedulingAll(false);
        if(newScheduledPosts.length > 0) {
            showNotification('success', `تمت إضافة ${postsToSchedule.length} منشورًا إلى تقويم المحتوى.`);
            setView('calendar');
        } else {
             showNotification('error', `لم يتم جدولة أي منشور. يرجى مراجعة الأخطاء.`);
        }
    }, [bulkPosts, allTargets, showNotification]);

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

    const handleGeneratePlan = useCallback(async (request: StrategyRequest, images?: File[]) => {
      if (!aiClient) return;
      setIsGeneratingPlan(true);
      setPlanError(null);
      try {
        const plan = await generateContentPlan(aiClient, request, pageProfile, images);
        setContentPlan(plan);

        const newHistoryItem: StrategyHistoryItem = {
            id: `hist_${Date.now()}`,
            request,
            plan,
            summary: request.type === 'standard' ? `خطة قياسية لـ ${request.duration}` :
                     request.type === 'campaign' ? `حملة: ${request.campaignName}` :
                     request.type === 'occasion' ? `حملة مناسبة: ${request.occasion}` :
                     request.type === 'pillar' ? `محتوى محوري: ${request.pillarTopic}` :
                     `خطة من ${images?.length || 0} صور`,
            createdAt: new Date().toISOString(),
        };
        setStrategyHistory(prev => [newHistoryItem, ...prev].slice(0, 20)); // Limit history

      } catch (e: any) {
        setPlanError(e.message);
        showNotification('error', `فشل إنشاء الخطة: ${e.message}`);
      } finally {
        setIsGeneratingPlan(false);
      }
    }, [aiClient, pageProfile, showNotification]);

    const handleLoadStrategyFromHistory = useCallback((plan: ContentPlanItem[]) => {
        setContentPlan(plan);
        showNotification('success', 'تم تحميل الخطة من السجل.');
    }, [showNotification]);

    const handleDeleteStrategyFromHistory = useCallback((id: string) => {
        setStrategyHistory(prev => prev.filter(item => item.id !== id));
        showNotification('success', 'تم حذف الاستراتيجية من السجل.');
    }, [showNotification]);

    const handleGenerateSmartReplies = useCallback(async (commentText: string): Promise<string[]> => {
        if (!aiClient) return [];
        try {
            const replies = await generateSmartReplies(aiClient, commentText, pageProfile);
            return replies;
        } catch (e: any) {
            showNotification('error', `فشل اقتراح الردود: ${e.message}`);
            return [];
        }
    }, [aiClient, pageProfile, showNotification]);
    
    const prevSyncingTargetId = useRef<string | null>(null);
    useEffect(() => {
        if(prevSyncingTargetId.current && syncingTargetId === null) {
            // Sync just finished, let's reload data from storage
            const dataKey = `zex-pages-data-${managedTarget.id}`;
            const rawData = localStorage.getItem(dataKey);
            const data = rawData ? JSON.parse(rawData) : {};
            if (data.inboxItems) {
                setInboxItems(data.inboxItems.map((i:any) => ({
                    ...i,
                    platform: i.platform || 'facebook',
                    timestamp: new Date(i.timestamp).toISOString(),
                    isReplied: i.isReplied,
                })));
            }
             if (data.publishedPosts) {
                setPublishedPosts(data.publishedPosts.map((p:any) => ({...p, publishedAt: new Date(p.publishedAt)})));
            }
            showNotification('success', 'تم تحديث البيانات بعد المزامنة.');
        }
        prevSyncingTargetId.current = syncingTargetId;
    }, [syncingTargetId, managedTarget.id, showNotification]);

    const unreadCount = useMemo(() => inboxItems.filter(i => !i.isReplied).length, [inboxItems]);

    const navItems = [
        { view: 'composer', label: 'إنشاء منشور', icon: <PencilSquareIcon className="w-5 h-5" /> },
        { view: 'planner', label: 'استراتيجيات المحتوى', icon: <BrainCircuitIcon className="w-5 h-5" /> },
        { view: 'bulk', label: 'الجدولة المجمعة', icon: <QueueListIcon className="w-5 h-5" /> },
        { view: 'calendar', label: 'تقويم المحتوى', icon: <CalendarIcon className="w-5 h-5" /> },
        { view: 'drafts', label: 'المسودات', icon: <ArchiveBoxIcon className="w-5 h-5" /> },
        { view: 'analytics', label: 'التحليلات', icon: <ChartBarIcon className="w-5 h-5" /> },
        { view: 'inbox', label: 'صندوق الوارد', icon: <InboxArrowDownIcon className="w-5 h-5" />, notificationCount: unreadCount, isPolling: isPolling },
        { view: 'profile', label: 'ملف الصفحة', icon: <UserCircleIcon className="w-5 h-5" /> },
    ];
    
    const renderView = () => {
        switch (view) {
          case 'composer': return <PostComposer onPublish={handlePublish} onSaveDraft={handleSaveDraft} isPublishing={isPublishing} postText={postText} onPostTextChange={setPostText} onImageChange={handleImageChange} onImageGenerated={handleImageGenerated} onImageRemove={handleImageRemove} imagePreview={imagePreview} selectedImage={selectedImage} isScheduled={isScheduled} onIsScheduledChange={setIsScheduled} scheduleDate={scheduleDate} onScheduleDateChange={setScheduleDate} error={composerError} aiClient={aiClient} stabilityApiKey={stabilityApiKey} managedTarget={managedTarget} linkedInstagramTarget={linkedInstagramTarget} includeInstagram={includeInstagram} onIncludeInstagramChange={setIncludeInstagram} pageProfile={pageProfile} />;
          case 'calendar': return <ContentCalendar posts={scheduledPosts} onDelete={handleDeleteScheduledPost} onEdit={handleEditFromCalendar} onSync={syncScheduledPosts} isSyncing={isSyncingScheduled} />;
          case 'drafts': return <DraftsList drafts={drafts} onLoad={handleLoadDraft} onDelete={handleDeleteDraft} />;
          case 'analytics': return <AnalyticsPage period={analyticsPeriod} onPeriodChange={setAnalyticsPeriod as Dispatch<SetStateAction<"7d" | "30d">> } summaryData={summaryData} aiSummary={performanceSummaryText} isGeneratingSummary={isGeneratingSummary} posts={filteredPosts} isLoading={publishedPostsLoading} onFetchAnalytics={handleFetchPostAnalytics} onGenerateInsights={handleGeneratePostInsights} />;
          case 'bulk': return <BulkSchedulerPage bulkPosts={bulkPosts} onAddPosts={handleAddBulkPosts} onUpdatePost={handleUpdateBulkPost} onRemovePost={handleRemoveBulkPost} onScheduleAll={handleScheduleAllBulk} isSchedulingAll={isSchedulingAll} targets={bulkSchedulerTargets} aiClient={aiClient} onGenerateDescription={handleGenerateBulkDescription} onGeneratePostFromText={handleGenerateBulkPostFromText} schedulingStrategy={schedulingStrategy} onSchedulingStrategyChange={setSchedulingStrategy} weeklyScheduleSettings={weeklyScheduleSettings} onWeeklyScheduleSettingsChange={setWeeklyScheduleSettings} onReschedule={handleReschedule} />;
          case 'planner': return <ContentPlannerPage aiClient={aiClient} isGenerating={isGeneratingPlan} error={planError} plan={contentPlan} onGeneratePlan={handleGeneratePlan} isSchedulingStrategy={isSchedulingStrategy} onScheduleStrategy={handleScheduleStrategy} onStartPost={handleStartPostFromPlan} pageProfile={pageProfile} strategyHistory={strategyHistory} onLoadFromHistory={handleLoadStrategyFromHistory} onDeleteFromHistory={handleDeleteStrategyFromHistory} />;
          case 'inbox': return <InboxPage items={inboxItems} isLoading={isInboxLoading} onReply={handleSmartReply} onMarkAsDone={handleMarkAsDone} onGenerateSmartReplies={handleGenerateSmartReplies} onFetchMessageHistory={fetchMessageHistory} autoResponderSettings={autoResponderSettings} onAutoResponderSettingsChange={setAutoResponderSettings} onSync={processAutoReplies} isSyncing={isReplying} aiClient={aiClient} />;
          case 'profile': return <PageProfilePage profile={pageProfile} onProfileChange={setPageProfile} onFetchProfile={handleFetchProfile} isFetchingProfile={isFetchingProfile} />;
          default: return <PostComposer onPublish={handlePublish} onSaveDraft={handleSaveDraft} isPublishing={isPublishing} postText={postText} onPostTextChange={setPostText} onImageChange={handleImageChange} onImageGenerated={handleImageGenerated} onImageRemove={handleImageRemove} imagePreview={imagePreview} selectedImage={selectedImage} isScheduled={isScheduled} onIsScheduledChange={setIsScheduled} scheduleDate={scheduleDate} onScheduleDateChange={setScheduleDate} error={composerError} aiClient={aiClient} stabilityApiKey={stabilityApiKey} managedTarget={managedTarget} linkedInstagramTarget={linkedInstagramTarget} includeInstagram={includeInstagram} onIncludeInstagramChange={setIncludeInstagram} pageProfile={pageProfile} />;
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900">
          <Header
            pageName={managedTarget.name}
            onChangePage={onChangePage}
            onLogout={onLogout}
            isSimulationMode={isSimulationMode}
            onSettingsClick={onSettingsClick}
            theme={theme}
            onToggleTheme={onToggleTheme}
          />
          {publishingReminderId && (
            <ReminderCard
              post={scheduledPosts.find(p => p.id === publishingReminderId)!}
              onPublish={handlePublish}
              isPublishing={isPublishing}
            />
          )}
          {notification && (
            <div
              className={`relative px-4 py-3 leading-normal ${
                notification.type === 'success'
                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                  : notification.type === 'error'
                  ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                  : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
              }`}
              role="alert"
            >
              <div className="flex justify-between items-center">
                <p>{notification.message}</p>
                <div>
                  {notification.onUndo && (
                    <Button variant="secondary" size="sm" onClick={notification.onUndo} className="mr-4">
                      تراجع
                    </Button>
                  )}
                  <button
                    className="font-bold"
                    onClick={() => setNotification(null)}
                  >
                    &times;
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="flex flex-1 overflow-hidden">
            <aside className="w-64 flex-shrink-0 bg-white dark:bg-gray-800 p-4 space-y-2 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
              {navItems.map(item => (
                <NavItem
                  key={item.view}
                  icon={item.icon}
                  label={item.label}
                  active={view === item.view}
                  onClick={() => setView(item.view as any)}
                  notificationCount={item.notificationCount}
                  isPolling={item.isPolling}
                />
              ))}
              <div className="pt-4 border-t dark:border-gray-700">
                <Button
                  variant="secondary"
                  onClick={() => onSyncHistory(managedTarget)}
                  isLoading={!!syncingTargetId}
                  disabled={!!syncingTargetId}
                  className="w-full"
                  title="مزامنة كاملة للتعليقات والمنشورات. قد يستغرق بعض الوقت."
                >
                  <ArrowPathIcon className="w-5 h-5 ml-2" />
                  مزامنة السجل الكامل
                </Button>
              </div>
            </aside>
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
              {renderView()}
            </main>
          </div>
        </div>
      );
};

export default DashboardPage;
