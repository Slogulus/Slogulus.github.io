document.addEventListener('DOMContentLoaded', () => {
  const chatMessages = document.getElementById('chat-messages');
  const userInput = document.getElementById('user-input');
  const sendButton = document.getElementById('send-button');
  const paperUrlInput = document.getElementById('paper-url');
  const loadPaperButton = document.getElementById('load-paper');
  const clearPaperButton = document.getElementById('clear-paper');
  const paperStatus = document.getElementById('paper-status');

  // Use Google Gemini Flash 2.0 API
  const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";
  
  // Get API token from config.js (which should be gitignored)
  const GEMINI_API_KEY = window.CONFIG?.GEMINI_API_KEY;
  // Chat history to maintain context
  let chatHistory = [];
  
  // Paper context storage
  let paperContext = null;

  // Function to add a message to the chat UI
  function addMessage(message, sender) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${sender}`;
    
    const paragraph = document.createElement('p');
    paragraph.innerHTML = message; // Changed from textContent to innerHTML to support HTML
    
    messageElement.appendChild(paragraph);
    chatMessages.appendChild(messageElement);
    
    // Scroll to the bottom of the chat
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Add to chat history (store plain text version)
    const plainText = paragraph.textContent; // Get plain text for history
    chatHistory.push({ role: sender === 'user' ? 'user' : 'assistant', content: plainText });
    
    // Keep history to a reasonable size (last 10 messages)
    if (chatHistory.length > 10) {
      chatHistory.shift();
    }
  }

  // Function to show the "thinking" animation
  function showThinking() {
    const thinkingElement = document.createElement('div');
    thinkingElement.className = 'message bot thinking';
    thinkingElement.id = 'thinking-indicator';
    
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('div');
      dot.className = 'dot';
      thinkingElement.appendChild(dot);
    }
    
    chatMessages.appendChild(thinkingElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Function to remove the thinking animation
  function removeThinking() {
    const thinking = document.getElementById('thinking-indicator');
    if (thinking) {
      thinking.remove();
    }
  }
  // Function to query the Gemini Flash 2.0 API
  async function queryLLM(userMessage) {
    // Check if Gemini API key is configured
    if (!GEMINI_API_KEY) {
      return "Error: Gemini API key not configured. Please create a config.js file with your Gemini API key.";
    }

    // Build the conversation history for context
    const history = chatHistory.slice(-6).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // Prepare the user message with paper context if available
    let contextualMessage = userMessage;
    if (paperContext) {
      contextualMessage = `Research Paper Context:\n${paperContext.content}\n\nUser Question: ${userMessage}`;
    }

    // Add the new user message
    const contents = [
      ...history,
      { role: 'user', parts: [{ text: contextualMessage }] }
    ];try {
      console.log("Sending request to Gemini Flash 2.0 endpoint...");
      console.log("Contents:", contents);

      // Gemini expects the API key as a query parameter
      const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: contents,
          generationConfig: {
            maxOutputTokens: 512,
            temperature: 0.7
          }
        })
      });

      console.log("API response status:", response.status);
      const data = await response.json();
      console.log("API response data:", data);

      if (!response.ok) {
        if (data.error && data.error.message) {
          return `Error: ${data.error.message}`;
        }
        return `Error: API request failed with status code ${response.status}. Please check the console for details.`;
      }

      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
        return data.candidates[0].content.parts.map(p => p.text).join(' ').trim();
      } else {
        return "Error: Received an unexpected response format from the Gemini API. Please check the console for details.";
      }
    } catch (error) {
      console.error('Error querying Gemini:', error);
      return "Error: I encountered a problem connecting to the Gemini API. This might be due to CORS issues, network problems, or API downtime. Please check the console for more details.";
    }
  }
  // Function to extract paper content from URL
  async function loadPaperFromUrl(url) {
    try {
      paperStatus.textContent = 'Loading paper information...';
      paperStatus.className = 'loading';
      
      // Handle arXiv papers
      if (url.includes('arxiv.org') && !url.includes('archive.org')) {
        const paperInfo = await getArxivPaperInfo(url);
          if (paperInfo) {
          paperContext = {
            url: paperInfo.pdfUrl,
            title: paperInfo.title,
            authors: paperInfo.authors,
            content: `Research Paper: "${paperInfo.title}"
Authors: ${paperInfo.authors}
ArXiv ID: ${paperInfo.arxivId}

Abstract: ${paperInfo.summary}

PDF URL: ${paperInfo.pdfUrl}

Note: This is the paper's metadata and abstract. For detailed analysis, please copy and paste specific sections from the PDF that you'd like to discuss.`
          };
          
          paperStatus.textContent = `✅ Loaded: ${paperInfo.title}`;
          paperStatus.className = 'success';
          
          addMessage(`📄 <strong>${paperInfo.title} loaded:</strong> I'm ready to discuss this paper!`, 'bot');
          return true;
        } else {
          throw new Error('Could not retrieve paper information from arXiv');
        }
      }
      
      // Handle other archive.org URLs
      else if (url.includes('archive.org')) {
        paperContext = {
          url: url,
          title: 'Archive.org Document',
          content: `Document URL: ${url}\n\nNote: Please copy and paste relevant sections from this document to discuss them.`
        };
          paperStatus.textContent = '✅ Archive.org URL loaded';
        paperStatus.className = 'success';
        
        addMessage(`📄 <strong>Archive.org document loaded</strong><br><br>I'm ready to discuss this document! Please copy and paste relevant sections or ask questions about it.`, 'bot');
        return true;
      }
      
      else {
        throw new Error('Please provide a valid arXiv or archive.org URL');
      }
      
    } catch (error) {
      console.error('Error loading paper:', error);
      paperStatus.textContent = `❌ Error: ${error.message}`;
      paperStatus.className = 'error';
      return false;
    }
  }

  // Advanced function to extract arXiv paper metadata
  async function getArxivPaperInfo(arxivId) {
    try {
      // Extract arXiv ID from URL
      const id = arxivId.replace(/.*arxiv\.org\/(abs|pdf)\//, '').replace('.pdf', '');
      
      // Use arXiv API to get paper metadata (using HTTPS)
      const apiUrl = `https://export.arxiv.org/api/query?id_list=${id}`;
      
      // Note: This might have CORS issues in browser, but shows the concept
      const response = await fetch(apiUrl);
      const xmlText = await response.text();
      
      // Parse XML response - look for entry elements, not feed title
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      
      // Get the first entry (paper) from the response
      const entry = xmlDoc.querySelector('entry');
      if (!entry) {
        throw new Error('No paper found with this arXiv ID');
      }
      
      const title = entry.querySelector('title')?.textContent?.trim();
      const summary = entry.querySelector('summary')?.textContent?.trim();
      const authors = Array.from(entry.querySelectorAll('author name')).map(name => name.textContent);
      
      return {
        title: title || 'Unknown Title',
        authors: authors.length > 0 ? authors.join(', ') : 'Unknown Authors',
        summary: summary || 'No summary available',
        arxivId: id,
        pdfUrl: `https://arxiv.org/pdf/${id}.pdf`
      };
    } catch (error) {
      console.error('Error fetching arXiv info:', error);
      return null;
    }
  }
  
  // Function to clear paper context
  function clearPaperContext() {
    paperContext = null;
    paperUrlInput.value = '';
    paperStatus.textContent = '';
    paperStatus.className = '';
    addMessage('📄 Paper context cleared. You can now load a new paper or chat without paper context.', 'bot');
  }

  // Function to handle paper loading
  async function handleLoadPaper() {
    const url = paperUrlInput.value.trim();
    
    if (!url) {
      paperStatus.textContent = 'Please enter a paper URL';
      paperStatus.className = 'error';
      return;
    }
    
    // Validate URL format
    if (!url.includes('arxiv.org') && !url.includes('archive.org')) {
      paperStatus.textContent = 'Please enter an arXiv or archive.org URL';
      paperStatus.className = 'error';
      return;
    }
    
    await loadPaperFromUrl(url);
  }

  // Function to handle user message submission
  async function handleUserMessage() {
    const message = userInput.value.trim();
    
    if (!message) return;
    
    // Clear input field
    userInput.value = '';
    
    // Add user message to chat
    addMessage(message, 'user');
    
    // Show thinking animation
    showThinking();
    
    // Call the LLM API
    const response = await queryLLM(message);
    
    // Remove thinking animation
    removeThinking();
    
    // Add AI response to chat
    addMessage(response, 'bot');
  }  // Event listeners
  sendButton.addEventListener('click', handleUserMessage);
  loadPaperButton.addEventListener('click', handleLoadPaper);
  clearPaperButton.addEventListener('click', clearPaperContext);
  clearPaperButton.addEventListener('click', clearPaperContext);
  
  userInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleUserMessage();
    }
  });
  
  paperUrlInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleLoadPaper();
    }
  });

  loadPaperButton.addEventListener('click', handleLoadPaper);

  // Log info about the API being used
  console.log("Endpoint:", API_URL);
    // Add initial message
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "your-gemini-api-key-here") {
    addMessage("⚙️ **Configuration needed:** For local development, copy `config.template.js` to `config.js` and add your Gemini API key. For production, the key is injected via GitHub Actions.", "bot");
  } else {
    addMessage("✅ Connected to Gemini AI model. What would you like to chat about?", "bot");
  }
});