# Agentic Commerce Workbench

An open-source development sandbox for checking how commerce data and APIs might behave inside a ChatGPT-style shopping flow.

Developers can load demo catalog data, upload CSV or JSON files, connect local or public APIs from the browser, run conversational shopping prompts, and inspect the simulated tool calls an AI agent would make.

## Features

- Interactive homepage with the full workbench as the first screen
- Firebase Auth with Google sign-in when credentials are configured
- Demo dataset, CSV/JSON upload, and browser-side API connection
- Chat simulator for product discovery, intent interpretation, and action routing
- Tool trace panel with selected tool, request payload, response payload, field mappings, and warnings
- Optional Firestore trace persistence and Cloud Storage upload persistence
- Express mock commerce API for local testing

## Quick Start

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

Open `http://localhost:5173`.

The frontend can run without Firebase credentials. To enable Google login and persistence, copy `.env.example` to `.env.local` and fill in your Firebase web app config.

## Mock API

Start the backend with:

```bash
npm run dev:backend
```

Then use `http://localhost:8787/mock-api/products` in the API connection field.

Other endpoints:

- `GET /mock-api/products?query=bike`
- `GET /mock-api/products/:id`
- `GET /mock-api/availability/:id`
- `POST /mock-api/actions/checkout`
- `POST /mock-api/actions/test-drive`

## Firebase

This project includes hosting, Firestore, Storage, and emulator config:

```bash
npm run firebase:emulators
```

Deploy hosting after building:

```bash
npm run build
firebase deploy
```
