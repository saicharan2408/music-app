/* ========================================
   Music App — JioSaavn API Client
   Apple Music Clone
   ======================================== */

(function () {
  'use strict';

  // ========================================
  // API Configuration
  // ========================================
  const API_BASE = 'https://saavn.dev';
  const CORS_PROXY = 'https://corsproxy.io/?url=';

  // ========================================
  // State
  // ========================================
  const state = {
    currentPage: 'home',
    pageHistory: [],
    historyIndex: -1,
    searchQuery: '',
    searchTab: 'songs',
    currentSong: null,
    queue: [],
    queueIndex: -1,
    isPlaying: false,
    isShuffle: false,
    repeatMode: 0, // 0: off, 1: all, 2: one
    volume: 0.7,
    favorites: JSON.parse(localStorage.getItem('music_favorites') || '[]'),
    audio: new Audio(),
    detailCache: {},
  };

  // ========================================
  // DOM Elements
  // ========================================
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    sidebar: $('#sidebar'),
    sidebarOverlay: $('#sidebarOverlay'),
    mobileMenuBtn: $('#mobileMenuBtn'),
    searchInput: $('#searchInput'),
    btnBack: $('#btnBack'),
    btnForward: $('#btnForward'),
    // Player
    playerArtwork: $('#playerArtwork'),
    playerArtImg: $('#playerArtImg'),
    playerTitle: $('#playerTitle'),
    playerArtist: $('#playerArtist'),
    playerLikeBtn: $('#playerLikeBtn'),
    btnPlayPause: $('#btnPlayPause'),
    btnPrev: $('#btnPrev'),
    btnNext: $('#btnNext'),
    btnShuffle2: $('#btnShuffle2'),
    btnRepeat: $('#btnRepeat'),
    progressBar: $('#progressBar'),
    progressFill: $('#progressFill'),
    playerCurrentTime: $('#playerCurrentTime'),
    playerTotalTime: $('#playerTotalTime'),
    btnVolume: $('#btnVolume'),
    volumeSlider: $('#volumeSlider'),
    volumeFill: $('#volumeFill'),
    btnQueue: $('#btnQueue'),
    toast: $('#toast'),
    // Home
    trendingSongs: $('#trendingSongs'),
    popularAlbums: $('#popularAlbums'),
    genresGrid: $('#genresGrid'),
    topArtists: $('#topArtists'),
    // Search
    searchTitle: $('#searchTitle'),
    searchTabs: $('#searchTabs'),
    searchSongsGrid: $('#searchSongsGrid'),
    searchAlbumsGrid: $('#searchAlbumsGrid'),
    searchArtistsGrid: $('#searchArtistsGrid'),
    searchPlaylistsGrid: $('#searchPlaylistsGrid'),
    // Browse
    browseGenresGrid: $('#browseGenresGrid'),
    browseTopPicks: $('#browseTopPicks'),
    // Detail
    detailArtImg: $('#detailArtImg'),
    detailType: $('#detailType'),
    detailTitle: $('#detailTitle'),
    detailMeta: $('#detailMeta'),
    detailTracks: $('#detailTracks'),
    btnPlayAll: $('#btnPlayAll'),
    btnShuffle: $('#btnShuffle'),
    // Favorites
    favoritesTracks: $('#favoritesTracks'),
    favoritesCount: $('#favoritesCount'),
    favoritesEmpty: $('#favoritesEmpty'),
    favoritesTrackList: $('#favoritesTrackList'),
    btnPlayFavorites: $('#btnPlayFavorites'),
    // Queue
    queueTracks: $('#queueTracks'),
    queueEmpty: $('#queueEmpty'),
  };

  // ========================================
  // API Service
  // ========================================
  const api = {
    async fetch(endpoint) {
      try {
        // Try direct first
        let url = `${API_BASE}${endpoint}`;
        let res = await fetch(url);
        if (!res.ok) {
          // Try with CORS proxy
          url = `${CORS_PROXY}${encodeURIComponent(API_BASE + endpoint)}`;
          res = await fetch(url);
        }
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        return data.data || data;
      } catch (err) {
        console.error('API fetch error:', err);
        return null;
      }
    },

    searchSongs(query) {
      return this.fetch(`/api/search/songs?query=${encodeURIComponent(query)}&limit=20`);
    },

    searchAlbums(query) {
      return this.fetch(`/api/search/albums?query=${encodeURIComponent(query)}&limit=20`);
    },

    searchArtists(query) {
      return this.fetch(`/api/search/artists?query=${encodeURIComponent(query)}&limit=20`);
    },

    searchPlaylists(query) {
      return this.fetch(`/api/search?query=${encodeURIComponent(query)}`);
    },

    getSongById(id) {
      return this.fetch(`/api/songs/${id}`);
    },

    getAlbum(id) {
      return this.fetch(`/api/albums?id=${id}`);
    },

    getPlaylist(id) {
      return this.fetch(`/api/playlists?id=${id}`);
    },

    getArtistSongs(id) {
      return this.fetch(`/api/artists/${id}/songs`);
    },
  };

  // ========================================
  // Utility Functions
  // ========================================
  function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const s = parseInt(seconds);
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  function debounce(fn, ms = 400) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  function showToast(message) {
    dom.toast.textContent = message;
    dom.toast.classList.add('show');
    setTimeout(() => dom.toast.classList.remove('show'), 2500);
  }

  function getImageUrl(song, size = '500x500') {
    if (!song) return '';
    // Handle different API response structures
    if (song.image) {
      if (typeof song.image === 'string') return song.image;
      if (Array.isArray(song.image)) {
        const best = song.image.find(i => i.quality === '500x500') || song.image[song.image.length - 1];
        return best?.url || best?.link || '';
      }
    }
    if (song.images) {
      if (Array.isArray(song.images)) {
        return song.images[song.images.length - 1]?.url || '';
      }
    }
    return song.image_url || song.thumbnail || '';
  }

  function getSongUrl(song) {
    if (!song) return '';
    if (song.downloadUrl) {
      if (typeof song.downloadUrl === 'string') return song.downloadUrl;
      if (Array.isArray(song.downloadUrl)) {
        // Get highest quality
        const best = song.downloadUrl.find(d => d.quality === '320kbps') ||
                     song.downloadUrl.find(d => d.quality === '160kbps') ||
                     song.downloadUrl.find(d => d.quality === '96kbps') ||
                     song.downloadUrl[song.downloadUrl.length - 1];
        return best?.url || best?.link || '';
      }
    }
    if (song.download_url) return song.download_url;
    if (song.media_preview_url) return song.media_preview_url;
    return '';
  }

  function getSongArtist(song) {
    if (!song) return 'Unknown';
    if (song.artists) {
      if (typeof song.artists === 'string') return song.artists;
      if (song.artists.primary && Array.isArray(song.artists.primary)) {
        return song.artists.primary.map(a => a.name).join(', ');
      }
      if (song.artists.all && Array.isArray(song.artists.all)) {
        return song.artists.all.slice(0, 3).map(a => a.name).join(', ');
      }
    }
    if (song.primaryArtists) return song.primaryArtists;
    if (song.singer) return song.singer;
    if (song.music) return song.music;
    return 'Unknown Artist';
  }

  function getSongName(song) {
    if (!song) return 'Unknown';
    return song.name || song.title || song.song || 'Unknown';
  }

  function getSongAlbum(song) {
    if (!song) return '';
    if (song.album) {
      if (typeof song.album === 'string') return song.album;
      return song.album.name || song.album.title || '';
    }
    return '';
  }

  function getSongId(song) {
    return song.id || song.songid || song.perma_url || '';
  }

  function decodeName(str) {
    if (!str) return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
  }

  // ========================================
  // Skeleton Loaders
  // ========================================
  function renderSkeletons(container, count = 6) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `
        <div class="skeleton-card">
          <div class="skeleton skeleton-art"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text-sm"></div>
        </div>`;
    }
    container.innerHTML = html;
  }

  // ========================================
  // Card Renderers
  // ========================================
  function renderSongCard(song) {
    const name = decodeName(getSongName(song));
    const artist = decodeName(getSongArtist(song));
    const img = getImageUrl(song);
    const id = getSongId(song);
    return `
      <div class="music-card" data-song-id="${id}" onclick="window.app.playSong('${id}')">
        <div class="card-artwork">
          <img src="${img}" alt="${name}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22><rect fill=%22%232c2c2e%22 width=%221%22 height=%221%22/></svg>'">
          <button class="card-play-btn" aria-label="Play ${name}">▶</button>
        </div>
        <div class="card-title" title="${name}">${name}</div>
        <div class="card-subtitle" title="${artist}">${artist}</div>
      </div>`;
  }

  function renderAlbumCard(album) {
    const name = decodeName(album.name || album.title || 'Unknown Album');
    const artist = decodeName(album.artist || album.subtitle || album.primaryArtists || '');
    const img = getImageUrl(album);
    const id = album.id;
    return `
      <div class="music-card" onclick="window.app.openAlbum('${id}')">
        <div class="card-artwork">
          <img src="${img}" alt="${name}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22><rect fill=%22%232c2c2e%22 width=%221%22 height=%221%22/></svg>'">
          <button class="card-play-btn" aria-label="Play ${name}">▶</button>
        </div>
        <div class="card-title" title="${name}">${name}</div>
        <div class="card-subtitle" title="${artist}">${artist}</div>
      </div>`;
  }

  function renderArtistCard(artist) {
    const name = decodeName(artist.name || artist.title || 'Unknown');
    const img = getImageUrl(artist);
    const id = artist.id;
    return `
      <div class="music-card artist-card" onclick="window.app.searchByArtist('${name.replace(/'/g, "\\'")}')">
        <div class="card-artwork">
          <img src="${img}" alt="${name}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22><rect fill=%22%232c2c2e%22 width=%221%22 height=%221%22/></svg>'">
        </div>
        <div class="card-title" title="${name}">${name}</div>
        <div class="card-subtitle">Artist</div>
      </div>`;
  }

  function renderTrackItem(song, index, showThumb = true) {
    const name = decodeName(getSongName(song));
    const artist = decodeName(getSongArtist(song));
    const album = decodeName(getSongAlbum(song));
    const duration = formatDuration(song.duration);
    const img = getImageUrl(song);
    const id = getSongId(song);
    const isPlaying = state.currentSong && getSongId(state.currentSong) === id;
    const isLiked = state.favorites.some(f => getSongId(f) === id);

    return `
      <div class="track-item ${isPlaying ? 'playing' : ''}" data-song-id="${id}" onclick="window.app.playSong('${id}')">
        <span class="track-number">
          ${isPlaying ? '<span class="now-playing-bars"><span></span><span></span><span></span><span></span></span>' : (index + 1)}
        </span>
        <div class="track-info">
          ${showThumb ? `<div class="track-thumb"><img src="${img}" alt="${name}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22><rect fill=%22%232c2c2e%22 width=%221%22 height=%221%22/></svg>'"></div>` : ''}
          <div class="track-text">
            <div class="track-title">${name}</div>
            <div class="track-artist">${artist}</div>
          </div>
        </div>
        <span class="track-album">${album}</span>
        <span class="track-duration">${duration}</span>
        <button class="track-like-btn ${isLiked ? 'liked' : ''}" onclick="event.stopPropagation(); window.app.toggleFavorite('${id}')" aria-label="${isLiked ? 'Unlike' : 'Like'}">
          ${isLiked ? '♥' : '♡'}
        </button>
      </div>`;
  }

  // ========================================
  // Genre Data
  // ========================================
  const genres = [
    { name: 'Bollywood', query: 'bollywood hits', color: 'linear-gradient(135deg, #e94560, #c23616)' },
    { name: 'Pop', query: 'pop hits 2024', color: 'linear-gradient(135deg, #7c3aed, #2563eb)' },
    { name: 'Romantic', query: 'romantic songs hindi', color: 'linear-gradient(135deg, #ec4899, #f43f5e)' },
    { name: 'Hip Hop', query: 'hip hop', color: 'linear-gradient(135deg, #f59e0b, #ef4444)' },
    { name: 'Punjabi', query: 'punjabi songs', color: 'linear-gradient(135deg, #10b981, #059669)' },
    { name: 'EDM', query: 'edm dance', color: 'linear-gradient(135deg, #06b6d4, #3b82f6)' },
    { name: 'Classical', query: 'indian classical', color: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' },
    { name: 'Devotional', query: 'devotional songs', color: 'linear-gradient(135deg, #f97316, #ea580c)' },
    { name: 'English', query: 'top english songs', color: 'linear-gradient(135deg, #14b8a6, #0d9488)' },
    { name: 'Rock', query: 'rock songs', color: 'linear-gradient(135deg, #64748b, #334155)' },
    { name: 'Retro', query: 'old hindi songs', color: 'linear-gradient(135deg, #a855f7, #7c3aed)' },
    { name: 'Chill', query: 'lo-fi chill', color: 'linear-gradient(135deg, #0ea5e9, #6366f1)' },
  ];

  // ========================================
  // Navigation
  // ========================================
  function navigateTo(page, addToHistory = true) {
    // Hide all pages
    $$('.page').forEach(p => p.classList.remove('active'));
    // Show target page
    const target = $(`#page-${page}`);
    if (target) {
      target.classList.add('active');
    }

    // Update sidebar active
    $$('.sidebar-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    state.currentPage = page;

    if (addToHistory) {
      state.pageHistory.splice(state.historyIndex + 1);
      state.pageHistory.push(page);
      state.historyIndex = state.pageHistory.length - 1;
    }

    // Close mobile sidebar
    dom.sidebar.classList.remove('open');
    dom.sidebarOverlay.classList.remove('show');
  }

  // ========================================
  // Home Page
  // ========================================
  async function loadHomePage() {
    // Render genres immediately
    renderGenres(dom.genresGrid);

    // Show skeletons
    renderSkeletons(dom.trendingSongs, 6);
    renderSkeletons(dom.popularAlbums, 6);
    renderSkeletons(dom.topArtists, 6);

    // Load trending songs
    const trending = await api.searchSongs('trending bollywood 2024');
    if (trending && trending.results) {
      dom.trendingSongs.innerHTML = trending.results.slice(0, 12).map(s => renderSongCard(s)).join('');
    } else {
      // Fallback: try another query
      const fallback = await api.searchSongs('arijit singh');
      if (fallback && fallback.results) {
        dom.trendingSongs.innerHTML = fallback.results.slice(0, 12).map(s => renderSongCard(s)).join('');
      } else {
        dom.trendingSongs.innerHTML = '<div class="empty-state"><h3>Could not load content</h3><p>Please check your internet connection.</p></div>';
      }
    }

    // Load popular albums
    const albums = await api.searchAlbums('latest hindi albums');
    if (albums && albums.results) {
      dom.popularAlbums.innerHTML = albums.results.slice(0, 12).map(a => renderAlbumCard(a)).join('');
    } else {
      dom.popularAlbums.innerHTML = '';
    }

    // Load top artists
    const artists = await api.searchArtists('arijit singh');
    if (artists && artists.results) {
      dom.topArtists.innerHTML = artists.results.slice(0, 8).map(a => renderArtistCard(a)).join('');
    }

    // Try loading more artist variety
    const artists2 = await api.searchArtists('AP Dhillon');
    if (artists2 && artists2.results) {
      dom.topArtists.innerHTML += artists2.results.slice(0, 4).map(a => renderArtistCard(a)).join('');
    }
  }

  // ========================================
  // Genres Rendering
  // ========================================
  function renderGenres(container) {
    container.innerHTML = genres.map(g => `
      <div class="genre-card" style="background: ${g.color}" onclick="window.app.searchGenre('${g.query}', '${g.name}')">
        <span>${g.name}</span>
      </div>`
    ).join('');
  }

  // ========================================
  // Search
  // ========================================
  async function performSearch(query) {
    if (!query.trim()) return;

    state.searchQuery = query;
    navigateTo('search');
    dom.searchTitle.textContent = `Results for "${query}"`;

    // Show skeletons in active tab
    renderSkeletons(dom.searchSongsGrid, 8);

    // Search songs
    const songs = await api.searchSongs(query);
    if (songs && songs.results) {
      // Store for queue use
      state.lastSearchSongs = songs.results;
      dom.searchSongsGrid.innerHTML = songs.results.map(s => renderSongCard(s)).join('');
    } else {
      dom.searchSongsGrid.innerHTML = '<div class="empty-state"><h3>No songs found</h3><p>Try a different search term.</p></div>';
    }

    // Search albums
    const albums = await api.searchAlbums(query);
    if (albums && albums.results) {
      dom.searchAlbumsGrid.innerHTML = albums.results.map(a => renderAlbumCard(a)).join('');
    } else {
      dom.searchAlbumsGrid.innerHTML = '<div class="empty-state"><h3>No albums found</h3></div>';
    }

    // Search artists
    const artists = await api.searchArtists(query);
    if (artists && artists.results) {
      dom.searchArtistsGrid.innerHTML = artists.results.map(a => renderArtistCard(a)).join('');
    } else {
      dom.searchArtistsGrid.innerHTML = '<div class="empty-state"><h3>No artists found</h3></div>';
    }

    // Playlists (use global search which may return playlists)
    const playlists = await api.searchPlaylists(query);
    if (playlists && playlists.playlists && playlists.playlists.results) {
      dom.searchPlaylistsGrid.innerHTML = playlists.playlists.results.map(p => {
        const name = decodeName(p.title || p.name || 'Playlist');
        const desc = p.description || p.subtitle || '';
        const img = getImageUrl(p);
        return `
          <div class="music-card" onclick="window.app.openPlaylist('${p.id}')">
            <div class="card-artwork">
              <img src="${img}" alt="${name}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22><rect fill=%22%232c2c2e%22 width=%221%22 height=%221%22/></svg>'">
              <button class="card-play-btn">▶</button>
            </div>
            <div class="card-title">${name}</div>
            <div class="card-subtitle">${desc}</div>
          </div>`;
      }).join('');
    } else {
      dom.searchPlaylistsGrid.innerHTML = '<div class="empty-state"><h3>No playlists found</h3></div>';
    }
  }

  // ========================================
  // Album / Playlist Detail
  // ========================================
  async function openAlbum(id) {
    navigateTo('detail');
    dom.detailType.textContent = 'ALBUM';
    dom.detailTitle.textContent = 'Loading...';
    dom.detailMeta.innerHTML = '';
    dom.detailTracks.innerHTML = '';
    dom.detailArtImg.src = '';

    const data = await api.getAlbum(id);
    if (!data) {
      dom.detailTitle.textContent = 'Failed to load album';
      return;
    }

    renderDetail(data, 'ALBUM');
  }

  async function openPlaylist(id) {
    navigateTo('detail');
    dom.detailType.textContent = 'PLAYLIST';
    dom.detailTitle.textContent = 'Loading...';
    dom.detailMeta.innerHTML = '';
    dom.detailTracks.innerHTML = '';
    dom.detailArtImg.src = '';

    const data = await api.getPlaylist(id);
    if (!data) {
      dom.detailTitle.textContent = 'Failed to load playlist';
      return;
    }

    renderDetail(data, 'PLAYLIST');
  }

  function renderDetail(data, type) {
    const name = decodeName(data.name || data.title || 'Unknown');
    const artist = decodeName(data.artist || data.subtitle || data.primaryArtists || '');
    const img = getImageUrl(data);
    const songs = data.songs || [];
    const year = data.year || '';
    const songCount = data.songCount || songs.length;

    dom.detailType.textContent = type;
    dom.detailTitle.textContent = name;
    dom.detailArtImg.src = img;

    let metaHtml = '';
    if (artist) metaHtml += `<span>${artist}</span>`;
    if (year) metaHtml += `<span class="dot"></span><span>${year}</span>`;
    if (songCount) metaHtml += `<span class="dot"></span><span>${songCount} songs</span>`;
    dom.detailMeta.innerHTML = metaHtml;

    // Store songs for play all
    state.detailSongs = songs;

    // Render tracks
    dom.detailTracks.innerHTML = songs.map((s, i) => renderTrackItem(s, i)).join('');
  }

  // ========================================
  // Music Player
  // ========================================
  async function playSong(songId) {
    let song = null;

    // Try to find song in existing data
    song = findSongInState(songId);

    if (!song) {
      // Fetch from API
      const data = await api.getSongById(songId);
      if (data) {
        song = Array.isArray(data) ? data[0] : data;
      }
    }

    if (!song) {
      showToast('Could not load song');
      return;
    }

    const url = getSongUrl(song);
    if (!url) {
      showToast('No playable URL found');
      return;
    }

    state.currentSong = song;
    state.isPlaying = true;

    // Add to queue if not already there
    const id = getSongId(song);
    const existsInQueue = state.queue.findIndex(q => getSongId(q) === id);
    if (existsInQueue >= 0) {
      state.queueIndex = existsInQueue;
    } else {
      state.queue.push(song);
      state.queueIndex = state.queue.length - 1;
    }

    // Play audio
    state.audio.src = url;
    state.audio.volume = state.volume;
    state.audio.play().catch(err => {
      console.error('Playback error:', err);
      showToast('Playback failed. Try another song.');
    });

    updatePlayerUI();
    updateTrackHighlights();
  }

  function findSongInState(songId) {
    // Search in queue
    let song = state.queue.find(s => getSongId(s) === songId);
    if (song) return song;

    // Search in detail songs
    if (state.detailSongs) {
      song = state.detailSongs.find(s => getSongId(s) === songId);
      if (song) return song;
    }

    // Search in favorites
    song = state.favorites.find(s => getSongId(s) === songId);
    if (song) return song;

    // Search in last search results
    if (state.lastSearchSongs) {
      song = state.lastSearchSongs.find(s => getSongId(s) === songId);
      if (song) return song;
    }

    return null;
  }

  function updatePlayerUI() {
    const song = state.currentSong;
    if (!song) return;

    const name = decodeName(getSongName(song));
    const artist = decodeName(getSongArtist(song));
    const img = getImageUrl(song);
    const id = getSongId(song);
    const isLiked = state.favorites.some(f => getSongId(f) === id);

    dom.playerTitle.textContent = name;
    dom.playerArtist.textContent = artist;
    dom.playerArtImg.src = img;
    dom.playerLikeBtn.innerHTML = isLiked ? '♥' : '♡';
    dom.playerLikeBtn.classList.toggle('liked', isLiked);
    dom.playerArtwork.classList.toggle('is-playing', state.isPlaying);

    // Play/pause button
    dom.btnPlayPause.innerHTML = state.isPlaying ? '⏸' : '▶';

    // Update page title
    document.title = state.isPlaying ? `${name} — Music` : 'Music — Listen Now';
  }

  function updateTrackHighlights() {
    $$('.track-item').forEach(item => {
      const id = item.dataset.songId;
      const isPlaying = state.currentSong && getSongId(state.currentSong) === id;
      item.classList.toggle('playing', isPlaying);
      const numEl = item.querySelector('.track-number');
      if (numEl && isPlaying) {
        numEl.innerHTML = '<span class="now-playing-bars"><span></span><span></span><span></span><span></span></span>';
      }
    });
  }

  function togglePlayPause() {
    if (!state.currentSong) return;

    if (state.isPlaying) {
      state.audio.pause();
      state.isPlaying = false;
    } else {
      state.audio.play();
      state.isPlaying = true;
    }

    updatePlayerUI();
  }

  function playNext() {
    if (state.queue.length === 0) return;

    if (state.repeatMode === 2) {
      // Repeat one
      state.audio.currentTime = 0;
      state.audio.play();
      return;
    }

    if (state.isShuffle) {
      const randomIndex = Math.floor(Math.random() * state.queue.length);
      state.queueIndex = randomIndex;
    } else {
      state.queueIndex++;
      if (state.queueIndex >= state.queue.length) {
        if (state.repeatMode === 1) {
          state.queueIndex = 0; // loop back
        } else {
          state.queueIndex = state.queue.length - 1;
          state.audio.pause();
          state.isPlaying = false;
          updatePlayerUI();
          return;
        }
      }
    }

    const nextSong = state.queue[state.queueIndex];
    if (nextSong) playSong(getSongId(nextSong));
  }

  function playPrev() {
    if (state.audio.currentTime > 3) {
      state.audio.currentTime = 0;
      return;
    }

    if (state.queue.length === 0) return;
    state.queueIndex--;
    if (state.queueIndex < 0) state.queueIndex = state.queue.length - 1;

    const prevSong = state.queue[state.queueIndex];
    if (prevSong) playSong(getSongId(prevSong));
  }

  function toggleShuffle() {
    state.isShuffle = !state.isShuffle;
    dom.btnShuffle2.classList.toggle('active', state.isShuffle);
    showToast(state.isShuffle ? 'Shuffle On' : 'Shuffle Off');
  }

  function toggleRepeat() {
    state.repeatMode = (state.repeatMode + 1) % 3;
    const labels = ['Repeat Off', 'Repeat All', 'Repeat One'];
    const icons = ['🔁', '🔁', '🔂'];
    dom.btnRepeat.innerHTML = icons[state.repeatMode];
    dom.btnRepeat.classList.toggle('active', state.repeatMode > 0);
    showToast(labels[state.repeatMode]);
  }

  // ========================================
  // Play All / Shuffle All
  // ========================================
  function playAllSongs(songs, shuffle = false) {
    if (!songs || songs.length === 0) return;

    let list = [...songs];
    if (shuffle) {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }

    state.queue = list;
    state.queueIndex = 0;
    playSong(getSongId(list[0]));
  }

  // ========================================
  // Favorites
  // ========================================
  function toggleFavorite(songId) {
    const index = state.favorites.findIndex(f => getSongId(f) === songId);
    if (index >= 0) {
      state.favorites.splice(index, 1);
      showToast('Removed from Liked Songs');
    } else {
      const song = findSongInState(songId);
      if (song) {
        state.favorites.push(song);
        showToast('Added to Liked Songs');
      }
    }

    localStorage.setItem('music_favorites', JSON.stringify(state.favorites));
    updatePlayerUI();
    updateTrackHighlights();

    // Refresh favorites page if visible
    if (state.currentPage === 'favorites') {
      renderFavoritesPage();
    }

    // Update like buttons elsewhere
    $$('.track-like-btn').forEach(btn => {
      const trackItem = btn.closest('.track-item');
      if (trackItem && trackItem.dataset.songId === songId) {
        const isLiked = state.favorites.some(f => getSongId(f) === songId);
        btn.classList.toggle('liked', isLiked);
        btn.innerHTML = isLiked ? '♥' : '♡';
      }
    });
  }

  function renderFavoritesPage() {
    if (state.favorites.length === 0) {
      dom.favoritesTrackList.style.display = 'none';
      dom.favoritesEmpty.style.display = 'block';
      dom.favoritesCount.textContent = '0 songs';
    } else {
      dom.favoritesTrackList.style.display = 'block';
      dom.favoritesEmpty.style.display = 'none';
      dom.favoritesCount.textContent = `${state.favorites.length} song${state.favorites.length > 1 ? 's' : ''}`;
      dom.favoritesTracks.innerHTML = state.favorites.map((s, i) => renderTrackItem(s, i)).join('');
    }
  }

  // ========================================
  // Queue Page
  // ========================================
  function renderQueuePage() {
    if (state.queue.length === 0) {
      $('#queueTrackList').style.display = 'none';
      dom.queueEmpty.style.display = 'block';
    } else {
      $('#queueTrackList').style.display = 'block';
      dom.queueEmpty.style.display = 'none';
      dom.queueTracks.innerHTML = state.queue.map((s, i) => renderTrackItem(s, i)).join('');
    }
  }

  // ========================================
  // Browse Page
  // ========================================
  async function loadBrowsePage() {
    renderGenres(dom.browseGenresGrid);
    renderSkeletons(dom.browseTopPicks, 6);

    const picks = await api.searchSongs('new releases 2024');
    if (picks && picks.results) {
      dom.browseTopPicks.innerHTML = picks.results.slice(0, 12).map(s => renderSongCard(s)).join('');
    }
  }

  // ========================================
  // Audio Event Handlers
  // ========================================
  function setupAudioEvents() {
    const audio = state.audio;

    audio.addEventListener('timeupdate', () => {
      if (!audio.duration) return;
      const pct = (audio.currentTime / audio.duration) * 100;
      dom.progressFill.style.width = pct + '%';
      dom.playerCurrentTime.textContent = formatDuration(audio.currentTime);
    });

    audio.addEventListener('loadedmetadata', () => {
      dom.playerTotalTime.textContent = formatDuration(audio.duration);
    });

    audio.addEventListener('ended', () => {
      playNext();
    });

    audio.addEventListener('error', () => {
      console.error('Audio error');
      showToast('Playback error');
    });
  }

  // ========================================
  // Progress Bar & Volume Interaction
  // ========================================
  function setupProgressBar() {
    dom.progressBar.addEventListener('click', (e) => {
      const rect = dom.progressBar.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      if (state.audio.duration) {
        state.audio.currentTime = pct * state.audio.duration;
      }
    });

    dom.volumeSlider.addEventListener('click', (e) => {
      const rect = dom.volumeSlider.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      state.volume = pct;
      state.audio.volume = pct;
      dom.volumeFill.style.width = (pct * 100) + '%';
      dom.btnVolume.innerHTML = pct === 0 ? '🔇' : pct < 0.5 ? '🔉' : '🔊';
    });

    dom.btnVolume.addEventListener('click', () => {
      if (state.audio.volume > 0) {
        state.prevVolume = state.audio.volume;
        state.audio.volume = 0;
        state.volume = 0;
        dom.volumeFill.style.width = '0%';
        dom.btnVolume.innerHTML = '🔇';
      } else {
        state.audio.volume = state.prevVolume || 0.7;
        state.volume = state.audio.volume;
        dom.volumeFill.style.width = (state.volume * 100) + '%';
        dom.btnVolume.innerHTML = state.volume < 0.5 ? '🔉' : '🔊';
      }
    });
  }

  // ========================================
  // Event Bindings
  // ========================================
  function bindEvents() {
    // Sidebar navigation
    $$('.sidebar-nav-item[data-page]').forEach(item => {
      item.addEventListener('click', () => {
        const page = item.dataset.page;
        navigateTo(page);
        if (page === 'favorites') renderFavoritesPage();
        if (page === 'queue') renderQueuePage();
        if (page === 'browse') loadBrowsePage();
      });
    });

    // Mobile menu
    dom.mobileMenuBtn.addEventListener('click', () => {
      dom.sidebar.classList.toggle('open');
      dom.sidebarOverlay.classList.toggle('show');
    });

    dom.sidebarOverlay.addEventListener('click', () => {
      dom.sidebar.classList.remove('open');
      dom.sidebarOverlay.classList.remove('show');
    });

    // Search
    const debouncedSearch = debounce((query) => {
      performSearch(query);
    }, 500);

    dom.searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      if (query.length >= 2) {
        debouncedSearch(query);
      }
    });

    dom.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = e.target.value.trim();
        if (query) performSearch(query);
      }
    });

    // Search tabs
    dom.searchTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.search-tab');
      if (!tab) return;
      const tabName = tab.dataset.tab;
      state.searchTab = tabName;
      $$('.search-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
      $$('.search-results-section').forEach(s => s.classList.toggle('active', s.id === `search-${tabName}`));
    });

    // Player controls
    dom.btnPlayPause.addEventListener('click', togglePlayPause);
    dom.btnNext.addEventListener('click', playNext);
    dom.btnPrev.addEventListener('click', playPrev);
    dom.btnShuffle2.addEventListener('click', toggleShuffle);
    dom.btnRepeat.addEventListener('click', toggleRepeat);

    dom.playerLikeBtn.addEventListener('click', () => {
      if (state.currentSong) {
        toggleFavorite(getSongId(state.currentSong));
      }
    });

    dom.btnQueue.addEventListener('click', () => {
      navigateTo('queue');
      renderQueuePage();
    });

    // Detail page actions
    dom.btnPlayAll.addEventListener('click', () => {
      if (state.detailSongs) playAllSongs(state.detailSongs);
    });

    dom.btnShuffle.addEventListener('click', () => {
      if (state.detailSongs) playAllSongs(state.detailSongs, true);
    });

    // Favorites play all
    dom.btnPlayFavorites.addEventListener('click', () => {
      if (state.favorites.length > 0) playAllSongs(state.favorites);
    });

    // History navigation
    dom.btnBack.addEventListener('click', () => {
      if (state.historyIndex > 0) {
        state.historyIndex--;
        navigateTo(state.pageHistory[state.historyIndex], false);
      }
    });

    dom.btnForward.addEventListener('click', () => {
      if (state.historyIndex < state.pageHistory.length - 1) {
        state.historyIndex++;
        navigateTo(state.pageHistory[state.historyIndex], false);
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Don't capture when typing in search
      if (document.activeElement === dom.searchInput) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      }
      if (e.code === 'ArrowRight' && e.ctrlKey) playNext();
      if (e.code === 'ArrowLeft' && e.ctrlKey) playPrev();
    });
  }

  // ========================================
  // Public API (for inline onclick handlers)
  // ========================================
  window.app = {
    playSong,
    openAlbum,
    openPlaylist,
    toggleFavorite,
    searchGenre(query, name) {
      dom.searchInput.value = name;
      performSearch(query);
    },
    searchByArtist(name) {
      dom.searchInput.value = name;
      performSearch(name);
    },
  };

  // ========================================
  // Initialize App
  // ========================================
  function init() {
    setupAudioEvents();
    setupProgressBar();
    bindEvents();
    navigateTo('home');
    loadHomePage();
  }

  // Start the app
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
