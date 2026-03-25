/** * XCLIPSE // PLAYLIST UPLINK ENGINE
 */

const SPOT_CONFIG = {
    auth: "N2IyNTAzZGY4NjE4NDhmMzhhNTA5YjA0ZjM2NzgwNmQ6NzNlNDY1MDEyMDg0NGQ2YWEwOWYxZWExYWQ2ZjgzZTM=",
    refresh: "AQDmGChsNKOklRGjxM0CuLHtzNin7vw8NcFbWym0RIAJFk9yfpn7eNHeE8u7fIvVIBZadxzhUyXjYzaUGQV415DsbBRfcmBC0vFYwO2GbNeXSkcOZ7HF3ICX93wH7HRXlYk",
    token: "",
    isPlaying: false
};

async function getAccessToken() {
    try {
        const res = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: { 
                'Authorization': 'Basic ' + SPOT_CONFIG.auth, 
                'Content-Type': 'application/x-www-form-urlencoded' 
            },
            body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: SPOT_CONFIG.refresh })
        });
        const data = await res.json();
        SPOT_CONFIG.token = data.access_token;
        console.log("AUTH_REFRESHED");
    } catch (e) { console.error("AUTH_ERROR", e); }
}

async function loadPlaylists() {
    if (!SPOT_CONFIG.token) await getAccessToken();
    
    console.log("FETCHING_PLAYLISTS...");
    try {
        // Updated to the correct endpoint for "My Playlists"
        const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
            headers: { 'Authorization': 'Bearer ' + SPOT_CONFIG.token }
        });

        const container = document.getElementById('playlist-list');
        if (!container) return;

        if (res.status === 403) {
            console.error("SCOPE_ERROR: Your token lacks playlist-read permissions.");
            container.innerHTML = '<div class="playlist-item" style="color:red; font-size:12px;">ERROR: RE-AUTH REQUIRED (SCOPES)</div>';
            return;
        }

        const data = await res.json();
        container.innerHTML = ""; 

        if (!data.items || data.items.length === 0) {
            container.innerHTML = '<div class="playlist-item">NO_DATA_FOUND</div>';
            return;
        }

        data.items.forEach(pl => {
            const item = document.createElement('div');
            item.className = 'playlist-item';
            item.textContent = pl.name.toUpperCase();
            item.onclick = () => playPlaylist(pl.uri);
            container.appendChild(item);
        });
        console.log("PLAYLISTS_RENDERED");
    } catch (e) {
        console.error("LOAD_ERROR", e);
    }
}

async function playPlaylist(uri) {
    try {
        await fetch('https://api.spotify.com/v1/me/player/play', {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + SPOT_CONFIG.token },
            body: JSON.stringify({ context_uri: uri })
        });
        const drawer = document.getElementById('playlist-drawer');
        if(drawer) drawer.classList.remove('open');
        setTimeout(sync, 500);
    } catch (e) { console.error("PLAY_ERROR", e); }
}

async function sync() {
    if (!SPOT_CONFIG.token) await getAccessToken();
    try {
        const res = await fetch('https://api.spotify.com/v1/me/player', {
            headers: { 'Authorization': 'Bearer ' + SPOT_CONFIG.token }
        });
        if (res.status === 200) {
            const data = await res.json();
            SPOT_CONFIG.isPlaying = data.is_playing;
            document.getElementById('track-title').innerText = data.item.name.toUpperCase();
            document.getElementById('artist-name').innerText = data.item.artists[0].name.toUpperCase();
            document.getElementById('main-art').src = data.item.album.images[0].url;
            document.getElementById('blur-bg').style.backgroundImage = `url("${data.item.album.images[0].url}")`;
            
            const pct = (data.progress_ms / data.item.duration_ms) * 100;
            document.documentElement.style.setProperty('--progress', pct + "%");
            document.getElementById('play-pause-btn').innerText = SPOT_CONFIG.isPlaying ? "PAUSE" : "PLAY";
        }
    } catch (e) { console.log("SYNC_IDLE"); }
}

async function cmd(type) {
    let endpoint = `https://api.spotify.com/v1/me/player/${type}`;
    let method = (type === 'next' || type === 'previous') ? 'POST' : 'PUT';

    if (type === 'toggle') {
        endpoint = `https://api.spotify.com/v1/me/player/${SPOT_CONFIG.isPlaying ? 'pause' : 'play'}`;
        method = 'PUT';
    }

    await fetch(endpoint, {
        method: method,
        headers: { 'Authorization': 'Bearer ' + SPOT_CONFIG.token }
    });
    setTimeout(sync, 400);
}

window.Spotify = { sync, cmd, loadPlaylists };