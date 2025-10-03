// =================================================================
// == Life AI System - Core JavaScript - v2.1 (Instant Learning)
// == October 3rd Checkpoint
// == Written by Manus for Salman
// =================================================================

// --- Import Libraries ---
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1';

// --- Configuration ---
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const AI_MODEL_NAME = "llama-3.1-8b-instant";
const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

// --- Initialize Connections & Models ---
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY );
env.allowLocalModels = false;
let extractor;

// --- DOM Elements ---
const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');

// --- Core Functions ---

function addMessage(text, sender) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${sender}-message`;
    messageElement.innerText = text;
    chatWindow.prepend(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight; // Auto-scroll
    return messageElement;
}

async function createEmbedding(text) {
    if (!extractor) {
        addMessage("Loading memory model...", "system");
        extractor = await pipeline('feature-extraction', EMBEDDING_MODEL);
        // Find and remove the "Loading..." message
        const systemMessages = chatWindow.querySelectorAll('.system-message');
        systemMessages.forEach(msg => {
            if (msg.innerText.includes("Loading memory model...")) {
                msg.remove();
            }
        });
    }
    const result = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(result.data);
}

async function saveFactToMemory(fact) {
    console.log(`Saving fact to memory: "${fact}"`);
    const embedding = await createEmbedding(fact);
    const { error } = await supabase.from('permanent_memory').insert({ content: fact, embedding: embedding });
    if (error) console.error('Error saving fact:', error.message);
    else console.log('Fact saved successfully.');
}

async function processAndLearn(conversationTurn) {
    try {
        const factExtractionPrompt = `You are a silent fact extractor. The user is Salman. Review the following conversation. If Salman stated a new, important fact about himself, his life, or his preferences, summarize that fact into a single, concise sentence. For example, if the user says 'my full name is...', extract 'Salman's full name is...'. If no new fact is present, respond with only the word 'NULL'.\n\nConversation:\n${conversationTurn}`;
        
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: [{ role: "system", content: factExtractionPrompt }],
                model: AI_MODEL_NAME
            } )
        });
        const data = await response.json();
        const extractedFact = data.choices[0].message.content;

        if (extractedFact && extractedFact.toUpperCase().trim() !== 'NULL') {
            await saveFactToMemory(extractedFact);
        } else {
            console.log("No new fact detected for memory.");
        }
    } catch (error) {
        console.error("Background learning process failed:", error);
    }
}

async function findRelevantMemories(text) {
    const embedding = await createEmbedding(text);
    const { data, error } = await supabase.rpc('match_memories', { query_embedding: embedding, match_threshold: 0.78, match_count: 5 });
    if (error || !data || data.length === 0) return "";
    const memories = data.map(item => `- ${item.content}`).join('\n');
    return `Before you answer, review these relevant facts from your permanent memory about Salman:\n${memories}\n`;
}

async function getAiResponse(input) {
    const thinkingMessage = addMessage("...", 'ai');
    sendButton.disabled = true;

    try {
        // --- Step 1: INSTANT LEARNING ---
        await processAndLearn(`User (Salman): ${input}`);

        // --- Step 2: MEMORY RECALL ---
        const relevantMemories = await findRelevantMemories(input);
        
        // --- Step 3: GENERATE RESPONSE ---
        const systemPrompt = `You are a personal AI. The user you are interacting with is named Salman. Your purpose is to be his direct, loyal, and intelligent companion. Your highest priority is to be accurate and helpful to him. ${relevantMemories}`;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: input }
                ],
                model: AI_MODEL_NAME
            } )
        });

        thinkingMessage.remove();
        const data = await response.json();
        const aiMessage = data.choices[0].message.content;
        addMessage(aiMessage, 'ai');

    } catch (error) {
        thinkingMessage.remove();
        addMessage(`SYSTEM ERROR: ${error.message}`, 'ai');
    } finally {
        sendButton.disabled = false;
        userInput.focus();
    }
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (text === "") return;
    addMessage(text, 'user');
    userInput.value = "";
    await getAiResponse(text);
}

// --- System Initialization ---
async function initializeSystem() {
    addMessage("Initializing System v2.1...", "system");
    try {
        // Pre-load the model so it's ready when needed.
        await createEmbedding("test");
        addMessage("Life AI System v2.1 is online. Instant learning is active.", 'ai');
    } catch (err) {
        addMessage(`Initialization Failed: Could not load memory model. Please refresh. Error: ${err.message}`, 'ai');
    }
}

// --- Event Listeners & Start ---
sendButton.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
});

initializeSystem();
