const fetch = require('node-fetch');
const querystring = require('querystring');
const FormData = require('form-data');

const SLACK_WORKSPACE = process.env.SLACK_WORKSPACE;
const SLACK_USERNAME = process.env.SLACK_USERNAME;
const SLACK_PASSWORD = process.env.SLACK_PASSWORD;

exports.inviteUsersToSlackWorkspace = async (emails) => {
	let { cookies, crumb } = await makeEntryPointRequest();
	cookies = await signIn(cookies, crumb);
	const token = await retrieveClientToken(cookies);
	await doBulkInvite(emails, token, cookies);
};

async function makeEntryPointRequest() {
	const response = await fetch(`https://${SLACK_WORKSPACE}/`, {
		credentials: 'omit',
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:78.0) Gecko/20100101 Firefox/78.0',
			'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
			'Accept-Language': 'en-US,en;q=0.5',
			'Upgrade-Insecure-Requests': '1',
			'Cache-Control': 'max-age=0',
			'TE': 'Trailers',
		},
		method: 'GET',
		mode: 'cors',
	});
	const cookies = response.headers
		.raw()
		['set-cookie'].map((entry) => {
			const parts = entry.split(';');
			return parts[0];
		})
		.join(';');
	const crumb = querystring.escape(/crumbValue&quot;:&quot;(.*?)&/g.exec(await response.text())[1]);

	return { cookies, crumb };
}

async function signIn(cookies, crumb) {
	const response = await fetch(`https://${SLACK_WORKSPACE}/?redir=/ssb/redirect?entry_point=workspace_signin`, {
		credentials: 'include',
		headers: {
			'Host': SLACK_WORKSPACE,
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:78.0) Gecko/20100101 Firefox/78.0',
			'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
			'Connection': 'keep-alive',
			'Accept-Language': 'en-US,en;q=0.5',
			'Origin': null,
			'Content-Type': 'application/x-www-form-urlencoded',
			'Upgrade-Insecure-Requests': '1',
			'TE': 'Trailers',
			'cookie': cookies,
		},
		body: `signin=1&redir=%2Fssb%2Fredirect%3Fentry_point%3Dworkspace_signin&has_remember=true&crumb=${crumb}&email=${SLACK_USERNAME}&password=${SLACK_PASSWORD}&remember=remember`,
		method: 'POST',
		redirect: 'manual',
		mode: 'cors',
	});

	return response.headers
		.raw()
		['set-cookie'].map((entry) => {
			const parts = entry.split(';');
			return parts[0];
		})
		.join(';');
}

async function retrieveClientToken(cookies) {
	const response = await fetch('https://app.slack.com/auth?app=client&teams=&iframe=1', {
		credentials: 'include',
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:78.0) Gecko/20100101 Firefox/78.0',
			'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
			'Accept-Language': 'en-US,en;q=0.5',
			'Upgrade-Insecure-Requests': '1',
			'Cache-Control': 'max-age=0',
			'TE': 'Trailers',
			'cookie': cookies,
			'Host': 'app.slack.com',
		},
		method: 'GET',
		mode: 'cors',
	});
	const body = await response.text();

	return querystring.escape(/"token":"(.*?)"/g.exec(body)[1]);
}

async function doBulkInvite(emails, token, cookies) {
	const invites = emails.map((Email) => ({
		email: Email,
		mode: 'manual',
		type: 'regular',
	}));
	const form = new FormData();
	form.append('invites', JSON.stringify(invites));
	form.append('token', token);
	form.append('source', 'invite-modal');
	form.append('campaign', 'team-menu');
	form.append('mode', 'manual');
	form.append('restricted', 'false');
	form.append('ultra_restricted', 'false');
	form.append('email_password_policy_enabled', 'false');
	form.append('_x_reason', 'invite_bulk');
	form.append('_x_mode', 'online');
	form.append('_x_sonic', 'true');

	await fetch(`https://${SLACK_WORKSPACE}/api/users.admin.inviteBulk`, {
		credentials: 'include',
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:78.0) Gecko/20100101 Firefox/78.0',
			'Accept': '*/*',
			'Accept-Language': 'en-US,en;q=0.5',
			'Pragma': 'no-cache',
			'Cache-Control': 'no-cache',
			'Host': 'app.slack.com',
			'Origin': 'https://app.slack.com',
			'cookie': cookies,
			'TE': 'Trailers',
		},
		body: form,
		method: 'POST',
		mode: 'cors',
	});
}
