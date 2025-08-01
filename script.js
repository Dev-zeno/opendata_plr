const map = new naver.maps.Map('map', {
    center: new naver.maps.LatLng(37.5665, 126.9780),
    zoom: 10
});

let allLibraries = [];
let markers = [];

function fetchLibraries() {
    const statusDiv = document.getElementById('status');
    statusDiv.innerHTML = '도서관 데이터를 불러오는 중입니다...';
    const libraryInfoUrl = `/api/proxy`;
    const readingRoomUrl = `/api/proxy-reading-room`;

    return Promise.all([fetch(libraryInfoUrl), fetch(readingRoomUrl)])
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
                statusDiv.innerHTML = `${allLibraries.length}개의 도서관 데이터를 불러왔습니다.`;
                displayLibraries(allLibraries);
            } else {
                console.error('Error: Unexpected data structure in API response.');
                statusDiv.innerHTML = '데이터를 불러오는 데 실패했습니다. API 응답 구조를 확인하세요.';
            }
        })
        .catch(error => {
            console.error('Error fetching library data:', error);
            statusDiv.innerHTML = '데이터를 불러오는 중 오류가 발생했습니다.';
        });
}

function displayLibraries(libraries) {
    markers.forEach(marker => marker.setMap(null));
    markers = [];

    const infowindow = new naver.maps.InfoWindow();
    const searchResults = document.getElementById('search-results');
    searchResults.innerHTML = '';

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
            resultItem.className = 'result-item';
            resultItem.innerHTML = `<h5>${lib.pblibNm}</h5><p>${lib.pblibRoadNmAddr}</p>`;
            resultItem.addEventListener('click', () => {
                map.setCenter(new naver.maps.LatLng(lat, lon));
                map.setZoom(15);
                openInfoWindow(marker, lib);
            });
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
        let readingRoomInfo = '';
        if (lib.readingRooms && lib.readingRooms.length > 0) {
            readingRoomInfo = '<h6>열람실 정보</h6><ul>';
            lib.readingRooms.forEach(room => {
                readingRoomInfo += `<li><span class="reading-room-name">${room.rdrmNm}</span><div class="reading-room-seats"><span class="status">좌석현황</span><br><span class="count">${room.rmndSeatCnt} / ${room.tseatCnt}</span></div></li>`;
            });
            readingRoomInfo += '</ul>';
        } else {
            readingRoomInfo = '<p>열람실 정보가 없습니다.</p>';
        }

        const content = [
            '<div class="info-window-content">',
            `   <h5>${lib.pblibNm}</h5>`,
            `   <p>주소: ${lib.pblibRoadNmAddr}</p>`,
            `   <p>전화번호: ${lib.pblibTelno || '정보 없음'}</p>`,
            readingRoomInfo,
            '</div>'
        ].join('');

        if (infowindow.getMap()) {
            infowindow.close();
        }

        infowindow.setContent(content);
        infowindow.open(map, marker);
    }
}

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

document.getElementById('sidebar-toggle').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const toggleButton = document.getElementById('sidebar-toggle');
    const isMobile = window.innerWidth <= 768;
    
    sidebar.classList.toggle('collapsed');
    
    if (isMobile) {
        // 모바일에서는 상하 화살표 사용
        if (sidebar.classList.contains('collapsed')) {
            toggleButton.textContent = '▲';
        } else {
            toggleButton.textContent = '▼';
        }
    } else {
        // 데스크톱에서는 좌우 화살표 사용
        if (sidebar.classList.contains('collapsed')) {
            toggleButton.textContent = '▶';
        } else {
            toggleButton.textContent = '◀';
        }
    }
});

// 화면 크기 변경 시 토글 버튼 아이콘 업데이트
window.addEventListener('resize', () => {
    const sidebar = document.getElementById('sidebar');
    const toggleButton = document.getElementById('sidebar-toggle');
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        if (sidebar.classList.contains('collapsed')) {
            toggleButton.textContent = '▲';
        } else {
            toggleButton.textContent = '▼';
        }
    } else {
        if (sidebar.classList.contains('collapsed')) {
            toggleButton.textContent = '▶';
        } else {
            toggleButton.textContent = '◀';
        }
    }
});

// 초기 토글 버튼 아이콘 설정
function setInitialToggleIcon() {
    const toggleButton = document.getElementById('sidebar-toggle');
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        toggleButton.textContent = '▼';
    } else {
        toggleButton.textContent = '◀';
    }
}

async function initialize() {
    await fetchLibraries();
    createBubbleButtons();
    setInitialToggleIcon();
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