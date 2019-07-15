# syncmarx

## What it does

A web extension to synchronize bookmarks between browers. Supports the following features:

* Works in Firefox, Google Chrome, Vivaldi, and Brave desktop browsers
* Syncs as a single backup file to Dropbox, Google Drive, or Box
* Configurable automatic sync

Note that this extension talks to a companion backend app required for initial handshake to third-party APIs called [syncmarx-api](https://github.com/Cleod9/syncmarx-api)

## How to Build

First make sure you have the latest version of [Node.js](https://nodejs.org/en/) installed. Then follow the instructions below from within the project directory.

### Development
```bash
npm install
npm run dev

# Or to auto-rebuild on file changes:
npm run dev-watch
```

### Production
```bash
npm install
npm run prod

# Or to auto-rebuild on file changes:
npm run prod-watch
```

## How to Test

You have two options for testing. The first is to simply build the app, and load the directory as an unpacked extension directly from within your browser.

The other way is to run `npm run dev-web-ext` (or `prod-web-ext` depending on target environment). This will load the extension into a temporary instance of Firefox for testing.

## How to Configure Syncmarx

Follow the on-screen instructions. The app will walk you through the authentication process for a third-party cloud file host (currently Dropbox, Google Drive, or Box). Copy and paste the provided token into the app, and you can start syncing bookmarks.

## Known Issues:

* Currently may not be able to reconcile/sort duplicates within the same folder
* Will not manage browser-specific bookmark functionality due to Web Extension spec limitations (e.g. Seperators, tags, keywords, description, favicons, etc.)
* Will not track Firefox's "Other Bookmarks" folder (a.k.a. "Unorganized" bookmarks)
* Still overall alpha in general so it is recommended to create a backup of your bookmarks before using
* Microsft Edge support will not be possible until this issue is resolved
