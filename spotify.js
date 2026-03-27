/** * XCLIPSE // CORE_ENGINE v5.0
 * Status: HIGH_SOPHISTICATION // PKCE_ENCRYPTED
 * Dedicated to: 2025 Ford Ranger Wildtrak // Xclipse Studio Protocols
 */

const Visualizer = {
    bars: [],
    interval: null,
    init: function() { 
        this.bars = document.querySelectorAll('.v-bar'); 
    },
    animate: function(active) {
        if (!active) {
            this.bars.forEach(bar => bar.style.height = '2px');
            clearInterval(this.interval);
            this.interval = null;
            return;
        }
        if (this.interval) return;
        this.interval = setInterval(() => {
            this.bars.forEach(bar => {
                // Random frequency simulation
                const height = Math.floor(Math.random() * 38) + 4;
                bar.style.height = `${height}px`;
            });
        }, 120);
    }
};

const Spotify = {
    // CRITICAL: HARDCODED TO PREVENT "NOT PRESENT" ERRORS
    clientId: '7b2503df861848f38a509b04f367806d',
    redirectUri: 'https://xclipsehub.netlify.app/callback',
    token: localStorage.getItem('spotify_token') || "",
    isPlaying: false,
    timeLeft: 0,
    currentTrackId: "",

    // TERMINATE SESSION & WIPE CACHE
    logout: function() {
        localStorage.clear();
        window.location.href = 'spotify.html';
    },

    // INITIATE UPLINK (PKCE FLOW)
    login: async function() {
        console.log("> INITIATING_SECURE_AUTH...");
        
        // 1. Generate Cryptographic Verifier
        const array = new Uint8Array(32);
        window.crypto.getRandomValues(array);
        const verifier = btoa(String.fromCharCode(...array))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
        localStorage.setItem('spot_verifier', verifier);

        // 2. Generate Challenge (S256)
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const digest = await window.crypto.subtle.digest('SHA-256', data);
        const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

        // 3. Construct Hardened URL
        const authUrl = new URL("https://accounts.spotify.com/authorize");
        const params = {
            client_id: this.clientId,
            response_type: 'code',
            redirect_uri: this.redirectUri,
            code_challenge_method: 'S256',
            code_challenge: challenge,
            scope: 'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private',
            show_dialog: true
        };

        authUrl.search = new URLSearchParams(params).toString();
        window.location.href = authUrl.toString();
    },

    // EXCHANGE TEMPORARY CODE FOR PERSISTENT TOKEN
    getToken: async function(code) {
        const verifier = localStorage.getItem('spot_verifier');
        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
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

            const data = await response.json();
            if (data.access_token) {
                this.token = data.access_token;
                localStorage.setItem('spotify_token', data.access_token);
                return true;
            }
        } catch (err) {
            console.error("> UPLINK_SYNC_FAILED:", err);
        }
        return false;
    },

    // FETCH USER IDENTITY
    getUserProfile: async function() {
        if (!this.token) return null;
        const res = await fetch('https://api.spotify.com/v1/me', {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        return res.ok ? await res.json() : null;
    },

    // REACTIVE SYNC ENGINE
    sync: async function() {
        if (!this.token) return;
        try {
            const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (res.status === 200) {
                const data = await res.json();
                this.isPlaying = data.is_playing;
                this.timeLeft = data.item.duration_ms - data.progress_ms;

                // Track Change Detection (Trigger Glitch)
                if (this.currentTrackId !== data.item.id) {
                    const art = document.getElementById('main-art');
                    art.style.filter = "invert(1) hue-rotate(180deg)";
                    setTimeout(() => art.style.filter = "none", 250);
                    this.currentTrackId = data.item.id;
                }

                Visualizer.animate(this.isPlaying);
                
                // Update UI
                document.getElementById('track-title').innerText = data.item.name.toUpperCase();
                document.getElementById('artist-name').innerText = data.item.artists[0].name.toUpperCase();
                document.getElementById('main-art').src = data.item.album.images[0].url;
                document.getElementById('blur-bg').style.backgroundImage = `url("${data.item.album.images[0].url}")`;
                
                // Progress Bar Logic
                const percent = (data.progress_ms / data.item.duration_ms) * 100;
                document.documentElement.style.setProperty('--progress', percent + "%");
                document.getElementById('play-pause-btn').innerText = this.isPlaying ? "PAUSE_CORE" : "RESUME_CORE";
                
            } else if (res.status === 401) {
                // Token Expired
                this.token = "";
                localStorage.removeItem('spotify_token');
            }
        } catch (e) {
            console.log("> SIGNAL_IDLE...");
        }
    },

    // SYSTEM COMMANDS (PLAY/PAUSE/SKIP)
    cmd: async function(type) {
        if (!this.token) return;
        let endpoint = `https://api.spotify.com/v1/me/player/${type}`;
        if (type === 'toggle') {
            endpoint = `https://api.spotify.com/v1/me/player/${this.isPlaying ? 'pause' : 'play'}`;
        }
        
        await fetch(endpoint, {
            method: (type === 'next' || type === 'previous') ? 'POST' : 'PUT',
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        // Immediate sync after command
        setTimeout(() => this.sync(), 400);
    }
};

// Initialize components on load
window.addEventListener('DOMContentLoaded', () => {
    Visualizer.init();
});

window.Spotify = Spotify;
