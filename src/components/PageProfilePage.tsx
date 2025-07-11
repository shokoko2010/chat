import React from 'react';
import { PageProfile } from '../types';
import Button from './ui/Button';

interface PageProfilePageProps {
  profile: PageProfile;
  onProfileChange: (newProfile: PageProfile) => void;
  onFetchProfile: () => void;
  isFetchingProfile: boolean;
}

const PageProfilePage: React.FC<PageProfilePageProps> = ({ profile, onProfileChange, onFetchProfile, isFetchingProfile }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onProfileChange({
      ...profile,
      [e.target.name]: e.target.value,
    });
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onProfileChange({ ...profile, language: e.target.value as PageProfile['language'] });
  };
  
  const handleContentLanguageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { value, checked } = e.target;
      const lang = value as 'ar' | 'en';
      let currentLangs = profile.contentGenerationLanguages || [];
      if (checked) {
          if (!currentLangs.includes(lang)) {
              currentLangs.push(lang);
          }
      } else {
          currentLangs = currentLangs.filter(l => l !== lang);
      }
      onProfileChange({ ...profile, contentGenerationLanguages: currentLangs });
  };


  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg fade-in">
      <div className="md:flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">ملف الصفحة</h2>
          <p className="text-gray-600 dark:text-gray-400">
            هذه البيانات هي "دماغ" الذكاء الاصطناعي. كلما كانت أكثر دقة، كانت الاستراتيجيات وجميع مخرجات الذكاء الاصطناعي أفضل. يتم الحفظ تلقائيًا.
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <Button 
              onClick={onFetchProfile} 
              isLoading={isFetchingProfile} 
              disabled={isFetchingProfile}
              variant="secondary"
          >
            📥 استرداد وتحسين بالذكاء الاصطناعي
          </Button>
        </div>
      </div>
      
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
                معلومات الاتصال (هاتف، بريد، الخ)
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
             <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">العنوان</label>
              <input type="text" id="address" name="address" value={profile.address} onChange={handleChange} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700" placeholder="مثال: الرياض، طريق الملك فهد" />
            </div>
            <div>
              <label htmlFor="country" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">البلد</label>
              <input type="text" id="country" name="country" value={profile.country} onChange={handleChange} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700" placeholder="مثال: المملكة العربية السعودية" />
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
        
        <div className="border-t dark:border-gray-700 pt-6 mt-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">إعدادات اللغة والمحتوى</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        لغة الصفحة الأساسية
                    </label>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex items-center"><input type="radio" id="lang-ar" name="language" value="ar" checked={profile.language === 'ar'} onChange={handleLanguageChange} className="w-4 h-4 text-blue-600" /><label htmlFor="lang-ar" className="mr-2 text-sm">العربية</label></div>
                        <div className="flex items-center"><input type="radio" id="lang-en" name="language" value="en" checked={profile.language === 'en'} onChange={handleLanguageChange} className="w-4 h-4 text-blue-600" /><label htmlFor="lang-en" className="mr-2 text-sm">الإنجليزية</label></div>
                        <div className="flex items-center"><input type="radio" id="lang-mixed" name="language" value="mixed" checked={profile.language === 'mixed'} onChange={handleLanguageChange} className="w-4 h-4 text-blue-600" /><label htmlFor="lang-mixed" className="mr-2 text-sm">مختلطة</label></div>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        لغات توليد المحتوى
                    </label>
                    <div className="flex gap-4">
                        <div className="flex items-center"><input type="checkbox" id="gen-lang-ar" value="ar" checked={(profile.contentGenerationLanguages || []).includes('ar')} onChange={handleContentLanguageChange} className="w-4 h-4 text-blue-600" /><label htmlFor="gen-lang-ar" className="mr-2 text-sm">العربية</label></div>
                        <div className="flex items-center"><input type="checkbox" id="gen-lang-en" value="en" checked={(profile.contentGenerationLanguages || []).includes('en')} onChange={handleContentLanguageChange} className="w-4 h-4 text-blue-600" /><label htmlFor="gen-lang-en" className="mr-2 text-sm">الإنجليزية</label></div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PageProfilePage;