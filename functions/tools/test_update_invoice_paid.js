const AUTH_URL = 'http://localhost:9100/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake';
const FUNCTIONS_BASE = 'http://localhost:5002/local-aynialud/us-central1';

async function signIn(email, password) {
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!res.ok) throw new Error(`signIn failed: ${res.status} ${await res.text()}`);
  return (await res.json()).idToken;
}

async function callUpdate(idToken) {
  const url = `${FUNCTIONS_BASE}/updateInvoiceHttp`;
  const payload = {
    invoiceId: 'inv-checkout-demo',
    status: 'paid',
    payments: [{ method: 'Efectivo', amount: 150, transactionDate: new Date().toISOString() }],
    idToken,
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  console.log('updateInvoiceHttp ->', res.status, text);
}

(async () => {
  try {
    const token = await signIn('reception@local.test', 'recep123');
    await callUpdate(token);
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
})();
