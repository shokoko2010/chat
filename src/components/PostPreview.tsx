
import React from 'react';

interface PostPreviewProps {
  postText: string;
  imagePreview: string | null;
  pageName?: string;
  pageAvatar?: string;
}

const PostPreview: React.FC<PostPreviewProps> = ({ 
  postText, 
  imagePreview, 
  pageName = "اسم صفحتك", 
  pageAvatar = "https://via.placeholder.com/40x40/cccccc/ffffff?text=P" 
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sticky top-28">
        <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white">معاينة مباشرة</h3>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50">
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

            {imagePreview ? (
                <div className="mt-2 -mx-4">
                    <img src={imagePreview} alt="Post preview" className="w-full h-auto object-cover" />
                </div>
            ) : (
                !postText && (
                    <div className="text-center text-gray-400 dark:text-gray-500 py-10 border-2 border-dashed rounded-md">
                        <p>ستظهر معاينة المنشور هنا...</p>
                    </div>
                )
            )}
        </div>
    </div>
  );
};

export default PostPreview;
