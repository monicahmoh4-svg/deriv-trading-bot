import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, code_verifier, redirect_uri, client_id } = body;

    if (!code || !code_verifier || !redirect_uri || !client_id) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const tokenResponse = await fetch('https://api.deriv.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id,
        redirect_uri,
        code_verifier,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || tokenData.error) {
      return NextResponse.json(
        { error: tokenData.error_description || tokenData.error || 'Token exchange failed' },
        { status: tokenResponse.status || 400 }
      );
    }

    return NextResponse.json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error during token exchange' },
      { status: 500 }
    );
  }
}
