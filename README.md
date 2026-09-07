# Header Login Manager

Chrome Manifest V3 extension for local, site-specific Header rules and user-triggered login profiles. Credentials and Header values remain in `chrome.storage.local`; the extension has no server, telemetry, analytics, wildcard Site profiles, or persistent content script.

## Local verification

```sh
npm test
npm run validate
npm run package
```

Load this repository root with **chrome://extensions** → **Developer mode** → **Load unpacked**. Add a Site using an exact hostname (for example `admin.example.com`), grant its permission, create a login profile, then visit that exact host and press the profile button in the popup.

Login matching is deliberately narrow: `label[for]`, wrapping `label`, then `aria-label`; submit matching is button text, submit value, then `aria-label`. Matching is trimmed, case-insensitive, and exact. A missing field, button, permission, or hostname match fails without filling the page.

## Backup and reset recovery

Use **Export** on the management page before removing the extension. It downloads a complete, versioned JSON backup of all Site Profiles, including Header values and login credentials. Treat it like a password export: keep it only in an encrypted, access-controlled location and delete old copies securely.

After reinstalling, select **Import** and choose that JSON file. Import validates the backup fully before replacing the current profiles; invalid JSON, an unsupported schema, or invalid Site data leaves the current store untouched. Chrome does not preserve optional host permissions after an extension reset, so re-save each restored Site to grant its domain permission again. Header rules become active only for currently granted Sites.

## Release prerequisites

Create the Chrome Web Store listing manually and configure `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, `CWS_PUBLISHER_ID`, and `CWS_EXTENSION_ID` as repository Secrets. Pushing a tag such as `v1.0.0` builds a ZIP, creates a GitHub Release, and uses the Chrome Web Store API V2 to upload and submit its public release for review.
