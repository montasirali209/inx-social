# INX Social Desktop V14.0.2

INX Social is a Windows content scheduler developed by INAXX LTD.

Use Node.js 22.12 or newer for installation and release builds.

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

## Build a private Windows test installer

```cmd
BUILD_EXE_WINDOWS.bat
```

Installer output:
```text
release/INX-Social-Setup-14.0.2.exe
release/INX-Social-Setup-14.0.2.exe.sha256
```

Without a configured code-signing certificate this is an unsigned test build and must not be published. Production releases are built from an exact `v<package-version>` Git tag by `.github/workflows/ci.yml`. The `production-release` GitHub environment must be approved before the workflow creates a GitHub Release or updates backend release metadata.

The packaged application uses ASAR integrity and Electron fuses. Editing or replacing `app.asar` makes the packaged app terminate. A production installer also requires a trusted Windows Authenticode certificate; any executable modification invalidates that signature. Electron files can still be inspected, so licence, subscription and device enforcement remains server-side.

## Facebook connection callback
Upload `META-WEBSITE-UPLOAD/oauth-callback.html` to the root of `social.inaxx.co.uk`, then add this exact URL in Meta Facebook Login settings:

`https://social.inaxx.co.uk/oauth-callback.html`

The existing automatic Facebook Page connector is retained. Normal users do not enter raw Page tokens.
