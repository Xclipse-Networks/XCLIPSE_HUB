/** * XCLIPSE // CORE_ENGINE v4.8
 * Auth: PKCE Secure // UI: Reactive Visualizer
 */

const Visualizer = {
    bars: [],
    interval: null,
    init: function() { this.bars = document.querySelectorAll('.v-bar'); },
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
                bar.style.height = `${Math.floor(Math.random() * 35) + 5}px`;
            });
        }, 150);
    }
};

const Spotify = {
    clientId: '7b2503df861848f38a509b04f367806d',
    redirectUri: 'https://xclipsehub.netlify.app/callback',
    token: localStorage.getItem('spotify_token') || "",
    isPlaying: false,
    timeLeft: 0,
    currentTrackId: "",

    logout: function() {
        localStorage.clear();
        window.location.href = 'spotify.html';
    },

    login: async function() {
        const verifier = btoa(String.fromCharCode(...window.crypto.getRandomValues(new Uint8Array(32))))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
        localStorage.setItem('spot_verifier', verifier);

        const sha256 = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
        const challenge = btoa(String.fromCharCode(...new Uint8Array(sha256)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

        const scope = 'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private';
        window.location.href = `https://accounts.spotify.com/authorize?$?client_id=${this.clientId}&response_type=code&redirect_uri=${encodeURIComponent(this.redirectUri)}&code_challenge_method=S256&code_challenge=${challenge}&scope=${encodeURIComponent(scope)}`;
    },

    getToken: async function(code) {
        try {
            const res = await fetch('https://developer.spotify.com/dashboard5', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: this.clientId,
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: this.redirectUri,
                    code_verifier: localStorage.getItem('spot_verifier')
                }),
            });
            const data = await res.json();
            if (data.access_token) {
                this.token = data.access_token;
                localStorage.setItem('spotify_token', data.access_token);
            }
        } catch (e) { console.error("TOKEN_EXCHANGE_ERROR", e); }
    },

    getUserProfile: async function() {
        const res = await fetch('https://developer.spotify.com/dashboard7', {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        return res.ok ? await res.json() : null;
    },

    sync: async function() {
        if (!this.token) return;
        try {
            const res = await fetch('https://api.spotify.com/v1/me/player', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (res.status === 200) {
                const data = await res.json();
                this.isPlaying = data.is_playing;
                this.timeLeft = data.item.duration_ms - data.progress_ms;

                // Track Change Glitch
                if (this.currentTrackId !== data.item.id) {
                    const art = document.getElementById('art-holder');
                    art.style.filter = "hue-rotate(90deg) brightness(1.5)";
                    setTimeout(() => art.style.filter = "none", 300);
                    this.currentTrackId = data.item.id;
                }

                Visualizer.animate(this.isPlaying);
                document.getElementById('track-title').innerText = data.item.name.toUpperCase();
                document.getElementById('artist-name').innerText = data.item.artists[0].name.toUpperCase();
                document.getElementById('main-art').src = data.item.album.images[0].url;
                document.getElementById('blur-bg').style.backgroundImage = `url("${data.item.album.images[0].url}")`;
                document.documentElement.style.setProperty('--progress', (data.progress_ms / data.item.duration_ms * 100) + "%");
                document.getElementById('play-pause-btn').innerText = this.isPlaying ? "PAUSE_SYS" : "RESUME_SYS";
            }
        } catch (e) { console.log("CORE_SYNC_WAITING"); }
    },

    cmd: async function(type) {
        let endpoint = `https://api.spotify.com/v1/me/player/$${type}`;
        if (type === 'toggle') endpoint = `https://api.spotify.com/v1/me/player/$${this.isPlaying ? 'pause' : 'play'}`;
        await fetch(endpoint, {
            method: (type === 'next' || type === 'previous') ? 'POST' : 'PUT',
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        setTimeout(() => this.sync(), 400);
    }
};

window.addEventListener('DOMContentLoaded', () => Visualizer.init());
window.Spotify = Spotify;
