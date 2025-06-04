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
  
  // Trade context storage
  let selectedTrade = 'general';
  
  // Trade descriptions for context
  const tradeDescriptions = {
    electrician: "an electrician who works with electrical systems, wiring, circuits, and power distribution",
    mechanic: "a mechanic who works with engines, machinery, mechanical systems, and repairs",
    construction: "a construction worker who builds structures, works with materials, and uses construction tools",
    plumber: "a plumber who works with pipes, water systems, drainage, and fluid mechanics",
    carpenter: "a carpenter who works with wood, building structures, and construction techniques",
    hvac: "an HVAC technician who works with heating, ventilation, air conditioning, and climate control systems",
    welder: "a welder who joins metals, works with fabrication, and understands material properties",
    general: "someone in the trades/construction industry"
  };

  // Paper context storage
  let paperContext = null;
  // Function to add a message to the chat UI
  function addMessage(message, sender) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${sender}`;
    
    // Format the message for better readability
    let formattedMessage = message;
    if (sender === 'bot') {
      // Split long paragraphs and add line breaks
      formattedMessage = message
        .replace(/\. ([A-Z])/g, '.<br><br>$1') // Add breaks after sentences that start new thoughts
        .replace(/:\s*([A-Z])/g, ':<br><br>$1') // Add breaks after colons
        .replace(/\n\n/g, '<br><br>') // Convert double newlines to HTML breaks
        .replace(/\n/g, '<br>'); // Convert single newlines to HTML breaks
    }
    
    const paragraph = document.createElement('p');
    paragraph.innerHTML = formattedMessage;
    
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
  }  // Function to query the Gemini Flash 2.0 API
  async function queryLLM(userMessage) {
    // Check if Gemini API key is configured
    if (!GEMINI_API_KEY) {
      return "Error: Gemini API key not configured. Please create a config.js file with your Gemini API key.";
    }

    // Build the conversation history for context
    const history = chatHistory.slice(-6).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));    // Create trade context system message
    const tradeContext = `You are explaining concepts to ${tradeDescriptions[selectedTrade]}. Please tailor your explanations using analogies, terminology, and examples that would be familiar and relevant to someone in this profession. Keep explanations practical and relate technical concepts to hands-on work when possible. 

IMPORTANT: Keep your response concise (2-3 short paragraphs maximum). Use simple, clear language. Break up complex ideas into digestible parts.`;

    // Prepare the user message with paper context and trade context
    let contextualMessage = userMessage;
    if (paperContext) {
      contextualMessage = `Research Paper Context:\n${paperContext.content}\n\n${tradeContext}\n\nUser Question: ${userMessage}`;
    } else {
      contextualMessage = `${tradeContext}\n\nUser Question: ${userMessage}`;
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
        },        body: JSON.stringify({
          contents: contents,
          generationConfig: {
            maxOutputTokens: 300,
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

Note: PDF text extraction is not available. You can ask questions about the abstract and metadata, or manually copy and paste specific sections from the PDF for detailed analysis.`
          };
          
          paperStatus.textContent = `✅ Loaded: ${paperInfo.title}`;
          paperStatus.className = 'success';
          
          addMessage(`📄 <strong>${paperInfo.title} loaded:</strong> Metadata and abstract available. For detailed analysis, you can copy and paste specific sections from the PDF.`, 'bot');
          return true;
        } else {
          throw new Error('Could not retrieve paper information from arXiv');
        }
      }
      
      // Handle other archive.org URLs
      else if (url.includes('archive.org')) {
        const docInfo = await getArchiveOrgDocInfo(url);
        paperContext = {
          url: docInfo.url,
          title: docInfo.title,
          content: `Document: "${docInfo.title}"
URL: ${docInfo.url}

Note: Please copy and paste relevant sections from this document to discuss them.`
        };
        
        paperStatus.textContent = `✅ Loaded: ${docInfo.title}`;
        paperStatus.className = 'success';
        
        addMessage(`📄 <strong>${docInfo.title} loaded:</strong> I'm ready to discuss this document!`, 'bot');
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
      const pdfUrl = `https://arxiv.org/pdf/${id}.pdf`;
      
      return {
        title: title || 'Unknown Title',
        authors: authors.length > 0 ? authors.join(', ') : 'Unknown Authors',
        summary: summary || 'No summary available',
        arxivId: id,
        pdfUrl: pdfUrl
      };
    } catch (error) {
      console.error('Error fetching arXiv info:', error);
      return null;
    }
  }
  
  // Function to extract document info from archive.org URLs
  async function getArchiveOrgDocInfo(url) {
    try {
      // Try to fetch the page to extract title from HTML
      const response = await fetch(url);
      const htmlText = await response.text();
      
      // Parse HTML response
      const parser = new DOMParser();
      const htmlDoc = parser.parseFromString(htmlText, 'text/html');
      
      // Try to extract title from various possible sources
      let title = htmlDoc.querySelector('title')?.textContent?.trim();
      
      // Clean up the title (remove "Internet Archive" suffix if present)
      if (title) {
        title = title.replace(/\s*:\s*Internet Archive$/, '').trim();
        title = title.replace(/\s*-\s*Internet Archive$/, '').trim();
      }
      
      // If no title found or title is generic, try to extract from URL
      if (!title || title === 'Internet Archive') {
        // Extract filename from URL as fallback
        const urlParts = url.split('/');
        const filename = urlParts[urlParts.length - 1];
        title = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '); // Remove extension and replace dashes/underscores
      }
      
      return {
        title: title || 'Archive.org Document',
        url: url
      };
    } catch (error) {
      console.error('Error fetching archive.org info:', error);
      // Fallback: extract filename from URL
      try {
        const urlParts = url.split('/');
        const filename = urlParts[urlParts.length - 1];
        const title = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        return {
          title: title || 'Archive.org Document',
          url: url
        };
      } catch (fallbackError) {
        return {
          title: 'Archive.org Document',
          url: url
        };
      }
    }
  }

  // Function to search for papers on arXiv by topic
  async function searchArxivPapers(query, maxResults = 5) {
    try {
      // Clean and format the search query
      const searchQuery = encodeURIComponent(query);
      
      // Use arXiv API search endpoint
      const apiUrl = `https://export.arxiv.org/api/query?search_query=all:${searchQuery}&start=0&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;
      
      const response = await fetch(apiUrl);
      const xmlText = await response.text();
      
      // Parse XML response
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      
      const entries = Array.from(xmlDoc.querySelectorAll('entry'));
      
      if (entries.length === 0) {
        return null;
      }
      
      // Extract paper information from each entry
      const papers = entries.map(entry => {
        const title = entry.querySelector('title')?.textContent?.trim();
        const summary = entry.querySelector('summary')?.textContent?.trim();
        const authors = Array.from(entry.querySelectorAll('author name')).map(name => name.textContent);
        const arxivId = entry.querySelector('id')?.textContent?.replace('http://arxiv.org/abs/', '');
        
        return {
          title: title || 'Unknown Title',
          authors: authors.length > 0 ? authors.join(', ') : 'Unknown Authors',
          summary: summary || 'No summary available',
          arxivId: arxivId,
          pdfUrl: `https://arxiv.org/pdf/${arxivId}.pdf`,
          absUrl: `https://arxiv.org/abs/${arxivId}`
        };
      });
      
      return papers;
    } catch (error) {
      console.error('Error searching arXiv papers:', error);
      return null;
    }
  }

  // Function to detect if user is asking to search for papers
  function detectPaperSearchRequest(message) {
    const searchPhrases = [
      'find papers about',
      'search for papers on',
      'look for research on',
      'find research about',
      'search papers about',
      'find studies on',
      'look up papers on',
      'search for studies about',
      'find literature on',
      'search research on',
      'find me papers',
      'show me papers',
      'get papers about',
      'look for papers',
      'search for research',
      'find research papers',
      'search literature',
      'papers about',
      'research on',
      'studies on'
    ];
    
    const lowerMessage = message.toLowerCase();
    
    for (const phrase of searchPhrases) {
      if (lowerMessage.includes(phrase)) {
        // Extract the topic after the search phrase
        const index = lowerMessage.indexOf(phrase);
        const topic = message.substring(index + phrase.length).trim();
        console.log(`Search detected! Phrase: "${phrase}", Topic: "${topic}"`);
        return topic || null;
      }
    }
    
    console.log(`No search phrase detected in: "${message}"`);
    return null;
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
    
    // Detect if the user is asking to search for papers
    const searchTopic = detectPaperSearchRequest(message);
    if (searchTopic) {
      showThinking();
      const papers = await searchArxivPapers(searchTopic);
      removeThinking();
      
      if (papers && papers.length > 0) {
        addMessage(`📄 Found ${papers.length} papers on "${searchTopic}":`, 'bot');
        papers.forEach(paper => {
          addMessage(`- <strong>${paper.title}</strong> by ${paper.authors}<br>Abstract: ${paper.summary}<br><a href="${paper.absUrl}" target="_blank">View on arXiv</a> | <a href="${paper.pdfUrl}" target="_blank">Download PDF</a>`, 'bot');
        });
      } else {
        addMessage(`❌ No papers found on "${searchTopic}". Please try a different topic.`, 'bot');
      }
      return;
    }
    
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

  // Function to handle trade selection
  function handleTradeSelection() {
    const tradeButtons = document.querySelectorAll('.trade-btn');
    const selectedTradeDisplay = document.getElementById('selected-trade');
    
    tradeButtons.forEach(button => {
      button.addEventListener('click', () => {
        // Remove active class from all buttons
        tradeButtons.forEach(btn => btn.classList.remove('active'));
        
        // Add active class to clicked button
        button.classList.add('active');
        
        // Update selected trade
        selectedTrade = button.dataset.trade;
        
        // Update display
        const tradeName = button.textContent.replace(/^[^\s]+\s/, ''); // Remove emoji
        selectedTradeDisplay.innerHTML = `<span>Current mode: <strong>${tradeName}</strong></span>`;
        
        // Add confirmation message
        addMessage(`🔧 Now explaining like you're ${tradeDescriptions[selectedTrade]}. Ask me about research papers or technical concepts!`, 'bot');
      });
    });
    
    // Set default selection
    document.querySelector('[data-trade="general"]').classList.add('active');
  }

  // Initialize trade selection handling
  handleTradeSelection();
});