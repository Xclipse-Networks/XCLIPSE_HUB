/** * XCLIPSE // CORE_V17 
 * Atmospheric Brutalist Logic
 */

const SPOT_CONFIG = {
    auth: "N2IyNTAzZGY4NjE4NDhmMzhhNTA5YjA0ZjM2NzgwNmQ6NzNlNDY1MDEyMDg0NGQ2YWEwOWYxZWExYWQ2ZjgzZTM=",
    refresh: "AQAeeau4OCRuyj6op1mJt6xK9a7HgIAs0WC7zBqPvSIoqP_F1M2ybUBGyBtfnej5yaus9hjb9KBV1u7ZStbrQ7BK-_fTEF2F5kvuOHWDnUOsHvmjkb1VP06D_P4bG-HWdCg",
    token: "",
    isPlaying: false
};

async function getAccessToken() {
    const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Authorization': 'Basic ' + SPOT_CONFIG.auth, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: SPOT_CONFIG.refresh })
    });
    const data = await res.json();
    SPOT_CONFIG.token = data.access_token;
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
            
            // Update Text
            document.getElementById('track-title').innerText = data.item.name.toUpperCase();
            document.getElementById('artist-name').innerText = data.item.artists[0].name.toUpperCase();
            
            // Reactive Background Logic
            const artUrl = data.item.album.images[0].url;
            document.getElementById('main-art').src = artUrl;
            document.getElementById('blur-bg').style.backgroundImage = `url("${artUrl}")`;
            
            // Progress Calculation
            const pct = (data.progress_ms / data.item.duration_ms) * 100;
            document.documentElement.style.setProperty('--progress', pct + "%");
            
            // State Class
            if(SPOT_CONFIG.isPlaying) document.body.classList.add('is-playing');
            else document.body.classList.remove('is-playing');

        } else if (res.status === 401) { await getAccessToken(); }
    } catch (e) { console.error("OFFLINE"); }
}

async function cmd(type) {
    let url = `https://api.spotify.com/v1/me/player/$$${type}`;
    if (type === 'toggle') url = `https://api.spotify.com/v1/me/player/$$${SPOT_CONFIG.isPlaying ? 'pause' : 'play'}`;
    
    await fetch(url, {
        method: (type === 'next' || type === 'previous') ? 'POST' : 'PUT',
        headers: { 'Authorization': 'Bearer ' + SPOT_CONFIG.token }
    });
    setTimeout(sync, 300);
}

window.Spotify = { sync, cmd };