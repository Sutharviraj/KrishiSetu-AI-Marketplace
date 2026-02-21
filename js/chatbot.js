import { supabase, isAuthenticated } from "./supabase.js";

// Global variables
let currentUserId = null;
let currentSessionId = null;
let conversationHistory = [];

// Initialize chatbot
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuthentication();
    setupEventListeners();
    loadConversationHistory();
    generateSessionId();
});

// Check if user is authenticated
const checkAuthentication = async () => {
    const { user, error } = await isAuthenticated();
    
    if (error || !user) {
        console.error('Authentication error:', error);
        window.location.href = 'index.html';
        return false;
    }
    
    currentUserId = user.id;
    return true;
};

// Generate unique session ID
const generateSessionId = () => {
    currentSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Setup event listeners
const setupEventListeners = () => {
    // Send message button
    const sendButton = document.querySelector('[onclick="sendMessage()"]');
    if (sendButton) {
        sendButton.addEventListener('click', handleSendMessage);
    }
    
    // Enter key to send message
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSendMessage();
            }
        });
    }
    
    // Quick action buttons
    document.querySelectorAll('.quick-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const message = btn.dataset.message;
            if (message) {
                document.getElementById('messageInput').value = message;
                handleSendMessage();
            }
        });
    });
};

// Load conversation history
const loadConversationHistory = async () => {
    try {
        const { data: conversations, error } = await supabase
            .from('chat_conversations')
            .select('*')
            .eq('user_id', currentUserId)
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (error) throw error;
        
        conversationHistory = conversations || [];
        displayConversationHistory();
        
    } catch (error) {
        console.error('Error loading conversation history:', error);
    }
};

// Display conversation history
const displayConversationHistory = () => {
    const chatContainer = document.getElementById('chatMessages');
    if (!chatContainer) return;
    
    // Clear existing messages
    chatContainer.innerHTML = '';
    
    // Display messages in chronological order
    const sortedMessages = [...conversationHistory].reverse();
    
    sortedMessages.forEach(message => {
        displayMessage(message);
    });
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
};

// Display a single message
const displayMessage = (message) => {
    const chatContainer = document.getElementById('chatMessages');
    if (!chatContainer) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.message_type}`;
    
    const timestamp = new Date(message.created_at).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    if (message.message_type === 'user') {
        messageElement.innerHTML = `
            <div class="message-content">
                <div class="message-text">${message.message}</div>
                <div class="message-time">${timestamp}</div>
            </div>
        `;
    } else {
        messageElement.innerHTML = `
            <div class="message-content">
                <div class="bot-avatar">🤖</div>
                <div class="message-text">${message.message}</div>
                <div class="message-time">${timestamp}</div>
            </div>
        `;
    }
    
    chatContainer.appendChild(messageElement);
    
    // Add animation
    messageElement.classList.add('fade-in');
    setTimeout(() => {
        messageElement.classList.remove('fade-in');
    }, 300);
};

// Handle sending message
window.sendMessage = async () => {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message) {
        return;
    }
    
    // Clear input
    messageInput.value = '';
    
    // Display user message immediately
    const userMessage = {
        id: generateTempId(),
        user_id: currentUserId,
        session_id: currentSessionId,
        message: message,
        message_type: 'user',
        created_at: new Date().toISOString()
    };
    
    displayMessage(userMessage);
    
    // Save user message to database
    await saveMessage(userMessage);
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        // Send message to N8N chatbot workflow
        const botResponse = await sendToN8NChatbot({
            message: message,
            userId: currentUserId,
            sessionId: currentSessionId,
            conversationHistory: conversationHistory.slice(-10) // Last 10 messages for context
        });
        
        // Hide typing indicator
        hideTypingIndicator();
        
        if (botResponse.success) {
            // Display bot response
            const botMessage = {
                id: generateTempId(),
                user_id: currentUserId,
                session_id: currentSessionId,
                message: botResponse.response,
                message_type: 'bot',
                intent: botResponse.intent,
                entities: botResponse.entities,
                n8n_workflow_id: botResponse.workflowId,
                response_time: botResponse.responseTime,
                created_at: new Date().toISOString()
            };
            
            displayMessage(botMessage);
            await saveMessage(botMessage);
            
            // Show quick actions based on intent
            if (botResponse.quickActions) {
                showQuickActions(botResponse.quickActions);
            }
            
        } else {
            throw new Error(botResponse.error || 'Failed to get response from chatbot');
        }
        
    } catch (error) {
        console.error('Chatbot error:', error);
        hideTypingIndicator();
        
        // Show error message
        const errorMessage = {
            id: generateTempId(),
            user_id: currentUserId,
            session_id: currentSessionId,
            message: 'Sorry, I encountered an error. Please try again later.',
            message_type: 'bot',
            created_at: new Date().toISOString()
        };
        
        displayMessage(errorMessage);
        await saveMessage(errorMessage);
    }
};

// Send message to N8N chatbot workflow
const sendToN8NChatbot = async (payload) => {
    try {
        const response = await fetch('https://your-n8n-instance.com/webhook/agricultural-chatbot', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer YOUR_N8N_WEBHOOK_KEY'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`N8N workflow error: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        return result;
        
    } catch (error) {
        console.error('N8N API error:', error);
        return {
            success: false,
            error: 'Failed to connect to chatbot service'
        };
    }
};

// Save message to database
const saveMessage = async (message) => {
    try {
        const { data, error } = await supabase
            .from('chat_conversations')
            .insert(message)
            .select()
            .single();
        
        if (error) throw error;
        
        // Update conversation history
        if (message.id.startsWith('temp_')) {
            message.id = data.id;
        }
        
        conversationHistory.push(message);
        
        // Keep only last 100 messages in memory
        if (conversationHistory.length > 100) {
            conversationHistory = conversationHistory.slice(-100);
        }
        
    } catch (error) {
        console.error('Error saving message:', error);
    }
};

// Show typing indicator
const showTypingIndicator = () => {
    const chatContainer = document.getElementById('chatMessages');
    if (!chatContainer) return;
    
    const typingElement = document.createElement('div');
    typingElement.id = 'typingIndicator';
    typingElement.className = 'message bot typing';
    typingElement.innerHTML = `
        <div class="message-content">
            <div class="bot-avatar">🤖</div>
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;
    
    chatContainer.appendChild(typingElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
};

// Hide typing indicator
const hideTypingIndicator = () => {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
};

// Show quick actions based on intent
const showQuickActions = (actions) => {
    const quickActionsContainer = document.getElementById('quickActions');
    if (!quickActionsContainer) return;
    
    quickActionsContainer.innerHTML = '';
    
    actions.forEach(action => {
        const button = document.createElement('button');
        button.className = 'quick-action-btn';
        button.textContent = action.text;
        button.dataset.message = action.message;
        button.addEventListener('click', () => {
            document.getElementById('messageInput').value = action.message;
            handleSendMessage();
        });
        
        quickActionsContainer.appendChild(button);
    });
};

// Generate temporary ID for messages
const generateTempId = () => {
    return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Clear conversation
window.clearConversation = async () => {
    if (confirm('Are you sure you want to clear this conversation?')) {
        try {
            // Clear UI
            const chatContainer = document.getElementById('chatMessages');
            if (chatContainer) {
                chatContainer.innerHTML = '';
            }
            
            // Clear memory
            conversationHistory = [];
            
            // Generate new session ID
            generateSessionId();
            
            // Show welcome message
            const welcomeMessage = {
                id: generateTempId(),
                user_id: currentUserId,
                session_id: currentSessionId,
                message: 'Hello! I\'m your agricultural assistant. How can I help you with farming today?',
                message_type: 'bot',
                created_at: new Date().toISOString()
            };
            
            displayMessage(welcomeMessage);
            await saveMessage(welcomeMessage);
            
        } catch (error) {
            console.error('Error clearing conversation:', error);
        }
    }
};

// Export conversation
window.exportConversation = () => {
    const conversationText = conversationHistory
        .map(msg => {
            const timestamp = new Date(msg.created_at).toLocaleString();
            const sender = msg.message_type === 'user' ? 'You' : 'Bot';
            return `[${timestamp}] ${sender}: ${msg.message}`;
        })
        .join('\n\n');
    
    const blob = new Blob([conversationText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agricultural_chat_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// Add chatbot styles
const chatbotStyles = `
    .chat-container {
        display: flex;
        flex-direction: column;
        height: 100vh;
        max-height: 600px;
        background: #f5f5f5;
        border-radius: 12px;
        overflow: hidden;
    }
    
    .chat-header {
        background: #2e7d32;
        color: white;
        padding: 15px;
        text-align: center;
        font-weight: bold;
    }
    
    .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        background: white;
    }
    
    .message {
        margin-bottom: 15px;
        animation: fadeIn 0.3s ease;
    }
    
    .message.user {
        text-align: right;
    }
    
    .message.bot {
        text-align: left;
    }
    
    .message-content {
        display: inline-block;
        max-width: 70%;
        padding: 10px 15px;
        border-radius: 18px;
        position: relative;
    }
    
    .message.user .message-content {
        background: #2e7d32;
        color: white;
        border-bottom-right-radius: 4px;
    }
    
    .message.bot .message-content {
        background: #e0e0e0;
        color: #333;
        border-bottom-left-radius: 4px;
    }
    
    .bot-avatar {
        font-size: 20px;
        margin-right: 8px;
        vertical-align: middle;
    }
    
    .message-time {
        font-size: 11px;
        opacity: 0.7;
        margin-top: 4px;
    }
    
    .typing-dots {
        display: flex;
        gap: 4px;
        padding: 8px 0;
    }
    
    .typing-dots span {
        width: 8px;
        height: 8px;
        background: #666;
        border-radius: 50%;
        animation: typing 1.4s infinite;
    }
    
    .typing-dots span:nth-child(2) {
        animation-delay: 0.2s;
    }
    
    .typing-dots span:nth-child(3) {
        animation-delay: 0.4s;
    }
    
    @keyframes typing {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-10px); }
    }
    
    .chat-input-container {
        padding: 15px;
        background: #f5f5f5;
        border-top: 1px solid #e0e0e0;
    }
    
    .quick-actions {
        display: flex;
        gap: 8px;
        margin-bottom: 10px;
        flex-wrap: wrap;
    }
    
    .quick-action-btn {
        background: #e8f5e8;
        border: 1px solid #4caf50;
        color: #2e7d32;
        padding: 6px 12px;
        border-radius: 16px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.3s ease;
    }
    
    .quick-action-btn:hover {
        background: #4caf50;
        color: white;
    }
    
    .message-input-container {
        display: flex;
        gap: 10px;
    }
    
    .message-input {
        flex: 1;
        padding: 10px 15px;
        border: 1px solid #e0e0e0;
        border-radius: 20px;
        outline: none;
        font-size: 14px;
    }
    
    .message-input:focus {
        border-color: #2e7d32;
    }
    
    .send-btn {
        background: #2e7d32;
        color: white;
        border: none;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
    }
    
    .send-btn:hover {
        background: #1b5e20;
        transform: scale(1.05);
    }
    
    .chat-controls {
        padding: 10px 15px;
        background: #f5f5f5;
        border-top: 1px solid #e0e0e0;
        display: flex;
        justify-content: space-between;
        font-size: 12px;
    }
    
    .control-btn {
        background: none;
        border: none;
        color: #666;
        cursor: pointer;
        text-decoration: underline;
    }
    
    .control-btn:hover {
        color: #2e7d32;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;

// Add styles to head
const styleSheet = document.createElement('style');
styleSheet.textContent = chatbotStyles;
document.head.appendChild(styleSheet);

// Export functions for use in other modules
export { sendMessage, clearConversation, exportConversation };
