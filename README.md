# Cart Media Appliance — Linux Test Build

This is a manual Linux prototype of the media controller/player system.

It includes:

- Node.js/Express server
- player page for the display machine
- password-protected controller page
- accordion media library
- idle player overlay showing the controller URL/IP address
- global loop control
- pause disabled for images

This test build intentionally does **not** include:

- auto-start on boot
- kiosk mode
- shutdown button
- system shutdown commands

## Password

The controller password is:

```text
MaxAdler1930
```

You can change it in:

```text
server/config.js
```

## Install on Ubuntu/Debian/Mint

Install Node.js, npm, and a browser:

```bash
sudo apt update
sudo apt install -y nodejs npm unzip
sudo apt install -y chromium-browser || sudo apt install -y chromium || true
```

Unzip the package and enter the folder:

```bash
unzip cart-media-appliance-linux-test.zip
cd cart-media-appliance
```

Install dependencies:

```bash
npm install
```

Make scripts executable if needed:

```bash
chmod +x scripts/*.sh
```

Run the server and open the player window:

```bash
./scripts/run-server-and-open-player.sh
```

The player page should open in a normal browser window and display the idle screen. At the bottom it should show a controller URL like:

```text
http://192.168.1.42:3000/controller/
```

Open that URL from the tablet/Chromebook/iPad and log in with the password above.

## Add your real media

Put media files under:

```text
public/media/
```

Put thumbnails under:

```text
public/thumbs/
```

Put the idle/default image under:

```text
public/defaults/
```

Then edit:

```text
catalog/library.json
```

Each media entry has this form:

```json
{
  "id": "forest-loop",
  "title": "Forest Loop",
  "type": "video",
  "mediaPath": "/media/nature/forest-loop.mp4",
  "thumbnailPath": "/thumbs/forest-loop.jpg",
  "description": "A short description of the media."
}
```

Important: paths in `library.json` are URL paths, not filesystem paths. For example:

```json
"mediaPath": "/media/nature/example.mp4"
```

corresponds to this file:

```text
public/media/nature/example.mp4
```

## Useful local URLs

On the Linux machine:

```text
http://localhost:3000/player/
http://localhost:3000/controller/
http://localhost:3000/api/player-status
```

From another device, use the URL shown on the idle player screen.

## Stopping

Stop the server by pressing `Ctrl+C` in the terminal running the script. Or run

```bash
kill -9 $(lsof -t -i:3000)
```

to kill any servers running in the background on the same port.

## Notes on video playback

The player video element is muted by default to avoid browser autoplay restrictions. Replace the placeholder `.mp4` files with real playable video files before testing video playback.
