jest.mock('node-fetch');

const { Response } = jest.requireActual('node-fetch');

describe('action network service', () => {
	const OLD_ENV = process.env;
	let mockSuccessResponse;
	let ActionNetworkService;
	let fetch;

	beforeEach(() => {
		process.env = {
			...OLD_ENV,
			ACTION_NETWORK_API_TOKEN: 'fake-token',
		};

		fetch = require('node-fetch');
		ActionNetworkService = require('./action-network.service');

		mockSuccessResponse = new Response(JSON.stringify({ data: {} }), {
			status: 200,
			statusText: 'ok',
		});
	});

	afterAll(() => {
		process.env = OLD_ENV;
	});

	it('should map all Action Kit fields to OSDI person fields', async () => {
		const mockActionKitMember = {
			last_name: 'debs',
			first_name: 'eugene',
			Email: 'eugene.v.debs@iww.org',
			Mailing_Address1: '123 Broad St.',
			Mailing_Address2: 'Woodstock Jail cell block A',
			Mailing_City: 'Woodstock',
			Mailing_State: 'IL',
			Mailing_Zip: '60098',
			Billing_Address_Line_1: '4321 Main St.',
			Billing_Address_Line_2: 'apt B',
			Billing_City: 'Terre Haute',
			Billing_State: 'IN',
			Billing_Zip: '47801',
			Mobile_Phone: '8121231234',
			Home_Phone: '8123214321',
			Work_Phone: '8121111111',
			foo: 'bar',
		};

		const expectedActionNetworkPerson = {
			person: {
				family_name: 'debs',
				given_name: 'eugene',
				postal_addresses: [
					{
						address_lines: ['123 Broad St.', 'Woodstock Jail cell block A'],
						locality: 'Woodstock',
						region: 'IL',
						postal_code: '60098',
					},
					{
						address_lines: ['4321 Main St.', 'apt B'],
						locality: 'Terre Haute',
						region: 'IN',
						postal_code: '47801',
					},
				],
				phone_numbers: [{ number: '8121231234' }, { number: '8123214321' }, { number: '8121111111' }],
				email_addresses: [{ address: 'eugene.v.debs@iww.org' }],
				custom_fields: {
					foo: 'bar',
					Mobile_Phone: '8121231234',
					Home_Phone: '8123214321',
					Work_Phone: '8121111111',
				},
			},
		};
		fetch.mockResolvedValue(Promise.resolve(mockSuccessResponse));

		await ActionNetworkService.updateMembers([mockActionKitMember]);

		expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(expectedActionNetworkPerson);
	});

	it('should consolidate phone numbers', async () => {
		const expectedActionNetworkPhoneNumbers = [{ number: '8121231234' }, { number: '8123214321' }];
		fetch.mockResolvedValue(Promise.resolve(mockSuccessResponse));

		await ActionNetworkService.updateMembers([{ Mobile_Phone: '8121231234,8123214321' }]);
		await ActionNetworkService.updateMembers([{ Home_Phone: '8121231234,8123214321' }]);
		await ActionNetworkService.updateMembers([{ Work_Phone: '8121231234,8123214321' }]);

		const requests = fetch.mock.calls;
		expect(JSON.parse(requests[0][1].body).person.phone_numbers).toEqual(expectedActionNetworkPhoneNumbers);
		expect(JSON.parse(requests[1][1].body).person.phone_numbers).toEqual(expectedActionNetworkPhoneNumbers);
		expect(JSON.parse(requests[2][1].body).person.phone_numbers).toEqual(expectedActionNetworkPhoneNumbers);
	});

	it('should ignore address line 2 if empty', async () => {
		const mockActionKitMember = {
			Mailing_Address1: '123 Broad St.',
			Mailing_City: 'Woodstock',
			Mailing_State: 'IL',
			Mailing_Zip: '60098',
			Billing_Address_Line_1: '4321 Main St.',
			Billing_City: 'Terre Haute',
			Billing_State: 'IN',
			Billing_Zip: '47801',
		};

		const expectedActionNetworkAddresses = [
			{
				address_lines: ['123 Broad St.'],
				locality: 'Woodstock',
				region: 'IL',
				postal_code: '60098',
			},
			{
				address_lines: ['4321 Main St.'],
				locality: 'Terre Haute',
				region: 'IN',
				postal_code: '47801',
			},
		];
		fetch.mockResolvedValue(Promise.resolve(mockSuccessResponse));

		await ActionNetworkService.updateMembers([mockActionKitMember]);

		expect(JSON.parse(fetch.mock.calls[0][1].body).person.postal_addresses).toEqual(expectedActionNetworkAddresses);
	});

	it('should ignore mailing address if it is empty', async () => {
		const mockActionKitMember = {
			Billing_Address_Line_1: '4321 Main St.',
			Billing_City: 'Terre Haute',
			Billing_State: 'IN',
			Billing_Zip: '47801',
		};
		const expectedActionNetworkAddresses = [
			{
				address_lines: ['4321 Main St.'],
				locality: 'Terre Haute',
				region: 'IN',
				postal_code: '47801',
			},
		];
		fetch.mockResolvedValue(Promise.resolve(mockSuccessResponse));

		await ActionNetworkService.updateMembers([mockActionKitMember]);

		expect(JSON.parse(fetch.mock.calls[0][1].body).person.postal_addresses).toEqual(expectedActionNetworkAddresses);
	});

	it('should make a valid action network api request', async () => {
		const expectedActionNetworkRequest = {
			body: JSON.stringify({
				person: {
					postal_addresses: [],
					phone_numbers: [],
					email_addresses: [{}],
					custom_fields: {
						foo: 'bar',
					},
				},
			}),
			headers: {
				'Content-Type': 'application/json',
				'OSDI-API-Token': 'fake-token',
			},
			method: 'POST',
		};
		fetch.mockResolvedValue(Promise.resolve(mockSuccessResponse));

		await ActionNetworkService.updateMembers([{ foo: 'bar' }]);

		expect(fetch).toHaveBeenCalledWith('https://actionnetwork.org/api/v2/people/', expectedActionNetworkRequest);
	});

	it('should throw an error is there is an api error', async () => {
		fetch.mockResolvedValue(
			Promise.resolve(
				new Response('', {
					status: 400,
					statusText: 'error',
				})
			)
		);

		let errorMessage = '';
		try {
			await ActionNetworkService.updateMembers([{ AK_ID: '1234' }]);
		} catch (err) {
			errorMessage = err.message;
		}
		expect(errorMessage).toEqual('PromisePoolError: Error creating person with AK_ID=1234 - error');
	});
});
