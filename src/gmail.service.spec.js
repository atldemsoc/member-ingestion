const dayjs = require('dayjs');

describe('gmail service', () => {
	const OLD_ENV = process.env;
	let google;
	let GmailService;
	let mockSetCredentials;
	let mockList;
	let mockGet;
	let mockAttachmentsGet;

	beforeEach(() => {
		process.env = {
			...OLD_ENV,
			GOOGLE_CLIENT_ID: 'client-id',
			GOOGLE_CLIENT_SECRET: 'client-secret',
			GOOGLE_REDIRECT_URI: 'redirect-uri',
			GOOGLE_ACCESS_TOKEN: 'access-token',
			GOOGLE_REFRESH_TOKEN: 'refresh-token',
		};

		jest.mock('adm-zip', () => {
			return jest.fn().mockImplementation(() => {
				return {
					getEntries: jest.fn().mockReturnValue([
						{
							getData: () => {
								return 'col1,col2\nval1,val2';
							},
						},
					]),
				};
			});
		});

		mockSetCredentials = jest.fn();
		mockList = jest.fn().mockResolvedValue({
			data: { resultSizeEstimate: 1, messages: [{ id: 'foo' }] },
		});
		mockGet = jest.fn().mockResolvedValue({
			data: {
				payload: {
					parts: [
						{},
						{
							mimeType: 'application/x-zip-compressed',
							body: { attachmentId: 'bar' },
						},
					],
				},
			},
		});
		mockAttachmentsGet = jest.fn().mockResolvedValue({
			data: {
				data: Buffer.from('col1,col2\nval1,val2', 'utf-8').toString('base64'),
			},
		});
		jest.mock('googleapis', () => {
			return {
				google: {
					auth: {
						OAuth2: jest.fn().mockImplementation(() => {
							return { setCredentials: mockSetCredentials };
						}),
					},
					gmail: jest.fn().mockReturnValue({
						users: {
							messages: {
								list: mockList,
								get: mockGet,
								attachments: {
									get: mockAttachmentsGet,
								},
							},
						},
					}),
				},
			};
		});
		google = require('googleapis').google;
		GmailService = require('./gmail.service');
	});

	afterAll(() => {
		process.env = OLD_ENV;
	});

	it('should initialize the gmail client with the correct auth', async () => {
		await GmailService.retrieveMemberList();

		expect(google.auth.OAuth2).toHaveBeenCalledWith('client-id', 'client-secret', 'redirect-uri');
		expect(mockSetCredentials).toHaveBeenCalledWith({
			access_token: 'access-token',
			refresh_token: 'refresh-token',
		});
	});

	it('should make the correct query to retrieve the member list email', async () => {
		await GmailService.retrieveMemberList();

		const yesterdaysDate = dayjs().subtract(1, 'days').startOf('day').format('MM/DD/YYYY');
		expect(mockList).toHaveBeenCalledWith({
			userId: 'me',
			q: `subject:"Atlanta Membership List" AND has:attachment AND after:${yesterdaysDate}`,
		});
	});

	it('should throw an error if no email is found', async () => {
		mockList.mockReset();
		mockList.mockResolvedValue({
			data: { resultSizeEstimate: 0 },
		});

		let errorMessage = '';
		try {
			await GmailService.retrieveMemberList();
		} catch (err) {
			errorMessage = err.message;
		}

		expect(errorMessage).toEqual('Gmail Error: Expected one email but found 0');
	});

	it('should make the correct request to retrieve the member list attachment metadata', async () => {
		await GmailService.retrieveMemberList();

		expect(mockGet).toHaveBeenCalledWith({
			userId: 'me',
			id: 'foo',
		});
	});

	it('should make the correct request to retrieve the member list attachment data', async () => {
		await GmailService.retrieveMemberList();

		expect(mockAttachmentsGet).toHaveBeenCalledWith({
			userId: 'me',
			messageId: 'foo',
			id: 'bar',
		});
	});

	it('should parse the attachment into a spreadsheet', async () => {
		const memberList = await GmailService.retrieveMemberList();

		expect(memberList).toEqual([
			{
				col1: 'val1',
				col2: 'val2',
			},
		]);
	});

	it('should find the nested attachment if the parent message has no zip attachments', async () => {
		mockGet.mockReset();
		mockGet.mockResolvedValue({
			data: {
				payload: {
					parts: [
						{
							mimeType: 'multipart/mixed',
							parts: [
								{
									mimeType: 'application/x-zip-compressed',
									body: { attachmentId: 'bar' },
								},
							],
						},
					],
				},
			},
		});
		await GmailService.retrieveMemberList();

		expect(mockAttachmentsGet).toHaveBeenCalledWith({
			userId: 'me',
			messageId: 'foo',
			id: 'bar',
		});
	});

	it('should throw an error when no attachment is found', async () => {
		mockGet.mockReset();
		mockGet.mockResolvedValue({
			data: {
				payload: {
					parts: [],
				},
			},
		});

		let errorMessage = '';
		try {
			await GmailService.retrieveMemberList();
		} catch (err) {
			errorMessage = err.message;
		}

		expect(errorMessage).toEqual('Gmail Error: Unable to find member csv attachment');
	});
});
