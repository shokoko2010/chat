





import React, { useState, useEffect, useCallback } from 'react';
import { Target, ScheduledPost, Draft, PublishedPost, PostAnalytics, BulkPostItem, ContentPlanRequest, ContentPlanItem } from '../types';
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
import PencilSquareIcon from './icons/PencilSquareIcon';
import CalendarIcon from './icons/CalendarIcon';
import ArchiveBoxIcon from './icons/ArchiveBoxIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import QueueListIcon from './icons/QueueListIcon';
import BrainCircuitIcon from './icons/BrainCircuitIcon';
import { GoogleGenAI } from '@google/genai';
import { generateDescriptionForImage, generateContentPlan } from '../services/geminiService';

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
    { id: '2', name: 'متجر الأزياء العصرية', type: 'page', access_token: 'DUMMY_TOKEN_2', picture: { data: { url: 'https://via.placeholder.com/150/C154C1/FFFFFF?text=Fashion' } } },
];

const MOCK_SCHEDULED_POSTS: ScheduledPost[] = [
    { id: 'post1', text: 'تخفيضات نهاية الأسبوع تبدأ غداً! استعدوا لأقوى العروض 🛍️', scheduledAt: new Date(new Date().setDate(new Date().getDate() + 2)), targets: [MOCK_TARGETS[0], MOCK_TARGETS[2]], imageUrl: 'https://via.placeholder.com/400x300/FFD700/000000?text=Sale' },
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


  // Load initial data
  useEffect(() => {
    if (isSimulationMode) {
        setTargets(MOCK_TARGETS);
        setScheduledPosts(MOCK_SCHEDULED_POSTS);
        setPublishedPosts(MOCK_PUBLISHED_POSTS);
        setTargetsLoading(false);
        return;
    }

    setTargetsLoading(true);
    
    const fetchPages = new Promise<Target[]>((resolve, reject) => {
        window.FB.api(
            '/me/accounts?fields=id,name,access_token,picture{url}', 
            (response: any) => {
                if (response && !response.error) {
                    resolve(response.data.map((page: any) => ({ ...page, type: 'page' as 'page' })));
                } else {
                    reject(response?.error?.message || 'فشل في جلب الصفحات.');
                }
            }
        );
    });

    const fetchGroups = new Promise<Target[]>((resolve) => {
        window.FB.api(
            '/me/groups?fields=id,name,picture{url},permissions', 
            (response: any) => {
                if (response && !response.error) {
                    const adminGroups = response.data.filter((group: any) => 
                        group.permissions && group.permissions.data.some((p: any) => p.permission === 'admin')
                    );
                    resolve(adminGroups.map((group: any) => ({ ...group, type: 'group' as 'group' })));
                } else {
                    console.warn("Could not fetch groups:", response?.error);
                    resolve([]); 
                }
            }
        );
    });

    Promise.all([fetchPages, fetchGroups])
        .then(([pagesData, groupsData]) => {
            setTargets([...pagesData, ...groupsData]);
        })
        .catch(error => {
            console.error("Error fetching data from Facebook:", error);
            // setTargetsError(typeof error === 'string' ? error : 'حدث خطأ فادح عند الاتصال بفيسبوك.');
        })
        .finally(() => {
            setTargetsLoading(false);
        });
  }, [isSimulationMode]);

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
    // Validation
    if (!postText.trim() && !selectedImage) {
      setComposerError('لا يمكن نشر منشور فارغ. يرجى كتابة نص أو إضافة صورة.');
      return;
    }
    if (selectedTargetIds.length === 0) {
      setTargetSelectionError('يجب اختيار صفحة أو مجموعة واحدة على الأقل للنشر فيها.');
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

    const action = scheduleAt ? 'جدولة' : 'نشر';

    if (isSimulationMode) {
        setTimeout(() => {
            setIsPublishing(false);
            if(scheduleAt) { /* Add to calendar */ }
            if (activeDraftId) {
              setDrafts(prev => prev.filter(d => d.id !== activeDraftId));
            }
            setNotification({ type: 'success', message: `تمت محاكاة ${action} المنشور بنجاح.` });
            clearComposer();
            setTimeout(() => setNotification(null), 5000);
        }, 1500);
        return;
    }

    const selectedTargetsData = targets.filter(t => selectedTargetIds.includes(t.id));
    
    const publishPromises = selectedTargetsData.map(target => {
        let apiPath: string;
        let apiParams: any;

        if (selectedImage) {
            apiPath = `/${target.id}/photos`;
            const formData = new FormData();
            if (target.type === 'page') {
              formData.append('access_token', target.access_token!);
            }
            formData.append('source', selectedImage);
            if (postText) formData.append('caption', postText);
            if (scheduleAt) {
                formData.append('scheduled_publish_time', String(Math.floor(scheduleAt.getTime() / 1000)));
                formData.append('published', 'false');
            }
            apiParams = formData;
        } else { // Text only post
            apiPath = `/${target.id}/feed`;
            apiParams = {
                message: postText,
            };
            if (target.type === 'page') {
                apiParams.access_token = target.access_token;
            }
            if (scheduleAt) {
                apiParams.scheduled_publish_time = Math.floor(scheduleAt.getTime() / 1000);
                apiParams.published = false;
            }
        }
        
        return new Promise((resolve, reject) => {
            window.FB.api(apiPath, 'POST', apiParams, (response: any) => {
                if (response && !response.error) {
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
    });

    const results = await Promise.allSettled(publishPromises);
    
    setIsPublishing(false);
    
    const successfulPosts = results.filter(r => r.status === 'fulfilled');
    const failedPosts = results.length - successfulPosts.length;
    
    if (!scheduleAt && successfulPosts.length > 0) {
        const newPosts: PublishedPost[] = successfulPosts.map(r => {
             const resultData = (r as PromiseFulfilledResult<any>).value;
             const postId = resultData.response.post_id || resultData.response.id;
             const target = targets.find(t => t.name === resultData.targetName)!;
             return {
                id: postId,
                pageId: target.id,
                pageName: target.name,
                pageAvatarUrl: target.picture.data.url,
                text: postText,
                imagePreview: imagePreview,
                publishedAt: new Date(),
                analytics: { loading: false, lastUpdated: null }
            };
        });
        setPublishedPosts(prev => [...newPosts, ...prev]);
    }


    let message = '';
    let type: 'success' | 'error' | 'partial' = 'error';

    if (successfulPosts.length > 0 && failedPosts === 0) {
        message = `تم ${action} المنشور بنجاح إلى ${successfulPosts.length} من الصفحات/المجموعات.`;
        type = 'success';
        if (activeDraftId) {
            setDrafts(prev => prev.filter(d => d.id !== activeDraftId));
        }
        clearComposer();
    } else if (successfulPosts.length > 0 && failedPosts > 0) {
        message = `تم ${action} المنشور إلى ${successfulPosts.length}، وفشل في ${failedPosts}.`;
        type = 'partial';
    } else {
        message = `فشل ${action} المنشور في كل الأهداف (${failedPosts}). يرجى التحقق من الصلاحيات وتثبيت التطبيق في المجموعات.`;
        type = 'error';
    }
    
    results.forEach(r => {
        if (r.status === 'rejected') {
            console.error("Post failed:", r.reason);
        }
    });
    
    setNotification({ type, message });
    if(type === 'success') {
      setSelectedTargetIds([]);
    }
    setTimeout(() => setNotification(null), 8000);

  }, [postText, selectedImage, selectedTargetIds, targets, isSimulationMode, isScheduled, scheduleDate, activeDraftId, clearComposer, imagePreview]);

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
                            selectedTargetIds={selectedTargetIds}
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
            />;
        case 'calendar':
            return <ContentCalendar posts={scheduledPosts} />;
        case 'drafts':
            return <DraftsList drafts={drafts} onLoad={handleLoadDraft} onDelete={handleDeleteDraft} />;
        case 'analytics':
            return <PublishedPostsList posts={publishedPosts} onFetchAnalytics={handleFetchAnalytics} />;
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