const readline = require('readline');
const google = require('googleapis').google;
const fs = require('fs');

const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];
const TOKEN_PATH = 'token.json';

(async () => {
	const client_secret = process.env.GOOGLE_CLIENT_SECRET;
	const client_id = process.env.GOOGLE_CLIENT_ID;
	const redirect_url = process.env.GOOGLE_REDIRECT_URI;
	const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_url);
	await getAccessToken(oAuth2Client);
})();

function getAccessToken(oAuth2Client) {
	const authUrl = oAuth2Client.generateAuthUrl({
		access_type: 'offline',
		scope: SCOPES,
	});
	console.log('Authorize this app by visiting this url:', authUrl);
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	rl.question('Enter the code from that page here: ', (code) => {
		rl.close();
		oAuth2Client.getToken(code, (err, token) => {
			if (err) return console.error('Error retrieving access token', err);
			oAuth2Client.setCredentials(token);
			fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
				if (err) return console.error(err);
				console.log('Token stored to', TOKEN_PATH);
			});
		});
	});
}
