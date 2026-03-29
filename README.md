# Nova Defense (新星防御)

A classic missile command style tower defense game built with React, Tailwind CSS, and Vite.

## Features
- **Infinite Ammo**: Non-stop defense action.
- **Massive Blast Radius**: Interceptor missiles have a large AoE.
- **High-Speed Interception**: Fast-moving player missiles.
- **Bilingual Support**: Chinese and English.
- **Responsive Design**: Works on mobile and desktop.

## Deployment to Vercel

1. **Upload to GitHub**:
   - Create a new repository on GitHub.
   - Initialize git in your local project folder:
     ```bash
     git init
     git add .
     git commit -m "Initial commit"
     git remote add origin <your-github-repo-url>
     git push -u origin main
     ```

2. **Connect to Vercel**:
   - Log in to [Vercel](https://vercel.com).
   - Click **Add New** -> **Project**.
   - Import your GitHub repository.
   - Vercel will automatically detect the Vite project.
   - Click **Deploy**.

## Environment Variables
If you use the Gemini API in the future, make sure to add `GEMINI_API_KEY` to your Vercel project's environment variables.

## Local Development
```bash
npm install
npm run dev
```
