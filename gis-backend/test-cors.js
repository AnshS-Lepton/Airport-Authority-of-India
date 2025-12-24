// Simple test script to verify CORS is working
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/config/maps-key',
  method: 'GET',
  headers: {
    'Origin': 'http://localhost:4200'
  }
};

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log('Headers:');
  console.log(res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\nResponse Body:');
    console.log(data);
    
    if (res.headers['access-control-allow-origin']) {
      console.log('\n✓ CORS headers are present!');
      console.log(`Access-Control-Allow-Origin: ${res.headers['access-control-allow-origin']}`);
    } else {
      console.log('\n✗ CORS headers are missing!');
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
  console.log('\nMake sure the backend server is running on port 3000');
});

req.end();




