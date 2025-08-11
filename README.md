# Bitespeed Identify (SQLite) - Render Ready

This project implements the `/identify` endpoint using Node.js + TypeScript + Express + SQLite.
It's ready to be uploaded to GitHub and connected to Render for automatic deployment.

## Quick start (local)

1. Install:
```
npm install
```

2. Run in dev:
```
npm run dev
```

Server listens on `http://localhost:3000`.

## Build (production)
```
npm run build
npm start
```

## Endpoint
`POST /identify`
Body (JSON):
```json
{ "email": "user@example.com", "phoneNumber": "123456" }
```

## Deploy on Render
1. Push this repo to GitHub.
2. Create a new Web Service on Render and connect the GitHub repo.
3. Render will run `npm install && npm run build` and start the service with `npm start`.

The app uses a SQLite DB file (`contacts.db`) stored in the app directory. The free Render web service filesystem is ephemeral across deploys, but it persists for the lifetime of that instance. For production reliability consider an external DB.

