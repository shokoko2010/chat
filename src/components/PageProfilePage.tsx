import React from 'react';
import { PageProfile } from '../types';
import Button from './ui/Button';

interface PageProfilePageProps {
  profile: PageProfile;
  onProfileChange: (newProfile: PageProfile) => void;
}

const PageProfilePage: React.FC<PageProfilePageProps> = ({ profile, onProfileChange }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onProfileChange({
      ...profile,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg fade-in">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">ملف الصفحة</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        املأ هذه البيانات لتساعد الذكاء الاصطناعي على إنشاء محتوى أكثر دقة وتخصيصًا لعلامتك التجارية. سيتم حفظ هذه المعلومات تلقائيًا.
      </p>
      
      <div className="space-y-6">
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            وصف العمل / من نحن؟
          </label>
          <textarea
            id="description"
            name="description"
            value={profile.description}
            onChange={handleChange}
            rows={4}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
            placeholder="صف بإيجاز ما تقدمه شركتك أو صفحتك."
          />
        </div>
        
        <div>
          <label htmlFor="services" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            المنتجات والخدمات الرئيسية
          </label>
          <textarea
            id="services"
            name="services"
            value={profile.services}
            onChange={handleChange}
            rows={4}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
            placeholder="قائمة بالمنتجات أو الخدمات التي تقدمها، افصل بينها بفاصلة."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="contactInfo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                معلومات الاتصال (هاتف، بريد، عنوان)
              </label>
              <input
                type="text"
                id="contactInfo"
                name="contactInfo"
                value={profile.contactInfo}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                placeholder="مثال: 966555123456+، info@example.com"
              />
            </div>

            <div>
              <label htmlFor="website" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                الموقع الإلكتروني
              </label>
              <input
                type="url"
                id="website"
                name="website"
                value={profile.website}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://example.com"
              />
            </div>
        </div>

        <div>
          <label htmlFor="currentOffers" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            عروض خاصة أو كلمات مفتاحية حالية
          </label>
          <input
            type="text"
            id="currentOffers"
            name="currentOffers"
            value={profile.currentOffers}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
            placeholder="مثال: خصم 20%، شحن مجاني، #حملة_الصيف"
          />
        </div>
      </div>
    </div>
  );
};

export default PageProfilePage;
