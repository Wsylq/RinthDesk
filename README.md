# RinthDesk <img src="https://i.postimg.cc/76Y4KmNf/yupp-generated-image-553543.png" width="32" height="32" style="vertical-align: middle; margin-left: 8px;">

A small desktop app for downloading mods and plugins from Modrinth with Profiles. Tired of downloading Plugins one-by-one? Maybe use this.

[![image.png](https://i.postimg.cc/wvhNkx0x/image.png)](https://postimg.cc/ZB50bSGX)

## What it does

- Search Modrinth for mods/plugins/datapacks
- Pick which version you want
- Download them to a folder you choose
- Keep track of what you've downloaded

## Why I made this

Got tired of going to the Modrinth website every time I needed to download a mod for a new Minecraft instance. Wanted something that stays open and just works.

## Install

Grab the latest `.exe` from the [releases page](link). Run it, done.

Or if you want to build it yourself:

```bash
git clone https://github.com/yourusername/rinthdesk
cd rinthdesk
npm install
npx tauri build
# check src-tauri/target/release/bundle/ for the installer
```

## How to use

1. Type what you're looking for in the search bar ("sodium", "jei", etc.)
2. Use the filters if you need a specific loader (Fabric/Forge) or game version
3. Click on a result to see available versions
4. Check the ones you want (or double-click for quick add)
5. Pick a download folder (or create a profile if you have multiple)
6. Watch the queue do its thing

The app remembers your theme and profiles between sessions.

## Themes

There's a few color schemes if the default isn't your thing:
- **Minimal** – what it says on the tin
- **Brutalism** – high contrast, yellow accents
- **Glass** – frosted look with blues

## Stuff it doesn't do (yet)

- No auto-updating mods (just downloads)
- No modpack installation
- Probably some bugs I haven't found

## Built with

- [Tauri](https://tauri.app/) – makes the desktop part work
- [React](https://reactjs.org/) – UI stuff
- [Modrinth API](https://docs.modrinth.com/) – where the mods come from
- Tailwind – styling because I'm lazy

## License

MIT. Do whatever.
