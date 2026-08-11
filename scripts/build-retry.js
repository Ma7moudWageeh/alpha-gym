import { execSync } from 'child_process';

const MAX_RETRIES = 5;

function runBuild(attempt = 1) {
  console.log(`\n🚀 Attempt ${attempt} of ${MAX_RETRIES} to build the app...`);
  try {
    // Run the vite build and electron-builder
    execSync('npx vite build && npx electron-builder --publish always', { stdio: 'inherit' });
    console.log('\n✅ Build and Publish Successful!');
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      console.log(`\n⚠️ Build failed (likely due to Windows Defender file lock). Retrying in 3 seconds...`);
      setTimeout(() => runBuild(attempt + 1), 3000);
    } else {
      console.error('\n❌ Build failed after maximum retries. Please temporarily disable Windows Defender Real-Time Protection or add the project folder to exclusions.');
      process.exit(1);
    }
  }
}

runBuild();
