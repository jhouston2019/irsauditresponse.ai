import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  try {
    const { imageData, mimeType } = JSON.parse(event.body);
    
    // Use OpenAI's vision API to extract text from images
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all text from this image. Return only the text content, preserving the original formatting and structure. Do not add any commentary or analysis."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageData}`
              }
            }
          ]
        }
      ],
      max_tokens: 2000
    });

    const extractedText = response.choices[0].message.content;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ 
        text: extractedText 
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Failed to extract text from image',
        details: error.message 
      })
    };
  }
}
