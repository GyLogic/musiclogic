/**
 * Sputify Player - Core Logic Script
 * Menghubungkan UI mirip Spotify dengan Audio Stream YouTube Tanpa Iklan
 */

// ==========================================
// CONFIG & API ENDPOINTS (Public Stream Extractor)
// ==========================================
// Kita menggunakan Piped API / Invidious instance publik untuk mencari & mengekstrak audio YouTube tanpa limitasi API Key resmi.
const SEARCH_API_URL = "https://pipedapi.kavin.rocks/search?q=";
const STREAM_API_URL = "https://pipedapi.kavin.rocks/streams/";

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
const progressBarContainer = progressBar.parentElement;
const currentTimeLabel = document.getElementById('current-time');
const totalDurationLabel = document.getElementById('total-duration');
const searchInput = document.getElementById('search-input');
const sectionTitle = document.getElementById('section-title');
const volumeBar = document.getElementById('volume-bar');
const volumeBarContainer = volumeBar.parentElement;

let isPlaying = false;
let currentTrack = null;
let searchTimeout = null;

// ==========================================
// 1. FUNGSI PENCARIAN & PENGAMBILAN DATA YOUTUBE
// ==========================================

// Fungsi utama mencari lagu ke server YouTube via Piped API
async function searchYouTube(query) {
    if (!query) return;
    
    sectionTitle.textContent = `Mencari "${query}"...`;
    songsContainer.innerHTML = `
        <div class="col-span-full text-center py-10 text-gray-400">
            <i class="fas fa-spinner fa-spin text-3xl mb-2"></i>
            <p>Menyelami YouTube...</p>
        </div>
    `;

    try {
        const response = await fetch(`${SEARCH_API_URL}${encodeURIComponent(query)}&filter=music_videos`);
        const data = await response.json();
        
        // Filter hanya mengambil tipe dokumen video/musik
        const tracks = data.items.filter(item => item.type === 'stream').map(item => ({
            id: item.url.split("v=")[1] || item.url.split("/").pop(),
            title: item.title,
            artist: item.uploaderName,
            cover: item.thumbnail,
        }));

        sectionTitle.textContent = `Hasil Pencarian untuk "${query}"`;
        renderSongs(tracks);
    } catch (error) {
        console.error("Gagal mengambil data dari YouTube:", error);
        sectionTitle.textContent = "Gagal memuat hasil pencarian";
        songsContainer.innerHTML = `<div class="col-span-full text-center text-red-500">Terjadi kesalahan koneksi. Silakan coba lagi.</div>`;
    }
}

// Fungsi menarik direct URL link audio (.webm / .mp3) murni tanpa video & tanpa iklan
async function getAudioStreamUrl(videoId) {
    try {
        const response = await fetch(`${STREAM_API_URL}${videoId}`);
        const data = await response.json();
        
        // Mencari objek stream yang hanya berisi audio murni (audio-only) dengan kualitas terbaik
        const audioStreams = data.audioStreams.sort((a, b) => b.bitrate - a.bitrate);
        if (audioStreams.length > 0) {
            return audioStreams[0].url; // Mengembalikan direct link stream audio
        }
        throw new Error("Audio stream tidak ditemukan");
    } catch (error) {
        console.error("Gagal mengekstrak audio dari video ini:", error);
        alert("Gagal memutar audio dari YouTube. Server proxy penuh, coba lagu lain.");
        return null;
    }
}

// ==========================================
// 2. RENDERING HALAMAN / UI KARTU LAGU
// ==========================================
function renderSongs(songs) {
    songsContainer.innerHTML = '';
    
    if (songs.length === 0) {
        songsContainer.innerHTML = `<div class="col-span-full text-center text-gray-400 py-10">Lagu tidak ditemukan.</div>`;
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
        
        // Klik kartu untuk memproses stream audio secara asinkronus
        card.addEventListener('click', async () => {
            // Beri feedback visual loading pada bar bawah
            currentTitle.textContent = "Loading Stream...";
            currentArtist.textContent = song.artist;
            currentCover.src = song.cover;
            
            const directAudioUrl = await getAudioStreamUrl(song.id);
            if (directAudioUrl) {
                song.streamUrl = directAudioUrl;
                loadAndPlayTrack(song);
            } else {
                currentTitle.textContent = "Belum Memutar Lagu";
                currentArtist.textContent = "-";
            }
        });
        
        songsContainer.appendChild(card);
    });
}

// ==========================================
// 3. LOGIKA KONTROL UTAMA PLAYER AUDIO
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
        .catch(err => console.log("Playback dicegah oleh browser sebelum interaksi user:", err));
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
// 4. LOGIKA PROGRESS BAR, LOCKSCREEN & VOLUME
// ==========================================

// Menghitung jalannya durasi audio lagu
audioPlayer.addEventListener('timeupdate', () => {
    const { currentTime, duration } = audioPlayer;
    if (!duration) return;
    
    const progressPercent = (currentTime / duration) * 100;
    progressBar.style.width = `${progressPercent}%`;
    
    currentTimeLabel.textContent = formatTime(currentTime);
    totalDurationLabel.textContent = formatTime(duration);
});

// Fitur klik pada progress bar untuk melompati durasi menit/detik lagu
progressBarContainer.addEventListener('click', (e) => {
    if (!currentTrack || !audioPlayer.duration) return;
    const rect = progressBarContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newTime = (clickX / width) * audioPlayer.duration;
    audioPlayer.currentTime = newTime;
});

function formatTime(time) {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Mengatur kendali Volume
volumeBarContainer.addEventListener('click', (e) => {
    const rect = volumeBarContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    let newVolume = clickX / width;
    if (newVolume < 0) newVolume = 0;
    if (newVolume > 1) newVolume = 1;
    audioPlayer.volume = newVolume;
    volumeBar.style.width = `${newVolume * 100}%`;
});

// Mencegah musik mati saat layar ponsel dimatikan/dikunci (Media Session API)
function setupMediaSession(song) {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.title,
            artist: song.artist,
            artwork: [{ src: song.cover, sizes: '300x300', type: 'image/png' }]
        });
        
        navigator.mediaSession.setActionHandler('play', playTrack);
        navigator.mediaSession.setActionHandler('pause', togglePlay);
    }
}

// ==========================================
// 5. EVENT HANDLERS & DEBOUNCING PENCARIAN
// ==========================================
playBtn.addEventListener('click', togglePlay);

// Menggunakan teknik Debounce agar pencarian ke API tidak menembak setiap kali tombol diketik
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    if (query === '') {
        sectionTitle.textContent = "Lagu Populer";
        songsContainer.innerHTML = `<div class="col-span-full text-center text-gray-500 py-10">Gunakan kolom di atas untuk mencari lagu dari YouTube secara instan.</div>`;
        return;
    }

    searchTimeout = setTimeout(() => {
        searchYouTube(query);
    }, 600); // Eksekusi pencarian setelah user berhenti mengetik selama 0.6 detik
});

// Default lagu saat aplikasi pertama dimuat
document.addEventListener('DOMContentLoaded', () => {
    sectionTitle.textContent = "Lagu Populer";
    // Menampilkan saran pencarian pertama kali
    searchYouTube("Lo-fi Beats Chill");
});