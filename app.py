# Import Required Libraries
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from youtube_transcript_api import YouTubeTranscriptApi
from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer
from gensim.models import KeyedVectors
import nltk
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
import numpy as np
import os
import re
import urllib.request
import json
import io
import base64
from datetime import datetime

# Download NLTK data
nltk.download('punkt', quiet=True)
nltk.download('punkt_tab', quiet=True)
nltk.download('stopwords', quiet=True)

# Initialize Flask
app = Flask(__name__)
CORS(app)

# Load BERT model
model_bert = SentenceTransformer("all-MiniLM-L6-v2")

# Try loading abstractive summarizer (BART) — optional, falls back to extractive
summarizer_pipeline = None
try:
    from transformers import pipeline as hf_pipeline
    summarizer_pipeline = hf_pipeline("summarization", model="facebook/bart-large-cnn")
    print("[BART] Abstractive summarizer loaded")
except Exception as e:
    print(f"[BART] Not available, using extractive fallback: {e}")

# ---------------- WORD2VEC ----------------
MODEL_PATH = r"GoogleNews-vectors-negative300.bin"
word2vec_model = None
if os.path.exists(MODEL_PATH):
    try:
        word2vec_model = KeyedVectors.load_word2vec_format(MODEL_PATH, binary=True)
    except Exception as e:
        print("Word2Vec error:", e)

# ---------------- GLOVE ----------------
GLOVE_PATH = r"glove.6B.300d\glove.6B.300d.txt"
glove_model = {}
if os.path.exists(GLOVE_PATH):
    try:
        with open(GLOVE_PATH, "r", encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split()
                glove_model[parts[0]] = np.array(parts[1:], dtype=np.float32)
    except Exception as e:
        print("GloVe error:", e)

# ---------------- SIMILARITY FUNCTIONS ----------------

def compute_similarity_bert(text1, text2):
    try:
        emb1 = model_bert.encode([text1])
        emb2 = model_bert.encode([text2])
        return float(cosine_similarity(emb1, emb2)[0][0])
    except Exception as e:
        print(f"BERT similarity error: {e}")
        return 0.0

def compute_similarity_tfidf(text1, text2):
    try:
        vectorizer = TfidfVectorizer(stop_words="english")
        vectors = vectorizer.fit_transform([text1, text2])
        return float(cosine_similarity(vectors[0], vectors[1])[0][0])
    except Exception as e:
        print(f"TF-IDF similarity error: {e}")
        return 0.0

def compute_similarity_word2vec(text1, text2):
    if not word2vec_model:
        return 0.0
    def embed(text):
        words = word_tokenize(text.lower())
        vectors = [word2vec_model[w] for w in words if w in word2vec_model]
        return np.mean(vectors, axis=0) if vectors else np.zeros(300)
    try:
        return float(cosine_similarity([embed(text1)], [embed(text2)])[0][0])
    except Exception as e:
        print(f"Word2Vec similarity error: {e}")
        return 0.0

def compute_similarity_glove(text1, text2):
    if not glove_model:
        return 0.0
    def embed(text):
        words = word_tokenize(text.lower())
        vectors = [glove_model[w] for w in words if w in glove_model]
        return np.mean(vectors, axis=0) if vectors else np.zeros(300)
    try:
        return float(cosine_similarity([embed(text1)], [embed(text2)])[0][0])
    except Exception as e:
        print(f"GloVe similarity error: {e}")
        return 0.0

# ---------------- COOKIES & TRANSCRIPT ----------------

COOKIES_PATH = "cookies.txt"

def _parse_cookies():
    cookies = {}
    if not os.path.exists(COOKIES_PATH):
        return cookies
    try:
        with open(COOKIES_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split("\t")
                if len(parts) >= 7:
                    cookies[parts[5]] = parts[6]
        print(f"[Cookies] Loaded {len(cookies)} cookies")
    except Exception as e:
        print(f"[Cookies] Parse error: {e}")
    return cookies

def get_transcript(video_id):
    import requests
    cookies_dict = _parse_cookies()
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    })
    if cookies_dict:
        session.cookies.update(cookies_dict)
        session.headers["Cookie"] = "; ".join(f"{k}={v}" for k, v in cookies_dict.items())

    if os.path.exists(COOKIES_PATH):
        try:
            api = YouTubeTranscriptApi(cookie_path=COOKIES_PATH)
            data = api.fetch(video_id)
            text = " ".join([x.text for x in data])
            if text.strip():
                return text, data
        except TypeError:
            pass
        except Exception as e:
            print(f"[Transcript] S1 failed: {type(e).__name__}")

    try:
        api = YouTubeTranscriptApi(http_client=session)
        data = api.fetch(video_id)
        text = " ".join([x.text for x in data])
        if text.strip():
            return text, data
    except Exception as e:
        print(f"[Transcript] S2 failed: {type(e).__name__}")

    try:
        api = YouTubeTranscriptApi()
        data = api.fetch(video_id)
        text = " ".join([x.text for x in data])
        if text.strip():
            return text, data
    except Exception as e:
        print(f"[Transcript] S3 failed: {type(e).__name__}: {e}")

    return None, None

# ---------------- TOPIC UTILITIES ----------------

def expand_topic(topic):
    topic = topic.strip()
    return f"{topic} {topic} tutorial course learn study explanation {topic} programming"

def smart_score(transcript_text, topic):
    expanded = expand_topic(topic)
    words = transcript_text.split()
    chunk_size = 200
    chunks = [" ".join(words[i:i+chunk_size]) for i in range(0, len(words), chunk_size)]
    if not chunks:
        return 0.0
    chunk_scores = [compute_similarity_bert(chunk, expanded) for chunk in chunks]
    chunk_scores.sort(reverse=True)
    top_k = min(3, len(chunk_scores))
    avg_top = sum(chunk_scores[:top_k]) / top_k
    tfidf = compute_similarity_tfidf(transcript_text, topic)
    return round(0.7 * avg_top + 0.3 * tfidf, 4)

# ---------------- SEGMENTS ----------------

def get_relevant_segments(transcript_data, topic, top_k=12):
    if not transcript_data:
        return []
    topic_words = topic.lower().split()
    segments = []
    for entry in transcript_data:
        score = compute_similarity_bert(entry.text, topic)
        matched_words = [w for w in topic_words if w in entry.text.lower()]
        segments.append({
            "timestamp": round(entry.start, 2),
            "text": entry.text,
            "score": float(score),
            "matched_keywords": matched_words
        })
    segments = sorted(segments, key=lambda x: x["score"], reverse=True)[:top_k]
    segments = sorted(segments, key=lambda x: x["timestamp"])
    if not segments:
        return []
    merged = []
    current = segments[0]
    for seg in segments[1:]:
        if seg["timestamp"] - current["timestamp"] <= 25:
            current["text"] += " " + seg["text"]
            current["score"] = max(current["score"], seg["score"])
            current["matched_keywords"] = list(set(current["matched_keywords"] + seg["matched_keywords"]))
        else:
            merged.append(current)
            current = seg
    merged.append(current)
    return merged

def generate_notes(segments):
    return [seg["text"] for seg in segments[:5]]

# ---------------- SUMMARY ----------------

def generate_summary(transcript_text, num_sentences=7):
    """Abstractive if BART available, else extractive via BERT."""
    # Abstractive (BART)
    if summarizer_pipeline:
        try:
            # BART max input is ~1024 tokens; use first 3000 chars
            chunk = transcript_text[:3000]
            result = summarizer_pipeline(chunk, max_length=180, min_length=60, do_sample=False)
            summary_text = result[0]["summary_text"]
            # Split into bullet sentences
            sentences = re.split(r'(?<=[.!?])\s+', summary_text.strip())
            return [s.strip() for s in sentences if len(s.strip()) > 20]
        except Exception as e:
            print(f"[BART] Summarization error: {e}")

    # Extractive fallback (BERT TextRank)
    try:
        sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', transcript_text) if len(s.strip()) > 30]
        if len(sentences) <= num_sentences:
            return sentences
        embeddings = model_bert.encode(sentences)
        scores = []
        for i, emb in enumerate(embeddings):
            sim = cosine_similarity([emb], embeddings)[0]
            avg_sim = (sim.sum() - 1.0) / (len(sim) - 1)
            scores.append((avg_sim, i))
        top = sorted(scores, reverse=True)[:num_sentences]
        top_indices = sorted([idx for _, idx in top])
        return [sentences[i] for i in top_indices]
    except Exception as e:
        print(f"Summary error: {e}")
        return []

# ---------------- KEYWORD FREQUENCY ----------------

def get_top_keywords(transcript_text, top_n=15):
    """Extract top N keywords by TF-IDF score (excluding stopwords)."""
    try:
        stop = set(stopwords.words("english"))
        vectorizer = TfidfVectorizer(stop_words="english", max_features=200, ngram_range=(1,2))
        matrix = vectorizer.fit_transform([transcript_text])
        scores = zip(vectorizer.get_feature_names_out(), matrix.toarray()[0])
        sorted_scores = sorted(scores, key=lambda x: x[1], reverse=True)
        return [{"word": w, "score": round(float(s), 4)} for w, s in sorted_scores[:top_n] if s > 0]
    except Exception as e:
        print(f"Keyword extraction error: {e}")
        return []

# ---------------- PLAYLIST HELPERS ----------------

def get_video_title(video_id):
    try:
        oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        req = urllib.request.Request(oembed_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("title", f"Video {video_id}")
    except Exception as e:
        print(f"oEmbed failed for {video_id}: {e}")
        return f"Video {video_id}"

def get_playlist_video_ids(playlist_id):
    video_ids = []
    try:
        url = f"https://www.youtube.com/playlist?list={playlist_id}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as response:
            html = response.read().decode("utf-8")
        ids = re.findall(r'"videoId":"([a-zA-Z0-9_-]{11})"', html)
        seen = set()
        unique_ids = []
        for vid_id in ids:
            if vid_id not in seen:
                seen.add(vid_id)
                unique_ids.append(vid_id)
            if len(unique_ids) >= 20:
                break
        for vid_id in unique_ids:
            title = get_video_title(vid_id)
            video_ids.append((vid_id, title))
    except Exception as e:
        print(f"Playlist fetch error: {e}")
    return video_ids

def extract_playlist_id(url):
    match = re.search(r'[?&]list=([^&]+)', url)
    return match.group(1) if match else None

def analyze_playlist(playlist_id, topic):
    video_data = get_playlist_video_ids(playlist_id)
    if not video_data:
        return []
    results = []
    for video_id, title in video_data:
        transcript_text, _ = get_transcript(video_id)
        if not transcript_text:
            results.append({
                "video_id": video_id, "title": title,
                "url": f"https://www.youtube.com/watch?v={video_id}",
                "thumbnail": f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg",
                "bert_score": 0, "weighted_score": 0, "transcript_available": False
            })
            continue
        weighted = smart_score(transcript_text, topic)
        bert = compute_similarity_bert(transcript_text[:3000], expand_topic(topic))
        tfidf = compute_similarity_tfidf(transcript_text, topic)
        results.append({
            "video_id": video_id, "title": title,
            "url": f"https://www.youtube.com/watch?v={video_id}",
            "thumbnail": f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg",
            "bert_score": round(bert * 100, 1),
            "tfidf_score": round(tfidf * 100, 1),
            "word2vec_score": 0, "glove_score": 0,
            "weighted_score": round(weighted * 100, 1),
            "transcript_available": True
        })
    results.sort(key=lambda x: x["weighted_score"], reverse=True)
    return results

# ---------------- PDF REPORT ----------------

def generate_pdf_report(data):
    """Generate a PDF report using reportlab."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.enums import TA_CENTER, TA_LEFT

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4,
                                rightMargin=2*cm, leftMargin=2*cm,
                                topMargin=2*cm, bottomMargin=2*cm)

        styles = getSampleStyleSheet()
        accent = colors.HexColor("#e85d26")

        title_style = ParagraphStyle("title", fontSize=26, fontName="Helvetica-Bold",
                                     textColor=accent, spaceAfter=4, alignment=TA_CENTER)
        sub_style   = ParagraphStyle("sub", fontSize=11, fontName="Helvetica",
                                     textColor=colors.grey, alignment=TA_CENTER, spaceAfter=20)
        h2_style    = ParagraphStyle("h2", fontSize=14, fontName="Helvetica-Bold",
                                     textColor=accent, spaceBefore=16, spaceAfter=8)
        body_style  = ParagraphStyle("body", fontSize=10, fontName="Helvetica",
                                     leading=15, spaceAfter=6)
        bullet_style= ParagraphStyle("bullet", fontSize=10, fontName="Helvetica",
                                     leading=15, leftIndent=14, spaceAfter=5)

        story = []

        # Header
        story.append(Paragraph("TopicScout", title_style))
        story.append(Paragraph(f"Analysis Report — {datetime.now().strftime('%d %b %Y, %I:%M %p')}", sub_style))
        story.append(HRFlowable(width="100%", thickness=1, color=accent))
        story.append(Spacer(1, 12))

        # Meta
        story.append(Paragraph(f"<b>Topic:</b> {data.get('topic','')}", body_style))
        story.append(Paragraph(f"<b>Video URL:</b> {data.get('url','')}", body_style))
        story.append(Spacer(1, 8))

        # Scores table
        story.append(Paragraph("Similarity Scores", h2_style))
        sim = data.get("similarity", {})
        weighted = data.get("weighted_score", 0)
        score_data = [
            ["Model", "Score", ""],
            ["BERT",     f"{sim.get('bert',0)*100:.1f}%",    ""],
            ["TF-IDF",   f"{sim.get('tfidf',0)*100:.1f}%",   ""],
            ["Word2Vec", f"{sim.get('word2vec',0)*100:.1f}%", ""],
            ["GloVe",    f"{sim.get('glove',0)*100:.1f}%",    ""],
            ["Weighted Score", f"{weighted:.1f}%", "★ Final"],
        ]
        tbl = Table(score_data, colWidths=[5*cm, 4*cm, 5*cm])
        tbl.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), accent),
            ("TEXTCOLOR",  (0,0), (-1,0), colors.white),
            ("FONTNAME",   (0,0), (-1,0), "Helvetica-Bold"),
            ("FONTSIZE",   (0,0), (-1,-1), 10),
            ("ROWBACKGROUNDS", (0,1), (-1,-2), [colors.white, colors.HexColor("#faf8f5")]),
            ("BACKGROUND", (0,-1), (-1,-1), colors.HexColor("#fff3ed")),
            ("FONTNAME",   (0,-1), (-1,-1), "Helvetica-Bold"),
            ("TEXTCOLOR",  (0,-1), (-1,-1), accent),
            ("GRID",       (0,0), (-1,-1), 0.5, colors.HexColor("#e0dbd5")),
            ("ALIGN",      (1,0), (1,-1), "CENTER"),
            ("VALIGN",     (0,0), (-1,-1), "MIDDLE"),
            ("PADDING",    (0,0), (-1,-1), 8),
        ]))
        story.append(tbl)
        story.append(Spacer(1, 10))

        # Summary
        summary = data.get("summary", [])
        if summary:
            story.append(Paragraph("AI Summary", h2_style))
            for s in summary:
                story.append(Paragraph(f"◆  {s}", bullet_style))
            story.append(Spacer(1, 8))

        # Key Notes
        notes = data.get("notes", [])
        if notes:
            story.append(Paragraph("Key Notes", h2_style))
            for n in notes:
                story.append(Paragraph(f"•  {n[:300]}", bullet_style))
            story.append(Spacer(1, 8))

        # Top Segments
        segments = data.get("relevant_segments", [])
        if segments:
            story.append(Paragraph("Top Relevant Segments", h2_style))
            for i, seg in enumerate(segments[:5]):
                t = int(seg.get("timestamp", 0))
                mins, secs = divmod(t, 60)
                ts = f"{mins}:{secs:02d}"
                story.append(Paragraph(f"<b>Segment {i+1} — {ts}</b>", body_style))
                story.append(Paragraph(seg.get("text","")[:350], bullet_style))
            story.append(Spacer(1, 8))

        # Footer
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e0dbd5")))
        story.append(Spacer(1, 6))
        story.append(Paragraph("Generated by TopicScout · AI-powered YouTube Topic Analyzer", sub_style))

        doc.build(story)
        buf.seek(0)
        return buf
    except ImportError:
        return None

# ================================================================
# ROUTES
# ================================================================

@app.route('/get_similarity/<video_id>', methods=['GET'])
def get_similarity(video_id):
    topic = request.args.get('topic', '')
    transcript_text, transcript_data = get_transcript(video_id)

    if not transcript_text:
        return jsonify({
            "error": "Transcript not available",
            "similarity": {"tfidf": 0, "bert": 0, "word2vec": 0, "glove": 0},
            "relevant_segments": [], "notes": [], "summary": [],
            "keywords": [], "transcript": "", "weighted_score": 0
        }), 200

    expanded_topic = expand_topic(topic)
    tfidf = compute_similarity_tfidf(transcript_text, topic)
    bert  = compute_similarity_bert(transcript_text[:3000], expanded_topic)
    w2v   = compute_similarity_word2vec(transcript_text, topic)
    glove = compute_similarity_glove(transcript_text, topic)
    weighted = smart_score(transcript_text, topic) * 100

    segments = get_relevant_segments(transcript_data, topic)
    notes    = generate_notes(segments)
    summary  = generate_summary(transcript_text)
    keywords = get_top_keywords(transcript_text)

    return jsonify({
        "similarity": {"tfidf": tfidf, "bert": bert, "word2vec": w2v, "glove": glove},
        "weighted_score": round(weighted, 1),
        "relevant_segments": segments,
        "notes": notes,
        "summary": summary,
        "keywords": keywords,
        "transcript": transcript_text,
        "video_id": video_id
    })


@app.route('/multi_topic', methods=['GET'])
def multi_topic():
    """Score one video against multiple comma-separated topics for radar chart."""
    video_id = request.args.get('video_id', '')
    topics_raw = request.args.get('topics', '')
    topics = [t.strip() for t in topics_raw.split(',') if t.strip()]

    if not video_id or not topics:
        return jsonify({"error": "video_id and topics required"}), 400

    transcript_text, _ = get_transcript(video_id)
    if not transcript_text:
        return jsonify({"error": "Transcript not available"}), 200

    results = {}
    for topic in topics:
        score = smart_score(transcript_text, topic) * 100
        results[topic] = round(score, 1)

    return jsonify({"video_id": video_id, "scores": results})


@app.route('/compare_videos', methods=['GET'])
def compare_videos():
    """Compare two videos head-to-head for a given topic."""
    url1   = request.args.get('url1', '')
    url2   = request.args.get('url2', '')
    topic  = request.args.get('topic', '')

    def extract_id(url):
        m = re.search(r'(?:youtube\.com/.*[?&]v=|youtu\.be/)([^"&?/\s]{11})', url)
        return m.group(1) if m else None

    id1 = extract_id(url1)
    id2 = extract_id(url2)

    if not id1 or not id2 or not topic:
        return jsonify({"error": "url1, url2 and topic are required"}), 400

    def analyze_video(vid_id):
        transcript_text, transcript_data = get_transcript(vid_id)
        if not transcript_text:
            return None
        score    = smart_score(transcript_text, topic) * 100
        bert     = compute_similarity_bert(transcript_text[:3000], expand_topic(topic)) * 100
        tfidf    = compute_similarity_tfidf(transcript_text, topic) * 100
        segments = get_relevant_segments(transcript_data, topic, top_k=3)
        title    = get_video_title(vid_id)
        return {
            "video_id": vid_id,
            "title": title,
            "url": f"https://www.youtube.com/watch?v={vid_id}",
            "thumbnail": f"https://img.youtube.com/vi/{vid_id}/mqdefault.jpg",
            "weighted_score": round(score, 1),
            "bert_score": round(bert, 1),
            "tfidf_score": round(tfidf, 1),
            "top_segments": segments,
            "transcript_available": True
        }

    result1 = analyze_video(id1)
    result2 = analyze_video(id2)

    if not result1:
        result1 = {"video_id": id1, "title": get_video_title(id1), "weighted_score": 0,
                   "transcript_available": False, "thumbnail": f"https://img.youtube.com/vi/{id1}/mqdefault.jpg",
                   "url": url1}
    if not result2:
        result2 = {"video_id": id2, "title": get_video_title(id2), "weighted_score": 0,
                   "transcript_available": False, "thumbnail": f"https://img.youtube.com/vi/{id2}/mqdefault.jpg",
                   "url": url2}

    winner = None
    if result1["weighted_score"] > result2["weighted_score"]:
        winner = result1["video_id"]
    elif result2["weighted_score"] > result1["weighted_score"]:
        winner = result2["video_id"]

    return jsonify({"topic": topic, "video1": result1, "video2": result2, "winner": winner})


@app.route('/generate_pdf', methods=['POST'])
def generate_pdf():
    """Generate and return a PDF report for the analysis data."""
    try:
        data = request.get_json()
        pdf_buf = generate_pdf_report(data)
        if pdf_buf is None:
            return jsonify({"error": "reportlab not installed. Run: pip install reportlab"}), 500
        topic = data.get("topic", "analysis").replace(" ", "_")
        filename = f"topicscout_{topic}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        return send_file(pdf_buf, mimetype="application/pdf",
                         as_attachment=True, download_name=filename)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/analyze_playlist', methods=['GET'])
def analyze_playlist_route():
    playlist_url = request.args.get('playlist_url', '')
    topic = request.args.get('topic', '')
    if not playlist_url or not topic:
        return jsonify({"error": "playlist_url and topic are required"}), 400
    playlist_id = extract_playlist_id(playlist_url)
    if not playlist_id:
        return jsonify({"error": "Invalid playlist URL"}), 400
    results = analyze_playlist(playlist_id, topic)
    return jsonify({"playlist_id": playlist_id, "topic": topic,
                    "results": results, "total": len(results)})


@app.route('/check_transcript/<video_id>', methods=['GET'])
def check_transcript(video_id):
    results = {}
    try:
        api = YouTubeTranscriptApi()
        transcript_list = api.list(video_id)
        available = [{"language": t.language, "language_code": t.language_code,
                      "is_generated": t.is_generated} for t in transcript_list]
        results["available_transcripts"] = available
    except Exception as e:
        results["list_error"] = str(e)
    return jsonify(results)


if __name__ == '__main__':
    app.run(debug=True)
