const { google } = require('googleapis');
const parse = require('csv-parse/lib/sync');
const dayjs = require('dayjs');
const AdmZip = require('adm-zip');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const GOOGLE_ACCESS_TOKEN = process.env.GOOGLE_ACCESS_TOKEN;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

exports.retrieveMemberList = async () => {
	const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
	auth.setCredentials({
		access_token: GOOGLE_ACCESS_TOKEN,
		refresh_token: GOOGLE_REFRESH_TOKEN,
	});
	const gmail = google.gmail({ version: 'v1', auth }).users.messages;

	let res = await gmail.list({
		userId: 'me',
		q: `subject:"Atlanta Membership List" AND has:attachment AND after:${dayjs()
			.subtract(1, 'days')
			.startOf('day')
			.format('MM/DD/YYYY')}`,
	});
	if (res.data.resultSizeEstimate !== 1)
		throw new Error(`Gmail Error: Expected one email but found ${res.data.resultSizeEstimate}`);
	const messageId = res.data.messages[0].id;
	res = await gmail.get({
		userId: 'me',
		id: messageId,
	});
	const attachmentId = getZipAttachmentIdFromMessage(res.data.payload);
	if (!attachmentId) throw new Error('Gmail Error: Unable to find member csv attachment');
	res = await gmail.attachments.get({
		userId: 'me',
		messageId,
		id: attachmentId,
	});
	return parse(unzipFile(Buffer.from(res.data.data, 'base64')), {
		columns: true,
		skip_empty_lines: true,
	});
};

function getZipAttachmentIdFromMessage(message) {
	const zip = message.parts.find((part) => part.mimeType === 'application/x-zip-compressed');
	message = message.parts.find((part) => part.mimeType === 'multipart/mixed');
	if (zip) {
		return zip.body.attachmentId;
	} else if (message) {
		return getZipAttachmentIdFromMessage(message);
	}
}

function unzipFile(data) {
	const zip = new AdmZip(data);
	return zip.getEntries()[0].getData().toString('utf8');
}
