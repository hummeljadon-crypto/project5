# Start here — upload to GitHub

This folder is already arranged as a GitHub repository root.

## Upload it

1. Create a new empty GitHub repository, for example `forever-world`.
2. Unzip this download on your device.
3. In the repository, choose **Add file → Upload files**.
4. Upload **all files and folders shown here**, including `.github`.
5. Commit to the `main` branch.
6. Open **Settings → Pages** and choose **GitHub Actions** as the source.
7. Open the **Actions** tab and wait for **Deploy to GitHub Pages** to finish.

Your website address will be:

```text
https://YOUR-USERNAME.github.io/REPOSITORY-NAME/
```

## Add the music

Put your audio file at:

```text
public/audio/scene-1.mp3
```

Only publish audio you have permission to host. Without the file, the scene still runs as a silent preview.

## Direct the animation

Edit the words and timestamps in:

```text
src/config.ts
```

Commit your edit. GitHub automatically rebuilds and updates the website.
