
import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, RefreshCcw, LogIn, Search, Loader2, Filter, SortAsc, Newspaper, Calendar, Clock, History, CheckCircle2, Globe, Timer, LayoutGrid, List, AlignJustify } from 'lucide-react';
import { NewsItem, ViewState, ADMIN_USER, ADMIN_PASS, Source, LayoutMode } from './types';
import { NewsCard } from './components/NewsCard';
import { ArticleModal } from './components/ArticleModal';
import { AdminDashboard } from './components/AdminDashboard';
import { getNews, saveNews, getSources, incrementViewCount } from './services/storageService';
import { fetchRawRSS, enhanceNewsBatch } from './services/geminiService';
import { SourcesView } from './components/SourcesView';

// --- Utility: Similarity Checker ---
const calculateSimilarity = (str1: string, str2: string): number => {
  if (!str1 || !str2) return 0;

  // Clean and tokenize text (Arabic & English support)
  const tokenize = (text: string) => {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^\u0600-\u06FFa-z0-9\s]/g, '') // Keep Arabic, English, Numbers
        .split(/\s+/)
        .filter(w => w.length > 2) // Filter short words like "in", "on", "fi"
    );
  };

  const tokens1 = tokenize(str1);
  const tokens2 = tokenize(str2);

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  // Calculate intersection
  let intersection = 0;
  tokens1.forEach(token => {
    if (tokens2.has(token)) intersection++;
  });

  // Dice Coefficient: (2 * intersection) / (set1 + set2)
  return (2.0 * intersection) / (tokens1.size + tokens2.size);
};

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('feed');
  const [layout, setLayout] = useState<LayoutMode>('grid');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true); // Initial loading true
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<NewsItem | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(300); // 300 seconds = 5 minutes
  
  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Filter/Sort State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'latest' | 'popular' | 'urgent'>('latest');
  const [timeFilter, setTimeFilter] = useState<'auto' | '24h' | 'week' | 'all'>('auto');

  const newsRef = useRef<NewsItem[]>([]);

  // 1. Initial Load from Database
  useEffect(() => {
    const initData = async () => {
      setLoadingStatus('جاري تحميل الأخبار المحفوظة...');
      const [loadedNews, loadedSources] = await Promise.all([
        getNews(),
        getSources()
      ]);
      
      setNews(loadedNews);
      setSources(loadedSources);
      newsRef.current = loadedNews;
      setLoading(false);
      setLoadingStatus('');

      // If DB is empty, auto-fetch
      if (loadedNews.length === 0) {
        handleFetchNews();
      }
    };
    initData();
  }, []);

  // Countdown Timer Logic
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Trigger update
          handleFetchNews(true);
          return 300; // Reset to 5 mins
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    newsRef.current = news;
  }, [news]);

  // Loading Progress Logic
  useEffect(() => {
    let progressInterval: any;
    if (loading) {
      setLoadingProgress(10);
      progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 5;
        });
      }, 300);
    } else {
      setLoadingProgress(100);
      setTimeout(() => setLoadingProgress(0), 500);
    }
    return () => clearInterval(progressInterval);
  }, [loading]);

  const handleFetchNews = async (isAutoUpdate = false) => {
    if (!isAutoUpdate) {
        setLoading(true);
        setLoadingStatus('الاتصال بالمصادر...');
        setTimeRemaining(300); // Reset timer on manual update
    }
    
    try {
      const currentSources = await getSources();
      setSources(currentSources); // Update sources state
      const activeSources = currentSources.filter(s => s.active);
      
      if (activeSources.length === 0 && !isAutoUpdate) {
        alert("يرجى إضافة مصادر.");
        setLoading(false);
        return;
      }

      // 1. Fetch RAW RSS (Fast)
      const rawItems = await fetchRawRSS(activeSources);
      
      const currentNews = newsRef.current;
      // Use Set for O(1) lookup based on exact ID/URL first
      const existingIds = new Set(currentNews.map(n => n.id));
      
      // Step A: Exact ID Filter
      const candidates = rawItems.filter(item => !existingIds.has(item.id));
      
      // Step B: Content Similarity Deduplication (>60% match)
      const uniqueNewItems: NewsItem[] = [];
      
      // Optimization: Only compare against recent news (last 3 days) to save performance
      const recentNewsCutoff = new Date();
      recentNewsCutoff.setDate(recentNewsCutoff.getDate() - 3);
      const recentExistingNews = currentNews.filter(n => new Date(n.publishedAt) > recentNewsCutoff);

      if (candidates.length > 0 && !isAutoUpdate) {
          setLoadingStatus('جاري فحص التطابق وإزالة التكرار...');
      }

      for (const item of candidates) {
          const itemText = item.title + " " + item.summary;
          
          // 1. Check against existing recent news
          const isDuplicateOfExisting = recentExistingNews.some(existing => {
              const existingText = existing.title + " " + existing.summary;
              const sim = calculateSimilarity(itemText, existingText);
              return sim > 0.6; // 60% threshold
          });

          // 2. Check against items already added in this batch (prevent duplicates within same fetch)
          const isDuplicateOfBatch = uniqueNewItems.some(added => {
              const addedText = added.title + " " + added.summary;
              const sim = calculateSimilarity(itemText, addedText);
              return sim > 0.6;
          });

          if (!isDuplicateOfExisting && !isDuplicateOfBatch) {
              uniqueNewItems.push(item);
          }
      }
      
      if (uniqueNewItems.length > 0) {
        if (!isAutoUpdate) setLoadingStatus(`تم العثور على ${uniqueNewItems.length} خبر جديد وحصري. جاري الحفظ...`);
        
        // 2. Save RAW items immediately so user sees them
        // Merge new on top
        const mergedList = [...uniqueNewItems, ...currentNews];
        setNews(mergedList);
        await saveNews(uniqueNewItems); // Append new items to DB
        
        // 3. Background AI Enhancement
        if (!isAutoUpdate) setLoadingStatus('جاري تحليل المحتوى بالذكاء الاصطناعي...');
        
        // Process in small batches to not lock UI
        const enhancedItems = await enhanceNewsBatch(uniqueNewItems);
        
        // Update state with enhanced items
        setNews(prev => prev.map(pItem => {
            const enhanced = enhancedItems.find(e => e.id === pItem.id);
            return enhanced || pItem;
        }));

        // Save enhanced versions to DB
        await saveNews(enhancedItems);
      } else {
        if (!isAutoUpdate) setLoadingStatus('لا توجد أخبار جديدة (تم استبعاد المكرر).');
        console.log("No new unique news found");
      }

    } catch (error) {
      console.error(error);
      if (!isAutoUpdate) alert("حدث خطأ في التحديث");
    } finally {
      setLoading(false);
      setLoadingStatus('');
    }
  };

  const handleArticleClick = async (item: NewsItem) => {
    // Optimistic update
    setSelectedArticle({ ...item, views: (item.views || 0) + 1 });
    
    const updatedList = news.map(n => n.id === item.id ? { ...n, views: (n.views || 0) + 1 } : n);
    setNews(updatedList);
    
    // DB Update
    await incrementViewCount(item.id);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() === ADMIN_USER && password.trim() === ADMIN_PASS) {
      setView('admin-dashboard');
      setUsername('');
      setPassword('');
      setLoginError('');
    } else {
      setLoginError('بيانات غير صحيحة');
    }
  };

  const handleLogout = async () => {
    setView('feed');
    // Refresh sources when coming back from admin dashboard
    const loadedSources = await getSources();
    setSources(loadedSources);
  };

  const handleSourceSelect = (sourceName: string) => {
      setSelectedSourceFilter(sourceName);
      setView('feed');
  };

  // --- Filtering Logic ---
  const today = new Date();
  
  const isSameDay = (d1: Date, d2: Date) => 
    d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
  
  const isYesterday = (d1: Date, d2: Date) => {
    const y = new Date(d2); y.setDate(y.getDate() - 1);
    return isSameDay(d1, y);
  };

  // Determine if we should show yesterday's news in auto mode
  const todaysNewsCount = news.filter(item => isSameDay(new Date(item.publishedAt), today)).length;
  const showYesterday = todaysNewsCount < 5;

  // 1. First, apply Time and Search filters
  const filteredByTimeAndSearch = news.filter(item => {
    // Time Filter
    const pubDate = new Date(item.publishedAt);
    const isToday = isSameDay(pubDate, today);
    let dateMatch = true;

    switch (timeFilter) {
      case 'auto': dateMatch = showYesterday ? (isToday || isYesterday(pubDate, today)) : isToday; break;
      case '24h': dateMatch = (today.getTime() - pubDate.getTime()) <= 86400000; break;
      case 'week': dateMatch = (today.getTime() - pubDate.getTime()) <= 604800000; break;
      case 'all': dateMatch = true; break;
    }
    if (!dateMatch) return false;

    // Search Filter
    const matchesSearch = searchTerm === '' || 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.summary.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  // 2. Generate stats for Sources based on the Time/Search filtered results
  // This ensures we only show sources that have news in the current view
  const sourceStats = filteredByTimeAndSearch.reduce((acc, item) => {
    acc[item.sourceName] = (acc[item.sourceName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedSourceNames = Object.keys(sourceStats).sort((a, b) => sourceStats[b] - sourceStats[a]);

  // 3. Finally, apply Source filter to get the display list
  const processedNews = filteredByTimeAndSearch
    .filter(item => {
      if (!selectedSourceFilter) return true;
      return item.sourceName === selectedSourceFilter;
    })
    .sort((a, b) => {
      if (sortBy === 'urgent') {
        const isAUrgent = a.tags.includes('عاجل') || a.title.includes('عاجل');
        const isBUrgent = b.tags.includes('عاجل') || b.title.includes('عاجل');
        if (isAUrgent && !isBUrgent) return -1;
        if (!isAUrgent && isBUrgent) return 1;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      }
      if (sortBy === 'popular') return (b.views || 0) - (a.views || 0);
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

  // Helper to find logo for a source name
  const getSourceLogo = (name: string) => {
    const s = sources.find(src => src.name === name);
    return s?.logoUrl;
  };

  const formatTime = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const maxViews = Math.max(...news.map(n => n.views || 0), 0);
  const trendingThreshold = maxViews > 5 ? maxViews * 0.6 : 10;

  return (
    <div className="min-h-screen bg-gray-50 pb-10 flex flex-col font-sans">
      {/* Progress Bar */}
      <div className={`fixed top-0 left-0 w-full h-1 z-50 bg-transparent transition-opacity ${loading ? 'opacity-100' : 'opacity-0'}`}>
         <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${loadingProgress}%` }} />
      </div>

      <header className="bg-white shadow-sm sticky top-0 z-30 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('feed')}>
            <div className="w-8 h-8 bg-red-700 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-md">Y</div>
            <h1 className="text-xl font-bold text-slate-800 hidden sm:block">راصد اليمن <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Database</span></h1>
          </div>
          
          <nav className="hidden md:flex gap-1 mx-4">
             <button 
               onClick={() => setView('feed')} 
               className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'feed' ? 'bg-slate-100 text-slate-900' : 'text-gray-500 hover:text-slate-700'}`}
             >
               الرئيسية
             </button>
             <button 
               onClick={() => setView('sources-view')} 
               className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'sources-view' ? 'bg-slate-100 text-slate-900' : 'text-gray-500 hover:text-slate-700'}`}
             >
               المصادر
             </button>
          </nav>

          <div className="flex-1 max-w-xs md:max-w-md mx-2 md:mx-4">
             {(view === 'feed' || view === 'sources-view') && (
               <div className="relative group">
                 <input 
                   type="text" placeholder="بحث في الأخبار..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                   className="w-full bg-gray-100 focus:bg-white border border-transparent focus:border-red-200 rounded-full py-2 pr-10 pl-4 outline-none text-sm transition-all"
                 />
                 <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
               </div>
             )}
          </div>

          <div className="flex items-center gap-2">
             {view === 'feed' && (
               <>
                 {/* Auto Update Countdown */}
                 <div className="hidden lg:flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-100 whitespace-nowrap" title="الوقت المتبقي للتحديث التلقائي">
                    <span className="text-gray-400">تحديث:</span>
                    <span className="font-mono text-blue-600 w-9 text-center">{formatTime(timeRemaining)}</span>
                 </div>

                 <button onClick={() => handleFetchNews(false)} disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-full text-sm hover:bg-slate-800 transition-all disabled:opacity-70 shadow-sm whitespace-nowrap"
                 >
                   {loading ? <Loader2 className="animate-spin" size={16}/> : <RefreshCcw size={16} />}
                   <span className="hidden sm:inline">تحديث</span>
                 </button>
               </>
             )}
             {view !== 'admin-dashboard' && (
               <button onClick={() => setView('admin-login')} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full" title="دخول المدير">
                 <LayoutDashboard size={20} />
               </button>
             )}
          </div>
        </div>
        
        {view === 'feed' && (
          <div className="border-t border-gray-50 bg-white/80 backdrop-blur-sm">
             <div className="max-w-7xl mx-auto px-4 py-2 flex flex-col xl:flex-row gap-4 justify-between items-center overflow-x-auto">
               
               {/* Source Filter Bar */}
               <div className="flex items-center gap-2 w-full overflow-x-auto pb-2 xl:pb-0 scrollbar-hide">
                  <div className="flex items-center gap-1 text-gray-400 shrink-0 border-l pl-2 ml-1">
                    <Filter size={14} />
                    <span className="text-xs font-medium">المصادر:</span>
                  </div>
                  
                  <button 
                    onClick={() => setSelectedSourceFilter(null)} 
                    className={`
                      flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-all border
                      ${!selectedSourceFilter 
                        ? 'bg-slate-800 text-white border-slate-800 shadow-sm' 
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                    `}
                  >
                    <span>الكل</span>
                    <span className="bg-white/20 px-1.5 rounded-full text-[10px] min-w-[1.2em] text-center">
                      {filteredByTimeAndSearch.length}
                    </span>
                  </button>

                  {sortedSourceNames.map(sourceName => {
                    const logo = getSourceLogo(sourceName);
                    const count = sourceStats[sourceName];
                    const isActive = selectedSourceFilter === sourceName;
                    
                    return (
                      <button 
                        key={sourceName} 
                        onClick={() => setSelectedSourceFilter(sourceName)} 
                        className={`
                          flex items-center gap-2 text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-all border
                          ${isActive 
                            ? 'bg-slate-800 text-white border-slate-800 shadow-sm' 
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                        `}
                      >
                        {logo ? (
                          <img src={logo} alt="" className="w-3.5 h-3.5 object-contain rounded-sm" />
                        ) : (
                          <Globe size={12} />
                        )}
                        <span>{sourceName}</span>
                        <span className={`px-1.5 rounded-full text-[10px] min-w-[1.2em] text-center ${isActive ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
               </div>
               
               {/* Controls Section: Time, Sort, Layout */}
               <div className="flex items-center gap-3 shrink-0">
                  {/* Time Filter */}
                  <div className="flex bg-gray-100 rounded-lg p-1">
                     {['auto', '24h', 'week', 'all'].map((t) => (
                       <button key={t} onClick={() => setTimeFilter(t as any)} 
                         className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${timeFilter === t ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                       >
                         {t === 'auto' ? 'تلقائي' : t === '24h' ? '24 ساعة' : t === 'week' ? 'أسبوع' : 'الكل'}
                       </button>
                     ))}
                  </div>
                  
                  {/* Sort Filter */}
                  <div className="flex bg-gray-100 rounded-lg p-1">
                     <button onClick={() => setSortBy('latest')} title="الأحدث" className={`px-2 py-1 rounded text-xs transition-all ${sortBy === 'latest' ? 'bg-white shadow text-slate-800' : 'text-gray-500 hover:text-gray-700'}`}><SortAsc size={16}/></button>
                     <button onClick={() => setSortBy('popular')} title="الأكثر قراءة" className={`px-2 py-1 rounded text-xs transition-all ${sortBy === 'popular' ? 'bg-white shadow text-amber-600' : 'text-gray-500 hover:text-gray-700'}`}>🔥</button>
                     <button onClick={() => setSortBy('urgent')} title="أخبار عاجلة" className={`px-2 py-1 rounded text-xs transition-all ${sortBy === 'urgent' ? 'bg-white shadow text-red-600' : 'text-gray-500 hover:text-gray-700'}`}>⚠️</button>
                  </div>

                  {/* Layout Toggles */}
                  <div className="flex bg-gray-100 rounded-lg p-1 hidden sm:flex">
                     <button onClick={() => setLayout('grid')} title="شبكة" className={`px-2 py-1 rounded text-xs transition-all ${layout === 'grid' ? 'bg-white shadow text-slate-800' : 'text-gray-500 hover:text-gray-700'}`}><LayoutGrid size={16}/></button>
                     <button onClick={() => setLayout('list')} title="قائمة" className={`px-2 py-1 rounded text-xs transition-all ${layout === 'list' ? 'bg-white shadow text-slate-800' : 'text-gray-500 hover:text-gray-700'}`}><List size={16}/></button>
                     <button onClick={() => setLayout('compact')} title="مضغوط" className={`px-2 py-1 rounded text-xs transition-all ${layout === 'compact' ? 'bg-white shadow text-slate-800' : 'text-gray-500 hover:text-gray-700'}`}><AlignJustify size={16}/></button>
                  </div>
               </div>
             </div>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-grow">
        {view === 'feed' && (
          <>
            {loadingStatus && (
                <div className="flex items-center justify-center gap-2 mb-6 text-sm text-blue-600 bg-blue-50 py-2 rounded-lg animate-pulse">
                    <Loader2 size={16} className="animate-spin" />
                    {loadingStatus}
                </div>
            )}

            {!loading && processedNews.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                    <Newspaper size={40} className="mx-auto mb-4 opacity-20"/>
                    <p>لا توجد أخبار للعرض حالياً</p>
                    {selectedSourceFilter && (
                      <button onClick={() => setSelectedSourceFilter(null)} className="mt-2 text-sm text-blue-600 hover:underline">
                        إلغاء فلتر المصدر
                      </button>
                    )}
                    <br />
                    <button onClick={() => handleFetchNews(false)} className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-full text-sm">جلب الأخبار</button>
                </div>
            ) : (
                <div className={`grid gap-6 ${
                  layout === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 
                  layout === 'list' ? 'grid-cols-1 lg:grid-cols-2' : 
                  'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' /* Compact uses grid but cards are small */
                }`}>
                {processedNews.map(item => (
                    <NewsCard key={item.id} item={item} onClick={handleArticleClick} trendingThreshold={trendingThreshold} layout={layout} />
                ))}
                </div>
            )}
          </>
        )}

        {view === 'sources-view' && (
            <SourcesView sources={sources} onSourceClick={handleSourceSelect} />
        )}

        {view === 'admin-login' && (
          <div className="flex justify-center items-center h-[60vh]">
            <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm">
                <h2 className="text-xl font-bold mb-6 text-center">دخول المدير</h2>
                <input type="text" dir="ltr" value={username} onChange={e => setUsername(e.target.value)} className="w-full mb-3 p-2 border rounded" placeholder="User" />
                <input type="password" dir="ltr" value={password} onChange={e => setPassword(e.target.value)} className="w-full mb-4 p-2 border rounded" placeholder="Pass" />
                {loginError && <p className="text-red-500 text-xs mb-3">{loginError}</p>}
                <button className="w-full bg-slate-900 text-white py-2 rounded hover:bg-slate-800">دخول</button>
                <button onClick={() => setView('feed')} type="button" className="w-full mt-2 text-sm text-gray-400">عودة</button>
            </form>
          </div>
        )}

        {view === 'admin-dashboard' && <AdminDashboard onLogout={handleLogout} />}
      </main>

      <ArticleModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />
    </div>
  );
};

export default App;
