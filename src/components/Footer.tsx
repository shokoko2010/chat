import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-500 dark:text-gray-400">
          <p>&copy; {new Date().getFullYear()} zex-pages. جميع الحقوق محفوظة.</p>
          <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer" className="hover:text-blue-500 mt-2 sm:mt-0">
            سياسة الخصوصية
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;