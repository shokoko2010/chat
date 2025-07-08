
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Target, PublishedPost, Draft, ScheduledPost, BulkPostItem, ContentPlanItem, StrategyRequest, WeeklyScheduleSettings, PageProfile, PerformanceSummaryData, StrategyHistoryItem, InboxItem, AutoResponderSettings } from '../types';
import Header from './Header';
import PostComposer from './PostComposer';
import PostPreview from './PostPreview';
import AnalyticsPage from './AnalyticsPage';
import DraftsList from './DraftsList';
import ContentCalendar from './ContentCalendar';
import BulkSchedulerPage from './BulkSchedulerPage';
import ContentPlannerPage from './ContentPlannerPage';
import ReminderCard from './ReminderCard';
import InboxPage from './InboxPage'; // Import new component
import { GoogleGenAI } from '@google/genai';
import { generateDescriptionForImage, generateContentPlan, generatePerformanceSummary, generateOptimalSchedule, generatePostInsights, enhanceProfileFromFacebookData, generateSmartReplies } from '../services/geminiService';

// Icons
import PencilSquareIcon from './icons/PencilSquareIcon';
import CalendarIcon from './icons/CalendarIcon';
import ArchiveBoxIcon from './icons/ArchiveBoxIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import QueueListIcon from './icons/QueueListIcon';
import BrainCircuitIcon from './icons/BrainCircuitIcon';
import InboxArrowDownIcon from './icons/InboxArrowDownIcon'; // Import new icon


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
    // Default to including IG if available, and not scheduling.
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
        // Step 1: Fetch raw data from Facebook
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
                try {
                    // Step 2: Enhance with AI
                    const enhancedProfile = await enhanceProfileFromFacebookData(aiClient, rawProfileData);
                    setPageProfile(prev => ({ ...enhancedProfile, currentOffers: prev.currentOffers })); 
                    showNotification('success', 'تم استرداد وتحسين بيانات الصفحة بنجاح!');
                } catch (aiError: any) {
                    // Fallback to raw data if AI fails
                    console.error("AI enhancement failed:", aiError);
                    showNotification('partial', 'تم استرداد البيانات بنجاح، لكن فشل التحسين بالـ AI. سيتم استخدام البيانات الأولية.');
                    setPageProfile(prev => ({
                        description: rawProfileData.about,
                        services: rawProfileData.category,
                        contactInfo: rawProfileData.contact,
                        website: rawProfileData.website,
                        address: rawProfileData.address,
                        country: rawProfileData.country,
                        currentOffers: prev.currentOffers,
                    }));
                }
            } else {
                // Fallback if AI is not configured
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
            const errorMessage = fbResponse?.error?.message || 'فشل استرداد بيانات الصفحة. قد لا تتوفر هذه البيانات بشكل عام.';
            throw new Error(errorMessage);
        }
    } catch (e: any) {
        showNotification('error', e.message);
        setPlanError(e.message);
    } finally {
        setIsFetchingProfile(false);
    }
  }, [managedTarget.id, isSimulationMode, aiClient, showNotification, setPlanError, setPageProfile]);


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
        if (sortedDays.length === 0) return postsToReschedule; // Can't schedule if no days are selected

        let lastDate = new Date(lastScheduledTime);
        
        return postsToReschedule.map(post => {
            let nextScheduleDate = new Date(lastDate);
            nextScheduleDate.setHours(parseInt(weeklySettings.time.split(':')[0]), parseInt(weeklySettings.time.split(':')[1]), 0, 0);

            // Find the next available day
            while(true) {
                const currentDay = nextScheduleDate.getDay();
                const nextDayInCycle = sortedDays.find(d => d >= currentDay);

                if (nextDayInCycle !== undefined) {
                    nextScheduleDate.setDate(nextScheduleDate.getDate() + (nextDayInCycle - currentDay));
                } else {
                    // a week later, on the first available day
                    nextScheduleDate.setDate(nextScheduleDate.getDate() + (7 - currentDay + sortedDays[0]));
                }
                
                // If the new date is in the past or too soon, try again from the next day
                if (nextScheduleDate <= lastDate || nextScheduleDate.getTime() < Date.now() + 10 * 60 * 1000) {
                   nextScheduleDate.setDate(nextScheduleDate.getDate() + 1);
                   continue;
                }
                
                lastDate = new Date(nextScheduleDate); // Found a valid slot
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

  
  // Load data from localStorage when managedTarget changes
  useEffect(() => {
    const dataKey = `zex-pages-data-${managedTarget.id}`;
    let savedData;
    try {
        const rawData = localStorage.getItem(dataKey);
        if (rawData) {
            const parsedData = JSON.parse(rawData);
            // Re-instantiate file objects is not possible, so we handle it gracefully.
            savedData = {
              ...parsedData,
              drafts: parsedData.drafts?.map((d: any) => ({...d, imageFile: null})) || [],
              scheduledPosts: parsedData.scheduledPosts?.map((p: any) => ({...p, scheduledAt: new Date(p.scheduledAt), imageFile: null })) || [],
              autoRepliedItems: Array.from(parsedData.autoRepliedItems || []),
              repliedUsersPerPost: parsedData.repliedUsersPerPost || {}
            }
        } else {
            savedData = {};
        }
    } catch(e) {
        console.error("Failed to parse saved data, resetting.", e);
        localStorage.removeItem(dataKey); // Remove corrupt data
        savedData = {};
    }

    setPageProfile(savedData.pageProfile || { description: '', services: '', contactInfo: '', website: '', currentOffers: '', address: '', country: '' });
    setDrafts(savedData.drafts || []);
    setScheduledPosts(savedData.scheduledPosts || []);
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
    
    // We clear bulk posts on page change to avoid complexity with non-serializable File objects.
    setBulkPosts([]);


    // Reset composer and session-based state
    clearComposer();
    setPublishedPostsLoading(true);
    setView('composer');

    // Fetch real published posts
    if (isSimulationMode) {
      setPublishedPostsLoading(false);
      return;
    }
    
    if (!savedData.publishedPosts || savedData.publishedPosts.length === 0) {
        const endpoint = managedTarget.type === 'group' ? 'feed' : 'published_posts';
        const fields = managedTarget.type === 'group' 
            ? 'id,message,full_picture,created_time,likes.summary(true),comments.summary(true)'
            : 'id,message,full_picture,created_time,likes.summary(true),comments.summary(true),shares,insights.metric(post_impressions_unique){values}';

        fetchWithPagination(`/${managedTarget.id}/${endpoint}?fields=${fields}&limit=100`)
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
        }).catch(error => {
            console.error(`Error fetching posts for ${managedTarget.name}:`, error);
        }).finally(() => {
            setPublishedPostsLoading(false);
        });
    } else {
        setPublishedPostsLoading(false);
    }
    
  }, [managedTarget.id, isSimulationMode, clearComposer, fetchWithPagination, managedTarget.name, managedTarget.picture.data.url, managedTarget.type]);
  
  // Save data to localStorage whenever it changes
  useEffect(() => {
    try {
        const dataKey = `zex-pages-data-${managedTarget.id}`;
        // Create serializable versions of state that contain non-serializable objects like File.
        // We only store metadata for files, not the files themselves.
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
    const cutoffDate = new Date(now.setDate(now.getDate() - daysToFilter));
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
                console.error("Error generating performance summary:", e);
                setPerformanceSummaryText("حدث خطأ أثناء إنشاء الملخص.");
            } finally {
                setIsGeneratingSummary(false);
            }
        };
        generateSummary();
    }
  }, [summaryData, aiClient, pageProfile, analyticsPeriod]);
  
  const handleSendMessage = async (conversationId: string, message: string): Promise<boolean> => {
    return new Promise(resolve => {
        if(isSimulationMode) {
            console.log(`SIMULATING SEND MESSAGE to ${conversationId}: ${message}`);
            resolve(true);
            return;
        }
        window.FB.api(`/${conversationId}/messages`, 'POST', { message, access_token: managedTarget.access_token }, (response: any) => {
            if(response && !response.error) {
                fetchMessageHistory(conversationId); // Refresh conversation
                resolve(true);
            } else {
                console.error("Error sending message:", response.error);
                resolve(false);
            }
        });
    });
  };

  const handleReplyToComment = async (commentId: string, message: string): Promise<boolean> => {
    return new Promise(resolve => {
        if(isSimulationMode) {
            console.log(`SIMULATING REPLY to ${commentId}: ${message}`);
            resolve(true);
            return;
        }
        window.FB.api(`/${commentId}/comments`, 'POST', { message, access_token: managedTarget.access_token }, (response: any) => {
            if(response && !response.error) {
                resolve(true);
            } else {
                console.error("Error replying to comment:", response.error);
                resolve(false);
            }
        });
    });
  };

  const handlePrivateReplyToComment = async (commentId: string, message: string): Promise<boolean> => {
    return new Promise(resolve => {
        if (isSimulationMode) {
            console.log(`SIMULATING PRIVATE REPLY to ${commentId}: ${message}`);
            resolve(true);
            return;
        }
        window.FB.api(`/${commentId}/private_replies`, 'POST', { message, access_token: managedTarget.access_token }, (response: any) => {
            if (response && response.success) {
                resolve(true);
            } else {
                console.error("Error sending private reply:", response?.error);
                resolve(false);
            }
        });
    });
  };

  const processAutoReplies = useCallback(async (currentInboxItems: InboxItem[]) => {
      const { comments: commentSettings, messages: messageSettings } = autoResponderSettings;
      if (!commentSettings.realtimeEnabled && !messageSettings.realtimeEnabled) {
          return;
      }

      const itemsToProcess = currentInboxItems.filter(item => !autoRepliedItems.has(item.id));
      if (itemsToProcess.length === 0) return;

      const newRepliedItems = new Set(autoRepliedItems);
      const newRepliedUsers = { ...repliedUsersPerPost };
      let replyCount = 0;

      for (const item of itemsToProcess) {
          let replied = false;

          if (item.type === 'message' && messageSettings.realtimeEnabled) {
              const keywords = messageSettings.keywords.split(',').map(k => k.trim()).filter(Boolean);
              if (keywords.length === 0 || keywords.some(k => item.text.toLowerCase().includes(k.toLowerCase()))) {
                  const message = messageSettings.replyMessage.replace('{user_name}', item.authorName);
                  await handleSendMessage(item.id, message);
                  replied = true;
              }
          }

          if (item.type === 'comment' && commentSettings.realtimeEnabled && item.post) {
              const postId = item.post.id;
              const keywords = commentSettings.keywords.split(',').map(k => k.trim()).filter(Boolean);
              const alreadyRepliedToUser = newRepliedUsers[postId]?.includes(item.authorId);

              if ((keywords.length === 0 || keywords.some(k => item.text.toLowerCase().includes(k.toLowerCase()))) &&
                  (!commentSettings.replyOncePerUser || !alreadyRepliedToUser)) {
                  
                  if (commentSettings.publicReplyEnabled && commentSettings.publicReplyMessage) {
                      await handleReplyToComment(item.id, commentSettings.publicReplyMessage.replace('{user_name}', item.authorName));
                  }
                  if (commentSettings.privateReplyEnabled && commentSettings.privateReplyMessage) {
                      await handlePrivateReplyToComment(item.id, commentSettings.privateReplyMessage.replace('{user_name}', item.authorName));
                  }
                  
                  if (commentSettings.replyOncePerUser) {
                      if (!newRepliedUsers[postId]) newRepliedUsers[postId] = [];
                      newRepliedUsers[postId].push(item.authorId);
                  }
                  replied = true;
              }
          }

          if (replied) {
              newRepliedItems.add(item.id);
              replyCount++;
          }
      }

      setAutoRepliedItems(newRepliedItems);
      setRepliedUsersPerPost(newRepliedUsers);
      if (replyCount > 0) {
          showNotification('success', `تم إرسال ${replyCount} ردًا تلقائيًا.`);
      }
  }, [autoResponderSettings, autoRepliedItems, repliedUsersPerPost, showNotification]);


  // --- Start Inbox Logic ---
    const fetchMessageHistory = async (conversationId: string) => {
      const response: any = await new Promise(resolve => window.FB.api(`/${conversationId}/messages`, { fields: 'id,message,from,created_time', access_token: managedTarget.access_token }, (res: any) => resolve(res)));
      if (response && response.data) {
        setInboxItems(prevItems => {
          const itemIndex = prevItems.findIndex(item => item.id === conversationId);
          if (itemIndex > -1) {
            const newItems = [...prevItems];
            newItems[itemIndex] = { ...newItems[itemIndex], messages: response.data.reverse() };
            return newItems;
          }
          return prevItems;
        });
      }
    };


    useEffect(() => {
        if (view === 'inbox' && !isSimulationMode) {
            setIsInboxLoading(true);

            const fetchAllData = async () => {
                const fetchAllComments = async (): Promise<InboxItem[]> => {
                    let allPosts: {id: string, message?: string, full_picture?: string}[] = [];
                    let batchParams: any = {};
                    const postFields = "id,message,full_picture";
    
                    if (managedTarget.type === 'page') {
                        // Use /feed to get all posts, not just ones published by the page
                        const pagePosts = await fetchWithPagination(`/${managedTarget.id}/feed?fields=${postFields}&limit=50`);
                        allPosts.push(...pagePosts);
                        if (linkedInstagramTarget) {
                           // For IG, use /media and normalize fields. Note: IG comment fetching via batch can be tricky.
                           // The /posts endpoint is not standard for IG. This is a best-effort fix on the FB part.
                            const igPosts = await fetchWithPagination(`/${linkedInstagramTarget.id}/media?fields=id,caption,media_url,timestamp&limit=50`);
                            const normalizedIgPosts = igPosts.map(p => ({ id: p.id, message: p.caption, full_picture: p.media_url }));
                            allPosts.push(...normalizedIgPosts);
                        }
                        batchParams.access_token = managedTarget.access_token;
                    } else if (managedTarget.type === 'group') {
                        const groupPosts = await fetchWithPagination(`/${managedTarget.id}/feed?fields=${postFields}&limit=50`);
                        allPosts.push(...groupPosts);
                    }
                    
                    if (allPosts.length === 0) return [];
    
                    const commentsBatchRequest = allPosts.map(post => ({
                        method: 'GET',
                        relative_url: `${post.id}/comments?fields=id,from{id,name,picture{url}},message,created_time&limit=25&order=reverse_chronological`
                    }));
    
                    const commentsResponse: any = await new Promise(resolve => 
                        window.FB.api('/', 'POST', { batch: commentsBatchRequest, ...batchParams }, (res: any) => resolve(res))
                    );
                    
                    const allComments: InboxItem[] = [];
                     if (commentsResponse && !commentsResponse.error) {
                        commentsResponse.forEach((res: any, index: number) => {
                            if (res.code === 200) {
                                try {
                                    const body = JSON.parse(res.body);
                                    const originalPost = allPosts[index];
                                    if (body.data) {
                                        body.data.forEach((comment: any) => {
                                            allComments.push({
                                                id: comment.id, type: 'comment', text: comment.message,
                                                authorName: comment.from?.name || 'Unknown User', 
                                                authorId: comment.from?.id || 'Unknown',
                                                authorPictureUrl: comment.from?.picture?.data?.url || `https://graph.facebook.com/${comment.from?.id}/picture`,
                                                timestamp: comment.created_time, 
                                                post: { id: originalPost.id, message: originalPost.message, picture: originalPost.full_picture }
                                            });
                                        });
                                    }
                                } catch (e) {
                                    console.error("Error parsing comment response body:", e, res.body);
                                }
                            }
                        });
                    } else {
                        console.error("Error fetching comments batch:", commentsResponse?.error);
                    }
                    return allComments;
                };
    
                const fetchAllMessages = async (): Promise<InboxItem[]> => {
                    if (managedTarget.type !== 'page') return [];
                    const convosData = await fetchWithPagination(`/${managedTarget.id}/conversations?fields=id,snippet,updated_time,participants&limit=100`);
                    return convosData.map((convo: any) => {
                        const participant = convo.participants.data.find((p: any) => p.id !== managedTarget.id);
                        return {
                            id: convo.id, type: 'message', text: convo.snippet, authorName: participant?.name || 'Unknown',
                            authorId: participant?.id || 'Unknown', authorPictureUrl: `https://graph.facebook.com/${participant?.id}/picture`,
                            timestamp: convo.updated_time, conversationId: convo.id
                        };
                    });
                };

                Promise.all([fetchAllComments(), fetchAllMessages()]).then(([comments, messages]) => {
                    const combinedItems = new Map<string, InboxItem>();
                    
                    inboxItems.forEach(item => combinedItems.set(item.id, item));
    
                    [...comments, ...messages].forEach(item => {
                        if(item.type === 'message' && combinedItems.has(item.id)) {
                            const existingItem = combinedItems.get(item.id);
                            if(existingItem && existingItem.messages) {
                                item.messages = existingItem.messages;
                            }
                        }
                        combinedItems.set(item.id, item);
                    });
                    
                    const allItems = Array.from(combinedItems.values());
                    allItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                    
                    setInboxItems(allItems);
                    processAutoReplies(allItems);
                    
                }).catch(err => {
                    console.error("Error fetching inbox items:", err);
                    showNotification('error', 'فشل في جلب البريد الوارد.');
                }).finally(() => {
                    setIsInboxLoading(false);
                });
            };
            
            fetchAllData();

        }
    }, [view, managedTarget.id, linkedInstagramTarget?.id, isSimulationMode]); // Rerun when view or target changes
  
  const handleReplySubmit = async (selectedItem: InboxItem, message: string): Promise<boolean> => {
      if (selectedItem.type === 'comment') {
          return handleReplyToComment(selectedItem.id, message);
      } else {
          return handleSendMessage(selectedItem.id, message);
      }
  };


  const handleGenerateSmartReplies = async (commentText: string): Promise<string[]> => {
    if (!aiClient) {
        showNotification('error', 'يجب تفعيل الذكاء الاصطناعي لاستخدام هذه الميزة.');
        return [];
    }
    try {
        const replies = await generateSmartReplies(aiClient, commentText, pageProfile);
        return replies;
    } catch(e:any) {
        showNotification('error', e.message);
        return [];
    }
  };

  // --- End Inbox Logic ---


  // --- Start Drafts Logic ---
  const handleSaveDraft = () => {
    if (!postText.trim() && !selectedImage) {
        setComposerError('لا يمكن حفظ مسودة فارغة.');
        return;
    }
    const newDraft: Draft = {
        id: `draft_${Date.now()}`, text: postText, imageFile: selectedImage,
        imagePreview: imagePreview, targetId: managedTarget.id, isScheduled, scheduleDate, includeInstagram
    };
    setDrafts(prev => [newDraft, ...prev]);
    showNotification('success', 'تم حفظ المسودة بنجاح.');
    clearComposer();
  };

  const handleLoadDraft = (draftId: string) => {
    const draft = drafts.find(d => d.id === draftId);
    if(draft) {
        setPostText(draft.text);
        setSelectedImage(draft.imageFile);
        setImagePreview(draft.imagePreview);
        setIsScheduled(draft.isScheduled);
        setScheduleDate(draft.scheduleDate);
        setIncludeInstagram(draft.includeInstagram);
        setView('composer');
        handleDeleteDraft(draftId, false); // Remove from drafts list after loading
    }
  };
  
  const handleDeleteDraft = (draftId: string, showNotif: boolean = true) => {
      setDrafts(prev => prev.filter(d => d.id !== draftId));
      if (showNotif) showNotification('success', 'تم حذف المسودة.');
  };
  // --- End Drafts Logic ---

  const publishToTarget = (target: Target, text: string, image: File | null, scheduleAt: Date | null, isReminder: boolean = false) => {
      return new Promise<{targetName: string; success: boolean, response: any}>((resolve, reject) => {
          if (isReminder) {
              const newReminder: ScheduledPost = {
                  id: `reminder_${Date.now()}`, text, scheduledAt: scheduleAt!, isReminder: true, targetId: target.id,
                  imageFile: image || undefined, imageUrl: image ? URL.createObjectURL(image) : undefined,
                  targetInfo: { name: target.name, avatarUrl: target.picture.data.url, type: 'instagram' }
              };
              setScheduledPosts(prev => [...prev, newReminder]);
              resolve({ targetName: target.name, success: true, response: { id: newReminder.id } });
              return;
          }

          if (isSimulationMode) {
              console.log(`SIMULATING PUBLISH: Target=${target.name}, Schedule=${scheduleAt}, Text=${text}`);
              if(scheduleAt){
                const newScheduledPost: ScheduledPost = {
                  id: `sim_scheduled_${Date.now()}`, text, scheduledAt: scheduleAt!, isReminder: false, targetId: target.id,
                  imageUrl: image ? URL.createObjectURL(image) : undefined,
                  targetInfo: { name: target.name, avatarUrl: target.picture.data.url, type: target.type }
                };
                setScheduledPosts(prev => [...prev, newScheduledPost]);
              }
              setTimeout(() => resolve({ targetName: target.name, success: true, response: { id: `sim_${Date.now()}` } }), 500);
              return;
          }

          let apiPath: string, apiParams: any;
          if (image) {
              apiPath = `/${target.id}/photos`;
              const formData = new FormData();
              if (target.type === 'page' || target.type === 'instagram') formData.append('access_token', target.access_token!);
              formData.append('source', image);
              if (text) formData.append('caption', text);
              if (scheduleAt) {
                  formData.append('scheduled_publish_time', String(Math.floor(scheduleAt.getTime() / 1000)));
                  formData.append('published', 'false');
              }
              apiParams = formData;
          } else { // Text only post
              apiPath = `/${target.id}/feed`;
              apiParams = { message: text };
              if (target.type === 'page' || target.type === 'instagram') apiParams.access_token = target.access_token;
              if (scheduleAt) {
                  apiParams.scheduled_publish_time = Math.floor(scheduleAt.getTime() / 1000);
                  apiParams.published = false;
              }
          }

          window.FB.api(apiPath, 'POST', apiParams, (response: any) => {
              if (response && !response.error) {
                  if(scheduleAt) {
                     const newScheduledPost: ScheduledPost = {
                      id: response.post_id || `scheduled_${Date.now()}`, text, scheduledAt: scheduleAt!, isReminder: false, targetId: target.id,
                      imageUrl: image ? URL.createObjectURL(image) : undefined,
                      targetInfo: { name: target.name, avatarUrl: target.picture.data.url, type: target.type }
                    };
                    setScheduledPosts(prev => [...prev, newScheduledPost]);
                  }
                  resolve({ targetName: target.name, success: true, response });
              } else {
                  const errorMsg = response?.error?.message || 'Unknown error';
                  if (target.type === 'group' && errorMsg.includes('(#200) Requires installed app')) {
                      reject({ targetName: target.name, success: false, error: { ...response.error, message: `فشل النشر: يجب تثبيت التطبيق في إعدادات مجموعة "${target.name}".` } });
                  } else {
                      reject({ targetName: target.name, success: false, error: response.error });
                  }
              }
          });
      });
  };

  const handlePublishFromComposer = useCallback(async () => {
    if (!postText.trim() && !selectedImage) { setComposerError('لا يمكن نشر منشور فارغ.'); return; }
    if (includeInstagram && !selectedImage) { setComposerError('منشورات انستجرام تتطلب وجود صورة.'); return; }
    let scheduleAt: Date | null = null;
    if (isScheduled) {
        if (!scheduleDate) { setComposerError('يرجى تحديد تاريخ ووقت للجدولة.'); return; }
        const scheduleDateTime = new Date(scheduleDate);
        if(scheduleDateTime.getTime() < Date.now() + 9 * 60 * 1000) { setComposerError('يجب أن يكون وقت الجدولة بعد 10 دقائق من الآن على الأقل.'); return; }
        scheduleAt = scheduleDateTime;
    }
    setComposerError('');
    setIsPublishing(true);
    setNotification(null);
    
    const action = scheduleAt ? (includeInstagram ? 'جدولة التذكير' : 'الجدولة') : 'النشر';
    try {
        if (includeInstagram && linkedInstagramTarget) {
            // Publish to FB, create reminder for IG
            await publishToTarget(managedTarget, postText, selectedImage, scheduleAt, false);
            await publishToTarget(linkedInstagramTarget, postText, selectedImage, scheduleAt, true);
        } else {
            // Publish to FB/Group only
            await publishToTarget(managedTarget, postText, selectedImage, scheduleAt, false);
        }
        showNotification('success', `تم ${action} بنجاح!`);
        clearComposer();
    } catch (e: any) {
        console.error('Publishing error:', e);
        showNotification('error', e.error?.message || `فشل ${action}. يرجى المحاولة مرة أخرى.`);
    } finally {
        setIsPublishing(false);
    }
  }, [postText, selectedImage, isScheduled, scheduleDate, managedTarget, includeInstagram, linkedInstagramTarget, clearComposer, showNotification]);
  
  const handlePublishReminder = async (postId: string) => {
    const post = scheduledPosts.find(p => p.id === postId);
    if (!post) return;
    
    setPublishingReminderId(postId);
    try {
        const target = allTargets.find(t => t.id === post.targetId);
        if (!target) throw new Error("Target not found");
        await publishToTarget(target, post.text, post.imageFile || null, null, false);
        setScheduledPosts(prev => prev.filter(p => p.id !== postId));
        showNotification('success', `تم نشر التذكير بنجاح إلى ${target.name}.`);
    } catch(e:any) {
        console.error("Reminder publishing error:", e);
        showNotification('error', e.error?.message || 'فشل نشر التذكير.');
    } finally {
        setPublishingReminderId(null);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
      e.target.value = '';
    }
  };
  
  const handleGeneratedImageSelect = (file: File) => {
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };
  
  const handleImageRemove = () => { setSelectedImage(null); setImagePreview(null); };

  const handleStartPostFromPlan = (item: ContentPlanItem) => {
    clearComposer();
    setPostText(item.postSuggestion);
    setView('composer');
  };
  
  const handleAddStrategyToHistory = (request: StrategyRequest, plan: ContentPlanItem[]) => {
    let summary: string;
    const durationText = request.duration === 'weekly' ? 'أسبوعية' : request.duration === 'monthly' ? `شهرية (${request.postCount || ''} منشور)` : 'سنوية';
    
    switch (request.type) {
        case 'standard': summary = `خطة قياسية - ${durationText}`; break;
        case 'campaign': summary = `حملة: ${request.campaignName} - ${durationText}`; break;
        case 'occasion': summary = `حملة لمناسبة: ${request.occasion}`; break;
        case 'pillar': summary = `محتوى محوري: ${request.pillarTopic}`; break;
        case 'images': summary = `استراتيجية من ${plan.length} صور`; break;
        default: summary = 'استراتيجية مخصصة';
    }

    const newHistoryItem: StrategyHistoryItem = {
      id: `hist_${Date.now()}`,
      request,
      plan,
      summary,
      createdAt: new Date().toISOString(),
    };
    setStrategyHistory(prev => [newHistoryItem, ...prev]);
  };

  const handleDeleteStrategyFromHistory = (id: string) => {
      setStrategyHistory(prev => prev.filter(item => item.id !== id));
      showNotification('success', 'تم حذف الاستراتيجية من السجل.');
  };

  const handleLoadStrategyFromHistory = (plan: ContentPlanItem[]) => {
      setContentPlan(plan);
      showNotification('success', 'تم تحميل الاستراتيجية بنجاح. يمكنك الآن جدولتها.');
  };
  
  const handleGeneratePlan = async (request: StrategyRequest, images?: File[]) => {
    if (!aiClient) return;
    setIsGeneratingPlan(true);
    setPlanError(null);
    try {
        const plan = await generateContentPlan(aiClient, request, pageProfile, images);
        setContentPlan(plan);
        handleAddStrategyToHistory(request, plan);
    } catch(e: any) {
        setPlanError(e.message);
    } finally {
        setIsGeneratingPlan(false);
    }
  };

  const handleScheduleStrategy = async () => {
    if (!aiClient || !contentPlan) return;
    setIsSchedulingStrategy(true);
    setPlanError(null);
    try {
      const schedule = await generateOptimalSchedule(aiClient, contentPlan);
      
      const formatDateTimeForInputValue = (date: Date) => {
        const pad = (num: number) => num.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
      };

      const defaultTargetIds = [managedTarget.id];
      if (linkedInstagramTarget) {
          defaultTargetIds.push(linkedInstagramTarget.id);
      }
      
      const newBulkPosts: BulkPostItem[] = schedule.map(item => ({
        id: `bulk_strat_${Date.now()}_${Math.random()}`,
        text: item.postSuggestion,
        scheduleDate: formatDateTimeForInputValue(new Date(item.scheduledAt)),
        targetIds: defaultTargetIds,
      }));

      setBulkPosts(prev => [...prev, ...newBulkPosts]);
      setContentPlan(null); // Clear the plan after scheduling
      showNotification('success', `تم تحويل الاستراتيجية إلى ${newBulkPosts.length} منشورًا في الجدولة المجمعة.`);
      setView('bulk');
    } catch (e: any) {
      setPlanError(e.message || "فشل جدولة الاستراتيجية.");
    } finally {
      setIsSchedulingStrategy(false);
    }
  };

  // --- Start Bulk Logic ---
  const handleAddBulkPosts = (files: FileList) => {
    if (!files || files.length === 0) return;

    const newPostsRaw: BulkPostItem[] = Array.from(files).map((file, index) => {
        const defaultTargetIds = [managedTarget.id];
        if (linkedInstagramTarget) {
            defaultTargetIds.push(linkedInstagramTarget.id);
        }
        return {
            id: `bulk_${Date.now()}_${Math.random()}_${index}`,
            imageFile: file,
            imagePreview: URL.createObjectURL(file),
            text: '',
            scheduleDate: '', // Will be set by rescheduling
            targetIds: defaultTargetIds,
        };
    });

    const rescheduledPosts = rescheduleBulkPosts(newPostsRaw, schedulingStrategy, weeklyScheduleSettings);
    setBulkPosts(prev => [...prev, ...rescheduledPosts]);
};

  const handleUpdateBulkPost = (id: string, updates: Partial<BulkPostItem>) => {
      setBulkPosts(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)));
  };

  const handleRemoveBulkPost = (id: string) => {
      setBulkPosts(prev => prev.filter(p => p.id !== id));
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
  
  const handleScheduleAllBulk = async () => {
    let hasErrors = false;
    // Perform validation before scheduling
    const validatedPosts = bulkPosts.map(post => {
      const scheduleAt = new Date(post.scheduleDate);
      if (isNaN(scheduleAt.getTime()) || scheduleAt.getTime() < Date.now() + 9 * 60 * 1000) {
        hasErrors = true;
        return { ...post, error: "تاريخ الجدولة غير صالح أو في الماضي." };
      }
      if (post.targetIds.length === 0) {
        hasErrors = true;
        return { ...post, error: "يجب اختيار وجهة واحدة على الأقل." };
      }
      return { ...post, error: undefined };
    });
  
    setBulkPosts(validatedPosts);
  
    if (hasErrors) {
      showNotification('error', 'الرجاء إصلاح الأخطاء في بعض المنشورات قبل المتابعة.');
      return;
    }

    setIsSchedulingAll(true);
    const promises = bulkPosts.map(async post => {
        try {
            const scheduleAt = new Date(post.scheduleDate);
            const postTargets = allTargets.filter(t => post.targetIds.includes(t.id));
            
            for (const target of postTargets) {
                const isIgReminder = target.type === 'instagram';
                await publishToTarget(target, post.text, post.imageFile || null, scheduleAt, isIgReminder);
            }
            return { ...post, success: true };
        } catch (e: any) {
            const errorMessage = e?.error?.message || e.message || "فشل في الجدولة، سبب غير معروف.";
            const targetName = e?.targetName || post.targetIds.map(id => allTargets.find(t=>t.id===id)?.name).join(', ') || 'وجهة غير محددة';
            return { ...post, success: false, error: `فشل في "${targetName}": ${errorMessage}` };
        }
    });

    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.success).length;
    const failedPosts = results.filter(r => !r.success);

    setIsSchedulingAll(false);
    showNotification('partial', `اكتملت الجدولة المجمعة. نجح: ${successCount}، فشل: ${failedPosts.length}.`);
    setBulkPosts(failedPosts);
  };
  // --- End Bulk Logic ---

  // --- Start Analytics Logic ---
   const handleFetchPostAnalytics = (postId: string) => {
      const postIndex = publishedPosts.findIndex(p => p.id === postId);
      if (postIndex === -1 || isSimulationMode) return;
      
      const updatedPosts = [...publishedPosts];
      updatedPosts[postIndex].analytics.loading = true;
      setPublishedPosts(updatedPosts);
      
      window.FB.api(
        `/${postId}?fields=likes.summary(true),comments.summary(true),shares,insights.metric(post_impressions_unique){values}`,
        (response: any) => {
           const newUpdatedPosts = [...publishedPosts];
           if(response && !response.error){
              newUpdatedPosts[postIndex].analytics = {
                ...newUpdatedPosts[postIndex].analytics,
                likes: response.likes?.summary?.total_count ?? 0,
                comments: response.comments?.summary?.total_count ?? 0,
                shares: response.shares?.count ?? 0,
                reach: response.insights?.data?.[0]?.values?.[0]?.value ?? 0,
                lastUpdated: new Date(),
              }
           } else {
             console.error("Failed to update analytics", response?.error);
           }
           newUpdatedPosts[postIndex].analytics.loading = false;
           setPublishedPosts(newUpdatedPosts);
        }
      );
   };
   
   const handleGeneratePostInsights = async (postId: string) => {
      if (!aiClient) return;
      const postIndex = publishedPosts.findIndex(p => p.id === postId);
      if (postIndex === -1) return;

      const post = publishedPosts[postIndex];
      let updatedPosts = [...publishedPosts];
      updatedPosts[postIndex].analytics.isGeneratingInsights = true;
      setPublishedPosts(updatedPosts);

      try {
        const commentsResponse: any = await new Promise(resolve => 
            window.FB.api(`/${postId}/comments?limit=25`, (res: any) => resolve(res))
        );
        const comments = commentsResponse?.data || [];
        
        const insights = await generatePostInsights(aiClient, post.text, post.analytics, comments);
        
        updatedPosts = [...publishedPosts]; // get fresh copy in case of state changes
        updatedPosts[postIndex].analytics.aiSummary = insights.performanceSummary;
        updatedPosts[postIndex].analytics.sentiment = insights.sentiment;

      } catch (e: any) {
        console.error("Error generating insights:", e);
        showNotification('error', e.message);
      } finally {
        updatedPosts = [...publishedPosts];
        if(updatedPosts[postIndex]) {
            updatedPosts[postIndex].analytics.isGeneratingInsights = false;
        }
        setPublishedPosts(updatedPosts);
      }
   };
  // --- End Analytics Logic ---

  const getNotificationBgColor = () => {
    if (!notification) return '';
    switch(notification.type) {
        case 'success': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
        case 'error': return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
        case 'partial': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
    }
  }
  
  const upcomingReminders = scheduledPosts.filter(p => p.isReminder && new Date(p.scheduledAt) <= new Date());
  
  const availableBulkTargets = useMemo(() => {
    return [managedTarget, ...(linkedInstagramTarget ? [linkedInstagramTarget] : [])];
  }, [managedTarget, linkedInstagramTarget]);

  const renderActiveView = () => {
    switch (view) {
        case 'composer':
            return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6 sticky top-24 self-start">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">معاينة مباشرة</h3>
                        <div className={`grid gap-6 ${includeInstagram ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1 justify-items-center'}`}>
                           <PostPreview type="facebook" postText={postText} imagePreview={imagePreview} pageName={managedTarget.name} pageAvatar={managedTarget.picture.data.url} />
                          {includeInstagram && (
                              <PostPreview type="instagram" postText={postText} imagePreview={imagePreview} pageName={linkedInstagramTarget?.name.split('(')[0].trim() || managedTarget.name} pageAvatar={linkedInstagramTarget?.picture.data.url || managedTarget.picture.data.url} />
                          )}
                        </div>
                    </div>
                    <div className="lg:col-span-1">
                        <PostComposer aiClient={aiClient} onPublish={handlePublishFromComposer} onSaveDraft={handleSaveDraft} isPublishing={isPublishing} postText={postText}
                            onPostTextChange={setPostText} onImageChange={handleImageChange} onImageGenerated={handleGeneratedImageSelect} onImageRemove={handleImageRemove}
                            imagePreview={imagePreview} isScheduled={isScheduled} onIsScheduledChange={setIsScheduled} scheduleDate={scheduleDate}
                            onScheduleDateChange={setScheduleDate} error={composerError} managedTarget={managedTarget} linkedInstagramTarget={linkedInstagramTarget}
                            includeInstagram={includeInstagram} onIncludeInstagramChange={setIncludeInstagram} pageProfile={pageProfile}
                        />
                    </div>
                </div>
            );
        case 'bulk':
            return <BulkSchedulerPage 
                bulkPosts={bulkPosts} 
                onAddPosts={handleAddBulkPosts} 
                onUpdatePost={handleUpdateBulkPost} 
                onRemovePost={handleRemoveBulkPost} 
                onScheduleAll={handleScheduleAllBulk}
                isSchedulingAll={isSchedulingAll} 
                targets={availableBulkTargets} 
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
                onScheduleStrategy={handleScheduleStrategy}
                onStartPost={handleStartPostFromPlan}
                pageProfile={pageProfile}
                onProfileChange={setPageProfile}
                strategyHistory={strategyHistory}
                onLoadFromHistory={handleLoadStrategyFromHistory}
                onDeleteFromHistory={handleDeleteStrategyFromHistory}
            />;
        case 'drafts':
            return <DraftsList drafts={drafts} onLoad={handleLoadDraft} onDelete={handleDeleteDraft} />;
        case 'calendar':
            return <ContentCalendar posts={scheduledPosts} />;
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
                onGenerateInsights={handleGeneratePostInsights}
              />;
        case 'inbox':
            return <InboxPage 
                items={inboxItems}
                isLoading={isInboxLoading}
                onReply={handleReplySubmit}
                onGenerateSmartReplies={handleGenerateSmartReplies}
                onFetchMessageHistory={fetchMessageHistory}
                autoResponderSettings={autoResponderSettings}
                onAutoResponderSettingsChange={setAutoResponderSettings}
            />
        default: return null;
    }
  }

  return (
    <div className="min-h-screen fade-in">
      <Header onLogout={onLogout} isSimulationMode={isSimulationMode} onSettingsClick={onSettingsClick} pageName={managedTarget.name} onChangePage={onChangePage} />
      <main className="p-4 sm:p-8">
        {notification && <div className={`p-4 mb-6 rounded-lg shadow-md transition-all duration-300 ${getNotificationBgColor()}`}>{notification.message}</div>}
        
        {upcomingReminders.length > 0 && (
            <div className="mb-6 space-y-3">
                <h3 className="font-bold text-lg text-yellow-600">تذكيرات جاهزة للنشر!</h3>
                {upcomingReminders.map(post => (
                    <ReminderCard key={post.id} post={post} onPublish={() => handlePublishReminder(post.id)} isPublishing={publishingReminderId === post.id} />
                ))}
            </div>
        )}

        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex space-x-1 sm:space-x-4 -mb-px overflow-x-auto">
                <button onClick={() => setView('composer')} className={`inline-flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 font-semibold text-sm transition-colors shrink-0 ${view === 'composer' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                    <PencilSquareIcon className="w-5 h-5" /> إنشاء منشور
                </button>
                 <button onClick={() => setView('bulk')} className={`inline-flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 font-semibold text-sm transition-colors shrink-0 ${view === 'bulk' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                    <QueueListIcon className="w-5 h-5" /> الجدولة المجمعة
                </button>
                <button onClick={() => setView('planner')} className={`inline-flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 font-semibold text-sm transition-colors shrink-0 ${view === 'planner' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                    <BrainCircuitIcon className="w-5 h-5" /> استراتيجيات المحتوى
                </button>
                 <button onClick={() => setView('inbox')} className={`inline-flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 font-semibold text-sm transition-colors shrink-0 ${view === 'inbox' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                    <InboxArrowDownIcon className="w-5 h-5" /> البريد الوارد ({inboxItems.length})
                </button>
                <button onClick={() => setView('drafts')} className={`inline-flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 font-semibold text-sm transition-colors shrink-0 ${view === 'drafts' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                    <ArchiveBoxIcon className="w-5 h-5" /> المسودات ({drafts.length})
                </button>
                <button onClick={() => setView('calendar')} className={`inline-flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 font-semibold text-sm transition-colors shrink-0 ${view === 'calendar' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                    <CalendarIcon className="w-5 h-5" /> تقويم المحتوى ({scheduledPosts.length})
                </button>
                 <button onClick={() => setView('analytics')} className={`inline-flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 font-semibold text-sm transition-colors shrink-0 ${view === 'analytics' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                    <ChartBarIcon className="w-5 h-5" /> التحليلات
                </button>
            </div>
        </div>
        {renderActiveView()}
      </main>
    </div>
  );
};

export default DashboardPage;
