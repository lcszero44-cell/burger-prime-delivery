# Security Specification — Burger Prime Auto-Print & Pix Kitchen Queue

## 1. Data Invariants

1. **Zero PII Exposure**: Customer orders (`/orders/{orderId}`) contain PII (`clienteNome`, `endereco`, `bairroNome`, `pontoReferencia`). Only authenticated, email-verified store administrators (`isAdmin()`) may `get`, `list`, `update`, or `delete` orders. Public customers have write-only submission (`create`) strictly gated by schema, size, regex, and initial-state invariants.
2. **Initial Order Integrity**: Newly created orders MUST have `status == 'novo'`, `impresso == false`, `impressoCount == 0`, `createdAt == request.time`, `updatedAt == request.time`, and bounded `itens` (`1..30`).
3. **Immutable Order Core & Timestamps**: Once created, `createdAt`, `codigoPedido`, `itens`, `subtotal`, `taxaEntrega`, and `total` cannot be mutated; `updatedAt` must always equal `request.time`.
4. **Terminal State Locking**: Orders in `'concluido'` or `'cancelado'` cannot be mutated by non-admin callers (and only `isAdmin()` can update orders in general, via explicit action allowlists).
5. **Kitchen Settings & Admin RBAC**: `/kitchenSettings/{settingId}` is strictly admin-only. `/admins/{uid}` creation/deletion is strictly limited to the bootstrapped store owner (`lucaroch222@gmail.com` with `email_verified == true`), preventing self-assigned privilege escalation.
6. **Strict ID & Size Guards**: Every single-doc path variable is verified with `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, `<= 128` chars), and every string/array field enforces explicit size bounds.

## 2. The "Dirty Dozen" Attack Payloads

1. **Unauthenticated Order Read (PII Scrape)**: Anonymous user attempts `get` or `list` on `/orders` -> `PERMISSION_DENIED`.
2. **Non-Admin Authenticated Order Read**: Regular signed-in Google user (not owner, not in `/admins`) attempts `list` on `/orders` -> `PERMISSION_DENIED`.
3. **Unverified Admin Email Spoof**: User with `email == 'lucaroch222@gmail.com'` but `email_verified == false` attempts to read `/orders` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection on Create**: Customer creates `/orders/{id}` with extra field `isAdminOverride: true` -> `PERMISSION_DENIED`.
5. **Pre-Printed / Fake Status Order Create**: Customer creates `/orders/{id}` with `status: 'concluido'` or `impresso: true` -> `PERMISSION_DENIED`.
6. **Client Timestamp Forgery**: Customer creates `/orders/{id}` with a backdated `createdAt` instead of `request.time` -> `PERMISSION_DENIED`.
7. **Oversized Document ID Poisoning**: Caller attempts create on `/orders/${'a'.repeat(300)}` or `/orders/bad$id` -> `PERMISSION_DENIED`.
8. **Unbounded Array Resource Exhaustion**: Customer submits `/orders/{id}` with 35 items in `itens` -> `PERMISSION_DENIED`.
9. **Oversized String Denial-of-Wallet**: Customer submits `clienteNome` with 500 characters -> `PERMISSION_DENIED`.
10. **Non-Admin Pix Confirmation Tampering**: Non-admin user attempts `update` on `/orders/{id}` to set `pixStatus: 'confirmado'` -> `PERMISSION_DENIED`.
11. **Self-Assigned Admin Escalation**: Regular authenticated user attempts to write `/admins/{theirUid}` with `role: 'admin'` -> `PERMISSION_DENIED`.
12. **Unauthorized Kitchen Settings Tampering**: Non-admin user attempts to modify `/kitchenSettings/main` to disable `autoPrintEnabled` -> `PERMISSION_DENIED`.
