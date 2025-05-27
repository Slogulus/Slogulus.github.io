document.addEventListener('DOMContentLoaded', () => {
  const chatMessages = document.getElementById('chat-messages');
  const userInput = document.getElementById('user-input');
  const sendButton = document.getElementById('send-button');

  // Use Google Gemini Flash 2.0 API
  const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";
  
  // Get API token from config.js (which should be gitignored)
  const GEMINI_API_KEY = window.CONFIG?.GEMINI_API_KEY;

  // Chat history to maintain context
  let chatHistory = [];

  // Function to add a message to the chat UI
  function addMessage(message, sender) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${sender}`;
    
    const paragraph = document.createElement('p');
    paragraph.textContent = message;
    
    messageElement.appendChild(paragraph);
    chatMessages.appendChild(messageElement);
    
    // Scroll to the bottom of the chat
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Add to chat history
    chatHistory.push({ role: sender === 'user' ? 'user' : 'assistant', content: message });
    
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

    // Add the new user message
    const contents = [
      ...history,
      { role: 'user', parts: [{ text: userMessage }] }
    ];    try {
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
  }

  // Event listeners
  sendButton.addEventListener('click', handleUserMessage);
  
  userInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleUserMessage();
    }
  });

  // Log info about the API being used
  console.log("Endpoint:", API_URL);
  
  // Add initial message
  if (!GEMINI_API_KEY) {
    addMessage("Configuration needed: Please create a config.js file with your Gemini API key. See README for instructions.", "bot");
  } else {
    addMessage("✅ Connected to Gemini AI model. What would you like to chat about?", "bot");
  }
});