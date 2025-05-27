# AI Research Tool

A web-based tool for analyzing research papers using Google Gemini AI. Load papers from arXiv or Archive.org and chat with an AI assistant about their content.

## Features

- 📄 Load research papers from arXiv URLs (automatically fetches metadata)
- 🔍 Archive.org document support
- 💬 Chat interface with paper context
- 🧠 Powered by Google Gemini Flash 2.0

## Setup

### For Production (GitHub Pages)

1. **Add your Gemini API key to GitHub Secrets:**
   - Go to your repository Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `GEMINI_API_KEY`
   - Value: Your Google Gemini API key

2. **Enable GitHub Pages:**
   - Go to Settings → Pages
   - Source: GitHub Actions
   - The workflow will automatically deploy on push to main

### For Local Development

1. **Get a Gemini API key:**
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key

2. **Set up local config:**

   ```bash
   cp assets/js/config.template.js assets/js/config.js
   ```

3. **Edit `config.js`:**

   ```javascript
   window.CONFIG = {
     GEMINI_API_KEY: "your-actual-api-key-here"
   };
   ```

4. **Serve locally:**
   - Use VS Code Live Server extension, or
   - Python: `python -m http.server 8000`
   - Node.js: `npx serve .`

## Usage

1. **Load a paper:** Enter an arXiv URL (e.g., `https://arxiv.org/abs/2301.07041`)
2. **Start chatting:** Ask questions about the paper or general research topics
3. **Deep analysis:** Copy-paste specific sections from PDFs for detailed analysis

## Security

- API keys are stored in GitHub Secrets (production)
- Local config files are gitignored
- No API keys are exposed in the deployed code

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request