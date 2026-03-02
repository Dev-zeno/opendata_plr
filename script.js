// 전역 변수 선언
let map = null; // 지도 객체는 초기화 후에 생성
let allLibraries = [];
let markers = [];
let seatMapData = {};

// Vercel HTTPS 환경에서 안정적인 지도 초기화 함수
function initializeMap() {
    console.log('Vercel HTTPS 지도 초기화 시작...');

    // DOM 요소 확인
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error('Vercel HTTPS 지도 컨테이너를 찾을 수 없습니다');
        return false;
    }

    // 네이버 지도 API 확인
    if (typeof naver === 'undefined' || !naver.maps) {
        console.error('Vercel HTTPS 네이버 지도 API가 로드되지 않았습니다');

        // HTTPS 환경에서 API 재로드 시도
        if (typeof window !== 'undefined') {
            console.log('HTTPS 환경에서 네이버 지도 API 재로드 시도...');

            // 기존 스크립트 제거
            const existingScript = document.querySelector('script[src*="oapi.map.naver.com"]');
            if (existingScript) {
                existingScript.remove();
            }

            // HTTPS 스크립트 동적 로드
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = 'https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=hgte1ya8vs';
            script.async = true;
            script.onload = function () {
                console.log('HTTPS 네이버 지도 API 로드 성공');
                // 로드 완료 후 다시 초기화 시도
                setTimeout(() => {
                    if (typeof naver !== 'undefined' && naver.maps) {
                        initializeMap();
                    }
                }, 500);
            };
            script.onerror = function () {
                console.error('HTTPS 네이버 지도 API 로드 실패');
            };
            document.head.appendChild(script);
        }

        return false;
    }

    try {
        // HTTPS 환경에서 지도 생성 - 확대/축소 컨트롤 제거
        map = new naver.maps.Map('map', {
            center: new naver.maps.LatLng(37.5665, 126.9780),
            zoom: 10,
            // HTTPS 호환 옵션 추가
            scaleControl: false,  // 스케일 컨트롤 제거
            logoControl: false,   // 로고 컨트롤 제거
            mapDataControl: false, // 지도 데이터 컨트롤 제거
            zoomControl: false,    // 확대/축소 컨트롤 제거
            // 기존 zoomControlOptions 제거
        });

        // HTTPS 지도 크기 문제 해결을 위한 강제 리사이즈
        setTimeout(() => {
            if (map) {
                // 지도 컨테이너 크기 재계산
                naver.maps.Event.trigger(map, 'resize');
                console.log('HTTPS 지도 리사이즈 이벤트 트리거');
            }
        }, 200);

        console.log('Vercel HTTPS 네이버 지도 초기화 성공');
        return true;
    } catch (error) {
        console.error('HTTPS 지도 생성 중 오류:', error);

        // HTTPS 오류 시 폴백
        if (error.message && error.message.includes('https')) {
            console.log('HTTPS 관련 오류로 폴백 시도...');
        }

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

// 지도 상태 확인 및 안전한 지도 이동 함수
function safeMapOperation(operation, libraries = null, description = '') {
    console.log(`지도 작업 시도: ${description}`);

    // 네이버 지도 API 로드 확인
    if (typeof naver === 'undefined' || !naver.maps) {
        console.error('네이버 지도 API가 로드되지 않았습니다');
        return false;
    }

    // 전역 map 변수 확인 (window.map 대신 전역 map 사용)
    if (!map) {
        console.error('지도 객체가 초기화되지 않았습니다. 지도 초기화를 대기 중입니다.');
        // 지도 초기화를 다시 시도
        setTimeout(() => {
            if (!map) {
                console.log('지도 재초기화 시도...');
                initializeMap();
            }
        }, 1000);
        return false;
    }

    // 지도 컨테이너 확인
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error('지도 컨테이너를 찾을 수 없습니다');
        return false;
    }

    try {
        // 라이브러리 데이터가 있고 유효한 좌표가 있는지 확인
        if (libraries && libraries.length > 0) {
            const validLibraries = libraries.filter(lib => {
                const lat = parseFloat(lib.lat);
                const lon = parseFloat(lib.lot);
                return !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0;
            });

            if (validLibraries.length === 0) {
                console.warn('유효한 좌표를 가진 도서관이 없습니다');
                return false;
            }

            console.log(`유효한 도서관 좌표 ${validLibraries.length}개 발견`);

            // Bounds 생성 및 지도 이동
            const bounds = new naver.maps.LatLngBounds();
            validLibraries.forEach(lib => {
                const lat = parseFloat(lib.lat);
                const lon = parseFloat(lib.lot);
                bounds.extend(new naver.maps.LatLng(lat, lon));
            });

            // fitBounds 실행 - 전역 map 변수 사용
            map.fitBounds(bounds);

            // 지도 리사이즈 강제 실행 (Safari 호환)
            setTimeout(() => {
                if (map) {
                    naver.maps.Event.trigger(map, 'resize');
                    console.log('지도 리사이즈 트리거 완료');
                }
            }, 100);

            console.log(`지도 이동 성공: ${description}`);
            return true;
        } else {
            // 일반적인 지도 작업 실행
            if (typeof operation === 'function') {
                operation();
                return true;
            }
        }
    } catch (error) {
        console.error(`지도 작업 실패 (${description}):`, error);

        // 오류 발생 시 지도 재초기화 시도
        if (error.message && error.message.includes('map')) {
            console.log('지도 오류로 인한 재초기화 시도...');
            setTimeout(() => {
                initializeMap();
            }, 1000);
        }

        return false;
    }

    return false;
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
    sidebar.addEventListener('touchstart', function (e) {
        // 사이드바 상단 영역 (100px)에서만 드래그 허용
        const rect = sidebar.getBoundingClientRect();
        const touchY = e.touches[0].clientY;
        const relativeY = touchY - rect.top;

        if (relativeY <= 100) {
            handleStart(e);
        }
    }, { passive: false, capture: true });

    sidebar.addEventListener('touchmove', function (e) {
        if (isDragging) {
            handleMove(e);
        }
    }, { passive: false, capture: true });

    sidebar.addEventListener('touchend', function (e) {
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
    dragHandle.addEventListener('touchstart', function () {
        dragHandle.style.cursor = 'grabbing';
    }, { passive: true });

    dragHandle.addEventListener('touchend', function () {
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
        button.addEventListener('click', function () {
            const title = this.getAttribute('title');
            console.log('플로팅 버튼 클릭:', title);

            switch (title) {
                case '위치':
                    // 사용자 위치 요청 기능
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(function (position) {
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
                        }, function (error) {
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
        mobileToggle.addEventListener('click', function () {
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
        mobileSearchInput.addEventListener('input', function () {
            desktopSearchInput.value = this.value;
            performSearch(this.value);
        });

        desktopSearchInput.addEventListener('input', function () {
            mobileSearchInput.value = this.value;
            performSearch(this.value);
        });
    }
}

let isDesktopSidebarEventsBound = false;

// Desktop sidebar toggle functionality
function initDesktopSidebar() {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');

    // PC 버전에서는 사이드바 기본 펼침 유지
    if (window.innerWidth > 768) {
        if (sidebar) {
            sidebar.classList.remove('collapsed');
            sidebar.classList.add('active');
            console.log('PC 사이드바 초기화 완료 - 기본 펼침');
        }

        if (sidebarToggle) {
            sidebarToggle.style.display = 'flex'; // Ensure flex since it has flex styling
        }
    }

    // 토글 버튼 클릭 이벤트 (PC용) - 중복 리스너 방지
    if (sidebarToggle && sidebar && !isDesktopSidebarEventsBound) {
        sidebarToggle.addEventListener('click', function () {
            // Clear any inline styles so CSS collapse rules can take effect
            sidebar.style.cssText = '';
            sidebar.classList.toggle('collapsed');
        });
        isDesktopSidebarEventsBound = true;
    }
}

// 화면 크기에 따른 사이드바 초기화
function initializeSidebarForScreenSize() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');

    if (window.innerWidth > 768) {
        // PC 버전 - inline style 최소화, user's toggle state 보존
        if (sidebar) {
            // Only set to active on initial load (not already toggled by user)
            if (!sidebar.classList.contains('collapsed')) {
                sidebar.classList.add('active');
            }
            // Clear any previously set conflicting inline styles so CSS can take over
            sidebar.style.cssText = '';
        }
        if (sidebarToggle) {
            sidebarToggle.style.display = 'flex';
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
        }
        if (sidebarToggle) {
            sidebarToggle.style.display = 'none';
        }
    }
}

// Global bridge for legacy search calls to trigger the new unified filter
window.performSearch = function (term) {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = term || '';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
};


function setUpdateTime() {
    const now = new Date();
    const formatted = now.toLocaleTimeString('ko-KR', { hour12: true });
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

let isSidebarFiltersInitialized = false;

function initializeSidebarFilters() {
    if (isSidebarFiltersInitialized) return;

    const citySelect = document.getElementById('city-select');
    const districtSelect = document.getElementById('district-select');
    const searchInput = document.getElementById('search-input');

    if (!citySelect || !districtSelect || !searchInput) return;

    isSidebarFiltersInitialized = true;
    let currentFilters = { city: '', district: '', search: '' };

    // 1. Populate city select
    citySelect.innerHTML = '<option value="">시/도 선택</option>';
    const sidos = [
        '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시', '세종특별자치시',
        '경기도', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도'
    ];
    sidos.forEach(sido => {
        const option = document.createElement('option');
        option.value = sido;
        option.textContent = sido;
        citySelect.appendChild(option);
    });

    // 2. City select change event
    citySelect.addEventListener('change', function () {
        currentFilters.city = this.value;
        currentFilters.district = ''; // reset district when city changes

        // Update district options
        districtSelect.innerHTML = '<option value="">전체</option>';
        if (currentFilters.city) {
            const districts = new Set();
            allLibraries.filter(lib => lib.pblibRoadNmAddr && lib.pblibRoadNmAddr.startsWith(currentFilters.city))
                .forEach(lib => {
                    const parts = lib.pblibRoadNmAddr.split(' ');
                    if (parts.length > 1) {
                        districts.add(parts[1]);
                    }
                });

            Array.from(districts).sort().forEach(district => {
                const option = document.createElement('option');
                option.value = district;
                option.textContent = district;
                districtSelect.appendChild(option);
            });
            districtSelect.disabled = false;
        } else {
            districtSelect.disabled = true;
        }

        applyFilters();
    });

    // 3. District select change event
    districtSelect.addEventListener('change', function () {
        currentFilters.district = this.value;
        applyFilters();
    });

    // 4. Search input event
    let searchTimeout;
    searchInput.addEventListener('input', function () {
        currentFilters.search = this.value.trim().toLowerCase();
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            applyFilters();
        }, 300);
    });

    function applyFilters() {
        let filtered = allLibraries;

        if (currentFilters.city) {
            filtered = filtered.filter(lib => lib.pblibRoadNmAddr && lib.pblibRoadNmAddr.startsWith(currentFilters.city));
        }

        if (currentFilters.district) {
            filtered = filtered.filter(lib => lib.pblibRoadNmAddr && lib.pblibRoadNmAddr.includes(currentFilters.district));
        }

        if (currentFilters.search) {
            filtered = filtered.filter(lib =>
                (lib.pblibNm && lib.pblibNm.toLowerCase().includes(currentFilters.search)) ||
                (lib.pblibRoadNmAddr && lib.pblibRoadNmAddr.toLowerCase().includes(currentFilters.search))
            );
        }

        updateStatistics(filtered);
        displayLibraries(filtered);
    }
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
    if (!libraries || !Array.isArray(libraries)) return;
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
        '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시', '세종특별자치시',
        '경기도', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도'
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
            '서울특별시': '서울', '부산광역시': '부산', '대구광역시': '대구', '인천광역시': '인천', '울산광역시': '울산',
            '경기도': '경기', '충청북도': '충북', '전북특별자치도': '전북', '전라남도': '전남'
        };
        const label = abbrMap[sido] || sido.slice(0, 2);

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
        '서울특별시': '서울', '부산광역시': '부산', '대구광역시': '대구', '인천광역시': '인천',
        '광주광역시': '광주', '대전광역시': '대전', '울산광역시': '울산', '세종특별자치시': '세종',
        '경기도': '경기', '강원특별자치도': '강원', '충청북도': '충북', '충청남도': '충남',
        '전북특별자치도': '전북', '전라남도': '전남', '경상북도': '경북', '경상남도': '경남', '제주특별자치도': '제주'
    };
    const cityDisplayName = abbrMap[selectedSido] || selectedSido.replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, '');
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

        // 안전한 지도 이동 사용
        const mapMoveSuccess = safeMapOperation(null, sidoLibraries, `${cityDisplayName} 지역으로 지도 이동`);
        if (!mapMoveSuccess) {
            console.warn(`PC 버전 지도 이동 실패: ${cityDisplayName}`);
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

                // 안전한 지도 이동 사용
                const mapMoveSuccess = safeMapOperation(null, districtLibraries, `PC ${cityDisplayName} ${district} 지역으로 지도 이동`);
                if (!mapMoveSuccess) {
                    console.warn(`PC 버전 지도 이동 실패: ${district}`);
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

        // 지도를 전국 범위로 안전하게 초기화
        const mapMoveSuccess = safeMapOperation(null, allLibraries, '전국 범위로 지도 초기화');
        if (!mapMoveSuccess) {
            console.warn('전국 범위 지도 이동 실패');
        }
    }
}

// Vercel HTTPS 환경에서 Safari 호환성을 위한 모바일 시군구 선택 모달 열기
function openMobileDistrictModal(selectedSido, libraries) {
    if (!isMobileDevice()) {
        console.log('모바일 환경이 아닙니다');
        return;
    }

    console.log('Vercel Safari 호환 모바일 모달 오픈 시도:', selectedSido);

    const modal = document.getElementById('mobile-district-modal');
    const currentCityName = document.getElementById('mobile-current-city-name');
    const allDistrictsBtn = document.getElementById('mobile-all-districts');
    const districtList = document.getElementById('mobile-district-list');

    // Vercel 배포 환경에서 Safari를 위한 더 엄격한 null 체크
    if (!modal) {
        console.error('Vercel 모바일 모달 요소를 찾을 수 없습니다: mobile-district-modal');
        // DOM 준비 대기 후 재시도
        setTimeout(() => {
            if (document.getElementById('mobile-district-modal')) {
                openMobileDistrictModal(selectedSido, libraries);
            }
        }, 500);
        return;
    }
    if (!currentCityName) {
        console.error('Vercel 모바일 모달 요소를 찾을 수 없습니다: mobile-current-city-name');
        return;
    }
    if (!allDistrictsBtn) {
        console.error('Vercel 모바일 모달 요소를 찾을 수 없습니다: mobile-all-districts');
        return;
    }
    if (!districtList) {
        console.error('Vercel 모바일 모달 요소를 찾을 수 없습니다: mobile-district-list');
        return;
    }

    // 시도 이름 설정
    const abbrMap = {
        '서울특별시': '서울', '부산광역시': '부산', '대구광역시': '대구', '인천광역시': '인천',
        '광주광역시': '광주', '대전광역시': '대전', '울산광역시': '울산', '세종특별자치시': '세종',
        '경기도': '경기', '강원특별자치도': '강원', '충청북도': '충북', '충청남도': '충남',
        '전북특별자치도': '전북', '전라남도': '전남', '경상북도': '경북', '경상남도': '경남', '제주특별자치도': '제주'
    };
    const cityDisplayName = abbrMap[selectedSido] || selectedSido.replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, '');

    // Vercel Safari를 위한 안전한 textContent 설정
    try {
        if (currentCityName.textContent !== undefined) {
            currentCityName.textContent = cityDisplayName;
        } else if (currentCityName.innerText !== undefined) {
            currentCityName.innerText = cityDisplayName;
        } else {
            currentCityName.innerHTML = cityDisplayName;
        }
    } catch (e) {
        console.error('Vercel Safari textContent 설정 오류:', e);
        // 폴백 방법
        try {
            currentCityName.appendChild(document.createTextNode(cityDisplayName));
        } catch (e2) {
            console.error('Vercel Safari textNode 생성 오류:', e2);
        }
    }

    // 해당 시도의 도서관들만 필터링
    const sidoLibraries = libraries.filter(lib =>
        lib.pblibRoadNmAddr && lib.pblibRoadNmAddr.startsWith(selectedSido)
    );

    console.log('Vercel 필터링된 도서관 수:', sidoLibraries.length);

    // 전체 버튼 설정 - Vercel Safari를 위한 안전한 innerHTML 설정
    try {
        const allButtonHTML = `전체 <span class="count">${sidoLibraries.length}</span>`;
        if (allDistrictsBtn.innerHTML !== undefined) {
            allDistrictsBtn.innerHTML = allButtonHTML;
        } else if (allDistrictsBtn.textContent !== undefined) {
            allDistrictsBtn.textContent = `전체 (${sidoLibraries.length})`;
        } else {
            allDistrictsBtn.innerText = `전체 (${sidoLibraries.length})`;
        }
    } catch (e) {
        console.error('Vercel Safari innerHTML 설정 오류:', e);
        // 폴백
        try {
            allDistrictsBtn.textContent = `전체 (${sidoLibraries.length})`;
        } catch (e2) {
            console.error('Vercel Safari 폴백 오류:', e2);
        }
    }

    // Vercel Safari를 위한 클래스 설정 (className 사용)
    try {
        allDistrictsBtn.className = 'mobile-district-btn mobile-all-btn selected';
    } catch (e) {
        console.error('Vercel Safari className 설정 오류:', e);
    }

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

    console.log('시군구 개수:', districtCounts.size);

    // 시군구 버튼들 생성 - Vercel Safari를 위한 안전한 방법
    try {
        districtList.innerHTML = ''; // 기존 콘텐츠 제거
    } catch (e) {
        console.error('Vercel Safari innerHTML 청소 오류:', e);
        // 폴백: 수동 제거
        while (districtList.firstChild) {
            districtList.removeChild(districtList.firstChild);
        }
    }

    Array.from(districtCounts.entries())
        .sort(([a], [b]) => a.localeCompare(b, 'ko'))
        .forEach(([district, count]) => {
            const btn = document.createElement('button');

            // Vercel Safari를 위한 안전한 className 설정
            try {
                btn.className = 'mobile-district-btn';
            } catch (e) {
                console.error('Vercel Safari className 오류:', e);
                btn.setAttribute('class', 'mobile-district-btn');
            }

            // Vercel Safari를 위한 안전한 innerHTML 설정
            try {
                const buttonHTML = `${district} <span class="count">${count}</span>`;
                if (btn.innerHTML !== undefined) {
                    btn.innerHTML = buttonHTML;
                } else {
                    btn.textContent = `${district} (${count})`;
                }
            } catch (e) {
                console.error('Vercel Safari 버튼 innerHTML 오류:', e);
                try {
                    btn.textContent = `${district} (${count})`;
                } catch (e2) {
                    // 마지막 폴백
                    const textNode = document.createTextNode(`${district} (${count})`);
                    btn.appendChild(textNode);
                }
            }

            // Vercel Safari를 위한 안전한 setAttribute
            try {
                btn.setAttribute('data-district', district);
            } catch (e) {
                console.error('Vercel Safari setAttribute 오류:', e);
            }

            // Safari를 위한 이벤트 리스너 - 이벤트 위임 사용
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();

                console.log('Safari 시군구 버튼 클릭:', district);

                // 모든 버튼 선택 해제 - Safari를 위한 안전한 방법
                const allButtons = document.querySelectorAll('.mobile-district-btn');
                for (let i = 0; i < allButtons.length; i++) {
                    allButtons[i].classList.remove('selected');
                }
                btn.classList.add('selected');

                // 해당 시군구 도서관들만 필터링
                const districtLibraries = sidoLibraries.filter(lib =>
                    lib.pblibRoadNmAddr && lib.pblibRoadNmAddr.split(' ')[1] === district
                );

                console.log(`선택된 시군구: ${district}, 도서관 수: ${districtLibraries.length}`);

                displayLibraries(districtLibraries);
                updateStatistics(districtLibraries);
                updateRegionLabel(`${cityDisplayName} ${district} 도서관`);

                // 안전한 지도 이동 사용
                console.log('모바일 시군구 버튼 - 지도 이동 시도 시작');
                const mapMoveSuccess = safeMapOperation(null, districtLibraries, `${cityDisplayName} ${district} 지역으로 지도 이동`);
                if (!mapMoveSuccess) {
                    console.warn(`모바일 지도 이동 실패: ${district}`);
                } else {
                    console.log(`모바일 지도 이동 성공: ${district}`);
                }

                // 모바일에서 사이드바 자동 축소
                collapseSidebarOnMobile();

                // Safari를 위한 지연 모달 닫기
                setTimeout(() => {
                    closeMobileDistrictModal();
                }, 300);
            }, { passive: false }); // Safari를 위한 passive false

            districtList.appendChild(btn);
        });

    // 전체 버튼 이벤트 - Safari 호환
    const handleAllButtonClick = function (e) {
        e.preventDefault();
        e.stopPropagation();

        console.log('Safari 전체 버튼 클릭');

        // 모든 버튼 선택 해제
        const allButtons = document.querySelectorAll('.mobile-district-btn');
        for (let i = 0; i < allButtons.length; i++) {
            allButtons[i].classList.remove('selected');
        }
        allDistrictsBtn.classList.add('selected');

        // 해당 시도의 모든 도서관 표시
        displayLibraries(sidoLibraries);
        updateStatistics(sidoLibraries);
        updateRegionLabel(`${cityDisplayName} 도서관`);

        // 안전한 지도 이동 사용
        const mapMoveSuccess = safeMapOperation(null, sidoLibraries, `${cityDisplayName} 전체 지역으로 지도 이동`);
        if (!mapMoveSuccess) {
            console.warn(`지도 이동 실패: ${cityDisplayName} 전체`);
        }

        // 모바일에서 사이드바 자동 축소
        collapseSidebarOnMobile();

        // Safari를 위한 지연 모달 닫기
        setTimeout(() => {
            closeMobileDistrictModal();
        }, 300);
    };

    // 기존 이벤트 리스너 제거 후 새로 추가 (Safari 호환)
    allDistrictsBtn.removeEventListener('click', handleAllButtonClick);
    allDistrictsBtn.addEventListener('click', handleAllButtonClick, { passive: false });

    // Vercel Safari를 위한 모달 표시 - 단계별 안전 실행
    console.log('Vercel 모달 표시 시작');

    // 1. body 스크롤 방지 - Vercel Safari 전용
    try {
        const bodyStyle = document.body.style;
        bodyStyle.overflow = 'hidden';
        bodyStyle.position = 'fixed';
        bodyStyle.width = '100%';
        bodyStyle.height = '100%';
        bodyStyle.webkitOverflowScrolling = 'touch';
    } catch (e) {
        console.error('Vercel Safari body 스타일 설정 오류:', e);
    }

    // 2. 모달 hidden 클래스 제거 - Vercel Safari 방식
    try {
        if (modal.classList) {
            modal.classList.remove('hidden');
        } else {
            // 폴백
            const currentClass = modal.className;
            modal.className = currentClass.replace(/\bhidden\b/g, '').trim();
        }
    } catch (e) {
        console.error('Vercel Safari classList 오류:', e);
        // 최종 폴백
        modal.style.display = 'flex';
    }

    // 3. Vercel Safari를 위한 강제 재렌더링 및 애니메이션 트리거
    try {
        modal.offsetHeight; // force reflow
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'all';

        // 모달 콘텐츠 애니메이션
        setTimeout(() => {
            const modalContent = modal.querySelector('.mobile-modal-content');
            if (modalContent) {
                modalContent.style.webkitTransform = 'translate3d(0, 0, 0)';
                modalContent.style.transform = 'translate3d(0, 0, 0)';
            }
        }, 50);

    } catch (e) {
        console.error('Vercel Safari 애니메이션 오류:', e);
    }

    console.log(`Vercel Safari 모바일 시군구 모달 오픈 완료: ${cityDisplayName}`);
}

// Vercel HTTPS Safari 환경에서 모바일 시군구 선택 모달 닫기
function closeMobileDistrictModal() {
    console.log('Vercel Safari 모바일 모달 닫기 시도');

    const modal = document.getElementById('mobile-district-modal');
    if (!modal) {
        console.error('Vercel 모바일 모달 요소를 찾을 수 없습니다');
        return;
    }

    // Vercel Safari를 위한 단계적 모달 닫기
    try {
        // 1. 애니메이션과 함께 닫기
        const modalContent = modal.querySelector('.mobile-modal-content');
        if (modalContent) {
            modalContent.style.webkitTransform = 'translate3d(0, 100%, 0)';
            modalContent.style.transform = 'translate3d(0, 100%, 0)';
        }

        // 2. 모달 비시블 처리
        setTimeout(() => {
            try {
                modal.style.opacity = '0';
                modal.style.visibility = 'hidden';
                modal.style.pointerEvents = 'none';

                // 3. hidden 클래스 추가
                if (modal.classList) {
                    modal.classList.add('hidden');
                } else {
                    modal.className += ' hidden';
                }

            } catch (e2) {
                console.error('Vercel Safari 모달 비시블 오류:', e2);
                modal.style.display = 'none';
            }
        }, 150);

    } catch (e) {
        console.error('Vercel Safari 모달 애니메이션 오류:', e);
        // 폴백: 직접 닫기
        modal.classList.add('hidden');
    }

    // body 스크롤 복원 - Vercel Safari 전용
    setTimeout(() => {
        try {
            const bodyStyle = document.body.style;
            bodyStyle.overflow = '';
            bodyStyle.position = '';
            bodyStyle.width = '';
            bodyStyle.height = '';
            bodyStyle.webkitOverflowScrolling = '';

            // Vercel Safari를 위한 강제 재렌더링
            document.body.offsetHeight; // force reflow

        } catch (e) {
            console.error('Vercel Safari body 복원 오류:', e);
        }

        console.log('Vercel Safari 모바일 모달 닫기 완료');
    }, 200);
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

    const searchResults = document.getElementById('search-results');
    searchResults.innerHTML = '';
    // 카드 리스트를 가운데 정렬하고 간격을 조정
    searchResults.style.display = 'flex';
    searchResults.style.flexDirection = 'column';
    searchResults.style.alignItems = 'stretch';
    searchResults.style.gap = '0';

    // Add a click listener to the map to close the detail panel
    naver.maps.Event.addListener(map, 'click', function () {
        hideMapDetailPanel();
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
            // Tailwind CSS applied strictly from library-seat-finder card style
            resultItem.className = 'w-full text-left p-3 rounded-xl transition-all duration-200 border bg-white border-transparent hover:bg-gray-50 mb-2 cursor-pointer';

            let totalRmndSeatCnt = 0;
            let totalTseatCnt = 0;
            if (lib.readingRooms && lib.readingRooms.length > 0) {
                lib.readingRooms.forEach(room => {
                    totalRmndSeatCnt += parseInt(room.rmndSeatCnt) || 0;
                    totalTseatCnt += parseInt(room.tseatCnt) || 0;
                });
            }

            const usedSeats = totalTseatCnt - totalRmndSeatCnt;
            const occupancyRate = totalTseatCnt > 0 ? (usedSeats / totalTseatCnt) * 100 : 0;
            let complexity = '여유';
            let complexityColor = 'bg-emerald-50 text-emerald-600 border-emerald-100'; // emerald
            if (totalRmndSeatCnt === 0 && totalTseatCnt > 0) {
                complexity = '만석';
                complexityColor = 'bg-red-50 text-red-600 border-red-100'; // red
            } else if (occupancyRate >= 80) {
                complexity = '혼잡';
                complexityColor = 'bg-orange-50 text-orange-600 border-orange-100'; // orange
            }

            resultItem.innerHTML = `
                <div class="flex justify-between items-start">
                    <h3 class="font-medium text-gray-900 line-clamp-1">${lib.pblibNm}</h3>
                    <span class="text-xs font-medium px-2 py-0.5 rounded border ${complexityColor} ml-2 whitespace-nowrap">
                        ${complexity}
                    </span>
                </div>
                <div class="flex items-start mt-1.5 text-xs text-gray-500">
                    <i class="fa-solid fa-map-marker-alt w-3.5 h-3.5 mr-1 shrink-0 mt-0.5" style="color:#9ca3af;"></i>
                    <span class="line-clamp-2 leading-relaxed">${lib.pblibRoadNmAddr}</span>
                </div>
            `;

            resultItem.addEventListener('click', () => {
                // 선택된 상태 디자인 적용
                document.querySelectorAll('#search-results > div').forEach(el => {
                    el.classList.remove('bg-indigo-50', 'border-indigo-100');
                    el.classList.add('bg-white', 'border-transparent');
                    const title = el.querySelector('h3');
                    if (title) title.classList.replace('text-indigo-700', 'text-gray-900');
                });
                resultItem.classList.remove('bg-white', 'border-transparent', 'hover:bg-gray-50');
                resultItem.classList.add('bg-indigo-50', 'border-indigo-100');
                const title = resultItem.querySelector('h3');
                if (title) title.classList.replace('text-gray-900', 'text-indigo-700');

                // 모바일에서만 사이드바 먼저 축소
                if (isMobileDevice()) {
                    collapseSidebarOnMobile();
                    // 사이드바 축소 애니메이션 완료 후 지도 이동
                    setTimeout(() => {
                        map.setCenter(new naver.maps.LatLng(lat, lon));
                        map.setZoom(15);
                        renderMapDetailPanel(lib);
                        showMapDetailPanel();
                    }, 300); // 사이드바 축소 애니메이션과 동일한 시간
                } else {
                    // PC에서는 기존 동작 유지
                    map.setCenter(new naver.maps.LatLng(lat, lon));
                    map.setZoom(15);
                    renderMapDetailPanel(lib);
                    showMapDetailPanel();
                }
            });

            searchResults.appendChild(resultItem);

            naver.maps.Event.addListener(marker, 'click', function (e) {
                // PC/Mobile 구분 없이 마커 클릭 시 사이드바 상에서도 상세 뷰를 보여줌
                renderMapDetailPanel(lib);
                showMapDetailPanel();

                // Stop event propagation to prevent the map click listener from firing
                naver.maps.Event.stop(e);
            });
            markers.push(marker);
        }
    });
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

    const sidos = [
        { label: '서울', value: '서울특별시', prefixes: ['서울', '서울특별시'] },
        { label: '부산', value: '부산광역시', prefixes: ['부산', '부산광역시'] },
        { label: '대구', value: '대구광역시', prefixes: ['대구', '대구광역시'] },
        { label: '인천', value: '인천광역시', prefixes: ['인천', '인천광역시'] },
        { label: '광주', value: '광주광역시', prefixes: ['광주', '광주광역시'] },
        { label: '대전', value: '대전광역시', prefixes: ['대전', '대전광역시'] },
        { label: '울산', value: '울산광역시', prefixes: ['울산', '울산광역시'] },
        { label: '세종', value: '세종특별자치시', prefixes: ['세종', '세종특별자치시'] },
        { label: '경기', value: '경기도', prefixes: ['경기', '경기도'] },
        { label: '강원', value: '강원특별자치도', prefixes: ['강원', '강원도', '강원특별자치도'] },
        { label: '충북', value: '충청북도', prefixes: ['충북', '충청북도', '충청'] },
        { label: '충남', value: '충청남도', prefixes: ['충남', '충청남도'] },
        { label: '전북', value: '전북특별자치도', prefixes: ['전북', '전라북도', '전북특별자치도', '전라'] },
        { label: '전남', value: '전라남도', prefixes: ['전남', '전라남도'] },
        { label: '경북', value: '경상북도', prefixes: ['경북', '경상북도', '경상'] },
        { label: '경남', value: '경상남도', prefixes: ['경남', '경상남도'] },
        { label: '제주', value: '제주특별자치도', prefixes: ['제주', '제주도', '제주특별자치도'] }
    ];

    sidos.forEach(sido => {
        // Check if any library address matches this sido
        const isActive = allLibraries.some(lib => {
            if (!lib.pblibRoadNmAddr) return false;
            // Exact match for predefined value
            if (lib.pblibRoadNmAddr.startsWith(sido.value)) return true;

            const p = lib.pblibRoadNmAddr.split(' ')[0];

            // Special handling for ambiguous prefixes like "경상"
            if (p === '경상') {
                if (sido.label === '경북' && lib.pblibRoadNmAddr.includes('북도')) return true;
                if (sido.label === '경남' && lib.pblibRoadNmAddr.includes('남도')) return true;
            }
            if (p === '충청') {
                if (sido.label === '충북' && lib.pblibRoadNmAddr.includes('북도')) return true;
                if (sido.label === '충남' && lib.pblibRoadNmAddr.includes('남도')) return true;
            }
            if (p === '전라') {
                if (sido.label === '전북' && lib.pblibRoadNmAddr.includes('북도')) return true;
                if (sido.label === '전남' && lib.pblibRoadNmAddr.includes('남도')) return true;
            }

            return sido.prefixes.includes(p) && !['경상', '충청', '전라'].includes(p);
        });

        if (isActive) {
            const button = document.createElement('button');
            button.className = 'px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-[13px] font-medium rounded-full hover:bg-gray-50 hover:border-gray-300 hover:text-indigo-600 transition-colors shadow-sm cursor-pointer whitespace-nowrap';
            button.textContent = sido.label;
            button.addEventListener('click', () => {
                const citySelect = document.getElementById('city-select');
                if (citySelect) {
                    citySelect.value = sido.value;
                    // Trigger the change event so the district list updates and filters apply
                    citySelect.dispatchEvent(new Event('change'));
                } else {
                    // Fallback to text search if select is missing
                    const searchInput = document.getElementById('search-input');
                    if (searchInput) {
                        searchInput.value = sido.label;
                        searchInput.dispatchEvent(new Event('input'));
                    }
                }
            });
            bubbleContainer.appendChild(button);
        }
    });
}
// Old search logic removed and replaced by initializeSidebarFilters

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

// initializeSidebarForScreenSize is defined earlier at line ~850 - duplicate removed



document.querySelectorAll('.filter-tabs button').forEach(button => {
    button.addEventListener('click', function () {
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

// Old city/district logic removed and replaced by initializeSidebarFilters

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
document.addEventListener('click', function (event) {
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
document.addEventListener('keydown', function (event) {
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
            initializeSidebarFilters();
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
            initializeSidebarFilters();
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
        if (window.innerWidth > 768) {
            return; // PC 환경에서는 이 로직을 실행하지 않음
        }

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
    h1Element.addEventListener('click', function (e) {
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

    // 모바일 모달 닫기 버튼 이벤트 리스너 - Safari 호환
    const mobileModalClose = document.getElementById('mobile-modal-close');
    if (mobileModalClose) {
        // Safari를 위한 이벤트 리스너 옵션
        mobileModalClose.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Safari 모바일 모달 X 버튼 클릭');
            closeMobileDistrictModal();
        }, { passive: false, capture: true });

        // Safari를 위한 추가 터치 이벤트
        mobileModalClose.addEventListener('touchend', function (e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Safari 모바일 모달 X 버튼 터치');
            closeMobileDistrictModal();
        }, { passive: false, capture: true });

        console.log('Safari 모바일 모달 닫기 버튼 이벤트 리스너 추가 완료');
    } else {
        console.warn('Safari 모바일 모달 닫기 버튼을 찾을 수 없습니다');
    }

    // 모바일 모달 배경 클릭 시 닫기 - Safari 호환
    const mobileModalBackdrop = document.querySelector('.mobile-modal-backdrop');
    if (mobileModalBackdrop) {
        mobileModalBackdrop.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Safari 모바일 모달 배경 클릭');
            closeMobileDistrictModal();
        }, { passive: false, capture: true });

        mobileModalBackdrop.addEventListener('touchend', function (e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Safari 모바일 모달 배경 터치');
            closeMobileDistrictModal();
        }, { passive: false, capture: true });

        console.log('Safari 모바일 모달 배경 이벤트 리스너 추가 완료');
    } else {
        console.warn('Safari 모바일 모달 배경을 찾을 수 없습니다');
    }

    // 모바일 모달 드래그 스와이프 닫기 기능 - Safari 최적화
    const mobileModal = document.getElementById('mobile-district-modal');
    const mobileModalContent = document.querySelector('.mobile-modal-content');
    if (mobileModal && mobileModalContent) {
        let startY = 0;
        let currentY = 0;
        let isDragging = false;
        let initialTransform = '';

        // Safari를 위한 터치 시작 이벤트
        const handleTouchStart = function (e) {
            if (e.target.closest('.mobile-modal-body')) {
                // 모달 바디 내부에서는 드래그 비활성화
                return;
            }

            startY = e.touches[0].clientY;
            currentY = startY;
            isDragging = true;
            initialTransform = mobileModalContent.style.transform || 'translateY(0)';

            console.log('Safari 드래그 시작:', startY);
        };

        // Safari를 위한 터치 이동 이벤트
        const handleTouchMove = function (e) {
            if (!isDragging) return;

            currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;

            if (deltaY > 0) {
                const translateY = Math.min(deltaY, 100);
                mobileModalContent.style.transform = `translateY(${translateY}px)`;

                // Safari를 위한 스크롤 방지
                e.preventDefault();
            }
        };

        // Safari를 위한 터치 종료 이벤트
        const handleTouchEnd = function (e) {
            if (!isDragging) return;
            isDragging = false;

            const deltaY = currentY - startY;

            console.log('Safari 드래그 종료:', deltaY);

            if (deltaY > 50) {
                // 50px 이상 드래그하면 모달 닫기
                console.log('Safari 드래그로 모달 닫기');
                closeMobileDistrictModal();
            } else {
                // 원래 위치로 복원
                mobileModalContent.style.transform = 'translateY(0)';
            }
        };

        // Safari를 위한 이벤트 리스너 등록
        mobileModalContent.addEventListener('touchstart', handleTouchStart, { passive: false });
        mobileModalContent.addEventListener('touchmove', handleTouchMove, { passive: false });
        mobileModalContent.addEventListener('touchend', handleTouchEnd, { passive: false });

        console.log('Safari 모바일 모달 드래그 이벤트 리스너 추가 완룼');
    } else {
        console.warn('Safari 모바일 모달 드래그 요소를 찾을 수 없습니다');
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
window.testModal = function (url) {
    console.log('Manual modal test triggered with URL:', url);
    openModal(url || 'https://www.google.com');
};

window.testCloseModal = function () {
    console.log('Manual close modal test triggered');
    closeModal();
};

window.debugModalState = function () {
    const modalContainer = document.getElementById('modal-container');
    const modalClose = document.getElementById('modal-close');
    console.log('Modal debug state:', {
        modalContainer: modalContainer ? 'found' : 'not found',
        modalContainerHidden: modalContainer ? modalContainer.classList.contains('hidden') : 'N/A',
        modalClose: modalClose ? 'found' : 'not found',
        modalCloseClasses: modalClose ? modalClose.className : 'N/A'
    });
};

// Map Detail Panel (Overlay) Functions
function showMapDetailPanel() {
    const detailPanel = document.getElementById('map-detail-panel');
    if (detailPanel) {
        detailPanel.classList.remove('hidden');
        detailPanel.classList.add('flex');
    }
}

function hideMapDetailPanel() {
    const detailPanel = document.getElementById('map-detail-panel');
    if (detailPanel) {
        detailPanel.classList.add('hidden');
        detailPanel.classList.remove('flex');
    }

    // Clear list selection state
    document.querySelectorAll('#search-results > div').forEach(el => {
        el.classList.remove('bg-indigo-50', 'border-indigo-100');
        el.classList.add('bg-white', 'border-transparent');
        const title = el.querySelector('h3');
        if (title) title.classList.replace('text-indigo-700', 'text-gray-900');
    });
}

function renderMapDetailPanel(lib) {
    const detailPanel = document.getElementById('map-detail-panel');
    if (!detailPanel) return;

    let totalTseatCnt = 0;
    let totalRmndSeatCnt = 0;
    if (lib.readingRooms && lib.readingRooms.length > 0) {
        lib.readingRooms.forEach(room => {
            totalTseatCnt += parseInt(room.tseatCnt) || 0;
            totalRmndSeatCnt += parseInt(room.rmndSeatCnt) || 0;
        });
    }

    // Try multiple possible API field combinations for robust fallback
    const tel = lib.pblibTelno || lib.telNo || lib.phoneNumber || lib.tel || lib.pblibTelNo || '';
    const opnTm = lib.opnTmInfo || lib.operatingTime || lib.opnTm || lib.pblibOpnTimeInfo || '';
    const hldy = lib.clsrInfoExpln || lib.hldyInfo || lib.closedDays || lib.hldy || '';
    const hp = lib.siteUrlAddr || lib.homepageUrl || lib.url || lib.pblibUrl || '';

    let html = `
        <!-- Sticky Header with Close Arrow -->
        <div class="sticky top-0 bg-white z-10 px-5 py-4 border-b border-gray-200 flex items-center shadow-sm shrink-0">
            <button id="map-detail-close-btn" class="text-gray-500 hover:text-gray-900 mr-3 flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors">
                <i class="fas fa-chevron-left text-lg"></i>
            </button>
            <h2 class="text-[17px] font-bold text-gray-900 m-0 line-clamp-1 flex-1">${lib.pblibNm}</h2>
        </div>
        
        <div class="p-5 space-y-6">
            <!-- Library Info Section -->
            <div class="space-y-3.5">
                <div class="flex items-start">
                    <i class="fa-solid fa-map-marker-alt w-5 text-gray-400 mt-[3px] shrink-0 text-center"></i>
                    <span class="text-[14px] text-gray-700 leading-relaxed ml-2">${lib.pblibRoadNmAddr || '-'}</span>
                </div>
    `;

    if (hldy) {
        html += `
                <div class="flex items-start">
                    <i class="fa-regular fa-calendar-xmark w-5 text-gray-400 mt-[3px] shrink-0 text-center"></i>
                    <span class="text-[14px] text-gray-700 leading-relaxed ml-2">${hldy}</span>
                </div>`;
    }

    if (tel) {
        const telHref = 'tel:' + tel.replace(/[^0-9+]/g, '');
        html += `
                <div class="flex items-center">
                    <i class="fa-solid fa-phone w-5 text-gray-400 shrink-0 text-center"></i>
                    <a href="${telHref}" class="text-[14px] text-indigo-600 hover:underline ml-2">${tel}</a>
                </div>`;
    }

    if (opnTm) {
        html += `
                <div class="flex items-start">
                    <i class="fa-regular fa-clock w-5 text-gray-400 mt-[3px] shrink-0 text-center"></i>
                    <span class="text-[14px] text-gray-700 leading-relaxed ml-2">${opnTm}</span>
                </div>`;
    }

    if (hp) {
        const hpUrl = hp.startsWith('http') ? hp : 'http://' + hp;
        html += `
                <div class="flex items-center">
                    <i class="fa-solid fa-globe w-5 text-gray-400 shrink-0 text-center"></i>
                    <a href="${hpUrl}" target="_blank" rel="noopener noreferrer" class="text-[14px] text-indigo-600 hover:underline ml-2 font-medium">${lib.pblibNm} 홈페이지</a>
                </div>`;
    }

    html += `
            </div>
            
            <hr class="border-gray-100">

            <!-- Seat Status Section -->
            <div>
                <div class="flex justify-between items-center mb-4">
                    <h3 class="font-bold text-[15px] text-gray-900 flex items-center">
                        <i class="fa-solid fa-user-group text-indigo-600 mr-2"></i> 열람실 좌석 현황
                    </h3>
                    <span class="text-[11px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                        실시간 연동 중
                    </span>
                </div>
                
                <div class="space-y-3">
    `;

    if (lib.readingRooms && lib.readingRooms.length > 0) {
        lib.readingRooms.forEach(room => {
            const seatMapKey = `${lib.stdgCd}_${lib.pblibId}_${room.rdrmId}`;
            const seatMapInfo = seatMapData[seatMapKey];
            let seatMapUrl = seatMapInfo ? seatMapInfo.url : null;
            if (seatMapUrl && (seatMapUrl.trim() === '' || seatMapUrl === 'null' || seatMapUrl === 'undefined')) {
                seatMapUrl = null;
            }
            const hasUrl = seatMapUrl && seatMapUrl !== 'null';

            const rUsageRate = room.tseatCnt > 0 ? ((room.tseatCnt - room.rmndSeatCnt) / room.tseatCnt) * 100 : 0;
            let rStatus = '여유';
            let rStatusColor = 'bg-indigo-500';
            let rLabelClass = 'text-emerald-600 bg-emerald-50 border border-emerald-100';

            if (room.rmndSeatCnt === 0 && room.tseatCnt > 0) {
                rStatus = '만석';
                rStatusColor = 'bg-red-500';
                rLabelClass = 'text-red-600 bg-red-50 border border-red-100';
            } else if (rUsageRate >= 80) {
                rStatus = '혼잡';
                rStatusColor = 'bg-orange-500';
                rLabelClass = 'text-orange-600 bg-orange-50 border border-orange-100';
            }

            const clickHandler = hasUrl ? `onclick="openModal('${seatMapUrl}')"` : ``;
            const cursorClass = hasUrl ? 'cursor-pointer hover:border-indigo-300 hover:shadow-sm' : 'opacity-90';

            html += `
                    <div class="bg-white rounded-xl p-4 border border-gray-200 transition-all ${cursorClass}" ${clickHandler}>
                        <div class="flex justify-between items-start mb-4">
                            <h4 class="font-bold text-[15px] text-gray-900">${room.rdrmNm}</h4>
                            <span class="text-[11px] font-medium px-2 py-0.5 rounded-full ${rLabelClass}">${rStatus}</span>
                        </div>
                        
                        <div class="mb-2 w-full">
                            <div class="flex justify-between items-end mb-1.5">
                                <span class="text-[12px] font-medium text-gray-500 mb-0.5">잔여 좌석</span>
                                <div>
                                    <span class="text-[26px] font-bold tracking-tight leading-none ${room.rmndSeatCnt === 0 ? 'text-red-600' : 'text-indigo-600'}">${room.rmndSeatCnt}</span>
                                    <span class="text-[13px] font-medium text-gray-400 ml-0.5">/ ${room.tseatCnt}</span>
                                </div>
                            </div>
                            <div class="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                <div class="h-2.5 rounded-full transition-all duration-500 ${rStatusColor}" style="width: ${rUsageRate}%"></div>
                            </div>
                        </div>
                        
                        <div class="text-right mt-3">
                            <span class="text-[11px] text-gray-400 font-medium">업데이트: 방금 전</span>
                        </div>
                    </div>
            `;
        });
    } else {
        html += `<div class="text-sm font-medium text-gray-500 text-center py-8 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">등록된 열람실 현황이 없습니다.</div>`;
    }

    html += `
                </div>
            </div>
        </div>
    `;

    detailPanel.innerHTML = html;

    // Bind close button
    const closeBtn = document.getElementById('map-detail-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            hideMapDetailPanel();
        });
    }
}