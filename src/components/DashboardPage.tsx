

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

// New constants for data retention to prevent localStorage quota errors
const MAX_PUBLISHED_POSTS_TO_STORE = 100;
const MAX_INBOX_ITEMS_TO_STORE = 200;
const MAX_STRATEGY_HISTORY_TO_STORE = 20;


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
            strategyHistory: strategyHistory.slice(0, MAX_STRATEGY_HISTORY_TO_STORE),
            publishedPosts: publishedPosts.slice(0, MAX_PUBLISHED_POSTS_TO_STORE),
            inboxItems: inboxItems.slice(0, MAX_INBOX_ITEMS_TO_STORE),
            autoResponderSettings,
            repliedUsersPerPost
        };
        localStorage.setItem(dataKey, JSON.stringify(dataToStore));
    } catch(e: any) {
        console.error("Could not save data to localStorage:", e);
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
            showNotification('error', 'مساحة التخزين ممتلئة. تم حذف البيانات القديمة تلقائيًا. حاول المزامنة مرة أخرى.');
             // Clear out the largest data stores and retry
            const dataKey = `zex-pages-data-${managedTarget.id}`;
            const rawData = localStorage.getItem(dataKey);
            if (rawData) {
                const existingData = JSON.parse(rawData);
                existingData.publishedPosts = [];
                existingData.inboxItems = [];
                localStorage.setItem(dataKey, JSON.stringify(existingData));
            }
        }
    }
  }, [pageProfile, drafts, scheduledPosts, contentPlan, strategyHistory, publishedPosts, inboxItems, autoResponderSettings, repliedUsersPerPost, managedTarget.id, showNotification]);

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

  const handleSendMessage = useCallback(async (item: InboxItem, message: string): Promise<boolean> => {
    return new Promise(resolve => {
        if(isSimulationMode) { 
            if (item.conversationId) fetchMessageHistory(item.conversationId);
            resolve(true); 
            return; 
        }

        const requestBody: any = {
            recipient: { id: item.authorId },
            message: { text: message },
            messaging_type: 'RESPONSE',
            access_token: managedTarget.access_token
        };
        
        // For IG messages sent via Page conversations endpoint
        if (item.platform === 'instagram') {
             requestBody.platform = 'instagram';
        }

        window.FB.api(`/${managedTarget.id}/messages`, 'POST', requestBody, (response: any) => {
            if(response && !response.error) {
                if (item.conversationId) fetchMessageHistory(item.conversationId);
                resolve(true);
            } else {
                const errorMsg = response?.error?.message || 'فشل إرسال الرسالة';
                console.error(`Failed to send ${item.platform} message to recipient ${item.authorId} in conversation ${item.conversationId || 'new'}:`, response?.error);
                showNotification('error', `فشل إرسال الرسالة: ${errorMsg}`);
                resolve(false); 
            }
        });
    });
  }, [isSimulationMode, managedTarget.id, managedTarget.access_token, showNotification, fetchMessageHistory]);

  const handleReplyToComment = useCallback(async (item: InboxItem, message: string): Promise<boolean> => {
    return new Promise(resolve => {
        if(isSimulationMode) { resolve(true); return; }

        const endpoint = item.platform === 'instagram' ? `/${item.id}/replies` : `/${item.id}/comments`;
        const pageAccessToken = item.platform === 'instagram' 
            ? linkedInstagramTarget?.access_token || managedTarget.access_token 
            : managedTarget.access_token;
        
        if (!pageAccessToken) {
            showNotification('error', `لم يتم العثور على رمز الوصول لـ ${item.platform}`);
            resolve(false);
            return;
        }

        window.FB.api(endpoint, 'POST', { message, access_token: pageAccessToken }, (response: any) => {
            if (response && !response.error) {
                resolve(true);
            } else {
                const errorMsg = response?.error?.message || 'فشل الرد على التعليق';
                console.error(`Failed to reply to ${item.platform} comment ${item.id}:`, response?.error);
                showNotification('error', `فشل الرد على التعليق: ${errorMsg}`);
                resolve(false);
            }
        });
    });
  }, [isSimulationMode, managedTarget.access_token, linkedInstagramTarget, showNotification]);

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

        const processItem = async (item: InboxItem): Promise<boolean> => {
            for (const rule of rules) {
                if (!rule.enabled || rule.trigger.source !== item.type) continue;
                
                const keywords = rule.trigger.keywords.map(k => k.toLowerCase());
                const negativeKeywords = rule.trigger.negativeKeywords.map(k => k.toLowerCase());
                const itemText = item.text.toLowerCase();

                const hasNegative = negativeKeywords.length > 0 && negativeKeywords.some(nk => itemText.includes(nk));
                if (hasNegative) continue;

                let isMatch = false;
                if (keywords.length === 0) {
                    isMatch = true; // Rule with no keywords matches everything (if no negative keywords matched)
                } else {
                    switch (rule.trigger.matchType) {
                        case 'any': isMatch = keywords.some(k => itemText.includes(k)); break;
                        case 'all': isMatch = keywords.every(k => itemText.includes(k)); break;
                        case 'exact': isMatch = keywords.some(k => itemText === k); break;
                    }
                }
                
                if (isMatch) {
                    if (item.type === 'comment' && rule.replyOncePerUser && item.post) {
                        const repliedUsers = repliedUsersPerPost[item.post.id] || [];
                        if (repliedUsers.includes(item.authorId)) {
                            continue; // Skip, already replied to this user on this post
                        }
                    }

                    // A rule has matched, execute its actions
                    for (const action of rule.actions.filter(a => a.enabled)) {
                        if (action.messageVariations.length === 0) continue;
                        
                        const message = action.messageVariations[Math.floor(Math.random() * action.messageVariations.length)]
                                            .replace(/{user_name}/g, item.authorName);

                        let success = false;
                        if (action.type === 'public_reply' && item.type === 'comment') {
                            success = await handleReplyToComment(item, message);
                        } else if (action.type === 'private_reply' && item.type === 'comment' && item.can_reply_privately) {
                            success = await handleSendMessage(item, message);
                        } else if (action.type === 'direct_message' && item.type === 'message') {
                            success = await handleSendMessage(item, message);
                        }
                        
                        if (success && item.type === 'comment' && rule.replyOncePerUser && item.post) {
                           setRepliedUsersPerPost(prev => ({
                               ...prev,
                               [item.post!.id]: [...(prev[item.post!.id] || []), item.authorId]
                           }));
                        }
                    }
                    return true; // Item handled, stop processing more rules for it
                }
            }

            // No rules matched, check for fallback
            if (item.type === 'message') {
                if (fallback.mode === 'ai' && aiClient) {
                    const reply = await generateAutoReply(aiClient, item.text, pageProfile);
                    await handleSendMessage(item, reply.replace(/{user_name}/g, item.authorName));
                    return true;
                } else if (fallback.mode === 'static' && fallback.staticMessage) {
                    await handleSendMessage(item, fallback.staticMessage.replace(/{user_name}/g, item.authorName));
                    return true;
                }
            }

            return false; // Item not handled
        };

        const repliedItemIds: string[] = [];
        for (const item of itemsToProcess) {
            const handled = await processItem(item);
            if (handled) {
                repliedItemIds.push(item.id);
            }
        }

        if (repliedItemIds.length > 0) {
            setInboxItems(prev => prev.map(i => repliedItemIds.includes(i.id) ? { ...i, isReplied: true } : i));
        }

    } catch (error) {
        console.error("Error during auto-reply processing:", error);
    } finally {
        isProcessingReplies.current = false;
    }
  }, [inboxItems, autoResponderSettings, managedTarget.id, linkedInstagramTarget, aiClient, pageProfile, repliedUsersPerPost, handleReplyToComment, handleSendMessage]);


  const handleSyncInbox = useCallback(async () => {
    if (isSimulationMode) {
      showNotification('success', "تم تحديث صندوق الوارد الوهمي.");
      return;
    }
    if (isPolling) return;
    setIsPolling(true);
    
    try {
        const since = lastSyncTimestamp.current;
        const until = Math.floor(Date.now() / 1000);

        // 1. Fetch FB Comments
        const fbCommentsPath = `/${managedTarget.id}/feed?fields=comments.since(${since}).until(${until}).limit(50){id,from{id,name,picture{url}},message,created_time,parent{id},comments{from{id}},can_reply_privately,post}&limit=25`;
        const fbFeedData = await fetchWithPagination(fbCommentsPath, managedTarget.access_token);
        const newFbComments: InboxItem[] = fbFeedData.flatMap((post: any) => post.comments ? post.comments.data.map((comment: any): InboxItem => {
            const authorId = comment.from?.id;
            const authorPictureUrl = comment.from?.picture?.data?.url || (authorId ? `https://graph.facebook.com/${authorId}/picture?type=normal` : 'https://via.placeholder.com/40/cccccc/ffffff?text=?');
            const pageHasReplied = !!comment.comments?.data?.some((c: any) => c && c.from && c.from.id === managedTarget.id);
            return {
                id: comment.id, platform: 'facebook', type: 'comment', text: comment.message || '',
                authorName: comment.from?.name || 'مستخدم فيسبوك', authorId: authorId || 'Unknown',
                authorPictureUrl: authorPictureUrl, timestamp: new Date(comment.created_time).toISOString(),
                post: { id: post.id, message: post.message, picture: post.full_picture },
                parentId: comment.parent?.id, isReplied: pageHasReplied, can_reply_privately: comment.can_reply_privately,
            };
        }) : []);

        // 2. Fetch FB & IG Messages
        const convosPath = `/${managedTarget.id}/conversations?fields=id,snippet,updated_time,participants,messages.limit(1){from}&since=${since}&limit=100`;
        const igConvosPath = `${convosPath}&platform=instagram`;
        
        const [fbConvosData, igConvosData] = await Promise.all([
            fetchWithPagination(convosPath, managedTarget.access_token),
            linkedInstagramTarget ? fetchWithPagination(igConvosPath, managedTarget.access_token) : Promise.resolve([])
        ]);
        
        const processConvos = (convos: any[], platform: 'facebook' | 'instagram'): InboxItem[] => convos
            .filter(convo => new Date(convo.updated_time).getTime() > since * 1000)
            .map((convo: any) => {
                const participant = convo.participants.data.find((p: any) => p.id !== managedTarget.id);
                const participantId = participant?.id;
                const lastMessage = convo.messages?.data?.[0];
                const pageSentLastMessage = lastMessage?.from?.id === managedTarget.id;
                return {
                    id: convo.id, platform, type: 'message', text: convo.snippet,
                    authorName: participant?.name || (platform === 'instagram' ? 'مستخدم انستجرام' : 'مستخدم فيسبوك'),
                    authorId: participantId || 'Unknown',
                    authorPictureUrl: participantId ? `https://graph.facebook.com/${participantId}/picture?type=normal` : 'https://via.placeholder.com/40/cccccc/ffffff?text=?',
                    timestamp: new Date(convo.updated_time).toISOString(), conversationId: convo.id, isReplied: pageSentLastMessage
                };
            });
            
        const newFbMessages = processConvos(fbConvosData, 'facebook');
        const newIgMessages = processConvos(igConvosData, 'instagram');

        // 3. Fetch IG Comments (if IG linked)
        let newIgComments: InboxItem[] = [];
        if (linkedInstagramTarget) {
            const igPostsPath = `/${linkedInstagramTarget.id}/media?fields=id,caption,media_url,comments_count&since=${since}&limit=25`;
            const igPostsData = await fetchWithPagination(igPostsPath, managedTarget.access_token);
            const igCommentPromises = igPostsData.filter((p:any) => p.comments_count > 0).map(async (post: any) => {
                const commentsPath = `/${post.id}/comments?fields=id,from{id,username},text,timestamp,replies{from{id}}&since=${since}&limit=100`;
                const commentsData = await fetchWithPagination(commentsPath, managedTarget.access_token);
                return commentsData.map((comment: any): InboxItem => {
                    const pageHasReplied = !!comment.replies?.data?.some((c: any) => c && c.from && c.from.id === managedTarget.id);
                    return {
                        id: comment.id, platform: 'instagram', type: 'comment', text: comment.text || '',
                        authorName: comment.from?.username || 'مستخدم انستجرام', authorId: comment.from?.id || 'Unknown',
                        authorPictureUrl: 'https://via.placeholder.com/40/E4405F/FFFFFF?text=IG',
                        timestamp: new Date(comment.timestamp).toISOString(),
                        post: { id: post.id, message: post.caption, picture: post.media_url },
                        isReplied: pageHasReplied,
                    };
                });
            });
            const igCommentBatches = await Promise.all(igCommentPromises);
            newIgComments = igCommentBatches.flat();
        }
        
        // --- Merge data ---
        const allNewItems = [...newFbComments, ...newFbMessages, ...newIgComments, ...newIgMessages];
        if (allNewItems.length > 0) {
            setInboxItems(prevItems => {
                const itemMap = new Map(prevItems.map(item => [item.id, item]));
                allNewItems.forEach(item => itemMap.set(item.id, item));
                return Array.from(itemMap.values()).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            });
        }
        
        lastSyncTimestamp.current = until;
        showNotification('success', `تم تحديث البريد الوارد. تم العثور على ${allNewItems.length} عنصرًا جديدًا.`);
    } catch (e: any) {
        console.error("Inbox sync failed:", e);
        showNotification('error', `فشل تحديث البريد الوارد: ${e.message}`);
    } finally {
        setIsPolling(false);
    }
  }, [isSimulationMode, managedTarget, linkedInstagramTarget, fetchWithPagination, showNotification, isPolling]);

  const unreadCount = useMemo(() => {
    return inboxItems.filter(item => !item.isReplied).length;
  }, [inboxItems]);
  
  const handleInboxReply = async (item: InboxItem, message: string): Promise<boolean> => {
    setIsReplying(true);
    let success = false;
    if (item.type === 'comment') {
      success = await handleReplyToComment(item, message);
    } else if (item.type === 'message') {
      success = await handleSendMessage(item, message);
    }

    if (success) {
      setInboxItems(prev => prev.map(i => i.id === item.id ? { ...i, isReplied: true } : i));
      showNotification('success', 'تم إرسال الرد بنجاح.');
    }
    setIsReplying(false);
    return success;
  };

  const handleMarkAsDone = (itemId: string) => {
    setInboxItems(prev => prev.map(i => i.id === itemId ? { ...i, isReplied: true } : i));
    showNotification('success', 'تم تمييز المحادثة كمكتملة.');
  };

  const handleGenerateSmartReplies = async (commentText: string): Promise<string[]> => {
    if (!aiClient) return [];
    try {
      return await generateSmartReplies(aiClient, commentText, pageProfile);
    } catch (e: any) {
      showNotification('error', `فشل إنشاء الردود الذكية: ${e.message}`);
      return [];
    }
  };

  const renderView = () => {
    switch (view) {
      case 'composer':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <PostComposer
              onPublish={() => { throw new Error("handlePublish not implemented") }}
              onSaveDraft={() => { throw new Error("handleSaveDraft not implemented") }}
              isPublishing={isPublishing}
              postText={postText}
              onPostTextChange={setPostText}
              onImageChange={() => { throw new Error("handleImageChange not implemented") }}
              onImageGenerated={() => { throw new Error("handleImageGenerated not implemented") }}
              onImageRemove={() => { throw new Error("handleRemoveImage not implemented") }}
              imagePreview={imagePreview}
              selectedImage={selectedImage}
              isScheduled={isScheduled}
              onIsScheduledChange={setIsScheduled}
              scheduleDate={scheduleDate}
              onScheduleDateChange={setScheduleDate}
              error={composerError}
              aiClient={aiClient}
              stabilityApiKey={stabilityApiKey}
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
              pageName={managedTarget.name}
              pageAvatar={managedTarget.picture.data.url}
            />
          </div>
        );
      case 'calendar':
        return <ContentCalendar posts={scheduledPosts} onDelete={() => { throw new Error("handleDeleteScheduledPost not implemented") }} onEdit={() => { throw new Error("handleEditScheduledPost not implemented") }} onSync={syncScheduledPosts} isSyncing={isSyncingScheduled} />;
      case 'drafts':
        return <DraftsList drafts={drafts} onLoad={() => { throw new Error("handleLoadDraft not implemented") }} onDelete={() => { throw new Error("handleDeleteDraft not implemented") }} />;
      case 'analytics':
        return (
          <AnalyticsPage
            period={analyticsPeriod}
            onPeriodChange={setAnalyticsPeriod}
            summaryData={summaryData}
            aiSummary={performanceSummaryText}
            isGeneratingSummary={isGeneratingSummary}
            posts={filteredPosts}
            isLoading={publishedPostsLoading}
            onFetchAnalytics={() => { throw new Error("handleFetchPostAnalytics not implemented") }}
            onGenerateInsights={() => { throw new Error("handleGeneratePostInsights not implemented") }}
          />
        );
      case 'bulk':
        return (
            <BulkSchedulerPage
                bulkPosts={bulkPosts}
                onAddPosts={() => { throw new Error("handleAddBulkPosts not implemented") }}
                onUpdatePost={() => { throw new Error("handleUpdateBulkPost not implemented") }}
                onRemovePost={() => { throw new Error("handleRemoveBulkPost not implemented") }}
                onScheduleAll={() => { throw new Error("handleScheduleAllBulk not implemented") }}
                isSchedulingAll={isSchedulingAll}
                targets={bulkSchedulerTargets}
                aiClient={aiClient}
                onGenerateDescription={() => { throw new Error("handleGenerateBulkDescription not implemented") }}
                onGeneratePostFromText={() => { throw new Error("handleGenerateBulkPostFromText not implemented") }}
                schedulingStrategy={schedulingStrategy}
                onSchedulingStrategyChange={setSchedulingStrategy}
                weeklyScheduleSettings={weeklyScheduleSettings}
                onWeeklyScheduleSettingsChange={setWeeklyScheduleSettings}
                onReschedule={handleReschedule}
            />
        );
      case 'planner':
        return (
          <ContentPlannerPage
            aiClient={aiClient}
            isGenerating={isGeneratingPlan}
            error={planError}
            plan={contentPlan}
            onGeneratePlan={() => { throw new Error("handleGeneratePlan not implemented") }}
            isSchedulingStrategy={isSchedulingStrategy}
            onScheduleStrategy={() => { throw new Error("handleScheduleStrategy not implemented") }}
            onStartPost={() => { throw new Error("handleStartPostFromPlan not implemented") }}
            pageProfile={pageProfile}
            strategyHistory={strategyHistory}
            onLoadFromHistory={() => { throw new Error("handleLoadFromHistory not implemented") }}
            onDeleteFromHistory={() => { throw new Error("handleDeleteFromHistory not implemented") }}
          />
        );
      case 'inbox':
        return <InboxPage 
          items={inboxItems} 
          isLoading={isInboxLoading}
          onReply={handleInboxReply}
          onMarkAsDone={handleMarkAsDone}
          onGenerateSmartReplies={handleGenerateSmartReplies}
          onFetchMessageHistory={fetchMessageHistory}
          autoResponderSettings={autoResponderSettings}
          onAutoResponderSettingsChange={setAutoResponderSettings}
          onSync={handleSyncInbox}
          isSyncing={isPolling}
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
    <>
      <Header
        pageName={managedTarget.name}
        onChangePage={onChangePage}
        onLogout={onLogout}
        isSimulationMode={isSimulationMode}
        onSettingsClick={onSettingsClick}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />
      
      {notification && (
        <div className={`fixed top-20 right-5 p-4 rounded-lg shadow-lg z-50 animate-fade-in-down ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
            {notification.message}
            {notification.onUndo && (
                <button onClick={notification.onUndo} className="font-bold underline ml-4">تراجع</button>
            )}
        </div>
      )}

      <div className="flex flex-col md:flex-row min-h-[calc(100vh-68px)]">
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-white dark:bg-gray-800 p-4 border-r dark:border-gray-700/50 flex-shrink-0">
          <nav className="space-y-2">
            <NavItem icon={<PencilSquareIcon className="w-5 h-5" />} label="إنشاء منشور" active={view === 'composer'} onClick={() => setView('composer')} />
            <NavItem icon={<QueueListIcon className="w-5 h-5" />} label="الجدولة المجمعة" active={view === 'bulk'} onClick={() => setView('bulk')} />
            <NavItem icon={<BrainCircuitIcon className="w-5 h-5" />} label="استراتيجيات المحتوى" active={view === 'planner'} onClick={() => setView('planner')} />
            <NavItem icon={<CalendarIcon className="w-5 h-5" />} label="تقويم المحتوى" active={view === 'calendar'} onClick={() => setView('calendar')} />
            <NavItem icon={<ArchiveBoxIcon className="w-5 h-5" />} label="المسودات" active={view === 'drafts'} onClick={() => setView('drafts')} />
            <NavItem icon={<InboxArrowDownIcon className="w-5 h-5" />} label="صندوق الوارد" active={view === 'inbox'} onClick={() => setView('inbox')} notificationCount={unreadCount} isPolling={isPolling}/>
            <NavItem icon={<ChartBarIcon className="w-5 h-5" />} label="التحليلات" active={view === 'analytics'} onClick={() => setView('analytics')} />
            <NavItem icon={<UserCircleIcon className="w-5 h-5" />} label="ملف الصفحة" active={view === 'profile'} onClick={() => setView('profile')} />
          </nav>
          <div className="mt-8 pt-4 border-t dark:border-gray-700">
                <Button 
                    onClick={() => onSyncHistory(managedTarget)} 
                    isLoading={!!syncingTargetId} 
                    variant="secondary" 
                    className="w-full"
                >
                    <ArrowPathIcon className="w-5 h-5 ml-2" />
                    {syncingTargetId ? 'جاري المزامنة...' : 'مزامنة السجل الكامل'}
                </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-grow min-w-0 p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
          {publishingReminderId && (
              <div className="mb-4">
                  <ReminderCard 
                      post={scheduledPosts.find(p => p.id === publishingReminderId)!} 
                      onPublish={() => { throw new Error("handlePublishReminder not implemented") }}
                      isPublishing={isPublishing}
                  />
              </div>
          )}
          {renderView()}
        </main>
      </div>
    </>
  );
};

export default DashboardPage;
