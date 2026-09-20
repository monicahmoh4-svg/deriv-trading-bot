import { NextRequest, NextResponse } from 'next/server';

const DERIV_TOKEN_URL = 'https://auth.deriv.com/oauth2/token';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, code_verifier, client_id, redirect_uri } = body;

    if (!code || !code_verifier || !client_id || !redirect_uri) {
      return NextResponse.json(
        { error: 'Missing required parameters', received: { code: !!code, code_verifier: !!code_verifier, client_id: !!client_id, redirect_uri: !!redirect_uri } },
        { status: 400 }
      );
    }

    const formBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id,
      code,
      code_verifier,
      redirect_uri,
    });

    const response = await fetch(DERIV_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'token_exchange_failed', error_description: data.error_description || JSON.stringify(data), status: response.status },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'server_error', error_description: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
