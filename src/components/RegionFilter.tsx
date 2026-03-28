import { REGIONS } from '../constants';
import { Region } from '../types';
import { motion } from 'motion/react';

interface RegionFilterProps {
  selectedRegion: Region | '전체';
  onSelect: (region: Region | '전체') => void;
}

export default function RegionFilter({ selectedRegion, onSelect }: RegionFilterProps) {
  return (
    <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar px-1">
      <button
        onClick={() => onSelect('전체')}
        className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all shadow-sm backdrop-blur-md ${
          selectedRegion === '전체'
            ? 'bg-blue-600 text-white shadow-blue-200'
            : 'bg-white/90 text-gray-600 border border-gray-100 hover:bg-white'
        }`}
      >
        전체
      </button>
      {REGIONS.map((region) => (
        <button
          key={region}
          onClick={() => onSelect(region)}
          className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all shadow-sm backdrop-blur-md ${
            selectedRegion === region
              ? 'bg-blue-600 text-white shadow-blue-200'
              : 'bg-white/90 text-gray-600 border border-gray-100 hover:bg-white'
          }`}
        >
          {region}
        </button>
      ))}
    </div>
  );
}
