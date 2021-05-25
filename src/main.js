const GmailService = require('./gmail.service');
const ActionNetworkService = require('./action-network.service');
const SlackService = require('./slack.service');
const cron = require('node-cron');

async function ingestNewMembers() {
	try {
		const actionKitMemberList = await GmailService.retrieveMemberList();
		const newMemberEmails = await ActionNetworkService.updateMembers(actionKitMemberList);
		await SlackService.inviteUsersToSlackWorkspace(newMemberEmails);
	} catch (err) {
		console.log(err);
	}
}
cron.schedule('0 9 * * TUE', async () => {
	await ingestNewMembers();
});
