import React, { useState, useCallback, useEffect, useMemo } from 'react';
import PageSelectorPage from './src/components/PageSelectorPage';
import DashboardPage from './src/components/DashboardPage';
import HomePage from './src/components/HomePage';
import { GoogleGenAI } from '@google/genai';
import { initializeGoogleGenAI } from './src/services/geminiService';
import { Target } from './src/types';
import SettingsModal from './src/components/SettingsModal';

const isSimulation = window.location.protocol === 'http:';

const MOCK_TARGETS: Target[] = [
    { id: '1', name: 'صفحة تجريبية 1', type: 'page', access_token: 'DUMMY_TOKEN_1', picture: { data: { url: 'https://via.placeholder.com/150/4B79A1/FFFFFF?text=Page1' } } },
    { id: '101', name: 'مجموعة المطورين التجريبية', type: 'group', picture: { data: { url: 'https://via.placeholder.com/150/228B22/FFFFFF?text=Group1' } } },
    { id: 'ig1', name: 'Zex Pages IG (@zex_pages_ig)', type: 'instagram', parentPageId: '1', access_token: 'DUMMY_TOKEN_1', picture: { data: { url: 'https://via.placeholder.com/150/E4405F/FFFFFF?text=IG' } } }
];

const App: React.FC = () => {
  const [authStatus, setAuthStatus] = useState<'loading' | 'connected' | 'not_authorized'>(
    isSimulation ? 'connected' : 'loading'
  );
  
  const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem('geminiApiKey'));
  const [aiClient, setAiClient] = useState<GoogleGenAI | null>(null);

  const [targets, setTargets] = useState<Target[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(true);
  const [targetsError, setTargetsError] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);


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
        return;
    }
    if (isSimulationMode) {
        setTargets(MOCK_TARGETS);
        setTargetsLoading(false);
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
                if (response.error) console.error(`Error fetching paginated data for path ${path}:`, response.error);
                path = null;
            }
        }
        return allData;
    };

    const fetchAllData = async () => {
        setTargetsLoading(true);
        setTargetsError(null);
        try {
            const pagesPromise = fetchWithPagination('/me/accounts?fields=id,name,access_token,picture{url}&limit=100');
            const groupsPromise = fetchWithPagination('/me/groups?fields=id,name,picture{url},permissions&limit=100');
            const [allPagesData, allGroupsRaw] = await Promise.all([pagesPromise, groupsPromise]);

            const allTargetsMap = new Map<string, Target>();
            if (allPagesData) allPagesData.forEach(p => allTargetsMap.set(p.id, { ...p, type: 'page' }));
            if (allGroupsRaw) {
              const adminGroups = allGroupsRaw.filter(g => g.permissions?.data.some((p: any) => p.permission === 'admin'));
              adminGroups.forEach(g => allTargetsMap.set(g.id, { ...g, type: 'group' }));
            }
            const igAccounts = await fetchInstagramAccounts(allPagesData);
            igAccounts.forEach(ig => allTargetsMap.set(ig.id, ig));
            
            const finalTargets = Array.from(allTargetsMap.values());
            setTargets(finalTargets);
        } catch (error) {
            console.error("Error fetching data from Facebook:", error);
            setTargetsError('حدث خطأ فادح عند الاتصال بفيسبوك.');
        } finally {
            setTargetsLoading(false);
        }
    };
    fetchAllData();
  }, [authStatus, isSimulationMode, fetchInstagramAccounts]);

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
        scope: 'pages_show_list,pages_read_engagement,pages_manage_posts,business_management,pages_read_user_content,read_insights,instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_insights',
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
            currentApiKey={apiKey}
            onSaveApiKey={handleSaveApiKey}
            onSettingsClick={() => setIsSettingsOpen(true)}
          />
        );
      }
      return (
        <PageSelectorPage
          targets={targets}
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
        onSave={onSaveApiKey}
        currentApiKey={apiKey}
      />
    </div>
  );
};

export default App;