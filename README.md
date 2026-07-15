# INX Social Desktop V14.0

INX Social is a Windows desktop scheduler for Facebook Reels and Page publishing, developed by INAXX LTD.

## Start locally

Backend (first Command Prompt):
```cmd
cd inx-social-cloud-backend
npm install
npm run prisma:generate
npm start
```

Desktop (second Command Prompt):
```cmd
npm install
npm start
```

## Build Windows installer
```cmd
npm run dist
```

Installer output:
```text
release/INX-Social-Setup-14.0.0.exe
```

## Facebook connection callback
Upload `META-WEBSITE-UPLOAD/oauth-callback.html` to the root of `social.inaxx.co.uk`, then add this exact URL in Meta Facebook Login settings:

`https://social.inaxx.co.uk/oauth-callback.html`

The existing automatic Facebook Page connector is retained. Normal users do not enter raw Page tokens.
