
import React from 'react';
import LandingHeader from './LandingHeader';
import Footer from './Footer';
import Button from './ui/Button';
import CalendarDaysIcon from './icons/CalendarDaysIcon';
import SparklesIcon from './icons/SparklesIcon';
import DocumentDuplicateIcon from './icons/DocumentDuplicateIcon';

interface HomePageProps {
  onLoginClick: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ onLoginClick }) => {
    const features = [
        {
            icon: <DocumentDuplicateIcon className="h-10 w-10 text-blue-500" />,
            title: 'إدارة شاملة',
            description: 'تحكم في جميع صفحاتك من مكان واحد. انشر على عدة صفحات بضغطة زر واحدة.'
        },
        {
            icon: <CalendarDaysIcon className="h-10 w-10 text-green-500" />,
            title: 'جدولة متقدمة للمنشورات',
            description: 'خطط لمحتواك مسبقًا. قم بجدولة منشوراتك لتُنشر تلقائيًا في أفضل الأوقات.'
        },
        {
            icon: <SparklesIcon className="h-10 w-10 text-purple-500" />,
            title: 'مساعد الذكاء الاصطناعي',
            description: 'احصل على أفكار إبداعية ونصوص جذابة لمنشوراتك باستخدام قوة الذكاء الاصطناعي.'
        }
    ];

  return (
    <div className="bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      <LandingHeader onLoginClick={onLoginClick} />
      
      <main>
        {/* Hero Section */}
        <section className="text-center py-20 sm:py-32 px-4 bg-white dark:bg-gray-800/50">
          <div className="max-w-4xl mx-auto fade-in">
            <h1 className="text-4xl sm:text-6xl font-extrabold text-gray-900 dark:text-white leading-tight">
              إدارة صفحاتك على فيسبوك<br />أصبحت أسهل من أي وقت مضى
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              zex-pages: أداتك الذكية لإنشاء وجدولة ونشر المحتوى بكفاءة، معززة بقدرات الذكاء الاصطناعي لزيادة تفاعل جمهورك.
            </p>
            <div className="mt-10">
              <Button 
                onClick={onLoginClick} 
                className="text-lg px-8 py-3"
              >
                ابدأ الآن مجاناً
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 sm:py-24 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
                لماذا تختار zex-pages؟
              </h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                كل ما تحتاجه لتنمية حضورك على فيسبوك في منصة واحدة متكاملة.
              </p>
            </div>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-10">
              {features.map((feature, index) => (
                <div key={index} className="text-center p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
                  <div className="flex items-center justify-center h-20 w-20 mx-auto bg-gray-100 dark:bg-gray-700 rounded-full">
                    {feature.icon}
                  </div>
                  <h3 className="mt-6 text-xl font-bold text-gray-900 dark:text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default HomePage;
