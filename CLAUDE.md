# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CoInk is a full-stack collaborative document editing application with a NestJS backend and Next.js frontend.

**Tech Stack:**
- **Frontend**: Next.js 16 + React 19 + TypeScript + Tailwind CSS 4
- **Backend**: NestJS + TypeScript + Prisma ORM + MySQL
- **Package Manager**: pnpm (work from respective directories)

## Common Commands

All commands assume you're in the respective project directory (`coInk/` for frontend, `backEnd/` for backend).

### Frontend (coInk/)

```bash
# Development
pnpm dev              # Start Next.js dev server

# Code Quality
pnpm lint             # ESLint with auto-fix
pnpm lint:ci          # ESLint (check only)
pnpm format           # Prettier format
pnpm format:ci        # Prettier (check only)
pnpm type-check       # TypeScript type checking

# Build
pnpm build            # Production build
pnpm start            # Start production server
```

### Backend (backEnd/)

```bash
# Development
pnpm dev              # Start NestJS in watch mode
pnpm start:debug      # Start with debugger

# Testing
pnpm test             # Run unit tests (Jest)
pnpm test:watch       # Run tests in watch mode
pnpm test:cov         # Run tests with coverage
pnpm test:e2e         # Run end-to-end tests
pnpm test:debug       # Debug tests with inspector

# Code Quality
pnpm lint             # ESLint with auto-fix
pnpm lint:ci          # ESLint (check only)
pnpm format           # Prettier format
pnpm type-check       # TypeScript type checking

# Build
pnpm build            # Build NestJS application
pnpm start:prod       # Start production server

# Database
pnpm postinstall      # Generate Prisma client (runs automatically after install)
```

### Git Workflow

```bash
pnpm commit           # Interactive conventional commit with cz-git
```

Uses emoji-based conventional commits: `feat: 🚀`, `fix: 🧩`, `refactor: ♻️`, etc.

## Architecture

### Frontend Architecture (coInk/)

**App Router Structure (`src/app/`):**
- Uses Next.js App Router with nested layouts
- Route groups for organization (e.g., `auth/`)
- Path alias `@/*` maps to `./src/*`

**Component Organization (`src/components/`):**
```
components/
├── ui/                    # General UI components (41+ shadcn-style)
├── tiptap-ui/             # Editor UI controls (buttons, dropdowns)
├── tiptap-ui-primitive/   # Base UI primitives (buttons, popovers)
├── tiptap-node/           # Custom TipTap node extensions
├── tiptap-extension/      # Custom TipTap extensions
├── tiptap-icons/          # Icon components for editor
└── tiptap-templates/      # Editor template configurations
```

**TipTap Editor Architecture:**
- Heavy use of TipTap extensions for rich text editing
- Custom extensions in `tiptap-extension/` and `tiptap-node/`
- Collaboration via Hocuspocus/Yjs (`@hocuspocus/provider`)
- UI components follow pattern: `use-{feature}.ts` hook + component

**State Management:**
- Zustand for global state
- React hooks for local state

### Backend Architecture (backEnd/)

**NestJS Module Structure:**
```
src/
├── auth/                  # Authentication (JWT + Passport)
├── user/                  # User management
├── documents/             # Document CRUD operations
├── prisma/                # Prisma module and service
├── common/                # Interceptors, filters, guards
└── main.ts                # Application entry point
```

**Database Layer:**
- Prisma ORM with MySQL
- Generated client output to `generated/prisma/`
- Schema defines users, documents, permissions, groups, notifications

**Authentication:**
- JWT tokens with Passport
- GitHub OAuth support
- Password hashing with Argon2

**Key Conventions:**
- Controllers handle HTTP routing
- Services contain business logic
- DTOs in `{module}/dto/` for request/response shapes
- Entities in `{module}/entities/` for type definitions

## Configuration Notes

- **Next.js**: `reactCompiler: true` enabled, StrictMode disabled
- **TypeScript Frontend**: Target ES2017, path alias `@/*`
- **TypeScript Backend**: Target ES2023, CommonJS modules
- **Tailwind**: v4.1.7 with CSS-based configuration
- **ESLint**: Prettier integration, import ordering rules
