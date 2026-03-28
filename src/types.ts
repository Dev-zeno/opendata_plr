export interface Library {
  id: string;
  name: string;
  address: string;
  region: string;
  lat: number;
  lng: number;
  totalSeats: number;
  usedSeats: number;
  availableSeats: number;
  lastUpdated: string;
  distance?: number;
  rooms: ReadingRoom[];
  predictions?: { hour: number; occupancy: number }[];
}

export interface ReadingRoom {
  id: string;
  name: string;
  total: number;
  used: number;
  available: number;
  status: 'available' | 'busy' | 'full';
  url?: string;
}

export type Region = '서울' | '경기' | '인천' | '강원' | '충북' | '충남' | '전북' | '전남' | '경북' | '경남' | '제주' | '세종' | '대전' | '대구' | '광주' | '울산' | '부산';
