import React from 'react';
import InstagramIcon from './icons/InstagramIcon';
import HandThumbUpIcon from './icons/HandThumbUpIcon';
import ChatBubbleOvalLeftEllipsisIcon from './icons/ChatBubbleOvalLeftEllipsisIcon';
import ShareIcon from './icons/ShareIcon';

interface PostPreviewProps {
  isCrosspostingInstagram: boolean;
  postText: string;
  imagePreview: string | null;
  pageName?: string;
  pageAvatar?: string;
}

const PostPreview: React.FC<PostPreviewProps> = ({ 
  isCrosspostingInstagram,
  postText, 
  imagePreview, 
  pageName = "اسم صفحتك", 
  pageAvatar = "https://via.placeholder.com/40x40/cccccc/ffffff?text=P" 
}) => {
    
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-[500px] mx-auto overflow-hidden">
        <div className="p-4">
            {/* Header */}
            <div className="flex items-center mb-3">
                <div className="relative">
                    <img src={pageAvatar} alt="Page Avatar" className="w-10 h-10 rounded-full object-cover" />
                    {isCrosspostingInstagram && (
                        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-gray-800 rounded-full p-0.5 shadow-md">
                           <InstagramIcon className="w-4 h-4" />
                        </div>
                    )}
                 </div>
                <div className="mr-3">
                    <p className="font-bold text-gray-900 dark:text-white">{pageName}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>الآن · 🌍</span>
                         {isCrosspostingInstagram && (
                            <span className="font-semibold text-gray-600 dark:text-gray-300"> + انستجرام</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Post Content */}
            {postText && (
                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words mb-3">
                    {postText}
                </p>
            )}
             {!postText && !imagePreview && (
                 <div className="text-center text-gray-400 dark:text-gray-500 py-10 my-4 border-2 border-dashed rounded-md">
                    <p>ستظهر معاينة المنشور هنا...</p>
                 </div>
             )}
        </div>

        {/* Image */}
        {imagePreview && (
            <div className="bg-gray-100 dark:bg-gray-900">
                <img src={imagePreview} alt="Post preview" className="w-full h-auto object-contain max-h-[500px]" />
            </div>
        )}
        
        {/* Actions */}
        {(postText || imagePreview) && (
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-around text-gray-600 dark:text-gray-400 font-semibold text-sm">
                    <button className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md px-3 py-2 transition-colors w-full justify-center">
                        <HandThumbUpIcon className="w-5 h-5" />
                        <span>إعجاب</span>
                    </button>
                    <button className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md px-3 py-2 transition-colors w-full justify-center">
                        <ChatBubbleOvalLeftEllipsisIcon className="w-5 h-5" />
                        <span>تعليق</span>
                    </button>
                    <button className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md px-3 py-2 transition-colors w-full justify-center">
                        <ShareIcon className="w-5 h-5" />
                        <span>مشاركة</span>
                    </button>
                </div>
            </div>
        )}
    </div>
  );
};

export default PostPreview;
