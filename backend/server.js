const express = require('express');
require('dotenv').config({ path: __dirname + '/.env' });
const rateLimit = require("express-rate-limit");
let fetch;
import('node-fetch').then(module => { fetch = module.default; });
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3002;

app.set('trust proxy', 1);
const apiLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 10, // limit each IP to 10 requests per windowMs
    handler: function (req, res) {
        const rateResetTime = req.rateLimit.resetTime ? new Date(req.rateLimit.resetTime).toISOString() : null;

        res.status(429).json({
            status: "rate_limit_exceeded",
            message: "You have exceeded the 10 requests in 10 minutes limit!",
            info: "Come back in 10 minutes, and you'll get 10 more generated texts.",
            rateResetTime: rateResetTime
        });
    },
    headers: true,
    skip: function (req, res) {
        return req.method === 'OPTIONS';
    }
});

// Apply the rate-limiting middleware to all routes
app.use(apiLimiter);



app.use("/generate", apiLimiter);
app.use(express.json());
app.use(cors({
    origin: 'https://www.mirrormegpt.com',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.static('../frontend'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.post('/generate', async (req, res) => {
    const { prompt, rules } = req.body;
    const apiKey = process.env.OPENAI_API_KEY;  // Loaded from .env file
    const model = "gpt-3.5-turbo";

    const conversation = [
        { "role": "system", "content": "You are a helpful assistant that can adapt to the tone and vocabulary of a given text." },
        { "role": "user", "content": rules },
        { "role": "user", "content": prompt }
    ];
    

    const response = await fetch(`https://api.openai.com/v1/chat/completions`, {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
        model: "gpt-3.5-turbo-0613",  // Add this line to specify the model
        messages: conversation,  // Use the 'messages' parameter for chat-based API
        max_tokens: 2000
    })
}).catch(err => console.error("Fetch Error: ", err));  // Debug log for fetch errors


    const data = await response.json();
    console.log("Response from OpenAI: ", data);  // Debug log for OpenAI response

    let content = "Error generating text";
    if (data.choices && data.choices.length > 0) {
        content = data.choices[0]?.message?.content?.trim() || "Error generating text";
    }

    // Format the generated text to alternate between Four-Per-Em Space and regular space
    let newContent = '';
    let useSpecialSpace = true;  // Flag to alternate between special and regular space
    let useSpecialA = true;  // Flag to alternate between regular 'a' and Cyrillic 'а'

    for (let i = 0; i < content.length; i++) {
        if (content[i] === ' ') {
            newContent += useSpecialSpace ? '\u2004' : ' ';
            useSpecialSpace = !useSpecialSpace;  // Toggle the flag
        } else if (content[i].toLowerCase() === 'a') {  // Check for 'a' or 'A'
            newContent += useSpecialA ? 'а' : 'a';  // Use Cyrillic 'а' if flag is true
            useSpecialA = !useSpecialA;  // Toggle the flag
        } else {
            newContent += content[i];
        }
    }

    content = newContent;

    res.json({ generatedText: content });
});


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});