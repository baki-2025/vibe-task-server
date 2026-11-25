# Micro Task and Earning Platform Server

A REST API server for a three-role micro-task earning platform: worker, buyer, and admin.

## Features

- JWT and Firebase Admin compatible authentication
- Role-based authorization middleware for workers, buyers, and admins
- Worker and buyer coin balances with registration rewards
- Buyer task creation, editing, deletion, refunds, and submission review
- Worker task discovery, submissions, earnings, and withdrawals
- Admin user and task management
- Pending withdrawal approval with coin deductions
- Stripe checkout and signed webhook coin delivery
- Dummy payment purchase endpoint for development
- Notification collection with ordered user notifications
- Paginated worker submissions
- MongoDB aggregation dashboard statistics
- Secure environment-variable based configuration
- Health endpoint and JSON API error handling
- MongoDB indexes for submission queries

## Setup

1. Install Node.js 18 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and configure MongoDB and optional integrations.
4. Run `npm run dev` for development or `npm start` for production.

## API

All protected endpoints require `Authorization: Bearer <token>`.

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/jwt`
- `GET /api/auth/me`
- `GET /api/users`
- `GET /api/users/top-workers`
- `PATCH /api/users/:email/role`
- `DELETE /api/users/:email`
- `GET|POST /api/tasks`
- `GET|PATCH|DELETE /api/tasks/:id`
- `POST /api/tasks/:id/submissions`
- `GET /api/submissions`
- `PATCH /api/submissions/:id/approve`
- `PATCH /api/submissions/:id/reject`
- `POST /api/payments/purchase`
- `POST /api/payments/create-checkout-session`
- `GET /api/payments/history`
- `POST|GET /api/withdrawals`
- `PATCH /api/withdrawals/:id/approve`
- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
- `GET /api/dashboard/buyer`
- `GET /api/dashboard/worker`
- `GET /api/dashboard/admin`

## Environment

Create a `.env` file using `.env.example`. Never commit MongoDB credentials, JWT secrets, Stripe keys, or Firebase private keys.
