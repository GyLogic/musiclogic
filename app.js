/**
 * Sputify Player - Iframe API Engine Logic
 * Menghubungkan UI mirip Spotify dengan YouTube Player Tersembunyi
 */

// ==========================================
// SELEKTOR ELEMEN DOM & VARIABEL UTAMA
// ==========================================
const songsContainer = document.getElementById('songs-container');
const playBtn = document.getElementById('play-btn');
const currentCover = document.getElementById('current-cover');
const currentTitle = document.getElementById('current-title');
const currentArtist = document.getElementById('current-artist');
const progressBar = document.getElementById('progress-bar');
const progressContainer = document.getElementById('progress-container');
const currentTimeLabel = document.getElementById('current-time');
const totalDurationLabel = document.getElementById('total-duration');
const searchInput = document.getElementById('search-input');
const sectionTitle = document.getElementById('section-title');
const volumeBar = document.getElementById('volume-bar');
const volumeContainer = document.getElementById('volume-container');

let ytPlayer = null; // Menyimpan instance objek pemutar YouTube
let isPlaying = false;
let currentTrack = null;
let searchTimeout = null;
let updateTimer = null;

// ==========================================
// 1. INISIALISASI YOUTUBE IFRAME PLAYER
// ==========================================
// Fungsi global bawaan dari YouTube API, otomatis terpanggil saat script YouTube termuat
function onYouTubeIframeAPIReady() {
    ytPlayer = new YT.Player('yt-player', {
        height: '1',
        width: '1',
        videoId: '', // Dikosongkan dulu di awal
        playerVars: {
            'playsinline': 1,
            'controls': 0,
            'disablekb': 1,
            'fs': 0,
            'rel': 0
        },
        events: {
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
        }
    });
}

// ==========================================
// 2. LOGIKA SCRAPING DATA PENCARIAN (CORS-FREE FEED)
// ==========================================
async function searchSongs(query) {
    if (!query) return;
    
    sectionTitle.textContent = `Mencari "${query}"...`;
    songsContainer.innerHTML = `
        <div class="col-span-full text-center py-10 text-gray-400">
            <i class="fas fa-spinner fa-spin text-3xl mb-2"></i>
            <p>Menghubungkan ke server musik...</p>
        </div>
    `;

    try {
        // Menggunakan public search proxy feed yang aman dan stabil
        const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}+music&sp=EgIQAQ%253D%253D`)}`);
        const data = await response.json();
        const html = data.contents;

        // Mengekstrak data video ID, judul, dan thumbnail dari raw HTML YouTube menggunakan Regex
        const videoIds = [...html.matchAll(/"videoId":"([^"]+)"/g)].map(m => m[1]);
        const titles = [...html.matchAll(/"title":{"runs":\[{"text":"([^"]+)"}\]/g)].map(m => m[1]);
        const authors = [...html.matchAll(/"longBylineText":{"runs":\[{"text":"([^"]+)"}\]/g)].map(m => m[1]);

        const tracks = [];
        const maxResults = Math.min(10, videoIds.length);

        for (let i = 0; i < maxResults; i++) {
            if (videoIds[i] && titles[i]) {
                tracks.push({
                    id: videoIds[i],
                    title: JSON.parse(`"${titles[i]}"`), // Mengurai unicode text jikalau ada
                    artist: authors[i] ? JSON.parse(`"${authors[i]}"`) : "YouTube Music",
                    cover: `https://img.youtube.com/vi/${videoIds[i]}/hqdefault.jpg`
                });
            }
        }

        // Membersihkan data duplikat hasil regex
        const uniqueTracks = tracks.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

        sectionTitle.textContent = `Hasil Pencarian untuk "${query}"`;
        renderSongs(uniqueTracks);
    } catch (error) {
        console.error("Gagal memproses data:", error);
        sectionTitle.textContent = "Gagal memuat hasil pencarian";
        songsContainer.innerHTML = `<div class="col-span-full text-center text-red-500">Koneksi sibuk. Silakan coba mengetik ulang kembali.</div>`;
    }
}

// ==========================================
// 3. RENDERING KARTU LAGU KE LAYOUT
// ==========================================
function renderSongs(songs) {
    songsContainer.innerHTML = '';
    
    if (songs.length === 0) {
        songsContainer.innerHTML = `<div class="col-span-full text-center text-gray-400 py-10">Lagu tidak ditemukan. Coba judul lain.</div>`;
        return;
    }

    songs.forEach(song => {
        const card = document.createElement('div');
        card.className = "bg-[#181818] hover:bg-[#282828] p-4 rounded-md cursor-pointer transition group relative flex flex-col justify-between";
        card.innerHTML = `
            <div class="relative mb-4 shadow-lg shadow-black/50">
                <img src="${song.cover}" class="w-full aspect-square object-cover rounded-md bg-[#242424]" alt="${song.title}">
                <button class="play-card-btn absolute bottom-2 right-2 bg-green-500 text-black p-3 rounded-full opacity-0 group-hover:opacity-100 transition translate-y-2 group-hover:translate-y-0 shadow-xl flex items-center justify-center w-11 h-11">
                    <i class="fas fa-play text-sm"></i>
                </button>
            </div>
            <h3 class="font-bold text-sm truncate" title="${song.title}">${song.title}</h3>
            <p class="text-xs text-gray-400 mt-1 truncate">${song.artist}</p>
        `;
        
        card.addEventListener('click', () => {
            currentTrack = song;
            currentCover.src = song.cover;
            currentTitle.textContent = song.title;
            currentArtist.textContent = song.artist;
            
            if (ytPlayer && ytPlayer.loadVideoById) {
                ytPlayer.loadVideoById(song.id);
                isPlaying = true;
                playBtn.innerHTML = '<i class="fas fa-pause"></i>';
                setupMediaSession(song);
            }
        });
        
        songsContainer.appendChild(card);
    });
}

// ==========================================
// 4. EVENT HANDLER PEMUTARAN YOUTUBE PLAYER
// ==========================================
function onPlayerStateChange(event) {
    // YT.PlayerState.PLAYING = 1
    if (event.data == YT.PlayerState.PLAYING) {
        isPlaying = true;
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        startProgressUpdater();
    } 
    // YT.PlayerState.PAUSED = 2 atau ENDED = 0
    else {
        isPlaying = false;
        playBtn.innerHTML = '<i class="fas fa-play pl-0.5"></i>';
        stopProgressUpdater();
    }
}

function onPlayerError(event) {
    console.error("YouTube Player Error:", event.data);
    currentTitle.textContent = "Lagu dilindungi hak cipta / Gagal dimuat";
}

function togglePlay() {
    if (!currentTrack || !ytPlayer) return;
    if (isPlaying) {
        ytPlayer.pauseVideo();
    } else {
        ytPlayer.playVideo();
    }
}

// ==========================================
// 5. PROGRESS BAR & VOLUME CONTROL
// ==========================================
function startProgressUpdater() {
    stopProgressUpdater();
    updateTimer = setInterval(() => {
        if (!ytPlayer || !isPlaying) return;
        
        const currentTime = ytPlayer.getCurrentTime();
        const duration = ytPlayer.getDuration();
        
        if (duration > 0) {
            const progressPercent = (currentTime / duration) * 100;
            progressBar.style.width = `${progressPercent}%`;
            currentTimeLabel.textContent = formatTime(currentTime);
            totalDurationLabel.textContent = formatTime(duration);
        }
    }, 500);
}

function stopProgressUpdater() {
    clearInterval(updateTimer);
}

progressContainer.addEventListener('click', (e) => {
    if (!currentTrack || !ytPlayer) return;
    const duration = ytPlayer.getDuration();
    if (!duration) return;

    const rect = progressContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newTime = (clickX / width) * duration;
    
    ytPlayer.seekTo(newTime, true);
});

volumeContainer.addEventListener('click', (e) => {
    if (!ytPlayer) return;
    const rect = volumeContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    let volumePercent = Math.round((clickX / width) * 100);
    
    if (volumePercent < 0) volumePercent = 0;
    if (volumePercent > 100) volumePercent = 100;
    
    ytPlayer.setVolume(volumePercent);
    volumeBar.style.width = `${volumePercent}%`;
});

function formatTime(time) {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Mencegah musik mati saat layar ponsel dimatikan/dikunci
function setupMediaSession(song) {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.title,
            artist: song.artist,
            artwork: [{ src: song.cover, sizes: '300x300', type: 'image/jpeg' }]
        });
        
        navigator.mediaSession.setActionHandler('play', () => ytPlayer.playVideo());
        navigator.mediaSession.setActionHandler('pause', () => ytPlayer.pauseVideo());
    }
}

// ==========================================
// 6. INITIALIZATION & DEBOUNCED SEARCH
// ==========================================
playBtn.addEventListener('click', togglePlay);

searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    if (query === '') {
        sectionTitle.textContent = "Lagu Populer";
        songsContainer.innerHTML = `<div class="col-span-full text-center text-gray-500 py-10">Gunakan kolom di atas untuk mencari lagu secara instan.</div>`;
        return;
    }

    searchTimeout = setTimeout(() => {
        searchSongs(query);
    }, 700);
});

// Menampilkan lagu bawaan pertama kali dimuat
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        searchSongs("Lo-fi Beats Chill");
    }, 1000); // Beri jeda 1 detik agar objek player terinisialisasi sempurna
});