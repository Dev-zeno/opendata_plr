const map = new naver.maps.Map('map', {
    center: new naver.maps.LatLng(37.5665, 126.9780),
    zoom: 10
});

let allLibraries = [];
let markers = [];

async function fetchLibraries() {
    const statusDiv = document.getElementById('status');
    statusDiv.innerHTML = '도서관 데이터를 불러오는 중입니다...';
    const libraryInfoUrl = '/api/proxy'; // 프록시 엔드포인트
    const readingRoomUrl = '/api/proxy-reading-room'; // 프록시 엔드포인트

    try {
        const [libraryResponse, readingRoomResponse] = await Promise.all([
            fetch(libraryInfoUrl),
            fetch(readingRoomUrl)
        ]);
        const [libraryData, readingRoomData] = await Promise.all([
            libraryResponse.json(),
            readingRoomResponse.json()
        ]);

        if (libraryData?.body?.item && readingRoomData?.body?.item) {
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
    } catch (error) {
        console.error('Error fetching library data:', error);
        statusDiv.innerHTML = '데이터를 불러오는 중 오류가 발생했습니다.';
    }
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
                readingRoomInfo += `<li>${room.rdrmNm}: 총 ${room.tseatCnt}석 / 사용 ${room.useSeatCnt}석 / 잔여 ${room.rmndSeatCnt}석</li>`;
            });
            readingRoomInfo += '</ul>';
        } else {
            readingRoomInfo = '<p>열람실 정보가 없습니다.</p>';
        }

        const content = [
            '<div style="padding:10px; width: 400px">',
            `   <h5><b>${lib.pblibNm}</b></h5>`,
            `   <p>주소: ${lib.pblibRoadNmAddr}<br />`,
            `   전화번호: ${lib.pblibTelno || '정보 없음'}</p>`,
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
    bubbleContainer.innerHTML = '';
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

document.getElementById('sidebar-toggle').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const toggleButton = document.getElementById('sidebar-toggle');
    sidebar.classList.toggle('collapsed');
    if (sidebar.classList.contains('collapsed')) {
        toggleButton.textContent = '▶';
    } else {
        toggleButton.textContent = '◀';
    }
});

async function initialize() {
    await fetchLibraries();
    createBubbleButtons();
}

initialize();