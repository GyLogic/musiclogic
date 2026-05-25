/**
 * Sputify Player - Jamendo Free Music Engine Logic
 * Mencari dan memutar musik independen murni audio tanpa iklan & anti-blokir
 */

// ==========================================
// CONFIG & FREE PUBLIC CLIENT ID
// ==========================================
// Menggunakan Client ID publik Jamendo untuk demo gratis
const JAMENDO_CLIENT_ID = "56d30c55"; 
const SEARCH_API_URL = `https://api.jamendo.com/v1.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=jsonplext&id3=true&resultsorder=popularity_desc&limit=20`;

// ==========================================
// SELEKTOR ELEMEN DOM
// ==========================================
const songsContainer = document.getElementById('songs-container');
const audioPlayer = document.getElementById('audio-player');
const playBtn = document.getElementById('play-btn');
const currentCover = document.getElementById('current-cover');
const currentTitle = document.getElementById('current-title');
const currentArtist = document.getElementById('current-artist');
const progressBar = document.getElementById('progress-bar');
const progressContainer = progressBar.parentElement;
const currentTimeLabel = document.getElementById('current-time');
const totalDurationLabel = document.getElementById('total-duration');
const searchInput = document.getElementById('search-input');
const sectionTitle = document.getElementById('section-title');
const volumeBar = document.getElementById('volume-bar');
const volumeContainer = volumeBar.parentElement;

let isPlaying = false;
let currentTrack = null;
let searchTimeout = null;

// ==========================================
// 1. LOGIKA PENCARIAN MUSIK (JAMENDO API)
// ==========================================
async function searchMusic(query) {
    let url = SEARCH_API_URL;
    
    if (query && query.trim() !== '') {
        sectionTitle.textContent = `Mencari "${query}"...`;
        url += `&search=${encodeURIComponent(query)}`;
    } else {
        sectionTitle.textContent = "Lagu Populer (Jamendo Indie)";
    }

    songsContainer.innerHTML = `
        <div class="col-span-full text-center py-10 text-gray-400">
            <i class="fas fa-spinner fa-spin text-3xl mb-2"></i>
            <p>Menyelami gudang musik bebas iklan...</p>
        </div>
    `;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            songsContainer.innerHTML = `<div class="col-span-full text-center text-gray-400 py-10">Lagu tidak ditemukan. Coba kata kunci lain (ex: Rock, Lo-fi, Relax).</div>`;
            return;
        }

        const tracks = data.results.map(item => ({
            id: item.id,
            title: item.name,
            artist: item.artist_name,
            cover: item.album_image || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150",
            streamUrl: item.audio // Direct link MP3 murni
        }));

        if (query && query.trim() !== '') {
            sectionTitle.textContent = `Hasil Pencarian untuk "${query}"`;
        }
        renderSongs(tracks);
    } catch (error) {
        console.error("Gagal mengambil data dari Jamendo:", error);
        sectionTitle.textContent = "Gagal memuat musik";
        songsContainer.innerHTML = `<div class="col-span-full text-center text-red-500">Terjadi gangguan jaringan. Silakan coba lagi.</div>`;
    }
}

// ==========================================
// 2. RENDERING KARTU LAGU KE LAYOUT
// ==========================================
function renderSongs(songs) {
    songsContainer.innerHTML = '';

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
        
        card.addEventListener('click', () => loadAndPlayTrack(song));
        songsContainer.appendChild(card);
    });
}

// ==========================================
// 3. LOGIKA KONTROL AUDIO PLAYER (MP3 NATIVE)
// ==========================================
function loadAndPlayTrack(song) {
    currentTrack = song;
    audioPlayer.src = song.streamUrl;
    
    currentCover.src = song.cover;
    currentTitle.textContent = song.title;
    currentArtist.textContent = song.artist;
    
    playTrack();
    setupMediaSession(song);
}

function playTrack() {
    audioPlayer.play()
        .then(() => {
            isPlaying = true;
            playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        })
        .catch(err => console.log("Playback delayed:", err));
}

function togglePlay() {
    if (!currentTrack) return;
    if (isPlaying) {
        audioPlayer.pause();
        isPlaying = false;
        playBtn.innerHTML = '<i class="fas fa-play pl-0.5"></i>';
    } else {
        audioPlayer.play();
        isPlaying = true;
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
    }
}

// ==========================================
// 4. PROGRESS BAR & VOLUME
// ==========================================
audioPlayer.addEventListener('timeupdate', () => {
    const { currentTime, duration } = audioPlayer;
    if (!duration) return;
    
    const progressPercent = (currentTime / duration) * 100;
    progressBar.style.width = `${progressPercent}%`;
    
    currentTimeLabel.textContent = formatTime(currentTime);
    totalDurationLabel.textContent = formatTime(duration);
});

progressContainer.addEventListener('click', (e) => {
    if (!currentTrack || !audioPlayer.duration) return;
    const rect = progressContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newTime = (clickX / width) * audioPlayer.duration;
    audioPlayer.currentTime = newTime;
});

volumeContainer.addEventListener('click', (e) => {
    const rect = volumeContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    let newVolume = clickX / width;
    if (newVolume < 0) newVolume = 0;
    if (newVolume > 1) newVolume = 1;
    audioPlayer.volume = newVolume;
    volumeBar.style.width = `${newVolume * 100}%`;
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
        
        navigator.mediaSession.setActionHandler('play', playTrack);
        navigator.mediaSession.setActionHandler('pause', togglePlay);
    }
}

// ==========================================
// 5. INITIALIZATION & DEBOUNCE
// ==========================================
playBtn.addEventListener('click', togglePlay);

searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    searchTimeout = setTimeout(() => {
        searchMusic(query);
    }, 600);
});

document.addEventListener('DOMContentLoaded', () => {
    searchMusic(""); // Muat lagu populer secara default di awal
});