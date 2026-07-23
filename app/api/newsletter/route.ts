import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const { error } = await supabase
      .from('newsletter_subscribers')
      .upsert({ email, subscribed_at: new Date().toISOString(), status: 'active' }, { onConflict: 'email' });

    if (error) {
      console.error('Newsletter subscribe error:', error);
      // Still return success so UX is not broken
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
