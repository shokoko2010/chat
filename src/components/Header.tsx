import React from 'react';
import Button from './ui/Button';

interface HeaderProps {
  onLogout: () => void;
  isSimulationMode: boolean;
}

const Header: React.FC<HeaderProps> = ({ onLogout, isSimulationMode }) => {
  return (
    <header className="bg-white dark:bg-gray-800 shadow-md p-4 flex justify-between items-center relative">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">
          zex-pages
        </h1>
        {isSimulationMode && (
          <span className="bg-yellow-200 text-yellow-800 text-xs font-bold mr-2 px-2.5 py-0.5 rounded-full dark:bg-yellow-900 dark:text-yellow-300">
            وضع المحاكاة
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={onLogout} variant="secondary">
          تسجيل الخروج
        </Button>
      </div>
    </header>
  );
};

export default Header;
