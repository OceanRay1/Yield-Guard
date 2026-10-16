# Try It Out 
**https://yieldshield.pages.dev/**

## Overview
The traditional yield curve model (10Y–3M Treasury spread) catches recessions, yet it can occasionally trigger false alarms or stay inverted for too long during unique economic periods

**YieldGuard** trains on 30+ macroeconomic indicators backtested on 50+ years of ingested FRED API data to filter noise, dramatically reducing false positives while catching recessions. This data backs the dynamic scenario testing, real-time factor sensitivities, historical timeline explorer, and all other website features.

### Core Model Performance
* **93% Reduction** in false-positive yield inversion signals compared to the baseline 10Y-3M model
* **87.5% Precision** on historical recession classifications
* **0.821 PR-AUC** across active economic regime validation periods
* **Full Model Metrics:** https://yieldshield.pages.dev/model-trust

## Development History & Repository Reset
> **Note on Commit History:** This repository was reset on **September 23, 2026** to remove a hardcoded FRED API key before transitioning the repository to public visibility
* **Project Started:** July 2026  
* **Production Pipeline Completed:** October 2026  

The current commit history only shows slight project modifications after deployment

## Tech Stack

**Core Language:** Python 3.12, TypeScript, JavaScript
**Backend Framework:** FastAPI, Uvicorn, Pydantic
**Machine Learning & Data:** Scikit-Learn, Pandas, NumPy
**Frontend UI:** React, Vite, HTML5/CSS3 (PostCSS)
**Data Sources:** FRED API (Federal Reserve Economic Data)
  
# System Architecture

```text
Yield-Guard-main/
├── recession_model/
│   ├── backend/
│   │   ├── .env.example                     # Where the FRED API key is placed
│   │   ├── main.py                          # FastAPI application entry point & routing
│   │   ├── model_data.py                    # Data ingestion and cleaning pipelines
│   │   ├── model_diag.py                    # Model evaluation & performance diagnostics
│   │   ├── model_plot.py                    # Chart and data visualization generation
│   │   ├── model_testing.py                 # Unit tests for prediction pipelines
│   │   ├── model_timechart.py               # Timeline processing logic
│   │   ├── trained_model_pipeline_output.pkl # Serialized production Scikit-Learn pipeline
│   │   ├── continuous_chart_data.csv        # Gap-free continuous time-series data for UI 
│   │   ├── historical_recession_probabilities_timeline.csv # Macro time-series data for Historical Event Timeline UI
│   │   ├── yield_curve_filter_data.csv      # Processed macro time-series data
│   │   ├── yield_curve_filter_outcomes.csv  # True outcome (Recession/No Recession) for all processed macro time-series data
│   │   └── requirements.txt                 # Python dependencies
│   └── frontend/
│       ├── src/                             # React components, Tailwind layouts, and terminal views
│       ├── public/                          # Static assets and media
│       ├── index.html                       # HTML root template
│       ├── package.json                     # Node dependencies and scripts
│       └── vite.config.ts                   # Vite bundler configuration
└── README.md
```

## Installation Guide

### Prerequisites
* Python 3.12+ installed
* Node.js (v18+) and npm installed

### 1. Clone the Repository
```bash
git clone https://github.com/OceanRay1/Yield-Guard.git
cd Yield-Guard/recession_model
```

### 2. Configure Environment Variables
```bash
cd backend
cp .env.example .env
FRED_API_KEY=your_actual_api_key_here
```

### 3. Configure & Run Backend
``` bash
cd recession_model/backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 4. Configure & Run Frontend
Open a new terminal window:
```bash
cd recession_model/frontend
npm install
npm run dev
```


