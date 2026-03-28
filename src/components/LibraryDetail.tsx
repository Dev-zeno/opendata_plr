import { Library, ReadingRoom } from '../types';
import { MapPin, Clock, ArrowLeft, Share2, Heart, ExternalLink, X, Loader2, Info, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useState } from 'react';
import CongestionStats from './CongestionStats';

interface LibraryDetailProps {
  library: Library;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onBack: () => void;
}

export default function LibraryDetail({ library, isFavorite, onToggleFavorite, onBack }: LibraryDetailProps) {
  const [activeRoomUrl, setActiveRoomUrl] = useState<string | null>(null);
  const [isLoadingProxy, setIsLoadingProxy] = useState(false);
  const occupancy = library.totalSeats > 0 ? (library.usedSeats / library.totalSeats) * 100 : 0;
  
  const data = [
    { name: '사용 중', value: library.usedSeats, color: '#3b82f6' },
    { name: '잔여 좌석', value: library.availableSeats, color: '#e5e7eb' },
  ];

  const getRoomStatusColor = (room: ReadingRoom) => {
    const occ = room.total > 0 ? (room.used / room.total) * 100 : 0;
    if (occ >= 90) return 'text-red-500 bg-red-50 border-red-100';
    if (occ >= 70) return 'text-yellow-600 bg-yellow-50 border-yellow-100';
    return 'text-green-600 bg-green-50 border-green-100';
  };

  const getRoomStatusText = (room: ReadingRoom) => {
    const occ = room.total > 0 ? (room.used / room.total) * 100 : 0;
    if (occ >= 90) return '만석';
    if (occ >= 70) return '혼잡';
    return '여유';
  };

  const handleRoomClick = (room: ReadingRoom) => {
    if (room.url) {
      setActiveRoomUrl(room.url);
      setIsLoadingProxy(true);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className="fixed inset-0 bg-slate-50/50 backdrop-blur-xl z-50 overflow-y-auto flex flex-col"
    >
      {/* Header */}
      <header className="sticky top-0 glass-panel border-b border-white/20 px-6 py-4 flex items-center justify-between z-10">
        <button onClick={onBack} className="p-2 -ml-2 glass-panel rounded-full hover:bg-white/60 transition-colors shadow-sm">
          <ArrowLeft className="h-6 w-6 text-slate-800" />
        </button>
        <h2 className="text-xl font-black text-slate-900 truncate max-w-[200px] tracking-tight">{library.name}</h2>
        <div className="flex gap-2">
          <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <Share2 className="h-5 w-5 text-gray-600" />
          </button>
          <button
            onClick={onToggleFavorite}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <Heart className={`h-5 w-5 ${isFavorite ? 'fill-pink-500 text-pink-500' : 'text-gray-600'}`} />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 space-y-8 max-w-3xl mx-auto w-full">
        {/* Summary Card */}
        <section className="glass-panel bg-white/60 rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 border border-white/50">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-48 h-48 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-black text-gray-900 leading-none">{Math.round(occupancy)}%</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">이용률</span>
              </div>
            </div>

            <div className="flex-1 space-y-4 w-full">
              <div>
                <h3 className="text-2xl font-black text-gray-900 mb-2">실시간 좌석 현황</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">전체 좌석</div>
                    <div className="text-2xl font-black text-blue-900">{library.totalSeats}</div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-2xl border border-green-100">
                    <div className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">잔여 좌석</div>
                    <div className="text-2xl font-black text-green-900">{library.availableSeats}</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center text-gray-500 text-xs gap-2">
                <Clock className="h-4 w-4" />
                마지막 업데이트: {new Date(library.lastUpdated).toLocaleString()}
              </div>
            </div>
          </div>
        </section>

        {/* Reading Rooms List */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-gray-900">열람실별 상세 정보</h3>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{library.rooms.length}개 열람실</span>
          </div>
          
          <div className="grid gap-3">
            {library.rooms.map((room) => (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => handleRoomClick(room)}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer hover:border-blue-200 transition-colors group"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-gray-900 mb-1">{room.name}</h4>
                    {room.url && <ExternalLink className="h-3 w-3 text-gray-300 group-hover:text-blue-500 transition-colors" />}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-bold text-gray-900">
                      {room.available} <span className="text-xs font-medium text-gray-400">/ {room.total}석</span>
                    </div>
                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getRoomStatusColor(room)}`}>
                      {getRoomStatusText(room)}
                    </div>
                  </div>
                </div>
                <div className="w-24 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${room.total > 0 && room.used / room.total >= 0.9 ? 'bg-red-500' : room.total > 0 && room.used / room.total >= 0.7 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                    style={{ width: `${room.total > 0 ? (room.used / room.total) * 100 : 0}%` }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Congestion Stats Section */}
        <section>
          <CongestionStats libraryId={`${library.id}`} />
        </section>

        {/* Location & Info */}
        <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
          <h3 className="text-xl font-black text-gray-900">위치 정보</h3>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-gray-50 rounded-xl">
              <MapPin className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{library.address}</p>
              <p className="text-xs text-gray-500 mt-1">
                지역: {library.region}
                {library.distance !== undefined && (
                  <span className="ml-2 text-blue-600 font-bold">
                    ({library.distance < 1 
                      ? `${Math.round(library.distance * 1000)}m` 
                      : `${library.distance.toFixed(1)}km`} 거리)
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div className="aspect-video bg-gray-100 rounded-2xl overflow-hidden relative group">
            <img
              src={`https://picsum.photos/seed/${library.id}/600/400`}
              alt="Map placeholder"
              className="w-full h-full object-cover opacity-50"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <button className="bg-white px-4 py-2 rounded-full shadow-lg text-sm font-bold text-gray-900 flex items-center gap-2 hover:bg-gray-50 transition-colors">
                지도 앱에서 보기 <ExternalLink className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer CTA */}
      <footer className="p-4 bg-white border-t border-gray-100">
        <button className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-blue-200 active:scale-95 transition-all">
          도서관 홈페이지 방문하기
        </button>
      </footer>

      {/* Room Status Proxy Modal */}
      <AnimatePresence>
        {activeRoomUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex flex-col"
          >
            <div className="bg-white flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Info className="h-4 w-4 text-blue-600" />
                </div>
                <span className="font-bold text-gray-900">실시간 좌석 배치도</span>
              </div>
              <button 
                onClick={() => setActiveRoomUrl(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-6 w-6 text-gray-500" />
              </button>
            </div>
            
            <div className="flex-1 bg-white relative">
              {isLoadingProxy && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10">
                  <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-4" />
                  <p className="text-sm font-bold text-gray-900">좌석 정보를 불러오는 중...</p>
                  <p className="text-xs text-gray-400 mt-1">보안 연결을 통해 안전하게 가져오고 있습니다.</p>
                </div>
              )}
              <iframe
                src={`/api/iframe-proxy?url=${encodeURIComponent(activeRoomUrl)}`}
                className="w-full h-full border-none"
                onLoad={() => setIsLoadingProxy(false)}
                title="Room Status"
              />
            </div>
            
            <div className="bg-gray-50 p-4 text-center">
              <p className="text-[10px] text-gray-400">
                본 정보는 도서관 공식 홈페이지의 실시간 데이터를 기반으로 제공됩니다.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
