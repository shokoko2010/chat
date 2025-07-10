
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
  const lastCheckTime = useRef(Math.floor(Date.now() / 1000));


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
  
  const handleReplySubmit = useCallback(async (item: InboxItem, message: string, isAuto: boolean = false): Promise<boolean> => {
      const endpoint = item.type === 'comment' ? `/${item.id}/comments` : `/${item.conversationId}/messages`;
      
      const success = await new Promise<boolean>(resolve => {
          if (isSimulationMode) { resolve(true); return; }
          window.FB.api(endpoint, 'POST', { message, access_token: managedTarget.access_token }, (response: any) => {
              if (response && !response.error) {
                  resolve(true);
              } else {
                  if (!isAuto) { // Only show notification for manual replies
                    const errorMsg = response?.error?.message || 'خطأ غير معروف';
                    showNotification('error', `فشل إرسال الرد: ${errorMsg}`);
                  }
                  console.error(`Failed to post reply to ${endpoint}:`, response?.error || response);
                  resolve(false);
              }
          });
      });

      if (success) {
          setInboxItems(prev => prev.map(i => i.id === item.id ? { ...i, isReplied: true } : i));
          if (item.type === 'message' && item.conversationId) {
             fetchMessageHistory(item.conversationId);
          }
      }
      return success;
  }, [isSimulationMode, managedTarget.access_token, showNotification]);

  const handlePrivateReplySubmit = useCallback(async (item: InboxItem, message: string): Promise<boolean> => {
    return new Promise<boolean>(resolve => {
        if(isSimulationMode) { resolve(true); return; }
        // The endpoint for a private reply is the comment_id/private_replies
        window.FB.api(`/${item.id}/private_replies`, 'POST', { message, access_token: managedTarget.access_token }, (response: any) => {
            if(response && !response.error) {
                console.log(`Successfully sent private reply to ${item.id}`);
                resolve(true);
            } else {
                const errorMsg = response?.error?.message || 'خطأ غير معروف';
                console.error(`Failed to send private reply to ${item.id}. Reason: ${errorMsg}`, response?.error || response);
                resolve(false);
            }
        });
    });
  }, [isSimulationMode, managedTarget.access_token]);
  
  const handleGenerateSmartReplies = useCallback(async (commentText: string): Promise<string[]> => {
    if (!aiClient) return [];
    try {
        const replies = await generateSmartReplies(aiClient, commentText, pageProfile);
        return replies;
    } catch(e: any) {
        showNotification('error', e.message);
        return [];
    }
  }, [aiClient, pageProfile, showNotification]);
  
  const fetchMessageHistory = useCallback((conversationId: string) => {
    if (isSimulationMode) return;
    const fields = 'messages.limit(25){id,created_time,from,message}';
    window.FB.api(`/${conversationId}?fields=${fields}`, { access_token: managedTarget.access_token }, (response: any) => {
      if (response && !response.error) {
        const messages = response.messages.data.reverse();
        setInboxItems(prev => prev.map(i => i.conversationId === conversationId ? {...i, messages: messages} : i));
      }
    });
  }, [isSimulationMode, managedTarget.access_token]);
  
  const processAutoReplies = useCallback(async (newItems: InboxItem[]) => {
    if (isProcessingReplies.current) return;
    isProcessingReplies.current = true;

    const itemsToProcess = newItems.filter(item => !item.isReplied);
    if (itemsToProcess.length === 0) {
      isProcessingReplies.current = false;
      return;
    }

    const { rules, fallback } = autoResponderSettings;
    const newRepliedUsers: Record<string, string[]> = { ...repliedUsersPerPost };

    const getReplyText = (variations: string[], userName: string): string => {
      if(variations.length === 0) return '';
      const randomVariation = variations[Math.floor(Math.random() * variations.length)];
      return randomVariation.replace('{user_name}', userName);
    };

    let itemsWereUpdated = false;

    for (const item of itemsToProcess) {
      let matchedRule: AutoResponderRule | null = null;
      for (const rule of rules) {
        if (!rule.enabled || rule.trigger.source !== item.type) continue;
        
        const text = item.text.toLowerCase();
        const keywords = rule.trigger.keywords.map(k => k.toLowerCase());
        const negativeKeywords = rule.trigger.negativeKeywords.map(k => k.toLowerCase());

        if (keywords.length === 0) continue; // Don't match on empty keywords

        const hasNegativeKeyword = negativeKeywords.some(nk => text.includes(nk));
        if (hasNegativeKeyword) continue;

        let isMatch = false;
        if (rule.trigger.matchType === 'exact') {
            isMatch = keywords.some(k => text === k);
        } else if (rule.trigger.matchType === 'all') {
            isMatch = keywords.every(k => text.includes(k));
        } else { // 'any'
            isMatch = keywords.some(k => text.includes(k));
        }
        
        if (isMatch) {
          matchedRule = rule;
          break;
        }
      }

      if (matchedRule) {
        const postId = item.post?.id || 'direct';
        const repliedList = newRepliedUsers[postId] || [];
        if (matchedRule.replyOncePerUser && repliedList.includes(item.authorId)) {
          continue;
        }
        
        let itemReplied = false;
        for (const action of matchedRule.actions) {
            if (!action.enabled) continue;

            const replyText = getReplyText(action.messageVariations, item.authorName);
            if(!replyText) continue;

            let success = false;
            
            if (action.type === 'public_reply' && item.type === 'comment') {
                success = await handleReplySubmit(item, replyText, true);
            } else if (action.type === 'private_reply' && item.type === 'comment') {
                if (item.platform === 'facebook' && !item.parentId && item.can_reply_privately === true) {
                    success = await handlePrivateReplySubmit(item, replyText);
                }
            } else if (action.type === 'direct_message' && item.type === 'message') {
                success = await handleReplySubmit(item, replyText, true);
            }

            if(success) itemReplied = true;
        }
        
        if(itemReplied) {
            item.isReplied = true; // Mutate the item directly for immediate UI update
            itemsWereUpdated = true;
            if (matchedRule.replyOncePerUser) {
                newRepliedUsers[postId] = [...repliedList, item.authorId];
            }
        }

      } else if (fallback.mode !== 'off' && item.type === 'message') {
          // AI Fallback logic
          if (fallback.mode === 'ai' && aiClient) {
              try {
                  const aiReply = await generateAutoReply(aiClient, item.text, pageProfile);
                  const success = await handleReplySubmit(item, aiReply, true);
                  if (success) {
                     item.isReplied = true;
                     itemsWereUpdated = true;
                  }
              } catch(e) {
                  console.error("AI fallback failed:", e);
              }
          } else if (fallback.mode === 'static' && fallback.staticMessage) {
              const staticReply = fallback.staticMessage.replace('{user_name}', item.authorName);
              const success = await handleReplySubmit(item, staticReply, true);
              if (success) {
                  item.isReplied = true;
                  itemsWereUpdated = true;
              }
          }
      }
    }
    
    if (itemsWereUpdated) {
        setInboxItems(prev => [...prev]); // Trigger re-render
    }
    setRepliedUsersPerPost(newRepliedUsers);
    isProcessingReplies.current = false;
  }, [autoResponderSettings, repliedUsersPerPost, handleReplySubmit, handlePrivateReplySubmit, aiClient, pageProfile]);
  
  const pollForNewItems = useCallback(async () => {
    if (isSimulationMode) return;
    const defaultPicture = 'https://via.placeholder.com/40/cccccc/ffffff?text=?';
    
    // --- Fetch FB Comments ---
    const fbCommentFields = 'id,from{id,name,picture{url}},message,created_time,parent{id},can_reply_privately';
    const fbPath = `/${managedTarget.id}/feed?fields=comments.since(${lastCheckTime.current}).limit(25){${fbCommentFields}}&limit=5`;
    const fbNewCommentsData = await fetchWithPagination(fbPath, managedTarget.access_token);
    
    const newFacebookComments: InboxItem[] = [];
    if (fbNewCommentsData) {
        fbNewCommentsData.forEach(post => {
            if (post.comments) {
                post.comments.data.forEach((comment: any) => {
                    const authorId = comment.from?.id;
                    const authorPictureUrl = comment.from?.picture?.data?.url || (authorId ? `https://graph.facebook.com/${authorId}/picture?type=normal` : defaultPicture);
                    newFacebookComments.push({
                        id: comment.id,
                        platform: 'facebook',
                        type: 'comment',
                        text: comment.message || '',
                        authorName: comment.from?.name || 'مستخدم فيسبوك',
                        authorId: authorId || 'Unknown',
                        authorPictureUrl,
                        timestamp: new Date(comment.created_time).toISOString(),
                        post: { id: post.id, message: post.message, picture: post.full_picture },
                        parentId: comment.parent?.id,
                        isReplied: false,
                        can_reply_privately: comment.can_reply_privately,
                    });
                });
            }
        });
    }

    // --- Fetch IG Comments ---
    let newInstagramComments: InboxItem[] = [];
    if (linkedInstagramTarget) {
        const igCommentFields = 'id,from{id,username},text,timestamp';
        const igMediaPath = `/${linkedInstagramTarget.id}/media?fields=id,comments_count,caption,media_url&since=${lastCheckTime.current}&limit=5`;
        const igNewPostsData = await fetchWithPagination(igMediaPath, linkedInstagramTarget.access_token);
        
        if (igNewPostsData) {
            const igCommentPromises = igNewPostsData.map(async (post) => {
                if (post.comments_count > 0) {
                    const commentsPath = `/${post.id}/comments?fields=${igCommentFields}&limit=25`;
                    const postComments = await fetchWithPagination(commentsPath, linkedInstagramTarget.access_token);
                    return postComments
                        .filter(c => new Date(c.timestamp).getTime() / 1000 > lastCheckTime.current)
                        .map((comment: any): InboxItem => ({
                            id: comment.id,
                            platform: 'instagram',
                            type: 'comment',
                            text: comment.text || '',
                            authorName: comment.from?.username || 'مستخدم انستجرام',
                            authorId: comment.from?.id || 'Unknown',
                            authorPictureUrl: defaultPicture,
                            timestamp: new Date(comment.timestamp).toISOString(),
                            post: { id: post.id, message: post.caption, picture: post.media_url },
                            parentId: comment.parent_id,
                            isReplied: false,
                        }));
                }
                return [];
            });
            const igCommentBatches = await Promise.all(igCommentPromises);
            igCommentBatches.forEach(batch => newInstagramComments.push(...batch));
        }
    }

    // --- Fetch FB Messages ---
    const convosPath = `/${managedTarget.id}/conversations?fields=id,snippet,updated_time,participants,messages.limit(1){from}&limit=25`;
    const newConvosData = await fetchWithPagination(convosPath, managedTarget.access_token);
    const newMessages = newConvosData
      .filter(convo => new Date(convo.updated_time).getTime() / 1000 > lastCheckTime.current)
      .map((convo: any): InboxItem => {
          const participant = convo.participants.data.find((p: any) => p.id !== managedTarget.id);
          const participantId = participant?.id;
          return {
              id: convo.id,
              platform: 'facebook',
              type: 'message',
              text: convo.snippet,
              authorName: participant?.name || 'مستخدم غير معروف',
              authorId: participantId || 'Unknown',
              authorPictureUrl: participantId ? `https://graph.facebook.com/${participantId}/picture?type=normal` : defaultPicture,
              timestamp: new Date(convo.updated_time).toISOString(),
              conversationId: convo.id,
              isReplied: convo.messages?.data?.[0]?.from?.id === managedTarget.id
          };
      });

    lastCheckTime.current = Math.floor(Date.now() / 1000);

    const allNewItems = [...newFacebookComments, ...newInstagramComments, ...newMessages];
    
    if (allNewItems.length > 0) {
      setInboxItems(prev => {
        const itemMap = new Map(prev.map(i => [i.id, i]));
        allNewItems.forEach(item => itemMap.set(item.id, item));
        return Array.from(itemMap.values()).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      });
      processAutoReplies(allNewItems);
    }
  }, [isSimulationMode, managedTarget, linkedInstagramTarget, fetchWithPagination, processAutoReplies]);
  
  useEffect(() => {
    if (view !== 'inbox') return;

    // Run once on view load
    setIsInboxLoading(true);
    pollForNewItems().finally(() => setIsInboxLoading(false));

    const poller = setInterval(pollForNewItems, 30000);
    return () => clearInterval(poller);
  }, [view, pollForNewItems]);
  
  const handleClearCache = () => {
    if (window.confirm("هل أنت متأكد من حذف الكاش؟ سيتم حذف جميع البيانات المحفوظة لهذه الصفحة (المسودات، المنشورات، البريد الوارد، إلخ) ولا يمكن التراجع عن هذا الإجراء.")) {
      const dataKey = `zex-pages-data-${managedTarget.id}`;
      localStorage.removeItem(dataKey);
      // Reset state to initial to force reload from scratch
      setPageProfile({ description: '', services: '', contactInfo: '', website: '', currentOffers: '', address: '', country: '' });
      setDrafts([]);
      setScheduledPosts([]);
      setPublishedPosts([]);
      setInboxItems([]);
      setContentPlan(null);
      setStrategyHistory([]);
      showNotification('success', 'تم حذف الكاش بنجاح. يمكنك المزامنة الآن لجلب بيانات جديدة.');
    }
  };

  const handlePublish = async () => {
    if ((!postText && !selectedImage) || (includeInstagram && !selectedImage)) {
      setComposerError('لا يمكن نشر منشور فارغ، أو نشر على انستجرام بدون صورة.');
      return;
    }
    setIsPublishing(true);
    setComposerError('');

    const postData: any = { message: postText };
    let igPostId: string | null = null;
    let igError: any = null;

    if(includeInstagram && linkedInstagramTarget) {
      if(selectedImage) {
        const igFormData = new FormData();
        igFormData.append('image_file', selectedImage);
        igFormData.append('caption', postText);
        igFormData.append('access_token', managedTarget.access_token!);
        
        const igResponse = await fetch(`https://graph.facebook.com/v19.0/${linkedInstagramTarget.id}/media`, { method: 'POST', body: igFormData });
        const igResData = await igResponse.json();
        
        if (igResData.id) {
            const publishResponse = await fetch(`https://graph.facebook.com/v19.0/${linkedInstagramTarget.id}/media_publish?creation_id=${igResData.id}&access_token=${managedTarget.access_token}`, { method: 'POST'});
            const publishResData = await publishResponse.json();
            if(publishResData.id) {
                igPostId = publishResData.id;
            } else {
                 igError = publishResData.error;
            }
        } else {
           igError = igResData.error;
        }
      }
    }
    
    // Facebook post (always happens if not IG-only)
    let fbPostId: string | null = null;
    let fbError: any = null;

    if (!includeInstagram || (includeInstagram && linkedInstagramTarget)) { // Post to FB if it's FB-only, or if it's a dual post
        if (selectedImage) {
            const fbFormData = new FormData();
            fbFormData.append('source', selectedImage);
            if (postText) fbFormData.append('caption', postText);
            fbFormData.append('access_token', managedTarget.access_token!);
            
            const response = await fetch(`https://graph.facebook.com/v19.0/${managedTarget.id}/photos`, { method: 'POST', body: fbFormData });
            const resData = await response.json();
            if(resData.id) fbPostId = resData.id; else fbError = resData.error;

        } else { // Text-only post
            const resData: any = await new Promise(resolve => window.FB.api(`/${managedTarget.id}/feed`, 'POST', postData, (res: any) => resolve(res)));
            if(resData.id) fbPostId = resData.id; else fbError = resData.error;
        }
    }
    
    if (fbPostId || igPostId) {
        let successMessage = '';
        if (fbPostId) successMessage += 'تم نشر منشور فيسبوك بنجاح. ';
        if (igPostId) successMessage += 'تم نشر منشور انستجرام بنجاح. ';
        showNotification('success', successMessage.trim());
        clearComposer();
    } 
    if(fbError || igError) {
        let errorMessage = '';
        if(fbError) errorMessage += `خطأ فيسبوك: ${fbError.message}. `;
        if(igError) errorMessage += `خطأ انستجرام: ${igError.message}. `;
        showNotification(fbPostId || igPostId ? 'partial' : 'error', errorMessage.trim());
    }
    
    setIsPublishing(false);
  };
  
  const handleSchedulePost = () => {
    if (!postText && !selectedImage) {
      setComposerError('لا يمكن جدولة منشور فارغ.');
      return;
    }
    if (!scheduleDate) {
      setComposerError('يرجى تحديد تاريخ الجدولة.');
      return;
    }
    const scheduleDateTime = new Date(scheduleDate);
    if (scheduleDateTime <= new Date()) {
      setComposerError('لا يمكن الجدولة في وقت مضى.');
      return;
    }

    const newPost: ScheduledPost = {
      id: `scheduled_${Date.now()}`,
      text: postText,
      imageUrl: imagePreview || undefined,
      imageFile: selectedImage || undefined,
      scheduledAt: scheduleDateTime,
      isReminder: includeInstagram,
      targetId: managedTarget.id,
      targetInfo: {
        name: managedTarget.name,
        avatarUrl: managedTarget.picture.data.url,
        type: 'page',
      }
    };
    
    setScheduledPosts(prev => [...prev, newPost].sort((a,b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()));
    clearComposer();
    showNotification('success', `تمت جدولة المنشور بنجاح ${includeInstagram ? 'كتذكير' : ''}.`);
  };

  const handlePublishOrSchedule = async () => {
    setComposerError('');
    if (isScheduled && !includeInstagram) {
        handleSchedulePost();
    } else if (isScheduled && includeInstagram) { // Save as reminder
        handleSaveAsReminder();
    } else {
        await handlePublish();
    }
  };

  const handleDeleteDraft = (draftId: string) => setDrafts(prev => prev.filter(d => d.id !== draftId));
  const handleLoadDraft = (draftId: string) => {
    const draft = drafts.find(d => d.id === draftId);
    if (draft) {
      setPostText(draft.text);
      setImagePreview(draft.imagePreview);
      setSelectedImage(draft.imageFile); // This will be null, but that's intended after load.
      setIsScheduled(draft.isScheduled);
      setScheduleDate(draft.scheduleDate);
      setIncludeInstagram(draft.includeInstagram);
      handleDeleteDraft(draftId); // Remove from drafts when loaded
      setView('composer');
      showNotification('success', 'تم تحميل المسودة بنجاح.');
    }
  };
  const handleSaveDraft = () => {
    if (!postText && !imagePreview) return;
    const newDraft: Draft = {
      id: `draft_${Date.now()}`,
      text: postText,
      imageFile: selectedImage,
      imagePreview: imagePreview,
      targetId: managedTarget.id,
      isScheduled, scheduleDate, includeInstagram
    };
    setDrafts(prev => [newDraft, ...prev]);
    clearComposer();
    showNotification('success', 'تم حفظ المسودة بنجاح.');
  };
  const handleDeleteScheduledPost = (postId: string) => setScheduledPosts(prev => prev.filter(p => p.id !== postId));

  const handleAddBulkPosts = (files: FileList) => {
    const newPosts: BulkPostItem[] = Array.from(files).map(file => ({
        id: `bulk_${Date.now()}_${Math.random()}`,
        imageFile: file,
        imagePreview: URL.createObjectURL(file),
        text: '',
        scheduleDate: '',
        targetIds: [managedTarget.id]
    }));
    const allPosts = [...bulkPosts, ...newPosts];
    const rescheduled = rescheduleBulkPosts(allPosts, schedulingStrategy, weeklyScheduleSettings);
    setBulkPosts(rescheduled);
  };
  const handleUpdateBulkPost = (id: string, updates: Partial<BulkPostItem>) => setBulkPosts(prev => prev.map(p => p.id === id ? {...p, ...updates} : p));
  const handleRemoveBulkPost = (id: string) => setBulkPosts(prev => prev.filter(p => p.id !== id));
  
  const handleScheduleAllBulkPosts = () => {
    setIsSchedulingAll(true);
    let allValid = true;
    // Validate all posts before scheduling
    const validatedPosts = bulkPosts.map(post => {
      if (post.targetIds.length === 0) {
        allValid = false;
        return { ...post, error: "اختر وجهة واحدة على الأقل." };
      }
      if (!post.scheduleDate) {
        allValid = false;
        return { ...post, error: "حدد تاريخ ووقت الجدولة." };
      }
      if(new Date(post.scheduleDate) <= new Date()) {
        allValid = false;
        return { ...post, error: "لا يمكن الجدولة في وقت مضى." };
      }
      return { ...post, error: undefined };
    });

    setBulkPosts(validatedPosts);

    if (!allValid) {
      setIsSchedulingAll(false);
      showNotification('error', 'بعض المنشورات تحتوي على أخطاء. يرجى مراجعتها.');
      return;
    }

    const newScheduledPosts: ScheduledPost[] = bulkPosts.map(bulkPost => {
      const scheduledPostsForTargets: ScheduledPost[] = bulkPost.targetIds.map(targetId => {
        const targetInfo = allTargets.find(t => t.id === targetId)!;
        return {
          id: `scheduled_${Date.now()}_${Math.random()}`,
          text: bulkPost.text,
          imageUrl: bulkPost.imagePreview,
          imageFile: bulkPost.imageFile,
          scheduledAt: new Date(bulkPost.scheduleDate),
          isReminder: targetInfo.type === 'instagram',
          targetId: targetId,
          targetInfo: {
            name: targetInfo.name,
            avatarUrl: targetInfo.picture.data.url,
            type: targetInfo.type
          }
        }
      });
      return scheduledPostsForTargets;
    }).flat();

    setScheduledPosts(prev => [...prev, ...newScheduledPosts].sort((a,b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()));
    setBulkPosts([]);
    setIsSchedulingAll(false);
    showNotification('success', `تمت جدولة ${newScheduledPosts.length} منشورًا بنجاح.`);
    setView('calendar');
  };

  const handleGenerateBulkDescription = async (id: string) => {
    if(!aiClient) return;
    const post = bulkPosts.find(p => p.id === id);
    if (!post || !post.imageFile) return;

    handleUpdateBulkPost(id, { isGeneratingDescription: true });
    try {
        const description = await generateDescriptionForImage(aiClient, post.imageFile, pageProfile);
        handleUpdateBulkPost(id, { text: description });
    } catch (e: any) {
        handleUpdateBulkPost(id, { error: e.message });
    } finally {
        handleUpdateBulkPost(id, { isGeneratingDescription: false });
    }
  };

  const handleSaveAsReminder = () => {
    const reminder = {
      id: `reminder_${Date.now()}`,
      text: postText,
      imageUrl: imagePreview,
      imageFile: selectedImage,
      scheduledAt: new Date(scheduleDate),
      isReminder: true,
      targetId: linkedInstagramTarget!.id,
      targetInfo: {
        name: linkedInstagramTarget!.name,
        avatarUrl: linkedInstagramTarget!.picture.data.url,
        type: 'instagram' as const,
      }
    };
    
    // Also schedule the FB post
    const fbScheduledPost = {
       ...reminder,
       id: `scheduled_${Date.now()}`,
       isReminder: false,
       targetId: managedTarget.id,
       targetInfo: {
           name: managedTarget.name,
           avatarUrl: managedTarget.picture.data.url,
           type: 'page' as const,
       }
    };
    
    setScheduledPosts(prev => [...prev, reminder, fbScheduledPost].sort((a,b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()));
    clearComposer();
    showNotification('success', 'تمت جدولة المنشور على فيسبوك وحفظ تذكير لانستجرام.');
  };

  const handlePublishFromReminder = async (postId: string) => {
     const post = scheduledPosts.find(p => p.id === postId);
     if (!post || !post.imageFile || !linkedInstagramTarget) return;

     setPublishingReminderId(postId);

     const igFormData = new FormData();
     igFormData.append('image_file', post.imageFile);
     igFormData.append('caption', post.text);
     igFormData.append('access_token', managedTarget.access_token!);
     
     const igResponse = await fetch(`https://graph.facebook.com/v19.0/${linkedInstagramTarget.id}/media`, { method: 'POST', body: igFormData });
     const igResData = await igResponse.json();
     
     if (igResData.id) {
         const publishResponse = await fetch(`https://graph.facebook.com/v19.0/${linkedInstagramTarget.id}/media_publish?creation_id=${igResData.id}&access_token=${managedTarget.access_token}`, { method: 'POST'});
         const publishResData = await publishResponse.json();
         if(publishResData.id) {
             showNotification('success', 'تم نشر تذكير انستجرام بنجاح.');
             handleDeleteScheduledPost(postId); // Remove the reminder
         } else {
             showNotification('error', `فشل نشر تذكير انستجرام: ${publishResData.error?.message}`);
         }
     } else {
         showNotification('error', `فشل رفع صورة تذكير انستجرام: ${igResData.error?.message}`);
     }

     setPublishingReminderId(null);
  };
  
  const handleGenerateContentPlan = useCallback(async (request: StrategyRequest, images?: File[]) => {
      if (!aiClient) return;
      setIsGeneratingPlan(true);
      setPlanError(null);
      try {
          const plan = await generateContentPlan(aiClient, request, pageProfile, images);
          setContentPlan(plan);
          const newHistoryItem: StrategyHistoryItem = {
              id: `hist_${Date.now()}`,
              request: request,
              plan: plan,
              summary: `${request.type} / ${request.duration}`,
              createdAt: new Date().toISOString()
          };
          setStrategyHistory(prev => [newHistoryItem, ...prev].slice(0, 20)); // Keep last 20
      } catch (e: any) {
          setPlanError(e.message);
      } finally {
          setIsGeneratingPlan(false);
      }
  }, [aiClient, pageProfile]);

  const handleScheduleStrategy = useCallback(async () => {
    if (!aiClient || !contentPlan) return;
    setIsSchedulingStrategy(true);
    try {
        const schedule = await generateOptimalSchedule(aiClient, contentPlan);
        const newBulkPosts: BulkPostItem[] = schedule.map(item => ({
            id: `bulk_plan_${Date.now()}_${Math.random()}`,
            text: item.postSuggestion,
            scheduleDate: item.scheduledAt,
            targetIds: [managedTarget.id],
        }));
        setBulkPosts(newBulkPosts);
        showNotification('success', 'تم تحويل الخطة إلى جدول مجمع بنجاح! راجعها في قسم الجدولة المجمعة.');
        setView('bulk');
        setContentPlan(null); // Clear the plan after converting
    } catch (e: any) {
        showNotification('error', e.message);
    } finally {
        setIsSchedulingStrategy(false);
    }
  }, [aiClient, contentPlan, managedTarget.id, showNotification]);

  const handleStartPostFromPlan = (planItem: ContentPlanItem) => {
    setPostText(planItem.postSuggestion);
    setView('composer');
    showNotification('success', 'تم نقل اقتراح المنشور إلى أداة الإنشاء.');
  };
  
  const handleLoadFromHistory = (plan: ContentPlanItem[]) => {
      setContentPlan(plan);
      setView('planner');
  };
  
  const handleDeleteFromHistory = (id: string) => {
      setStrategyHistory(prev => prev.filter(item => item.id !== id));
  };
  
  const handleFetchAnalytics = useCallback(async (postId: string) => {
    if(isSimulationMode) return;

    setPublishedPosts(prev => prev.map(p => p.id === postId ? {...p, analytics: {...p.analytics, loading: true}} : p));
    
    try {
        const fields = 'likes.summary(true),comments.summary(true),shares,insights.metric(post_impressions_unique,post_engaged_users){values}';
        const response: any = await new Promise(resolve => window.FB.api(`/${postId}?fields=${fields}`, {access_token: managedTarget.access_token}, (res:any) => resolve(res)));
        
        if (response && !response.error) {
            const reach = response.insights?.data?.find((m:any) => m.name === 'post_impressions_unique')?.values[0]?.value ?? 0;
            const newAnalytics: Partial<PublishedPost['analytics']> = {
                likes: response.likes?.summary?.total_count ?? 0,
                comments: response.comments?.summary?.total_count ?? 0,
                shares: response.shares?.count ?? 0,
                reach: reach,
                lastUpdated: new Date(),
            };
            setPublishedPosts(prev => prev.map(p => p.id === postId ? {...p, analytics: {...p.analytics, ...newAnalytics, loading: false}} : p));
        } else {
             throw new Error(response.error?.message || 'Unknown error');
        }
    } catch(e: any) {
        showNotification('error', `فشل تحديث الإحصائيات: ${e.message}`);
        setPublishedPosts(prev => prev.map(p => p.id === postId ? {...p, analytics: {...p.analytics, loading: false}} : p));
    }
  }, [isSimulationMode, managedTarget.access_token, showNotification]);

  const handleGenerateInsights = useCallback(async (postId: string) => {
      if(!aiClient) return;
      const post = publishedPosts.find(p => p.id === postId);
      if(!post || post.analytics.comments === 0) return;

      setPublishedPosts(prev => prev.map(p => p.id === postId ? {...p, analytics: {...p.analytics, isGeneratingInsights: true}} : p));
      
      try {
          // Fetch comments for context
          const commentsResponse: any[] = await fetchWithPagination(`/${postId}/comments?fields=message&limit=50`, managedTarget.access_token);
          
          const insights = await generatePostInsights(aiClient, post.text, post.analytics, commentsResponse);

           setPublishedPosts(prev => prev.map(p => p.id === postId ? {...p, analytics: {...p.analytics, aiSummary: insights.performanceSummary, sentiment: insights.sentiment}} : p));
      } catch (e: any) {
          showNotification('error', e.message);
      } finally {
          setPublishedPosts(prev => prev.map(p => p.id === postId ? {...p, analytics: {...p.analytics, isGeneratingInsights: false}} : p));
      }
  }, [aiClient, publishedPosts, fetchWithPagination, managedTarget.access_token, showNotification]);

  const renderView = () => {
    switch(view) {
      case 'composer': return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <PostComposer 
                onPublish={handlePublishOrSchedule}
                onSaveDraft={handleSaveDraft}
                isPublishing={isPublishing}
                postText={postText} onPostTextChange={setPostText}
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
                imagePreview={imagePreview}
                isScheduled={isScheduled} onIsScheduledChange={setIsScheduled}
                scheduleDate={scheduleDate} onScheduleDateChange={setScheduleDate}
                error={composerError}
                aiClient={aiClient}
                managedTarget={managedTarget}
                linkedInstagramTarget={linkedInstagramTarget}
                includeInstagram={includeInstagram}
                onIncludeInstagramChange={setIncludeInstagram}
                pageProfile={pageProfile}
            />
            <div className="mt-8 lg:mt-0">
                <PostPreview 
                    type={includeInstagram ? 'instagram' : 'facebook'}
                    postText={postText} 
                    imagePreview={imagePreview} 
                    pageName={includeInstagram && linkedInstagramTarget ? linkedInstagramTarget.name : managedTarget.name}
                    pageAvatar={includeInstagram && linkedInstagramTarget ? linkedInstagramTarget.picture.data.url : managedTarget.picture.data.url}
                />
            </div>
        </div>
      );
      case 'calendar': return (
        <div className="space-y-4">
            {scheduledPosts.filter(p => p.isReminder).map(p => (
                <ReminderCard key={p.id} post={p} onPublish={() => handlePublishFromReminder(p.id)} isPublishing={publishingReminderId === p.id} />
            ))}
            <ContentCalendar posts={scheduledPosts} onDelete={handleDeleteScheduledPost} />
        </div>
      );
      case 'drafts': return <DraftsList drafts={drafts} onLoad={handleLoadDraft} onDelete={handleDeleteDraft}/>;
      case 'analytics': return <AnalyticsPage posts={filteredPosts} isLoading={publishedPostsLoading} period={analyticsPeriod} onPeriodChange={setAnalyticsPeriod} summaryData={summaryData} aiSummary={performanceSummaryText} isGeneratingSummary={isGeneratingSummary} onFetchAnalytics={handleFetchAnalytics} onGenerateInsights={handleGenerateInsights} />;
      case 'bulk': return (
        <BulkSchedulerPage 
          bulkPosts={bulkPosts}
          onAddPosts={handleAddBulkPosts}
          onUpdatePost={handleUpdateBulkPost}
          onRemovePost={handleRemoveBulkPost}
          onScheduleAll={handleScheduleAllBulkPosts}
          isSchedulingAll={isSchedulingAll}
          targets={bulkSchedulerTargets}
          aiClient={aiClient}
          onGenerateDescription={handleGenerateBulkDescription}
          schedulingStrategy={schedulingStrategy}
          onSchedulingStrategyChange={setSchedulingStrategy}
          weeklyScheduleSettings={weeklyScheduleSettings}
          onWeeklyScheduleSettingsChange={setWeeklyScheduleSettings}
          onReschedule={handleReschedule}
        />
      );
       case 'planner': return (
         <ContentPlannerPage 
            aiClient={aiClient}
            isGenerating={isGeneratingPlan}
            error={planError}
            plan={contentPlan}
            onGeneratePlan={handleGenerateContentPlan}
            isSchedulingStrategy={isSchedulingStrategy}
            onScheduleStrategy={handleScheduleStrategy}
            onStartPost={handleStartPostFromPlan}
            pageProfile={pageProfile}
            strategyHistory={strategyHistory}
            onLoadFromHistory={handleLoadFromHistory}
            onDeleteFromHistory={handleDeleteFromHistory}
        />
       );
       case 'inbox': return <InboxPage items={inboxItems} isLoading={isInboxLoading} onReply={handleReplySubmit} onGenerateSmartReplies={handleGenerateSmartReplies} onFetchMessageHistory={fetchMessageHistory} autoResponderSettings={autoResponderSettings} onAutoResponderSettingsChange={setAutoResponderSettings} onSync={() => onSyncHistory(managedTarget)} isSyncing={syncingTargetId === managedTarget.id} aiClient={aiClient} />;
       case 'profile': return <PageProfilePage profile={pageProfile} onProfileChange={setPageProfile} onFetchProfile={handleFetchProfile} isFetchingProfile={isFetchingProfile} />;
       default: return null;
    }
  };
  
  const navItems = [
    { view: 'composer', label: 'إنشاء منشور', icon: <PencilSquareIcon className="w-5 h-5"/> },
    { view: 'inbox', label: 'البريد الوارد', icon: <InboxArrowDownIcon className="w-5 h-5"/> },
    { view: 'calendar', label: 'تقويم المحتوى', icon: <CalendarIcon className="w-5 h-5"/> },
    { view: 'drafts', label: 'المسودات', icon: <ArchiveBoxIcon className="w-5 h-5"/> },
    { view: 'analytics', label: 'التحليلات', icon: <ChartBarIcon className="w-5 h-5"/> },
    { view: 'bulk', label: 'الجدولة المجمعة', icon: <QueueListIcon className="w-5 h-5"/> },
    { view: 'planner', label: 'مخطط المحتوى', icon: <BrainCircuitIcon className="w-5 h-5"/> },
    { view: 'profile', label: 'ملف الصفحة', icon: <UserCircleIcon className="w-5 h-5"/> },
  ];
  
  const unreadCount = useMemo(() => {
    return inboxItems.filter(item => !item.isReplied).length;
  }, [inboxItems]);

  return (
    <div className="min-h-screen">
      <Header
        onLogout={onLogout}
        isSimulationMode={isSimulationMode}
        pageName={managedTarget.name}
        onChangePage={onChangePage}
        onSettingsClick={onSettingsClick}
      />
      {notification && (
        <div className={`p-4 text-white text-center ${notification.type === 'success' ? 'bg-green-500' : (notification.type === 'partial' ? 'bg-yellow-500' : 'bg-red-500')}`}>
            {notification.message}
        </div>
      )}
      <div className="flex flex-col lg:flex-row">
        <aside className="w-full lg:w-64 bg-white dark:bg-gray-800 p-4 border-b lg:border-b-0 lg:border-l border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="space-y-2 flex-grow overflow-y-auto">
            {navItems.map(item => (
              <NavItem
                key={item.view}
                icon={item.icon}
                label={item.label}
                active={view === item.view}
                onClick={() => setView(item.view as any)}
                notificationCount={item.view === 'inbox' ? unreadCount : undefined}
              />
            ))}
          </div>
           <div className="mt-4 border-t dark:border-gray-700 pt-4">
                <Button 
                    variant="danger" 
                    onClick={handleClearCache} 
                    className="w-full"
                    size="sm"
                >
                    <TrashIcon className="w-4 h-4 ml-2"/>
                    حذف الكاش لهذه الصفحة
                </Button>
            </div>
        </aside>
        <main className="flex-grow p-4 sm:p-8 bg-gray-50 dark:bg-gray-900">
          {renderView()}
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;