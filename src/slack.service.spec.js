jest.mock('node-fetch');

const { Response } = jest.requireActual('node-fetch');

describe('slack service', () => {
	const OLD_ENV = process.env;
	let SlackService;
	let fetch;
	let mockFormAppend;

	beforeEach(() => {
		mockFormAppend = jest.fn();
		jest.mock('form-data', () => {
			return jest.fn().mockImplementation(() => {
				return { append: mockFormAppend };
			});
		});
		process.env = {
			...OLD_ENV,
			SLACK_WORKSPACE: 'slack-workspace',
			SLACK_USERNAME: 'slack-username',
			SLACK_PASSWORD: 'slack-password',
		};
		fetch = require('node-fetch');
		SlackService = require('./slack.service');

		fetch.mockResolvedValue({
			headers: {
				raw: () => {
					return { 'set-cookie': ['f=foo;b=bar'] };
				},
			},
			text: jest.fn().mockResolvedValue('crumbValue&quot;:&quot;aCrumb&"token":"aToken"'),
		});
	});

	afterAll(() => {
		process.env = OLD_ENV;
	});

	it('should make the correct entry point request', async () => {
		await SlackService.inviteUsersToSlackWorkspace([]);

		expect(fetch.mock.calls[0][0]).toEqual('https://slack-workspace/');
	});

	it('should make the correct sign in request', async () => {
		await SlackService.inviteUsersToSlackWorkspace([]);

		expect(fetch.mock.calls[1][0]).toEqual('https://slack-workspace/?redir=/ssb/redirect?entry_point=workspace_signin');
		expect(fetch.mock.calls[1][1].headers.Host).toEqual('slack-workspace');
		expect(fetch.mock.calls[1][1].headers.cookie).toEqual('f=foo');
		expect(fetch.mock.calls[1][1].body).toEqual(
			'signin=1&redir=%2Fssb%2Fredirect%3Fentry_point%3Dworkspace_signin&has_remember=true&crumb=aCrumb&email=slack-username&password=slack-password&remember=remember'
		);
	});

	it('should make the correct client token request', async () => {
		await SlackService.inviteUsersToSlackWorkspace([]);

		expect(fetch.mock.calls[2][0]).toEqual('https://app.slack.com/auth?app=client&teams=&iframe=1');
		expect(fetch.mock.calls[2][1].headers.cookie).toEqual('f=foo');
	});

	it('should make the correct bulk invite request', async () => {
		await SlackService.inviteUsersToSlackWorkspace(['test1@example.com', 'test2@example.com']);

		expect(fetch.mock.calls[3][0]).toEqual('https://slack-workspace/api/users.admin.inviteBulk');
		expect(fetch.mock.calls[2][1].headers.cookie).toEqual('f=foo');
		expect(mockFormAppend.mock.calls[0]).toEqual([
			'invites',
			JSON.stringify([
				{ email: 'test1@example.com', mode: 'manual', type: 'regular' },
				{ email: 'test2@example.com', mode: 'manual', type: 'regular' },
			]),
		]);
		expect(mockFormAppend.mock.calls[1]).toEqual(['token', 'aToken']);
	});
});
