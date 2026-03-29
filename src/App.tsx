import { useState, useMemo, useEffect } from 'react';
import { Library, Region } from './types';
import { MOCK_LIBRARIES, REGIONS } from './constants';
import SearchBar from './components/SearchBar';
import RegionFilter from './components/RegionFilter';
import LibraryCard from './components/LibraryCard';
import LibraryDetail from './components/LibraryDetail';
import { motion, AnimatePresence } from 'motion/react';
import { Map as MapIcon, List, Info, Bell, Settings, Heart, Search as SearchIcon, Library as LibraryIcon, MapPin } from 'lucide-react';
import Map from './components/Map';
import AdBanner from './components/AdBanner';

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<Region | '전체'>('전체');
  const [selectedLibrary, setSelectedLibrary] = useState<Library | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'map' | 'favorites' | 'settings'>('home');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('library_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('library_settings');
      return saved ? JSON.parse(saved) : { notificationsEnabled: false, darkMode: false };
    } catch { return { notificationsEnabled: false, darkMode: false }; }
  });
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Get user location on mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLocationError(null);
        },
        (error) => {
          console.error('Error getting location:', error);
          if (error.code === 1) setLocationError('위치 권한 거부됨 (브라우저 또는 OS 설정 확인)');
          else if (error.code === 2) setLocationError('위치 정보를 사용할 수 없음 (Wi-Fi 켜짐 확인)');
          else if (error.code === 3) setLocationError('위치 요청 시간 초과');
          else setLocationError(`위치 에러: ${error.message}`);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: Infinity }
      );
    } else {
      setLocationError('이 브라우저는 위치 기능을 지원하지 않습니다.');
    }
  }, []);

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem('library_favorites', JSON.stringify(favorites));
  }, [favorites]);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('library_settings', JSON.stringify(settings));
  }, [settings]);

  // Fetch Live Data
  useEffect(() => {
    async function loadData() {
      try {
        // 1. Fetch live library info (Base data containing all 168+ libraries)
        const infoRes = await fetch('/api/proxy-info');
        const infoData = await infoRes.json();
        const rawLibraries = infoData?.response?.body?.items?.item || infoData?.body?.items?.item || infoData?.body?.item || infoData?.item || [];
        const rawLibsArray = Array.isArray(rawLibraries) ? rawLibraries : [rawLibraries];

        // 2. Fetch live reading room info
        let liveRoomMap: Record<string, any[]> = {};
        try {
          const rdrmRes = await fetch('/api/proxy-reading-room');
          const rdrmData = await rdrmRes.json();
          const liveItems = rdrmData?.response?.body?.items?.item || rdrmData?.body?.items?.item || rdrmData?.body?.item || rdrmData?.item || [];
          const itemsArray = Array.isArray(liveItems) ? liveItems : [liveItems];
          
          itemsArray.forEach((item: any) => {
            if (!item || !item.pblibNm) return;
            if (!liveRoomMap[item.pblibNm]) liveRoomMap[item.pblibNm] = [];
            
            liveRoomMap[item.pblibNm].push({
              id: item.rdrmId || String(Math.random()),
              name: item.rdrmNm || '열람실',
              total: parseInt(item.tseatCnt || '0', 10),
              used: parseInt(item.useSeatCnt || '0', 10),
              available: Math.max(0, parseInt(item.rmndSeatCnt || '0', 10)),
            });
          });
        } catch (err) {
          console.warn("Failed to fetch live room data.", err);
        }

        // 3. Fetch seat mapping URLs (used for iframe seating charts if available)
        let seatMapUrls: Record<string, Record<string, string>> = {};
        try {
          const seatMapRes = await fetch('/api/seat-map-proxy');
          const seatMapData: Library[] = await seatMapRes.json();
          seatMapData.forEach(lib => {
            if (!seatMapUrls[lib.name]) seatMapUrls[lib.name] = {};
            lib.rooms.forEach(room => {
              if (room.url) seatMapUrls[lib.name][room.name] = room.url;
            });
          });
        } catch (err) {
          console.warn("Failed to fetch seat map urls.", err);
        }

        // Helper to normalize regions ('서울특별시' -> '서울')
        const getRegionName = (ctpvNm: string): Region => {
          if (!ctpvNm) return '서울';
          const name = ctpvNm.substring(0, 2);
          const validRegions: Region[] = ['서울', '경기', '인천', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주', '세종', '대전', '대구', '광주', '울산', '부산'];
          if (validRegions.includes(name as Region)) return name as Region;
          if (ctpvNm.includes('전북') || ctpvNm.includes('전라북')) return '전북';
          if (ctpvNm.includes('강원')) return '강원';
          if (ctpvNm.includes('제주')) return '제주';
          return '서울'; // Fallback
        };

        // Construct Library objects
        const mergedLibs: Library[] = rawLibsArray.filter(lib => lib && lib.pblibNm).map((lib: any) => {
          const libName = lib.pblibNm;
          const liveRooms = liveRoomMap[libName] || [];
          
          let totalSeats = parseInt(lib.tseatCnt || '0', 10);
          let usedSeats = 0;
          let availableSeats = 0;

          // Process rooms
          const rooms = liveRooms.map(room => {
            const occ = room.total > 0 ? room.used / room.total : 0;
            let status: 'available' | 'busy' | 'full' = 'available';
            if (occ >= 0.9) status = 'full';
            else if (occ >= 0.7) status = 'busy';

            return {
              ...room,
              status,
              url: seatMapUrls[libName]?.[room.name] || undefined
            };
          });

          // Aggregate seats if rooms exist, otherwise fallback to base library totals
          if (rooms.length > 0) {
            totalSeats = rooms.reduce((acc, r) => acc + r.total, 0);
            usedSeats = rooms.reduce((acc, r) => acc + r.used, 0);
            availableSeats = rooms.reduce((acc, r) => acc + r.available, 0);
          } else {
            availableSeats = totalSeats; // Assume all available if no live detail is provided
          }

          return {
            id: `${lib.stdgCd || ''}-${lib.pblibId || String(Math.random())}`,
            name: libName,
            address: lib.pblibRoadNmAddr || '',
            region: getRegionName(lib.ctpvNm),
            lat: parseFloat(lib.lat || '37.5665'),
            lng: parseFloat(lib.lot || '126.9780'),
            totalSeats,
            usedSeats,
            availableSeats,
            lastUpdated: new Date().toISOString(),
            rooms,
            predictions: [], // Can add mock predictions here if needed
            homepage: lib.siteUrlAddr || undefined
          };
        });

        // If API fails entirely and returns nothing, fallback
        if (mergedLibs.length === 0) {
          throw new Error("No data returned from main API");
        }

        setLibraries(mergedLibs);
      } catch (err) {
        console.error("Failed to fetch API data:", err);
        setLibraries(MOCK_LIBRARIES);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((favId) => favId !== id) : [...prev, id]
    );
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const sortedLibraries = useMemo(() => {
    let libs = [...libraries];
    
    if (userLocation) {
      libs = libs.map(lib => ({
        ...lib,
        distance: calculateDistance(userLocation.lat, userLocation.lng, lib.lat, lib.lng)
      })).sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }
    
    return libs;
  }, [userLocation, libraries]);

  const favoriteLibraries = useMemo(() => {
    return sortedLibraries.filter((lib) => favorites.includes(lib.id));
  }, [favorites, sortedLibraries]);

  const filteredLibraries = useMemo(() => {
    return sortedLibraries.filter((lib) => {
      const matchesSearch = lib.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          lib.address.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRegion = selectedRegion === '전체' || lib.region === selectedRegion;
      return matchesSearch && matchesRegion;
    });
  }, [searchQuery, selectedRegion, sortedLibraries]);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden text-slate-900">
      {/* Top Navigation - Responsive width */}
      <header className="glass-panel sticky top-0 z-40 border-b border-white/20 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <LibraryIcon className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">모두의 열람실</h1>
          </div>
          
          {/* Desktop Search - Hidden on mobile */}
          <div className="hidden md:block flex-1 max-w-md mx-8">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>

          <div className="flex gap-3">
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors relative">
              <Bell className="h-5 w-5 text-gray-600" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <button className="md:hidden p-2 hover:bg-gray-100 rounded-full transition-colors">
              <SearchIcon className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - Responsive Grid */}
      <main className={`flex-1 overflow-y-auto ${activeTab === 'map' ? 'pb-20 md:pb-0' : 'pb-24 md:pb-8'}`}>
        <div className={`${activeTab === 'map' ? 'h-full w-full relative' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6'}`}>
          <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Mobile Search & Region Filter */}
                <section className="space-y-4 md:space-y-0 md:flex md:items-center md:justify-between">
                  <div className="md:hidden">
                    <SearchBar value={searchQuery} onChange={setSearchQuery} />
                  </div>
                  <div className="flex-1">
                    <RegionFilter selectedRegion={selectedRegion} onSelect={setSelectedRegion} />
                  </div>
                </section>

                {/* Content Header */}
                <section className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <h2 className="text-xl font-black text-slate-900">
                    {selectedRegion === '전체' ? '전국' : selectedRegion} 도서관
                    <span className="text-sm font-medium text-slate-400 ml-2">{filteredLibraries.length}개 검색됨</span>
                  </h2>
                  {locationError && (
                    <div className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg inline-flex items-center w-fit">
                      📍 {locationError}
                    </div>
                  )}
                  {userLocation && (
                    <div className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg inline-flex items-center w-fit">
                      📍 내 위치 기반 거리순 정렬 활성화
                    </div>
                  )}
                </section>

                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                    <p className="font-bold">실시간 도서관 정보를 불러오는 중...</p>
                  </div>
                ) : (
                  <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredLibraries.length > 0 ? (
                      filteredLibraries.map((lib, index) => (
                        <>
                          <LibraryCard
                            key={lib.id}
                            library={lib}
                            isFavorite={favorites.includes(lib.id)}
                            onToggleFavorite={() => toggleFavorite(lib.id)}
                            onClick={setSelectedLibrary}
                          />
                          {(index + 1) % 6 === 0 && <AdBanner key={`ad-${index}`} />}
                        </>
                      ))
                    ) : (
                      <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 space-y-4">
                        <SearchIcon className="h-12 w-12 opacity-20" />
                        <p className="font-medium">검색 결과가 없습니다.</p>
                      </div>
                    )}
                  </section>
                )}
              </motion.div>
            )}

            {activeTab === 'map' && (
              <motion.div
                key="map"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-[calc(100vh-140px)] md:h-[calc(100vh-80px)] w-full bg-slate-50 overflow-hidden relative rounded-3xl shadow-inner border border-white/40"
              >
                <div className="absolute inset-0 z-0">
                  <Map libraries={filteredLibraries} />
                </div>
                
                
                {/* Map Overlay Controls - Bubble buttons */}
                <div className="absolute top-4 left-0 right-0 z-10 px-4 pointer-events-none">
                  <div className="pointer-events-auto max-w-7xl mx-auto">
                    <RegionFilter selectedRegion={selectedRegion} onSelect={setSelectedRegion} />
                  </div>
                </div>

                {/* Map Action Buttons */}
                <div className="absolute bottom-24 md:bottom-8 right-4 z-10 flex flex-col gap-2 pointer-events-auto">
                  <button className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-600 hover:text-blue-600 transition-colors">
                    <MapPin className="h-6 w-6" />
                  </button>
                  <button className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-600 hover:text-blue-600 transition-colors">
                    <SearchIcon className="h-6 w-6" />
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'favorites' && (
              <motion.div
                key="favorites"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <h2 className="text-2xl font-black text-gray-900">찜한 도서관</h2>
                {favoriteLibraries.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {favoriteLibraries.map((lib) => (
                      <LibraryCard
                        key={lib.id}
                        library={lib}
                        isFavorite={true}
                        onToggleFavorite={() => toggleFavorite(lib.id)}
                        onClick={setSelectedLibrary}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                    <div className="w-20 h-20 bg-pink-50 rounded-full flex items-center justify-center">
                      <Heart className="h-10 w-10 text-pink-500" />
                    </div>
                    <h2 className="text-xl font-black text-gray-900">찜한 도서관이 없습니다</h2>
                    <p className="text-gray-500 text-sm max-w-[200px] mx-auto">
                      자주 방문하는 도서관을 찜해서 빠르게 확인해 보세요!
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-2xl mx-auto space-y-6"
              >
                <h2 className="text-2xl font-black text-gray-900">설정</h2>
                <div className="bg-white rounded-3xl p-2 shadow-sm border border-gray-100 overflow-hidden">
                  <div className="w-full flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-xl">
                        <Bell className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900">알림 설정</span>
                        <span className="text-xs text-gray-500">좌석 여유 시 알림을 받습니다.</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setSettings(prev => ({ ...prev, notificationsEnabled: !prev.notificationsEnabled }))}
                      className={`w-12 h-6 rounded-full transition-colors relative ${settings.notificationsEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                    >
                      <motion.div
                        animate={{ x: settings.notificationsEnabled ? 24 : 4 }}
                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                      />
                    </button>
                  </div>
                  <div className="h-px bg-gray-50 mx-4" />
                  <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-50 rounded-xl">
                        <Settings className="h-5 w-5 text-gray-600" />
                      </div>
                      <span className="font-bold text-gray-900">앱 정보</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom Navigation Bar - Centered on PC */}
      <nav className="fixed bottom-0 left-0 right-0 glass-panel border-t border-white/20 z-40 pb-safe">
        <div className="max-w-lg mx-auto px-8 py-4 flex justify-between items-center">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'home' ? 'text-blue-600 scale-110' : 'text-gray-400'}`}
          >
            <div className={`p-1 rounded-xl ${activeTab === 'home' ? 'bg-blue-50' : ''}`}>
              <List className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">목록</span>
          </button>
          
          <button
            onClick={() => setActiveTab('map')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'map' ? 'text-blue-600 scale-110' : 'text-slate-400'}`}
          >
            <div className={`p-1 rounded-xl ${activeTab === 'map' ? 'bg-blue-50/80 shadow-inner' : ''}`}>
              <MapIcon className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">지도</span>
          </button>

          <button
            onClick={() => setActiveTab('favorites')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'favorites' ? 'text-pink-500 scale-110' : 'text-gray-400'}`}
          >
            <div className={`p-1 rounded-xl ${activeTab === 'favorites' ? 'bg-pink-50' : ''}`}>
              <Heart className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">찜</span>
          </button>
          
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'settings' ? 'text-gray-900 scale-110' : 'text-gray-400'}`}
          >
            <div className={`p-1 rounded-xl ${activeTab === 'settings' ? 'bg-gray-100' : ''}`}>
              <Settings className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">설정</span>
          </button>
        </div>
      </nav>

      {/* Library Detail Overlay - Responsive width */}
      <AnimatePresence>
        {selectedLibrary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 bg-white">
            <div className="w-full h-full md:max-w-2xl md:h-[90vh] md:rounded-3xl overflow-hidden shadow-2xl">
              <LibraryDetail
                library={selectedLibrary}
                isFavorite={favorites.includes(selectedLibrary.id)}
                onToggleFavorite={() => toggleFavorite(selectedLibrary.id)}
                onBack={() => setSelectedLibrary(null)}
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
