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
  onSettingsClick: () => void;
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


const DashboardPage: React.FC<DashboardPageProps> = ({ managedTarget, allTargets, onChangePage, onLogout, isSimulationMode, aiClient, onSettingsClick, fetchWithPagination }) => {
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
  const [autoRepliedItems, setAutoRepliedItems] = useState<Set<string>>(new Set());
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

  useEffect(() => {
    const dataKey = `zex-pages-data-${managedTarget.id}`;
    let savedData;
    try {
        const rawData = localStorage.getItem(dataKey);
        savedData = rawData ? JSON.parse(rawData) : {};
    } catch(e) {
        savedData = {};
    }

    setPageProfile(savedData.pageProfile || { description: '', services: '', contactInfo: '', website: '', currentOffers: '', address: '', country: '' });
    setDrafts(savedData.drafts?.map((d: any) => ({...d, imageFile: null})) || []);
    setScheduledPosts(savedData.scheduledPosts?.map((p: any) => ({...p, scheduledAt: new Date(p.scheduledAt), imageFile: null })) || []);
    setContentPlan(savedData.contentPlan || null);
    setStrategyHistory(savedData.strategyHistory || []);
    setPublishedPosts(savedData.publishedPosts?.map((p:any) => ({...p, publishedAt: new Date(p.publishedAt)})) || []);
    setAutoResponderSettings(savedData.autoResponderSettings || { 
        comments: { realtimeEnabled: false, keywords: 'السعر,بكم,تفاصيل,خاص', replyOncePerUser: true, publicReplyEnabled: false, publicReplyMessage: '', privateReplyEnabled: true, privateReplyMessage: 'أهلاً بك {user_name}، تم إرسال التفاصيل على الخاص 📩' },
        messages: { realtimeEnabled: false, keywords: 'السعر,بكم,تفاصيل', replyMessage: 'أهلاً بك {user_name}، سأرسل لك كل التفاصيل حول استفسارك خلال لحظات.' }
    });
    setAutoRepliedItems(new Set(savedData.autoRepliedItems || []));
    setRepliedUsersPerPost(savedData.repliedUsersPerPost || {});
    setInboxItems(savedData.inboxItems?.map((i:any) => ({...i, timestamp: new Date(i.timestamp).toISOString()})) || []);
    
    setBulkPosts([]);
    clearComposer();
    setPublishedPostsLoading(true);
    setView('composer');

    if (isSimulationMode) {
      setPublishedPostsLoading(false);
      return;
    }
    
    if (!savedData.publishedPosts || savedData.publishedPosts.length === 0) {
        const endpoint = managedTarget.type === 'group' ? 'feed' : 'published_posts';
        const fields = managedTarget.type === 'group' 
            ? 'id,message,full_picture,created_time,likes.summary(true),comments.summary(true)'
            : 'id,message,full_picture,created_time,likes.summary(true),comments.summary(true),shares,insights.metric(post_impressions_unique){values}';
        
        let path = `/${managedTarget.id}/${endpoint}?fields=${fields}&limit=100`;
        if (managedTarget.type === 'page' && managedTarget.access_token) {
            path += `&access_token=${managedTarget.access_token}`;
        }

        fetchWithPagination(path)
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
  }, [managedTarget.id, managedTarget.access_token, isSimulationMode, clearComposer, fetchWithPagination, managedTarget.name, managedTarget.picture.data.url, managedTarget.type]);
  
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
            autoRepliedItems: Array.from(autoRepliedItems),
            repliedUsersPerPost
        };
        localStorage.setItem(dataKey, JSON.stringify(dataToStore));
    } catch(e) {
        console.error("Could not save data to localStorage:", e);
    }
  }, [pageProfile, drafts, scheduledPosts, contentPlan, strategyHistory, publishedPosts, inboxItems, autoResponderSettings, autoRepliedItems, repliedUsersPerPost, managedTarget.id]);

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
  
  const fetchMessageHistory = useCallback(async (conversationId: string) => {
    const response: any = await new Promise(resolve => window.FB.api(`/${conversationId}/messages`, { fields: 'id,message,from,created_time', access_token: managedTarget.access_token }, (res: any) => resolve(res)));
    if (response && response.data) {
      setInboxItems(prevItems => prevItems.map(item => item.id === conversationId ? { ...item, messages: response.data.reverse() } : item));
    }
  }, [managedTarget.access_token]);

  const handleSendMessage = useCallback(async (conversationId: string, message: string): Promise<boolean> => {
    return new Promise(resolve => {
        if(isSimulationMode) {
          setInboxItems(prev => prev.map(item => {
              if (item.id === conversationId) {
                  const newMessage: InboxMessage = {
                      id: `sim_msg_${Date.now()}`,
                      from: { name: 'You', id: 'me' },
                      message: message,
                      created_time: new Date().toISOString()
                  };
                  return { ...item, messages: [...(item.messages || []), newMessage] };
              }
              return item;
          }));
          resolve(true);
          return;
        }
        window.FB.api(`/${conversationId}/messages`, 'POST', { message, access_token: managedTarget.access_token }, (response: any) => {
            if(response && !response.error) {
                fetchMessageHistory(conversationId);
                resolve(true);
            } else { resolve(false); }
        });
    });
  }, [isSimulationMode, managedTarget.access_token, fetchMessageHistory]);

  const handleReplyToComment = useCallback(async (commentId: string, message: string): Promise<boolean> => {
    return new Promise(resolve => {
        if(isSimulationMode) { resolve(true); return; }
        window.FB.api(`/${commentId}/comments`, 'POST', { message, access_token: managedTarget.access_token }, (response: any) => {
            resolve(response && !response.error);
        });
    });
  }, [isSimulationMode, managedTarget.access_token]);

  const handlePrivateReplyToComment = useCallback(async (commentId: string, message: string): Promise<boolean> => {
    return new Promise(resolve => {
        if (isSimulationMode) { resolve(true); return; }
        window.FB.api(`/${commentId}/private_replies`, 'POST', { message, access_token: managedTarget.access_token }, (response: any) => {
            resolve(response && response.success);
        });
    });
  }, [isSimulationMode, managedTarget.access_token]);

  const processAutoReplies = useCallback(async (currentInboxItems: InboxItem[]) => {
      const { comments: commentSettings, messages: messageSettings } = autoResponderSettings;
      if (!commentSettings.realtimeEnabled && !messageSettings.realtimeEnabled) return;
      const itemsToProcess = currentInboxItems.filter(item => !autoRepliedItems.has(item.id));
      if (itemsToProcess.length === 0) return;
      const newRepliedItems = new Set<string>();
      const newRepliedUsers = { ...repliedUsersPerPost };
      let replyCount = 0;
      for (const item of itemsToProcess) {
          let replied = false;
          if (item.type === 'message' && messageSettings.realtimeEnabled) {
              const keywords = messageSettings.keywords.split(',').map(k => k.trim()).filter(Boolean);
              if (keywords.length === 0 || keywords.some(k => item.text.toLowerCase().includes(k.toLowerCase()))) {
                  await handleSendMessage(item.id, messageSettings.replyMessage.replace('{user_name}', item.authorName));
                  replied = true;
              }
          } else if (item.type === 'comment' && commentSettings.realtimeEnabled && item.post) {
              const postId = item.post.id;
              const keywords = commentSettings.keywords.split(',').map(k => k.trim()).filter(Boolean);
              if ((keywords.length === 0 || keywords.some(k => item.text.toLowerCase().includes(k.toLowerCase()))) && (!commentSettings.replyOncePerUser || !(newRepliedUsers[postId]?.includes(item.authorId)))) {
                  if (commentSettings.publicReplyEnabled && commentSettings.publicReplyMessage) await handleReplyToComment(item.id, commentSettings.publicReplyMessage.replace('{user_name}', item.authorName));
                  if (commentSettings.privateReplyEnabled && commentSettings.privateReplyMessage) await handlePrivateReplyToComment(item.id, commentSettings.privateReplyMessage.replace('{user_name}', item.authorName));
                  if (commentSettings.replyOncePerUser) {
                      if (!newRepliedUsers[postId]) newRepliedUsers[postId] = [];
                      newRepliedUsers[postId].push(item.authorId);
                  }
                  replied = true;
              }
          }
          if (replied) { newRepliedItems.add(item.id); replyCount++; }
      }
      setAutoRepliedItems(prev => new Set([...Array.from(prev), ...Array.from(newRepliedItems)]));
      setRepliedUsersPerPost(newRepliedUsers);
      if (replyCount > 0) showNotification('success', `تم إرسال ${replyCount} ردًا تلقائيًا.`);
  }, [autoResponderSettings, autoRepliedItems, repliedUsersPerPost, showNotification, handleSendMessage, handleReplyToComment, handlePrivateReplyToComment]);

  useEffect(() => {
    const fetchAndProcessInbox = async () => {
        if (view !== 'inbox' || isSimulationMode) return;

        setIsInboxLoading(true);
        try {
            const fetchAllComments = async (): Promise<InboxItem[]> => {
                let allPosts: {id: string, message?: string, full_picture?: string}[] = [];
                const postFields = "id,message,full_picture";
                let postPath = '';

                if (managedTarget.type === 'page' && managedTarget.access_token) {
                    postPath = `/${managedTarget.id}/feed?fields=${postFields}&limit=50&access_token=${managedTarget.access_token}`;
                } else if (managedTarget.type === 'group') {
                    postPath = `/${managedTarget.id}/feed?fields=${postFields}&limit=50`;
                }

                if (postPath) {
                    allPosts.push(...await fetchWithPagination(postPath));
                }
                
                if (linkedInstagramTarget && linkedInstagramTarget.access_token) {
                    const igPosts = await fetchWithPagination(`/${linkedInstagramTarget.id}/media?fields=id,caption,media_url,timestamp&limit=50&access_token=${linkedInstagramTarget.access_token}`);
                    allPosts.push(...igPosts.map(p => ({ id: p.id, message: p.caption, full_picture: p.media_url })));
                }

                if (allPosts.length === 0) return [];

                const commentsBatchRequest = allPosts.map(post => ({ method: 'GET', relative_url: `${post.id}/comments?fields=id,from{id,name,picture{url}},message,created_time&limit=25&order=reverse_chronological` }));
                const commentsResponse: any = await new Promise(resolve => window.FB.api('/', 'POST', { batch: commentsBatchRequest, access_token: managedTarget.access_token }, (res: any) => resolve(res)));
                const allComments: InboxItem[] = [];
                if (commentsResponse && !commentsResponse.error) {
                    commentsResponse.forEach((res: any, index: number) => {
                        if (res.code === 200) {
                            try {
                                const body = JSON.parse(res.body);
                                const originalPost = allPosts[index];
                                if (body.data) {
                                    body.data.forEach((comment: any) => allComments.push({
                                        id: comment.id, type: 'comment', text: comment.message,
                                        authorName: comment.from?.name || 'مستخدم غير معروف', authorId: comment.from?.id || 'Unknown',
                                        authorPictureUrl: comment.from?.picture?.data?.url || `https://graph.facebook.com/${comment.from?.id}/picture`,
                                        timestamp: comment.created_time, post: { id: originalPost.id, message: originalPost.message, picture: originalPost.full_picture }
                                    }));
                                }
                            } catch (e) { /* ignore parse error */ }
                        }
                    });
                }
                return allComments;
            };

            const fetchAllMessages = async (): Promise<InboxItem[]> => {
                if (managedTarget.type !== 'page' || !managedTarget.access_token) return [];
                const convosData = await fetchWithPagination(`/${managedTarget.id}/conversations?fields=id,snippet,updated_time,participants&limit=100&access_token=${managedTarget.access_token}`);
                return convosData.map((convo: any) => {
                    const participant = convo.participants.data.find((p: any) => p.id !== managedTarget.id);
                    return { id: convo.id, type: 'message', text: convo.snippet, authorName: participant?.name || 'مستخدم غير معروف', authorId: participant?.id || 'Unknown',
                        authorPictureUrl: `https://graph.facebook.com/${participant?.id}/picture`,
                        timestamp: convo.updated_time, conversationId: convo.id
                    };
                });
            };

            const [comments, messages] = await Promise.all([fetchAllComments(), fetchAllMessages()]);
            const fetchedItems = [...comments, ...messages];

            setInboxItems(prevItems => {
                const combinedItems = new Map<string, InboxItem>();
                prevItems.forEach(item => combinedItems.set(item.id, item));

                fetchedItems.forEach(item => {
                    if (item.type === 'message' && combinedItems.has(item.id)) {
                        const existingItem = combinedItems.get(item.id);
                        if (existingItem?.messages) {
                            item.messages = existingItem.messages;
                        }
                    }
                    combinedItems.set(item.id, item);
                });

                const allItems = Array.from(combinedItems.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                processAutoReplies(allItems);
                return allItems;
            });

        } catch (err: any) {
            console.error("Error fetching inbox:", err);
            showNotification('error', `فشل في جلب البريد الوارد: ${err.message || 'خطأ غير معروف'}`);
        } finally {
            setIsInboxLoading(false);
        }
    };

    fetchAndProcessInbox();
  }, [view, isSimulationMode, managedTarget, linkedInstagramTarget, fetchWithPagination, processAutoReplies, showNotification]);
  
  const handleReplySubmit = async (selectedItem: InboxItem, message: string): Promise<boolean> => {
      return selectedItem.type === 'comment' ? handleReplyToComment(selectedItem.id, message) : handleSendMessage(selectedItem.id, message);
  };

  const handleGenerateSmartReplies = async (commentText: string): Promise<string[]> => {
    if (!aiClient) return [];
    try {
        return await generateSmartReplies(aiClient, commentText, pageProfile);
    } catch(e:any) {
        showNotification('error', e.message); return [];
    }
  };

  const handleSaveDraft = () => {
    if (!postText.trim() && !selectedImage) { setComposerError('لا يمكن حفظ مسودة فارغة.'); return; }
    const newDraft: Draft = { id: `draft_${Date.now()}`, text: postText, imageFile: selectedImage, imagePreview: imagePreview, targetId: managedTarget.id, isScheduled, scheduleDate, includeInstagram };
    setDrafts(prev => [newDraft, ...prev]);
    showNotification('success', 'تم حفظ المسودة بنجاح.');
    clearComposer();
  };

  const handleLoadDraft = (draftId: string) => {
    const draft = drafts.find(d => d.id === draftId);
    if(draft) {
        setPostText(draft.text); setSelectedImage(draft.imageFile); setImagePreview(draft.imagePreview); setIsScheduled(draft.isScheduled); setScheduleDate(draft.scheduleDate); setIncludeInstagram(draft.includeInstagram);
        setView('composer'); handleDeleteDraft(draftId, false);
    }
  };
  
  const handleDeleteDraft = (draftId: string, showNotif: boolean = true) => {
      setDrafts(prev => prev.filter(d => d.id !== draftId));
      if (showNotif) showNotification('success', 'تم حذف المسودة.');
  };
    
  const publishToTarget = (target: Target, text: string, image: File | null, scheduleAt: Date | null, isReminder: boolean = false) => {
    return new Promise<{targetName: string; success: boolean, response: any}>((resolve, reject) => {
        if (isReminder) {
            const newReminder: ScheduledPost = { id: `reminder_${Date.now()}`, text, scheduledAt: scheduleAt!, isReminder: true, targetId: target.id, imageFile: image || undefined, imageUrl: image ? URL.createObjectURL(image) : undefined, targetInfo: { name: target.name, avatarUrl: target.picture.data.url, type: 'instagram' } };
            setScheduledPosts(prev => [...prev, newReminder]);
            resolve({ targetName: target.name, success: true, response: { id: newReminder.id } });
            return;
        }

        if (isSimulationMode) {
            if(scheduleAt){
              const newScheduledPost: ScheduledPost = { id: `sim_scheduled_${Date.now()}`, text, scheduledAt: scheduleAt, isReminder: false, targetId: target.id, imageUrl: image ? URL.createObjectURL(image) : undefined, targetInfo: { name: target.name, avatarUrl: target.picture.data.url, type: target.type } };
              setScheduledPosts(prev => [...prev, newScheduledPost]);
            }
            setTimeout(() => resolve({ targetName: target.name, success: true, response: { id: `sim_${Date.now()}` } }), 500);
            return;
        }
        
        let apiPath: string, apiParams: any;
        if (image) {
            apiPath = target.type === 'instagram' ? `/${target.id}/media` : `/${target.id}/photos`;
            if (target.type === 'instagram') {
                reject({ targetName: target.name, success: false, error: { message: "النشر المباشر للصور على انستجرام يتطلب معالجة من الخادم وهو غير مدعوم حاليًا. استخدم الجدولة كتذكير." } });
                return;
            }

            const formData = new FormData();
            if (target.access_token) formData.append('access_token', target.access_token);
            formData.append('source', image);
            if (text) formData.append('caption', text);
            if (scheduleAt) {
                formData.append('scheduled_publish_time', String(Math.floor(scheduleAt.getTime() / 1000)));
                formData.append('published', 'false');
            }
            apiParams = formData;
        } else {
            apiPath = target.type === 'instagram' ? `/${target.id}/media` : `/${target.id}/feed`;
            if (target.type === 'instagram') {
                reject({ targetName: target.name, success: false, error: { message: "منشورات انستجرام النصية فقط غير مدعومة. يجب إضافة صورة." } });
                return;
            }
            apiParams = { message: text, access_token: target.access_token };
            if (scheduleAt) {
                apiParams.scheduled_publish_time = Math.floor(scheduleAt.getTime() / 1000);
                apiParams.published = false;
            }
        }
        window.FB.api(apiPath, 'POST', apiParams, (response: any) => {
            if (response && !response.error) {
                if(scheduleAt && !isReminder) {
                    const newScheduledPost: ScheduledPost = { id: response.id || `scheduled_${Date.now()}`, text, scheduledAt: scheduleAt, isReminder: false, targetId: target.id, imageUrl: image ? URL.createObjectURL(image) : undefined, targetInfo: { name: target.name, avatarUrl: target.picture.data.url, type: target.type } };
                    setScheduledPosts(prev => [...prev, newScheduledPost]);
                }
                resolve({ targetName: target.name, success: true, response });
            } else {
                const errorMsg = response?.error?.message || 'Unknown error';
                let readableError = errorMsg;
                if (target.type === 'group' && errorMsg.includes('(#200) Requires installed app')) readableError = `فشل النشر: يجب تثبيت التطبيق في إعدادات مجموعة "${target.name}".`;
                else if (errorMsg.includes('OAuthException')) readableError = `فشلت المصادقة للهدف "${target.name}".`;
                else if (target.type === 'instagram' && errorMsg.includes('does not support')) readableError = `انستجرام لا يدعم هذا النوع من المنشورات عبر الـ API.`;
                reject({ targetName: target.name, success: false, error: { ...response.error, message: readableError } });
            }
        });
    });
  };

  const handlePublish = async () => {
    setComposerError('');
    if (!postText.trim() && !selectedImage) { setComposerError('لا يمكن نشر منشور فارغ.'); return; }
    if (includeInstagram && !selectedImage) { setComposerError('منشورات انستجرام تتطلب صورة.'); return; }
    let scheduleAt: Date | null = null;
    if (isScheduled) {
        if (!scheduleDate) { setComposerError('يرجى تحديد تاريخ للجدولة.'); return; }
        scheduleAt = new Date(scheduleDate);
        if (scheduleAt < new Date(Date.now() + 9 * 60 * 1000)) { setComposerError('وقت الجدولة يجب أن يكون بعد 10 دقائق من الآن على الأقل.'); return; }
    }
    setIsPublishing(true);
    const publishPromises = [];
    publishPromises.push(publishToTarget(managedTarget, postText, selectedImage, scheduleAt, false));
    if (includeInstagram && linkedInstagramTarget) {
      publishPromises.push(publishToTarget(linkedInstagramTarget, postText, selectedImage, scheduleAt, isScheduled));
    }
    const results = await Promise.allSettled(publishPromises);
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    if (successCount === results.length) {
        showNotification('success', 'تم تنفيذ طلب النشر/الجدولة بنجاح.');
        clearComposer();
    } else if (successCount > 0) {
        const errors = results.filter(r => r.status === 'rejected').map((r: any) => r.reason.error.message).join(', ');
        showNotification('partial', `تم النشر بنجاح على بعض الوجهات ولكن فشل البعض الآخر: ${errors}`);
    } else {
        const errors = results.filter(r => r.status === 'rejected').map((r: any) => r.reason.error.message).join(', ');
        showNotification('error', `حدثت أخطاء: ${errors}`);
    }
    setIsPublishing(false);
  };
    
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
      if (aiClient && !postText.trim()) {
        generateDescriptionForImage(aiClient, file, pageProfile).then(setPostText).catch(e => setComposerError(e.message));
      }
    }
  };
    
  const handleImageGenerated = (file: File) => {
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  }

  const handleImageRemove = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleStartPostFromPlan = (planItem: ContentPlanItem) => {
      clearComposer();
      setPostText(planItem.postSuggestion);
      setView('composer');
  }

  const handleDeleteScheduledPost = (postId: string) => {
    const postToDelete = scheduledPosts.find(p => p.id === postId);
    if (!postToDelete) return;

    if (isSimulationMode || postToDelete.isReminder) {
        setScheduledPosts(prev => prev.filter(p => p.id !== postId));
        showNotification('success', 'تم حذف المنشور المجدول.');
        return;
    }
    
    const targetForPost = allTargets.find(t => t.id === postToDelete.targetId);
    if (!targetForPost || !targetForPost.access_token) {
        showNotification('error', 'لم يتم العثور على صلاحيات الوصول لحذف هذا المنشور.');
        return;
    }

    window.FB.api(`/${postId}`, 'DELETE', { access_token: targetForPost.access_token }, (response: any) => {
        if (response && response.success) {
            setScheduledPosts(prev => prev.filter(p => p.id !== postId));
            showNotification('success', 'تم حذف المنشور المجدول بنجاح.');
        } else {
            showNotification('error', `فشل حذف المنشور المجدول. ${response?.error?.message || ''}`);
        }
    });
  };

  const handlePublishReminder = async (postId: string) => {
    const reminder = scheduledPosts.find(p => p.id === postId);
    if (!reminder || !reminder.isReminder) return;

    const igTarget = allTargets.find(t => t.id === reminder.targetId);
    if (!igTarget) {
        showNotification('error', 'لم يتم العثور على حساب انستجرام المرتبط.');
        return;
    }
    setPublishingReminderId(postId);
    try {
        await publishToTarget(igTarget, reminder.text, reminder.imageFile || null, null);
        showNotification('success', `تم نشر التذكير بنجاح على ${igTarget.name}`);
        setScheduledPosts(prev => prev.filter(p => p.id !== postId));
    } catch(e: any) {
        showNotification('error', e.message);
    } finally {
        setPublishingReminderId(null);
    }
  };

  const handleGeneratePlan = useCallback(async (request: StrategyRequest, images?: File[]) => {
      if (!aiClient) { setPlanError("مفتاح Gemini API غير مكوّن."); return; }
      setIsGeneratingPlan(true); setPlanError(null); setContentPlan(null);
      try {
          const plan = await generateContentPlan(aiClient, request, pageProfile, images);
          setContentPlan(plan);
          const newHistoryItem: StrategyHistoryItem = { id: `hist_${Date.now()}`, request, plan, summary: `استراتيجية ${request.type} - ${request.duration}`, createdAt: new Date().toISOString() };
          setStrategyHistory(prev => [newHistoryItem, ...prev.slice(0, 19)]);
      } catch (e: any) {
          setPlanError(e.message);
      } finally {
          setIsGeneratingPlan(false);
      }
  }, [aiClient, pageProfile]);

  const handleScheduleStrategy = async () => {
    if (!contentPlan || !aiClient) return;
    setIsSchedulingStrategy(true);
    try {
        const schedule = await generateOptimalSchedule(aiClient, contentPlan);
        const newBulkPosts: BulkPostItem[] = schedule.map((item, index) => ({
            id: `bulk_${Date.now()}_${index}`,
            text: item.postSuggestion,
            scheduleDate: item.scheduledAt,
            targetIds: [managedTarget.id],
        }));
        setBulkPosts(prev => [...prev, ...newBulkPosts]);
        showNotification('success', `تمت إضافة ${newBulkPosts.length} منشورًا إلى الجدولة المجمعة.`);
        setView('bulk');
    } catch (e: any) {
        showNotification('error', `فشل جدولة الاستراتيجية: ${e.message}`);
    } finally {
        setIsSchedulingStrategy(false);
    }
  };

    const onUpdateBulkPost = (id: string, updates: Partial<BulkPostItem>) => {
        setBulkPosts(prev => prev.map(p => p.id === id ? { ...p, ...updates, error: updates.error ? updates.error : undefined } : p));
    };

    const onRemoveBulkPost = (id: string) => {
        setBulkPosts(prev => prev.filter(p => p.id !== id));
    };

    const onAddBulkPosts = (files: FileList) => {
        const newPosts: BulkPostItem[] = Array.from(files).map(file => {
            return {
                id: `bulk_${Date.now()}_${Math.random()}`,
                imageFile: file,
                imagePreview: URL.createObjectURL(file),
                text: '',
                scheduleDate: '',
                targetIds: [managedTarget.id],
            };
        });
        const combined = [...bulkPosts, ...newPosts];
        const rescheduled = rescheduleBulkPosts(combined, schedulingStrategy, weeklyScheduleSettings);
        setBulkPosts(rescheduled);
    };

    const onGenerateBulkDescription = async (id: string) => {
        const post = bulkPosts.find(p => p.id === id);
        if (!aiClient || !post || !post.imageFile) return;
        onUpdateBulkPost(id, { isGeneratingDescription: true });
        try {
            const description = await generateDescriptionForImage(aiClient, post.imageFile, pageProfile);
            onUpdateBulkPost(id, { text: description, isGeneratingDescription: false });
        } catch (e: any) {
            onUpdateBulkPost(id, { error: e.message, isGeneratingDescription: false });
        }
    };

    const handleScheduleAll = async () => {
        if (bulkPosts.length === 0) return;
        setIsSchedulingAll(true);
        showNotification('success', `بدأت جدولة ${bulkPosts.length} منشورًا...`);

        const results = await Promise.all(bulkPosts.map(async (post) => {
            try {
                if (post.targetIds.length === 0) throw new Error('لم يتم تحديد وجهة للنشر.');
                if (!post.scheduleDate) throw new Error('لم يتم تحديد تاريخ للجدولة.');
                const scheduleAt = new Date(post.scheduleDate);
                if (scheduleAt < new Date()) throw new Error('لا يمكن الجدولة في الماضي.');
                const imageFile = post.imageFile || null;
                const text = post.text;
                const publishPromises = post.targetIds.map(targetId => {
                    const target = allTargets.find(t => t.id === targetId);
                    if (!target) throw new Error(`لم يتم العثور على الوجهة بالمعرف: ${targetId}`);
                    if (target.type === 'instagram' && !imageFile) throw new Error(`منشورات انستجرام تتطلب صورة.`);
                    const isReminder = target.type === 'instagram';
                    return publishToTarget(target, text, imageFile, scheduleAt, isReminder);
                });
                await Promise.all(publishPromises);
                return { id: post.id, success: true };
            } catch (e: any) {
                onUpdateBulkPost(post.id, { error: e.message });
                return { id: post.id, success: false, error: e.message };
            }
        }));
        
        const successfulPosts = results.filter(r => r.success);
        const failedPosts = results.filter(r => !r.success);
        if (failedPosts.length === 0) {
            showNotification('success', `تمت جدولة جميع المنشورات (${successfulPosts.length}) بنجاح.`);
            setBulkPosts([]);
        } else {
            showNotification('partial', `تمت جدولة ${successfulPosts.length} منشورًا. فشل ${failedPosts.length}.`);
            setBulkPosts(prev => prev.filter(p => failedPosts.some(f => f.id === p.id)));
        }
        setIsSchedulingAll(false);
    };

    const handleGenerateInsights = useCallback(async (postId: string) => {
        if (!aiClient) return;
        const post = publishedPosts.find(p => p.id === postId);
        if (!post) return;
        setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, isGeneratingInsights: true } } : p));
        try {
            const postComments = inboxItems
                .filter(item => item.type === 'comment' && item.post?.id === postId)
                .map(item => ({ message: item.text }));
            const insights = await generatePostInsights(aiClient, post.text, post.analytics, postComments);
            setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, isGeneratingInsights: false, aiSummary: insights.performanceSummary, sentiment: insights.sentiment, lastUpdated: new Date() } } : p));
        } catch (e: any) {
            setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, isGeneratingInsights: false, aiSummary: 'فشل تحليل المنشور.' } } : p));
            showNotification('error', `فشل تحليل المنشور: ${e.message}`);
        }
    }, [aiClient, publishedPosts, inboxItems, showNotification]);

  const pendingReminders = useMemo(() => {
    const now = new Date();
    return scheduledPosts.filter(p => p.isReminder && new Date(p.scheduledAt) <= now);
  }, [scheduledPosts]);
    
  const getNotificationBgColor = () => {
    if (!notification) return '';
    switch(notification.type) {
        case 'success': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
        case 'error': return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
        case 'partial': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
    }
  }
  
  const renderView = () => {
    switch(view) {
        case 'composer':
            return (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    <div className="lg:col-span-3">
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
                    </div>
                    <div className="lg:col-span-2">
                        <PostPreview
                            isCrosspostingInstagram={includeInstagram}
                            postText={postText}
                            imagePreview={imagePreview}
                            pageName={managedTarget.name}
                            pageAvatar={managedTarget.picture.data.url}
                        />
                    </div>
                </div>
            );
        case 'inbox':
            return <InboxPage items={inboxItems} isLoading={isInboxLoading} onReply={handleReplySubmit} onGenerateSmartReplies={handleGenerateSmartReplies} onFetchMessageHistory={fetchMessageHistory} autoResponderSettings={autoResponderSettings} onAutoResponderSettingsChange={setAutoResponderSettings} />;
        case 'calendar':
            return <ContentCalendar posts={scheduledPosts} onDelete={handleDeleteScheduledPost} />;
        case 'drafts':
            return <DraftsList drafts={drafts} onLoad={handleLoadDraft} onDelete={handleDeleteDraft} />;
        case 'analytics':
            return <AnalyticsPage period={analyticsPeriod} onPeriodChange={setAnalyticsPeriod} summaryData={summaryData} aiSummary={performanceSummaryText} isGeneratingSummary={isGeneratingSummary} posts={filteredPosts} isLoading={publishedPostsLoading} onFetchAnalytics={() => {}} onGenerateInsights={handleGenerateInsights} />;
        case 'bulk':
            return <BulkSchedulerPage bulkPosts={bulkPosts} onAddPosts={onAddBulkPosts} onUpdatePost={onUpdateBulkPost} onRemovePost={onRemoveBulkPost} onScheduleAll={handleScheduleAll} isSchedulingAll={isSchedulingAll} targets={allTargets} aiClient={aiClient} onGenerateDescription={onGenerateBulkDescription} schedulingStrategy={schedulingStrategy} onSchedulingStrategyChange={setSchedulingStrategy} weeklyScheduleSettings={weeklyScheduleSettings} onWeeklyScheduleSettingsChange={setWeeklyScheduleSettings} onReschedule={handleReschedule} />;
        case 'planner':
            return <ContentPlannerPage aiClient={aiClient} isGenerating={isGeneratingPlan} isFetchingProfile={isFetchingProfile} onFetchProfile={handleFetchProfile} error={planError} plan={contentPlan} onGeneratePlan={handleGeneratePlan} isSchedulingStrategy={isSchedulingStrategy} onScheduleStrategy={handleScheduleStrategy} onStartPost={handleStartPostFromPlan} pageProfile={pageProfile} onProfileChange={setPageProfile} strategyHistory={strategyHistory} onLoadFromHistory={setContentPlan} onDeleteFromHistory={(id) => setStrategyHistory(prev => prev.filter(h => h.id !== id))} />;
        default: return null;
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
        <Header
            pageName={managedTarget.name}
            onChangePage={onChangePage}
            onLogout={onLogout}
            onSettingsClick={onSettingsClick}
            isSimulationMode={isSimulationMode}
        />
        <div className="flex flex-1 overflow-hidden">
            <aside className="w-60 bg-white dark:bg-gray-800 p-4 overflow-y-auto shadow-lg z-10 hidden md:block">
                <nav className="space-y-2">
                    <NavItem icon={<PencilSquareIcon className="w-5 h-5" />} label="إنشاء منشور" active={view === 'composer'} onClick={() => setView('composer')} />
                    <NavItem icon={<InboxArrowDownIcon className="w-5 h-5" />} label="البريد الوارد" active={view === 'inbox'} onClick={() => setView('inbox')} />
                    <NavItem icon={<CalendarIcon className="w-5 h-5" />} label="تقويم المحتوى" active={view === 'calendar'} onClick={() => setView('calendar')} notificationCount={pendingReminders.length} />
                    <NavItem icon={<ArchiveBoxIcon className="w-5 h-5" />} label="المسودات" active={view === 'drafts'} onClick={() => setView('drafts')} notificationCount={drafts.length} />
                    <NavItem icon={<ChartBarIcon className="w-5 h-5" />} label="التحليلات" active={view === 'analytics'} onClick={() => setView('analytics')} />
                    <NavItem icon={<QueueListIcon className="w-5 h-5" />} label="الجدولة المجمعة" active={view === 'bulk'} onClick={() => setView('bulk')} notificationCount={bulkPosts.length} />
                    <NavItem icon={<BrainCircuitIcon className="w-5 h-5" />} label="مخطط المحتوى" active={view === 'planner'} onClick={() => setView('planner')} />
                </nav>
            </aside>
            <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
                {notification && (
                    <div className={`p-4 mb-6 rounded-lg ${getNotificationBgColor()}`}>
                        {notification.message}
                    </div>
                )}
                {pendingReminders.length > 0 && view !== 'calendar' && (
                  <div className="space-y-2 mb-6">
                    {pendingReminders.map(post => (
                      <ReminderCard key={post.id} post={post} onPublish={() => handlePublishReminder(post.id)} isPublishing={publishingReminderId === post.id} />
                    ))}
                  </div>
                )}
                {renderView()}
            </main>
        </div>
    </div>
  );
};

export default DashboardPage;
