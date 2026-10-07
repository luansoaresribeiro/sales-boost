// English version of legalContent.ts — faithful translation of the same text
// (no new clauses). The Portuguese version is the original and the one that
// prevails; keep both in sync when either is edited. Company data comes from
// the single LEGAL_COMPANY object in legalContent.ts.
import { LEGAL_COMPANY, type LegalDoc } from './legalContent'

const C = LEGAL_COMPANY

export const LEGAL_UPDATED_EN = 'August 22, 2026'

export const PRIVACY_POLICY_EN: LegalDoc = {
  title: 'Privacy Policy',
  subtitle: `How ${C.brand} handles your personal data, in compliance with Brazilian Law No. 13,709/2018 (LGPD).`,
  sections: [
    {
      heading: '1. Who is the data controller',
      paragraphs: [
        `${C.brand} is operated by ${C.name}, registered under CNPJ No. ${C.cnpj}, headquartered at ${C.address} ("we", "our" or "platform"). We are the controller of the personal data processed through the platform, under the LGPD.`,
        `For any matter related to privacy and data protection, contact us at ${C.privacyEmail}.`,
      ],
    },
    {
      heading: '2. What data we collect',
      paragraphs: ['We collect only the data necessary to operate the platform and create value for your business:'],
      bullets: [
        'Registration data: name, email, password (stored encrypted) and company data (name, business type, city, website, social networks).',
        'Usage and business content data: posts, campaigns, reviews, opportunities, leads, messages with the AI agents and settings.',
        'Public data collected from external sources you connect (e.g., Google reviews, public profiles and posts on social networks, Google Maps information).',
        'Technical data: IP address, browser and device type, and browsing information collected by cookies (see the Cookies section).',
        'Payment data: processed directly by our payment provider (Stripe). We do not store your full card details on our servers.',
      ],
    },
    {
      heading: '3. What we use your data for (purposes)',
      bullets: [
        'Create and manage your account and authenticate you securely.',
        'Provide the platform services: generate content, analyze reviews, monitor competitors, produce diagnostics and recommendations.',
        'Process subscriptions and payments.',
        'Send notifications and communications about the agents\' operation (when you authorize it).',
        'Improve the platform, prevent fraud and ensure security.',
        'Comply with legal and regulatory obligations.',
      ],
    },
    {
      heading: '4. Legal bases (art. 7 of the LGPD)',
      paragraphs: ['We process your data based on: (i) performance of a contract, to provide the services you hired; (ii) consent, where applicable (e.g., non-essential cookies and certain communications); (iii) legitimate interest, to improve and protect the platform, always respecting your rights; and (iv) compliance with a legal or regulatory obligation.'],
    },
    {
      heading: '5. Artificial Intelligence and generated content',
      paragraphs: [
        `${C.brand} uses AI models to generate content drafts, analyses and recommendations. This data is sent to AI providers only to process your request.`,
        'Human control principle: nothing is published or sent to third parties automatically — all generated content remains a draft until your explicit approval, unless you yourself enable a specific automation.',
      ],
    },
    {
      heading: '6. Sharing and processors',
      paragraphs: ['We do not sell your personal data. We share data only with providers that help us operate the platform (processors), contractually bound to protect it, such as:'],
      bullets: [
        'Infrastructure and database (Supabase, Cloudflare).',
        'Artificial intelligence models (Anthropic).',
        'Public data collection (Apify) and website diagnostics (Google PageSpeed).',
        'Payments (Stripe).',
        'Transactional email (Resend) and voice (ElevenLabs).',
        'Integrations you connect (e.g., Meta/Instagram, Google Business Profile).',
      ],
    },
    {
      heading: '7. International transfer',
      paragraphs: ['Some processors may process data outside Brazil. In these cases, we adopt appropriate safeguards to ensure a level of protection compatible with the LGPD.'],
    },
    {
      heading: '8. Your rights as a data subject (art. 18 of the LGPD)',
      paragraphs: ['You may, at any time, request:'],
      bullets: [
        'Confirmation that processing exists and access to your data.',
        'Correction of incomplete, inaccurate or outdated data.',
        'Anonymization, blocking or deletion of unnecessary data or data processed in non-compliance.',
        'Portability of the data to another provider, upon request.',
        'Deletion of data processed based on consent.',
        'Information about who we share your data with.',
        'Withdrawal of consent.',
      ],
    },
    {
      heading: '9. Retention and deletion',
      paragraphs: [`We keep your data while your account is active and for the time needed to fulfill the described purposes and legal obligations. Once the account is closed, the data is deleted or anonymized, unless the law requires it to be kept for a specific period. To request deletion, write to ${C.privacyEmail}.`],
    },
    {
      heading: '10. Security',
      paragraphs: ['We adopt technical and organizational measures to protect your data, such as encryption, access control and per-company isolation (multi-tenant). No system is 100% infallible, but we work continuously to reduce risks.'],
    },
    {
      heading: '11. Cookies',
      paragraphs: ['We use essential cookies (necessary for operation and authentication) and, with your consent, analytics cookies to understand how the platform is used. You can manage your preference through the cookie banner shown on your first visit and at any time in your browser settings.'],
    },
    {
      heading: '12. Children and teenagers',
      paragraphs: ['The platform is intended for business owners over 18 years old. We do not knowingly collect data from minors.'],
    },
    {
      heading: '13. Changes to this policy',
      paragraphs: ['We may update this Policy periodically. Relevant changes will be communicated through the platform channels. The date of the last update appears at the top of this document.'],
    },
    {
      heading: '14. Data Protection Officer (DPO) and contact',
      paragraphs: [`Questions, requests or complaints about privacy can be sent to ${C.privacyEmail}. You may also contact the Brazilian National Data Protection Authority (ANPD).`],
    },
  ],
}

export const TERMS_OF_USE_EN: LegalDoc = {
  title: 'Terms of Use',
  subtitle: `Conditions for using the ${C.brand} platform. By using it, you agree to these terms.`,
  sections: [
    {
      heading: '1. Acceptance of the terms',
      paragraphs: [`These Terms of Use govern access to and use of the ${C.brand} platform, operated by ${C.name} (CNPJ ${C.cnpj}). By creating an account or using the platform, you declare that you have read, understood and agreed to these terms and to the Privacy Policy.`],
    },
    {
      heading: '2. Description of the service',
      paragraphs: [`${C.brand} is an AI-powered growth platform that helps small and medium businesses perform marketing and sales tasks — content generation, review analysis, competitor monitoring, website diagnostics, opportunity management and customer service. Features may evolve over time.`],
    },
    {
      heading: '3. Registration and user responsibilities',
      bullets: [
        'You must provide true, complete and up-to-date information.',
        'You are responsible for keeping your credentials confidential and for all activities carried out on your account.',
        'You must be at least 18 years old and have the legal capacity to enter into contracts.',
        'You are ultimately responsible for reviewing and approving any content before publishing it or sending it to third parties.',
      ],
    },
    {
      heading: '4. Subscriptions and payments',
      bullets: [
        'Access to certain features depends on a paid subscription, billed on a recurring basis according to the chosen plan.',
        'Payments are processed by the provider Stripe. By subscribing, you authorize recurring billing until cancellation.',
        'You may cancel your subscription at any time; access remains active until the end of the already paid cycle.',
        'Unless otherwise provided by law or expressly indicated by us, amounts already paid are not refunded pro rata.',
        'Prices and plans may be changed, with reasonable prior notice.',
      ],
    },
    {
      heading: '5. AI-generated content',
      bullets: [
        'The platform generates drafts and suggestions through artificial intelligence. This content may contain inaccuracies and must be reviewed by you before any use.',
        'Nothing is published automatically: content remains a draft until your approval, except for automations you deliberately enable.',
        'You are solely responsible for the content you decide to approve, publish or send, including its legal compliance and accuracy.',
        'We do not guarantee specific marketing, sales or revenue results from using the platform.',
      ],
    },
    {
      heading: '6. Intellectual property',
      paragraphs: [
        `The platform, its brand, software, design and other elements are owned by ${C.name} and protected by law. These terms do not transfer to you any right over the platform's intellectual property, except the limited license to use it while your account is active.`,
        'Your business content and data remain yours. You grant us only the license necessary to operate the services for your benefit.',
      ],
    },
    {
      heading: '7. Acceptable use',
      paragraphs: ['You agree not to:'],
      bullets: [
        'Use the platform for illegal or fraudulent purposes or purposes that violate third-party rights.',
        'Send spam or content that is misleading, defamatory, discriminatory or that violates the policies of integrated networks and channels.',
        'Attempt to access areas or data without authorization, bypass limits, or compromise the security and integrity of the system.',
        'Copy, resell or exploit the platform without authorization.',
      ],
    },
    {
      heading: '8. Third-party integrations',
      paragraphs: ['The platform may connect to third-party services (e.g., Meta/Instagram, Google, WhatsApp). Use of these integrations is also subject to the terms and policies of those third parties. We are not responsible for outages or changes to those services.'],
    },
    {
      heading: '9. Disclaimers and limitation of liability',
      paragraphs: [
        'The platform is provided "as is". We do not guarantee uninterrupted availability or the absence of errors.',
        'To the maximum extent permitted by law, our total liability for any losses related to the use of the platform is limited to the amount you paid in the 12 months preceding the event. We are not liable for indirect damages, lost profits or data loss resulting from factors beyond our reasonable control.',
      ],
    },
    {
      heading: '10. Suspension and termination',
      paragraphs: [`We may suspend or terminate accounts that violate these terms or the law. You may close your account at any time. Termination does not affect obligations already due. After termination, we handle your data in accordance with the Privacy Policy.`],
    },
    {
      heading: '11. Changes to the terms',
      paragraphs: ['We may update these Terms periodically. Relevant changes will be communicated. Continued use after the update represents agreement to the new version.'],
    },
    {
      heading: '12. Governing law and venue',
      paragraphs: [`These Terms are governed by the laws of the Federative Republic of Brazil. The courts of the ${C.jurisdiction} are chosen to settle disputes, waiving any other, however privileged.`],
    },
    {
      heading: '13. Contact',
      paragraphs: [`Questions about these Terms can be sent to ${C.email}.`],
    },
  ],
}
