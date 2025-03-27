import crypto from 'crypto';
import { fileURLToPath } from 'url';

// Function to generate a secure random secret
export const generateSecureSecret = (bytes = 64) => {
  return crypto.randomBytes(bytes).toString('hex');
};

// Check if this is the main module being run
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  console.log('Generating new secure secrets...\n');
  
  console.log('New JWT_SECRET:');
  console.log(generateSecureSecret());
  
  console.log('\nNew SESSION_SECRET:');
  console.log(generateSecureSecret());
  
  console.log('\nStore these secrets securely in your .env file');
  console.log('Never commit secrets to version control!');
} 