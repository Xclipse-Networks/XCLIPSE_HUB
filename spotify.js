/** * XCLIPSE // PKCE UPLINK ENGINE v3.0 
 * Refined for Netlify Deployment & Secure Auth
 */

const Spotify = {
    clientId: '7b2503df861848f38a509b04f367806d',
    // Hardcode this to match your Spotify Dashboard EXACTLY
    redirectUri: 'https://xclipsehub.netlify.app/spotify', 
    token: localStorage.getItem('spotify_token') || "",
    // ... rest of the code
    isPlaying: false,
    progress: 0,
    timeLeft: 0,

    // 1. START AUTH FLOW (PKCE)
    login: async function() {
        const encoder = new TextEncoder();
        const randomValues = window.crypto.getRandomValues(new Uint8Array(32));
        const codeVerifier = btoa(String.fromCharCode(...randomValues))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
        
        localStorage.setItem('spot_verifier', codeVerifier);

        const data = encoder.encode(codeVerifier);
        const hashed = await window.crypto.subtle.digest('SHA-256', data);
        const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hashed)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

        const params = new URLSearchParams({
            client_id: this.clientId,
            response_type: 'code',
            redirect_uri: this.redirectUri,
            code_challenge_method: 'S256',
            code_challenge: codeChallenge,
            scope: 'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private'
        });

        window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
    },

    // 2. EXCHANGE CODE FOR TOKEN
    getToken: async function(code) {
        const codeVerifier = localStorage.getItem('spot_verifier');

        const response = await fetch('https://developer.spotify.com/dashboard5', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: this.clientId,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: this.redirectUri,
                code_verifier: codeVerifier
            }),
        });

        const data = await response.json();
        if (data.access_token) {
            this.token = data.access_token;
            localStorage.setItem('spotify_token', data.access_token);
            return true;
        }
        return false;
    },

    // 3. CORE SYNC
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

                document.getElementById('track-title').innerText = data.item.name.toUpperCase();
                document.getElementById('artist-name').innerText = data.item.artists[0].name.toUpperCase();
                document.getElementById('main-art').src = data.item.album.images[0].url;
                document.getElementById('blur-bg').style.backgroundImage = `url("${data.item.album.images[0].url}")`;
                document.documentElement.style.setProperty('--progress', this.progress + "%");
                document.getElementById('play-pause-btn').innerText = this.isPlaying ? "PAUSE" : "PLAY";
            } else if (res.status === 401) {
                this.token = ""; 
                localStorage.removeItem('spotify_token');
            }
        } catch (e) { console.log("SYNC_IDLE"); }
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
        if (!this.token) return;
        const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=20', {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        const data = await res.json();
        const container = document.getElementById('playlist-list');
        container.innerHTML = "";
        data.items.forEach(pl => {
            const item = document.createElement('div');
            item.className = 'playlist-item';
            item.textContent = pl.name.toUpperCase();
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
