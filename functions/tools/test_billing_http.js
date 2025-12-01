const AUTH_URL = 'http://localhost:9100/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake';
const FUNCTIONS_BASE = 'http://localhost:5002/local-aynialud/us-central1';

async function signIn(email, password) {
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!res.ok) {
    throw new Error(`signIn failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.idToken;
}

async function callFunction(name, idToken, payload) {
  const url = `${FUNCTIONS_BASE}/${name}Http`;
  const body = JSON.stringify({ ...payload, idToken });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body,
  });
  const text = await res.text();
  console.log(`${name} -> ${res.status}`, text);
  if (!res.ok) {
    throw new Error(`Function ${name} failed`);
  }
  return JSON.parse(text);
}

(async () => {
  try {
    const token = await signIn('reception@local.test', 'recep123');
    console.log('Signed in as receptionist, token length', token.length);
    const invoiceId = 'inv-checkout-demo';
    await callFunction('getInvoiceById', token, { invoiceId });
    await callFunction('updateInvoice', token, { invoiceId, status: 'draft', payments: [] });
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
})();
