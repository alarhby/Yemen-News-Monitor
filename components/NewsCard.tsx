
import React from 'react';
import { Eye, Clock, Tag, ExternalLink, Siren } from 'lucide-react';
import { NewsItem } from '../types';

interface NewsCardProps {
  item: NewsItem;
  onClick: (item: NewsItem) => void;
  trendingThreshold: number;
}

export const NewsCard: React.FC<NewsCardProps> = ({ item, onClick, trendingThreshold }) => {
  const isTrending = item.views >= trendingThreshold;
  
  // Detect urgent news based on keywords
  const isUrgent = item.title.includes('عاجل') || item.title.includes('هام') || item.tags.includes('عاجل');

  const handleSourceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.originalUrl) {
      window.open(item.originalUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div 
      onClick={() => onClick(item)}
      className={`
        relative overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer border group
        ${isUrgent ? 'border-red-300 ring-1 ring-red-100 bg-red-50/30' : 
          isTrending ? 'bg-amber-50 border-amber-200 ring-1 ring-amber-100' : 'bg-white border-gray-100'}
      `}
    >
      {isTrending && !isUrgent && (
        <div className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-full z-10 flex items-center shadow-sm">
          🔥 الأكثر قراءة
        </div>
      )}
      
      {isUrgent && (
        <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-full z-10 flex items-center shadow-sm animate-pulse">
          <Siren size={12} className="mr-1" />
          عاجل
        </div>
      )}
      
      {/* Image Container */}
      <div className={`h-48 overflow-hidden relative ${item.imageType === 'logo' ? 'bg-gray-50 flex items-center justify-center p-8' : 'bg-gray-200'}`}>
        <img 
          src={item.imageUrl} 
          alt={item.title} 
          loading="lazy"
          className={`
            transition-transform duration-500 group-hover:scale-105
            ${item.imageType === 'logo' ? 'w-24 h-24 object-contain opacity-80' : 'w-full h-full object-cover'}
          `}
          onError={(e) => {
            // Fallback if image fails
            (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=News';
          }}
        />
        {/* Overlay for logos to make them look more like headers */}
        {item.imageType === 'logo' && (
           <div className="absolute bottom-0 inset-x-0 h-1 bg-gray-200"></div>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
           <button 
             onClick={handleSourceClick}
             className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded font-medium flex items-center gap-1 transition-colors z-20"
             title="الذهاب للمصدر (نافذة جديدة)"
           >
             {item.sourceName} <ExternalLink size={10} />
           </button>
           <span className="flex items-center gap-1">
             <Clock size={12} />
             {new Date(item.publishedAt).toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'})}
           </span>
        </div>

        <h3 className={`font-bold text-lg mb-2 leading-snug ${isUrgent ? 'text-red-700' : (isTrending ? 'text-amber-900' : 'text-slate-800')}`}>
          {item.title}
        </h3>
        
        <p className="text-gray-600 text-sm line-clamp-2 leading-relaxed mb-3">
          {item.summary}
        </p>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
           <div className="flex flex-wrap gap-1">
             {item.tags.slice(0, 2).map((tag, idx) => (
               <span key={idx} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md ${isUrgent ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-600'}`}>
                 <Tag size={10} /> {tag}
               </span>
             ))}
           </div>
           
           <div className={`flex items-center gap-1 text-sm font-semibold ${isTrending ? 'text-amber-600' : 'text-gray-400'}`}>
             <Eye size={16} />
             <span>{item.views}</span>
           </div>
        </div>
      </div>
    </div>
  );
};
