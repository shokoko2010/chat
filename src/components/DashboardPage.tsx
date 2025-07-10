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
            throw new Error(fbResponse?.error?.message || 'فشل استرداد بيانات الصفحة.');
        }
    } catch (e: any) {
        showNotification('error', e.message);
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
                setPerformanceSummaryText("حدث خطأ أثناء إنشاء الملخص.");
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
                console.error(`Failed to send message to ${conversationId}:`, response?.error);
                resolve(false); 
            }
        });
    });
  }, [isSimulationMode, managedTarget.access_token]);

  const handleReplyToComment = useCallback(async (commentId: string, message: string): Promise<boolean> => {
    return new Promise(resolve => {
        if(isSimulationMode) { resolve(true); return; }
        window.FB.api(`/${commentId}/comments`, 'POST', { message, access_token: managedTarget.access_token }, (response: any) => {
            if (response && !response.error) {
                resolve(true);
            } else {
                console.error(`Failed to reply to comment ${commentId}:`, response?.error);
                resolve(false);
            }
        });
    });
  }, [isSimulationMode, managedTarget.access_token]);

  const handlePrivateReplyToComment = useCallback(async (commentId: string, message: string): Promise<boolean> => {
    return new Promise(resolve => {
        if (isSimulationMode) { resolve(true); return; }
        window.FB.api(`/${commentId}/private_replies`, 'POST', { message, access_token: managedTarget.access_token }, (response: any) => {
            if (response && response.success) {
                resolve(true);
            } else {
                console.error(`Failed to send private reply to ${commentId}:`, response?.error || response);
                resolve(false);
            }
        });
    });
  }, [isSimulationMode, managedTarget.access_token]);

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
                    let anActionSucceeded = false;
                    const enabledActions = rule.actions.filter(a => a.enabled && a.messageVariations.length > 0 && a.messageVariations[0].trim() !== '');

                    // Sequential execution of actions
                    for (const action of enabledActions) {
                        const messageToSend = action.messageVariations[Math.floor(Math.random() * action.messageVariations.length)];
                        const finalMessage = messageToSend.replace('{user_name}', item.authorName);

                        let success = false;
                        if (action.type === 'public_reply' && item.type === 'comment') {
                            success = await handleReplyToComment(item.id, finalMessage);
                        } else if (action.type === 'private_reply' && item.type === 'comment') {
                            const isTopLevelComment = !item.parentId;
                            if (item.platform === 'facebook' && item.can_reply_privately && isTopLevelComment) {
                                success = await handlePrivateReplyToComment(item.id, finalMessage);
                            }
                        } else if (action.type === 'direct_message' && item.type === 'message') {
                            success = await handleSendMessage(item.conversationId || item.id, finalMessage);
                        }
                        
                        if (success) {
                            anActionSucceeded = true;
                        }
                    }

                    if (anActionSucceeded) {
                        itemHandled = true;
                        newlyRepliedItemIds.add(item.id);

                        if (item.type === 'comment' && rule.replyOncePerUser) {
                            if (!newRepliedUsers[postId]) newRepliedUsers[postId] = [];
                            if (!newRepliedUsers[postId].includes(item.authorId)) {
                                newRepliedUsers[postId].push(item.authorId);
                            }
                        }
                        break; // Found a matching rule, move to next item.
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
    } catch(e) {
        console.error("Critical error in auto-reply processor:", e);
    } finally {
        isProcessingReplies.current = false;
    }
  }, [inboxItems, autoResponderSettings, repliedUsersPerPost, aiClient, pageProfile, showNotification, handleReplyToComment, handlePrivateReplyToComment, handleSendMessage, managedTarget.id, linkedInstagramTarget]);


  const fetchMessageHistory = async (conversationId: string) => {
    const response: any = await new Promise(resolve => window.FB.api(`/${conversationId}/messages`, { fields: 'id,message,from,created_time', access_token: managedTarget.access_token }, (res: any) => resolve(res)));
    if (response && response.data) {
      setInboxItems(prevItems => prevItems.map(item => item.id === conversationId ? { ...item, messages: response.data.reverse() } : item));
    }
  };

  const handleInboxSync = async () => {
    await onSyncHistory(managedTarget);
    const dataKey = `zex-pages-data-${managedTarget.id}`;
    const rawData = localStorage.getItem(dataKey);
    const data = rawData ? JSON.parse(rawData) : {};
    const syncedItems = data.inboxItems || [];
    setInboxItems(syncedItems);
  };
  
  const handleClearCache = () => {
    if (window.confirm("هل أنت متأكد أنك تريد حذف جميع البيانات المخبأة لهذه الصفحة؟ هذا الإجراء لا يمكن التراجع عنه.")) {
      const dataKey = `zex-pages-data-${managedTarget.id}`;
      localStorage.removeItem(dataKey);

      setPageProfile({ description: '', services: '', contactInfo: '', website: '', currentOffers: '', address: '', country: '' });
      setScheduledPosts([]);
      setDrafts([]);
      setContentPlan(null);
      setStrategyHistory([]);
      setPublishedPosts([]);
      setInboxItems([]);
      setAutoResponderSettings(initialAutoResponderSettings);
      setRepliedUsersPerPost({});
      
      showNotification('success', 'تم حذف ذاكرة التخزين المؤقت بنجاح. قم بالمزامنة الكاملة الآن.');
    }
  };
  
  const pollForNewItems = useCallback(async () => {
    if (syncingTargetId || isProcessingReplies.current) return;

    const pageAccessToken = managedTarget.access_token;
    if (!pageAccessToken) return;

    const lastTimestamp = inboxItems.length > 0 ? new Date(inboxItems[0].timestamp).getTime() : Date.now() - (15 * 60 * 1000);
    const since = Math.floor(lastTimestamp / 1000) + 1;
    
    const defaultPicture = 'https://via.placeholder.com/40/cccccc/ffffff?text=?';

    let newItems: InboxItem[] = [];

    try {
        // Fetch Facebook Page items
        const fbPostFields = "id,message,full_picture,comments.order(reverse_chronological).since(" + since + "){id,from{id,name,picture{url}},message,created_time,parent{id},comments{from{id}},can_reply_privately}";
        const fbRecentPostsData = await fetchWithPagination(`/${managedTarget.id}/published_posts?fields=${fbPostFields}&limit=10`, pageAccessToken);
        
        fbRecentPostsData.forEach(post => {
            if (post.comments?.data) {
                const postComments: InboxItem[] = post.comments.data.map((comment: any): InboxItem => {
                    const pageHasReplied = !!comment.comments?.data?.some((c: any) => c.from.id === managedTarget.id);
                    return {
                        id: comment.id, platform: 'facebook', type: 'comment', text: comment.message || '',
                        authorName: comment.from?.name || 'مستخدم فيسبوك', authorId: comment.from?.id || 'Unknown',
                        authorPictureUrl: comment.from?.picture?.data?.url || `https://graph.facebook.com/${comment.from?.id}/picture`,
                        timestamp: new Date(comment.created_time).toISOString(),
                        post: { id: post.id, message: post.message, picture: post.full_picture },
                        parentId: comment.parent?.id, isReplied: pageHasReplied,
                        can_reply_privately: comment.can_reply_privately,
                    };
                });
                newItems.push(...postComments);
            }
        });

        const convosData = await fetchWithPagination(`/${managedTarget.id}/conversations?fields=id,snippet,updated_time,participants,messages.limit(1){from}&since=${since}`, pageAccessToken);
        const fbNewMessages: InboxItem[] = convosData.map((convo: any) => {
            const participant = convo.participants.data.find((p: any) => p.id !== managedTarget.id);
            const lastMessage = convo.messages?.data?.[0];
            const pageSentLastMessage = lastMessage?.from?.id === managedTarget.id;
            return {
                id: convo.id, platform: 'facebook', type: 'message', text: convo.snippet,
                authorName: participant?.name || 'مستخدم غير معروف', authorId: participant?.id || 'Unknown',
                authorPictureUrl: `https://graph.facebook.com/${participant?.id}/picture?type=normal`,
                timestamp: new Date(convo.updated_time).toISOString(),
                conversationId: convo.id, isReplied: pageSentLastMessage
            };
        });
        newItems.push(...fbNewMessages);
        
        // Fetch Instagram items if linked
        if (linkedInstagramTarget?.access_token) {
            const igAccessToken = linkedInstagramTarget.access_token;
            const igPostFields = "id,caption,media_url,comments.order(reverse_chronological).since(" + since + "){id,from{id,username},text,timestamp,replies{from{id}}}";
            const igRecentPostsData = await fetchWithPagination(`/${linkedInstagramTarget.id}/media?fields=${igPostFields}&limit=10`, igAccessToken);
            
            igRecentPostsData.forEach(post => {
                if (post.comments?.data) {
                    const igComments: InboxItem[] = post.comments.data.map((comment: any): InboxItem => {
                        const pageHasReplied = !!comment.replies?.data?.some((c: any) => c.from.id === linkedInstagramTarget.id);
                        return {
                            id: comment.id, platform: 'instagram', type: 'comment', text: comment.text || '',
                            authorName: comment.from?.username || 'مستخدم انستجرام', authorId: comment.from?.id || 'Unknown',
                            authorPictureUrl: defaultPicture,
                            timestamp: new Date(comment.timestamp).toISOString(),
                            post: { id: post.id, message: post.caption, picture: post.media_url },
                            parentId: comment.parent?.id, isReplied: pageHasReplied
                        };
                    });
                    newItems.push(...igComments);
                }
            });
        }
        
        if (newItems.length > 0) {
            setInboxItems(prev => {
                const combined = [...newItems, ...prev];
                const uniqueIds = new Set<string>();
                const uniqueItems = combined.filter(item => {
                    if (uniqueIds.has(item.id)) {
                        return false;
                    } else {
                        uniqueIds.add(item.id);
                        return true;
                    }
                });
                return uniqueItems.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            });
        }
        
    } catch (error) {
        console.error("Error polling for new items:", error);
    }
  }, [syncingTargetId, isProcessingReplies.current, managedTarget, linkedInstagramTarget, inboxItems, fetchWithPagination]);
  
  // Polling Effect
  useEffect(() => {
    const isInboxVisible = view === 'inbox';
    if (isInboxVisible && autoResponderSettings.rules.some(r => r.enabled)) {
      const interval = setInterval(pollForNewItems, 30000); // Poll every 30 seconds
      return () => clearInterval(interval);
    }
  }, [view, autoResponderSettings, pollForNewItems]);
  
  // Auto Responder trigger Effect
  useEffect(() => {
    if (view === 'inbox' && autoResponderSettings.rules.some(r => r.enabled)) {
      processAutoReplies();
    }
  }, [inboxItems, view, autoResponderSettings, processAutoReplies]);
  
  const handleReplySubmit = async (item: InboxItem, message: string) => {
    let success = false;
    if (item.type === 'message') {
        success = await handleSendMessage(item.conversationId || item.id, message);
    } else { // comment
        success = await handleReplyToComment(item.id, message);
    }
    
    if(success) {
      setInboxItems(prev => prev.map(i => i.id === item.id ? { ...i, isReplied: true } : i));
    }
    return success;
  };
  
  const handleGenerateSmartReplies = async (commentText: string): Promise<string[]> => {
    if(!aiClient) return [];
    try {
      const replies = await generateSmartReplies(aiClient, commentText, pageProfile);
      return replies;
    } catch (e: any) {
      showNotification('error', e.message);
      return [];
    }
  };
  
  const handleSaveDraft = () => {
    const newDraft: Draft = {
        id: `draft-${Date.now()}`,
        text: postText,
        imageFile: selectedImage,
        imagePreview: imagePreview,
        targetId: managedTarget.id,
        isScheduled: isScheduled,
        scheduleDate: scheduleDate,
        includeInstagram: includeInstagram,
    };
    setDrafts(prev => [newDraft, ...prev]);
    showNotification('success', "تم حفظ المسودة بنجاح!");
    clearComposer();
  };
  
  const handleLoadDraft = (draftId: string) => {
    const draft = drafts.find(d => d.id === draftId);
    if (draft) {
      setPostText(draft.text);
      // NOTE: We can't re-assign the File object for security reasons,
      // but we can show the preview. The user must re-select the file
      // if they want to publish the draft with an image.
      setImagePreview(draft.imagePreview);
      setSelectedImage(null); // Clear file object
      setIsScheduled(draft.isScheduled);
      setScheduleDate(draft.scheduleDate);
      setIncludeInstagram(draft.includeInstagram);
      setDrafts(prev => prev.filter(d => d.id !== draftId)); // Remove from drafts
      setView('composer');
      showNotification('success', 'تم تحميل المسودة. إذا كانت تحتوي على صورة، يرجى إعادة اختيارها.');
    }
  };

  const handleDeleteDraft = (draftId: string) => {
    setDrafts(prev => prev.filter(d => d.id !== draftId));
    showNotification('success', 'تم حذف المسودة.');
  };

  const handlePublish = async () => {
    if (!postText.trim() && !selectedImage) {
        setComposerError('لا يمكن نشر منشور فارغ.');
        return;
    }
    if (includeInstagram && !selectedImage) {
        setComposerError('منشورات انستجرام تتطلب صورة.');
        return;
    }

    setIsPublishing(true);
    setComposerError('');

    const isReminder = includeInstagram && isScheduled;

    if (isScheduled && !isReminder) {
        const schedule = {
            id: `scheduled-${Date.now()}`,
            text: postText,
            imageUrl: imagePreview || undefined, // Use preview URL for calendar
            imageFile: selectedImage || undefined,
            scheduledAt: new Date(scheduleDate),
            isReminder: false,
            targetInfo: {
                name: managedTarget.name,
                avatarUrl: managedTarget.picture.data.url,
                type: managedTarget.type,
            }
        };
        const newScheduledPosts: ScheduledPost[] = [...scheduledPosts, schedule];
        if (linkedInstagramTarget && includeInstagram) {
            newScheduledPosts.push({
                ...schedule,
                id: `scheduled-ig-${Date.now()}`,
                targetId: linkedInstagramTarget.id,
                targetInfo: {
                    name: linkedInstagramTarget.name,
                    avatarUrl: linkedInstagramTarget.picture.data.url,
                    type: linkedInstagramTarget.type,
                }
            });
        }
        setScheduledPosts(newScheduledPosts);
        showNotification('success', `تم جدولة ${newScheduledPosts.length > scheduledPosts.length ? 'منشورين' : 'منشور واحد'} بنجاح!`);
        clearComposer();
    } else if (isReminder) {
         const reminder = {
            id: `reminder-${Date.now()}`,
            text: postText,
            imageUrl: imagePreview || undefined,
            imageFile: selectedImage || undefined,
            scheduledAt: new Date(scheduleDate),
            isReminder: true,
            targetId: linkedInstagramTarget!.id,
            targetInfo: { name: linkedInstagramTarget!.name, avatarUrl: linkedInstagramTarget!.picture.data.url, type: 'instagram' as const }
        };
        const fbSchedule = {
            ...reminder,
            id: `scheduled-fb-${Date.now()}`,
            isReminder: false,
            targetId: managedTarget.id,
            targetInfo: { name: managedTarget.name, avatarUrl: managedTarget.picture.data.url, type: 'page' as const }
        };
        setScheduledPosts(prev => [...prev, reminder, fbSchedule]);
        showNotification('success', "تمت جدولة منشور فيسبوك وإضافة تذكير لمنشور انستجرام.");
        clearComposer();
    } else {
        // Direct publish
        const targetsToPublish = [managedTarget];
        if (includeInstagram && linkedInstagramTarget) {
            targetsToPublish.push(linkedInstagramTarget);
        }

        const publishPromises = targetsToPublish.map(target => {
            return new Promise<{success: boolean, targetName: string}>(resolve => {
                const endpoint = target.type === 'page' ? `/${target.id}/photos` : `/${target.id}/media`;
                
                let apiParams: any = { access_token: target.access_token };
                
                if (selectedImage) {
                    const formData = new FormData();
                    formData.append('source', selectedImage);
                    if (target.type === 'page') {
                        formData.append('caption', postText);
                    } else { // instagram
                        apiParams.caption = postText;
                        apiParams.media_type = 'IMAGE';
                    }
                    // For photos, we must use FormData
                    window.FB.api(endpoint, 'POST', formData, (response: any) => {
                         if (response && response.id) {
                            if (target.type === 'instagram') { // Need to publish the container
                                window.FB.api(`/${target.id}/media_publish`, 'POST', { creation_id: response.id }, (publishResponse: any) => {
                                    if (publishResponse && !publishResponse.error) resolve({success: true, targetName: target.name});
                                    else {console.error(`IG Publish Error for ${target.name}:`, publishResponse?.error); resolve({success:false, targetName: target.name});}
                                });
                            } else resolve({success: true, targetName: target.name});
                         } else { console.error(`Photo Upload Error for ${target.name}:`, response?.error); resolve({success:false, targetName: target.name}); }
                    });
                } else { // Text only
                    apiParams.message = postText;
                    window.FB.api(`/${target.id}/feed`, 'POST', apiParams, (response: any) => {
                        if (response && !response.error) resolve({success: true, targetName: target.name});
                        else { console.error(`Feed Post Error for ${target.name}:`, response?.error); resolve({success: false, targetName: target.name}); }
                    });
                }
            });
        });
        const results = await Promise.all(publishPromises);
        const successful = results.filter(r => r.success).map(r => r.targetName);
        const failed = results.filter(r => !r.success).map(r => r.targetName);

        if(failed.length > 0) {
            showNotification('partial', `تم النشر بنجاح على: ${successful.join(', ')}. فشل النشر على: ${failed.join(', ')}`);
        } else {
            showNotification('success', 'تم النشر بنجاح على جميع الوجهات!');
        }
        clearComposer();
    }
    setIsPublishing(false);
  };
  
  const handlePublishFromReminder = async (postId: string) => {
    const postToPublish = scheduledPosts.find(p => p.id === postId);
    if (!postToPublish || !postToPublish.imageFile || !linkedInstagramTarget) return;

    setPublishingReminderId(postId);
    try {
      const formData = new FormData();
      formData.append('source', postToPublish.imageFile);
      
      const creationResponse:any = await new Promise(resolve => window.FB.api(`/${linkedInstagramTarget.id}/media`, 'POST', formData, res => resolve(res)));
      
      if(creationResponse && creationResponse.id) {
          const publishResponse: any = await new Promise(resolve => window.FB.api(`/${linkedInstagramTarget.id}/media_publish`, 'POST', { creation_id: creationResponse.id, caption: postToPublish.text }, res => resolve(res)));
          if(publishResponse && !publishResponse.error){
              showNotification('success', `تم نشر التذكير بنجاح على ${linkedInstagramTarget.name}`);
              setScheduledPosts(prev => prev.filter(p => p.id !== postId));
          } else throw new Error(publishResponse?.error?.message || "فشل نشر حاوية انستجرام.");
      } else throw new Error(creationResponse?.error?.message || "فشل تحميل صورة انستجرام.");

    } catch (e: any) {
        showNotification('error', `فشل نشر التذكير: ${e.message}`);
    } finally {
        setPublishingReminderId(null);
    }
  };

  const handleDeleteScheduledPost = (postId: string) => {
    setScheduledPosts(prev => prev.filter(p => p.id !== postId));
    showNotification('success', 'تم حذف المنشور المجدول.');
  };

  const handleFetchPostAnalytics = useCallback(async (postId: string) => {
    const targetPostIndex = publishedPosts.findIndex(p => p.id === postId);
    if (targetPostIndex === -1) return;

    setPublishedPosts(prev => prev.map((p, i) => i === targetPostIndex ? { ...p, analytics: { ...p.analytics, loading: true } } : p));
    
    try {
        const fields = 'likes.summary(true),comments.summary(true),shares';
        const response: any = await new Promise(resolve => {
            window.FB.api(`/${postId}?fields=${fields}`, (res: any) => resolve(res));
        });

        if (response && !response.error) {
            setPublishedPosts(prev => prev.map((p, i) =>
                i === targetPostIndex
                    ? {
                        ...p,
                        analytics: {
                            ...p.analytics,
                            likes: response.likes?.summary?.total_count ?? p.analytics.likes,
                            comments: response.comments?.summary?.total_count ?? p.analytics.comments,
                            shares: response.shares?.count ?? p.analytics.shares,
                            loading: false,
                            lastUpdated: new Date()
                        }
                      }
                    : p
            ));
        } else { throw new Error(response.error?.message || 'Unknown error'); }
    } catch (e: any) {
        console.error(`Error fetching analytics for ${postId}:`, e.message);
        setPublishedPosts(prev => prev.map((p, i) => i === targetPostIndex ? { ...p, analytics: { ...p.analytics, loading: false } } : p));
    }
  }, [publishedPosts]);
  
  const handleGeneratePostInsights = useCallback(async (postId: string) => {
    if (!aiClient) return;

    const targetPostIndex = publishedPosts.findIndex(p => p.id === postId);
    if (targetPostIndex === -1) return;
    const post = publishedPosts[targetPostIndex];
    if (post.analytics.comments === 0) return;
    
    setPublishedPosts(prev => prev.map((p, i) => i === targetPostIndex ? { ...p, analytics: { ...p.analytics, isGeneratingInsights: true } } : p));

    try {
        const commentsResponse: any = await fetchWithPagination(`/${postId}/comments?fields=message&limit=50`);
        const insights = await generatePostInsights(aiClient, post.text, post.analytics, commentsResponse);
        
        setPublishedPosts(prev => prev.map((p, i) =>
            i === targetPostIndex
                ? {
                    ...p,
                    analytics: {
                        ...p.analytics,
                        aiSummary: insights.performanceSummary,
                        sentiment: insights.sentiment,
                        isGeneratingInsights: false
                    }
                  }
                : p
        ));
    } catch(e: any) {
         console.error(`Error generating insights for ${postId}:`, e.message);
         setPublishedPosts(prev => prev.map((p, i) => i === targetPostIndex ? { ...p, analytics: { ...p.analytics, isGeneratingInsights: false, aiSummary: "فشل إنشاء التحليل." } } : p));
    }
  }, [aiClient, publishedPosts, fetchWithPagination]);

  const handleGeneratePlan = useCallback(async (request: StrategyRequest, images?: File[]) => {
    if (!aiClient) return;
    setIsGeneratingPlan(true);
    setPlanError(null);
    try {
        const plan = await generateContentPlan(aiClient, request, pageProfile, images);
        setContentPlan(plan);
        const historyItem: StrategyHistoryItem = {
            id: `hist_${Date.now()}`,
            request,
            plan,
            summary: `خطة "${request.type}" لـ "${request.audience}"`,
            createdAt: new Date().toISOString()
        };
        setStrategyHistory(prev => [historyItem, ...prev.slice(0,19)]);
    } catch(e: any) {
        setPlanError(e.message);
    } finally {
        setIsGeneratingPlan(false);
    }
  }, [aiClient, pageProfile]);

  const handleStartPostFromPlan = useCallback((planItem: ContentPlanItem) => {
    setPostText(`${planItem.theme}\n\n${planItem.postSuggestion}\n\n${planItem.cta}`);
    setView('composer');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleScheduleStrategy = useCallback(async () => {
    if (!aiClient || !contentPlan) return;
    setIsSchedulingStrategy(true);
    try {
        const schedule = await generateOptimalSchedule(aiClient, contentPlan);
        const newBulkPosts: BulkPostItem[] = schedule.map((item, index) => ({
            id: `bulk_strat_${Date.now()}_${index}`,
            text: item.postSuggestion,
            scheduleDate: new Date(item.scheduledAt).toISOString().slice(0, 16),
            targetIds: [managedTarget.id, ...(linkedInstagramTarget ? [linkedInstagramTarget.id] : [])],
        }));
        setBulkPosts(prev => [...prev, ...newBulkPosts]);
        setView('bulk');
        showNotification('success', 'تم تحويل الخطة إلى جدول مجمع! راجع التواريخ قبل الجدولة النهائية.');
    } catch (e: any) {
        showNotification('error', "فشل إنشاء الجدول الزمني: " + e.message);
    } finally {
        setIsSchedulingStrategy(false);
    }
  }, [aiClient, contentPlan, managedTarget, linkedInstagramTarget, showNotification]);

  const handleAddBulkPosts = useCallback((files: FileList) => {
    const newPosts: BulkPostItem[] = Array.from(files).map(file => ({
      id: `bulk-${file.name}-${Date.now()}`,
      imageFile: file,
      imagePreview: URL.createObjectURL(file),
      text: '',
      scheduleDate: '',
      targetIds: [managedTarget.id, ...(linkedInstagramTarget ? [linkedInstagramTarget.id] : [])],
    }));
    
    const postsWithSchedule = rescheduleBulkPosts([...bulkPosts, ...newPosts], schedulingStrategy, weeklyScheduleSettings);
    setBulkPosts(postsWithSchedule);
  }, [bulkPosts, managedTarget.id, linkedInstagramTarget, schedulingStrategy, weeklyScheduleSettings, rescheduleBulkPosts]);

  const handleUpdateBulkPost = useCallback((id: string, updates: Partial<BulkPostItem>) => {
    setBulkPosts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const handleRemoveBulkPost = useCallback((id: string) => {
    setBulkPosts(prev => prev.filter(p => p.id !== id));
  }, []);
  
  const handleScheduleAllBulk = useCallback(async () => {
    let hasError = false;
    // Validate all posts before starting
    bulkPosts.forEach(post => {
        let error = '';
        if (!post.scheduleDate) error = 'يجب تحديد تاريخ النشر.';
        if (post.targetIds.length === 0) error = 'يجب اختيار وجهة واحدة على الأقل.';
        if (post.targetIds.includes(linkedInstagramTarget?.id || '') && !post.imageFile) error = 'منشورات انستجرام تتطلب صورة.';
        if (error) {
            hasError = true;
            handleUpdateBulkPost(post.id, { error });
        } else if (post.error) {
            handleUpdateBulkPost(post.id, { error: undefined });
        }
    });

    if (hasError) {
        showNotification('error', "يرجى إصلاح الأخطاء في المنشورات المحددة قبل المتابعة.");
        return;
    }
    
    setIsSchedulingAll(true);
    let scheduledCount = 0;
    const newScheduledPosts: ScheduledPost[] = [];

    for (const post of bulkPosts) {
      for (const targetId of post.targetIds) {
        const targetInfo = allTargets.find(t => t.id === targetId);
        if (targetInfo) {
          const isReminder = targetInfo.type === 'instagram';
          newScheduledPosts.push({
            id: `scheduled-${targetId}-${post.id}`,
            text: post.text,
            imageUrl: post.imagePreview,
            imageFile: post.imageFile || undefined,
            scheduledAt: new Date(post.scheduleDate),
            isReminder: isReminder,
            targetId: targetId,
            targetInfo: { name: targetInfo.name, avatarUrl: targetInfo.picture.data.url, type: targetInfo.type },
          });
          scheduledCount++;
        }
      }
    }
    
    setScheduledPosts(prev => [...prev, ...newScheduledPosts]);
    setBulkPosts([]);
    setIsSchedulingAll(false);
    showNotification('success', `تمت إضافة ${scheduledCount} منشورًا إلى التقويم بنجاح.`);
    setView('calendar');

  }, [bulkPosts, showNotification, handleUpdateBulkPost, allTargets, linkedInstagramTarget?.id]);
  
  const handleGenerateBulkDescription = useCallback(async (id: string) => {
    if (!aiClient) return;
    const postIndex = bulkPosts.findIndex(p => p.id === id);
    if (postIndex === -1 || !bulkPosts[postIndex].imageFile) return;

    handleUpdateBulkPost(id, { isGeneratingDescription: true });
    try {
        const description = await generateDescriptionForImage(aiClient, bulkPosts[postIndex].imageFile!, pageProfile);
        handleUpdateBulkPost(id, { text: description });
    } catch (e: any) {
        handleUpdateBulkPost(id, { error: 'فشل إنشاء الوصف.' });
    } finally {
        handleUpdateBulkPost(id, { isGeneratingDescription: false });
    }
  }, [aiClient, bulkPosts, handleUpdateBulkPost, pageProfile]);

  const handleLoadStrategyFromHistory = (plan: ContentPlanItem[]) => {
      setContentPlan(plan);
  };
  
  const handleDeleteStrategyFromHistory = (id: string) => {
      setStrategyHistory(prev => prev.filter(item => item.id !== id));
      showNotification('success', 'تم حذف الاستراتيجية من السجل.');
  };

  const renderView = () => {
    switch(view) {
      case 'composer':
        const now = new Date();
        const upcomingReminders = scheduledPosts
            .filter(p => p.isReminder && new Date(p.scheduledAt) > now)
            .sort((a,b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
            
        const dueReminders = scheduledPosts
            .filter(p => p.isReminder && new Date(p.scheduledAt) <= now)
            .sort((a,b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

        return <div className="max-w-4xl mx-auto space-y-6 fade-in">
             {dueReminders.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-red-600 dark:text-red-400">تذكيرات مستحقة النشر!</h3>
                    {dueReminders.map(post => (
                        <ReminderCard key={post.id} post={post} onPublish={() => handlePublishFromReminder(post.id)} isPublishing={publishingReminderId === post.id} />
                    ))}
                </div>
             )}
            <PostComposer 
              onPublish={handlePublish}
              onSaveDraft={handleSaveDraft}
              isPublishing={isPublishing}
              postText={postText}
              onPostTextChange={setPostText}
              imagePreview={imagePreview}
              onImageChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      setSelectedImage(file);
                      setImagePreview(URL.createObjectURL(file));
                  }
              }}
              onImageGenerated={(file) => {
                  setSelectedImage(file);
                  setImagePreview(URL.createObjectURL(file));
              }}
              onImageRemove={() => { setSelectedImage(null); setImagePreview(null); }}
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
             {upcomingReminders.length > 0 && (
                <div className="space-y-4 mt-8">
                    <h3 className="text-xl font-bold">التذكيرات القادمة</h3>
                    {upcomingReminders.slice(0, 3).map(post => (
                        <div key={post.id} className="bg-gray-100 dark:bg-gray-700/50 p-3 rounded-md text-sm text-gray-700 dark:text-gray-300">
                           <p className="truncate">تذكير لـ <strong>{post.targetInfo.name}</strong>: "{post.text || 'صورة فقط'}"</p>
                           <p className="text-xs text-gray-500 dark:text-gray-400">في: {new Date(post.scheduledAt).toLocaleString('ar-EG', {dateStyle: 'short', timeStyle: 'short'})}</p>
                        </div>
                    ))}
                </div>
             )}
        </div>
      case 'calendar': return <ContentCalendar posts={scheduledPosts} onDelete={handleDeleteScheduledPost} />;
      case 'drafts': return <DraftsList drafts={drafts} onLoad={handleLoadDraft} onDelete={handleDeleteDraft} />;
      case 'analytics': return <AnalyticsPage 
        period={analyticsPeriod} onPeriodChange={setAnalyticsPeriod}
        summaryData={summaryData} aiSummary={performanceSummaryText} isGeneratingSummary={isGeneratingSummary}
        posts={filteredPosts} isLoading={publishedPostsLoading}
        onFetchAnalytics={handleFetchPostAnalytics} onGenerateInsights={handleGeneratePostInsights}
        />;
      case 'bulk': return <BulkSchedulerPage
          bulkPosts={bulkPosts}
          onAddPosts={handleAddBulkPosts}
          onUpdatePost={handleUpdateBulkPost}
          onRemovePost={handleRemoveBulkPost}
          onScheduleAll={handleScheduleAllBulk}
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
      case 'planner': return <ContentPlannerPage 
        aiClient={aiClient} isGenerating={isGeneratingPlan} error={planError} plan={contentPlan}
        onGeneratePlan={handleGeneratePlan} isSchedulingStrategy={isSchedulingStrategy}
        onScheduleStrategy={handleScheduleStrategy}
        onStartPost={handleStartPostFromPlan}
        pageProfile={pageProfile}
        strategyHistory={strategyHistory}
        onLoadFromHistory={handleLoadStrategyFromHistory}
        onDeleteFromHistory={handleDeleteStrategyFromHistory}
       />;
      case 'inbox': return <InboxPage 
        items={inboxItems}
        isLoading={isInboxLoading}
        onReply={handleReplySubmit}
        onGenerateSmartReplies={handleGenerateSmartReplies}
        onFetchMessageHistory={fetchMessageHistory}
        autoResponderSettings={autoResponderSettings}
        onAutoResponderSettingsChange={setAutoResponderSettings}
        onSync={handleInboxSync}
        isSyncing={syncingTargetId === managedTarget.id}
        aiClient={aiClient}
       />;
      case 'profile': return <PageProfilePage 
        profile={pageProfile} onProfileChange={setPageProfile}
        onFetchProfile={handleFetchProfile} isFetchingProfile={isFetchingProfile}
       />;
      default: return null;
    }
  }

  const navItems = [
      { id: 'composer', label: 'إنشاء منشور', icon: <PencilSquareIcon className="w-5 h-5"/> },
      { id: 'bulk', label: 'الجدولة المجمعة', icon: <QueueListIcon className="w-5 h-5"/> },
      { id: 'planner', label: 'مخطط المحتوى', icon: <BrainCircuitIcon className="w-5 h-5"/> },
      { id: 'calendar', label: 'تقويم المحتوى', icon: <CalendarIcon className="w-5 h-5"/> },
      { id: 'drafts', label: 'المسودات', icon: <ArchiveBoxIcon className="w-5 h-5"/>, count: drafts.length },
      { id: 'inbox', label: 'البريد الوارد', icon: <InboxArrowDownIcon className="w-5 h-5"/>, count: inboxItems.filter(i => !i.isReplied && i.authorId !== managedTarget.id).length },
      { id: 'analytics', label: 'التحليلات', icon: <ChartBarIcon className="w-5 h-5"/> },
      { id: 'profile', label: 'ملف الصفحة', icon: <UserCircleIcon className="w-5 h-5"/> },
  ];
  
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col">
        <Header 
          pageName={managedTarget.name}
          onChangePage={onChangePage}
          onLogout={onLogout}
          isSimulationMode={isSimulationMode}
          onSettingsClick={onSettingsClick}
        />
        
        {notification && (
          <div 
            className={`fixed top-20 right-4 p-4 rounded-lg shadow-lg z-50 text-white ${
                notification.type === 'success' ? 'bg-green-500' 
                : notification.type === 'error' ? 'bg-red-500' 
                : 'bg-yellow-500'
            }`}
          >
            {notification.message}
          </div>
        )}

        <div className="flex-grow flex">
            <aside className="w-64 bg-white dark:bg-gray-800 p-4 flex flex-col justify-between border-l border-gray-200 dark:border-gray-700/50">
                <div className="space-y-2">
                    {navItems.map(item => (
                       <NavItem key={item.id} label={item.label} icon={item.icon} active={view === item.id} onClick={() => setView(item.id as any)} notificationCount={item.count}/>
                    ))}
                </div>
                 <div className="mt-4 pt-4 border-t dark:border-gray-700">
                    <Button variant="danger" className="w-full" onClick={handleClearCache}>
                       <TrashIcon className="w-5 h-5 ml-2" /> حذف الكاش
                    </Button>
                </div>
            </aside>
            <main className="flex-grow p-4 sm:p-8 overflow-y-auto">
              {renderView()}
            </main>
        </div>
    </div>
  );
};

export default DashboardPage;
