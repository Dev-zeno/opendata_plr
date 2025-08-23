const map = new naver.maps.Map('map', {
    center: new naver.maps.LatLng(37.5665, 126.9780),
    zoom: 10
});

let allLibraries = [];
let markers = [];
let seatMapData = {};

// Mobile interaction initialization for responsive design
function initMobileInteractions() {
    const sidebar = document.getElementById('sidebar');
    const mobileToggle = document.getElementById('mobile-toggle');
    
    // Mobile toggle button functionality
    if (mobileToggle) {
        mobileToggle.addEventListener('click', function() {
            sidebar.classList.toggle('expanded');
        });
    }
    
    // Mobile sidebar header tap to toggle
    const sidebarHeader = document.querySelector('.sidebar-header');
    if (sidebarHeader && window.innerWidth <= 768) {
        sidebarHeader.addEventListener('click', function(e) {
            if (e.target === sidebarHeader || e.target.tagName === 'H1') {
                sidebar.classList.toggle('expanded');
            }
        });
    }
    
    // Touch gestures for mobile sidebar
    let startY = 0;
    let currentY = 0;
    let isDragging = false;
    
    if (sidebar && window.innerWidth <= 768) {
        sidebar.addEventListener('touchstart', function(e) {
            startY = e.touches[0].clientY;
            isDragging = true;
        });
        
        sidebar.addEventListener('touchmove', function(e) {
            if (!isDragging) return;
            currentY = e.touches[0].clientY;
            const deltaY = startY - currentY;
            
            // Prevent default scrolling when dragging
            if (Math.abs(deltaY) > 10) {
                e.preventDefault();
            }
        });
        
        sidebar.addEventListener('touchend', function() {
            if (!isDragging) return;
            
            const deltaY = startY - currentY;
            
            // Threshold for swipe gestures
            if (deltaY > 50) {
                sidebar.classList.add('expanded');
            } else if (deltaY < -50) {
                sidebar.classList.remove('expanded');
            }
            
            isDragging = false;
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
    
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
        });
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
        const response = await fetch(`https://raw.githubusercontent.com/Dev-zeno/opendata_plr/refs/heads/main/library_data.json?t=${Date.now()}`, { cache: 'no-store' });
        seatMapData = await response.json();
        console.log('Seat map data fetched:', seatMapData);
    } catch (error) {
        console.error('Error fetching seat map data:', error);
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
                updateStatistics(allLibraries);
                displayLibraries(allLibraries);
                generateCityButtons(allLibraries);
                setUpdateTime();

                // 초기 로드 시 전국 통계 레이블 보정
                const regionLabelEl = document.querySelector('#total-libraries')?.nextElementSibling;
                if (regionLabelEl) {
                    regionLabelEl.textContent = '전국 도서관';
                }
                console.log('Library data fetched:', allLibraries);
            } else {
                console.error('Error: Unexpected data structure in API response.');

            }
        })
        .catch(error => {
            console.error('Error fetching library data:', error);
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
                map.setCenter(new naver.maps.LatLng(lat, lon));
                map.setZoom(15);
                openInfoWindow(marker, lib);
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
            lib.readingRooms.forEach(room => {
                // Use updated seat map URL
                const seatMapUrl = 'https://www.snlib.go.kr/sh/contents/roomStatus.do';
                roomRows += `
                    <li class="room-row cursor-pointer" onclick="openModal('${seatMapUrl}')">
                        <span class="room-name">${room.rdrmNm}</span>
                        <span class="room-count"><strong>${room.rmndSeatCnt}/${room.tseatCnt}</strong><br><span class="sub">잔여/전체</span></span>
                        <i class="fa-solid fa-table-cells-large grid-icon"></i>
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

function openModal(imageUrl, roomName) {
    const modal = document.getElementById('seat-map-modal');
    const modalImage = document.getElementById('modal-seat-map-image');
    const modalTitle = document.getElementById('modal-title');

    modalTitle.textContent = roomName; // Set the title of the modal
    modalImage.src = imageUrl;
    modal.style.display = 'block';
}

document.getElementById('modal-close').addEventListener('click', () => {
    document.getElementById('seat-map-modal').style.display = 'none';
});

window.addEventListener('click', (event) => {
    const modal = document.getElementById('seat-map-modal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
});

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
        // 데이터 다시 로드
        await fetchLibraries();
        
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

document.getElementById('sidebar-toggle').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const toggleButton = document.getElementById('sidebar-toggle');
    
    sidebar.classList.toggle('active');
    if (sidebar.classList.contains('active')) {
        toggleButton.textContent = '◀';
    } else {
        toggleButton.textContent = '▶';
    }
});

// Function to adjust sidebar visibility based on screen size
function adjustSidebarForScreenSize() {
    const sidebar = document.getElementById('sidebar');
    const toggleButton = document.getElementById('sidebar-toggle');
    if (window.innerWidth <= 768) {
        sidebar.classList.remove('active');
        toggleButton.style.display = 'block';
        toggleButton.textContent = '▶'; // Show right arrow when sidebar is hidden
    } else {
        sidebar.classList.add('active');
        toggleButton.style.display = 'none';
    }
}

// Initial adjustment and on window resize
adjustSidebarForScreenSize();
window.addEventListener('resize', adjustSidebarForScreenSize);



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
function openModal(url) {
    console.log('Opening modal with URL: ' + url);
    const modalContainer = document.getElementById('modal-container');
    const iframe = document.getElementById('seat-map-frame');
    
    // Add loading state
    iframe.style.display = 'none';
    modalContainer.innerHTML = `
        <div id="modal-content">
            <span id="modal-close">&times;</span>
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
    
    newIframe.onload = () => {
        loading.style.display = 'none';
        newIframe.style.display = 'block';
    };
    
    newIframe.onerror = () => {
        loading.innerHTML = `<i class="fas fa-exclamation-triangle text-red-500 mr-2"></i>좌석배치도를 불러올 수 없습니다.`;
    };
    
    newIframe.src = url;
    
    // Re-attach close event listener
    document.getElementById('modal-close').addEventListener('click', closeModal);
}

function closeModal() {
    const modalContainer = document.getElementById('modal-container');
    const iframe = document.getElementById('seat-map-frame');
    iframe.src = '';
    modalContainer.classList.add('hidden');
}

document.getElementById('modal-close').addEventListener('click', closeModal);

// Close modal when clicking outside the modal content
window.addEventListener('click', (event) => {
    const modalContainer = document.getElementById('modal-container');
    if (event.target === modalContainer) {
        closeModal();
    }
});
document.getElementById('modal-container').addEventListener('click', (event) => {
    if (event.target === document.getElementById('modal-container')) {
        closeModal();
    }
});
async function initialize() {
    await fetchSeatMapData().then(() => {
    fetchLibraries();
});
    createBubbleButtons();
    addDragInteractions();
}

function addDragInteractions() {
    const sidebar = document.getElementById('sidebar');
    const sidebarHeader = sidebar.querySelector('h1');
    let startY = 0;
    let initialSidebarY = 0;
    let isDragging = false;

    function onDragStart(e) {
        isDragging = true;
        startY = e.clientY || e.touches[0].clientY;
        initialSidebarY = sidebar.offsetTop;
        sidebar.style.transition = 'none';
        document.body.style.userSelect = 'none'; // 드래그 중 텍스트 선택 방지
    }

    function onDragMove(e) {
        if (!isDragging) return;
        const currentY = e.clientY || e.touches[0].clientY;
        const deltaY = currentY - startY;
        let newTop = initialSidebarY + deltaY;

        const maxHeight = window.innerHeight - 50;
        if (newTop < 50) newTop = 50;
        if (newTop > maxHeight) newTop = maxHeight;

        sidebar.style.top = `${newTop}px`;
    }

    function onDragEnd() {
        if (!isDragging) return;
        isDragging = false;
        sidebar.style.transition = 'top 0.3s ease';
        document.body.style.userSelect = '';

        const endY = sidebar.offsetTop;
        const toggleButton = document.getElementById('sidebar-toggle');
        const openPosition = window.innerHeight * 0.4; // 40vh
        const closePosition = window.innerHeight - 50; // 하단에 핸들만 보이도록

        // 사용자가 드래그를 놓은 위치가 열린 상태와 닫힌 상태의 중간보다 위쪽에 가까우면 열고, 아니면 닫습니다.
        const decisionPoint = (openPosition + closePosition) / 2;

        if (endY < decisionPoint) {
            sidebar.style.top = `${openPosition}px`;
            sidebar.classList.remove('collapsed');
            toggleButton.textContent = '▼';
        } else {
            sidebar.style.top = `${closePosition}px`;
            sidebar.classList.add('collapsed');
            toggleButton.textContent = '▲';
        }
    }

    sidebarHeader.addEventListener('mousedown', onDragStart);
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);

    sidebarHeader.addEventListener('touchstart', onDragStart);
    document.addEventListener('touchmove', onDragMove);
    document.addEventListener('touchend', onDragEnd);
}

initialize();
// --- 시도 선택 접기/펼치기 기능 추가 ---
window.addEventListener('DOMContentLoaded', () => {
    // 모바일 인터렉션 초기화
    initMobileInteractions();
    
    const cityLabel = document.querySelector('.city-select-label');
    const cityButtonsContainer = document.getElementById('city-buttons');
    if (!cityLabel || !cityButtonsContainer) return;

    let isCollapsed = false;
    cityLabel.addEventListener('click', () => {
        isCollapsed = !isCollapsed;
        cityButtonsContainer.style.display = isCollapsed ? 'none' : 'grid';
    });
});