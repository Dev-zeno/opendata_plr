import { Region, Library } from './types';

export const REGIONS: Region[] = [
  '서울', '경기', '인천', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주', '세종', '대전', '대구', '광주', '울산', '부산'
];

export const MOCK_LIBRARIES: Library[] = [
  {
    id: '1',
    name: '서울도서관',
    address: '서울특별시 중구 세종대로 110',
    region: '서울',
    lat: 37.5665,
    lng: 126.9780,
    totalSeats: 250,
    usedSeats: 180,
    availableSeats: 70,
    lastUpdated: new Date().toISOString(),
    rooms: [
      { id: '1-1', name: '제1열람실', total: 100, used: 85, available: 15, status: 'busy', url: 'http://www.snlib.go.kr/uj/contents/roomStatus.do' },
      { id: '1-2', name: '제2열람실', total: 150, used: 95, available: 55, status: 'available', url: 'http://www.snlib.go.kr/uj/contents/roomStatus.do' },
    ],
    predictions: [
      { hour: 9, occupancy: 20 }, { hour: 10, occupancy: 35 }, { hour: 11, occupancy: 50 },
      { hour: 12, occupancy: 45 }, { hour: 13, occupancy: 60 }, { hour: 14, occupancy: 85 },
      { hour: 15, occupancy: 95 }, { hour: 16, occupancy: 90 }, { hour: 17, occupancy: 75 },
      { hour: 18, occupancy: 60 }, { hour: 19, occupancy: 40 }, { hour: 20, occupancy: 25 },
    ]
  },
  {
    id: '2',
    name: '국립중앙도서관',
    address: '서울특별시 서초구 반포대로 201',
    region: '서울',
    lat: 37.4979,
    lng: 127.0276,
    totalSeats: 500,
    usedSeats: 450,
    availableSeats: 50,
    lastUpdated: new Date().toISOString(),
    rooms: [
      { id: '2-1', name: '인문과학실', total: 200, used: 190, available: 10, status: 'full', url: 'http://www.snlib.go.kr/uj/contents/roomStatus.do' },
      { id: '2-2', name: '사회과학실', total: 300, used: 260, available: 40, status: 'busy', url: 'http://www.snlib.go.kr/uj/contents/roomStatus.do' },
    ],
    predictions: [
      { hour: 9, occupancy: 30 }, { hour: 10, occupancy: 55 }, { hour: 11, occupancy: 75 },
      { hour: 12, occupancy: 70 }, { hour: 13, occupancy: 85 }, { hour: 14, occupancy: 95 },
      { hour: 15, occupancy: 100 }, { hour: 16, occupancy: 95 }, { hour: 17, occupancy: 85 },
      { hour: 18, occupancy: 70 }, { hour: 19, occupancy: 55 }, { hour: 20, occupancy: 40 },
    ]
  },
  {
    id: '3',
    name: '경기도립도서관',
    address: '경기도 수원시 팔달구 효원로 1',
    region: '경기',
    lat: 37.2636,
    lng: 127.0286,
    totalSeats: 120,
    usedSeats: 40,
    availableSeats: 80,
    lastUpdated: new Date().toISOString(),
    rooms: [
      { id: '3-1', name: '일반열람실', total: 120, used: 40, available: 80, status: 'available', url: 'http://www.snlib.go.kr/uj/contents/roomStatus.do' },
    ],
    predictions: [
      { hour: 9, occupancy: 10 }, { hour: 10, occupancy: 20 }, { hour: 11, occupancy: 30 },
      { hour: 12, occupancy: 25 }, { hour: 13, occupancy: 35 }, { hour: 14, occupancy: 45 },
      { hour: 15, occupancy: 50 }, { hour: 16, occupancy: 45 }, { hour: 17, occupancy: 40 },
      { hour: 18, occupancy: 30 }, { hour: 19, occupancy: 20 }, { hour: 20, occupancy: 10 },
    ]
  }
];
