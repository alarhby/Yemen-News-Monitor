
import React from 'react';
import { X, Calendar, Eye, Tag, Share2, ExternalLink } from 'lucide-react';
import { NewsItem } from '../types';

interface ArticleModalProps {
  article: NewsItem | null;
  onClose: () => void;
}

export const ArticleModal: React.FC<ArticleModalProps> = ({ article, onClose }) => {
  if (!article) return null;

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: article.title,
        text: article.summary,
        url: article.originalUrl,
      }).catch(console.error);
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(article.originalUrl);
      alert('تم نسخ الرابط للحافظة');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-none sm:rounded-2xl w-full max-w-3xl h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto shadow-2xl relative animate-in zoom-in-95 duration-200 flex flex-col">
        
        <button 
          onClick={onClose}
          className="absolute top-4 left-4 p-2 bg-white/80 hover:bg-gray-100 rounded-full transition-colors z-20 shadow-sm"
        >
          <X size={24} className="text-gray-700" />
        </button>

        <div className="relative h-64 sm:h-80 shrink-0">
          <img 
            src={article.imageUrl} 
            alt={article.title} 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex items-end">
            <div className="p-6 text-white w-full">
               <div className="flex items-center gap-3 mb-3 text-sm opacity-90">
                 <span className="bg-blue-600 px-3 py-0.5 rounded-full font-bold text-xs shadow-sm">{article.sourceName}</span>
               </div>
               <h2 className="text-xl sm:text-3xl font-bold leading-tight drop-shadow-sm">{article.title}</h2>
            </div>
          </div>
        </div>

        {/* Action Bar below Image */}
        <div className="bg-gray-50 border-b border-gray-100 p-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-10 shadow-sm">
           
           <div className="flex items-center gap-4 text-gray-500 text-sm">
              <span className="flex items-center gap-1.5 font-medium">
                <Calendar size={16} className="text-gray-400"/> 
                {new Date(article.publishedAt).toLocaleDateString('ar-EG')}
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Eye size={16} className="text-gray-400"/> 
                {article.views}
              </span>
              <button 
                onClick={handleShare}
                className="flex items-center gap-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors font-bold text-xs sm:text-sm"
              >
                <Share2 size={16}/> 
                مشاركة
              </button>
           </div>

           <a 
              href={article.originalUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-bold text-xs sm:text-sm shadow-md"
            >
              اقرأ من المصدر
              <ExternalLink size={16} />
            </a>
        </div>

        <div className="p-6 sm:p-8 flex-grow">
           <div className="prose prose-lg max-w-none text-gray-700 leading-9">
             {/* Display Full Content */}
             {article.content.split('\n').map((paragraph, idx) => (
                <p key={idx} className="mb-4 text-justify">{paragraph}</p>
             ))}
           </div>

           <div className="mt-8 pt-6 border-t border-gray-100">
             {/* Removed Header "الوسوم" as requested */}
             <div className="flex flex-wrap gap-2">
               {article.tags.map((tag, i) => (
                 <span key={i} className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition-colors">
                   <Tag size={12} className="opacity-50"/> {tag}
                 </span>
               ))}
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};
