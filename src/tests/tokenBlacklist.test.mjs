// Token blacklist test
import fetch from 'node-fetch';

async function testTokenBlacklist() {
  console.log('\n🔒 Starting Token Blacklist Test...\n');
  
  try {
    // Step 1: Login to get a valid token
    console.log('Step 1: Logging in to get a token...');
    const loginResponse = await fetch('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'hasjass12@gmail.com',
        password: 'Nummer123@'
      })
    });

    const loginData = await loginResponse.json();
    
    if (!loginResponse.ok) {
      console.error('Login failed:', {
        status: loginResponse.status,
        statusText: loginResponse.statusText,
        error: loginData.error || 'Unknown error'
      });
      throw new Error(`Login failed: ${loginData.error || `Status ${loginResponse.status}`}`);
    }

    if (!loginData.token) {
      console.error('Login response missing token:', loginData);
      throw new Error('Login response missing token');
    }

    const originalToken = loginData.token;
    console.log('✓ Got initial token');
    console.log('Token:', originalToken.substring(0, 20) + '...\n');

    // Step 2: Verify the token works by making a test request
    console.log('Step 2: Testing if token works...');
    const testRequest1 = await fetch('http://localhost:5001/api/users/test', {
      headers: {
        'Authorization': `Bearer ${originalToken}`
      }
    });

    const testData1 = await testRequest1.json();
    console.log(`${testRequest1.ok ? '✓' : '✗'} Initial token ${testRequest1.ok ? 'works' : 'failed'}`);
    if (!testRequest1.ok) {
      console.log('Error:', testData1.error || 'Unknown error');
    }
    console.log();

    // Step 3: Logout to blacklist the token
    console.log('Step 3: Logging out to blacklist the token...');
    const logoutResponse = await fetch('http://localhost:5001/api/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${originalToken}`
      }
    });

    let logoutData;
    try {
      logoutData = await logoutResponse.json();
    } catch (e) {
      // Logout might not return JSON
      logoutData = { status: logoutResponse.status };
    }

    console.log(`${logoutResponse.ok ? '✓' : '✗'} Logout ${logoutResponse.ok ? 'successful' : 'failed'}`);
    if (!logoutResponse.ok) {
      console.log('Logout error:', logoutData.error || `Status: ${logoutResponse.status}`);
    }
    console.log();

    // Step 4: Try to use the old token (should fail)
    console.log('Step 4: Attempting to use blacklisted token...');
    const testRequest2 = await fetch('http://localhost:5001/api/users/test', {
      headers: {
        'Authorization': `Bearer ${originalToken}`
      }
    });

    const testData2 = await testRequest2.json();
    
    console.log(`${!testRequest2.ok ? '✓' : '✗'} Blacklisted token was ${!testRequest2.ok ? 'properly rejected' : 'incorrectly accepted'}`);
    console.log(`Response status: ${testRequest2.status}`);
    console.log(`Error message: ${testData2.error || 'No error message'}\n`);

    // Test Results Summary
    console.log('\n📋 Test Results Summary:');
    console.log('------------------------');
    console.log(`1. Initial token obtained: ${!!originalToken ? '✅' : '❌'}`);
    console.log(`2. Initial token worked: ${testRequest1.ok ? '✅' : '❌'}`);
    console.log(`3. Logout successful: ${logoutResponse.ok ? '✅' : '❌'}`);
    console.log(`4. Blacklisted token rejected: ${!testRequest2.ok ? '✅' : '❌'}`);
    
    // Overall test result
    const testPassed = !!originalToken && 
                      testRequest1.ok && 
                      logoutResponse.ok && 
                      !testRequest2.ok;
                      
    console.log('\n🏁 Final Result:');
    console.log(testPassed ? '✅ Test PASSED' : '❌ Test FAILED');

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    process.exit(1);
  }
}

// Run the test
testTokenBlacklist();

// Export for use in other tests if needed
export { testTokenBlacklist }; 