
import React from 'react';
import { Globe } from 'lucide-react';
import { Source } from '../types';

interface SourcesViewProps {
  sources: Source[];
  onSourceClick: (sourceName: string) => void;
}

export const SourcesView: React.FC<SourcesViewProps> = ({ sources, onSourceClick }) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">المصادر الإخبارية</h2>
        <p className="text-gray-500">تصفح الأخبار حسب المصدر المفضل لديك</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {sources.map((source) => (
          <div 
            key={source.id} 
            onClick={() => onSourceClick(source.name)}
            className="bg-white rounded-xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer border border-gray-100 p-6 flex flex-col items-center text-center group relative overflow-hidden"
          >
            <div className={`absolute top-0 left-0 w-full h-1 ${source.active ? 'bg-green-500' : 'bg-gray-200'}`} />
            
            <div className="w-20 h-20 rounded-xl bg-gray-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              {source.logoUrl ? (
                <img src={source.logoUrl} alt={source.name} className="w-12 h-12 object-contain" />
              ) : (
                <Globe size={32} className="text-gray-400" />
              )}
            </div>
            
            <h3 className="font-bold text-lg text-slate-800 mb-1">{source.name}</h3>
            <p className="text-xs text-gray-400 truncate w-full mb-4 font-mono" dir="ltr">{new URL(source.url).hostname}</p>
            
            <button className="mt-auto text-sm font-medium text-blue-600 bg-blue-50 px-4 py-2 rounded-lg w-full group-hover:bg-blue-600 group-hover:text-white transition-colors">
              عرض الأخبار
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
