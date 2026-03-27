/** * XCLIPSE // DYNAMIC UPLINK ENGINE v2.5
 * Features: User-Auth, Intelligent Auto-Sync, UI Data Mapping
 */

const Spotify = {
    token: localStorage.getItem('spotify_token') || "",
    isPlaying: false,
    progress: 0,
    timeLeft: 0, // Used by HTML loop for Intelligent Auto-Sync

    // Helper for API communication
    getHeaders: function() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    },

    // Main Data Sync
    sync: async function() {
        if (!this.token) return;

        try {
            const res = await fetch('https://api.spotify.com/v1/me/player', {
                headers: this.getHeaders()
            });

            // Status 204 means "No content" (Player is likely closed/idle)
            if (res.status === 204) {
                console.log("PLAYER_IDLE");
                return;
            }

            if (res.status === 200) {
                const data = await res.json();
                
                // 1. Calculate Timings for Auto-Sync
                this.isPlaying = data.is_playing;
                this.progress = (data.progress_ms / data.item.duration_ms) * 100;
                this.timeLeft = data.item.duration_ms - data.progress_ms;

                // 2. Update UI Elements
                document.getElementById('track-title').innerText = data.item.name.toUpperCase();
                document.getElementById('artist-name').innerText = data.item.artists[0].name.toUpperCase();
                
                const artUrl = data.item.album.images[0].url;
                document.getElementById('main-art').src = artUrl;
                document.getElementById('blur-bg').style.backgroundImage = `url("${artUrl}")`;
                
                // 3. Update Progress Bar CSS Variable
                document.documentElement.style.setProperty('--progress', this.progress + "%");
                
                // 4. Update Play/Pause Button State
                const ppBtn = document.getElementById('play-pause-btn');
                if (ppBtn) ppBtn.innerText = this.isPlaying ? "PAUSE" : "PLAY";

            } else if (res.status === 401) {
                // Token Expired
                console.warn("AUTH_EXPIRED: RE-LINK REQUIRED");
                // localStorage.removeItem('spotify_token');
            }
        } catch (e) {
            console.log("UPLINK_OFFLINE");
        }
    },

    // Playback Controls
    cmd: async function(type) {
        if (!this.token) return;

        let endpoint = `https://api.spotify.com/v1/me/player/${type}`;
        let method = (type === 'next' || type === 'previous') ? 'POST' : 'PUT';

        if (type === 'toggle') {
            endpoint = `https://api.spotify.com/v1/me/player/${this.isPlaying ? 'pause' : 'play'}`;
            method = 'PUT';
        }

        try {
            await fetch(endpoint, {
                method: method,
                headers: this.getHeaders()
            });
            // Immediate sync after command for responsive feel
            setTimeout(() => this.sync(), 400);
        } catch (e) {
            console.error("CMD_ERROR", e);
        }
    },

    // Playlist Uplink
    loadPlaylists: async function() {
        if (!this.token) {
            const container = document.getElementById('playlist-list');
            if (container) container.innerHTML = '<div class="playlist-item" style="color:var(--accent); font-size:10px;">[ LINK ACCOUNT TO ACCESS ]</div>';
            return;
        }

        try {
            const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=20', {
                headers: this.getHeaders()
            });
            const data = await res.json();
            
            const container = document.getElementById('playlist-list');
            if (!container) return;
            container.innerHTML = "";

            if (!data.items || data.items.length === 0) {
                container.innerHTML = '<div class="playlist-item">NO_PLAYLISTS_FOUND</div>';
                return;
            }

            data.items.forEach(pl => {
                const item = document.createElement('div');
                item.className = 'playlist-item';
                item.textContent = pl.name.toUpperCase();
                item.onclick = () => this.playPlaylist(pl.uri);
                container.appendChild(item);
            });
        } catch (e) {
            console.error("PLAYLIST_UPLINK_ERROR", e);
        }
    },

    // Trigger Playback from Playlist
    playPlaylist: async function(uri) {
        try {
            await fetch('https://api.spotify.com/v1/me/player/play', {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify({ context_uri: uri })
            });
            // Close drawer and sync
            document.getElementById('playlist-drawer').classList.remove('open');
            setTimeout(() => this.sync(), 600);
        } catch (e) {
            console.error("EXECUTION_ERROR: ENSURE_ACTIVE_DEVICE");
            alert("Open Spotify on a device first!");
        }
    }
};

// Global Uplink
window.Spotify = Spotify;