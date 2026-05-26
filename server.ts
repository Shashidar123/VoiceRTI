import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Lazy-initialization helper to prevent server crash if API Key is temporarily absent in development,
// but fail fast with an explanatory error on actual feature invocation.
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not defined. Please set it via the Secrets panel in AI Studio.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// API Routes
app.post('/api/analyze', async (req, res) => {
  try {
    const { complaint, language } = req.body;
    if (!complaint) {
      res.status(400).json({ error: 'Complaint text is required' });
      return;
    }

    const ai = getAI();
    const userInputPrompt = `User's complaint: "${complaint}"\nUser stated language context: ${language || 'Auto-detect'}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: userInputPrompt,
      config: {
        systemInstruction: `You are an expert Right to Information (RTI) specialist under India's RTI Act 2005.
Analyze the user's grievance/complaint and output ONLY a JSON object matching the defined schema exactly.
Do not include any normal conversational response, markdown formatting (outside of returning clean json), or other text. Return strictly a JSON object.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detected_language: {
              type: Type.STRING,
              description: "Detected language of user input (e.g., Telugu, Hindi, Tamil, Kannada, English, etc.)"
            },
            english_summary: {
              type: Type.STRING,
              description: "Pristine, clear English translation and summary of the grievance"
            },
            government_department: {
              type: Type.STRING,
              description: "Name of the Government Department or Public Authority responsible for this issue (e.g., Department of Food & Civil Supplies, Municipal Corporation of Delhi, Education Department)"
            },
            state_or_central: {
              type: Type.STRING,
              description: "State Government or Central Government, specifying which tier handles this service"
            },
            key_information_to_seek: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING
              },
              description: "Array of 3-5 clear, sharp, numbered queries/points that the applicant should ask under Section 6(1) of the RTI Act to get concrete records. Make these queries direct and professional, focusing on getting documents."
            },
            pio_designation: {
              type: Type.STRING,
              description: "Specific designation of the Public Information Officer (PIO)"
            },
            submission_office: {
              type: Type.STRING,
              description: "Detailed name/level of office where this RTI application should be physically or digitally submitted."
            },
            localized_summary_for_speech: {
              type: Type.STRING,
              description: "A friendly, polite summary of the analysis translated fully into the user's selected/preferred language (Hindi, Telugu, Tamil, Kannada, or English). Tell them which department was identified and what main questions they are asking, written in a conversational tone suitable for read-aloud voice synthesis."
            }
          },
          required: [
            "detected_language",
            "english_summary",
            "government_department",
            "state_or_central",
            "key_information_to_seek",
            "pio_designation",
            "submission_office",
            "localized_summary_for_speech"
          ]
        }
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('No response text received from Gemini API');
    }

    const cleanAndParseJSON = (str: string) => {
      let cleaned = str.trim();
      
      // Remove leading/trailing markdown code block ticks if present
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      }
      cleaned = cleaned.trim();

      // Find first occurrence of '{' and last occurrence of '}' to isolate JSON object
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const jsonCandidate = cleaned.substring(firstBrace, lastBrace + 1);
        try {
          return JSON.parse(jsonCandidate);
        } catch (e) {
          // If substring parse fails, fall through to main parser
        }
      }
      
      return JSON.parse(cleaned);
    };

    const result = cleanAndParseJSON(text);
    res.json(result);
  } catch (error: any) {
    console.error('Error analyzing complaint:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze complaint' });
  }
});

app.post('/api/draft', async (req, res) => {
  try {
    const { analysis, applicantDetails } = req.body;
    if (!analysis) {
      res.status(400).json({ error: 'Analysis data is required' });
      return;
    }

    const ai = getAI();
    const promptString = `Generate a formal RTI application draft based on this analysis:
${JSON.stringify(analysis, null, 2)}

Applicant Details to populate or leave placeholders for:
Name: ${applicantDetails?.name || '[Applicant Name]'}
Address: ${applicantDetails?.address || '[Address]'}
Phone: ${applicantDetails?.phone || '[Phone Number]'}
Date: ${applicantDetails?.date || 'Today\'s Date'}

Use the correct legal structure of the Indian RTI Act 2005. Format of application must STRICTLY match the requested structure:
To,
The Public Information Officer,
[pio_designation from analysis / government_department],
[submission_office from analysis]

Subject: Application under Right to Information Act, 2005

Respected Sir/Madam,

I, ${applicantDetails?.name || '[Applicant Name]'}, a citizen of India, hereby request the following information under Section 6(1) of the RTI Act, 2005:

[Include the key_information_to_seek points as a numbered list here, keeping the exact professional legal wording.]

As per Section 7(1) of the RTI Act, kindly provide the information within 30 days of receipt of this application.

I am willing to pay the prescribed fee of ₹10 as applicable.

Thanking you,
Yours faithfully,
[Applicant Signature]
${applicantDetails?.name || '[Applicant Name]'}
${applicantDetails?.address || '[Address]'}
${applicantDetails?.phone || '[Phone Number]'}
Date: ${applicantDetails?.date || 'Today\'s Date'}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: promptString,
      config: {
        systemInstruction: `You are a legal document writer specializing in RTI applications under India's RTI Act 2005. Generate a complete, formal RTI application draft using the complaint analysis and applicant details provided. Use formal English. Be precise and legally sound. Do not include any preambles, chatty introductions, or markdown formatting outside of plain paragraphing or layout. Simply output the complete formatted text layout.`,
      },
    });

    const text = response.text;
    res.json({ draft: text });
  } catch (error: any) {
    console.error('Error generating RTI draft:', error);
    res.status(500).json({ error: error.message || 'Failed to generate RTI draft' });
  }
});

// Configure Vite middleware in development, serve static in production
const isProd = process.env.NODE_ENV === 'production';
const PORT = 3000;

if (!isProd) {
  // Dynamically import Vite server capabilities in development
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });
  app.use(vite.middlewares);

  // Serve index.html for SPA routes in development
  app.use('*', async (req, res, next) => {
    const url = req.originalUrl;
    try {
      let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
      template = await vite.transformIndexHtml(url, template);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
} else {
  // Serve built static assets from 'dist' directory in production
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
