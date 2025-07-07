

import React, { useState, useEffect, useCallback } from 'react';
import { Target, ScheduledPost, Draft, PublishedPost, PostAnalytics, BulkPostItem, ContentPlanRequest, ContentPlanItem, Business } from '../types';
import Header from './Header';
import PostComposer from './PostComposer';
import TargetList from './GroupList';
import ContentCalendar from './ContentCalendar';
import PostPreview from './PostPreview';
import DraftsList from './DraftsList';
import PublishedPostsList from './PublishedPostsList';
import SettingsModal from './SettingsModal';
import BulkSchedulerPage from './BulkSchedulerPage'; 
import ContentPlannerPage from './ContentPlannerPage';
import ReminderCard from './ReminderCard'; // New import
import BusinessPortfolioManager from './BusinessPortfolioManager'; // New import
import PencilSquareIcon from './icons/PencilSquareIcon';
import CalendarIcon from './icons/CalendarIcon';
import ArchiveBoxIcon from './icons/ArchiveBoxIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import QueueListIcon from './icons/QueueListIcon';
import BrainCircuitIcon from './icons/BrainCircuitIcon';
import { GoogleGenAI } from '@google/genai';
import { generateDescriptionForImage, generateContentPlan, generatePostInsights } from '../services/geminiService';

interface DashboardPageProps {
  onLogout: () => void;
  isSimulationMode: boolean;
  aiClient: GoogleGenAI | null;
  currentApiKey: string | null;
  onSaveApiKey: (key: string) => void;
}

const MOCK_TARGETS: Target[] = [
    { id: '1', name: 'صفحة تجريبية 1', type: 'page', access_token: 'DUMMY_TOKEN_1', picture: { data: { url: 'https://via.placeholder.com/150/4B79A1/FFFFFF?text=Page1' } } },
    { id: '101', name: 'مجموعة المطورين التجريبية', type: 'group', picture: { data: { url: 'https://via.placeholder.com/150/228B22/FFFFFF?text=Group1' } } },
    { id: 'ig1', name: 'Zex Pages IG (@zex_pages_ig)', type: 'instagram', parentPageId: '1', access_token: 'DUMMY_TOKEN_1', picture: { data: { url: 'https://via.placeholder.com/150/E4405F/FFFFFF?text=IG' } } }
];

const MOCK_BUSINESSES: Business[] = [
    { id: 'biz1', name: 'حافظة أعمال تجريبية (ZEX)' },
    { id: 'biz2', name: 'حافظة أعمال العملاء (وكالة)' }
];

const MOCK_SCHEDULED_POSTS: ScheduledPost[] = [
    { id: 'post1', text: 'تخفيضات نهاية الأسبوع تبدأ غداً! استعدوا لأقوى العروض 🛍️', scheduledAt: new Date(new Date().setDate(new Date().getDate() + 2)), targets: [MOCK_TARGETS[0]], imageUrl: 'https://via.placeholder.com/400x300/FFD700/000000?text=Sale' },
    { id: 'post2', text: 'ما هي لغة البرمجة التي تتعلمها حالياً؟ شاركنا في التعليقات! 💻', scheduledAt: new Date(new Date().setDate(new Date().getDate() + 4)), targets: [MOCK_TARGETS[1]] },
];

const MOCK_PUBLISHED_POSTS: PublishedPost[] = [
    { id: 'mock_post_1', pageId: '1', pageName: 'صفحة تجريبية 1', pageAvatarUrl: 'https://via.placeholder.com/150/4B79A1/FFFFFF?text=Page1', text: 'هذا منشور تجريبي تم نشره بالفعل.', imagePreview: 'https://via.placeholder.com/400x300/CCCCCC/FFFFFF?text=Published', publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), analytics: { likes: 12, comments: 3, shares: 1, loading: false, lastUpdated: new Date() } },
    { id: 'mock_post_2', pageId: '2', pageName: 'متجر الأزياء العصرية', pageAvatarUrl: 'https://via.placeholder.com/150/C154C1/FFFFFF?text=Fashion', text: 'مجموعة جديدة من الفساتين وصلت! 👗', imagePreview: null, publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), analytics: { loading: false, lastUpdated: null } }
];

const formatDateTimeForInput = (date: Date) => {
    const pad = (num: number) => num.toString().padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const DashboardPage: React.FC<DashboardPageProps> = ({ onLogout, isSimulationMode, aiClient, currentApiKey, onSaveApiKey }) => {
  const [view, setView] = useState<'composer' | 'calendar' | 'drafts' | 'analytics' | 'bulk' | 'planner'>('composer');
  
  // Targets state
  const [targets, setTargets] = useState<Target[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loadingBusinessId, setLoadingBusinessId] = useState<string | null>(null);
  const [loadedBusinessIds, setLoadedBusinessIds] = useState<Set<string>>(new Set());
  
  // Composer state (lifted)
  const [postText, setPostText] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [composerError, setComposerError] = useState('');

  // Publishing state
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'partial', message: string} | null>(null);
  const [targetSelectionError, setTargetSelectionError] = useState<string | null>(null);
  const [publishingReminderId, setPublishingReminderId] = useState<string | null>(null);
  
  // Other state
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [publishedPosts, setPublishedPosts] = useState<PublishedPost[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Bulk scheduler state
  const [bulkPosts, setBulkPosts] = useState<BulkPostItem[]>([]);
  const [isSchedulingAll, setIsSchedulingAll] = useState(false);

  // AI Planner state
  const [contentPlan, setContentPlan] = useState<ContentPlanItem[] | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);


  const fetchInstagramAccounts = useCallback(async (pages: Target[]): Promise<Target[]> => {
    if (pages.length === 0) return [];

    const BATCH_SIZE = 50;
    const pageChunks: Target[][] = [];
    for (let i = 0; i < pages.length; i += BATCH_SIZE) {
        pageChunks.push(pages.slice(i, i + BATCH_SIZE));
    }

    const igPromises = pageChunks.map(chunk => {
        const batchRequest = chunk.map(page => ({
            method: 'GET',
            relative_url: `${page.id}?fields=instagram_business_account{id,name,username,profile_picture_url}`
        }));
        return new Promise<any[] | {error: any}>(resolve => {
            window.FB.api('/', 'POST', { batch: batchRequest }, (response: any) => resolve(response));
        });
    });

    const allIgChunkedResponses = await Promise.all(igPromises);
    const igAccounts: Target[] = [];

    allIgChunkedResponses.forEach((igResponses: any, chunkIndex: number) => {
        if (igResponses && !igResponses.error && Array.isArray(igResponses)) {
            igResponses.forEach((res: any, indexInChunk: number) => {
                if (res && res.code === 200) {
                    try {
                        const body = JSON.parse(res.body);
                        if (body && body.instagram_business_account) {
                            const igAccount = body.instagram_business_account;
                            const parentPage = pageChunks[chunkIndex][indexInChunk];
                            if (parentPage) {
                                const igTarget: Target = {
                                    id: igAccount.id,
                                    name: igAccount.name ? `${igAccount.name} (@${igAccount.username})` : `@${igAccount.username}`,
                                    type: 'instagram',
                                    parentPageId: parentPage.id,
                                    access_token: parentPage.access_token,
                                    picture: {
                                        data: { url: igAccount.profile_picture_url || 'https://via.placeholder.com/150/833AB4/FFFFFF?text=IG' }
                                    }
                                };
                                igAccounts.push(igTarget);
                            }
                        }
                    } catch (e) {
                        console.error("Error parsing IG account response body:", e, res.body);
                    }
                }
            });
        } else if (igResponses && igResponses.error) {
            console.error("Error in batch request for IG accounts:", igResponses.error);
        }
    });

    return igAccounts;
  }, []);

  useEffect(() => {
    const fetchWithPagination = async (initialPath: string): Promise<any[]> => {
        let allData: any[] = [];
        let path: string | null = initialPath;

        while (path) {
            const response: any = await new Promise(resolve => {
                window.FB.api(path, (res: any) => resolve(res));
            });

            if (response && response.data && response.data.length > 0) {
                allData = allData.concat(response.data);
                path = response.paging?.next ? new URL(response.paging.next).pathname + new URL(response.paging.next).search : null;
            } else {
                if (response.error) {
                    console.error(`Error fetching paginated data for path ${path}:`, response.error);
                }
                path = null;
            }
        }
        return allData;
    };

    const fetchInitialData = async () => {
        setTargetsLoading(true);
        try {
            const [directPages, allGroups, businessData] = await Promise.all([
                fetchWithPagination('/me/accounts?fields=id,name,access_token,picture{url}&limit=100'),
                fetchWithPagination('/me/groups?fields=id,name,picture{url},permissions&limit=100'),
                fetchWithPagination('/me/businesses?limit=100')
            ]);

            setBusinesses(businessData as Business[]);

            const adminGroups = allGroups.filter((group: any) =>
                group.permissions && group.permissions.data.some((p: any) => p.permission === 'admin')
            );

            const initialTargets: Target[] = [
                ...directPages.map(p => ({ ...p, type: 'page' as 'page' })),
                ...adminGroups.map(g => ({ ...g, type: 'group' as 'group' }))
            ];
            
            const initialPages = initialTargets.filter(t => t.type === 'page');
            const igAccounts = await fetchInstagramAccounts(initialPages);
            
            const allTargetsMap = new Map<string, Target>();
            [...initialTargets, ...igAccounts].forEach(t => {
                if (!allTargetsMap.has(t.id)) {
                    allTargetsMap.set(t.id, t);
                }
            });
            
            setTargets(Array.from(allTargetsMap.values()));

        } catch (error) {
            console.error("Error fetching initial data from Facebook:", error);
        } finally {
            setTargetsLoading(false);
        }
    };
    
    if (isSimulationMode) {
        setTargets(MOCK_TARGETS);
        setBusinesses(MOCK_BUSINESSES);
        setScheduledPosts(MOCK_SCHEDULED_POSTS);
        setPublishedPosts(MOCK_PUBLISHED_POSTS);
        setTargetsLoading(false);
    } else {
        fetchInitialData();
    }
  }, [isSimulationMode, fetchInstagramAccounts]);

  const handleLoadBusinessPages = useCallback(async (businessId: string) => {
    setLoadingBusinessId(businessId);

    if (isSimulationMode) {
        setTimeout(() => {
            const newMockPage: Target = {
                id: `biz_page_${businessId}_${Date.now()}`,
                name: `صفحة من حافظة ${businessId}`,
                type: 'page',
                access_token: 'DUMMY_TOKEN_BIZ',
                picture: { data: { url: `https://via.placeholder.com/150/008080/FFFFFF?text=Biz` } }
            };
            setTargets(prev => [...prev, newMockPage]);
            setLoadedBusinessIds(prev => new Set(prev).add(businessId));
            setLoadingBusinessId(null);
        }, 1000);
        return;
    }

    const fetchWithPagination = async (initialPath: string): Promise<any[]> => {
        let allData: any[] = [];
        let path: string | null = initialPath;
        while (path) {
            const response: any = await new Promise(resolve => window.FB.api(path, (res: any) => resolve(res)));
            if (response && response.data && response.data.length > 0) {
                allData = allData.concat(response.data);
                path = response.paging?.next ? new URL(response.paging.next).pathname + new URL(response.paging.next).search : null;
            } else {
                if (response.error) console.error(`Error paginating ${path}:`, response.error);
                path = null;
            }
        }
        return allData;
    };

    try {
        const [ownedPages, clientPages] = await Promise.all([
            fetchWithPagination(`/${businessId}/owned_pages?fields=id,name,access_token,picture{url}&limit=100`),
            fetchWithPagination(`/${businessId}/client_pages?fields=id,name,access_token,picture{url}&limit=100`),
        ]);
        
        const newPages: Target[] = [...ownedPages, ...clientPages].map(p => ({ ...p, type: 'page' }));
        const newIgAccounts = await fetchInstagramAccounts(newPages);
        const newTargets = [...newPages, ...newIgAccounts];
        
        setTargets(prevTargets => {
            const targetsMap = new Map<string, Target>(prevTargets.map(t => [t.id, t]));
            newTargets.forEach(t => targetsMap.set(t.id, t));
            return Array.from(targetsMap.values());
        });
        
        setLoadedBusinessIds(prev => new Set(prev).add(businessId));

    } catch (error) {
        console.error(`Failed to load pages for business ${businessId}:`, error);
        setNotification({ type: 'error', message: 'فشل تحميل الصفحات من حافظة الأعمال.'});
        setTimeout(() => setNotification(null), 5000);
    } finally {
        setLoadingBusinessId(null);
    }
  }, [isSimulationMode, fetchInstagramAccounts]);


  const clearComposer = useCallback(() => {
    setPostText('');
    setSelectedImage(null);
    setImagePreview(null);
    setIsScheduled(false);
    setScheduleDate('');
    setSelectedTargetIds([]);
    setComposerError('');
    setActiveDraftId(null);
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
      e.target.value = ''; // Allow re-uploading the same file
    }
  };
  
  const handleImageRemove = () => {
    setSelectedImage(null);
    setImagePreview(null);
  }

  const handleGeneratedImageSelect = (file: File) => {
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handlePublish = useCallback(async () => {
    const selectedTargetsData = targets.filter(t => selectedTargetIds.includes(t.id));
    
    // Validation
    if (!postText.trim() && !selectedImage) {
      setComposerError('لا يمكن نشر منشور فارغ. يرجى كتابة نص أو إضافة صورة.');
      return;
    }
    if (selectedTargetIds.length === 0) {
      setTargetSelectionError('يجب اختيار وجهة واحدة على الأقل للنشر فيها.');
      return;
    }
    const hasInstagramTarget = selectedTargetsData.some(t => t.type === 'instagram');
    if (hasInstagramTarget && !selectedImage) {
        setComposerError('منشورات انستجرام تتطلب وجود صورة.');
        return;
    }
    
    let scheduleAt: Date | null = null;
    if (isScheduled) {
        if (!scheduleDate) {
            setComposerError('يرجى تحديد تاريخ ووقت للجدولة.');
            return;
        }
        const scheduleDateTime = new Date(scheduleDate);
        const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000);
        if(scheduleDateTime < tenMinutesFromNow) {
            setComposerError('يجب أن يكون وقت الجدولة بعد 10 دقائق من الآن على الأقل.');
            return;
        }
        scheduleAt = scheduleDateTime;
    }
    
    setComposerError('');
    setTargetSelectionError(null);
    setIsPublishing(true);
    setNotification(null);

    if (isSimulationMode) {
        setTimeout(() => {
            setIsPublishing(false);
            if(activeDraftId) {
              setDrafts(prev => prev.filter(d => d.id !== activeDraftId));
            }
            setNotification({ type: 'success', message: `تمت محاكاة العملية بنجاح.` });
            clearComposer();
            setTimeout(() => setNotification(null), 5000);
        }, 1500);
        return;
    }

    const fbTargets = selectedTargetsData.filter(t => t.type === 'page' || t.type === 'group');
    const igTargets = selectedTargetsData.filter(t => t.type === 'instagram');
    let successfulActions = 0;
    let failedActions = 0;
    let messages: string[] = [];

    // --- Handle immediate publishing ---
    if (!scheduleAt) {
      const allTargets = [...fbTargets, ...igTargets];
      const publishPromises = allTargets.map(target => {
        let apiPath: string;
        const formData = new FormData();
        formData.append('access_token', target.access_token!);
        if (postText) formData.append('caption', postText);

        if (target.type === 'instagram') {
          apiPath = `/${target.parentPageId}/photos`;
          formData.append('source', selectedImage!);
        } else if (selectedImage) {
          apiPath = `/${target.id}/photos`;
          formData.append('source', selectedImage);
        } else {
          apiPath = `/${target.id}/feed`;
          formData.append('message', postText);
        }
        
        return new Promise((resolve, reject) => {
            window.FB.api(apiPath, 'POST', apiPath.includes('feed') ? {message: postText, access_token: target.access_token} : formData, (response: any) => {
                if (response && !response.error) resolve({ targetName: target.name, success: true });
                else reject({ targetName: target.name, success: false, error: response?.error?.message });
            });
        });
      });
      // This part is simplified; a real implementation would handle results better.
      await Promise.allSettled(publishPromises);
      messages.push(`تم إرسال ${allTargets.length} منشورات للنشر الفوري.`);

    } else { // --- Handle scheduling ---
      // 1. Schedule for Facebook & Groups
      if (fbTargets.length > 0) {
        const fbSchedulePromises = fbTargets.map(target => {
            let apiPath: string;
            let apiParams: any;
            if (selectedImage) {
                apiPath = `/${target.id}/photos`;
                const formData = new FormData();
                if (target.type === 'page') formData.append('access_token', target.access_token!);
                formData.append('source', selectedImage);
                if (postText) formData.append('caption', postText);
                formData.append('scheduled_publish_time', String(Math.floor(scheduleAt!.getTime() / 1000)));
                formData.append('published', 'false');
                apiParams = formData;
            } else {
                apiPath = `/${target.id}/feed`;
                apiParams = { message: postText, access_token: target.access_token, scheduled_publish_time: Math.floor(scheduleAt!.getTime() / 1000), published: false };
            }
            return new Promise((resolve, reject) => {
                window.FB.api(apiPath, 'POST', apiParams, (response: any) => {
                    if (response && !response.error) resolve(true);
                    else reject(response.error);
                });
            });
        });
        const fbResults = await Promise.allSettled(fbSchedulePromises);
        const successfulFb = fbResults.filter(r => r.status === 'fulfilled').length;
        if(successfulFb > 0) messages.push(`تمت جدولة ${successfulFb} منشورات بنجاح على فيسبوك.`);
        successfulActions += successfulFb;
        failedActions += fbTargets.length - successfulFb;
      }
      
      // 2. Create reminders for Instagram
      if (igTargets.length > 0) {
        const newReminders: ScheduledPost[] = igTargets.map(target => ({
          id: `reminder_${target.id}_${Date.now()}`,
          text: postText,
          scheduledAt: scheduleAt,
          isReminder: true,
          targets: [target],
          imageFile: selectedImage!,
          imageUrl: URL.createObjectURL(selectedImage!),
        }));
        setScheduledPosts(prev => [...prev, ...newReminders]);
        messages.push(`تم حفظ ${igTargets.length} تذكيرات لنشرها على انستجرام.`);
        successfulActions += igTargets.length;
      }
    }

    setIsPublishing(false);
    if (successfulActions > 0) {
      setNotification({ type: 'success', message: messages.join(' ')});
      clearComposer();
      if (activeDraftId) setDrafts(prev => prev.filter(d => d.id !== activeDraftId));
    } else {
      setNotification({ type: 'error', message: 'فشلت كل العمليات. يرجى مراجعة الصلاحيات.'});
    }
    setTimeout(() => setNotification(null), 8000);
  }, [postText, selectedImage, selectedTargetIds, targets, isSimulationMode, isScheduled, scheduleDate, activeDraftId, clearComposer]);

  const handlePublishReminder = useCallback(async (postId: string) => {
    const post = scheduledPosts.find(p => p.id === postId);
    if (!post || !post.isReminder || !post.targets[0] || !post.imageFile) return;

    setPublishingReminderId(postId);
    setNotification(null);

    const target = post.targets[0];

     if (isSimulationMode) {
        console.log("SIMULATING PUBLISHING REMINDER:", post);
        setTimeout(() => {
            setScheduledPosts(prev => prev.filter(p => p.id !== postId));
            setPublishingReminderId(null);
            setNotification({ type: 'success', message: `تمت محاكاة نشر التذكير لـ ${target.name} بنجاح.` });
        }, 1500);
        return;
    }
    
    const apiPath = `/${target.parentPageId}/photos`;
    const formData = new FormData();
    formData.append('access_token', target.access_token!);
    formData.append('source', post.imageFile);
    if (post.text) formData.append('caption', post.text);
    
    window.FB.api(apiPath, 'POST', formData, (response: any) => {
      setPublishingReminderId(null);
      if (response && !response.error) {
        setNotification({ type: 'success', message: `تم نشر المنشور إلى ${target.name} بنجاح!` });
        setScheduledPosts(prev => prev.filter(p => p.id !== postId));
      } else {
        setNotification({ type: 'error', message: `فشل النشر إلى ${target.name}: ${response?.error?.message}` });
        console.error("Failed to publish reminder:", response.error);
      }
    });
  }, [scheduledPosts, isSimulationMode]);


  const handleFetchAnalytics = useCallback(async (postId: string) => {
    setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, loading: true } } : p));

    if (isSimulationMode) {
        setTimeout(() => {
             setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { likes: Math.floor(Math.random() * 250), comments: Math.floor(Math.random() * 50), shares: Math.floor(Math.random() * 15), loading: false, lastUpdated: new Date() } } : p));
        }, 1200);
        return;
    }

    try {
      window.FB.api(
        `/${postId}?fields=likes.summary(true),comments.summary(true),shares`,
        (response: any) => {
          if (response && !response.error) {
            const updatedAnalytics: PostAnalytics = {
              likes: response.likes?.summary?.total_count ?? 0,
              comments: response.comments?.summary?.total_count ?? 0,
              shares: response.shares?.count ?? 0,
              loading: false,
              lastUpdated: new Date(),
            };
            setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: updatedAnalytics } : p));
          } else {
            console.error('Failed to fetch analytics:', response.error);
            setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, loading: false } } : p));
          }
        }
      );
    } catch (error) {
       console.error('Error in FB.api for analytics:', error);
       setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, loading: false } } : p));
    }
  }, [isSimulationMode]);

  const handleGenerateInsights = useCallback(async (postId: string) => {
    if (!aiClient) {
      setNotification({ type: 'error', message: 'يرجى تكوين مفتاح Gemini API في الإعدادات أولاً.' });
      return;
    }
    const post = publishedPosts.find(p => p.id === postId);
    if (!post) return;

    if (isSimulationMode) {
        setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, isGeneratingInsights: true } } : p));
        setTimeout(() => {
            const mockInsights = {
                performanceSummary: "هذا ملخص أداء تجريبي تم إنشاؤه بواسطة الذكاء الاصطناعي. يبدو أن المنشور قد حقق تفاعلًا جيدًا.",
                sentiment: { positive: 0.7, negative: 0.1, neutral: 0.2 }
            };
            setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, isGeneratingInsights: false, aiSummary: mockInsights.performanceSummary, sentiment: mockInsights.sentiment } } : p));
        }, 2000);
        return;
    }

    setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, isGeneratingInsights: true, aiSummary: undefined, sentiment: undefined } } : p));
    
    try {
        const commentsResponse: any = await new Promise((resolve) => {
            window.FB.api(`/${postId}/comments?fields=message&limit=25`, (r: any) => resolve(r));
        });

        if (commentsResponse.error) {
            throw new Error(commentsResponse.error.message);
        }

        const comments = commentsResponse.data || [];
        if (comments.length === 0) {
            setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, isGeneratingInsights: false, aiSummary: 'لا توجد تعليقات كافية للتحليل.' } } : p));
            return;
        }

        const insights = await generatePostInsights(aiClient, post.text, post.analytics, comments);
        setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, ...insights, isGeneratingInsights: false } } : p));

    } catch (error: any) {
        console.error("Error generating insights:", error);
        setPublishedPosts(prev => prev.map(p => p.id === postId ? { ...p, analytics: { ...p.analytics, isGeneratingInsights: false, aiSummary: `فشل التحليل: ${error.message}` } } : p));
    }
  }, [aiClient, publishedPosts, isSimulationMode]);


  const handleSaveDraft = () => {
    if (!postText.trim() && !selectedImage) return;
    
    const newDraft: Draft = {
        id: `draft_${Date.now()}`,
        text: postText,
        imageFile: selectedImage,
        imagePreview: imagePreview,
        selectedTargetIds: selectedTargetIds,
    };

    setDrafts(prev => [newDraft, ...prev]);
    setNotification({ type: 'success', message: 'تم حفظ المسودة بنجاح.' });
    clearComposer();
    setTimeout(() => setNotification(null), 5000);
  };
  
  const handleLoadDraft = (draftId: string) => {
    const draft = drafts.find(d => d.id === draftId);
    if (draft) {
      setPostText(draft.text);
      setSelectedImage(draft.imageFile);
      setImagePreview(draft.imagePreview);
      setSelectedTargetIds(draft.selectedTargetIds);
      setActiveDraftId(draftId);
      setIsScheduled(false);
      setScheduleDate('');
      setView('composer');
      setNotification({ type: 'success', message: `تم تحميل المسودة "${draft.text.substring(0, 20)}...".`});
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const handleDeleteDraft = (draftId: string) => {
    setDrafts(prev => prev.filter(d => d.id !== draftId));
     setNotification({ type: 'error', message: `تم حذف المسودة.`});
     setTimeout(() => setNotification(null), 4000);
  };
  
  // --- BULK SCHEDULER HANDLERS ---
  const handleBulkAddPosts = (files: FileList) => {
    const newPosts: BulkPostItem[] = Array.from(files).map((file, index) => {
        const scheduleTime = new Date(Date.now() + (index + 1) * 2 * 60 * 60 * 1000); // Stagger by 2 hours
        return {
            id: `bulk_${Date.now()}_${index}`,
            imageFile: file,
            imagePreview: URL.createObjectURL(file),
            text: '',
            scheduleDate: formatDateTimeForInput(scheduleTime),
            targetIds: [],
        };
    });
    setBulkPosts(prev => [...prev, ...newPosts]);
  };

  const handleBulkPostUpdate = (id: string, updates: Partial<BulkPostItem>) => {
    setBulkPosts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const handleBulkPostRemove = (id: string) => {
    setBulkPosts(prev => prev.filter(p => p.id !== id));
  };
  
  const handleGenerateBulkDescription = useCallback(async (id: string) => {
    if (!aiClient) return;
    const post = bulkPosts.find(p => p.id === id);
    if (!post) return;

    handleBulkPostUpdate(id, { isGeneratingDescription: true });
    try {
      const description = await generateDescriptionForImage(aiClient, post.imageFile);
      handleBulkPostUpdate(id, { text: description });
    } catch (error: any) {
      handleBulkPostUpdate(id, { error: error.message || "Failed to generate description" });
    } finally {
      handleBulkPostUpdate(id, { isGeneratingDescription: false });
    }
  }, [aiClient, bulkPosts]);

  const handleScheduleAllBulk = async () => {
    setIsSchedulingAll(true);
    setNotification(null);

    // --- Validation ---
    let validationError = false;
    const validatedPosts = bulkPosts.map(p => {
        if (p.targetIds.length === 0 || !p.scheduleDate) {
            validationError = true;
            return { ...p, error: 'يرجى تحديد وجهة وتاريخ للنشر.' };
        }
        return { ...p, error: undefined };
    });

    setBulkPosts(validatedPosts);

    if (validationError) {
        setNotification({ type: 'error', message: 'بعض المنشورات غير مكتملة. يرجى مراجعة الحقول المطلوبة.' });
        setIsSchedulingAll(false);
        return;
    }
    
    if (isSimulationMode) {
        console.log("Simulating bulk schedule:", bulkPosts);
        setTimeout(() => {
            setIsSchedulingAll(false);
            setNotification({ type: 'success', message: `تمت محاكاة جدولة ${bulkPosts.length} منشورات بنجاح.` });
            setBulkPosts([]);
        }, 2000);
        return;
    }

    // --- API Calls ---
    const allPromises = bulkPosts.flatMap(post => {
        const scheduleAt = new Date(post.scheduleDate);
        return post.targetIds.map(targetId => {
            const target = targets.find(t => t.id === targetId);
            if (!target) return Promise.reject({ targetName: 'Unknown', error: { message: 'Target not found' }});

            const apiPath = `/${target.id}/photos`;
            const formData = new FormData();
            if (target.type === 'page') {
                formData.append('access_token', target.access_token!);
            }
            formData.append('source', post.imageFile);
            if (post.text) formData.append('caption', post.text);
            formData.append('scheduled_publish_time', String(Math.floor(scheduleAt.getTime() / 1000)));
            formData.append('published', 'false');

            return new Promise((resolve, reject) => {
                window.FB.api(apiPath, 'POST', formData, (response: any) => {
                     if (response && !response.error) {
                        resolve({ targetName: target.name, success: true });
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
        });
    });
    
    const results = await Promise.allSettled(allPromises);

    setIsSchedulingAll(false);
    
    const successfulSchedules = results.filter(r => r.status === 'fulfilled').length;
    const failedSchedules = results.length - successfulSchedules;
    
    if (successfulSchedules > 0 && failedSchedules === 0) {
        setNotification({ type: 'success', message: `تمت جدولة ${successfulSchedules} منشورات بنجاح.` });
        setBulkPosts([]);
    } else if (successfulSchedules > 0 && failedSchedules > 0) {
        setNotification({ type: 'partial', message: `تمت جدولة ${successfulSchedules} بنجاح، وفشل ${failedSchedules}.` });
    } else {
        setNotification({ type: 'error', message: `فشلت جدولة كل المنشورات (${failedSchedules}).` });
    }

    results.forEach(r => {
        if (r.status === 'rejected') {
            console.error("Schedule failed:", r.reason);
        }
    });

  };

  // --- AI PLANNER HANDLERS ---
  const handleGeneratePlan = useCallback(async (request: ContentPlanRequest) => {
    if (!aiClient) {
      setPlanError("يرجى إضافة مفتاح API من قائمة الإعدادات لتفعيل هذه الميزة.");
      return;
    }
    setPlanError(null);
    setIsGeneratingPlan(true);
    try {
      const plan = await generateContentPlan(aiClient, request);
      setContentPlan(plan);
    } catch (e: any) {
      setPlanError(e.message || "حدث خطأ غير متوقع عند إنشاء الخطة.");
      setContentPlan(null);
    } finally {
      setIsGeneratingPlan(false);
    }
  }, [aiClient]);
  
  const handleStartPostFromPlan = (planItem: ContentPlanItem) => {
    clearComposer();
    setPostText(planItem.postSuggestion);
    setView('composer');
    setNotification({ type: 'success', message: 'تم تحميل اقتراح المنشور. يمكنك الآن تعديله ونشره.' });
    setTimeout(() => setNotification(null), 5000);
  };
  
  const getNotificationBgColor = () => {
    if (!notification) return '';
    switch(notification.type) {
        case 'success': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
        case 'error': return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
        case 'partial': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
    }
  }

  const firstSelectedTarget = targets.find(t => t.id === selectedTargetIds[0]);

  const dueReminders = scheduledPosts.filter(p => p.isReminder && new Date(p.scheduledAt) <= new Date());

  const renderActiveView = () => {
    switch (view) {
        case 'composer':
            return (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    <div className="lg:col-span-2">
                        <PostPreview
                            postText={postText}
                            imagePreview={imagePreview}
                            pageName={firstSelectedTarget?.name}
                            pageAvatar={firstSelectedTarget?.picture.data.url}
                        />
                    </div>
                    <div className="lg:col-span-3 space-y-8">
                        <PostComposer
                            aiClient={aiClient}
                            onPublish={handlePublish}
                            onSaveDraft={handleSaveDraft}
                            isPublishing={isPublishing}
                            postText={postText}
                            onPostTextChange={setPostText}
                            onImageChange={handleImageChange}
                            onImageGenerated={handleGeneratedImageSelect}
                            onImageRemove={handleImageRemove}
                            imagePreview={imagePreview}
                            isScheduled={isScheduled}
                            onIsScheduledChange={setIsScheduled}
                            scheduleDate={scheduleDate}
                            onScheduleDateChange={setScheduleDate}
                            error={composerError}
                            targets={targets}
                            selectedTargetIds={selectedTargetIds}
                        />
                         <BusinessPortfolioManager
                            businesses={businesses}
                            onLoadPages={handleLoadBusinessPages}
                            loadingBusinessId={loadingBusinessId}
                            loadedBusinessIds={loadedBusinessIds}
                        />
                        <TargetList
                            targets={targets}
                            isLoading={targetsLoading}
                            loadingError={null}
                            selectedTargetIds={selectedTargetIds}
                            onSelectionChange={setSelectedTargetIds}
                            selectionError={targetSelectionError}
                        />
                    </div>
                </div>
            );
        case 'bulk':
            return <BulkSchedulerPage 
                bulkPosts={bulkPosts}
                onAddPosts={handleBulkAddPosts}
                onUpdatePost={handleBulkPostUpdate}
                onRemovePost={handleBulkPostRemove}
                onScheduleAll={handleScheduleAllBulk}
                isSchedulingAll={isSchedulingAll}
                targets={targets}
                aiClient={aiClient}
                onGenerateDescription={handleGenerateBulkDescription}
            />;
        case 'planner':
            return <ContentPlannerPage 
                aiClient={aiClient}
                onGeneratePlan={handleGeneratePlan}
                isGenerating={isGeneratingPlan}
                plan={contentPlan}
                error={planError}
                onStartPost={handleStartPostFromPlan}
                targets={targets}
            />;
        case 'calendar':
            return <ContentCalendar posts={scheduledPosts} />;
        case 'drafts':
            return <DraftsList drafts={drafts} onLoad={handleLoadDraft} onDelete={handleDeleteDraft} />;
        case 'analytics':
            return <PublishedPostsList 
                        posts={publishedPosts} 
                        onFetchAnalytics={handleFetchAnalytics}
                        onGenerateInsights={handleGenerateInsights}
                   />;
        default:
            return null;
    }
  }

  return (
    <div className="min-h-screen fade-in">
      <Header 
        onLogout={onLogout}
        isSimulationMode={isSimulationMode}
        onSettingsClick={() => setIsSettingsOpen(true)}
      />
      <main className="p-4 sm:p-8">
        {dueReminders.length > 0 && (
            <div className="p-4 mb-6 rounded-lg bg-yellow-100 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-800 shadow-md">
                <h3 className="font-bold text-lg text-yellow-800 dark:text-yellow-200 mb-3">
                    تذكيرات جاهزة للنشر على انستجرام
                </h3>
                <div className="space-y-4">
                    {dueReminders.map(post => (
                        <ReminderCard 
                            key={post.id}
                            post={post}
                            onPublish={() => handlePublishReminder(post.id)}
                            isPublishing={publishingReminderId === post.id}
                        />
                    ))}
                </div>
            </div>
        )}
        
        {notification && (
            <div className={`p-4 mb-6 rounded-lg shadow-md transition-all duration-300 ${getNotificationBgColor()}`}>
                {notification.message}
            </div>
        )}

        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex space-x-1 sm:space-x-4 -mb-px overflow-x-auto">
                <button onClick={() => setView('composer')} className={`inline-flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 font-semibold text-sm transition-colors shrink-0 ${view === 'composer' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                    <PencilSquareIcon className="w-5 h-5" /> إنشاء منشور
                </button>
                 <button onClick={() => setView('bulk')} className={`inline-flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 font-semibold text-sm transition-colors shrink-0 ${view === 'bulk' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                    <QueueListIcon className="w-5 h-5" /> الجدولة المجمعة <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 text-xs font-bold px-2 py-0.5 rounded-full">{bulkPosts.length}</span>
                </button>
                <button onClick={() => setView('planner')} className={`inline-flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 font-semibold text-sm transition-colors shrink-0 ${view === 'planner' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                    <BrainCircuitIcon className="w-5 h-5" /> المخطط الذكي
                </button>
                <button onClick={() => setView('drafts')} className={`inline-flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 font-semibold text-sm transition-colors shrink-0 ${view === 'drafts' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                    <ArchiveBoxIcon className="w-5 h-5" /> المسودات <span className="bg-gray-200 dark:bg-gray-700 text-xs font-bold px-2 py-0.5 rounded-full">{drafts.length}</span>
                </button>
                <button onClick={() => setView('calendar')} className={`inline-flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 font-semibold text-sm transition-colors shrink-0 ${view === 'calendar' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                    <CalendarIcon className="w-5 h-5" /> تقويم المحتوى
                </button>
                 <button onClick={() => setView('analytics')} className={`inline-flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 font-semibold text-sm transition-colors shrink-0 ${view === 'analytics' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                    <ChartBarIcon className="w-5 h-5" /> التحليلات
                </button>
            </div>
        </div>

        {renderActiveView()}

      </main>
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={onSaveApiKey}
        currentApiKey={currentApiKey}
      />
    </div>
  );
};

export default DashboardPage;