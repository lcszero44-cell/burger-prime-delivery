/**
 * Security Rules Specification Verification (Dirty Dozen Test Matrix)
 * Run against Firebase Emulator Suite with @firebase/rules-unit-testing when testing locally.
 */
export const DIRTY_DOZEN_SECURITY_CASES = [
  {
    id: 1,
    name: 'Unauthenticated Order Read (PII Scrape)',
    operation: 'GET /orders/order_1',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Non-Admin Authenticated Order List',
    operation: 'LIST /orders',
    auth: { uid: 'customer_1', email: 'cliente@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Admin Email Spoof',
    operation: 'LIST /orders',
    auth: { uid: 'spoof_1', email: 'lucaroch222@gmail.com', email_verified: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow Field Injection on Order Create',
    operation: 'CREATE /orders/order_shadow',
    payloadMutation: { isAdminOverride: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Pre-Printed or Completed Status Forgery on Create',
    operation: 'CREATE /orders/order_fake_status',
    payloadMutation: { status: 'concluido', impresso: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Client Timestamp Forgery on Create',
    operation: 'CREATE /orders/order_fake_time',
    payloadMutation: { createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Oversized / Invalid Document ID Poisoning',
    operation: 'CREATE /orders/bad$id',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Unbounded Items Array Exhaustion (>30 items)',
    operation: 'CREATE /orders/order_big_array',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Oversized String Field Denial-of-Wallet (>100 chars clienteNome)',
    operation: 'CREATE /orders/order_big_name',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Non-Admin Pix Confirmation Update Tampering',
    operation: 'UPDATE /orders/order_1',
    auth: { uid: 'customer_1', email: 'cliente@example.com', email_verified: true },
    payloadMutation: { pixStatus: 'confirmado' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Self-Assigned Admin Privilege Escalation',
    operation: 'CREATE /admins/customer_1',
    auth: { uid: 'customer_1', email: 'cliente@example.com', email_verified: true },
    payloadMutation: { role: 'admin' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unauthorized Kitchen Settings Tampering',
    operation: 'UPDATE /kitchenSettings/main',
    auth: { uid: 'customer_1', email: 'cliente@example.com', email_verified: true },
    payloadMutation: { autoPrintEnabled: false },
    expected: 'PERMISSION_DENIED',
  },
] as const;
