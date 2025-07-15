
import React, { useState, useCallback, useEffect } from 'react';
import PageSelectorPage from './components/PageSelectorPage';
import DashboardPage from './components/DashboardPage';
import HomePage from './components/HomePage';
import SettingsModal from './components/SettingsModal';
import PrivacyPolicyPage from './components/PrivacyPolicyPage';
import { GoogleGenAI } from '@google/genai';
import { initializeGoogleGenAI } from './services/geminiService';
import { Target, Business, PublishedPost, InboxItem } from './types';

const isSimulation = window.location.protocol === 'http:';

const MOCK_TARGETS: Target[] = [
    { id: '1', name: 'صفحة تجريبية 1', type: 'page', access_token: 'DUMMY_TOKEN_1', picture: { data: { url: 'https://via.placeholder.com/150/4B79A1/FFFFFF?text=Page1' } } },
    { id: 'ig1', name: 'Zex Pages IG (@zex_pages_ig)', type: 'instagram', parentPageId: '1', access_token: 'DUMMY_TOKEN_1', picture: { data: { url: 'https://via.placeholder.com/150/E4405F/FFFFFF?text=IG' } } }
];

const MOCK_BUSINESSES: Business[] = [
    { id: 'b1', name: 'الوكالة الرقمية الإبداعية' },
    { id: 'b2', name: 'مجموعة مطاعم النكهة الأصيلة' },
];

const App: React.FC = () => {
  const [authStatus, setAuthStatus] = useState<'loading' | 'connected' | 'not_authorized'>(
    isSimulation ? 'connected' : 'loading'
  );
  
  const [apiKey, setApiKey] = useState<string | null>(localStorage.getItem('gemini-api-key'));
  const [stabilityApiKey, setStabilityApiKey] = useState<string | null>(localStorage.getItem('stability-api-key'));
  const [aiClient, setAiClient] = useState<GoogleGenAI | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const [targets, setTargets] = useState<Target[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(true);
  const [targetsError, setTargetsError] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(null);
  const [favoriteTargetIds, setFavoriteTargetIds] = useState<Set<string>>(new Set());
  
  const [loadingBusinessId, setLoadingBusinessId] = useState<string | null>(null);
  const [loadedBusinessIds, setLoadedBusinessIds] = useState<Set<string>>(new Set());
  const [syncingTargetId, setSyncingTargetId] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    }
  }, [theme]);
  
  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const savedFavorites = localStorage.getItem('zex-pages-favorites');
    if (savedFavorites) {
        setFavoriteTargetIds(new Set(JSON.parse(savedFavorites)));
    }
  }, []);

  const handleToggleFavorite = (targetId: string) => {
    setFavoriteTargetIds(prev => {
        const newFavorites = new Set(prev);
        if (newFavorites.has(targetId)) {
            newFavorites.delete(targetId);
        } else {
            newFavorites.add(targetId);
        }
        localStorage.setItem('zex-pages-favorites', JSON.stringify(Array.from(newFavorites)));
        return newFavorites;
    });
  };

  const handleToggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    if (apiKey) {
      setAiClient(initializeGoogleGenAI(apiKey));
    } else {
      setAiClient(null);
    }
  }, [apiKey]);

  const handleSaveKeys = (keys: { gemini: string; stability: string; }) => {
    setApiKey(keys.gemini);
    localStorage.setItem('gemini-api-key', keys.gemini);
    setStabilityApiKey(keys.stability);
    localStorage.setItem('stability-api-key', keys.stability);
  };

  const isSimulationMode = isSimulation;

  const checkLoginStatus = useCallback(() => {
    if (isSimulationMode) return;
    try {
      if (window.FB) {
        window.FB.getLoginStatus((response: any) => {
          if (response.status === 'connected') {
            setAuthStatus('connected');
          } else {
            setAuthStatus('not_authorized');
          }
        }); 
      }
    } catch (error) {
      console.error("An error occurred while checking FB login status:", error);
      setAuthStatus('not_authorized');
    }
  }, [isSimulationMode]);

  useEffect(() => {
    if (isSimulationMode) {
      console.warn('RUNNING IN SIMULATION MODE ON HTTP. Facebook features are mocked.');
      return;
    }

    const handleSdkReady = () => {
      checkLoginStatus();
    };
    
    if (window.FB) {
      handleSdkReady();
    } else {
      window.addEventListener('fb-sdk-ready', handleSdkReady);
    }
    
    const timeoutId = setTimeout(() => {
      setAuthStatus(currentStatus => {
        if (currentStatus === 'loading') {
          return 'not_authorized';
        }
        return currentStatus;
      });
    }, 5000);

    return () => {
      window.removeEventListener('fb-sdk-ready', handleSdkReady);
      clearTimeout(timeoutId);
    };
  }, [checkLoginStatus, isSimulationMode]);
  
  const fetchWithPagination = useCallback(async (initialPath: string, accessToken?: string): Promise<any[]> => {
      let allData: any[] = [];
      let path: string | null = initialPath;

      if (accessToken && !path.includes('access_token=')) {
          path = path.includes('?') ? `${path}&access_token=${accessToken}` : `${path}?access_token=${accessToken}`;
      }

      let counter = 0; // safety break to avoid infinite loops
      while (path && counter < 50) {
          const response: any = await new Promise(resolve => window.FB.api(path, (res: any) => resolve(res)));
          if (response && response.data) {
              if (response.data.length > 0) {
                allData = allData.concat(response.data);
              }
              path = response.paging?.next ? response.paging.next.replace('https://graph.facebook.com', '') : null;
          } else {
              if (response.error) {
                console.error(`Error fetching paginated data for path ${path}:`, response.error);
                throw new Error(`خطأ في واجهة فيسبوك عند جلب البيانات: ${response.error.message} (رمز: ${response.error.code})`);
              }
              path = null;
          }
          counter++;
      }
      return allData;
  }, []);

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
                                igAccounts.push({
                                    id: igAccount.id,
                                    name: igAccount.name ? `${igAccount.name} (@${igAccount.username})` : `@${igAccount.username}`,
                                    type: 'instagram',
                                    parentPageId: parentPage.id,
                                    access_token: parentPage.access_token,
                                    picture: { data: { url: igAccount.profile_picture_url || 'https://via.placeholder.com/150/833AB4/FFFFFF?text=IG' } }
                                });
                            }
                        }
                    } catch (e) {
                        console.error("Error parsing IG account response body:", e, res.body);
                    }
                }
            });
        } else if (igResponses && igResponses.error) {
            console.warn(`A batch request for Instagram accounts failed and was skipped. Error:`, igResponses.error);
        }
    });
    return igAccounts;
  }, []);

  useEffect(() => {
    if (authStatus !== 'connected') {
        setTargetsLoading(true);
        setTargets([]);
        setBusinesses([]);
        return;
    }
    if (isSimulationMode) {
        setTargets(MOCK_TARGETS);
        setBusinesses(MOCK_BUSINESSES);
        setTargetsLoading(false);
        return;
    }
    
    const fetchAllData = async () => {
        setTargetsLoading(true);
        setTargetsError(null);
        try {
            const pagesPromise = fetchWithPagination('/me/accounts?fields=id,name,access_token,picture{url}&limit=100');
            const businessesPromise = fetchWithPagination('/me/businesses?fields=id,name');

            const [allPagesData, allBusinessesData] = await Promise.all([pagesPromise, businessesPromise]);

            const allTargetsMap = new Map<string, Target>();
            if (allPagesData) allPagesData.forEach(p => allTargetsMap.set(p.id, { ...p, type: 'page' }));
            
            const igAccounts = await fetchInstagramAccounts(allPagesData);
            igAccounts.forEach(ig => allTargetsMap.set(ig.id, ig));
            
            setTargets(Array.from(allTargetsMap.values()));
            setBusinesses(allBusinessesData);
        } catch (error: any) {
            console.error("Error fetching data from Facebook:", error);
            setTargetsError(`فشل تحميل بياناتك من فيسبوك. قد يكون السبب مشكلة في الشبكة أو في صلاحيات الوصول. الخطأ: ${error.message}`);
        } finally {
            setTargetsLoading(false);
        }
    };
    fetchAllData();
  }, [authStatus, isSimulationMode, fetchInstagramAccounts, fetchWithPagination]);
  
  const handleLoadPagesFromBusiness = useCallback(async (businessId: string) => {
    setLoadingBusinessId(businessId);
    try {
      const ownedPagesPromise = fetchWithPagination(`/${businessId}/owned_pages?fields=id,name,access_token,picture{url}&limit=100`);
      const clientPagesPromise = fetchWithPagination(`/${businessId}/client_pages?fields=id,name,access_token,picture{url}&limit=100`);
      
      const [ownedPages, clientPages] = await Promise.all([ownedPagesPromise, clientPagesPromise]);
      const allBusinessPages = [...ownedPages, ...clientPages];
      
      const igAccounts = await fetchInstagramAccounts(allBusinessPages);
      
      const newTargetsMap = new Map<string, Target>();
      allBusinessPages.forEach(p => newTargetsMap.set(p.id, { ...p, type: 'page' }));
      igAccounts.forEach(ig => newTargetsMap.set(ig.id, ig));
      
      setTargets(prevTargets => {
        const existingTargetsMap = new Map(prevTargets.map(t => [t.id, t]));
        newTargetsMap.forEach((value, key) => existingTargetsMap.set(key, value));
        return Array.from(existingTargetsMap.values());
      });
      
      setLoadedBusinessIds(prev => new Set(prev).add(businessId));

    } catch(error: any) {
      console.error(`Error loading pages for business ${businessId}:`, error);
      alert(`فشل تحميل الصفحات من حافظة الأعمال.\nالسبب: ${error.message}`);
    } finally {
      setLoadingBusinessId(null);
    }
  }, [fetchWithPagination, fetchInstagramAccounts]);


  const handleFullHistorySync = useCallback(async (pageTarget: Target) => {
    if (isSimulationMode) {
        alert("لا يمكن مزامنة السجل في وضع المحاكاة.");
        return;
    }
    if (pageTarget.type !== 'page') {
        alert("المزامنة الكاملة متاحة فقط لصفحات فيسبوك.");
        return;
    }

    const pageAccessToken = pageTarget.access_token;
    if (!pageAccessToken) {
        alert(`لم يتم العثور على صلاحية الوصول (Access Token) للصفحة ${pageTarget.name}.`);
        return;
    }
    
    setSyncingTargetId(pageTarget.id);
    try {
        const linkedIgTarget = targets.find(t => t.type === 'instagram' && t.parentPageId === pageTarget.id);

        let fetchedPosts: PublishedPost[] = [];
        let combinedInboxItems: InboxItem[] = [];
        const defaultPicture = 'https://via.placeholder.com/40/cccccc/ffffff?text=?';

        // --- 1. Fetch Facebook Page Data ---
        const fbPostFields = 'id,message,full_picture,created_time,from,likes.summary(true),shares,comments.summary(true),insights.metric(post_impressions_unique){values}';
        const fbPostsPath = `/${pageTarget.id}/published_posts?fields=${fbPostFields}&limit=25`;
        const fbAllPostsData = await fetchWithPagination(fbPostsPath, pageAccessToken);
        
        const fbFetchedPosts: PublishedPost[] = fbAllPostsData.map((post: any) => ({
            id: post.id, pageId: pageTarget.id, pageName: pageTarget.name, pageAvatarUrl: pageTarget.picture.data.url,
            text: post.message || '',
            imagePreview: post.full_picture || null,
            publishedAt: new Date(post.created_time),
            analytics: {
                likes: post.likes?.summary?.total_count ?? 0,
                comments: post.comments?.summary?.total_count ?? 0,
                shares: post.shares?.count ?? 0,
                reach: post.insights?.data?.[0]?.values?.[0]?.value ?? 0,
                loading: false, lastUpdated: new Date(), isGeneratingInsights: false
            }
        }));
        fetchedPosts.push(...fbFetchedPosts);

        const fbCommentFields = 'id,from{id,name,picture{url}},message,created_time,parent{id},comments{from{id}},can_reply_privately';
        const fbCommentPromises = fbAllPostsData.map(async (post) => {
            if (post.comments?.summary?.total_count > 0) {
                const postComments = await fetchWithPagination(`/${post.id}/comments?fields=${fbCommentFields}&limit=100`, pageAccessToken);
                return postComments.map((comment: any): InboxItem => {
                      const authorId = comment.from?.id;
                      const authorPictureUrl = comment.from?.picture?.data?.url || (authorId ? `https://graph.facebook.com/${authorId}/picture?type=normal` : defaultPicture);
                      const pageHasReplied = !!comment.comments?.data?.some((c: any) => c && c.from && c.from.id === pageTarget.id);
                      return {
                        id: comment.id,
                        platform: 'facebook',
                        type: 'comment',
                        text: comment.message || '',
                        authorName: comment.from?.name || 'مستخدم فيسبوك',
                        authorId: authorId || 'Unknown',
                        authorPictureUrl: authorPictureUrl,
                        timestamp: new Date(comment.created_time).toISOString(),
                        post: { id: post.id, message: post.message, picture: post.full_picture },
                        parentId: comment.parent?.id,
                        isReplied: pageHasReplied,
                        can_reply_privately: comment.can_reply_privately,
                      };
                });
            }
            return [];
        });
        const fbCommentBatches = await Promise.all(fbCommentPromises);
        fbCommentBatches.forEach(batch => combinedInboxItems.push(...batch));

        const convosPath = `/${pageTarget.id}/conversations?fields=id,snippet,updated_time,participants,messages.limit(1){from}&limit=100`;
        const allConvosData = await fetchWithPagination(convosPath, pageAccessToken);
        const allMessages: InboxItem[] = allConvosData.map((convo: any) => {
            const participant = convo.participants.data.find((p: any) => p.id !== pageTarget.id);
            const participantId = participant?.id;
            const lastMessage = convo.messages?.data?.[0];
            const pageSentLastMessage = lastMessage?.from?.id === pageTarget.id;
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
                isReplied: pageSentLastMessage
            };
        });
        combinedInboxItems.push(...allMessages);

        // --- 2. Fetch Instagram Data (if it exists) ---
        if (linkedIgTarget) {
            setSyncingTargetId(linkedIgTarget.id); // Update UI feedback
            const igAccessToken = linkedIgTarget.access_token; // This is the parent page's token, which is correct.
            const igPostFields = 'id,caption,media_url,timestamp,like_count,comments_count,username';
            const igPostsPath = `/${linkedIgTarget.id}/media?fields=${igPostFields}&limit=25`;
            const igAllPostsData = await fetchWithPagination(igPostsPath, igAccessToken);

            const igFetchedPosts: PublishedPost[] = igAllPostsData.map((post: any) => ({
                id: post.id, pageId: linkedIgTarget.id, pageName: linkedIgTarget.name, pageAvatarUrl: linkedIgTarget.picture.data.url,
                text: post.caption || '',
                imagePreview: post.media_url || null,
                publishedAt: new Date(post.timestamp),
                analytics: {
                    likes: post.like_count ?? 0,
                    comments: post.comments_count ?? 0,
                    shares: 0, // Reach is not directly available for IG media this way
                    reach: 0,
                    loading: false, lastUpdated: new Date(), isGeneratingInsights: false
                }
            }));
            fetchedPosts.push(...igFetchedPosts);

            const igCommentFields = 'id,from{id,username},text,timestamp,replies{from{id}}';
            const igCommentPromises = igAllPostsData.map(async (post) => {
                if (post.comments_count > 0) {
                    const postComments = await fetchWithPagination(`/${post.id}/comments?fields=${igCommentFields}&limit=100`, igAccessToken);
                    return postComments.map((comment: any): InboxItem => {
                        const pageHasReplied = !!comment.replies?.data?.some((c: any) => c && c.from && c.from.id === pageTarget.id);
                        return {
                            id: comment.id,
                            platform: 'instagram',
                            type: 'comment',
                            text: comment.text || '',
                            authorName: comment.from?.username || 'مستخدم انستجرام',
                            authorId: comment.from?.id || 'Unknown',
                            authorPictureUrl: defaultPicture,
                            timestamp: new Date(comment.timestamp).toISOString(),
                            post: { id: post.id, message: post.caption, picture: post.media_url },
                            parentId: comment.parent?.id,
                            isReplied: pageHasReplied
                        };
                    });
                }
                return [];
            });
            const igCommentBatches = await Promise.all(igCommentPromises);
            igCommentBatches.forEach(batch => combinedInboxItems.push(...batch));
            
            // Fetch Instagram Messages
            const igConvosPath = `/${pageTarget.id}/conversations?platform=instagram&fields=id,snippet,updated_time,participants,messages.limit(1){from}&limit=100`;
            const allIgConvosData = await fetchWithPagination(igConvosPath, pageAccessToken);
            const allIgMessages: InboxItem[] = allIgConvosData.map((convo: any) => {
                const participant = convo.participants.data.find((p: any) => p.id !== pageTarget.id);
                const participantId = participant?.id;
                const lastMessage = convo.messages?.data?.[0];
                const pageSentLastMessage = lastMessage?.from?.id === pageTarget.id;
                return {
                    id: convo.id,
                    platform: 'instagram',
                    type: 'message',
                    text: convo.snippet,
                    authorName: participant?.name || 'مستخدم انستجرام',
                    authorId: participantId || 'Unknown',
                    authorPictureUrl: defaultPicture,
                    timestamp: new Date(convo.updated_time).toISOString(),
                    conversationId: convo.id,
                    isReplied: pageSentLastMessage
                };
            });
            combinedInboxItems.push(...allIgMessages);
        }

        // --- 3. Save Data ---
        const dataKey = `zex-pages-data-${pageTarget.id}`;
        const rawData = localStorage.getItem(dataKey);
        const data = rawData ? JSON.parse(rawData) : {};
        
        const existingInbox = data.inboxItems || [];
        const combinedInboxMap = new Map<string, InboxItem>();
        existingInbox.forEach((item: InboxItem) => combinedInboxMap.set(item.id, item));
        combinedInboxItems.forEach((item: InboxItem) => combinedInboxMap.set(item.id, item));
        
        const sortedInboxItems = Array.from(combinedInboxMap.values()).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        const existingPosts = data.publishedPosts || [];
        const combinedPostsMap = new Map<string, PublishedPost>();
        existingPosts.forEach((post: PublishedPost) => combinedPostsMap.set(post.id, post));
        fetchedPosts.forEach((post: PublishedPost) => combinedPostsMap.set(post.id, post));
        
        const sortedPosts = Array.from(combinedPostsMap.values()).sort((a,b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

        const updatedData = {
          ...data,
          publishedPosts: sortedPosts,
          inboxItems: sortedInboxItems,
          syncedAt: new Date().toISOString()
        };
        localStorage.setItem(dataKey, JSON.stringify(updatedData));

        alert(`تمت مزامنة ${fetchedPosts.length} منشورًا و ${combinedInboxItems.length} عنصرًا في البريد الوارد بنجاح للهدف ${pageTarget.name}${linkedIgTarget ? ` و ${linkedIgTarget.name}`: ''}.`);

    } catch(error: any) {
      console.error("Error during full history sync:", error);
      const errorMessage = error instanceof Error ? error.message : "حدث خطأ غير متوقع أثناء المزامنة.";
      alert(`فشلت المزامنة الكاملة للهدف ${pageTarget.name}.\nالسبب: ${errorMessage}\n\nقد تحتاج إلى تحديث صلاحيات الوصول وإعادة المحاولة.`);
    } finally {
      setSyncingTargetId(null);
    }
  }, [fetchWithPagination, isSimulationMode, targets]);


  const handleLogin = useCallback(() => {
    if (isSimulationMode) {
        setAuthStatus('connected');
        return;
    }
    if (!window.FB) return;
    setAuthStatus('loading');
    window.FB.login((response: any) => {
        if (response.authResponse) setAuthStatus('connected');
        else setAuthStatus('not_authorized');
      }, { 
        scope: 'email,public_profile,business_management,pages_show_list,read_insights,pages_manage_posts,pages_read_engagement,pages_manage_engagement,pages_messaging,instagram_basic,instagram_manage_comments,instagram_manage_messages',
        auth_type: 'rerequest'
      });
  }, [isSimulationMode]);

  const handleLogout = useCallback(() => {
    const performLogout = () => {
        setAuthStatus('not_authorized');
        setSelectedTarget(null);
    };
    if (isSimulationMode) { performLogout(); return; }
    if (!window.FB) { performLogout(); return; }
    setAuthStatus('loading');
    window.FB.logout(() => performLogout());
  }, [isSimulationMode]);

  const handleSelectTarget = (target: Target) => setSelectedTarget(target);
  const handleChangePage = () => setSelectedTarget(null);

  const renderContent = () => {
      if (currentPath === '/privacy-policy.html') {
        return <PrivacyPolicyPage />;
      }
      if (authStatus === 'loading') {
        return <div className="flex items-center justify-center min-h-screen">جاري التحميل...</div>;
      }
      if (authStatus !== 'connected') {
        return <HomePage onLoginClick={handleLogin} />;
      }
      if (selectedTarget) {
        return (
          <DashboardPage
            managedTarget={selectedTarget}
            allTargets={targets}
            onChangePage={handleChangePage}
            onLogout={handleLogout}
            isSimulationMode={isSimulationMode}
            aiClient={aiClient}
            stabilityApiKey={stabilityApiKey}
            onSettingsClick={() => setIsSettingsModalOpen(true)}
            fetchWithPagination={fetchWithPagination}
            onSyncHistory={handleFullHistorySync}
            syncingTargetId={syncingTargetId}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />
        );
      }
      return (
        <PageSelectorPage
          targets={targets}
          businesses={businesses}
          onLoadPagesFromBusiness={handleLoadPagesFromBusiness}
          loadingBusinessId={loadingBusinessId}
          loadedBusinessIds={loadedBusinessIds}
          isLoading={targetsLoading}
          error={targetsError}
          onSelectTarget={handleSelectTarget}
          onLogout={handleLogout}
          onSettingsClick={() => setIsSettingsModalOpen(true)}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          favoriteTargetIds={favoriteTargetIds}
          onToggleFavorite={handleToggleFavorite}
        />
      );
  };
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <SettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSave={handleSaveKeys}
        currentApiKey={apiKey}
        currentStabilityApiKey={stabilityApiKey}
      />
      {renderContent()}
    </div>
  );
};

export default App;
