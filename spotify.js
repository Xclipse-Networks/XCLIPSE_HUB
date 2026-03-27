/** * XCLIPSE // ENHANCED PKCE CORE v4.0 
 * Optimized for: https://xclipsehub.netlify.app/callback
 */

const Spotify = {
    clientId: '7b2503df861848f38a509b04f367806d',
    redirectUri: 'https://xclipsehub.netlify.app/callback', 
    token: localStorage.getItem('spotify_token') || "",
    isPlaying: false,
    progress: 0,
    timeLeft: 0,

    // SESSION TERMINATION
    logout: function() {
        localStorage.removeItem('spotify_token');
        localStorage.removeItem('spot_verifier');
        window.location.href = window.location.origin + window.location.pathname;
    },

    // PKCE GENERATION
    login: async function() {
        const verifier = btoa(String.fromCharCode(...window.crypto.getRandomValues(new Uint8Array(32))))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
        
        localStorage.setItem('spot_verifier', verifier);

        const sha256 = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
        const challenge = btoa(String.fromCharCode(...new Uint8Array(sha256)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

        const params = new URLSearchParams({
            client_id: this.clientId,
            response_type: 'code',
            redirect_uri: this.redirectUri,
            code_challenge_method: 'S256',
            code_challenge: challenge,
            scope: 'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private'
        });

        window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
    },

    // TOKEN UPLINK
    getToken: async function(code) {
        const verifier = localStorage.getItem('spot_verifier');
        try {
            const res = await fetch('https://developer.spotify.com/dashboard5', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: this.clientId,
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: this.redirectUri,
                    code_verifier: verifier
                }),
            });
            const data = await res.json();
            if (data.access_token) {
                this.token = data.access_token;
                localStorage.setItem('spotify_token', data.access_token);
                return true;
            }
        } catch (e) { console.error("AUTH_ERROR", e); }
        return false;
    },

    getUserProfile: async function() {
        if (!this.token) return null;
        try {
            const res = await fetch('https://developer.spotify.com/dashboard7', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            return res.ok ? await res.json() : null;
        } catch (e) { return null; }
    },

    // RECTIVE ENGINE
    sync: async function() {
        if (!this.token) return;
        try {
            const res = await fetch('https://api.spotify.com/v1/me/player', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (res.status === 200) {
                const data = await res.json();
                this.isPlaying = data.is_playing;
                this.progress = (data.progress_ms / data.item.duration_ms) * 100;
                this.timeLeft = data.item.duration_ms - data.progress_ms;

                document.getElementById('track-title').innerText = data.item.name;
                document.getElementById('artist-name').innerText = data.item.artists[0].name;
                document.getElementById('main-art').src = data.item.album.images[0].url;
                document.getElementById('blur-bg').style.backgroundImage = `url("${data.item.album.images[0].url}")`;
                document.documentElement.style.setProperty('--progress', this.progress + "%");
                document.getElementById('play-pause-btn').innerText = this.isPlaying ? "PAUSE_SYSTEM" : "RESUME_SYSTEM";
            } else if (res.status === 401) { this.logout(); }
        } catch (e) { console.warn("SIGNAL_IDLE"); }
    },

    cmd: async function(type) {
        if (!this.token) return;
        let endpoint = `https://api.spotify.com/v1/me/player/${type}`;
        if (type === 'toggle') endpoint = `https://api.spotify.com/v1/me/player/${this.isPlaying ? 'pause' : 'play'}`;
        
        await fetch(endpoint, {
            method: (type === 'next' || type === 'previous') ? 'POST' : 'PUT',
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        setTimeout(() => this.sync(), 400);
    },

    loadPlaylists: async function() {
        const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=20', {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        const data = await res.json();
        const container = document.getElementById('playlist-list');
        container.innerHTML = "";
        data.items.slice(0, 15).forEach(pl => {
            const item = document.createElement('div');
            item.className = 'playlist-item';
            item.textContent = "> " + pl.name.toUpperCase();
            item.onclick = () => this.playPlaylist(pl.uri);
            container.appendChild(item);
        });
    },

    playPlaylist: async function(uri) {
        await fetch('https://api.spotify.com/v1/me/player/play', {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${this.token}` },
            body: JSON.stringify({ context_uri: uri })
        });
        document.getElementById('playlist-drawer').classList.remove('open');
        setTimeout(() => this.sync(), 500);
    }
};

window.Spotify = Spotify;
