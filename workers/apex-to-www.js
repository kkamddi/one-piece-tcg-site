// Cloudflare Worker "optcgkorea-apex-to-www" on optcgkorea.com/*.
// AdSense reads ads.txt from the root domain, so serve it here instead of redirecting; everything else goes to www.
// Deployed from the Cloudflare dashboard editor; keep this copy in sync with public/ads.txt.
const ADS_TXT = 'google.com, pub-1064116148043091, DIRECT, f08c47fec0942fa0\n';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/ads.txt') {
      return new Response(ADS_TXT, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }
      });
    }
    url.hostname = 'www.optcgkorea.com';
    url.protocol = 'https:';
    return Response.redirect(url.toString(), 301);
  }
};
