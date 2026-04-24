// Web APIs used: MediaDevices/getUserMedia (mic) + Notifications API

let audioCtx, analyser, micStream, rafId;
let isMonitoring = false;
let dbHistory = [], dbMin = Infinity, dbMax = -Infinity, dbSum = 0, dbCount = 0;
let alertThreshold = 55, alertCooldown = false, aboveThresholdStart = null;
let notifPermission = 'default';
let sessionDuration = 25 * 60, sessionRemaining = sessionDuration;
let sessionRunning = false, sessionInterval = null;
const RING_C = 2 * Math.PI * 34;

const waveCanvas = document.getElementById('waveform');
const waveCtx = waveCanvas.getContext('2d');
const sparkCanvas = document.getElementById('sparkline');
const sparkCtx = sparkCanvas.getContext('2d');

// MIC

async function startMic() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStream = stream;
        audioCtx = new AudioContext();
        const src = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.6;
        src.connect(analyser);
        isMonitoring = true;

        document.getElementById('idleMsg').style.display = 'none';
        document.getElementById('liveView').style.display = 'block';
        document.getElementById('btnStart').disabled = true;
        document.getElementById('btnStopMic').disabled = false;
        document.getElementById('permMicStatus').textContent = '🎙  Mic: Active';
        document.getElementById('deniedCard').style.display = 'none';
        dbHistory = []; dbMin = Infinity; dbMax = -Infinity; dbSum = 0; dbCount = 0;

        tick();
        setInterval(recordHistory, 1000);
    } catch (err) {
        document.getElementById('permMicStatus').textContent = '🎙  Mic: Denied';
        document.getElementById('deniedCard').style.display = 'block';
        document.getElementById('btnStart').disabled = false;
    }
}

function stopMic() {
    isMonitoring = false;
    cancelAnimationFrame(rafId);
    micStream?.getTracks().forEach(t => t.stop());
    audioCtx?.close();
    micStream = audioCtx = null;
    document.getElementById('idleMsg').style.display = 'block';
    document.getElementById('liveView').style.display = 'none';
    document.getElementById('btnStart').disabled = false;
    document.getElementById('btnStopMic').disabled = true;
    document.getElementById('permMicStatus').textContent = '🎙  Mic: Off';
}

function getRMS(data) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
    }
    return Math.sqrt(sum / data.length);
}

function rmsToDb(rms) {
    if (!rms) return 0;
    return Math.max(20, Math.min(95, 20 * Math.log10(rms) + 100));
}

function tick() {
    if (!isMonitoring) return;
    rafId = requestAnimationFrame(tick);
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    const db = rmsToDb(getRMS(data));
    updateMeter(db);
    drawWaveform(data);
    checkAlert(db);
}

function updateMeter(db) {
    if (db < dbMin) dbMin = db;
    if (db > dbMax) dbMax = db;
    dbSum += db; dbCount++;

    document.getElementById('dbNumber').textContent = Math.round(db);
    document.getElementById('statMin').textContent = Math.round(dbMin);
    document.getElementById('statMax').textContent = Math.round(dbMax);
    document.getElementById('statAvg').textContent = Math.round(dbSum / dbCount);

    let zone, label, color;
    if (db <= 40)      { zone = 'quiet';     label = 'Quiet';     color = 'var(--green)'; }
    else if (db <= 58) { zone = 'moderate';  label = 'Moderate';  color = '#e9a319'; }
    else if (db <= 72) { zone = 'loud';      label = 'Loud';      color = 'var(--amber)'; }
    else               { zone = 'very-loud'; label = 'Very Loud'; color = 'var(--red)'; }

    document.getElementById('dbNumber').style.color = color;
    const badge = document.getElementById('zoneBadge');
    badge.className = 'zone-badge zone-' + zone;
    badge.textContent = label;

    [[0,40],[40,58],[58,72],[72,90]].forEach(([lo, hi], i) => {
        document.getElementById('bar' + i).style.width =
            Math.max(0, Math.min(1, (db - lo) / (hi - lo))) * 100 + '%';
    });
}

function recordHistory() {
    if (!isMonitoring || !analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    dbHistory.push(rmsToDb(getRMS(data)));
    if (dbHistory.length > 60) dbHistory.shift();
    drawSparkline();
}

function drawWaveform(data) {
    const W = waveCanvas.width, H = waveCanvas.height;
    waveCtx.clearRect(0, 0, W, H);
    waveCtx.fillStyle = '#f5f2eb';
    waveCtx.fillRect(0, 0, W, H);
    waveCtx.beginPath();
    waveCtx.strokeStyle = '#2d6a4f';
    waveCtx.lineWidth = 2;
    const sw = W / data.length;
    for (let i = 0; i < data.length; i++) {
        const y = (data[i] / 128.0 * H) / 2;
        i === 0 ? waveCtx.moveTo(0, y) : waveCtx.lineTo(i * sw, y);
    }
    waveCtx.stroke();
}

function drawSparkline() {
    const W = sparkCanvas.width, H = sparkCanvas.height, pad = 8;
    sparkCtx.clearRect(0, 0, W, H);
    sparkCtx.fillStyle = '#f5f2eb';
    sparkCtx.fillRect(0, 0, W, H);
    if (dbHistory.length < 2) return;

    const toY = v => H - pad - ((v - 20) / 70) * (H - pad * 2);
    const toX = i => pad + (i / (dbHistory.length - 1)) * (W - pad * 2);

    sparkCtx.beginPath();
    sparkCtx.strokeStyle = '#f0b89a';
    sparkCtx.setLineDash([6, 4]);
    sparkCtx.moveTo(pad, toY(alertThreshold));
    sparkCtx.lineTo(W - pad, toY(alertThreshold));
    sparkCtx.stroke();
    sparkCtx.setLineDash([]);

    sparkCtx.beginPath();
    sparkCtx.moveTo(toX(0), H);
    dbHistory.forEach((v, i) => sparkCtx.lineTo(toX(i), toY(v)));
    sparkCtx.lineTo(toX(dbHistory.length - 1), H);
    sparkCtx.closePath();
    sparkCtx.fillStyle = 'rgba(45,106,79,0.12)';
    sparkCtx.fill();

    sparkCtx.beginPath();
    sparkCtx.strokeStyle = '#2d6a4f';
    sparkCtx.lineWidth = 2;
    dbHistory.forEach((v, i) => i === 0 ? sparkCtx.moveTo(toX(i), toY(v)) : sparkCtx.lineTo(toX(i), toY(v)));
    sparkCtx.stroke();
}

// NOTIFICATIONS

async function requestNotifications() {
    if (!('Notification' in window)) { alert('Browser does not support notifications.'); return; }
    notifPermission = await Notification.requestPermission();
    updateNotifStatus();
}

function updateNotifStatus() {
    const el = document.getElementById('permNotiStatus');
    if (notifPermission === 'granted') {
        el.textContent = '🔔 Notifications: On';
        document.getElementById('btnEnableNotif').textContent = 'Notifications Enabled ✓';
        document.getElementById('btnEnableNotif').disabled = true;
    } else {
        el.textContent = notifPermission === 'denied' ? '🔔 Notifications: Blocked' : '🔔 Notifications: --';
    }
}

function sendNotification(title, body) {
    if (notifPermission !== 'granted') return;
    new Notification(title, { body });
    addAlertLog(title + ' — ' + body);
}

function addAlertLog(msg) {
    document.getElementById('emptyLog').style.display = 'none';
    const ul = document.getElementById('alertLog');
    ul.style.display = 'block';
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const li = document.createElement('li');
    li.innerHTML = `<span class="al-msg">${msg}</span><span class="al-time">${ts}</span>`;
    ul.prepend(li);
}

function checkAlert(db) {
    if (db > alertThreshold) {
        if (!aboveThresholdStart) aboveThresholdStart = Date.now();
        else if (!alertCooldown && Date.now() - aboveThresholdStart >= 5000) triggerAlert(db);
    } else {
        aboveThresholdStart = null;
    }
}

function triggerAlert(db) {
    alertCooldown = true;
    setTimeout(() => alertCooldown = false, 30000);
    sendNotification('🔊 QuietZone Alert',
        `Noise exceeded ${alertThreshold} dB (currently ${Math.round(db)} dB). Consider moving or using headphones.`);
    const card = document.getElementById('meterCard');
    card.classList.add('alert-flash');
    setTimeout(() => card.classList.remove('alert-flash'), 2000);
}

// TIMER

const formatTime = s => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

function updateRing() {
    const frac = sessionRunning ? 1 - sessionRemaining / sessionDuration : 0;
    document.getElementById('ringFg').style.strokeDashoffset = RING_C - frac * RING_C;
}

function startSession() {
    if (sessionRunning) return;
    sessionRunning = true;
    document.getElementById('btnSession').textContent = 'Pause';
    document.getElementById('btnResetSession').disabled = false;
    document.getElementById('timerLabel').textContent = 'Session in progress';
    sessionInterval = setInterval(() => {
        if (sessionRemaining <= 0) {
            clearInterval(sessionInterval);
            sessionRunning = false;
            document.getElementById('btnSession').textContent = 'Start Session';
            document.getElementById('timerLabel').textContent = 'Session complete! 🎉';
            sendNotification('✅ Session Complete', `Your ${Math.round(sessionDuration/60)}-minute session is done. Take a break!`);
            return;
        }
        sessionRemaining--;
        document.getElementById('timerDisplay').textContent = formatTime(sessionRemaining);
        updateRing();
    }, 1000);
}

function pauseSession() {
    clearInterval(sessionInterval);
    sessionRunning = false;
    document.getElementById('btnSession').textContent = 'Resume';
    document.getElementById('timerLabel').textContent = 'Paused';
}

function resetSession() {
    clearInterval(sessionInterval);
    sessionRunning = false;
    sessionRemaining = sessionDuration;
    document.getElementById('timerDisplay').textContent = formatTime(sessionRemaining);
    document.getElementById('btnSession').textContent = 'Start Session';
    document.getElementById('timerLabel').textContent = 'Ready';
    document.getElementById('btnResetSession').disabled = true;
    updateRing();
}

// EVENTS

document.getElementById('btnStart').addEventListener('click', startMic);
document.getElementById('btnStopMic').addEventListener('click', stopMic);
document.getElementById('btnEnableNotif').addEventListener('click', requestNotifications);
document.getElementById('btnTestNotif').addEventListener('click', async () => {
    if (notifPermission !== 'granted') await requestNotifications();
    if (notifPermission === 'granted') sendNotification('🔔 Test', 'Notifications are working!');
});
document.getElementById('thresholdSlider').addEventListener('input', function() {
    alertThreshold = +this.value;
    document.getElementById('thresholdVal').textContent = alertThreshold + ' dB';
    drawSparkline();
});
document.getElementById('btnSession').addEventListener('click', () => sessionRunning ? pauseSession() : startSession());
document.getElementById('btnResetSession').addEventListener('click', resetSession);
document.querySelectorAll('.preset-btn').forEach(btn => btn.addEventListener('click', function() {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    sessionDuration = +this.dataset.minutes * 60;
    resetSession();
}));

// init
if ('Notification' in window) { notifPermission = Notification.permission; updateNotifStatus(); }
document.getElementById('timerDisplay').textContent = formatTime(sessionRemaining);
updateRing();
