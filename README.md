# IRS Audit Defense Pro

AI-powered IRS audit response letter generator with precision and professionalism.

## About

IRS Audit Defense Pro is a specialized AI tool designed to help taxpayers respond to IRS audit notices and CP2000 letters with professional, accurate, and stress-free assistance. Generate precise, factual IRS audit or CP2000 response letters that reference specific notices, explain discrepancies clearly, cite documentation, and maintain a respectful tone requesting case reconsideration.

### IRS Audit Defense — Product Architecture

#### User flow

1. `index.html` or `pricing.html` → `audit-defense.html` (wizard)
2. Step 1: Paste or upload IRS notice
3. Step 2: AI analysis (`analyze-notice.js` → GPT-4o)
4. Step 3: Choose response strategy
5. Step 4: Generated letter → copy / PDF / DOCX

#### Netlify functions

| Function | Purpose | Auth required |
| --- | --- | --- |
| `analyze-notice.js` | Notice analysis via GPT-4o | JWT (paid) |
| `generate-letter.js` | Letter generation via GPT-4o | JWT (paid) |
| `generate-pdf.js` | PDF export via pdf-lib | JWT (paid) |
| `generate-docx.js` | DOCX export via docx | JWT (paid) |
| `_wizardAuth.js` | Shared CORS + auth + payment check | — |
| `verify-payment.js` | Stripe payment verification (email lookup) | — |

#### Environment variables

See `.env.example` for all required variables. Set `AUDIT_DEFENSE_BYPASS_PAYMENT=1` in Netlify staging env only.

Client-side analytics: set `GA_MEASUREMENT_ID` at deploy time and inject it into `<meta name="ga-measurement-id" content="...">` on each page (or use a small build/snippet step). `src/analytics.js` loads GA4 only when the meta value matches `G-…`.

#### Local development

```bash
cd netlify/functions && npm install
cd ../..
netlify dev
```

#### Deleted files

- `audit-response.html` (replaced by `audit-defense.html`)
- `audit-upload.html` (merged into `audit-defense.html`)
- `netlify/functions/analyze-letter.js` (replaced by `analyze-notice.js`)

## Features

- 🔐 **User Authentication** - Secure login/signup with Supabase
- 📄 **Document Upload** - Upload IRS letters in PDF/image format
- 🤖 **AI Analysis** - Get instant explanations of audit notices
- ✍️ **Response Generation** - AI drafts professional audit response letters
- 💳 **One-Time Payment** - Simple $19 one-time fee
- 📥 **Download Options** - Export responses as PDF or DOCX
- 🖥️ **Dashboard** - Manage your letters and account
- 📚 **Resources** - Helpful guides and examples

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Netlify Functions
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage
- **AI**: OpenAI GPT-4o-mini
- **Payments**: Stripe
- **PDF Generation**: pdf-lib

## Setup Instructions

### 1. Environment Variables

Copy `.env.example` to `.env` and fill in your credentials (never commit `.env`).

```bash
cp .env.example .env
```

Required environment variables:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `OPENAI_API_KEY` - Your OpenAI API key
- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `STRIPE_PUBLIC_KEY` - Your Stripe publishable key
- `STRIPE_PRICE_ID` - Your Stripe price ID for audit response
- `SITE_URL` - Your production domain (https://auditresponse.ai)
- `APP_NAME` - IRS Audit Defense Pro
- `TAGLINE` - Handle IRS audits and CP2000 notices with AI precision
- `PRIMARY_COLOR` - #2563eb

### 2. Supabase Setup

1. Create a new Supabase project
2. Run the SQL migrations in the Supabase SQL Editor:
   - `supabase/migrations/20251001_create_users_table.sql`
   - `supabase/migrations/20251001_create_documents_table.sql`
3. Create a storage bucket named `letters`
4. Set up Row Level Security (RLS) policies

### 3. Stripe Setup

1. Create a Stripe account
2. Create a product: "Audit Response Letter" for $19
3. Add the price ID to your environment variables

### 4. OpenAI Setup

1. Create an OpenAI account
2. Generate an API key
3. Add it to your environment variables

### 5. Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### 6. Deployment

Deploy to Netlify:

1. Connect your GitHub repository to Netlify
2. Set environment variables in Netlify dashboard
3. Deploy automatically on push to main branch
4. Configure custom domain: auditresponse.ai

## File Structure

```
irs-audit-defense-pro/
├── src/
│   ├── components/
│   │   ├── Auth.js              # Authentication functions
│   │   └── UploadForm.js        # File upload utilities
│   └── main.js                  # Main application logic
├── netlify/
│   └── functions/
│       ├── analyze-notice.js    # IRS notice analysis (wizard)
│       ├── generate-letter.js   # Strategy-based response letter
│       ├── _wizardAuth.js       # Auth + CORS for wizard functions
│       ├── generate-response.js # AI response generation
│       ├── create-checkout-session.js # Stripe checkout
│       └── generate-pdf.js      # PDF generation
├── supabase/
│   └── migrations/
│       ├── 20251001_create_users_table.sql
│       └── 20251001_create_documents_table.sql
├── examples/
│   ├── cp2000-sample.pdf        # Sample CP2000 notice
│   └── audit-reply-sample.pdf   # Sample audit response
├── index.html                   # Homepage
├── examples.html                # Example letters page
├── resources.html               # Helpful resources
├── login.html                   # Login page
├── signup.html                  # Signup page
├── audit-defense.html           # 4-step IRS notice → letter wizard
├── upload.html                  # Document upload
├── dashboard.html               # User dashboard
├── pricing.html                 # Pricing page
├── success.html                 # Payment success
├── cancel.html                  # Payment cancelled
├── privacy.html                 # Privacy policy
├── terms.html                   # Terms of service
├── disclaimer.html              # Legal disclaimer
└── styles.css                   # Global styles
```

## API Endpoints

### Netlify Functions

- `/.netlify/functions/analyze-notice` - Analyze IRS notices (auth + paid)
- `/.netlify/functions/generate-letter` - Generate response letter from analysis
- `/.netlify/functions/generate-response` - Generate audit response letters
- `/.netlify/functions/create-checkout-session` - Create Stripe checkout
- `/.netlify/functions/generate-pdf` - Generate PDF documents

## Security Features

- Row Level Security (RLS) in Supabase
- Encrypted file storage
- Secure API key management
- Input validation and sanitization

## Legal Compliance

- Privacy Policy
- Terms of Service
- Legal Disclaimer (Not Legal Advice)
- GDPR compliance considerations

## Support

For support, email support@auditresponse.ai

## License

All rights reserved. This software is proprietary.
