// 전역 변수 선언
let map = null; // 지도 객체는 초기화 후에 생성
let allLibraries = [];
let markers = [];
let seatMapData = {};

// 간단하고 안정적인 지도 초기화 함수
function initializeMap() {
    console.log('지도 초기화 시작...');
    
    // DOM 요소 확인
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error('지도 컨테이너를 찾을 수 없습니다');
        return false;
    }
    
    // 네이버 지도 API 확인
    if (typeof naver === 'undefined' || !naver.maps) {
        console.error('네이버 지도 API가 로드되지 않았습니다');
        return false;
    }
    
    try {
        // 간단한 지도 생성
        map = new naver.maps.Map('map', {
            center: new naver.maps.LatLng(37.5665, 126.9780),
            zoom: 10
        });
        
        // 지도 크기 문제 해결을 위한 강제 리사이즈
        setTimeout(() => {
            if (map) {
                // 지도 컨테이너 크기 재계산
                naver.maps.Event.trigger(map, 'resize');
                console.log('지도 리사이즈 이벤트 트리거');
            }
        }, 200);
        
        console.log('네이버 지도 초기화 성공');
        return true;
    } catch (error) {
        console.error('지도 생성 중 오류:', error);
        return false;
    }
}

// 캐시 시스템 (분 단위 캐시)
const CACHE_DURATION = 5 * 60 * 1000; // 5분

function setCachedData(key, data) {
    try {
        const cacheItem = {
            data: data,
            timestamp: Date.now()
        };
        localStorage.setItem(`opendata_${key}`, JSON.stringify(cacheItem));
        console.log(`데이터 캐시 저장: ${key}`);
    } catch (error) {
        console.warn('캐시 저장 실패:', error);
    }
}

function getCachedData(key) {
    try {
        const cached = localStorage.getItem(`opendata_${key}`);
        if (!cached) return null;
        
        const cacheItem = JSON.parse(cached);
        const now = Date.now();
        
        if (now - cacheItem.timestamp < CACHE_DURATION) {
            console.log(`캐시된 데이터 사용: ${key}`);
            return cacheItem.data;
        } else {
            // 만료된 캐시 삭제
            localStorage.removeItem(`opendata_${key}`);
            console.log(`만료된 캐시 삭제: ${key}`);
            return null;
        }
    } catch (error) {
        console.warn('캐시 로드 실패:', error);
        return null;
    }
}

// 로딩 인디케이터 기능
function showLoadingIndicator() {
    const existingLoader = document.getElementById('loading-indicator');
    if (existingLoader) return;
    
    const loader = document.createElement('div');
    loader.id = 'loading-indicator';
    loader.innerHTML = `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            backdrop-filter: blur(5px);
        ">
            <div style="
                text-align: center;
                color: #333;
                font-family: 'Noto Sans KR', sans-serif;
            ">
                <div style="
                    width: 50px;
                    height: 50px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #3b82f6;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 16px;
                "></div>
                <div style="font-size: 16px; font-weight: 500;">도서관 데이터 로딩 중...</div>
                <div style="font-size: 14px; color: #666; margin-top: 8px;">잠시만 기다려주세요</div>
            </div>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    document.body.appendChild(loader);
}

function hideLoadingIndicator() {
    const loader = document.getElementById('loading-indicator');
    if (loader) {
        loader.remove();
    }
}

function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.id = 'error-message';
    errorDiv.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #fee;
            color: #c53030;
            padding: 16px 24px;
            border-radius: 8px;
            border: 1px solid #feb2b2;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            z-index: 10000;
            font-family: 'Noto Sans KR', sans-serif;
            max-width: 90%;
        ">
            <div style="display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    margin-left: 12px;
                    background: none;
                    border: none;
                    color: #c53030;
                    cursor: pointer;
                    font-size: 18px;
                ">&times;</button>
            </div>
        </div>
    `;
    document.body.appendChild(errorDiv);
    
    // 5초 후 자동 제거
    setTimeout(() => {
        if (errorDiv && errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 5000);
}

// 백그라운드 데이터 새로고침
async function refreshDataInBackground() {
    console.log('백그라운드에서 데이터 새로고침 시작...');
    try {
        const [newSeatMapData, newLibraries] = await Promise.all([
            fetchSeatMapDataSilent(),
            fetchLibrariesSilent()
        ]);
        
        // 새 데이터로 업데이트
        if (newLibraries && newLibraries.length > 0) {
            allLibraries = newLibraries;
            setCachedData('libraries', allLibraries);
            
            // UI 업데이트
            displayLibraries(allLibraries);
            updateStatistics(allLibraries);
            generateCityButtons(allLibraries);
            setUpdateTime();
            
            console.log('백그라운드 데이터 새로고침 완료');
        }
        
        if (newSeatMapData) {
            seatMapData = newSeatMapData;
            setCachedData('seatMap', seatMapData);
        }
    } catch (error) {
        console.warn('백그라운드 새로고침 실패:', error);
    }
}

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
        
        // 터치와 마우스 이벤트 모두 처리
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
            currentTop: currentTop,
            touchType: e.type
        });
        
        // 이벤트 전파 방지 (더 강력하게)
        e.preventDefault();
        e.stopPropagation();
        
        // iOS Safari에서 추가 처리
        if (e.touches) {
            e.stopImmediatePropagation();
        }
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
        
        // 더 강력한 스크롤 방지
        e.preventDefault();
        e.stopPropagation();
        
        // iOS Safari에서 추가 처리
        if (e.touches) {
            e.stopImmediatePropagation();
        }
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
        
        // 이벤트 전파 방지
        e.preventDefault();
        
        console.log('드래그 종료:', {
            finalState: targetState,
            velocity: velocity,
            currentPosition: currentPosition
        });
    }
    
    // 이벤트 리스너 등록 (터치와 마우스 모두 지원)
    // 모바일에서 더 안정적인 터치 이벤트 처리
    
    // 드래그 핸들에 터치 이벤트 등록
    dragHandle.addEventListener('touchstart', handleStart, { 
        passive: false, 
        capture: true 
    });
    dragHandle.addEventListener('touchmove', handleMove, { 
        passive: false, 
        capture: true 
    });
    dragHandle.addEventListener('touchend', handleEnd, { 
        passive: false, 
        capture: true 
    });
    dragHandle.addEventListener('touchcancel', handleEnd, { 
        passive: false, 
        capture: true 
    });
    
    // 사이드바 전체에도 터치 이벤트 등록 (드래그 영역 확장)
    sidebar.addEventListener('touchstart', function(e) {
        // 사이드바 상단 영역 (100px)에서만 드래그 허용
        const rect = sidebar.getBoundingClientRect();
        const touchY = e.touches[0].clientY;
        const relativeY = touchY - rect.top;
        
        if (relativeY <= 100) {
            handleStart(e);
        }
    }, { passive: false, capture: true });
    
    sidebar.addEventListener('touchmove', function(e) {
        if (isDragging) {
            handleMove(e);
        }
    }, { passive: false, capture: true });
    
    sidebar.addEventListener('touchend', function(e) {
        if (isDragging) {
            handleEnd(e);
        }
    }, { passive: false, capture: true });
    
    // 마우스 이벤트도 지원 (데스크톱 테스트용)
    dragHandle.addEventListener('mousedown', handleStart);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    
    // iOS Safari 호환성을 위한 추가 처리 (강화됨)
    dragHandle.style.touchAction = 'pan-y';
    dragHandle.style.webkitTouchCallout = 'none';
    dragHandle.style.webkitUserSelect = 'none';
    dragHandle.style.webkitTapHighlightColor = 'transparent';
    dragHandle.style.userSelect = 'none';
    dragHandle.style.msUserSelect = 'none';
    dragHandle.style.mozUserSelect = 'none';
    
    // 사이드바에도 동일한 속성 적용
    sidebar.style.touchAction = 'pan-y';
    sidebar.style.webkitOverflowScrolling = 'touch';
    sidebar.style.webkitTransform = 'translate3d(0,0,0)'; // 하드웨어 가속 활성화
    
    // 시각적 피드백을 위한 추가 스타일
    dragHandle.style.cursor = 'grab';
    dragHandle.style.willChange = 'background-color';
    
    // 드래그 중 커서 변경
    const originalCursor = dragHandle.style.cursor;
    
    // 드래그 시작 시 커서 변경 이벤트
    dragHandle.addEventListener('touchstart', function() {
        dragHandle.style.cursor = 'grabbing';
    }, { passive: true });
    
    dragHandle.addEventListener('touchend', function() {
        dragHandle.style.cursor = originalCursor;
    }, { passive: true });
    
    // 디버깅을 위한 콘솔 로그 추가
    console.log('모바일 드래그 기능 초기화 완료');
    console.log('드래그 핸들 요소:', dragHandle);
    console.log('사이드바 요소:', sidebar);
    console.log('현재 화면 크기:', window.innerWidth, 'x', window.innerHeight);
    
    // 초기 상태 설정 (마지막에 실행)
    snapToPosition('collapsed', false);
}

// 플로팅 버튼 초기화 함수
function initFloatingButtons() {
    const floatingButtons = document.querySelectorAll('.floating-btn');
    
    floatingButtons.forEach((button, index) => {
        button.addEventListener('click', function() {
            const title = this.getAttribute('title');
            console.log('플로팅 버튼 클릭:', title);
            
            switch(title) {
                case '위치':
                    // 사용자 위치 요청 기능
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(function(position) {
                            const lat = position.coords.latitude;
                            const lng = position.coords.longitude;
                            
                            if (window.map) {
                                map.setCenter(new naver.maps.LatLng(lat, lng));
                                map.setZoom(15);
                                
                                // 사용자 위치 마커 추가
                                new naver.maps.Marker({
                                    position: new naver.maps.LatLng(lat, lng),
                                    map: map,
                                    title: '내 위치',
                                    icon: {
                                        content: '<div style="background: #ff4444; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                                        anchor: new naver.maps.Point(6, 6)
                                    }
                                });
                                
                                console.log('사용자 위치로 이동:', lat, lng);
                            }
                        }, function(error) {
                            console.error('위치 정보를 가져올 수 없습니다:', error);
                            alert('위치 정보를 가져올 수 없습니다. 브라우저에서 위치 권한을 허용해주세요.');
                        });
                    } else {
                        alert('이 브라우저는 위치 서비스를 지원하지 않습니다.');
                    }
                    break;
                    
                case '즐겨찾기':
                    // 즐겨찾기 기능 (추후 구현)
                    console.log('즐겨찾기 기능 - 추후 구현 예정');
                    alert('즐겨찾기 기능은 추후 추가될 예정입니다.');
                    break;
                    
                case '레이어':
                    // 레이어 토글 기능 (추후 구현)
                    console.log('레이어 기능 - 추후 구현 예정');
                    alert('레이어 기능은 추후 추가될 예정입니다.');
                    break;
                    
                default:
                    console.log('알 수 없는 버튼:', title);
            }
        });
    });
    
    console.log('플로팅 버튼 초기화 완료:', floatingButtons.length, '개 버튼');
}

// Mobile interaction initialization for responsive design
function initMobileInteractions() {
    const sidebar = document.getElementById('sidebar');
    const mobileToggle = document.getElementById('mobile-toggle');
    
    // 모바일 드래그 기능 초기화
    initMobileDragFeature();
    
    // 플로팅 버튼 초기화
    initFloatingButtons();
    
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

// 백그라운드 데이터 로딩용 (Silent 버전)
async function fetchSeatMapDataSilent() {
    try {
        const response = await fetch(`https://raw.githubusercontent.com/Dev-zeno/opendata_plr/refs/heads/main/library_data.json?t=${Date.now()}`, { 
            cache: 'no-store',
            headers: {
                'User-Agent': 'OpenData-Library-App/1.0'
            }
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        const processedData = {};
        
        if (data && Array.isArray(data)) {
            data.forEach((item) => {
                if (item.stdgCd && item.pblibId && item.rdrmId && item.rdrmUrl) {
                    const key = `${item.stdgCd}_${item.pblibId}_${item.rdrmId}`;
                    processedData[key] = {
                        url: item.rdrmUrl,
                        rdrmNm: item.rdrmNm || '열람실',
                        pblibNm: item.pblibNm || '도서관'
                    };
                }
            });
        }
        
        return processedData;
    } catch (error) {
        console.warn('Silent seat map data fetch failed:', error);
        return null;
    }
}

async function fetchLibrariesSilent() {
    try {
        const [libraryResponse, readingRoomResponse] = await Promise.all([
            fetch(`/api/proxy?t=${Date.now()}`, { cache: 'no-store' }),
            fetch(`/api/proxy-reading-room?t=${Date.now()}`, { cache: 'no-store' })
        ]);
        
        const [libraryData, readingRoomData] = await Promise.all([
            libraryResponse.json(),
            readingRoomResponse.json()
        ]);
        
        if (libraryData?.body?.item && readingRoomData?.body?.item) {
            const validLibraries = libraryData.body.item.filter(lib => 
                lib.pblibId && String(lib.pblibId).trim() !== '' && lib.stdgCd && String(lib.stdgCd).trim() !== ''
            );
            const validReadingRooms = readingRoomData.body.item.filter(room => 
                room.pblibId && String(room.pblibId).trim() !== '' && room.stdgCd && String(room.stdgCd).trim() !== ''
            );
            
            const readingRoomMap = new Map();
            validReadingRooms.forEach(room => {
                const key = `${String(room.stdgCd).trim()}_${String(room.pblibId).trim()}`;
                if (!readingRoomMap.has(key)) {
                    readingRoomMap.set(key, []);
                }
                readingRoomMap.get(key).push(room);
            });
            
            return validLibraries.map(lib => {
                const key = `${String(lib.stdgCd).trim()}_${String(lib.pblibId).trim()}`;
                return {
                    ...lib,
                    readingRooms: readingRoomMap.get(key) || []
                };
            });
        }
        
        return null;
    } catch (error) {
        console.warn('Silent library data fetch failed:', error);
        return null;
    }
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
                // 시도 클릭 시 시군구 목록 표시로 변경
                showDistrictButtons(sido, libraries);
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
                // 모바일에서는 모달 오픈으로 변경
                if (isMobileDevice()) {
                    openMobileDistrictModal(sido, libraries);
                } else {
                    // PC에서는 기존 로직 유지 (이 코드는 실제로 실행되지 않음)
                    showDistrictButtons(sido, libraries);
                }
            });
            mobileCityButtonsContainer.appendChild(mobileBtn);
        }
    });
}

// 시군구 버튼들을 생성하고 표시하는 함수
function showDistrictButtons(selectedSido, libraries) {
    const cityContainer = document.getElementById('city-selection-container');
    const districtContainer = document.getElementById('district-selection-container');
    const currentCityName = document.getElementById('current-city-name');
    const districtButtons = document.getElementById('district-buttons');
    
    if (!cityContainer || !districtContainer || !currentCityName || !districtButtons) {
        console.error('필요한 DOM 요소를 찾을 수 없습니다');
        return;
    }
    
    // 시도 이름을 간단히 표시
    const abbrMap = {
        '서울특별시':'서울','부산광역시':'부산','대구광역시':'대구','인천광역시':'인천',
        '광주광역시':'광주','대전광역시':'대전','울산광역시':'울산','세종특별자치시':'세종',
        '경기도':'경기','강원특별자치도':'강원','충청북도':'충북','충청남도':'충남',
        '전북특별자치도':'전북','전라남도':'전남','경상북도':'경북','경상남도':'경남','제주특별자치도':'제주'
    };
    const cityDisplayName = abbrMap[selectedSido] || selectedSido.replace(/(특별시|광역시|특별자치시|특별자치도|도)$/,'');
    currentCityName.textContent = cityDisplayName;
    
    // 해당 시도의 도서관들만 필터링
    const sidoLibraries = libraries.filter(lib => 
        lib.pblibRoadNmAddr && lib.pblibRoadNmAddr.startsWith(selectedSido)
    );
    
    // 시군구별 도서관 개수 집계
    const districtCounts = new Map();
    sidoLibraries.forEach(lib => {
        if (lib.pblibRoadNmAddr) {
            const parts = lib.pblibRoadNmAddr.split(' ');
            if (parts.length > 1) {
                const district = parts[1];
                districtCounts.set(district, (districtCounts.get(district) || 0) + 1);
            }
        }
    });
    
    // 시군구 버튼들 생성
    districtButtons.innerHTML = '';
    
    // "전체" 버튼 먼저 추가
    const allBtn = document.createElement('button');
    allBtn.className = 'district-btn active';
    allBtn.innerHTML = `전체 <span class="count">${sidoLibraries.length}</span>`;
    allBtn.addEventListener('click', () => {
        // 모든 시군구 버튼 비활성화
        document.querySelectorAll('.district-btn').forEach(btn => btn.classList.remove('active'));
        allBtn.classList.add('active');
        
        // 해당 시도의 모든 도서관 표시
        displayLibraries(sidoLibraries);
        updateStatistics(sidoLibraries);
        updateRegionLabel(`${cityDisplayName} 도서관`);
        
        // 지도 이동
        if (sidoLibraries.length > 0) {
            const bounds = new naver.maps.LatLngBounds();
            sidoLibraries.forEach(lib => {
                const lat = parseFloat(lib.lat);
                const lon = parseFloat(lib.lot);
                if (!isNaN(lat) && !isNaN(lon)) {
                    bounds.extend(new naver.maps.LatLng(lat, lon));
                }
            });
            map.fitBounds(bounds);
        }
    });
    districtButtons.appendChild(allBtn);
    
    // 시군구별 버튼들 생성 (도서관이 있는 곳만)
    Array.from(districtCounts.entries())
        .sort(([a], [b]) => a.localeCompare(b, 'ko'))
        .forEach(([district, count]) => {
            const btn = document.createElement('button');
            btn.className = 'district-btn';
            btn.innerHTML = `${district} <span class="count">${count}</span>`;
            btn.setAttribute('data-district', district);
            
            btn.addEventListener('click', () => {
                // 모든 시군구 버튼 비활성화
                document.querySelectorAll('.district-btn').forEach(btn => btn.classList.remove('active'));
                btn.classList.add('active');
                
                // 해당 시군구 도서관들만 필터링
                const districtLibraries = sidoLibraries.filter(lib => 
                    lib.pblibRoadNmAddr && lib.pblibRoadNmAddr.split(' ')[1] === district
                );
                
                displayLibraries(districtLibraries);
                updateStatistics(districtLibraries);
                updateRegionLabel(`${cityDisplayName} ${district} 도서관`);
                
                // 지도 이동
                if (districtLibraries.length > 0) {
                    const bounds = new naver.maps.LatLngBounds();
                    districtLibraries.forEach(lib => {
                        const lat = parseFloat(lib.lat);
                        const lon = parseFloat(lib.lot);
                        if (!isNaN(lat) && !isNaN(lon)) {
                            bounds.extend(new naver.maps.LatLng(lat, lon));
                        }
                    });
                    map.fitBounds(bounds);
                }
            });
            
            districtButtons.appendChild(btn);
        });
    
    // UI 전환
    cityContainer.classList.add('hidden');
    districtContainer.classList.remove('hidden');
    
    // 기본적으로 전체 선택 상태로 시작
    displayLibraries(sidoLibraries);
    updateStatistics(sidoLibraries);
    updateRegionLabel(`${cityDisplayName} 도서관`);
    
    // 지도 이동
    if (sidoLibraries.length > 0) {
        const bounds = new naver.maps.LatLngBounds();
        sidoLibraries.forEach(lib => {
            const lat = parseFloat(lib.lat);
            const lon = parseFloat(lib.lot);
            if (!isNaN(lat) && !isNaN(lon)) {
                bounds.extend(new naver.maps.LatLng(lat, lon));
            }
        });
        map.fitBounds(bounds);
    }
}

// 지역 라벨 업데이트 함수
function updateRegionLabel(labelText) {
    const regionLabelEl = document.querySelector('#total-libraries')?.nextElementSibling;
    if (regionLabelEl) {
        regionLabelEl.textContent = labelText;
    }
}

// 시도 선택으로 돌아가는 함수
function backToCitySelection() {
    const cityContainer = document.getElementById('city-selection-container');
    const districtContainer = document.getElementById('district-selection-container');
    
    if (cityContainer && districtContainer) {
        // UI 전환
        districtContainer.classList.add('hidden');
        cityContainer.classList.remove('hidden');
        
        // 전체 도서관 표시
        displayLibraries(allLibraries);
        updateStatistics(allLibraries);
        updateRegionLabel('전국 도서관');
        
        // 지도를 전국 범위로 초기화
        if (allLibraries.length > 0) {
            const bounds = new naver.maps.LatLngBounds();
            allLibraries.forEach(lib => {
                const lat = parseFloat(lib.lat);
                const lon = parseFloat(lib.lot);
                if (!isNaN(lat) && !isNaN(lon)) {
                    bounds.extend(new naver.maps.LatLng(lat, lon));
                }
            });
            map.fitBounds(bounds);
        }
    }
}

// 모바일 시군구 선택 모달 열기
function openMobileDistrictModal(selectedSido, libraries) {
    if (!isMobileDevice()) {
        console.log('모바일 환경이 아닙니다');
        return;
    }
    
    const modal = document.getElementById('mobile-district-modal');
    const currentCityName = document.getElementById('mobile-current-city-name');
    const allDistrictsBtn = document.getElementById('mobile-all-districts');
    const districtList = document.getElementById('mobile-district-list');
    
    if (!modal || !currentCityName || !allDistrictsBtn || !districtList) {
        console.error('모바일 모달 요소를 찾을 수 없습니다');
        return;
    }
    
    // 시도 이름 설정
    const abbrMap = {
        '서울특별시':'서울','부산광역시':'부산','대구광역시':'대구','인천광역시':'인천',
        '광주광역시':'광주','대전광역시':'대전','울산광역시':'울산','세종특별자치시':'세종',
        '경기도':'경기','강원특별자치도':'강원','충청북도':'충북','충청남도':'충남',
        '전북특별자치도':'전북','전라남도':'전남','경상북도':'경북','경상남도':'경남','제주특별자치도':'제주'
    };
    const cityDisplayName = abbrMap[selectedSido] || selectedSido.replace(/(특별시|광역시|특별자치시|특별자치도|도)$/,'');
    currentCityName.textContent = cityDisplayName;
    
    // 해당 시도의 도서관들만 필터링
    const sidoLibraries = libraries.filter(lib => 
        lib.pblibRoadNmAddr && lib.pblibRoadNmAddr.startsWith(selectedSido)
    );
    
    // 전체 버튼 설정
    allDistrictsBtn.innerHTML = `전체 <span class="count">${sidoLibraries.length}</span>`;
    allDistrictsBtn.classList.add('selected');
    
    // 시군구별 도서관 개수 집계
    const districtCounts = new Map();
    sidoLibraries.forEach(lib => {
        if (lib.pblibRoadNmAddr) {
            const parts = lib.pblibRoadNmAddr.split(' ');
            if (parts.length > 1) {
                const district = parts[1];
                districtCounts.set(district, (districtCounts.get(district) || 0) + 1);
            }
        }
    });
    
    // 시군구 버튼들 생성
    districtList.innerHTML = '';
    
    Array.from(districtCounts.entries())
        .sort(([a], [b]) => a.localeCompare(b, 'ko'))
        .forEach(([district, count]) => {
            const btn = document.createElement('button');
            btn.className = 'mobile-district-btn';
            btn.innerHTML = `${district} <span class="count">${count}</span>`;
            btn.setAttribute('data-district', district);
            
            btn.addEventListener('click', () => {
                // 모든 버튼 선택 해제
                document.querySelectorAll('.mobile-district-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                
                // 해당 시군구 도서관들만 필터링
                const districtLibraries = sidoLibraries.filter(lib => 
                    lib.pblibRoadNmAddr && lib.pblibRoadNmAddr.split(' ')[1] === district
                );
                
                displayLibraries(districtLibraries);
                updateStatistics(districtLibraries);
                updateRegionLabel(`${cityDisplayName} ${district} 도서관`);
                
                // 지도 이동
                if (districtLibraries.length > 0) {
                    const bounds = new naver.maps.LatLngBounds();
                    districtLibraries.forEach(lib => {
                        const lat = parseFloat(lib.lat);
                        const lon = parseFloat(lib.lot);
                        if (!isNaN(lat) && !isNaN(lon)) {
                            bounds.extend(new naver.maps.LatLng(lat, lon));
                        }
                    });
                    map.fitBounds(bounds);
                }
                
                // 모바일에서 사이드바 자동 축소
                collapseSidebarOnMobile();
                
                // 300ms 후 모달 닫기
                setTimeout(() => {
                    closeMobileDistrictModal();
                }, 300);
            });
            
            districtList.appendChild(btn);
        });
    
    // 전체 버튼 이벤트
    allDistrictsBtn.onclick = () => {
        // 모든 버튼 선택 해제
        document.querySelectorAll('.mobile-district-btn').forEach(b => b.classList.remove('selected'));
        allDistrictsBtn.classList.add('selected');
        
        // 해당 시도의 모든 도서관 표시
        displayLibraries(sidoLibraries);
        updateStatistics(sidoLibraries);
        updateRegionLabel(`${cityDisplayName} 도서관`);
        
        // 지도 이동
        if (sidoLibraries.length > 0) {
            const bounds = new naver.maps.LatLngBounds();
            sidoLibraries.forEach(lib => {
                const lat = parseFloat(lib.lat);
                const lon = parseFloat(lib.lot);
                if (!isNaN(lat) && !isNaN(lon)) {
                    bounds.extend(new naver.maps.LatLng(lat, lon));
                }
            });
            map.fitBounds(bounds);
        }
        
        // 모바일에서 사이드바 자동 축소
        collapseSidebarOnMobile();
        
        // 300ms 후 모달 닫기
        setTimeout(() => {
            closeMobileDistrictModal();
        }, 300);
    };
    
    // 모달 표시
    modal.classList.remove('hidden');
    
    // body 스크롤 방지
    document.body.style.overflow = 'hidden';
    
    console.log(`모바일 시군구 모달 오픈: ${cityDisplayName}`);
}

// 모바일 시군구 선택 모달 닫기
function closeMobileDistrictModal() {
    const modal = document.getElementById('mobile-district-modal');
    if (modal) {
        modal.classList.add('hidden');
        
        // body 스크롤 복원
        document.body.style.overflow = '';
        
        console.log('모바일 시군구 모달 닫힘');
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
    
    // Add null check to prevent error if element doesn't exist
    if (!bubbleContainer) {
        console.warn('bubble-container element not found - skipping bubble button creation');
        return;
    }
    
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
    
    // 1. 즉시 UI 표시 (가장 빠른 시각적 피드백)
    showLoadingIndicator();
    
    try {
        // 2. 네이버 지도 초기화 (가장 중요!)
        console.log('네이버 지도 초기화 시작...');
        const mapInitSuccess = initializeMap();
        if (!mapInitSuccess) {
            throw new Error('네이버 지도 초기화 실패');
        }
        console.log('네이버 지도 초기화 성공');
        
        // 3. 기본 UI 구성 요소 초기화
    if (window.innerWidth > 768) {
        initDesktopSidebar();
        initializeSidebarForScreenSize();
        console.log('데스크톱 사이드바 우선 초기화 완료');
    } else {
        // 모바일 인터렉션 먼저 초기화
        initMobileInteractions();
        console.log('모바일 인터렉션 초기화 완료');
    }
    
        // 4. 업데이트 시간 먼저 표시 (정적 콘텐츠)
        setUpdateTime();
        
        // 5. 비동기 데이터 로딩 시작 (백그라운드에서)
        console.log('Starting parallel data fetch...');
        
        // 캐시된 데이터가 있는지 먼저 확인
        const cachedLibraries = getCachedData('libraries');
        const cachedSeatMap = getCachedData('seatMap');
        
        if (cachedLibraries && cachedSeatMap) {
            console.log('Using cached data for faster loading');
            allLibraries = cachedLibraries;
            seatMapData = cachedSeatMap;
            
            // 캐시된 데이터로 즉시 UI 업데이트
            displayLibraries(allLibraries);
            updateStatistics(allLibraries);
            generateCityButtons(allLibraries);
            createBubbleButtons();
            hideLoadingIndicator();
            
            // 백그라운드에서 데이터 새로고침
            refreshDataInBackground();
        } else {
            // 캐시가 없으면 새로 로드
            await Promise.all([
                fetchSeatMapData(),
                fetchLibraries()
            ]);
            
            // 데이터를 캐시에 저장
            setCachedData('libraries', allLibraries);
            setCachedData('seatMap', seatMapData);
            
            console.log('All data fetched successfully - seatMapData and libraries loaded');
            
            // 5. 데이터 로딩 완료 후 UI 업데이트
            createBubbleButtons();
            hideLoadingIndicator();
        }
        
        // 6. 추가 초기화 작업 (지연 실행)
        setTimeout(() => {
            if (window.innerWidth > 768) {
                initDesktopSidebar();
                initializeSidebarForScreenSize();
            }
            // 모바일 초기화는 이미 완료됨, 헤더 클릭 토글은 DOMContentLoaded에서 처리
            console.log('추가 초기화 작업 완료 - 중복 방지');
        }, 100);
        
    } catch (error) {
        console.error('Error during initialization:', error);
        hideLoadingIndicator();
        
        // 지도 로드 실패 시 사용자에게 명확한 메시지 표시
        if (error.message.includes('네이버 지도')) {
            showErrorMessage('네이버 지도를 로드할 수 없습니다. 네트워크 연결을 확인하고 페이지를 새로고침해주세요.');
        } else {
            showErrorMessage('응용 프로그램 초기화 중 오류가 발생했습니다. 페이지를 새로고침해주세요.');
        }
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
    
    // 플로팅 버튼 초기화 (전체 화면에서 동작)
    initFloatingButtons();
    
    // 헤더 클릭 토글 기능 다시 초기화 (확실히 동작하도록)
    setTimeout(() => {
        addHeaderClickToggle();
        console.log('Header click toggle re-initialized in DOMContentLoaded');
    }, 200);
    
    // "뒤로" 버튼 이벤트 리스너 추가
    const backButton = document.getElementById('back-to-cities');
    if (backButton) {
        backButton.addEventListener('click', () => {
            console.log('뒤로 버튼 클릭됨 - 시도 선택으로 돌아감');
            backToCitySelection();
        });
        console.log('뒤로 버튼 이벤트 리스너 추가 완료');
    } else {
        console.warn('뒤로 버튼을 찾을 수 없습니다');
    }
    
    // 모바일 모달 닫기 버튼 이벤트 리스너
    const mobileModalClose = document.getElementById('mobile-modal-close');
    if (mobileModalClose) {
        mobileModalClose.addEventListener('click', () => {
            closeMobileDistrictModal();
        });
    }
    
    // 모바일 모달 배경 클릭 시 닫기
    const mobileModalBackdrop = document.querySelector('.mobile-modal-backdrop');
    if (mobileModalBackdrop) {
        mobileModalBackdrop.addEventListener('click', () => {
            closeMobileDistrictModal();
        });
    }
    
    // 모바일 모달 드래그 스와이프 닫기 기능
    const mobileModal = document.getElementById('mobile-district-modal');
    const mobileModalContent = document.querySelector('.mobile-modal-content');
    if (mobileModal && mobileModalContent) {
        let startY = 0;
        let currentY = 0;
        let isDragging = false;
        
        mobileModalContent.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            isDragging = true;
        }, { passive: true });
        
        mobileModalContent.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;
            
            if (deltaY > 0) {
                mobileModalContent.style.transform = `translateY(${Math.min(deltaY, 100)}px)`;
            }
        }, { passive: true });
        
        mobileModalContent.addEventListener('touchend', () => {
            if (!isDragging) return;
            isDragging = false;
            
            const deltaY = currentY - startY;
            
            if (deltaY > 50) {
                // 50px 이상 드래그하면 모달 닫기
                closeMobileDistrictModal();
            } else {
                // 원래 위치로 복원
                mobileModalContent.style.transform = 'translateY(0)';
            }
        }, { passive: true });
    }
    
    const cityLabel = document.querySelector('.city-select-label');
    const cityButtonsContainer = document.getElementById('city-buttons');
    if (!cityLabel || !cityButtonsContainer) return;

    let isCollapsed = false;
    cityLabel.addEventListener('click', () => {
        isCollapsed = !isCollapsed;
        cityButtonsContainer.style.display = isCollapsed ? 'none' : 'grid';
    });
    
    // 화면 크기 변경 시 사이드바 재초기화 및 지도 리사이즈
    window.addEventListener('resize', () => {
        initializeSidebarForScreenSize();
        
        // 지도 리사이즈 (지도가 있을 때만)
        if (map) {
            setTimeout(() => {
                naver.maps.Event.trigger(map, 'resize');
                console.log('윈도우 리사이즈에 따른 지도 리사이즈');
            }, 100);
        }
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