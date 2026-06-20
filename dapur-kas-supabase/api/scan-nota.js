export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const API_KEY = process.env.GOOGLE_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'API key not configured' });

  try {
    const body = req.body;
    const userMessage = body.messages[0].content;
    
    const imagePart = userMessage.find(p => p.type === 'image');
    const textPart = userMessage.find(p => p.type === 'text');

    const geminiBody = {
      contents: [{
        parts: [
          { 
            inline_data: { 
              mime_type: imagePart?.source?.media_type || 'image/jpeg', 
              data: imagePart?.source?.data || ''
            } 
          },
          { text: textPart?.text || '' }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
      }
    );

    const data = await response.json();
    console.log('Gemini raw:', JSON.stringify(data).slice(0, 500));
    
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 
                 data.promptFeedback?.blockReason || 
                 'Tidak ada response';
                 
    res.status(200).json({ content: [{ type: 'text', text }] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
