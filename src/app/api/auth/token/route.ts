import { NextRequest, NextResponse } from 'next/server';

const DERIV_AUTH_URL = 'https://auth.deriv.com/oauth2/token';

export async function POST(request: NextRequest) {
  try {
    const { code, code_verifier, client_id, redirect_uri } = await request.json();

    if (!code || !code_verifier || !client_id || !redirect_uri) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id,
      code,
      code_verifier,
      redirect_uri,
    });

    const response = await fetch(DERIV_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Token exchange failed' },
      { status: 500 }
    );
  }
}
