

import React, { useState, useCallback, useEffect } from 'react';
import PageSelectorPage from './components/PageSelectorPage';
import DashboardPage from './components/DashboardPage';
import HomePage from './components/HomePage';
import { GoogleGenAI } from '@google/genai';
import { initializeGoogleGenAI } from './services/geminiService';
import { Target, Business, PublishedPost, InboxItem } from './types';
import SettingsModal from './components/SettingsModal';

const isSimulation = window.location.protocol === 'http:';

const MOCK_TARGETS: Target[] = [
    { id: '1', name: 'صفحة تجريبية 1', type: 'page', access_token: 'DUMMY_TOKEN_1', picture: { data: { url: 'https://via.placeholder.com/150/4B79A1/FFFFFF?text=Page1' } } },
    { id: '101', name: 'مجموعة المطورين التجريبية', type: 'group', picture: { data: { url: 'https://via.placeholder.com/150/228B22/FFFFFF?text=Group1' } } },
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
  
  const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem('geminiApiKey'));
  const [aiClient, setAiClient] = useState<GoogleGenAI | null>(null);

  const [targets, setTargets] = useState<Target[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(true);
  const [targetsError, setTargetsError] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [loadingBusinessId, setLoadingBusinessId] = useState<string | null>(null);
  const [loadedBusinessIds, setLoadedBusinessIds] = useState<Set<string>>(new Set());
  const [syncingTargetId, setSyncingTargetId] = useState<string | null>(null);


  useEffect(() => {
    setAiClient(initializeGoogleGenAI(apiKey ?? ''));
  }, [apiKey]);

  const handleSaveApiKey = (newKey: string) => {
    localStorage.setItem('geminiApiKey', newKey);
    setApiKey(newKey);
    setIsSettingsOpen(false);
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
  
  const fetchWithPagination = useCallback(async (initialPath: string): Promise<any[]> => {
      let allData: any[] = [];
      let path: string | null = initialPath;
      let counter = 0; // safety break to avoid infinite loops
      while (path && counter < 20) { // Limit to 20 pages max for safety
          const response: any = await new Promise(resolve => window.FB.api(path, (res: any) => resolve(res)));
          if (response && response.data && response.data.length > 0) {
              allData = allData.concat(response.data);
              path = response.paging?.next ? new URL(response.paging.next).pathname + new URL(response.paging.next).search : null;
          } else {
              if (response.error) console.error(`Error fetching paginated data for path ${path}:`, response.error);
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
            console.error("Error in batch request for IG accounts:", igResponses.error);
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
            const groupsPromise = fetchWithPagination('/me/groups?fields=id,name,picture{url},permissions&limit=100');
            const businessesPromise = fetchWithPagination('/me/businesses?fields=id,name');

            const [allPagesData, allGroupsRaw, allBusinessesData] = await Promise.all([pagesPromise, groupsPromise, businessesPromise]);

            const allTargetsMap = new Map<string, Target>();
            if (allPagesData) allPagesData.forEach(p => allTargetsMap.set(p.id, { ...p, type: 'page' }));
            if (allGroupsRaw) {
              const adminGroups = allGroupsRaw.filter(g => g.permissions?.data.some((p: any) => p.permission === 'admin'));
              adminGroups.forEach(g => allTargetsMap.set(g.id, { ...g, type: 'group' }));
            }
            const igAccounts = await fetchInstagramAccounts(allPagesData);
            igAccounts.forEach(ig => allTargetsMap.set(ig.id, ig));
            
            setTargets(Array.from(allTargetsMap.values()));
            setBusinesses(allBusinessesData);
        } catch (error) {
            console.error("Error fetching data from Facebook:", error);
            setTargetsError('حدث خطأ فادح عند الاتصال بفيسبوك.');
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

    } catch(error) {
      console.error(`Error loading pages for business ${businessId}:`, error);
    } finally {
      setLoadingBusinessId(null);
    }
  }, [fetchWithPagination, fetchInstagramAccounts]);


  const handleFullHistorySync = useCallback(async (target: Target) => {
    if (isSimulationMode) {
      alert("لا يمكن مزامنة السجل في وضع المحاكاة.");
      return;
    }
    setSyncingTargetId(target.id);
    try {
        const postsPath = `/${target.id}/published_posts?fields=id,message,full_picture,created_time,likes.summary(true),comments.summary(true),shares,insights.metric(post_impressions_unique){values}&limit=100`;
        const allPostsData = await fetchWithPagination(postsPath);
        
        const fetchedPosts: PublishedPost[] = allPostsData.map((post: any) => ({
            id: post.id, pageId: target.id, pageName: target.name, pageAvatarUrl: target.picture.data.url, text: post.message || '',
            imagePreview: post.full_picture || null, publishedAt: new Date(post.created_time),
            analytics: {
                likes: post.likes?.summary?.total_count ?? 0, comments: post.comments?.summary?.total_count ?? 0, shares: post.shares?.count ?? 0,
                reach: post.insights?.data?.[0]?.values?.[0]?.value ?? 0,
                loading: false, lastUpdated: new Date(), isGeneratingInsights: false
            }
        }));

        const convosPath = `/${target.id}/conversations?fields=id,snippet,updated_time,participants&limit=100`;
        const allConvosData = await fetchWithPagination(convosPath);

        const fetchedInboxItems: InboxItem[] = allConvosData.map((convo: any) => {
            const participant = convo.participants.data.find((p: any) => p.id !== target.id);
            return {
                id: convo.id, type: 'message', text: convo.snippet, authorName: participant?.name || 'Unknown',
                authorId: participant?.id || 'Unknown', authorPictureUrl: `https://graph.facebook.com/${participant?.id}/picture`,
                timestamp: convo.updated_time, conversationId: convo.id
            };
        });

        // For simplicity, we'll just replace the history. A more robust solution might merge.
        const dataKey = `zex-pages-data-${target.id}`;
        const rawData = localStorage.getItem(dataKey);
        const data = rawData ? JSON.parse(rawData) : {};
        
        const updatedData = {
          ...data,
          publishedPosts: fetchedPosts,
          inboxItems: fetchedInboxItems, // We might need to merge this with comments later. For now, this is simpler.
          syncedAt: new Date().toISOString()
        };
        localStorage.setItem(dataKey, JSON.stringify(updatedData));

        alert(`تمت مزامنة ${fetchedPosts.length} منشورًا و ${fetchedInboxItems.length} محادثة بنجاح للصفحة ${target.name}.`);

    } catch(error) {
      console.error("Error during full history sync:", error);
      alert(`فشلت مزامنة السجل للصفحة ${target.name}.`);
    } finally {
      setSyncingTargetId(null);
    }
  }, [fetchWithPagination, isSimulationMode]);


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
        scope: 'public_profile,email,pages_read_engagement,pages_manage_posts,business_management,pages_read_user_content,read_insights,user_managed_groups,instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_insights,pages_messaging',
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
            onSettingsClick={() => setIsSettingsOpen(true)}
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
          onSyncHistory={handleFullHistorySync}
          syncingTargetId={syncingTargetId}
          isLoading={targetsLoading}
          error={targetsError}
          onSelectTarget={handleSelectTarget}
          onLogout={handleLogout}
          onSettingsClick={() => setIsSettingsOpen(true)}
        />
      );
  };
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {renderContent()}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveApiKey}
        currentApiKey={apiKey}
      />
    </div>
  );
};

export default App;