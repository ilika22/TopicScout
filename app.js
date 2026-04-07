/* ============================================================
   TopicScout — app.js (Full Featured)
   Features: Dark mode, Progress, Gauge, Radar, Compare,
             Multi-Topic, PDF Export, Share, History
   ============================================================ */

const API = "http://127.0.0.1:5000";

// ===== THEME =====
const themeToggle = document.getElementById("themeToggle");
const savedTheme = localStorage.getItem("ts_theme") || "light";
document.documentElement.setAttribute("data-theme", savedTheme);
themeToggle.textContent = savedTheme === "dark" ? "☀️" : "🌙";
themeToggle.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("ts_theme", next);
    themeToggle.textContent = next === "dark" ? "☀️" : "🌙";
});

// ===== TABS =====
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
        if (btn.dataset.tab === "history") renderHistory();
    });
});

// ===== UTILS =====
function extractYouTubeID(url) {
    const m = url.match(/(?:youtube\.com\/.*[?&]v=|youtu\.be\/)([^"&?\/\s]{11})/);
    return m ? m[1] : null;
}
function formatTime(s) {
    s = Math.floor(s);
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
    return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
}
function highlight(text, kw) {
    if (!kw) return text;
    return text.replace(new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")})`, "gi"), "<mark>$1</mark>");
}
function verdictBadge(score) {
    if (score >= 60) return `<span class="verdict-badge verdict-high">🟢 Highly Relevant</span>`;
    if (score >= 35) return `<span class="verdict-badge verdict-mid">🟡 Moderately Relevant</span>`;
    return `<span class="verdict-badge verdict-low">🔴 Low Relevance</span>`;
}
async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
function downloadNotes(notes, topic) {
    const blob = new Blob([`TopicScout Notes — ${topic}\n${"=".repeat(50)}\n\n` + notes.map((n,i)=>`${i+1}. ${n}`).join("\n\n")], {type:"text/plain"});
    Object.assign(document.createElement("a"), {href: URL.createObjectURL(blob), download:`notes-${topic}.txt`}).click();
}

// ===== PROGRESS =====
const stepIds = ["step1","step2","step3","step4"];
const stepPcts = [15, 40, 70, 90];
function showProgress() {
    document.getElementById("progressWrap").style.display = "block";
    stepIds.forEach(s => { const e=document.getElementById(s); e.classList.remove("active","done"); });
    document.getElementById("progressFill").style.width = "0%";
}
function setStep(i) {
    stepIds.forEach((s,j) => {
        const e = document.getElementById(s);
        e.classList.remove("active","done");
        if (j < i) e.classList.add("done");
        else if (j === i) e.classList.add("active");
    });
    document.getElementById("progressFill").style.width = (stepPcts[i]||0) + "%";
}
function completeProgress() {
    stepIds.forEach(s => { const e=document.getElementById(s); e.classList.remove("active"); e.classList.add("done"); });
    document.getElementById("progressFill").style.width = "100%";
    setTimeout(() => document.getElementById("progressWrap").style.display = "none", 800);
}

// ===== HISTORY =====
const HIST_KEY = "ts_history";
function getHistory() { try { return JSON.parse(localStorage.getItem(HIST_KEY)) || []; } catch { return []; } }
function saveToHistory(e) {
    let h = getHistory().filter(x => !(x.videoId===e.videoId && x.topic===e.topic));
    h.unshift(e); h = h.slice(0,5);
    localStorage.setItem(HIST_KEY, JSON.stringify(h));
}
function renderHistory() {
    const h = getHistory(), el = document.getElementById("historyList");
    if (!h.length) { el.innerHTML = `<p class="muted">No recent searches yet.</p>`; return; }
    el.innerHTML = h.map((item,i) => `
        <div class="history-item" data-url="${item.url}" data-topic="${item.topic}">
            <img class="history-thumb" src="https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg" alt="">
            <div class="history-info">
                <div class="history-topic">${item.topic}</div>
                <div class="history-meta">${item.videoId} · ${item.date}</div>
            </div>
            <div class="history-score-badge">${item.score}%</div>
        </div>`).join("");
    el.querySelectorAll(".history-item").forEach(item => {
        item.addEventListener("click", () => {
            document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c=>c.classList.remove("active"));
            document.querySelector('[data-tab="single"]').classList.add("active");
            document.getElementById("tab-single").classList.add("active");
            document.getElementById("urlInput").value = item.dataset.url;
            document.getElementById("topicInput").value = item.dataset.topic;
            document.getElementById("urlForm").dispatchEvent(new Event("submit"));
        });
    });
}
document.getElementById("clearHistory").addEventListener("click", () => { localStorage.removeItem(HIST_KEY); renderHistory(); });

// ===== GAUGE (SVG donut) =====
function buildGauge(score, label) {
    const r = 54, circ = 2 * Math.PI * r;
    const fill = (score / 100) * circ;
    const color = score >= 60 ? "#2a9d5c" : score >= 35 ? "#d4a017" : "#e85d26";
    return `
    <div class="gauge-wrap">
        <svg viewBox="0 0 120 120" class="gauge-svg">
            <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--progress-bg)" stroke-width="12"/>
            <circle cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="12"
                stroke-dasharray="${fill} ${circ}" stroke-dashoffset="${circ/4}"
                stroke-linecap="round" class="gauge-arc"/>
        </svg>
        <div class="gauge-text">
            <span class="gauge-value" style="color:${color}">${score}%</span>
            <span class="gauge-label">${label}</span>
        </div>
    </div>`;
}

// ===== TIMELINE =====
function buildTimeline(segs, maxTime, videoId) {
    const bars = segs.map(seg => {
        const h = Math.max(seg.score * 130, 6);
        const left = (seg.timestamp / maxTime) * 100;
        const op = 0.35 + seg.score * 0.65;
        return `<div class="timeline-bar" style="left:${left}%;height:${h}px;opacity:${op}"
            title="⏱ ${formatTime(seg.timestamp)} | Score: ${(seg.score*100).toFixed(0)}%"
            onclick="window.open('https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(seg.timestamp)}s','_blank')"></div>`;
    }).join("");
    return `
        <div class="section-header"><span class="section-title">📊 Relevance Timeline</span></div>
        <div class="timeline-wrap">
            <div class="timeline-axis-y"></div>
            <div class="timeline-axis-x"></div>
            ${bars}
            <div class="timeline-label" style="left:4px;">0:00</div>
            <div class="timeline-label" style="right:0">${formatTime(maxTime)}</div>
        </div>`;
}

// ===== PDF EXPORT =====
async function exportPDF(data) {
    try {
        const btn = document.getElementById("pdfBtn");
        if (btn) { btn.disabled = true; btn.textContent = "⏳ Generating..."; }
        const resp = await fetch(`${API}/generate_pdf`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(data)
        });
        if (!resp.ok) {
            const err = await resp.json();
            alert("PDF error: " + (err.error || "Unknown"));
            return;
        }
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        Object.assign(document.createElement("a"), {href: url, download: `topicscout-report.pdf`}).click();
        URL.revokeObjectURL(url);
    } catch(e) {
        alert("PDF generation failed: " + e.message);
    } finally {
        const btn = document.getElementById("pdfBtn");
        if (btn) { btn.disabled = false; btn.textContent = "⬇️ PDF Report"; }
    }
}

// ===== SHARE =====
function shareResults(data) {
    const text = `TopicScout Analysis\nTopic: ${data.topic}\nVideo: ${data.url}\nScore: ${data.weighted_score}%\n\n${verdictBadge(data.weighted_score).replace(/<[^>]+>/g,'')}`;
    if (navigator.share) {
        navigator.share({ title: "TopicScout Results", text }).catch(()=>{});
    } else {
        copyText(text).then(() => {
            const btn = document.getElementById("shareBtn");
            if (btn) { btn.textContent = "✅ Copied!"; setTimeout(()=> btn.textContent = "🔗 Share", 2000); }
        });
    }
}

// ===== LAST ANALYSIS DATA (for PDF/Share) =====
let lastAnalysisData = null;

// ===== MAIN ANALYSIS =====
document.getElementById("urlForm").addEventListener("submit", async function(e) {
    e.preventDefault();
    const urlInput = document.getElementById("urlInput").value.trim();
    const topicInput = document.getElementById("topicInput").value.trim();
    const videoId = extractYouTubeID(urlInput);
    if (!videoId) { alert("Invalid YouTube URL!"); return; }

    const btn = document.getElementById("analyzeBtn");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Analyzing...`;
    showProgress(); setStep(0);
    document.getElementById("results").innerHTML = "";

    const timers = [
        setTimeout(()=>setStep(1), 700),
        setTimeout(()=>setStep(2), 1800),
        setTimeout(()=>setStep(3), 3000),
    ];

    try {
        const resp = await fetch(`${API}/get_similarity/${videoId}?topic=${encodeURIComponent(topicInput)}`);
        timers.forEach(clearTimeout);
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        completeProgress();

        const weighted = data.weighted_score || 0;
        const bert  = ((data.similarity?.bert||0)*100).toFixed(1);
        const tfidf = ((data.similarity?.tfidf||0)*100).toFixed(1);
        const w2v   = ((data.similarity?.word2vec||0)*100).toFixed(1);
        const glove = ((data.similarity?.glove||0)*100).toFixed(1);

        saveToHistory({ videoId, url: urlInput, topic: topicInput, score: weighted, date: new Date().toLocaleDateString() });

        // Store for PDF/share
        lastAnalysisData = { ...data, topic: topicInput, url: urlInput, weighted_score: weighted };

        const segs = (data.relevant_segments||[]).sort((a,b)=>a.timestamp-b.timestamp);
        const maxTime = segs.length ? Math.max(...segs.map(s=>s.timestamp)) : 1;

        // -- GAUGE + SCORES --
        const scoresHTML = `
        <div class="card fade-up">
            <div class="section-header">
                <span class="section-title">📈 Similarity Scores</span>
                <div class="section-actions">
                    <button class="btn-sm" id="shareBtn">🔗 Share</button>
                    <button class="btn-sm" id="pdfBtn">⬇️ PDF Report</button>
                </div>
            </div>
            <div class="gauge-score-layout">
                ${buildGauge(weighted, "Weighted Score")}
                <div class="score-mini-grid">
                    ${[["BERT",bert],["TF-IDF",tfidf],["Word2Vec",w2v],["GloVe",glove]].map(([l,v])=>`
                    <div class="score-mini-card">
                        <div class="score-label">${l}</div>
                        <div class="score-value">${v}<span style="font-size:.8rem">%</span></div>
                        <div class="score-bar-track"><div class="score-bar-fill" style="width:${v}%"></div></div>
                    </div>`).join("")}
                </div>
            </div>
            <div style="margin-top:12px;">${verdictBadge(weighted)}</div>
        </div>`;

        // -- SUMMARY --
        const summaryHTML = (data.summary||[]).length ? `
        <div class="card fade-up">
            <div class="section-header">
                <span class="section-title">🤖 AI Summary</span>
                <button class="btn-sm" id="copySummaryBtn">📋 Copy</button>
            </div>
            <ul class="summary-list">${(data.summary||[]).map(s=>`<li>${s}</li>`).join("")}</ul>
        </div>` : "";

        // -- TIMELINE --
        const timelineHTML = segs.length ? `<div class="card fade-up">${buildTimeline(segs, maxTime, videoId)}</div>` : "";

        // -- NOTES --
        const notesHTML = (data.notes||[]).length ? `
        <div class="card fade-up">
            <div class="section-header">
                <span class="section-title">📝 Key Notes</span>
                <div class="section-actions">
                    <button class="btn-sm" id="copyNotesBtn">📋 Copy</button>
                    <button class="btn-sm" id="dlNotesBtn">⬇️ Export</button>
                </div>
            </div>
            <div class="notes-list">${(data.notes||[]).map(n=>`<div class="note-item">${highlight(n,topicInput)}</div>`).join("")}</div>
        </div>` : "";

        // -- SEGMENTS --
        const segsHTML = segs.length ? `
        <div class="card fade-up">
            <div class="section-header"><span class="section-title">🎯 Top Relevant Segments</span></div>
            ${segs.map((seg,i)=>`
            <div class="segment-item">
                <div class="segment-meta">
                    <span class="segment-num">SEG ${i+1}</span>
                    <a class="segment-link" href="https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(seg.timestamp)}s" target="_blank">▶ ${formatTime(seg.timestamp)}</a>
                    <span class="segment-score">Score: ${(seg.score*100).toFixed(0)}%</span>
                </div>
                <div class="segment-text">${highlight(seg.text, topicInput)}</div>
                ${seg.matched_keywords?.length ? `<div class="segment-keywords">🔑 ${seg.matched_keywords.join(", ")}</div>` : ""}
            </div>`).join("")}
        </div>` : "";

        // -- TRANSCRIPT --
        const transcriptHTML = `
        <div class="card fade-up">
            <div class="section-header">
                <span class="section-title">📄 Full Transcript</span>
                <button class="btn-sm" id="copyTranscriptBtn">📋 Copy</button>
            </div>
            <div class="transcript-box" id="transcriptText">${highlight(data.transcript||"", topicInput)}</div>
        </div>`;

        document.getElementById("results").innerHTML = scoresHTML + summaryHTML + timelineHTML + notesHTML + segsHTML + transcriptHTML;

        // Bind buttons
        document.getElementById("pdfBtn")?.addEventListener("click", () => exportPDF(lastAnalysisData));
        document.getElementById("shareBtn")?.addEventListener("click", () => shareResults(lastAnalysisData));
        document.getElementById("copyNotesBtn")?.addEventListener("click", async () => {
            if (await copyText((data.notes||[]).join("\n\n"))) {
                const b = document.getElementById("copyNotesBtn"); b.textContent="✅ Copied!"; setTimeout(()=>b.textContent="📋 Copy",1800);
            }
        });
        document.getElementById("dlNotesBtn")?.addEventListener("click", () => downloadNotes(data.notes||[], topicInput));
        document.getElementById("copySummaryBtn")?.addEventListener("click", async () => {
            if (await copyText((data.summary||[]).join("\n\n"))) {
                const b = document.getElementById("copySummaryBtn"); b.textContent="✅ Copied!"; setTimeout(()=>b.textContent="📋 Copy",1800);
            }
        });
        document.getElementById("copyTranscriptBtn")?.addEventListener("click", async () => {
            const b = document.getElementById("copyTranscriptBtn");
            if (await copyText(document.getElementById("transcriptText").innerText)) {
                b.textContent="✅ Copied!"; setTimeout(()=>b.textContent="📋 Copy",1800);
            }
        });

    } catch(err) {
        timers.forEach(clearTimeout);
        document.getElementById("progressWrap").style.display = "none";
        document.getElementById("results").innerHTML = `<div class="card fade-up"><p style="color:var(--red)">⚠️ ${err.message||"Could not connect to server."}</p></div>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span class="btn-text">Analyze Video</span><span class="btn-icon">→</span>`;
    }
});

// ===== MULTI-TOPIC RADAR =====
let radarChart = null;
document.getElementById("multiTopicForm").addEventListener("submit", async function(e) {
    e.preventDefault();
    const url    = document.getElementById("multiUrlInput").value.trim();
    const topics = document.getElementById("multiTopicsInput").value.trim();
    const videoId = extractYouTubeID(url);
    if (!videoId) { alert("Invalid YouTube URL!"); return; }

    const btn = document.getElementById("multiTopicBtn");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Analyzing...`;
    document.getElementById("multiTopicResults").innerHTML = `<div class="card"><p class="muted">⏳ Running BERT for each topic...</p></div>`;

    try {
        const resp = await fetch(`${API}/multi_topic?video_id=${videoId}&topics=${encodeURIComponent(topics)}`);
        const data = await resp.json();
        if (data.error) throw new Error(data.error);

        const labels = Object.keys(data.scores);
        const values = Object.values(data.scores);

        if (radarChart) { radarChart.destroy(); radarChart = null; }

        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        const gridColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
        const labelColor = isDark ? "#f0ece6" : "#1a1814";

        document.getElementById("multiTopicResults").innerHTML = `
            <div class="card fade-up">
                <div class="section-header">
                    <span class="section-title">🕸 Multi-Topic Radar Chart</span>
                </div>
                <div class="radar-wrap"><canvas id="radarCanvas"></canvas></div>
                <div class="radar-scores">
                    ${labels.map((l,i)=>`
                    <div class="radar-score-item">
                        <span class="radar-label">${l}</span>
                        <div class="score-bar-track" style="flex:1;margin:0 10px">
                            <div class="score-bar-fill" style="width:${values[i]}%"></div>
                        </div>
                        <span class="radar-val">${values[i]}%</span>
                    </div>`).join("")}
                </div>
            </div>`;

        const ctx = document.getElementById("radarCanvas").getContext("2d");
        radarChart = new Chart(ctx, {
            type: "radar",
            data: {
                labels,
                datasets: [{
                    label: "Relevance Score (%)",
                    data: values,
                    backgroundColor: "rgba(232,93,38,0.15)",
                    borderColor: "#e85d26",
                    pointBackgroundColor: "#e85d26",
                    pointRadius: 5,
                    borderWidth: 2,
                }]
            },
            options: {
                responsive: true,
                scales: {
                    r: {
                        min: 0, max: 100,
                        ticks: { stepSize: 20, color: labelColor, backdropColor: "transparent" },
                        grid: { color: gridColor },
                        angleLines: { color: gridColor },
                        pointLabels: { color: labelColor, font: { size: 13, family: "DM Sans" } }
                    }
                },
                plugins: { legend: { labels: { color: labelColor } } }
            }
        });

    } catch(err) {
        document.getElementById("multiTopicResults").innerHTML = `<div class="card"><p style="color:var(--red)">⚠️ ${err.message}</p></div>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span class="btn-text">Generate Radar Chart</span><span class="btn-icon">→</span>`;
    }
});

// ===== COMPARE VIDEOS =====
document.getElementById("compareForm").addEventListener("submit", async function(e) {
    e.preventDefault();
    const url1  = document.getElementById("compareUrl1").value.trim();
    const url2  = document.getElementById("compareUrl2").value.trim();
    const topic = document.getElementById("compareTopicInput").value.trim();

    const btn = document.getElementById("compareBtn");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Comparing...`;
    document.getElementById("compareResults").innerHTML = `<div class="card"><p class="muted">⏳ Fetching transcripts and scoring both videos...</p></div>`;

    try {
        const resp = await fetch(`${API}/compare_videos?url1=${encodeURIComponent(url1)}&url2=${encodeURIComponent(url2)}&topic=${encodeURIComponent(topic)}`);
        const data = await resp.json();
        if (data.error) throw new Error(data.error);

        const { video1: v1, video2: v2, winner } = data;

        function videoCard(v, isWinner) {
            return `
            <div class="compare-card ${isWinner ? 'compare-winner' : ''}">
                ${isWinner ? '<div class="winner-badge">🏆 Better Match</div>' : ''}
                <img class="compare-thumb" src="${v.thumbnail}" alt="">
                <div class="compare-title"><a href="${v.url}" target="_blank">${v.title}</a></div>
                ${v.transcript_available ? `
                    <div class="compare-score-big" style="color:${v.weighted_score>=60?'var(--green)':v.weighted_score>=35?'var(--yellow)':'var(--accent)'}">${v.weighted_score}%</div>
                    <div class="score-bar-track"><div class="score-bar-fill" style="width:${v.weighted_score}%"></div></div>
                    ${verdictBadge(v.weighted_score)}
                    ${v.top_segments?.length ? `<div style="margin-top:12px;font-size:.8rem;color:var(--text-muted)"><b>Top segment:</b> ${v.top_segments[0].text?.slice(0,120)}...</div>` : ""}
                ` : `<p style="color:var(--red);font-size:.85rem">⚠️ No transcript available</p>`}
            </div>`;
        }

        document.getElementById("compareResults").innerHTML = `
            <div class="card fade-up">
                <div class="section-header"><span class="section-title">⚔️ Head-to-Head: "${topic}"</span></div>
                <div class="compare-grid">
                    ${videoCard(v1, winner === v1.video_id)}
                    <div class="compare-vs">VS</div>
                    ${videoCard(v2, winner === v2.video_id)}
                </div>
                ${!winner ? `<p class="muted" style="text-align:center;margin-top:12px">🤝 It's a tie!</p>` : ""}
            </div>`;

    } catch(err) {
        document.getElementById("compareResults").innerHTML = `<div class="card"><p style="color:var(--red)">⚠️ ${err.message}</p></div>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span class="btn-text">Compare Videos</span><span class="btn-icon">→</span>`;
    }
});

// ===== PLAYLIST =====
document.getElementById("playlistForm").addEventListener("submit", async function(e) {
    e.preventDefault();
    const playlistUrl = document.getElementById("playlistInput").value.trim();
    const topic = document.getElementById("playlistTopicInput").value.trim();
    const btn = document.getElementById("playlistBtn");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Analyzing playlist...`;
    document.getElementById("playlistResults").innerHTML = `<div class="card fade-up"><p class="muted">⏳ Fetching and analyzing all videos. This may take a minute...</p></div>`;

    try {
        const resp = await fetch(`${API}/analyze_playlist?playlist_url=${encodeURIComponent(playlistUrl)}&topic=${encodeURIComponent(topic)}`);
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        if (!data.results?.length) {
            document.getElementById("playlistResults").innerHTML = `<div class="card fade-up"><p class="muted">No videos found.</p></div>`;
            return;
        }
        const itemsHTML = data.results.map((v,i) => `
            <div class="playlist-item">
                <div class="playlist-rank">${i+1}</div>
                <img class="playlist-thumb" src="${v.thumbnail}" alt="">
                <div class="playlist-info">
                    <div class="playlist-title"><a href="${v.url}" target="_blank">${v.title}</a></div>
                    ${v.transcript_available ? `
                        <div class="playlist-score-row">
                            <span class="playlist-score-big">${v.weighted_score}%</span>
                            <div class="playlist-mini-bar"><div class="playlist-mini-bar-fill" style="width:${v.weighted_score}%"></div></div>
                            ${verdictBadge(v.weighted_score)}
                        </div>` : `<div class="playlist-no-transcript">⚠️ No transcript available</div>`}
                </div>
            </div>`).join("");

        document.getElementById("playlistResults").innerHTML = `
            <div class="card fade-up">
                <div class="playlist-rank-header">
                    <span class="section-title">🎬 Playlist Results</span>
                    <span class="playlist-count">${data.total} videos ranked · topic: "<b>${topic}</b>"</span>
                </div>
                ${itemsHTML}
            </div>`;
    } catch(err) {
        document.getElementById("playlistResults").innerHTML = `<div class="card fade-up"><p style="color:var(--red)">⚠️ ${err.message}</p></div>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span class="btn-text">Analyze Playlist</span><span class="btn-icon">→</span>`;
    }
});
