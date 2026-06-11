const PROVIDERS = [
  {
    name: 'ip-api',
    buildUrl: (ip) =>
      `http://ip-api.com/json/${ip}?lang=zh-CN&fields=status,message,country,regionName,city,isp,lat,lon,as,query,mobile,proxy,hosting`,
    normalize(data, ip) {
      if (data.status !== 'success') return null;
      return {
        ip: data.query || ip,
        country: data.country || '',
        city: data.city || data.regionName || '',
        isp: data.isp || data.as || '',
        geo: data.lat != null && data.lon != null ? `${data.lat},${data.lon}` : '',
        type: data.hosting ? '数据中心' : data.mobile ? '移动网络' : 'IPv4',
        provider: 'ip-api',
      };
    },
  },
  {
    name: 'ipinfo',
    buildUrl: (ip) => `https://ipinfo.io/${ip}/json`,
    normalize(data, ip) {
      if (data.error || data.bogon) return null;
      return {
        ip: data.ip || ip,
        country: data.country || '',
        city: data.city || data.region || '',
        isp: data.org || '',
        geo: data.loc || '',
        type: 'IPv4',
        provider: 'ipinfo',
      };
    },
  },
  {
    name: 'ipwhois',
    buildUrl: (ip) => `https://ipwhois.app/json/${ip}?lang=zh-CN`,
    normalize(data, ip) {
      if (data.success === false) return null;
      return {
        ip: data.ip || ip,
        country: data.country || '',
        city: data.city || '',
        isp: data.isp || data.connection?.isp || '',
        geo:
          data.latitude != null && data.longitude != null
            ? `${data.latitude},${data.longitude}`
            : '',
        type: data.type || 'IPv4',
        provider: 'ipwhois',
      };
    },
  },
];

async function lookupIp(ip) {
  for (const provider of PROVIDERS) {
    try {
      const response = await fetch(provider.buildUrl(ip), {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) continue;
      const data = await response.json();
      const result = provider.normalize(data, ip);
      if (result) return result;
    } catch {
      // try next provider
    }
  }
  return {
    ip,
    country: '查询失败',
    city: '',
    isp: '',
    geo: '',
    type: '',
    provider: 'none',
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (url.pathname === '/api/ip') {
      const ip = url.searchParams.get('ip')?.trim();
      if (!ip || !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
        return jsonResponse({ error: '无效的 IP 地址' }, 400);
      }
      return jsonResponse(await lookupIp(ip));
    }

    if (env.ASETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('IP Check API: GET /api/ip?ip=8.8.8.8', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  },
};
