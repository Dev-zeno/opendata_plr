import React from 'react';
import { Library } from '../types';
import { MapPin, Clock, ChevronRight, Heart } from 'lucide-react';
import { motion } from 'motion/react';

interface LibraryCardProps {
  library: Library;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClick: (library: Library) => void;
}

const LibraryCard: React.FC<LibraryCardProps> = ({ library, isFavorite, onToggleFavorite, onClick }) => {
  const occupancy = library.totalSeats > 0 ? (library.usedSeats / library.totalSeats) * 100 : 0;
  
  const getStatusColor = (occ: number) => {
    if (occ >= 90) return 'bg-red-500';
    if (occ >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusText = (occ: number) => {
    if (occ >= 90) return '만석';
    if (occ >= 70) return '혼잡';
    return '여유';
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="glass-panel rounded-3xl p-6 transition-all hover:shadow-xl hover:shadow-indigo-500/10 relative group border border-white/40"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className="absolute top-4 right-4 z-10 p-2 glass-panel rounded-full hover:scale-110 hover:bg-white/80 transition-all duration-300 shadow-sm"
      >
        <Heart className={`h-5 w-5 transition-colors ${isFavorite ? 'fill-pink-500 text-pink-500' : 'text-slate-400 group-hover:text-pink-400'}`} />
      </button>

      <div onClick={() => onClick(library)}>
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1 pr-10">
            <h3 className="text-lg font-bold text-gray-900 leading-tight truncate">{library.name}</h3>
            <div className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold text-white uppercase tracking-wider ${getStatusColor(occupancy)}`}>
              {getStatusText(occupancy)}
            </div>
            {library.distance !== undefined && (
              <div className="shrink-0 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold border border-blue-100">
                {library.distance < 1 
                  ? `${Math.round(library.distance * 1000)}m` 
                  : `${library.distance.toFixed(1)}km`}
              </div>
            )}
          </div>
          <div className="flex items-center text-gray-500 text-xs gap-1">
            <MapPin className="h-3 w-3" />
            <span className="truncate max-w-[200px]">{library.address}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div className="text-2xl font-black text-gray-900 leading-none">
              {library.availableSeats}
              <span className="text-sm font-medium text-gray-400 ml-1">/ {library.totalSeats}석</span>
            </div>
            <div className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(library.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          
          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${occupancy}%` }}
              className={`h-full rounded-full ${getStatusColor(occupancy)}`}
            />
          </div>
        </div>
        
        <div className="mt-4 pt-3 border-t border-gray-50 flex justify-end">
          <div className="text-xs font-semibold text-blue-600 flex items-center gap-1">
            상세 정보 보기 <ChevronRight className="h-3 w-3" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default LibraryCard;
