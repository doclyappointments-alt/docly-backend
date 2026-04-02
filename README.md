# Docly Backend

Production-grade backend for a healthcare booking platform, designed to handle real-world constraints around scheduling, payments, concurrency, and asynchronous workflows.

## Overview

Docly is an API-driven system that enables patients to book appointments with providers, while ensuring strong data integrity, payment consistency, and system reliability under real-world conditions.

The system is designed with a focus on:
- Correctness under concurrency
- Reliable payment processing
- Asynchronous task handling
- Failure-safe architecture

## Key Features

### Booking System
- Slot-based scheduling engine
- Concurrency-safe booking (prevents double booking)
- Timezone and DST-aware availability handling

### Payments (Stripe Integration)
- Checkout session handling
- Webhook-driven state updates
- Idempotent processing for duplicate/delayed events

### Asynchronous Processing
- Redis + BullMQ for background jobs
- Retry-safe execution
- Decoupling of user-facing and background tasks

### System Reliability
- Designed with failure as a first-class concern
- Safe handling of retries and partial failures
- Resilient integration with external systems

## Tech Stack

- Node.js, TypeScript, Express
- PostgreSQL (Prisma ORM)
- Redis (BullMQ for queues)
- React / Next.js (frontend integration)
- Stripe (payments)

## Architecture (High Level)

Frontend (React)
→ API Layer (Express)
→ Backend Logic (Node.js / TypeScript)
→ Database (PostgreSQL via Prisma)

External Systems:
- Stripe (payments via webhooks)

Background Processing:
- Redis + BullMQ (queues and workers)

## Design Principles

- Strong data integrity for all transactional flows
- Idempotent operations across payments and jobs
- Separation of synchronous and asynchronous work
- Designed to behave correctly under real-world conditions

## Getting Started

    npm install
    npm run dev

Create a `.env` file from `.env.example` before running.

## Notes

This project was built to simulate production-grade system behaviour, including:
- concurrency scenarios
- asynchronous workflows
- external system failures
- time-based edge cases
