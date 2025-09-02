const map = new naver.maps.Map('map', {
    center: new naver.maps.LatLng(37.5665, 126.9780),
    zoom: 10
});

let allLibraries = [];
let markers = [];
let seatMapData = {};

// 모바일 기기 감지 함수
function isMobileDevice() {
    return window.innerWidth <= 768 || 
           /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// 모바일에서 사이드바 자동 축소 함수
function collapseSidebarOnMobile() {
    if (!isMobileDevice()) {
        return; // PC에서는 실행하지 않음
    }
    
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) {
        return;
    }
    
    // 사이드바를 아래로 내리기 (축소 상태로 만들기)
    sidebar.classList.remove('expanded');
    sidebar.classList.add('collapsed');
    sidebar.style.top = (window.innerHeight - 80) + 'px';
    sidebar.style.transition = 'top 0.3s ease';
    
    // 전역 상태 동기화 (드래그 시스템과 동기화)
    if (window.getSidebarState) {
        const dragState = window.getSidebarState();
        if (dragState) {
            dragState.currentState = 'collapsed';
        }
    }
    
    // 애니메이션 완료 후 transition 제거
    setTimeout(() => {
        sidebar.style.transition = 'none';
    }, 300);
    
    console.log('모바일에서 도서관 클릭 후 사이드바 자동 축소됨');
}

// 모바일 드래그 앤 드롭 기능 구현
function initMobileDragFeature() {
    if (!isMobileDevice()) {
        return; // PC에서는 실행하지 않음
    }
    
    const sidebar = document.getElementById('sidebar');
    const dragHandle = document.querySelector('.mobile-drag-handle');
    
    if (!sidebar || !dragHandle) {
        return;
    }
    
    let isDragging = false;
    let startY = 0;
    let startTop = 0;
    let currentTop = 0;
    let velocity = 0;
    let lastMoveTime = 0;
    let lastMoveY = 0;
    
    // 드래그 상태 객체
    const dragState = {
        currentState: 'collapsed', // 'expanded', 'collapsed', 'middle'
        expandedPosition: window.innerHeight * 0.25,
        collapsedPosition: window.innerHeight - 80,
        middlePosition: window.innerHeight * 0.6
    };
    
    // 전역 상태 접근 함수
    window.getSidebarState = () => dragState;
    
    // 위치 업데이트 함수
    function updateSidebarPosition(top, animate = false) {
        if (animate) {
            sidebar.style.transition = 'top 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            setTimeout(() => {
                sidebar.style.transition = 'none';
            }, 300);
        } else {
            sidebar.style.transition = 'none';
        }
        
        sidebar.style.top = Math.max(0, Math.min(window.innerHeight - 50, top)) + 'px';
        currentTop = top;
    }
    
    // 상태에 따른 위치 설정
    function snapToPosition(targetState, animate = true) {
        let targetPosition;
        
        switch (targetState) {
            case 'expanded':
                targetPosition = dragState.expandedPosition;
                sidebar.classList.remove('collapsed');
                sidebar.classList.add('expanded');
                break;
            case 'collapsed':
                targetPosition = dragState.collapsedPosition;
                sidebar.classList.remove('expanded');
                sidebar.classList.add('collapsed');
                break;
            case 'middle':
                targetPosition = dragState.middlePosition;
                sidebar.classList.remove('expanded', 'collapsed');
                break;
        }
        
        dragState.currentState = targetState;
        updateSidebarPosition(targetPosition, animate);
        
        console.log(`사이드바 상태 변경: ${targetState}, 위치: ${targetPosition}px`);
    }
    
    // 전역에서 접근 가능하도록 노출
    window.snapToPosition = snapToPosition;
    
    // 터치 시작
    function handleStart(e) {
        console.log('드래그 시작 이벤트:', e.type, e);
        
        const touch = e.touches ? e.touches[0] : e;
        
        if (!touch) {
            console.error('터치 정보를 찾을 수 없습니다');
            return;
        }
        
        isDragging = true;
        startY = touch.clientY;
        startTop = parseInt(sidebar.style.top) || currentTop;
        velocity = 0;
        lastMoveTime = Date.now();
        lastMoveY = touch.clientY;
        
        sidebar.style.transition = 'none';
        dragHandle.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
        
        console.log('드래그 시작:', {
            startY: startY,
            startTop: startTop,
            currentTop: currentTop
        });
        
        // 이벤트 전파 방지
        e.preventDefault();
        e.stopPropagation();
    }
    
    // 터치 이동
    function handleMove(e) {
        if (!isDragging) return;
        
        const touch = e.touches ? e.touches[0] : e;
        
        if (!touch) {
            console.error('이동 중 터치 정보를 찾을 수 없습니다');
            return;
        }
        
        const deltaY = touch.clientY - startY;
        const newTop = startTop + deltaY;
        
        // 속도 계산
        const now = Date.now();
        const timeDelta = now - lastMoveTime;
        if (timeDelta > 0) {
            velocity = (touch.clientY - lastMoveY) / timeDelta;
        }
        lastMoveTime = now;
        lastMoveY = touch.clientY;
        
        updateSidebarPosition(newTop);
        
        // 기본 스크롤 동작 방지
        e.preventDefault();
        e.stopPropagation();
    }
    
    // 터치 종료
    function handleEnd(e) {
        if (!isDragging) return;
        
        isDragging = false;
        dragHandle.style.backgroundColor = '';
        
        // 속도를 고려한 스냅 결정
        const velocityThreshold = 0.5;
        const currentPosition = currentTop;
        
        let targetState;
        
        if (Math.abs(velocity) > velocityThreshold) {
            // 빠른 스와이프 - 방향에 따라 결정
            if (velocity < -velocityThreshold) {
                // 위로 스와이프
                targetState = 'expanded';
            } else {
                // 아래로 스와이프
                targetState = 'collapsed';
            }
        } else {
            // 느린 드래그 - 위치에 따라 결정
            const expandedThreshold = (dragState.expandedPosition + dragState.middlePosition) / 2;
            const collapsedThreshold = (dragState.middlePosition + dragState.collapsedPosition) / 2;
            
            if (currentPosition < expandedThreshold) {
                targetState = 'expanded';
            } else if (currentPosition < collapsedThreshold) {
                targetState = 'middle';
            } else {
                targetState = 'collapsed';
            }
        }
        
        snapToPosition(targetState);
        e.preventDefault();
    }
    
    // 이벤트 리스너 등록 (터치와 마우스 모두 지원)
    // 모바일에서 더 안정적인 터치 이벤트 처리
    dragHandle.addEventListener('touchstart', handleStart, { passive: false, capture: true });
    dragHandle.addEventListener('touchmove', handleMove, { passive: false, capture: true });
    dragHandle.addEventListener('touchend', handleEnd, { passive: false, capture: true });
    
    // 터치 취소 이벤트도 처리
    dragHandle.addEventListener('touchcancel', handleEnd, { passive: false });
    
    // 마우스 이벤트도 지원 (데스크톱 테스트용)
    dragHandle.addEventListener('mousedown', handleStart);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    
    // iOS Safari 호환성을 위한 추가 처리
    dragHandle.style.touchAction = 'pan-y';
    dragHandle.style.webkitTouchCallout = 'none';
    dragHandle.style.webkitUserSelect = 'none';
    
    // 디버깅을 위한 콘솔 로그 추가
    console.log('모바일 드래그 기능 초기화 완료');
    console.log('드래그 핸들 요소:', dragHandle);
    console.log('사이드바 요소:', sidebar);
    console.log('현재 화면 크기:', window.innerWidth, 'x', window.innerHeight);
    
    // 초기 상태 설정 (마지막에 실행)
    snapToPosition('collapsed', false);
}

// Mobile interaction initialization for responsive design
function initMobileInteractions() {
    const sidebar = document.getElementById('sidebar');
    const mobileToggle = document.getElementById('mobile-toggle');
    
    // 모바일 드래그 기능 초기화
    initMobileDragFeature();
    
    // Mobile toggle button functionality - restored
    if (mobileToggle) {
        mobileToggle.addEventListener('click', function() {
            // 드래그 시스템에서 현재 상태 확인
            const dragState = window.getSidebarState ? window.getSidebarState() : null;
            
            if (dragState) {
                // 드래그 시스템이 있으면 그것을 사용
                if (dragState.currentState === 'collapsed') {
                    // 확장
                    const snapToPosition = window.snapToPosition;
                    if (snapToPosition) {
                        snapToPosition('expanded');
                    }
                } else {
                    // 축소
                    const snapToPosition = window.snapToPosition;
                    if (snapToPosition) {
                        snapToPosition('collapsed');
                    }
                }
            } else {
                // 기존 방식 사용 (폴백)
                const isExpanded = sidebar.classList.contains('expanded') || 
                                  parseInt(sidebar.style.top) <= window.innerHeight * 0.4;
                
                if (isExpanded) {
                    // Collapse the sidebar
                    sidebar.classList.remove('expanded');
                    sidebar.classList.add('collapsed');
                    sidebar.style.top = (window.innerHeight - 80) + 'px';
                    sidebar.style.transition = 'top 0.3s ease';
                } else {
                    // Expand the sidebar
                    sidebar.classList.remove('collapsed');
                    sidebar.classList.add('expanded');
                    sidebar.style.top = (window.innerHeight * 0.25) + 'px';
                    sidebar.style.transition = 'top 0.3s ease';
                }
                
                // 애니메이션 완료 후 transition 제거
                setTimeout(() => {
                    sidebar.style.transition = 'none';
                }, 300);
            }
        });
    }
    
    // Mobile search functionality
    const mobileSearchInput = document.getElementById('mobile-search-input');
    const desktopSearchInput = document.getElementById('search-input');
    
    if (mobileSearchInput && desktopSearchInput) {
        // Sync mobile and desktop search
        mobileSearchInput.addEventListener('input', function() {
            desktopSearchInput.value = this.value;
            performSearch(this.value);
        });
        
        desktopSearchInput.addEventListener('input', function() {
            mobileSearchInput.value = this.value;
            performSearch(this.value);
        });
    }
}

// Desktop sidebar toggle functionality
function initDesktopSidebar() {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    
    // PC 버전에서는 사이드바를 항상 표시
    if (window.innerWidth > 768) {
        if (sidebar) {
            sidebar.classList.remove('collapsed');
            sidebar.classList.add('active');
            console.log('PC 사이드바 초기화 완료 - 표시됨');
        }
        
        if (sidebarToggle) {
            sidebarToggle.style.display = 'none'; // PC에서는 토글 버튼 숨김
        }
    }
    
    // 토글 버튼 클릭 이벤트 (PC용)
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            
            // 토글 버튼 텍스트 변경
            if (sidebar.classList.contains('collapsed')) {
                sidebarToggle.textContent = '▶';
            } else {
                sidebarToggle.textContent = '◀';
            }
        });
    }
}

// 화면 크기에 따른 사이드바 초기화
function initializeSidebarForScreenSize() {
    const sidebar = document.getElementById('sidebar');
    
    if (window.innerWidth > 768) {
        // PC 버전 - 사이드바 강제 표시
        if (sidebar) {
            // 모든 상태 클래스 제거 후 재설정
            sidebar.classList.remove('collapsed', 'expanded');
            sidebar.classList.add('active');
            
            // 인라인 스타일도 강제 설정
            sidebar.style.display = 'block';
            sidebar.style.visibility = 'visible';
            sidebar.style.opacity = '1';
            sidebar.style.position = 'static'; // flex 레이아웃에 따라 배치
            sidebar.style.width = '350px';
            sidebar.style.height = '100vh';
            sidebar.style.top = 'auto'; // 초기화
            sidebar.style.left = 'auto'; // 초기화
            sidebar.style.bottom = 'auto';
            sidebar.style.right = 'auto';
            sidebar.style.transform = 'none';
            sidebar.style.margin = '0';
            sidebar.style.padding = '0';
            sidebar.style.float = 'none'; // float 제거
            
            console.log('PC 모드 - 사이드바 강제 표시 완료');
        }
    } else {
        // 모바일 버전 - 하단 시트 스타일
        if (sidebar) {
            sidebar.classList.remove('active');
            sidebar.classList.add('collapsed');
            sidebar.style.position = 'fixed';
            sidebar.style.width = '100%';
            sidebar.style.height = '75vh';
            sidebar.style.top = (window.innerHeight - 80) + 'px';
            sidebar.style.bottom = 'auto';
            sidebar.style.display = 'block';
            sidebar.style.visibility = 'visible';
            sidebar.style.opacity = '1';
            console.log('모바일 모드 - 사이드바 축소됨');
        }
    }
}

// Search functionality
function performSearch(searchTerm) {
    if (!searchTerm.trim()) {
        displayLibraries(allLibraries);
        return;
    }
    
    const filtered = allLibraries.filter(lib => {
        const name = (lib.pblibNm || '').toLowerCase();
        const addr = (lib.pblibRoadNmAddr || '').toLowerCase();
        const term = searchTerm.toLowerCase();
        return name.includes(term) || addr.includes(term);
    });
    
    displayLibraries(filtered);
    updateStatistics(filtered);
}

function setUpdateTime() {
    const now = new Date();
    const formatted = now.toLocaleTimeString('ko-KR', {hour12:true});
    const updateEl = document.getElementById('update-time');
    if (updateEl) updateEl.textContent = `업데이트: ${formatted}`;
    console.log('업데이트 시간:', formatted);
}

async function fetchSeatMapData() {
    try {
        // Vercel 배포 환경에서도 작동하도록 직접 GitHub에서 가져오기
        const response = await fetch(`https://raw.githubusercontent.com/Dev-zeno/opendata_plr/refs/heads/main/library_data.json?t=${Date.now()}`, { 
            cache: 'no-store',
            headers: {
                'User-Agent': 'OpenData-Library-App/1.0'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log('[FETCH SEAT MAP] Raw data received:', {
            isArray: Array.isArray(data),
            length: data ? data.length : 0,
            sampleItem: data && data.length > 0 ? data[0] : null
        });
        
        // 좌석배치도 데이터를 매핑 형태로 변환
        seatMapData = {};
        if (data && Array.isArray(data)) {
            data.forEach((item, index) => {
                if (item.stdgCd && item.pblibId && item.rdrmId && item.rdrmUrl) {
                    // 키 형태: "stdgCd_pblibId_rdrmId"
                    const key = `${item.stdgCd}_${item.pblibId}_${item.rdrmId}`;
                    seatMapData[key] = {
                        url: item.rdrmUrl,
                        rdrmNm: item.rdrmNm || '열람실',
                        pblibNm: item.pblibNm || '도서관'
                    };
                    
                    // 처음 5개 아이템에 대해 상세 로그
                    if (index < 5) {
                        console.log(`[FETCH SEAT MAP] Item ${index + 1}:`, {
                            original: { stdgCd: item.stdgCd, pblibId: item.pblibId, rdrmId: item.rdrmId, rdrmUrl: item.rdrmUrl },
                            mappedKey: key,
                            mappedValue: seatMapData[key]
                        });
                    }
                } else {
                    // 누락된 필드가 있는 아이템 로그
                    if (index < 5) {
                        console.log(`[FETCH SEAT MAP] Skipped item ${index + 1} - missing fields:`, {
                            stdgCd: item.stdgCd,
                            pblibId: item.pblibId,
                            rdrmId: item.rdrmId,
                            rdrmUrl: item.rdrmUrl
                        });
                    }
                }
            });
        }
        
        console.log('Seat map data fetched and mapped (GitHub direct):', Object.keys(seatMapData).length, 'rooms');
        console.log('Sample seat map data:', Object.keys(seatMapData).slice(0, 3).map(key => ({ key, data: seatMapData[key] })));
        
    } catch (error) {
        console.error('Error fetching seat map data from GitHub:', error);
        
        // 대체 방럈으로 API 사용 시도
        try {
            console.log('Trying fallback API endpoint...');
            const fallbackResponse = await fetch(`/api/seat-map-proxy?t=${Date.now()}`, { cache: 'no-store' });
            const fallbackData = await fallbackResponse.json();
            
            console.log('[FALLBACK API] Raw data received:', {
                isArray: Array.isArray(fallbackData),
                length: fallbackData ? fallbackData.length : 0,
                sampleItem: fallbackData && fallbackData.length > 0 ? fallbackData[0] : null
            });
            
            seatMapData = {};
            if (fallbackData && Array.isArray(fallbackData)) {
                fallbackData.forEach((item, index) => {
                    if (item.stdgCd && item.pblibId && item.rdrmId && item.rdrmUrl) {
                        const key = `${item.stdgCd}_${item.pblibId}_${item.rdrmId}`;
                        seatMapData[key] = {
                            url: item.rdrmUrl,
                            rdrmNm: item.rdrmNm || '열람실',
                            pblibNm: item.pblibNm || '도서관'
                        };
                        
                        if (index < 3) {
                            console.log(`[FALLBACK API] Item ${index + 1}:`, {
                                mappedKey: key,
                                mappedValue: seatMapData[key]
                            });
                        }
                    }
                });
            }
            
            console.log('Seat map data fetched via fallback API:', Object.keys(seatMapData).length, 'rooms');
        } catch (fallbackError) {
            console.error('Fallback API also failed:', fallbackError);
            // 에러 발생 시 빈 객체로 초기화
            seatMapData = {};
        }
    }
}

function fetchLibraries() {
    const libraryInfoUrl = `/api/proxy`;
    const readingRoomUrl = `/api/proxy-reading-room`;

    return Promise.all([
        fetch(`${libraryInfoUrl}?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`${readingRoomUrl}?t=${Date.now()}`, { cache: 'no-store' })
    ])
        .then(responses => Promise.all(responses.map(res => res.json())))
        .then(([libraryData, readingRoomData]) => {
            if (libraryData && libraryData.body && libraryData.body.item && readingRoomData && readingRoomData.body && readingRoomData.body.item) {
                const validLibraries = libraryData.body.item.filter(lib => lib.pblibId && String(lib.pblibId).trim() !== '' && lib.stdgCd && String(lib.stdgCd).trim() !== '');
                const validReadingRooms = readingRoomData.body.item.filter(room => room.pblibId && String(room.pblibId).trim() !== '' && room.stdgCd && String(room.stdgCd).trim() !== '');

                const readingRoomMap = new Map();
                validReadingRooms.forEach(room => {
                    const key = `${String(room.stdgCd).trim()}_${String(room.pblibId).trim()}`;
                    if (!readingRoomMap.has(key)) {
                        readingRoomMap.set(key, []);
                    }
                    readingRoomMap.get(key).push(room);
                });

                allLibraries = validLibraries.map(lib => {
                    const key = `${String(lib.stdgCd).trim()}_${String(lib.pblibId).trim()}`;
                    return {
                        ...lib,
                        readingRooms: readingRoomMap.get(key) || []
                    };
                });
                
                console.log('Libraries processed:', allLibraries.length);
                console.log('SeatMapData available:', Object.keys(seatMapData).length, 'rooms');
                
                updateStatistics(allLibraries);
                displayLibraries(allLibraries);
                generateCityButtons(allLibraries);
                setUpdateTime();

                // 초기 로드 시 전국 통계 레이블 보정
                const regionLabelEl = document.querySelector('#total-libraries')?.nextElementSibling;
                if (regionLabelEl) {
                    regionLabelEl.textContent = '전국 도서관';
                }
                console.log('Library data processing completed');
                return allLibraries; // Promise 리턴값 추가
            } else {
                console.error('Error: Unexpected data structure in API response.');
                throw new Error('Invalid API response structure');
            }
        })
        .catch(error => {
            console.error('Error fetching library data:', error);
            throw error; // 에러를 다시 던져서 호출자가 처리하도록 함
        });
}

function generateCityButtons(libraries) {
    const cityButtonsContainer = document.getElementById('city-buttons');
    const mobileCityButtonsContainer = document.getElementById('mobile-city-buttons');
    
    if (cityButtonsContainer) {
        cityButtonsContainer.innerHTML = '';
    }
    if (mobileCityButtonsContainer) {
        mobileCityButtonsContainer.innerHTML = '';
    }

    // 대한민국 17개 시·도
    const sidos = [
        '서울특별시','부산광역시','대구광역시','인천광역시','광주광역시','대전광역시','울산광역시','세종특별자치시',
        '경기도','강원특별자치도','충청북도','충청남도','전북특별자치도','전라남도','경상북도','경상남도','제주특별자치도'
    ];

    // 라이브러리 개수 집계
    const counts = new Map();
    libraries.forEach(lib => {
        if (lib.pblibRoadNmAddr) {
            const sido = lib.pblibRoadNmAddr.split(' ')[0];
            counts.set(sido, (counts.get(sido) || 0) + 1);
        }
    });

    sidos.forEach(sido => {
        const cnt = counts.get(sido) || 0;
        if (cnt === 0) {
            // 데이터 없는 시·도 버튼은 렌더링하지 않음
            return;
        }
        
        const abbrMap = {
            '서울특별시':'서울','부산광역시':'부산','대구광역시':'대구','인천광역시':'인천','울산광역시':'울산',
            '경기도':'경기','충청북도':'충북','전북특별자치도':'전북','전라남도':'전남'
        };
        const label = abbrMap[sido] || sido.slice(0,2);
        
        // Desktop city button
        if (cityButtonsContainer) {
            const btn = document.createElement('button');
            btn.className = 'city-btn';
            btn.innerHTML = `${label} <span class="count">${cnt}</span>`;
            btn.setAttribute('data-sido', sido);
            btn.addEventListener('click', () => {
                // Check if button is already active (toggle functionality)
                const isActive = btn.classList.contains('active');
                
                // Clear all active states
                document.querySelectorAll('#city-buttons .city-btn').forEach(b=>{
                    b.classList.remove('active');
                });
                document.querySelectorAll('#mobile-city-buttons .city-btn').forEach(b=>{
                    b.classList.remove('active');
                });
                
                if (!isActive) {
                    // Activate this button and filter
                    btn.classList.add('active');
                    // Find corresponding mobile button and activate it
                    const mobileBtn = document.querySelector(`#mobile-city-buttons .city-btn[data-sido="${sido}"]`);
                    if (mobileBtn) {
                        mobileBtn.classList.add('active');
                    }
                    filterLibrariesBySido(sido, libraries);
                } else {
                    // Deactivate and show all libraries
                    filterLibrariesBySido(null, libraries);
                }
            });
            cityButtonsContainer.appendChild(btn);
        }
        
        // Mobile city button
        if (mobileCityButtonsContainer) {
            const mobileBtn = document.createElement('button');
            mobileBtn.className = 'city-btn';
            mobileBtn.setAttribute('data-sido', sido);
            mobileBtn.innerHTML = `${label} <span class="count">${cnt}</span>`;
            mobileBtn.addEventListener('click', () => {
                // Check if button is already active (toggle functionality)
                const isActive = mobileBtn.classList.contains('active');
                
                // Clear all active states
                document.querySelectorAll('#city-buttons .city-btn').forEach(b=>{
                    b.classList.remove('active');
                });
                document.querySelectorAll('#mobile-city-buttons .city-btn').forEach(b=>{
                    b.classList.remove('active');
                });
                
                if (!isActive) {
                    // Activate this button and filter
                    mobileBtn.classList.add('active');
                    // Find corresponding desktop button and activate it
                    const desktopBtn = document.querySelector(`#city-buttons .city-btn[data-sido="${sido}"]`);
                    if (desktopBtn) {
                        desktopBtn.classList.add('active');
                    }
                    filterLibrariesBySido(sido, libraries);
                } else {
                    // Deactivate and show all libraries
                    filterLibrariesBySido(null, libraries);
                }
            });
            mobileCityButtonsContainer.appendChild(mobileBtn);
        }
    });
}

function filterLibrariesBySido(sido, libraries) {
    const filtered = sido ? libraries.filter(lib => lib.pblibRoadNmAddr && lib.pblibRoadNmAddr.startsWith(sido)) : libraries;
    displayLibraries(filtered);
    updateStatistics(filtered);

    // Update region label ("전국 도서관" -> "서울 도서관" 등)
    const regionLabelEl = document.querySelector('#total-libraries')?.nextElementSibling;
    if (regionLabelEl) {
        if (sido) {
            const abbrMap = {
                '서울특별시':'서울','부산광역시':'부산','대구광역시':'대구','인천광역시':'인천','광주광역시':'광주','대전광역시':'대전','울산광역시':'울산','세종특별자치시':'세종',
                '경기도':'경기','강원특별자치도':'강원','충청북도':'충북','충청남도':'충남','전북특별자치도':'전북','전라남도':'전남','경상북도':'경북','경상남도':'경남','제주특별자치도':'제주'
            };
            const labelPrefix = abbrMap[sido] || sido.replace(/(특별시|광역시|특별자치시|특별자치도|도)$/,'');
            regionLabelEl.textContent = `${labelPrefix} 도서관`;
        } else {
            regionLabelEl.textContent = '전국 도서관';
        }
    }
    
    // 해당 지역의 마커로 지도 이동 (sido가 있을 때만)
    if (sido && filtered.length > 0) {
        const bounds = new naver.maps.LatLngBounds();
        filtered.forEach(lib => {
            const lat = parseFloat(lib.lat);
            const lon = parseFloat(lib.lot);
            if (!isNaN(lat) && !isNaN(lon)) {
                bounds.extend(new naver.maps.LatLng(lat, lon));
            }
        });
        map.fitBounds(bounds);
    }
}

// Deprecated select version kept for reference (not used)
function populateCitySelect(libraries) {
    const citySelect = document.getElementById('city-select');
    citySelect.innerHTML = '<option value="">시/도 선택</option>'; // Default option

    const cities = new Set();
    libraries.forEach(lib => {
        if (lib.pblibRoadNmAddr) {
            const parts = lib.pblibRoadNmAddr.split(' ');
            if (parts.length > 0) {
                cities.add(parts[0]);
            }
        }
    });

    cities.forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        citySelect.appendChild(option);
    });
}

function updateStatistics(libraries) {
    const libraryCount = document.getElementById('total-libraries');
    const availableSeatCount = document.getElementById('available-seats');
    const totalSeatCount = document.getElementById('total-seats');

    let totalAvailableSeats = 0;
    let totalSeats = 0;

    libraries.forEach(lib => {
        if (lib.readingRooms) {
            lib.readingRooms.forEach(room => {
                totalAvailableSeats += parseInt(room.rmndSeatCnt) || 0;
                totalSeats += parseInt(room.tseatCnt) || 0;
            });
        }
    });

    libraryCount.textContent = libraries.length.toLocaleString();
    availableSeatCount.textContent = totalAvailableSeats.toLocaleString();
    totalSeatCount.textContent = totalSeats.toLocaleString();
}

function displayLibraries(libraries) {
    markers.forEach(marker => marker.setMap(null));
    markers = [];

    const infowindow = new naver.maps.InfoWindow();
    const searchResults = document.getElementById('search-results');
    searchResults.innerHTML = '';
    // 카드 리스트를 가운데 정렬하고 간격을 조정
    searchResults.style.display = 'flex';
    searchResults.style.flexDirection = 'column';
    searchResults.style.alignItems = 'stretch';
    searchResults.style.gap = '0';

    // Add a click listener to the map to close the infowindow
    naver.maps.Event.addListener(map, 'click', function() {
        if (infowindow.getMap()) {
            infowindow.close();
        }
    });

    libraries.forEach(lib => {
        const lat = parseFloat(lib.lat);
        const lon = parseFloat(lib.lot);
        if (!isNaN(lat) && !isNaN(lon)) {
            const marker = new naver.maps.Marker({
                position: new naver.maps.LatLng(lat, lon),
                map: map
            });

            const resultItem = document.createElement('div');
            resultItem.className = 'library-card p-5 border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition bg-white space-y-2';

            let totalRmndSeatCnt = 0;
            let totalTseatCnt = 0;
            if (lib.readingRooms && lib.readingRooms.length > 0) {
                lib.readingRooms.forEach(room => {
                    totalRmndSeatCnt += parseInt(room.rmndSeatCnt) || 0;
                    totalTseatCnt += parseInt(room.tseatCnt) || 0;
                });
            }
            let roomDetailsHtml = '';
            if (lib.readingRooms && lib.readingRooms.length > 0) {
                lib.readingRooms.forEach(room => {
                    roomDetailsHtml += `<div class="flex justify-between text-sm text-gray-700 py-0.5"><span>${room.rdrmNm}</span><span class="font-medium">${room.rmndSeatCnt}/${room.tseatCnt}</span></div>`;
                });
            }

            const usedSeats = totalTseatCnt - totalRmndSeatCnt;
            const occupancyRate = totalTseatCnt > 0 ? (usedSeats / totalTseatCnt) * 100 : 0;
            let complexity = '여유';
            let complexityColor = 'border border-green-300 bg-green-50 text-green-700';
            if (occupancyRate >= 80) {
                complexity = '혼잡';
                complexityColor = 'border border-red-300 bg-red-50 text-red-700';
            } else if (occupancyRate >= 30) {
                complexity = '보통';
                complexityColor = 'border border-yellow-300 bg-yellow-50 text-yellow-700';
            }

            resultItem.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800 mb-2">${lib.pblibNm}</h3>
                    </div>
                    <div class="flex-shrink-0"><span class="status-badge ${complexityColor} px-2 py-1 rounded-full text-xs font-semibold">${complexity}</span></div>
                </div>
                
                    <div class="room-list space-y-0.5 text-sm text-gray-700">${roomDetailsHtml}</div>
            `;

            resultItem.addEventListener('click', () => {
                // 모바일에서만 사이드바 먼저 축소
                if (isMobileDevice()) {
                    collapseSidebarOnMobile();
                    // 사이드바 축소 애니메이션 완료 후 지도 이동
                    setTimeout(() => {
                        map.setCenter(new naver.maps.LatLng(lat, lon));
                        map.setZoom(15);
                        openInfoWindow(marker, lib);
                    }, 300); // 사이드바 축소 애니메이션과 동일한 시간
                } else {
                    // PC에서는 기존 동작 유지
                    map.setCenter(new naver.maps.LatLng(lat, lon));
                    map.setZoom(15);
                    openInfoWindow(marker, lib);
                }
            });

            resultItem.style.height = '180px';
            searchResults.appendChild(resultItem);

            naver.maps.Event.addListener(marker, 'click', function(e) {
                openInfoWindow(marker, lib);
                // Stop event propagation to prevent the map click listener from firing
                naver.maps.Event.stop(e);
            });
            markers.push(marker);
        }
    });

    function openInfoWindow(marker, lib) {
        // 전체·잔여 좌석 계산
        let totalTseatCnt = 0;
        let totalRmndSeatCnt = 0;
        if (lib.readingRooms && lib.readingRooms.length > 0) {
            lib.readingRooms.forEach(room => {
                totalTseatCnt += parseInt(room.tseatCnt) || 0;
                totalRmndSeatCnt += parseInt(room.rmndSeatCnt) || 0;
            });
        }
        const usedRate = totalTseatCnt ? (((totalTseatCnt - totalRmndSeatCnt) / totalTseatCnt) * 100).toFixed(1) : 0;
        const remRate = totalTseatCnt ? ((totalRmndSeatCnt / totalTseatCnt) * 100).toFixed(1) : 0;

        // 상태 뱃지 결정 (간단 로직)
        let statusLabel = '보통';
        if (usedRate < 30) statusLabel = '여유';
        else if (usedRate > 70) statusLabel = '혼잡';

        // 열람실 행 구성
        let roomRows = '';
        if (lib.readingRooms && lib.readingRooms.length > 0) {
            // seatMapData 로딩 상태 확인
            const seatMapDataLoaded = Object.keys(seatMapData).length > 0;
            if (!seatMapDataLoaded) {
                console.warn('[SEAT MAP WARNING] SeatMapData not fully loaded yet. Available keys:', Object.keys(seatMapData).length);
            }
            
            lib.readingRooms.forEach(room => {
                // 동적으로 좌석배치도 URL 찾기
                const seatMapKey = `${lib.stdgCd}_${lib.pblibId}_${room.rdrmId}`;
                const seatMapInfo = seatMapData[seatMapKey];
                let seatMapUrl = seatMapInfo ? seatMapInfo.url : null;
                
                // 추가 안전 검사: URL이 비어있거나 널인 경우 처리
                if (seatMapUrl && (seatMapUrl.trim() === '' || seatMapUrl === 'null' || seatMapUrl === 'undefined')) {
                    seatMapUrl = null;
                }
                
                // 강화된 디버깅을 위한 로그 추가
                console.log(`[SEAT MAP DEBUG] Room: ${lib.pblibNm} - ${room.rdrmNm}`);
                console.log(`  Library info: stdgCd=${lib.stdgCd}, pblibId=${lib.pblibId}`);
                console.log(`  Room info: rdrmId=${room.rdrmId}`);
                console.log(`  Generated key: ${seatMapKey}`);
                console.log(`  SeatMapData keys available: ${Object.keys(seatMapData).length} total`);
                console.log(`  Key exists in seatMapData: ${seatMapData.hasOwnProperty(seatMapKey)}`);
                console.log(`  Found URL: ${seatMapUrl}`);
                
                if (!seatMapUrl && room.rdrmNm && room.rdrmNm.includes('열람실')) {
                    // 키가 없는 경우 비슷한 키들 찾아보기
                    const similarKeys = Object.keys(seatMapData).filter(key => 
                        key.includes(lib.stdgCd) || key.includes(lib.pblibId)
                    );
                    console.log(`  Similar keys found: ${similarKeys.length > 0 ? similarKeys : 'None'}`);
                }
                
                // 모든 열람실을 클릭 가능하게 설정 (URL이 없으면 안내 문구 표시)
                const clickHandler = `onclick="openModal('${seatMapUrl || 'null'}')"`;
                const hasUrl = seatMapUrl && seatMapUrl !== 'null' && seatMapUrl.trim() !== '';
                const titleText = hasUrl ? '클릭하면 좌석배치도를 볼 수 있습니다' : '좌석배치도가 제공되지 않습니다';
                
                roomRows += `
                    <li class="room-row cursor-pointer" ${clickHandler} title="${titleText}">
                        <span class="room-name">${room.rdrmNm}</span>
                        <span class="room-count"><strong>${room.rmndSeatCnt}/${room.tseatCnt}</strong><br><span class="sub">잔여/전체</span></span>
                        <i class="fa-solid fa-table-cells-large grid-icon" style="opacity: ${hasUrl ? '1' : '0.5'}"></i>
                    </li>`;
            });
        } else {
            roomRows = '<p style="padding:8px 0;">열람실 정보가 없습니다.</p>';
        }

        const content = `
            <div class="info-card">
                <div class="card-header">
                    <h5>${lib.pblibNm}</h5>
                    <span class="badge">${statusLabel}</span>
                </div>
                <p class="addr"><i class="fa-solid fa-map-marker-alt"></i> ${lib.pblibRoadNmAddr}</p>
                <p class="tel"><i class="fa-solid fa-phone"></i> ${lib.pblibTelno || '정보 없음'}</p>
                <hr>
                <div class="overall-title"><span class="overall-label"><i class="fa-solid fa-user-group"></i> 전체 좌석 현황</span><span class="overall-count"><span class="count-num">${totalRmndSeatCnt} / ${totalTseatCnt}</span><span class="overall-sub">잔여 / 전체</span></span></div>
                <div class="progress-container"><div class="progress-bar" style="width:${usedRate}%;"></div></div>
                <div class="usage-text">사용률 ${usedRate}%</div>
                <hr>
                <div class="rooms-header"><span>열람실별 현황</span><span class="realtime"><i class="fa-regular fa-clock"></i> 실시간</span></div>
                <ul class="room-list">${roomRows}</ul>
            </div>`;

        if (infowindow.getMap()) infowindow.close();
        infowindow.setContent(content);
    infowindow.open(map, marker);
    }
}

// Obsolete openModal function removed - using the modern modal implementation below

function createBubbleButtons() {
    const bubbleContainer = document.getElementById('bubble-container');
    bubbleContainer.innerHTML = ''; // Clear previous buttons
    const addressPrefixes = new Set();
    allLibraries.forEach(lib => {
        if (lib.pblibRoadNmAddr) {
            const prefix = lib.pblibRoadNmAddr.split(' ')[0];
            addressPrefixes.add(prefix);
        }
    });

    addressPrefixes.forEach(prefix => {
        const button = document.createElement('button');
        button.className = 'bubble-button';
        button.textContent = prefix;
        button.addEventListener('click', () => {
            document.getElementById('search-input').value = prefix;
            performSearch();
        });
        bubbleContainer.appendChild(button);
    });
}

function performSearch() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const filteredLibraries = allLibraries.filter(lib => {
        const name = lib.pblibNm.toLowerCase();
        const address = lib.pblibRoadNmAddr.toLowerCase();
        return name.includes(searchTerm) || address.includes(searchTerm);
    });
    updateStatistics(filteredLibraries);
    displayLibraries(filteredLibraries);
}

document.getElementById('search-button').addEventListener('click', performSearch);
document.getElementById('search-input').addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
        performSearch();
    }
});

// 모바일에서 검색 입력 시 실시간 검색
document.getElementById('search-input').addEventListener('input', () => {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        // 모바일에서는 입력 시 바로 검색 (디바운싱 적용)
        clearTimeout(window.searchTimeout);
        window.searchTimeout = setTimeout(() => {
            performSearch();
        }, 300);
    }
});

// 새로고침 버튼 기능
document.getElementById('refresh-button').addEventListener('click', async () => {
    const refreshButton = document.getElementById('refresh-button');
    const updateTime = document.getElementById('update-time');
    
    // 버튼 비활성화 및 로딩 상태 표시
    refreshButton.disabled = true;
    refreshButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 새로고침 중...';
    
    try {
        // 데이터 다시 로드 (좌석배치도 데이터 포함) - Promise.all로 동시 로드
        console.log('Refreshing all data...');
        await Promise.all([
            fetchSeatMapData(),  // 좌석배치도 데이터 새로고침
            fetchLibraries()     // 도서관 및 열람실 데이터 새로고침
        ]);
        
        console.log('모든 데이터 새로고침 완료');
        
        // 업데이트 시간 갱신
        const now = new Date();
        const timeString = now.toLocaleTimeString('ko-KR', {
            hour12: true,
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit'
        });
        updateTime.textContent = `업데이트 : ${timeString}`;
        
        // 성공 피드백
        refreshButton.innerHTML = '<i class="fas fa-check"></i> 완료';
        setTimeout(() => {
            refreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> 새로고침';
            refreshButton.disabled = false;
        }, 1000);
        
    } catch (error) {
        console.error('새로고침 중 오류 발생:', error);
        // 오류 피드백
        refreshButton.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 오류';
        setTimeout(() => {
            refreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> 새로고침';
            refreshButton.disabled = false;
        }, 2000);
    }
});

// 화면 크기에 따른 사이드바 초기화
function initializeSidebarForScreenSize() {
    const sidebar = document.getElementById('sidebar');
    const toggleButton = document.getElementById('sidebar-toggle');
    
    if (!sidebar) return;
    
    if (window.innerWidth > 768) {
        // PC 버전: 사이드바 항상 표시
        sidebar.classList.remove('collapsed');
        sidebar.classList.add('active');
        
        if (toggleButton) {
            toggleButton.style.display = 'none';
        }
        
        console.log('PC 모드: 사이드바 항상 표시');
    } else {
        // 모바일 버전: 기존 로직 유지
        sidebar.classList.remove('active');
        
        if (toggleButton) {
            toggleButton.style.display = 'block';
            toggleButton.textContent = '▶';
        }
        
        console.log('모바일 모드: 사이드바 토글 활성화');
    }
}



document.querySelectorAll('.filter-tabs button').forEach(button => {
    button.addEventListener('click', function() {
        const tabId = this.dataset.tab;

        document.querySelectorAll('.filter-tabs button').forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');

        document.querySelectorAll('.filter-content > div').forEach(content => content.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
    });
});

// Initial active tab (wait for DOM ready to avoid null)
document.addEventListener('DOMContentLoaded', () => {
    const defaultTabButton = document.querySelector('.filter-tabs button[data-tab="region-filter"]');
    if (defaultTabButton) defaultTabButton.click();
});

let selectedCity = '';
let selectedDistrict = '';

function filterLibrariesByRegion() {
    let filtered = allLibraries;

    if (selectedCity) {
        filtered = filtered.filter(lib => lib.pblibRoadNmAddr.startsWith(selectedCity));
    }

    if (selectedDistrict) {
        filtered = filtered.filter(lib => lib.pblibRoadNmAddr.includes(selectedDistrict));
    }

    updateStatistics(filtered);
    displayLibraries(filtered);
}

document.getElementById('city-select').addEventListener('change', function() {
    selectedCity = this.value;
    selectedDistrict = ''; // Reset district when city changes
    document.getElementById('district-buttons').innerHTML = ''; // Clear district buttons

    if (selectedCity) {
        const districts = new Set();
        allLibraries.filter(lib => lib.pblibRoadNmAddr.startsWith(selectedCity))
                     .forEach(lib => {
                         const parts = lib.pblibRoadNmAddr.split(' ');
                         if (parts.length > 1) {
                             districts.add(parts[1]);
                         }
                     });
        
        const districtButtonsContainer = document.getElementById('district-buttons');
        districts.forEach(district => {
            const button = document.createElement('button');
            button.textContent = district;
            button.className = 'district-button';
            button.addEventListener('click', () => {
                selectedDistrict = district;
                filterLibrariesByRegion();
                document.querySelectorAll('.district-button').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
            });
            districtButtonsContainer.appendChild(button);
        });
    }
    filterLibrariesByRegion();
});

// Initial population of city select (if needed, based on your data)
// You might want to call this after fetchLibraries() completes
// For now, assuming cities are pre-defined in HTML or fetched separately.



// Modal functions
let modalTimeout = null;
let currentModalUrl = null;

function openModal(url) {
    console.log('Opening modal with URL: ' + url);
    
    const modalContainer = document.getElementById('modal-container');
    
    // URL이 null이거나 유효하지 않은 경우 안내 문구 표시
    if (!url || url === 'null' || url.trim() === '') {
        modalContainer.innerHTML = `
            <div id="modal-content">
                <span id="modal-close" class="modal-close-btn">&times;</span>
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px; text-align: center;">
                    <i class="fas fa-info-circle" style="font-size: 48px; color: #6b7280; margin-bottom: 20px;"></i>
                    <h3 style="margin: 0 0 10px 0; color: #374151; font-size: 18px;">좌석배치도 제공 안내</h3>
                    <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.5;">도서관에서 좌석배치도를 제공하지 않습니다</p>
                </div>
            </div>
        `;
        modalContainer.classList.remove('hidden');
        // null 값인 경우 timeout이나 security alert 설정하지 않음
        return;
    }
    
    currentModalUrl = url;
    
    // Add loading state
    modalContainer.innerHTML = `
        <div id="modal-content">
            <span id="modal-close" class="modal-close-btn">&times;</span>
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 18px; color: #666;">
                <i class="fas fa-spinner fa-spin mr-2"></i>
                좌석배치도를 불러오는 중...
            </div>
            <iframe id="seat-map-frame" src="" frameborder="0" style="display: none;"></iframe>
        </div>
    `;
    
    modalContainer.classList.remove('hidden');
    
    // Reload iframe reference after innerHTML update
    const newIframe = document.getElementById('seat-map-frame');
    const loading = modalContainer.querySelector('div[style*="display: flex"]');
    
    // Set up 3-second timeout for HTTPS security issues (URL이 있는 경우만)
    modalTimeout = setTimeout(() => {
        showSecurityAlert(url);
    }, 3000);
    
    newIframe.onload = () => {
        // Clear timeout if iframe loads successfully
        if (modalTimeout) {
            clearTimeout(modalTimeout);
            modalTimeout = null;
        }
        loading.style.display = 'none';
        newIframe.style.display = 'block';
    };
    
    newIframe.onerror = () => {
        // Clear timeout and show security alert immediately on error
        if (modalTimeout) {
            clearTimeout(modalTimeout);
            modalTimeout = null;
        }
        showSecurityAlert(url);
    };
    
    newIframe.src = url;
}

function showSecurityAlert(url) {
    const alertHtml = `
        <div id="security-alert" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 2000;
        ">
            <div style="
                background: white;
                border-radius: 12px;
                padding: 30px;
                max-width: 400px;
                text-align: center;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            ">
                <div style="margin-bottom: 20px;">
                    <i class="fas fa-shield-alt" style="font-size: 48px; color: #f59e0b; margin-bottom: 15px;"></i>
                    <h3 style="margin: 0 0 10px 0; color: #1f2937;">보안 문제 감지</h3>
                    <p style="margin: 0; color: #6b7280; line-height: 1.5;">HTTPS 보안 정책으로 인해 <br>좌석배치도를 불러올 수 없습니다.<br>새 창에서 열어보시겠습니까?</p>
                </div>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="wait-button" style="
                        padding: 10px 20px;
                        background: #6b7280;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        transition: background-color 0.2s;
                    ">기다리기</button>
                    <button id="open-new-window-button" style="
                        padding: 10px 20px;
                        background: #3b82f6;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        transition: background-color 0.2s;
                    ">새창열기</button>
                </div>
            </div>
        </div>
    `;
    
    // Add alert to document body
    document.body.insertAdjacentHTML('beforeend', alertHtml);
    
    // Add hover effects
    const waitButton = document.getElementById('wait-button');
    const openNewWindowButton = document.getElementById('open-new-window-button');
    
    waitButton.addEventListener('mouseenter', () => {
        waitButton.style.backgroundColor = '#4b5563';
    });
    waitButton.addEventListener('mouseleave', () => {
        waitButton.style.backgroundColor = '#6b7280';
    });
    
    openNewWindowButton.addEventListener('mouseenter', () => {
        openNewWindowButton.style.backgroundColor = '#2563eb';
    });
    openNewWindowButton.addEventListener('mouseleave', () => {
        openNewWindowButton.style.backgroundColor = '#3b82f6';
    });
    
    // Event listeners for buttons
    waitButton.addEventListener('click', () => {
        closeSecurityAlert();
    });
    
    openNewWindowButton.addEventListener('click', () => {
        window.open(url, '_blank', 'noopener,noreferrer');
        closeSecurityAlert();
        closeModal(); // Close the original modal as well
    });
}

function closeSecurityAlert() {
    const alertElement = document.getElementById('security-alert');
    if (alertElement) {
        alertElement.remove();
    }
}

function closeModal() {
    // Clear any active timeout
    if (modalTimeout) {
        clearTimeout(modalTimeout);
        modalTimeout = null;
    }
    
    // Close security alert if it exists
    closeSecurityAlert();
    
    // Close the modal
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) {
        // Safely clear iframe if it exists
        const iframe = document.getElementById('seat-map-frame');
        if (iframe) {
            iframe.src = '';
        }
        modalContainer.classList.add('hidden');
    }
    
    // Reset current modal URL
    currentModalUrl = null;
}

// 이벤트 위임을 사용하여 동적으로 생성된 닫기 버튼도 처리
document.addEventListener('click', function(event) {
    console.log('Document click detected:', event.target);
    
    // 닫기 버튼 클릭 처리 - 다양한 선택자로 강화
    if (event.target.id === 'modal-close' || 
        event.target.classList.contains('modal-close-btn') ||
        event.target.matches('#modal-close') ||
        event.target.matches('.modal-close-btn')) {
        console.log('Modal close button clicked!');
        event.preventDefault();
        event.stopPropagation();
        closeModal();
        return;
    }
    
    // 모달 바깥 배경 클릭 처리
    if (event.target.id === 'modal-container' || event.target.matches('#modal-container')) {
        console.log('Modal background clicked!');
        event.preventDefault();
        event.stopPropagation();
        closeModal();
        return;
    }
}, true); // 캐처링 단계에서 이벤트 처리

// ESC 키로 모달 닫기 (대체 방법)
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' || event.keyCode === 27) {
        const modalContainer = document.getElementById('modal-container');
        if (modalContainer && !modalContainer.classList.contains('hidden')) {
            console.log('ESC key pressed - closing modal');
            event.preventDefault();
            closeModal();
        }
    }
});
async function initialize() {
    console.log('Initializing application...');
    
    try {
        // 즉시 데스크톱 사이드바 초기화 (다른 모든 것보다 먼저)
        if (window.innerWidth > 768) {
            initDesktopSidebar();
            initializeSidebarForScreenSize();
            console.log('데스크톱 사이드바 우선 초기화 완료');
        }
        
        // 좌석배치도 데이터와 도서관 데이터를 동시에 로드하되 모두 완료될 때까지 대기
        console.log('Starting parallel data fetch...');
        await Promise.all([
            fetchSeatMapData(),
            fetchLibraries()
        ]);
        console.log('All data fetched successfully - seatMapData and libraries loaded');
        
        // 데이터 로딩 완료 후 UI 업데이트
        createBubbleButtons();
        console.log('Bubble buttons created');
        
        // 다시 한 번 데스크톱 사이드바 확인
        if (window.innerWidth > 768) {
            setTimeout(() => {
                initDesktopSidebar();
                initializeSidebarForScreenSize();
                console.log('데스크톱 사이드바 재초기화 완료');
            }, 100);
        }
        
        // DOM이 준비된 후 헤더 클릭 초기화 (모바일용)
        setTimeout(() => {
            if (window.innerWidth <= 768) {
                addHeaderClickToggle();
                initMobileDragFeature(); // 모바일 드래그 기능 초기화 추가
                console.log('Header click toggle and mobile drag feature added for mobile');
            }
        }, 100);
        
    } catch (error) {
        console.error('Error during initialization:', error);
    }
}

// h1 요소 클릭 토글 기능 (드래그 기능 제거)
function addHeaderClickToggle() {
    const sidebar = document.getElementById('sidebar');
    const h1Element = document.querySelector('.sidebar-header h1');
    
    if (!sidebar || !h1Element) {
        console.error('Sidebar or h1 element not found');
        return;
    }
    
    console.log('Header click toggle initialized');
    
    // 초기 위치 설정
    function initializePosition() {
        sidebar.style.position = 'fixed';
        sidebar.style.bottom = 'auto';
        sidebar.style.top = (window.innerHeight - 80) + 'px'; // 축소된 위치로 시작
        sidebar.style.transition = 'none';
        
        // 축소된 상태 클래스 추가
        sidebar.classList.add('collapsed');
        sidebar.classList.remove('expanded');
        
        console.log('Initial position set to collapsed');
    }
    
    // h1 요소에만 클릭 이벤트 리스너 추가
    h1Element.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('H1 clicked!');
        
        // 모바일 환경에서만 동작하도록 제한
        if (window.innerWidth > 768) {
            console.log('Desktop mode - toggle disabled');
            return;
        }
        
        // 현재 상태 확인
        const isExpanded = sidebar.classList.contains('expanded') || 
                          parseInt(sidebar.style.top) <= window.innerHeight * 0.4;
        
        console.log('Current state - isExpanded:', isExpanded);
        
        if (isExpanded) {
            // Collapse the sidebar
            console.log('Collapsing sidebar');
            sidebar.classList.remove('expanded');
            sidebar.classList.add('collapsed');
            sidebar.style.top = (window.innerHeight - 80) + 'px';
            sidebar.style.transition = 'top 0.3s ease';
        } else {
            // Expand the sidebar
            console.log('Expanding sidebar');
            sidebar.classList.remove('collapsed');
            sidebar.classList.add('expanded');
            sidebar.style.top = (window.innerHeight * 0.25) + 'px';
            sidebar.style.transition = 'top 0.3s ease';
        }
        
        // 애니메이션 완료 후 transition 제거
        setTimeout(() => {
            sidebar.style.transition = 'none';
            console.log('Animation completed');
        }, 300);
    });
    
    // 화면 크기 변경 시 위치 재조정
    window.addEventListener('resize', () => {
        const isExpanded = sidebar.classList.contains('expanded');
        if (isExpanded) {
            sidebar.style.top = (window.innerHeight * 0.25) + 'px';
        } else {
            sidebar.style.top = (window.innerHeight - 80) + 'px';
        }
    });
    
    // 초기화
    initializePosition();
}

initialize();
// --- 시도 선택 접기/펼치기 기능 추가 ---
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired');
    
    // PC 버전 사이드바 초기화
    initDesktopSidebar();
    initializeSidebarForScreenSize();
    
    // 모바일 인터렉션 초기화
    initMobileInteractions();
    
    // 헤더 클릭 토글 기능 다시 초기화 (확실히 동작하도록)
    setTimeout(() => {
        addHeaderClickToggle();
        console.log('Header click toggle re-initialized in DOMContentLoaded');
    }, 200);
    
    const cityLabel = document.querySelector('.city-select-label');
    const cityButtonsContainer = document.getElementById('city-buttons');
    if (!cityLabel || !cityButtonsContainer) return;

    let isCollapsed = false;
    cityLabel.addEventListener('click', () => {
        isCollapsed = !isCollapsed;
        cityButtonsContainer.style.display = isCollapsed ? 'none' : 'grid';
    });
    
    // 화면 크기 변경 시 사이드바 재초기화
    window.addEventListener('resize', () => {
        initializeSidebarForScreenSize();
    });
});

// 테스트 함수 - 브라우저 콘솔에서 모달 테스트용
window.testModal = function(url) {
    console.log('Manual modal test triggered with URL:', url);
    openModal(url || 'https://www.google.com');
};

window.testCloseModal = function() {
    console.log('Manual close modal test triggered');
    closeModal();
};

window.debugModalState = function() {
    const modalContainer = document.getElementById('modal-container');
    const modalClose = document.getElementById('modal-close');
    console.log('Modal debug state:', {
        modalContainer: modalContainer ? 'found' : 'not found',
        modalContainerHidden: modalContainer ? modalContainer.classList.contains('hidden') : 'N/A',
        modalClose: modalClose ? 'found' : 'not found',
        modalCloseClasses: modalClose ? modalClose.className : 'N/A'
    });
};