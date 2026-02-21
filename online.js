const sunucuAdresi = "157.90.133.100:25629";␊
␊
// --- 1. SUNUCU DURUMU (Düzeltilmiş) ---␊
function sunucuDurumunuGuncelle() {␊
    const display = document.getElementById('online-sayisi');␊
    const statusText = document.getElementById('status-text');␊
    const dot = document.getElementById('status-dot');␊
␊
    fetch(`https://api.mcsrvstat.us/2/${sunucuAdresi}`)␊
        .then(response => response.json())␊
        .then(data => {␊
            if (data.online === true) {␊
                const oyuncuSayisi = data.players ? data.players.online : 0;␊
                display.innerText = oyuncuSayisi;␊
                if(statusText) statusText.innerText = "CANLI";␊
                if(dot) {␊
                    dot.classList.remove('dot-offline');␊
                    dot.style.backgroundColor = "#00ff88";␊
                    dot.style.boxShadow = "0 0 10px #00ff88";␊
                }␊
            } else {␊
                display.innerText = "0";␊
                if(statusText) statusText.innerText = "KAPALI";␊
                if(dot) {␊
                    dot.classList.add('dot-offline');␊
                }␊
            }␊
        })␊
        .catch(err => {␊
            console.error("API hatası:", err);␊
            if(display) display.innerText = "?";␊
            if(statusText) statusText.innerText = "HATA";␊
            if(dot) {␊
                dot.classList.add('dot-offline');␊
            }␊
        });␊
}␊
␊
// --- 2. WEB ÜZERİNDEN SÜRE TAKİBİ (Benim Eklediğim) ---␊
async function webSureTakibi() {␊
    const user = decodeURIComponent((document.cookie.match(/(?:^|; )atlas_session=([^;]*)/) || [])[1] || '');
    if (!user) return;␊
␊
    // Her 60 saniyede bir Worker'a "ben buradayım" sinyali gönderir␊
    try {␊
        await fetch('https://atlasnetwork.tahaozturk804.workers.dev/update-online', {␊
            method: 'POST',␊
            headers: { 'Content-Type': 'application/json' },␊
            body: JSON.stringify({ user })␊
        });␊
        console.log("Oyun süresi ve IP senkronize edildi.");␊
    } catch (e) {␊
        console.log("Süre takibi hatası.");␊
    }␊
}␊
␊
// BAŞLATICI␊
document.addEventListener('DOMContentLoaded', () => {␊
    sunucuDurumunuGuncelle();␊
    // Süre takibini hemen başlat ve her dakikada bir tekrarla␊
    webSureTakibi();␊
    setInterval(webSureTakibi, 60000); ␊
});␊
␊
// Her 60 saniyede bir sunucu durumunu da tazele␊
setInterval(sunucuDurumunuGuncelle, 60000);
