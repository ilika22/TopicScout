# ⟡ TopicScout — AI-Powered YouTube Topic Relevance Analyzer

**TopicScout** is a multi-model NLP-based web application that analyzes YouTube video transcripts to measure how relevant a video is to a user-specified topic. It uses an ensemble of four embedding techniques — **BERT**, **TF-IDF**, **Word2Vec**, and **GloVe** — combined with a weighted scoring mechanism to deliver accurate, explainable relevance assessments.

Unlike typical YouTube summarizers, TopicScout answers a fundamentally different question: *"How well does this video actually cover the topic I care about?"*

---

## 📌 Table of Contents

- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [How the Scoring Works](#-how-the-scoring-works)
- [Screenshots](#-screenshots)
- [Installation & Setup](#-installation--setup)
- [API Endpoints](#-api-endpoints)
- [Project Structure](#-project-structure)
- [Research Novelty](#-research-novelty)
- [Related Work](#-related-work)
- [Future Enhancements](#-future-enhancements)
- [Authors](#-authors)
- [License](#-license)

---

## 🚀 Key Features

### 1. Single Video Analysis
- Paste any YouTube URL and a topic keyword
- Get a **weighted relevance score** (0–100%) with a visual gauge
- View similarity breakdowns from all four NLP models (BERT, TF-IDF, Word2Vec, GloVe)
- Interactive **relevance timeline** showing which parts of the video are most relevant
- **AI-generated summary** using BART (abstractive) or BERT TextRank (extractive fallback)
- **Keyword extraction** via TF-IDF (unigrams and bigrams)
- **Timestamped relevant segments** with direct YouTube seek links
- Key notes extracted from the most relevant transcript sections

### 2. Multi-Topic Radar Analysis
- Score a single video against **multiple topics simultaneously**
- Generates an interactive **radar chart** (Chart.js) to visualize topic coverage
- Useful for evaluating whether a lecture covers all expected subtopics

### 3. Head-to-Head Video Comparison
- Compare **two YouTube videos** side-by-side for a given topic
- Shows weighted scores, BERT scores, TF-IDF scores, and top segments for both
- Declares a **winner** with a visual trophy badge

### 4. Playlist Analysis & Ranking
- Analyze an **entire YouTube playlist** for a specific topic
- Ranks all videos from most to least relevant
- Shows individual scores and transcript availability for up to 20 videos

### 5. PDF Report Generation
- Export complete analysis results as a **professionally styled PDF**
- Includes similarity scores table, AI summary, key notes, and top segments
- Uses ReportLab with custom styling (branded with TopicScout design)

### 6. Additional Features
- 🌙 **Dark / Light mode** toggle with persistent preference
- 📜 **Search history** — stores last 5 analyses in localStorage for quick re-runs
- 🔗 **Share results** via Web Share API or clipboard copy
- 📋 **Copy & download notes** as a text file
- 🎯 **Verdict badges** — Highly Relevant (≥60%), Moderately Relevant (≥35%), Low Relevance (<35%)
- ⏱ **Progress indicator** — 4-step visual tracker during analysis

---

## 🏗 System Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Frontend (Browser)                  │
│   index.html + style.css + app.js (Vanilla JS)       │
│   Chart.js (Radar) · SVG Gauge · Timeline · Dark Mode │
└────────────────────────┬─────────────────────────────┘
                         │  REST API (JSON)
                         ▼
┌──────────────────────────────────────────────────────┐
│                 Backend (Flask + Python)               │
│                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ Transcript    │  │ NLP Engine   │  │ PDF Report  │ │
│  │ Extractor     │  │              │  │ Generator   │ │
│  │ (yt-api +     │  │ BERT (SBERT) │  │ (ReportLab) │ │
│  │  cookies)     │  │ TF-IDF       │  │             │ │
│  │               │  │ Word2Vec     │  │             │ │
│  │               │  │ GloVe        │  │             │ │
│  │               │  │ BART (summ.) │  │             │ │
│  └──────────────┘  └──────────────┘  └─────────────┘ │
└──────────────────────────────────────────────────────┘
```

---

## 🛠 Tech Stack

| Layer        | Technology                                                       |
|--------------|------------------------------------------------------------------|
| **Frontend** | HTML5, CSS3 (custom properties, dark mode), Vanilla JavaScript   |
| **Charts**   | Chart.js 4.4 (radar charts), Custom SVG (gauge, timeline)        |
| **Backend**  | Python 3.10+, Flask, Flask-CORS                                  |
| **NLP**      | Sentence-Transformers (`all-MiniLM-L6-v2`), scikit-learn, NLTK   |
| **Embeddings** | Word2Vec (Google News 300d), GloVe (6B 300d)                  |
| **Summarization** | HuggingFace Transformers (`facebook/bart-large-cnn`)        |
| **PDF**      | ReportLab                                                        |
| **Transcript** | `youtube-transcript-api` with cookie-based auth fallback       |

---

## 🧠 How the Scoring Works

TopicScout uses a **multi-model ensemble approach** to compute topic relevance:

### Step 1 — Transcript Chunking
The full transcript is split into chunks of 200 words each to capture localized relevance rather than diluting scores across the entire video.

### Step 2 — BERT Chunk Scoring
Each chunk is encoded using **Sentence-BERT** (`all-MiniLM-L6-v2`) and compared against an expanded topic query using **cosine similarity**. The top-3 chunk scores are averaged.

### Step 3 — TF-IDF Scoring
The full transcript is compared against the topic using a **TF-IDF Vectorizer** with English stopword removal, measuring statistical keyword overlap.

### Step 4 — Weighted Composite Score
The final score combines both methods:

```
Weighted Score = (0.7 × avg_top3_BERT_chunks) + (0.3 × TF-IDF) × 100
```

### Supplementary Models
- **Word2Vec** (Google News 300d): Averages word vectors and computes cosine similarity
- **GloVe** (6B 300d): Same averaging approach with Stanford GloVe embeddings
- These scores are displayed in the UI for comparison but are **not** part of the weighted score

### Topic Expansion
To improve recall, the input topic is expanded:
```
"{topic} {topic} tutorial course learn study explanation {topic} programming"
```

---

## 📸 Screenshots

> _Add screenshots of your application here. Suggested captures:_
> 1. Single Video Analysis with gauge and timeline
> 2. Multi-Topic Radar Chart
> 3. Head-to-Head Video Comparison
> 4. Playlist Ranking Results
> 5. Dark Mode view
> 6. Generated PDF Report

---

## ⚙️ Installation & Setup

### Prerequisites
- Python 3.10 or higher
- pip (Python package manager)
- A modern web browser

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/topicscout.git
cd topicscout
```

### 2. Install Python Dependencies

```bash
pip install -r requirements.txt
```

This installs Flask, scikit-learn, sentence-transformers, NLTK, gensim, transformers, torch, and reportlab.

### 3. Download NLTK Data (Automatic)

The app auto-downloads required NLTK data (`punkt`, `punkt_tab`, `stopwords`) on first run.

### 4. (Optional) Download Word2Vec & GloVe Models

For full 4-model scoring, download these large pretrained models:

**Word2Vec** (Google News, 1.5GB):
```
https://drive.google.com/file/d/0B7XkCwpI5KDYNlNUTTlSS21pQmM
```
Save as `GoogleNews-vectors-negative300.bin` in the project root.

**GloVe** (Stanford, 822MB zip):
```
https://nlp.stanford.edu/data/glove.6B.zip
```
Extract and place `glove.6B.300d.txt` inside a folder `glove.6B.300d/` in the project root.

> **Note:** The app works without these files — it falls back to BERT + TF-IDF only.

### 5. (Optional) YouTube Cookies

If you face transcript access issues (bot detection), export your YouTube cookies in Netscape format and save as `cookies.txt` in the project root.

### 6. Run the Application

```bash
python app.py
```

The Flask server starts at `http://127.0.0.1:5000`.

### 7. Open the Frontend

Open `index.html` in your browser (or serve it via any static file server).

---

## 📡 API Endpoints

| Method | Endpoint                          | Description                                      |
|--------|-----------------------------------|--------------------------------------------------|
| GET    | `/get_similarity/<video_id>`      | Analyze a single video for a topic               |
| GET    | `/multi_topic`                    | Score one video against multiple topics           |
| GET    | `/compare_videos`                 | Compare two videos head-to-head                  |
| GET    | `/analyze_playlist`               | Analyze all videos in a playlist                  |
| POST   | `/generate_pdf`                   | Generate a PDF report from analysis data          |
| GET    | `/check_transcript/<video_id>`    | Check available transcript languages for a video  |

### Example: Single Video Analysis

```
GET /get_similarity/dQw4w9WgXcQ?topic=music
```

**Response:**
```json
{
  "similarity": {
    "bert": 0.72,
    "tfidf": 0.45,
    "word2vec": 0.38,
    "glove": 0.41
  },
  "weighted_score": 65.3,
  "relevant_segments": [...],
  "summary": [...],
  "notes": [...],
  "keywords": [...],
  "transcript": "...",
  "video_id": "dQw4w9WgXcQ"
}
```

---

## 📁 Project Structure

```
topicscout/
├── app.py                  # Flask backend — NLP engine, all API routes
├── app.js                  # Frontend logic — tabs, charts, API calls, UI rendering
├── index.html              # Main HTML — 5-tab interface (Single, Multi, Compare, Playlist, History)
├── style.css               # Full styling — light/dark themes, responsive design
├── cookies.txt             # (Optional) YouTube cookie auth for transcript access
├── requirements.txt        # Python dependencies
├── README.md               # This file
│
├── GoogleNews-vectors-negative300.bin    # (Optional) Word2Vec model file
└── glove.6B.300d/
    └── glove.6B.300d.txt                # (Optional) GloVe embeddings file
```

---

## 🔬 Research Novelty

TopicScout addresses a gap in the existing literature with several novel contributions:

1. **Multi-Model Ensemble Relevance Scoring**
   No prior work combines BERT, TF-IDF, Word2Vec, and GloVe in a single system to evaluate YouTube transcript relevance against a user-defined topic. Existing tools typically use a single model.

2. **Chunk-Based Weighted Scoring**
   The `smart_score` function segments transcripts into 200-word chunks, scores each with BERT, and combines the top-k chunk scores with TF-IDF in a 70:30 weighted formula — a novel scoring strategy for this domain.

3. **Topic Relevance vs. Summarization**
   Nearly all published YouTube transcript tools focus on *summarization*. TopicScout solves a different problem: *quantifying how well a video covers a specific topic* — essentially a topic relevance assessment tool.

4. **Comparative & Multi-Topic Analysis**
   No existing tool or paper offers head-to-head video comparison, multi-topic radar profiling, or playlist-level topic ranking for YouTube content.

5. **Segment-Level Temporal Relevance**
   TopicScout maps relevance scores to specific timestamps within the video, providing a temporal relevance timeline that existing systems lack.

---

## 📚 Related Work

| Paper / Study | Year | Focus | Limitation vs. TopicScout |
|---|---|---|---|
| Kavitha et al. — _Analysis and Classification of User Comments on YouTube Videos_ ([ScienceDirect](https://www.sciencedirect.com/science/article/pii/S1877050920323553)) | 2020 | Comment classification (relevant/irrelevant) | Analyzes comments, not transcript content |
| Jelodar et al. — _NLP framework for latent-topic detection via fuzzy lattice reasoning_ ([Springer](https://link.springer.com/article/10.1007/s11042-020-09755-z)) | 2021 | Sentiment + topic detection on comments | Comment-focused, no relevance scoring |
| _Retrieving YouTube Video by Sentiment Analysis on User Comment_ ([ResearchGate](https://www.researchgate.net/publication/325119126_Retrieving_YouTube_Video_by_Sentiment_Analysis_on_User_Comment)) | 2018 | Sentiment-based video retrieval | Uses comment sentiment as proxy, not transcript similarity |
| _YouTube Video Ranking — A NLP based System_ ([ResearchGate](https://www.researchgate.net/publication/348535384_Youtube_Video_Ranking-A_NLP_based_System)) | 2021 | NLP-based video ranking | Sentiment-based, single model |
| _Automatic summarization of YouTube video transcription text using TF-IDF_ ([ResearchGate](https://www.researchgate.net/publication/362491915_Automatic_summarization_of_YouTube_video_transcription_text_using_term_frequency-inverse_document_frequency)) | 2022 | Transcript summarization | Summarization only, no relevance scoring |
| Chauhan et al. — _YouTube Transcript Summarizer_ ([SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4832193)) | 2024 | Transcript summarization | Summarization only |
| _YouTube Lecture Video Summarizer and Key Concept Extraction_ ([IJSAT](https://www.ijsat.org/papers/2025/3/8467.pdf)) | 2025 | Summarization + keyword extraction | No topic relevance assessment |
| iPullRank — _Relevance Engineering for YouTube_ ([iPullRank](https://ipullrank.com/video-youtube-relevance-engineering)) | 2025 | Transcript-keyword cosine similarity for SEO | Industry study, single embedding model, not peer-reviewed |
| Grootendorst — _BERTopic_ ([arXiv](https://arxiv.org/pdf/2203.05794)) | 2022 | Neural topic modeling with BERT + c-TF-IDF | General topic modeling, not YouTube-specific |

---

## 🔮 Future Enhancements

- [ ] **Multilingual support** — analyze transcripts in non-English languages
- [ ] **Audio-based transcription** — Whisper integration for videos without subtitles
- [ ] **User-adjustable model weights** — let users customize the BERT/TF-IDF weight ratio
- [ ] **Batch URL analysis** — paste multiple URLs for bulk scoring
- [ ] **Chrome extension** — analyze videos directly from YouTube pages
- [ ] **Fine-tuned domain models** — specialized BERT models for education, tech, etc.
- [ ] **Database persistence** — replace localStorage with server-side storage
- [ ] **Benchmark dataset** — create a labeled dataset for quantitative evaluation

---

## 👥 Authors

> _Ilika Mahajan 

---



<p align="center">
  <b>TopicScout</b> — Know what a video is really about, before you watch it.
</p>
