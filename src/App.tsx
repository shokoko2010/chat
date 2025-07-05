

import React, { useState, useCallback, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import DashboardPage from './components/DashboardPage';
import { initializeGoogleGenAI } from './services/geminiService';
import { GoogleGenAI } from '@google/genai';

// Determine simulation mode once at the module level for robustness.
const isSimulation = window.location.protocol === 'http:';

const App: React.FC = () => {
  const [authStatus, setAuthStatus] = useState<'loading' | 'connected' | 'not_authorized'>(
    isSimulation ? 'connected' : 'loading'
  );
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [aiClient, setAiClient] = useState<GoogleGenAI | null>(null);
  
  const isSimulationMode = isSimulation;

  useEffect(() => {
    // This effect runs for both modes to handle the API key.
    try {
      const storedKey = localStorage.getItem('geminiApiKey');
      if (storedKey) {
        setApiKey(storedKey);
        setAiClient(initializeGoogleGenAI(storedKey));
      }
    } catch (error) {
      console.error("Failed to access localStorage:", error);
    }
    
    // If we are in simulation mode, we are done with this effect.
    if (isSimulationMode) {
      console.warn('RUNNING IN SIMULATION MODE ON HTTP. Facebook features are mocked.');
      return;
    }

    // --- Real Mode Logic (HTTPS) ---
    const checkLoginStatus = () => {
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
        setAuthStatus('not_authorized'); // Fail safely
      }
    };
    
    const handleSdkReady = () => {
      console.log("Facebook SDK ready event received. Checking login status.");
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
          console.warn("Facebook SDK did not initialize in time. Assuming not logged in.");
          return 'not_authorized';
        }
        return currentStatus;
      });
    }, 5000);

    return () => {
      window.removeEventListener('fb-sdk-ready', handleSdkReady);
      clearTimeout(timeoutId);
    };
  }, [isSimulationMode]);


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
    if (isSimulationMode) return;
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
      }, { scope: 'pages_show_list,pages_read_engagement,pages_manage_posts' });
    } catch (error) {
      console.error("An error occurred during FB.login:", error);
      setAuthStatus('not_authorized');
    }
  }, [isSimulationMode]);

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

  if (authStatus === 'loading' && !isSimulationMode) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-800 text-lg font-semibold">
        جاري الاتصال بفيسبوك...
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
