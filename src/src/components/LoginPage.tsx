
import React from 'react';
import FacebookIcon from './icons/FacebookIcon';
import Button from './ui/Button';

interface LoginPageProps {
  onLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-800">
      <div className="text-center p-8 bg-white dark:bg-gray-900 shadow-2xl rounded-lg max-w-sm w-full mx-4 fade-in">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">أهلاً بك في مدير المنشورات</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-8">
          نظّم وانشر المحتوى في صفحاتك على فيسبوك بكل سهولة.
        </p>
        <Button
          onClick={onLogin}
          className="w-full bg-[#1877F2] hover:bg-[#166FE5] focus:ring-[#1877F2] text-lg"
        >
          <FacebookIcon className="ml-2" />
          تسجيل الدخول باستخدام فيسبوك
        </Button>
      </div>
    </div>
  );
};

export default LoginPage;