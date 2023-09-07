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
    windowMs: 10 * 60 * 1000, 
    max: 10, 
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


app.use("/generate", apiLimiter);




app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3002',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.static('../frontend'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});



app.post('/generate', async (req, res) => {
    const { prompt, rules } = req.body;
    const apiKey = process.env.OPENAI_API_KEY;  
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
        model: "gpt-3.5-turbo-0613",  
        messages: conversation,  
        max_tokens: 2000
    })
}).catch(err => console.error("Fetch Error: ", err));  


    const data = await response.json();
    console.log("Response from OpenAI: ", data); 

    let content = "Error generating text";
    if (data.choices && data.choices.length > 0) {
        content = data.choices[0]?.message?.content?.trim() || "Error generating text";
    }


    let newContent = '';
    let useSpecialSpace = true;  
    let useSpecialA = true;  
    let useSpecialO = true; 

    for (let i = 0; i < content.length; i++) {
        if (content[i] === ' ') {
            newContent += useSpecialSpace ? '\u2004' : ' ';
            useSpecialSpace = !useSpecialSpace;  
        } else if (content[i].toLowerCase() === 'a') {  
            newContent += useSpecialA ? 'а' : 'a';  
            useSpecialA = !useSpecialA;  
        } else if (content[i].toLowerCase() === 'o') {  
            newContent += useSpecialO ? 'ο' : 'o';  
            useSpecialO = !useSpecialO;  
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