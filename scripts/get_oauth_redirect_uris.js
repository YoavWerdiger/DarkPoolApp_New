// Script to generate OAuth Redirect URIs for Android and iOS
const AuthSession = require('expo-auth-session');

console.log('🔗 OAuth Redirect URIs for DarkPool App\n');
console.log('='.repeat(60));

// Android Redirect URI
const androidRedirectUri = AuthSession.makeRedirectUri({
  scheme: 'com.darkpool.app',
  path: 'oauth',
  preferLocalhost: false,
});

console.log('\n📱 Android Redirect URI:');
console.log(androidRedirectUri);

// iOS Redirect URI (same scheme, different handling)
const iosRedirectUri = AuthSession.makeRedirectUri({
  scheme: 'com.darkpool.app',
  path: 'oauth',
  preferLocalhost: false,
});

console.log('\n🍎 iOS Redirect URI:');
console.log(iosRedirectUri);

// Supabase Callback URL (for Google OAuth)
const supabaseCallbackUrl = 'https://wpmrtczbfcijoocguime.supabase.co/auth/v1/callback';

console.log('\n🌐 Supabase Callback URL (for Google OAuth):');
console.log(supabaseCallbackUrl);

console.log('\n' + '='.repeat(60));
console.log('\n📋 Instructions:');
console.log('\n1. Copy the Android Redirect URI above');
console.log('2. Copy the iOS Redirect URI above');
console.log('3. Copy the Supabase Callback URL above');
console.log('\n4. In Supabase Dashboard:');
console.log('   - Go to Authentication → URL Configuration');
console.log('   - Add the redirect URIs to "Redirect URLs"');
console.log('\n5. In Google Cloud Console:');
console.log('   - Go to your Web OAuth Client ID');
console.log('   - Add the Supabase Callback URL to "Authorized redirect URIs"');
console.log('\n✅ Done!');
