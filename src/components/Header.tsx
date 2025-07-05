
import React from 'react';
import Button from './ui/Button';
import SettingsIcon from './icons/SettingsIcon';

interface HeaderProps {
  onLogout: () => void;
  onSettingsClick: () => void;
  isSimulationMode: boolean;
}

const Header: React.FC<HeaderProps> = ({ onLogout, onSettingsClick, isSimulationMode }) => {
  return (
    <header className="bg-white dark:bg-gray-800 shadow-md p-4 flex justify-between items-center relative">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">
          أداة إدارة المنشورات
        </h1>
        {isSimulationMode && (
          <span className="bg-yellow-200 text-yellow-800 text-xs font-bold mr-2 px-2.5 py-0.5 rounded-full dark:bg-yellow-900 dark:text-yellow-300">
            وضع المحاكاة
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button 
          onClick={onSettingsClick} 
          className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          aria-label="الإعدادات"
        >
          <SettingsIcon className="w-6 h-6" />
        </button>
        <Button onClick={onLogout} variant="secondary">
          تسجيل الخروج
        </Button>
      </div>
    </header>
  );
};

export default Header;