
import React from 'react';
import { Eye, Clock, Tag, ExternalLink, Siren } from 'lucide-react';
import { NewsItem, LayoutMode } from '../types';

interface NewsCardProps {
  item: NewsItem;
  onClick: (item: NewsItem) => void;
  trendingThreshold: number;
  layout: LayoutMode;
}

export const NewsCard: React.FC<NewsCardProps> = ({ item, onClick, trendingThreshold, layout }) => {
  const isTrending = item.views >= trendingThreshold;
  
  // Detect urgent news based on keywords
  const isUrgent = item.title.includes('عاجل') || item.title.includes('هام') || item.tags.includes('عاجل');

  const handleSourceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.originalUrl) {
      window.open(item.originalUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const containerClasses = `
    relative overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer border group
    ${isUrgent ? 'border-red-300 ring-1 ring-red-100 bg-red-50/30' : 
      isTrending ? 'bg-amber-50 border-amber-200 ring-1 ring-amber-100' : 'bg-white border-gray-100'}
    ${layout === 'grid' ? 'flex flex-col' : 
      layout === 'list' ? 'flex flex-row h-40 sm:h-48' : 
      'flex flex-row items-center h-24 p-2 gap-3'}
  `;

  // Image Classes
  const imageContainerClasses = `
    overflow-hidden relative
    ${layout === 'grid' ? (item.imageType === 'logo' ? 'h-48 bg-gray-50 flex items-center justify-center p-8' : 'h-48 bg-gray-200') :
      layout === 'list' ? (item.imageType === 'logo' ? 'w-1/3 min-w-[120px] bg-gray-50 flex items-center justify-center p-4' : 'w-1/3 min-w-[120px] bg-gray-200') :
      'w-20 h-20 rounded-lg shrink-0'
    }
  `;

  const imgClasses = `
    transition-transform duration-500 group-hover:scale-105
    ${item.imageType === 'logo' ? 'object-contain opacity-80' : 'object-cover'}
    ${layout === 'compact' ? 'w-full h-full rounded-lg' : 
      item.imageType === 'logo' ? 'w-24 h-24' : 'w-full h-full'}
  `;

  return (
    <div onClick={() => onClick(item)} className={containerClasses}>
      
      {/* Badges - Only show full badges in Grid/List */}
      {layout !== 'compact' && isTrending && !isUrgent && (
        <div className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-full z-10 flex items-center shadow-sm">
          🔥
        </div>
      )}
      
      {layout !== 'compact' && isUrgent && (
        <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-full z-10 flex items-center shadow-sm animate-pulse">
          عاجل
        </div>
      )}
      
      {/* Image Section */}
      <div className={imageContainerClasses}>
        <img 
          src={item.imageUrl} 
          alt={item.title} 
          loading="lazy"
          className={imgClasses}
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=News';
          }}
        />
        {layout === 'grid' && item.imageType === 'logo' && (
           <div className="absolute bottom-0 inset-x-0 h-1 bg-gray-200"></div>
        )}
      </div>

      {/* Content Section */}
      <div className={`${layout === 'compact' ? 'flex-1 min-w-0' : 'p-5 flex flex-col flex-1 min-w-0'}`}>
        
        {/* Meta Header */}
        {layout !== 'compact' && (
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <button 
                onClick={handleSourceClick}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded font-medium flex items-center gap-1 transition-colors z-20 truncate max-w-[120px]"
            >
                {item.sourceName}
            </button>
            <span className="flex items-center gap-1 shrink-0">
                <Clock size={12} />
                {new Date(item.publishedAt).toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'})}
            </span>
            </div>
        )}

        {/* Title */}
        <h3 className={`font-bold leading-snug mb-2 ${
            layout === 'compact' ? 'text-sm mb-1 truncate' : 'text-lg'
            } ${isUrgent ? 'text-red-700' : (isTrending ? 'text-amber-900' : 'text-slate-800')}`}>
          {item.title}
        </h3>
        
        {/* Summary - Hidden in compact, trimmed in list */}
        {layout !== 'compact' && (
            <p className={`text-gray-600 text-sm leading-relaxed mb-3 ${layout === 'list' ? 'line-clamp-3' : 'line-clamp-2'}`}>
            {item.summary}
            </p>
        )}
        
        {/* Compact Meta */}
        {layout === 'compact' && (
            <div className="flex items-center gap-2 text-[10px] text-gray-500">
                <span className="text-blue-600 font-medium">{item.sourceName}</span>
                <span>•</span>
                <span>{new Date(item.publishedAt).toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
        )}

        {/* Footer Stats - Only Grid/List */}
        {layout !== 'compact' && (
            <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
                <div className="flex flex-wrap gap-1">
                    {item.tags.slice(0, 1).map((tag, idx) => (
                    <span key={idx} className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md ${isUrgent ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-600'}`}>
                        {tag}
                    </span>
                    ))}
                </div>
                
                <div className={`flex items-center gap-1 text-xs font-semibold ${isTrending ? 'text-amber-600' : 'text-gray-400'}`}>
                    <Eye size={14} />
                    <span>{item.views}</span>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
