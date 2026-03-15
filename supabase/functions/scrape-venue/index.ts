const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImageCandidate {
  url: string;
  alt: string;
  context: string;
}

function extractImageCandidates(html: string, baseUrl: string): ImageCandidate[] {
  const candidates: ImageCandidate[] = [];
  const seen = new Set<string>();

  // Extract og:image meta tags first (highest quality)
  const ogRegex = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi;
  const ogRegex2 = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/gi;
  for (const match of html.matchAll(ogRegex)) {
    const resolved = resolveUrl(match[1], baseUrl);
    if (resolved && !seen.has(resolved)) {
      seen.add(resolved);
      candidates.push({ url: resolved, alt: '', context: 'og:image meta tag (featured image)' });
    }
  }
  for (const match of html.matchAll(ogRegex2)) {
    const resolved = resolveUrl(match[1], baseUrl);
    if (resolved && !seen.has(resolved)) {
      seen.add(resolved);
      candidates.push({ url: resolved, alt: '', context: 'og:image meta tag (featured image)' });
    }
  }

  // Extract img tags with alt text and surrounding context
  const imgRegex = /<img([^>]+)>/gi;
  for (const match of html.matchAll(imgRegex)) {
    const attrs = match[1];
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    if (!srcMatch) continue;

    const resolved = resolveUrl(srcMatch[1], baseUrl);
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);

    const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
    const titleMatch = attrs.match(/title=["']([^"']*)["']/i);
    const alt = altMatch?.[1] || titleMatch?.[1] || '';

    // Grab ~100 chars of text surrounding the img tag for context
    const imgPos = html.indexOf(match[0]);
    const nearby = html.substring(Math.max(0, imgPos - 150), Math.min(html.length, imgPos + match[0].length + 150));
    const nearbyText = nearby.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 120);

    candidates.push({ url: resolved, alt, context: nearbyText });
  }

  return candidates.slice(0, 20);
}

function resolveUrl(src: string, baseUrl: string): string | null {
  if (src.startsWith('data:')) return null;
  if (/\.(svg|ico|gif)(\?|$)/i.test(src)) return null;
  if (/tracking|pixel|spacer|blank|badge|logo.*small|favicon|spinner|loading/i.test(src)) return null;

  try {
    const absolute = new URL(src, baseUrl).href;
    if (!absolute.startsWith('http')) return null;
    return absolute;
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  // Remove script and style tags with their content
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the website
    const pageResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!pageResponse.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch URL: ${pageResponse.status}` }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await pageResponse.text();
    const imageCandidates = extractImageCandidates(html, url);
    let plainText = stripHtml(html);

    // Limit to ~12,000 chars to stay within token limits
    if (plainText.length > 12000) {
      plainText = plainText.substring(0, 12000);
    }

    // Call OpenAI
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a data extraction assistant. Extract structured venue information from website text. You will also receive a list of images found on the page with their alt text and surrounding context. Select only the images that best showcase the venue (interior, exterior, event spaces, ceremony areas, reception halls, gardens, etc.). Exclude logos, icons, headshots, social media badges, decorative graphics, sponsor images, and other non-venue photos. Return ONLY valid JSON with no markdown formatting. Use null for any fields you cannot find. The JSON schema is:
{
  "name": "string - venue name",
  "address": "string - full address including city, state, zip",
  "capacity": "number or null - maximum guest capacity",
  "cost": "number or null - base price or starting price",
  "contact_name": "string - contact person name",
  "contact_email": "string - email address",
  "contact_phone": "string - phone number",
  "notes": "string - brief description of the venue, amenities, style",
  "packages": [
    {
      "name": "string - package name",
      "price": "number or null - package price",
      "description": "string - what's included"
    }
  ],
  "photo_urls": ["string - URLs of the best venue showcase images, max 6"]
}`,
          },
          {
            role: 'user',
            content: `Extract venue details from this website text:\n\n${plainText}\n\n---\n\nIMAGES FOUND ON PAGE (pick only the best venue photos):\n${imageCandidates.map((img, i) => `${i + 1}. URL: ${img.url}\n   Alt: ${img.alt || '(none)'}\n   Context: ${img.context}`).join('\n')}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!openaiResponse.ok) {
      const errBody = await openaiResponse.text();
      return new Response(
        JSON.stringify({ error: `OpenAI API error: ${openaiResponse.status}`, details: errBody }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'No response from OpenAI' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the JSON response (strip markdown code fences if present)
    const jsonStr = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const extracted = JSON.parse(jsonStr);

    // Ensure photo_urls only contains valid URLs from our candidates
    if (extracted.photo_urls && Array.isArray(extracted.photo_urls)) {
      const candidateUrls = new Set(imageCandidates.map((c) => c.url));
      extracted.photo_urls = extracted.photo_urls.filter((u: string) => candidateUrls.has(u));
    }

    return new Response(
      JSON.stringify(extracted),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
