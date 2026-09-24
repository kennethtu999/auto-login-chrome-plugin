# Header Login Manager

Chrome Manifest V3 extension for local, site-specific Header rules and user-triggered login profiles. Credentials and Header values remain in `chrome.storage.local`; the extension has no server, telemetry, analytics, wildcard Site profiles, or persistent content script.

## Local verification

```sh
npm test
npm run validate
npm run package
```

Load this repository root with **chrome://extensions** → **Developer mode** → **Load unpacked**. Add a Site using an exact hostname (for example `admin.example.com`), grant its permission, create a login profile, then visit that exact host and press the profile button in the popup.

Login matching is deliberately narrow: `label[for]`, wrapping `label`, `aria-label`, then `placeholder`; submit matching is button text, submit value, then `aria-label`. Matching is trimmed, case-insensitive, and exact. A missing field, button, permission, or hostname match fails without filling the page.

## Automatic login

In each Site editor, add account field selectors and a submit selector when the page does not expose matching labels. Set a duplicate-login confirmation selector if the site shows a same-session confirmation dialog. Add up to ten post-login functions; enter one action per line. Prefix a CSS selector with `focus:` or `click:`. Add ` | visible text` to target a link by its exact text. Existing lines without a prefix still click. For the HNCB flow, the confirmation selector is `div.popup-visible commandbutton:nth-of-type(1) > button`. To open "流程套餐" after focusing "管理設定", use `focus: a.menu-link | 管理設定` followed by `click: a[name="CCMAAPACK"]`. Verify these selectors against the live page before enabling automation.

On the target website, open the popup and check the box beside the account to use for automatic login. Only one account can be checked across all sites; unchecking it stops automatic login. The account button performs a one-time manual login and turns off automation first. Select a post-login function from the dropdown; it is saved as the next-use default for the automatic account. You can uncheck the active account from any tab. The content script runs only on granted, configured hostnames and checks the configured origin before filling a form. It handles the configured duplicate-login confirmation separately from form submission and waits for the selected function's menu to appear before clicking it.

## Backup and reset recovery

Use **Export** on the management page before removing the extension. It downloads a complete, versioned JSON backup of all Site Profiles, including Header values and login credentials. Treat it like a password export: keep it only in an encrypted, access-controlled location and delete old copies securely.

After reinstalling, select **Import** and choose that JSON file. Import validates the backup fully before replacing the current profiles; invalid JSON, an unsupported schema, or invalid Site data leaves the current store untouched. Chrome does not preserve optional host permissions after an extension reset, so re-save each restored Site to grant its domain permission again. Header rules become active only for currently granted Sites.

## Release prerequisites

Create the Chrome Web Store listing manually and configure `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, `CWS_PUBLISHER_ID`, and `CWS_EXTENSION_ID` as repository Secrets. Pushing a tag such as `v1.0.0` builds a ZIP, creates a GitHub Release, and uses the Chrome Web Store API V2 to upload and submit its public release for review.
