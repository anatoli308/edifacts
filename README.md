<div align="center">

<img src="./public/logo/logo-color-no-bg.png" alt="EDIFACTS Logo" width="120" />

# EDIFACTS

### AI-Powered EDI/EDIFACT Analysis Platform
### Transform Supply Chain Data into Actionable Insights

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Next.js](https://img.shields.io/badge/Built%20with-Next.js-black)](https://nextjs.org/)
[![Open Source](https://img.shields.io/badge/Open-Source-green)](https://github.com/anatoli308/edifacts)

**For Supply Chain Teams, EDI Specialists, and Integration Architects**

[The Problem](#-the-edi-challenge) • [Features](#-key-features) • [Quick Start](#-quick-start) • [Use Cases](#-use-cases) • [Roadmap](#-roadmap) • [Contact](#-contact--support)

---

</div>

## 📊 The EDI Challenge

Your supply chain runs on EDI. But EDI is complex:

- ❌ **Parsing errors go undetected** until downstream failures
- ❌ **Manual analysis wastes hours** on each EDIFACT file  
- ❌ **Enterprise EDI tools are expensive** ($10K+/year licensing)
- ❌ **No transparency** into what's actually in your messages
- ❌ **Integration bottlenecks** when validating B2B data

**EDIFACTS solves this.**

---

## 🚀 What is EDIFACTS?

EDIFACTS is an **open-source, AI-powered platform** that makes EDI analysis intelligent and transparent. Upload an EDIFACT file (INVOIC, ORDERS, DESADV, etc.) and get:

- 🧠 **AI-Powered Insights**: Instant analysis using OpenAI, Anthropic, or your own LLM
- ⚡ **Real-Time Validation**: Detect errors, warnings, and compliance issues instantly
- 🔍 **Smart Data Extraction**: Automatically identify parties, dates, amounts, key business data
- 📊 **Clear Visualizations**: Understand complex message structures at a glance
- 🔒 **Your Data, Your Control**: BYOK (Bring Your Own Key) — no vendor lock-in


## ✨ Key Features

🎯 **EDIFACT Intelligence**
- Automatic subset detection (EANCOM, ODETTE, HIPAA, UNECEGen, etc.)
- Segment-by-segment analysis with AI explanations
- Data extraction (parties, dates, amounts, items)
- Error detection and compliance checking
- Multi-file batch processing (upcoming)

🔐 **Your Data, Your Control (BYOK)**
- Bring your own OpenAI/Anthropic API keys
- Optional Ollama/vLLM for fully self-hosted analysis
- No vendor lock-in, no data sharing with 3rd parties
- Your encryption, your security

⚡ **Enterprise-Ready**
- Multi-user workspace with role-based access
- Audit trails for compliance (GDPR-ready)
- JWT authentication with secure session management
- REST API for programmatic access (upcoming)
- Docker deployment for easy on-prem setup

🌍 **Integrations & Extensibility**
- REST API endpoints for your automation workflows
- Tool registry for custom EDI validations
- Event-driven architecture for real-time updates
- Open source core for customization

## 🚀 Quick Start

### Option 1: Local 

**Requirements:** Node.js 18+, MongoDB, Ollama (default System LLM)

```bash
git clone https://github.com/anatoli308/edifacts
cd edifacts
# Install dependencies
npm install
# Create environment file
cp .env.example .env
# Start MongoDB (if not running)
# Start platform
npm run dev
# Sign in to Ollama (gpt-oss is the default model)
ollama signin
# Open in browser
# http://localhost:3010
```

### Option 2: Docker

**Requirements:** Docker & Docker Compose

```bash
git clone https://github.com/anatoli308/edifacts
cd edifacts

# Create environment file
cp .env.example .env.docker

# Start platform
docker-compose up --build -d

# Sign in to Ollama (gpt-oss is the default model)
docker exec -it <container-name> ollama signin

# Open in browser
# http://localhost:3010
```

**First Run:**
- Upload your EDIFACT file or paste text
- Select your AI provider (Ollama included by default)
- Get instant analysis

---

## 📋 Use Cases

### For Supply Chain Teams
**Validate incoming B2B EDI messages in seconds**
- Upload INVOIC/ORDERS/DESADV files
- Instant validation against EDI standards
- Identify missing fields or errors before they break downstream systems
- Export compliance reports

### For Integration Architects
**Debug complex EDI workflows**
- Understand message structure without manual parsing
- Detect which segments are causing integration failures
- Plan migrations or upgrades with confidence
- Document B2B partner requirements

### For Compliance Officers
**Audit EDI communications for compliance**
- GDPR-ready audit trails
- Track all EDI processing with timestamps
- Export reports for regulatory requirements
- HIPAA-compliant message handling

### For Business Analysts
**Extract actionable business data from EDI**
- Who are the trading partners? (Parties)
- What was ordered/invoiced? (Line items, amounts)
- When are deliveries? (Dates)
- What are the payment terms? (Conditions)

---

## 🏗️ Architecture (For Developers)

**Tech Stack:**
- Next.js 16 + React 19 (Modern Web UI)
- Material-UI v7 (Enterprise-grade components)
- Node.js + Express (Lightweight backend)
- MongoDB + Mongoose (Data persistence)
- Socket.IO (Real-time updates)
- OpenAI / Anthropic SDKs (LLM providers)
- Ollama (Optional: Self-hosted LLM)

**Core Design:**
- Event-driven agentic workflow (Planner → Scheduler → Executor → Critic)
- EventEmitter-based agent communication
- Real-time streaming with WebSocket
- Dependency injection for testability
- BYOK (Bring Your Own Key) for provider flexibility


## 🗺️ Product Roadmap

### v1.0 - Core Platform ✅ (Current)
- Web UI for EDIFACT analysis
- Docker deployment
- Multi-user workspaces
- OpenAI/Anthropic/Ollama support
- Basic validation & error detection
- Sequential agent pipeline (Planner → Scheduler → Executor → Critic)

### v1.1 - API & Automation 🚧 (Q1 2026)
- REST API for programmatic access
- Batch processing (process multiple files)
- Custom validation rules
- Export reports (PDF, CSV, JSON)

### v1.2 - Enterprise & Agent Intelligence 🚧 (Q2-Q3 2026)
**Enterprise Features:**
- Role-based access control (RBAC)
- Advanced audit logging
- On-premise deployment guide
- API rate limiting & metering

**Agent Enhancements:**
- Enhanced Memory (context optimization, semantic compression)
- Enhanced Recovery (circuit breaker, adaptive backoff)
- Ethics Agent (PII detection, GDPR compliance)
- Enhanced Critic (hallucination detection, confidence scoring)
- Smart Loop Detection & Dynamic Replanning
- State Machine Scheduler (checkpoint/resume)

### v2.0 - Multi-Agent Parallel Processing 🚀 (Q3-Q4 2026)
- Parallel EDI validation (3-5x faster)
- Competitive AI reasoning (best-of-N selection)
- ExecutorPool with specialized agents
- Agent Bus for peer-to-peer communication
- Real-time collaboration features
- Advanced anomaly detection
- Predictive compliance warnings

---

## 📞 Contact & Support

**Have Questions?**
- 📧 Email: [anatolireznik@web.de](mailto:anatolireznik@web.de)
- 🐛 Report Issues: [edifacts/issues](https://github.com/anatoli308/edifacts/issues)

**Support this Project**

If EDIFACTS helps your supply chain, consider supporting the project:

- 🌟 **Star on GitHub** — helps discoverability
- 💼 **Enterprise Support** — contact us for commercial agreements
- 🤝 **Partner with us** — let's build together

---

## 📋 Known Issues

- **[Windows]** Start VS Code with admin rights to avoid Turbopack issues
- **[Development]** Ollama cloud models require sign-in. Local models need additional disk space
- **[Docker]** Backend code changes require container restart

---

## 📜 License

MIT — Use EDIFACTS freely in your projects, commercial or otherwise.

---

**Built for supply chains that demand transparency, control, and intelligence.** 🚀