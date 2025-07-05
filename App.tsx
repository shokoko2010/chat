
import React, { useState, useCallback, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import DashboardPage from './components/DashboardPage';
import { initializeGoogleGenAI } from './services/geminiService';
import { GoogleGenAI } from '@google/genai';

const App: React.FC = () => {
  const [authStatus, setAuthStatus] = useState<'loading' | 'connected' | 'not_authorized'>('loading');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [aiClient, setAiClient] = useState<GoogleGenAI | null>(null);
  const [isSimulationMode, setIsSimulationMode] = useState(false);

  const checkLoginStatus = useCallback(() => {
    try {
      if (window.FB) {
        window.FB.getLoginStatus((response: any) => {
          if (response.status === 'connected') {
            setAuthStatus('connected');
          } else {
            setAuthStatus('not_authorized');
          }
        });
      } else {
        console.warn("FB SDK not ready. Awaiting 'fb-sdk-ready' event.");
      }
    } catch (error) {
      console.error("An error occurred while checking FB login status:", error);
      setAuthStatus('not_authorized');
    }
  }, []);

  useEffect(() => {
    // Hybrid Mode: Detect if running on HTTP and switch to simulation
    if (window.location.protocol === 'http:') {
      console.warn('RUNNING IN SIMULATION MODE ON HTTP. Facebook features are mocked.');
      setIsSimulationMode(true);
      setAuthStatus('connected'); // Bypass login screen for simulation
      return;
    }

    // --- Real Mode Logic (HTTPS) ---
    try {
      const storedKey = localStorage.getItem('geminiApiKey');
      if (storedKey) {
        setApiKey(storedKey);
        setAiClient(initializeGoogleGenAI(storedKey));
      }
    } catch (error) {
      console.error("Failed to access localStorage:", error);
    }

    const handleSdkReady = () => {
      console.log("Facebook SDK ready event received. Checking login status.");
      checkLoginStatus();
    };
    
    window.addEventListener('fb-sdk-ready', handleSdkReady);

    if (window.FB) {
      console.log("Facebook SDK was already available. Checking login status.");
      checkLoginStatus();
    }
    
    const timeoutId = setTimeout(() => {
      if (authStatus === 'loading') {
        console.warn("Facebook SDK did not initialize in time. Assuming not logged in.");
        setAuthStatus('not_authorized');
      }
    }, 5000);

    return () => {
      window.removeEventListener('fb-sdk-ready', handleSdkReady);
      clearTimeout(timeoutId);
    };
  }, [checkLoginStatus]);


  const handleSaveApiKey = (newKey: string) => {
    if (newKey) {
      setApiKey(newKey);
      setAiClient(initializeGoogleGenAI(newKey));
      try {
        localStorage.setItem('geminiApiKey', newKey);
      } catch (error) {
        console.error("Failed to save to localStorage:", error);
      }
    }
  };

  const handleLogin = useCallback(() => {
    try {
      if (!window.FB) {
        console.error("Cannot login: FB SDK not available.");
        return;
      }
      setAuthStatus('loading');
      window.FB.login((response: any) => {
        if (response.authResponse) {
          setAuthStatus('connected');
        } else {
          console.error('User cancelled login or did not fully authorize.');
          setAuthStatus('not_authorized');
        }
      }, { scope: 'pages_show_list,pages_read_engagement,pages_manage_posts,user_managed_groups' });
    } catch (error) {
      console.error("An error occurred during FB.login:", error);
      setAuthStatus('not_authorized');
    }
  }, []);

  const handleLogout = useCallback(() => {
    if (isSimulationMode) {
      setAuthStatus('not_authorized');
      return;
    }
    try {
      if (!window.FB) {
        console.error("Cannot logout: FB SDK not available.");
        return;
      }
      setAuthStatus('loading');
      window.FB.logout(() => {
        setAuthStatus('not_authorized');
      });
    } catch (error) {
      console.error("An error occurred during FB.logout:", error);
      setAuthStatus('not_authorized');
    }
  }, [isSimulationMode]);

  if (authStatus === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-800 text-lg font-semibold">
        جاري التحميل...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      {authStatus === 'connected' ? (
        <DashboardPage
          onLogout={handleLogout}
          aiClient={aiClient}
          currentApiKey={apiKey}
          onSaveApiKey={handleSaveApiKey}
          isSimulationMode={isSimulationMode}
        />
      ) : (
        <LoginPage onLogin={handleLogin} />
      )}
    </div>
  );
};

export default App;
