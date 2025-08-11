# Bitespeed Identify

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



