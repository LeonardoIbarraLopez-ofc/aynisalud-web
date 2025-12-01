const AUTH_URL = 'http://localhost:9100/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake';
const FUNCTIONS_URL = 'http://localhost:5002/local-aynialud/us-central1/searchPatientsHttp';

async function signIn(email, password) {
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`signIn failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.idToken;
}

async function callSearch(idToken, query) {
  const res = await fetch(FUNCTIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ query, idToken }),
  });
  const text = await res.text();
  console.log('HTTP status', res.status, text);
}

(async () => {
  try {
    const token = await signIn('reception@local.test', 'recep123');
    console.log('Signed in, token length', token.length);
    await callSearch(token, 'Paciente');
  } catch (err) {
    console.error(err);
  }
})();
