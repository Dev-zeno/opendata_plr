import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, Calendar, Loader2, Database } from 'lucide-react';

interface HourlyStat {
  time: string;
  hour: number;
  minute: number;
  label: string;
  avgOccupancy: number;
  maxOccupancy: number;
  minOccupancy: number;
  dataPoints: number;
}

interface StatsData {
  libraryId: string;
  day: number;
  dayName: string;
  dataPoints: number;
  hourlyStats: HourlyStat[];
  peakHour: { label: string; occupancy: number; description: string } | null;
  bestHour: { label: string; occupancy: number; description: string } | null;
  message?: string;
}

interface CongestionStatsProps {
  libraryId: string;
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const CongestionStats: React.FC<CongestionStatsProps> = ({ libraryId }) => {
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const now = new Date();
    return now.getDay();
  });

  useEffect(() => {
    async function fetchStats() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/get-stats?id=${encodeURIComponent(libraryId)}&day=${selectedDay}`);
        const data = await res.json();
        setStatsData(data);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
        setStatsData(null);
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, [libraryId, selectedDay]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 shadow-xl rounded-xl border border-gray-100">
          <p className="text-xs font-bold text-gray-400 mb-1">{label} 평균</p>
          <p className="text-sm font-black text-blue-600">{payload[0].value}% 혼잡</p>
        </div>
      );
    }
    return null;
  };

  const chartData = statsData?.hourlyStats?.map(s => ({
    hour: s.label,
    occupancy: s.avgOccupancy,
  })) || [];

  const hasData = chartData.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black text-gray-900">혼잡도 예측 및 통계</h3>
        <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
          <TrendingUp className="h-3 w-3" />
          {hasData ? `${statsData?.dataPoints || 0}건 분석` : '데이터 수집 중'}
        </div>
      </div>

      {/* Day Selector */}
      <div className="flex gap-1">
        {DAY_NAMES.map((name, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedDay(idx)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedDay === idx
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 bg-blue-50 rounded-xl">
            <Calendar className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900">
              {statsData?.dayName || DAY_NAMES[selectedDay] + '요일'} 시간대별 평균 혼잡도
            </h4>
            <p className="text-[10px] text-gray-400">과거 수집 데이터를 기반으로 한 예측치입니다.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
          </div>
        ) : hasData ? (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorOccupancy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis
                  dataKey="hour"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }}
                />
                <YAxis hide domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="occupancy"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorOccupancy)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex flex-col items-center justify-center text-gray-400 space-y-3">
            <Database className="h-10 w-10 opacity-30" />
            <div className="text-center">
              <p className="text-sm font-bold">아직 수집된 데이터가 없습니다</p>
              <p className="text-[10px] mt-1">데이터 수집이 시작되면 혼잡도 예측이 표시됩니다.</p>
            </div>
          </div>
        )}
      </div>

      {/* Insights */}
      {hasData && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-orange-500" />
              <span className="text-[10px] font-bold text-gray-400 uppercase">가장 붐비는 시간</span>
            </div>
            {statsData?.peakHour ? (
              <>
                <p className="text-lg font-black text-gray-900">{statsData.peakHour.label}</p>
                <p className="text-[10px] text-gray-400 mt-1">평균 {statsData.peakHour.occupancy}% 혼잡</p>
              </>
            ) : (
              <p className="text-sm text-gray-400">분석 중...</p>
            )}
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-[10px] font-bold text-gray-400 uppercase">추천 방문 시간</span>
            </div>
            {statsData?.bestHour ? (
              <>
                <p className="text-lg font-black text-gray-900">{statsData.bestHour.label}</p>
                <p className="text-[10px] text-gray-400 mt-1">평균 {statsData.bestHour.occupancy}% 여유</p>
              </>
            ) : (
              <p className="text-sm text-gray-400">분석 중...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CongestionStats;
