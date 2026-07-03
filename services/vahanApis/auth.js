const axios = require('axios');
const qs = require('qs'); // For form-urlencoded payload
const logger = require('../../helpers/logger');

// Define the API endpoint and credentials
// const ENVIRONMENT = 'PROD'; // Change to 'PROD' for production
const endpoint = process.env.VAHANURL + '/oauth/token' ;
const apiKey = process.env.VAHANAPIKEY;
const secretKey = process.env.VAHANSECRETKEY;

// Create the Basic Auth header value
const authHeader = Buffer.from(`${apiKey}:${secretKey}`).toString("base64");

// Define the request payload
const payload = qs.stringify({
  grant_type: 'client_credentials',
});

async function getAuthToken(){
  try {
    const response = await axios.post(endpoint, payload, {
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    logger.debug('VAHAN auth token obtained', {
      service: 'vahan-auth',
      expiresIn: response.data?.expires_in,
      tokenType: response.data?.token_type
    });
    return response.data
  } catch (error) {

    logger.error('VAHAN auth failed', {
      service: 'vahan-auth',
      error: error.response?.data?.error || error.message
    });
  }
}

module.exports = {
  getAuthToken
}