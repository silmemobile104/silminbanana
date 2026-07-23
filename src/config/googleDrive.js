const https = require('https');
const { URL } = require('url');

/**
 * Fetch OAuth2 Access Token using Refresh Token
 */
async function getAccessToken() {
  const postData = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    grant_type: 'refresh_token'
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.access_token) {
            resolve(parsed.access_token);
          } else {
            reject(new Error(`Failed to refresh Google access token: ${body}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Helper to make authenticated Google Drive API V3 requests
 */
async function driveApiRequest(urlStr, options = {}, bodyBuffer = null) {
  const accessToken = await getAccessToken();
  const url = new URL(urlStr);

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    ...(options.headers || {})
  };

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: options.method || 'GET',
      headers
    }, (res) => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        const responseBuffer = Buffer.concat(data);
        const responseText = responseBuffer.toString('utf8');
        try {
          const json = JSON.parse(responseText);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            reject(new Error(json.error ? json.error.message : responseText));
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(responseText);
          } else {
            reject(new Error(`Google API Error ${res.statusCode}: ${responseText}`));
          }
        }
      });
    });

    req.on('error', reject);
    if (bodyBuffer) req.write(bodyBuffer);
    req.end();
  });
}

/**
 * Find or Create a folder in Google Drive under a parent folder
 */
async function getOrCreateFolder(folderName, parentFolderId) {
  const query = `name = '${folderName}' and '${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`;

  const searchRes = await driveApiRequest(searchUrl);

  if (searchRes.files && searchRes.files.length > 0) {
    return searchRes.files[0].id;
  }

  // Create folder if not existing
  const createUrl = 'https://www.googleapis.com/drive/v3/files';
  const metadata = JSON.stringify({
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentFolderId]
  });

  const createRes = await driveApiRequest(createUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, Buffer.from(metadata));

  return createRes.id;
}

/**
 * Upload a file to Google Drive under "เช็คสต็อกsilminbanana / [YYYY-MM-DD]"
 */
async function uploadImeiImageToDrive({ fileBuffer, fileName, mimeType, imei, dateStr }) {
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || 'root';

  // 1. Get or Create Main Folder "เช็คสต็อกsilminbanana"
  const mainFolderId = await getOrCreateFolder('เช็คสต็อกsilminbanana', rootFolderId);

  // 2. Get or Create Date Subfolder "YYYY-MM-DD"
  const targetDateStr = dateStr || new Date().toISOString().split('T')[0];
  const dateFolderId = await getOrCreateFolder(targetDateStr, mainFolderId);

  // 3. Upload File via Multipart Upload
  const boundary = '-------SilminBananaDriveBoundary' + Date.now();
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelimiter = "\r\n--" + boundary + "--";

  const cleanFileName = `IMEI_${imei}_${Date.now()}`;

  const metadata = {
    name: cleanFileName,
    parents: [dateFolderId]
  };

  const multipartBody = Buffer.concat([
    Buffer.from(delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + delimiter + `Content-Type: ${mimeType || 'image/jpeg'}\r\n\r\n`),
    fileBuffer,
    Buffer.from(closeDelimiter)
  ]);

  const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const uploadRes = await driveApiRequest(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': multipartBody.length
    }
  }, multipartBody);

  // 4. Set Permission to Public Reader so image can be viewed
  try {
    const permUrl = `https://www.googleapis.com/drive/v3/files/${uploadRes.id}/permissions`;
    await driveApiRequest(permUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, Buffer.from(JSON.stringify({ role: 'reader', type: 'anyone' })));
  } catch (e) {
    // Non-fatal if permission fails
  }

  const webViewLink = `https://drive.google.com/file/d/${uploadRes.id}/view`;
  const webContentLink = `https://drive.google.com/uc?id=${uploadRes.id}`;
  const lh3Url = `https://lh3.googleusercontent.com/d/${uploadRes.id}=w1000?authuser=0`;

  return {
    fileId: uploadRes.id,
    fileName: cleanFileName,
    webViewLink,
    webContentLink,
    url: lh3Url,
    folderId: dateFolderId
  };
}

module.exports = {
  getAccessToken,
  uploadImeiImageToDrive
};
