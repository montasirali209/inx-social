const axios = require('axios');

const GRAPH_VERSION = process.env.FB_GRAPH_VERSION || process.env.GRAPH_VERSION || 'v25.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function graphError(error, fallback) {
  const metaError = error.response?.data?.error;
  const message = metaError?.message || error.message || fallback;
  const wrapped = new Error(message);
  wrapped.status = 400;
  wrapped.code = metaError?.code || null;
  wrapped.subcode = metaError?.error_subcode || null;
  return wrapped;
}

function normalisePage(page) {
  return {
    facebookPageId: String(page.id),
    facebookPageName: String(page.name || page.id),
    facebookPageUsername: page.username ? String(page.username) : null,
    facebookPagePicture: page.picture?.data?.url || null,
    facebookCategory: page.category ? String(page.category) : null,
    accessToken: page.access_token ? String(page.access_token) : null,
    tasks: Array.isArray(page.tasks) ? page.tasks : []
  };
}

async function fetchAllPages(url, params) {
  const pages = [];
  let nextUrl = url;
  let nextParams = params;

  while (nextUrl) {
    const response = await axios.get(nextUrl, {
      params: nextParams,
      timeout: 20000
    });

    pages.push(...(response.data?.data || []));
    nextUrl = response.data?.paging?.next || null;
    nextParams = undefined;
  }

  return pages;
}

async function discoverMetaAccount(userAccessToken) {
  try {
    const profileResponse = await axios.get(`${GRAPH_BASE}/me`, {
      params: {
        fields: 'id,name,picture.type(large)',
        access_token: userAccessToken
      },
      timeout: 20000
    });

    const directPages = await fetchAllPages(`${GRAPH_BASE}/me/accounts`, {
      fields: 'id,name,username,category,picture.type(large),access_token,tasks',
      limit: 100,
      access_token: userAccessToken
    });

    const pageMap = new Map();
    directPages.forEach(page => pageMap.set(String(page.id), normalisePage(page)));

    // Some Pages are only visible through a Business Portfolio edge.
    try {
      const businesses = await fetchAllPages(`${GRAPH_BASE}/me/businesses`, {
        fields: 'id,name',
        limit: 50,
        access_token: userAccessToken
      });

      for (const business of businesses) {
        for (const edge of ['owned_pages', 'client_pages']) {
          try {
            const businessPages = await fetchAllPages(
              `${GRAPH_BASE}/${business.id}/${edge}`,
              {
                fields: 'id,name,username,category,picture.type(large),access_token,tasks',
                limit: 100,
                access_token: userAccessToken
              }
            );
            businessPages.forEach(page => pageMap.set(String(page.id), normalisePage(page)));
          } catch (error) {
            // One inaccessible edge should not block the rest of the discovery result.
          }
        }
      }
    } catch (error) {
      // The user may not manage a Business Portfolio. Direct Pages are still valid.
    }

    const profile = profileResponse.data;
    return {
      account: {
        facebookUserId: String(profile.id),
        facebookUserName: profile.name ? String(profile.name) : null,
        facebookProfileImage: profile.picture?.data?.url || null
      },
      pages: [...pageMap.values()]
    };
  } catch (error) {
    throw graphError(error, 'Unable to discover Meta account Pages');
  }
}

module.exports = {
  discoverMetaAccount
};
