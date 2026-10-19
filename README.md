# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Deploy to Cloudflare Workers (free tier)

1. Log in once (creates a free Cloudflare account if you don't have one):

   ```sh
   npx wrangler login
   ```

2. Build and deploy:

   ```sh
   npm run deploy
   ```

   Your app goes live on `https://wasteops-dashboard.<your-subdomain>.workers.dev`. Cloudflare's free tier covers up to 100,000 requests per day at no cost.

- `npm run cf:dev` builds and serves the app through the Cloudflare runtime locally.
- Set a custom worker name in `wrangler.jsonc` if `wasteops-dashboard` is taken.

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
