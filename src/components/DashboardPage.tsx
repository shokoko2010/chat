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
import { generateDescriptionForImage, generateContentPlan, analyzePageForProfile, generatePerformanceSummary, generateOptimalSchedule, generatePostInsights } from '../services/geminiService';

// Icons
import PencilSquareIcon from './icons/PencilSquareIcon';
import CalendarIcon from './icons/CalendarIcon';
import ArchiveBoxIcon from './icons/ArchiveBoxIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import QueueListIcon from './icons/QueueListIcon';
import BrainCircuitIcon from './icons/BrainCircuitIcon';


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
  const [view, setView] = useState<'composer' | 'calendar' | 'drafts' | 'analytics' | 'bulk' | 'planner'>('composer');
  
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
  const [pageProfile, setPageProfile] = useState<PageProfile>({ description: '', services: '', contactInfo: '', website: '', currentOffers: '' });
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
  const [isAnalyzingProfile, setIsAnalyzingProfile] = useState(false);
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
    // Default to including IG if available, and not scheduling.
    setIsScheduled(false);
    setIncludeInstagram(!!linkedInstagramTarget);
  }, [linkedInstagramTarget]);

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
            }
        } else {
            savedData = {};
        }
    } catch(e) {
        console.error("Failed to parse saved data, resetting.", e);
        localStorage.removeItem(dataKey); // Remove corrupt data
        savedData = {};
    }

    setPageProfile(savedData.pageProfile || { description: '', services: '', contactInfo: '', website: '', currentOffers: '' });
    setDrafts(savedData.drafts || []);
    setScheduledPosts(savedData.scheduledPosts || []);
    setContentPlan(savedData.contentPlan || null);
    setStrategyHistory(savedData.strategyHistory || []);
    
    // We clear bulk posts on page change to avoid complexity with non-serializable File objects.
    setBulkPosts([]);


    // Reset composer and session-based state
    clearComposer();
    setPublishedPosts([]);
    setPublishedPostsLoading(true);
    setView('composer');

    // Fetch real published posts
    if (isSimulationMode) {
      setPublishedPostsLoading(false);
      setPublishedPosts([{
        id: 'mock_post_1', pageId: managedTarget.id, pageName: managedTarget.name, pageAvatarUrl: managedTarget.picture.data.url,
        text: 'هذا منشور تجريبي تم جلبه لهذه الصفحة.', imagePreview: 'https://via.placeholder.com/400x300/CCCCCC/FFFFFF?text=Published',
        publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), analytics: { likes: 12, comments: 3, shares: 1, reach: 150, loading: false, lastUpdated: new Date(), isGeneratingInsights: false, }
      }]);
      return;
    }
    
    window.FB.api(
      `/${managedTarget.id}/published_posts?fields=id,message,full_picture,created_time,likes.summary(true),comments.summary(true),shares,insights.metric(post_impressions_unique){values}`,
      (response: any) => {
        if (response && response.data) {
          const fetchedPosts: PublishedPost[] = response.data.map((post: any) => ({
            id: post.id, pageId: managedTarget.id, pageName: managedTarget.name, pageAvatarUrl: managedTarget.picture.data.url, text: post.message || '',
            imagePreview: post.full_picture || null, publishedAt: new Date(post.created_time),
            analytics: {
              likes: post.likes?.summary?.total_count ?? 0, comments: post.comments?.summary?.total_count ?? 0, shares: post.shares?.count ?? 0,
              reach: post.insights?.data?.[0]?.values?.[0]?.value ?? 0,
              loading: false, lastUpdated: new Date(), isGeneratingInsights: false
            }
          }));
          setPublishedPosts(fetchedPosts);
        } else if (response.error) {
            console.error(`Error fetching posts for ${managedTarget.name}:`, response.error);
        }
        setPublishedPostsLoading(false);
      }
    );
    
  }, [managedTarget.id, isSimulationMode, clearComposer]);
  
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
        };
        localStorage.setItem(dataKey, JSON.stringify(dataToStore));
    } catch(e) {
        console.error("Could not save data to localStorage:", e);
    }
  }, [pageProfile, drafts, scheduledPosts, contentPlan, strategyHistory, managedTarget.id]);

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

  const showNotification = (type: 'success' | 'error' | 'partial', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 8000);
  };

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
  }, [postText, selectedImage, isScheduled, scheduleDate, managedTarget, includeInstagram, linkedInstagramTarget, clearComposer]);
  
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


  const handleAnalyzeProfile = async () => {
    if (!aiClient) return;
    setIsAnalyzingProfile(true);
    setPlanError(null);
    try {
      const generatedProfile = await analyzePageForProfile(aiClient, managedTarget.name, managedTarget.type);
      setPageProfile(generatedProfile);
      showNotification('success', 'تم تحليل الصفحة وملء البيانات بنجاح.');
    } catch (e: any) {
        setPlanError(e.message);
    } finally {
        setIsAnalyzingProfile(false);
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
    let successCount = 0;
    const promises = bulkPosts.map(async post => {
        try {
            const scheduleAt = new Date(post.scheduleDate);
            const postTargets = allTargets.filter(t => post.targetIds.includes(t.id));
            
            for (const target of postTargets) {
                const isIgReminder = target.type === 'instagram';
                await publishToTarget(target, post.text, post.imageFile || null, scheduleAt, isIgReminder);
            }
            successCount++;
            return { ...post, error: undefined }; // Mark as successful
        } catch (e: any) {
            return { ...post, error: e.message || "فشل غير معروف" };
        }
    });

    const results = await Promise.all(promises);
    setIsSchedulingAll(false);
    showNotification('partial', `اكتملت الجدولة المجمعة. نجح: ${successCount}، فشل: ${bulkPosts.length - successCount}.`);
    setBulkPosts(results.filter(p => p.error)); // Only keep failed posts
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
                isAnalyzing={isAnalyzingProfile}
                onAnalyze={handleAnalyzeProfile}
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