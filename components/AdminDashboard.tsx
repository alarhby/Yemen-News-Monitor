
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Globe, Save, LogOut, Info, ChevronDown, ChevronUp, Eye, Loader2, X, Pencil, RotateCcw, Activity, AlertTriangle, Code } from 'lucide-react';
import { Source, NewsItem } from '../types';
import { getSources, saveSources } from '../services/storageService';
import { fetchRawRSS, checkSourcesHealth, SourceHealth } from '../services/geminiService';

interface AdminDashboardProps {
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [sources, setSources] = useState<Source[]>([]);
  const [showTips, setShowTips] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newSource, setNewSource] = useState<{name: string, url: string, logoUrl: string, contentSelector: string, type: 'url' | 'rss' | 'xml'}>({
    name: '',
    url: '',
    logoUrl: '',
    contentSelector: '',
    type: 'rss'
  });

  // Testing & Health Check State
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<NewsItem[] | null>(null);
  
  // Bulk Check State
  const [checkingAll, setCheckingAll] = useState(false);
  const [healthStats, setHealthStats] = useState<Record<string, SourceHealth>>({});
  const [emptySources, setEmptySources] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
        const s = await getSources();
        setSources(s);
        setLoading(false);
    };
    load();
  }, []);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setNewSource(prev => {
      let logoUrl = prev.logoUrl;
      if (url && !logoUrl) {
        try {
          const domain = new URL(url).hostname;
          logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
        } catch (e) {}
      }
      return { ...prev, url, logoUrl };
    });
  };

  const handleSubmitSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSource.name || !newSource.url) return;

    let updatedSources: Source[];

    if (editingId) {
      // Update existing
      updatedSources = sources.map(s => s.id === editingId ? {
        ...s,
        name: newSource.name,
        url: newSource.url,
        logoUrl: newSource.logoUrl,
        contentSelector: newSource.contentSelector,
        type: newSource.type
      } : s);
      setEditingId(null);
    } else {
      // Create new
      const source: Source = {
        id: Date.now().toString(),
        name: newSource.name,
        url: newSource.url,
        logoUrl: newSource.logoUrl,
        contentSelector: newSource.contentSelector,
        type: newSource.type,
        active: true,
      };
      updatedSources = [...sources, source];
    }

    setSources(updatedSources);
    await saveSources(updatedSources);
    setNewSource({ name: '', url: '', logoUrl: '', contentSelector: '', type: 'rss' });
  };

  const handleEditClick = (source: Source) => {
    setEditingId(source.id);
    setNewSource({
      name: source.name,
      url: source.url,
      logoUrl: source.logoUrl || '',
      contentSelector: source.contentSelector || '',
      type: source.type
    });
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNewSource({ name: '', url: '', logoUrl: '', contentSelector: '', type: 'rss' });
  };

  const removeSource = async (id: string) => {
    if(!confirm('هل أنت متأكد من حذف هذا المصدر؟')) return;
    const updated = sources.filter(s => s.id !== id);
    setSources(updated);
    await saveSources(updated);
    if (editingId === id) handleCancelEdit();
  };

  const toggleSource = async (id: string) => {
    const updated = sources.map(s => s.id === id ? { ...s, active: !s.active } : s);
    setSources(updated);
    await saveSources(updated);
  };

  const handleTestSource = async (source: Source) => {
    setIsTesting(true);
    setTestResult(null);
    try {
      // Use raw fetch for testing to be fast
      const results = await fetchRawRSS([source]);
      setTestResult(results);
    } catch (error) {
      alert("فشل جلب الأخبار.");
    } finally {
      setIsTesting(false);
    }
  };

  const handleCheckAll = async () => {
    setCheckingAll(true);
    setHealthStats({});
    setEmptySources([]);
    
    try {
      const activeSources = sources.filter(s => s.active);
      const results = await checkSourcesHealth(activeSources);
      
      const statsMap: Record<string, SourceHealth> = {};
      const emptyIds: string[] = [];

      results.forEach(r => {
        statsMap[r.sourceId] = r;
        if (r.status === 'empty' || r.status === 'error') {
            emptyIds.push(r.sourceId);
        }
      });
      
      setHealthStats(statsMap);
      setEmptySources(emptyIds);

    } catch (e) {
      alert("حدث خطأ أثناء الفحص");
    } finally {
      setCheckingAll(false);
    }
  };

  if (loading) return <div className="p-10 text-center">جاري التحميل...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 relative">
      
      {/* Test Result Modal */}
      {testResult !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
             <div className="p-4 border-b flex justify-between">
               <h3 className="font-bold">نتائج الاختبار ({testResult.length})</h3>
               <button onClick={() => setTestResult(null)}><X size={20} /></button>
             </div>
             <div className="p-4 overflow-y-auto flex-1 bg-gray-50 space-y-4">
                 {testResult.map((item, idx) => (
                     <div key={idx} className="bg-white p-3 rounded shadow-sm text-sm">
                         <div className="font-bold">{item.title}</div>
                         <div className="text-gray-500 text-xs mt-1">{item.originalUrl}</div>
                         <div className="mt-2 text-xs text-gray-400 bg-gray-50 p-2 rounded max-h-20 overflow-hidden">
                             {item.content.substring(0, 150)}...
                         </div>
                     </div>
                 ))}
                 {testResult.length === 0 && <p className="text-center text-gray-500">لا توجد أخبار</p>}
             </div>
          </div>
        </div>
      )}

      {isTesting && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-white/80">
          <Loader2 size={40} className="text-blue-600 animate-spin mb-4" />
          <p>جاري اختبار المصدر...</p>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-3xl font-bold text-slate-800">لوحة التحكم</h2>
           <p className="text-gray-500">إدارة المصادر ومراقبة الحالة</p>
        </div>
        <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
          <LogOut size={18} /> خروج
        </button>
      </div>

      {/* Alert for Empty Sources */}
      {emptySources.length > 0 && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="text-amber-600 shrink-0 mt-1" size={20} />
              <div>
                  <h4 className="font-bold text-amber-800">تنبيه: بعض المصادر لا تعمل أو فارغة</h4>
                  <ul className="text-sm text-amber-700 list-disc list-inside mt-1">
                      {emptySources.map(id => {
                          const s = sources.find(src => src.id === id);
                          return s ? <li key={id}>{s.name}</li> : null;
                      })}
                  </ul>
              </div>
          </div>
      )}

      <div className="mb-8 bg-blue-50 rounded-xl border border-blue-100 overflow-hidden">
        <button onClick={() => setShowTips(!showTips)} className="w-full flex items-center justify-between p-4 text-blue-800 font-bold hover:bg-blue-100">
          <div className="flex items-center gap-2"><Info size={20} /> مساعدة</div>
          {showTips ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        {showTips && (
          <div className="p-4 pt-0 text-blue-700 text-sm border-t border-blue-100">
            <p className="mb-2">يمكنك الآن تعديل المصادر بالضغط على زر القلم.</p>
            <p className="mb-2"><strong>محدد المحتوى (CSS Selector / XPath):</strong> هذا الخيار للمحترفين. إذا كان الخبر يظهر ناقصاً، قم بزيارة الموقع الأصلي، واستخدم "فحص العنصر" لنسخ المسار (XPath) أو الـ Class وضعه هنا.</p>
            <p className="mb-2 text-xs font-mono bg-blue-100 p-1 inline-block rounded">مثال: //div[@class='details'] أو #content</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Form Section */}
        <div className="md:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 sticky top-6">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                {editingId ? <Pencil size={20} /> : <Plus size={20} />} 
                {editingId ? 'تعديل المصدر' : 'إضافة مصدر'}
            </h3>
            <form onSubmit={handleSubmitSource} className="space-y-4">
              <input type="text" value={newSource.name} onChange={e => setNewSource({...newSource, name: e.target.value})} placeholder="الاسم" className="w-full p-2 border rounded" required />
              
              <div className="space-y-1">
                <label className="text-xs text-gray-500">رابط المصدر (RSS):</label>
                <input type="url" dir="ltr" value={newSource.url} onChange={handleUrlChange} placeholder="https://example.com/rss" className="w-full p-2 border rounded text-left" required />
              </div>
              
              <div className="space-y-1">
                <label className="text-xs text-gray-500">رابط الشعار (اختياري):</label>
                <input type="url" dir="ltr" value={newSource.logoUrl} onChange={e => setNewSource({...newSource, logoUrl: e.target.value})} placeholder="https://..." className="w-full p-2 border rounded text-left text-sm" />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-500 flex items-center gap-1"><Code size={12}/> محدد المحتوى (CSS / XPath) - اختياري:</label>
                <input type="text" dir="ltr" value={newSource.contentSelector} onChange={e => setNewSource({...newSource, contentSelector: e.target.value})} placeholder="مثال: /html/body/... أو .content" className="w-full p-2 border rounded text-left text-sm font-mono bg-gray-50" />
              </div>
              
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded flex justify-center items-center gap-2 hover:bg-blue-700 transition">
                    <Save size={18} /> {editingId ? 'تحديث' : 'حفظ'}
                </button>
                {editingId && (
                    <button type="button" onClick={handleCancelEdit} className="px-3 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
                        إلغاء
                    </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* List Section */}
        <div className="md:col-span-2 space-y-4">
             {/* Bulk Action Header */}
             <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="font-bold text-slate-700">قائمة المصادر ({sources.length})</span>
                <button 
                    onClick={handleCheckAll} 
                    disabled={checkingAll}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                    {checkingAll ? <Loader2 size={16} className="animate-spin"/> : <Activity size={16} />}
                    فحص شامل
                </button>
             </div>

             {sources.map(source => {
               const stats = healthStats[source.id];
               return (
               <div key={source.id} className={`bg-white p-4 rounded-xl shadow-sm border flex items-center justify-between transition-colors ${editingId === source.id ? 'border-blue-500 ring-1 ring-blue-100' : 'border-gray-100'}`}>
                 <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded bg-gray-50 flex items-center justify-center shrink-0 relative">
                     {source.logoUrl ? <img src={source.logoUrl} className="w-6 h-6 object-contain" /> : <Globe size={20} />}
                     {/* Active Indicator */}
                     <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${source.active ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                   </div>
                   <div>
                     <div className="flex items-center gap-2">
                        <h4 className="font-bold text-gray-800">{source.name}</h4>
                        {/* Status Badge */}
                        {stats && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                stats.status === 'success' ? 'bg-green-100 text-green-700' : 
                                stats.status === 'empty' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                            }`}>
                                {stats.status === 'error' ? 'خطأ' : `${stats.count} خبر`}
                            </span>
                        )}
                     </div>
                     <div className="flex flex-col gap-0.5">
                        <p dir="ltr" className="text-xs text-gray-400 truncate max-w-[200px] text-left">{source.url}</p>
                        {source.contentSelector && (
                            <p dir="ltr" className="text-[10px] text-blue-500 font-mono text-left max-w-[200px] truncate">Selector: {source.contentSelector}</p>
                        )}
                     </div>
                   </div>
                 </div>
                 <div className="flex items-center gap-1">
                    <button onClick={() => handleTestSource(source)} title="عرض الأخبار" className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded"><Eye size={18} /></button>
                    <button onClick={() => handleEditClick(source)} title="تعديل" className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"><Pencil size={18} /></button>
                    <button onClick={() => toggleSource(source.id)} title={source.active ? "تعطيل" : "تفعيل"} className={`p-2 rounded hover:bg-gray-100 ${source.active ? 'text-green-500' : 'text-gray-300'}`}>
                        <RotateCcw size={18} className={source.active ? "" : "rotate-180"}/>
                    </button>
                    <button onClick={() => removeSource(source.id)} title="حذف" className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={18} /></button>
                 </div>
               </div>
             )})}
        </div>
      </div>
    </div>
  );
};
