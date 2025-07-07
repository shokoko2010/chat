import React from 'react';
import FacebookIcon from './icons/FacebookIcon';
import HeartIcon from './icons/HeartIcon';
import ChatBubbleOvalLeftIcon from './icons/ChatBubbleOvalLeftIcon';
import PaperAirplaneIcon from './icons/PaperAirplaneIcon';
import BookmarkIcon from './icons/BookmarkIcon';
import EllipsisHorizontalIcon from './icons/EllipsisHorizontalIcon';


interface PostPreviewProps {
  type: 'facebook' | 'instagram';
  postText: string;
  imagePreview: string | null;
  pageName?: string;
  pageAvatar?: string;
}

const PostPreview: React.FC<PostPreviewProps> = ({ 
  type,
  postText, 
  imagePreview, 
  pageName = "اسم صفحتك", 
  pageAvatar = "https://via.placeholder.com/40x40/cccccc/ffffff?text=P" 
}) => {
    
  if (type === 'instagram') {
    return (
        <div className="bg-white dark:bg-black rounded-lg shadow-lg w-full max-w-[350px] mx-auto border dark:border-gray-700">
            {/* Header */}
            <div className="flex items-center p-3">
                <img src={pageAvatar} alt="Page Avatar" className="w-8 h-8 rounded-full object-cover" />
                <p className="font-bold text-sm text-gray-900 dark:text-white mr-3 flex-grow">{pageName}</p>
                <EllipsisHorizontalIcon className="w-6 h-6 text-gray-800 dark:text-gray-200" />
            </div>

            {/* Image */}
            <div className="bg-gray-200 dark:bg-gray-800 aspect-square flex items-center justify-center">
                 {imagePreview ? (
                    <img src={imagePreview} alt="Post preview" className="w-full h-full object-cover" />
                ) : (
                    <p className="text-gray-400 dark:text-gray-500">صورة المنشور</p>
                )}
            </div>

            {/* Actions & Content */}
            <div className="p-3 text-sm text-gray-900 dark:text-gray-100">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-4">
                        <HeartIcon className="w-6 h-6" />
                        <ChatBubbleOvalLeftIcon className="w-6 h-6" />
                        <PaperAirplaneIcon className="w-6 h-6" />
                    </div>
                    <BookmarkIcon className="w-6 h-6" />
                </div>
                
                {postText && (
                    <p className="whitespace-pre-wrap break-words">
                        <span className="font-bold">{pageName}</span> {postText}
                    </p>
                )}
                 {!postText && (
                    <p className="text-gray-500">سيظهر نص المنشور هنا...</p>
                 )}
            </div>
        </div>
    )
  }

  // Facebook Preview (default)
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-[500px] mx-auto">
        <div className="p-4">
            {/* Header */}
            <div className="flex items-center mb-3">
                <img src={pageAvatar} alt="Page Avatar" className="w-10 h-10 rounded-full object-cover" />
                <div className="mr-3">
                    <p className="font-bold text-gray-900 dark:text-white">{pageName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">الآن · 🌍</p>
                </div>
            </div>

            {/* Post Content */}
            {postText && (
                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words mb-3">
                    {postText}
                </p>
            )}
        </div>

        {/* Image */}
        {imagePreview ? (
            <div className="bg-gray-100 dark:bg-gray-900">
                <img src={imagePreview} alt="Post preview" className="w-full h-auto object-contain max-h-[500px]" />
            </div>
        ) : (
            !postText && (
                <div className="text-center text-gray-400 dark:text-gray-500 p-4">
                    <div className="py-10 border-2 border-dashed rounded-md">
                      <p>ستظهر معاينة المنشور هنا...</p>
                    </div>
                </div>
            )
        )}
        
        {/* Separator if there's content */}
        {(postText || imagePreview) && <div className="p-4"><div className="border-t border-gray-200 dark:border-gray-700"></div></div>}

    </div>
  );
};

export default PostPreview;