const fetch = require('node-fetch');
const PromisePool = require('@supercharge/promise-pool');
const dayjs = require('dayjs');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const ACTION_NETWORK_API_TOKEN = process.env.ACTION_NETWORK_API_TOKEN;

exports.updateMembers = async (actionKitMemberList) => {
	const actionNetworkMemberList = mapActionKitListToActionNetworkPeople(actionKitMemberList);

	const { errors } = await PromisePool.for(actionNetworkMemberList).process(async (person) => {
		let res = await fetch(`https://actionnetwork.org/api/v2/people/`, {
			headers: {
				'Content-Type': 'application/json',
				'OSDI-API-Token': ACTION_NETWORK_API_TOKEN,
			},
			method: 'POST',
			body: JSON.stringify({
				person: person,
			}),
		});
		if (!res.ok) {
			const error = `Error creating person with AK_ID=${person?.custom_fields?.AK_ID} - ${res.statusText}`;
			throw new Error(error);
		}
	});

	if (errors.length > 0) throw new Error(errors);

	return actionKitMemberList
		.filter(({ Join_Date }) => {
			return dayjs(Join_Date).isSameOrAfter(dayjs().subtract(8, 'days').startOf('day'));
		})
		.map(({ Email }) => {
			return Email;
		});
};

function mapActionKitListToActionNetworkPeople(actionKitMemberList) {
	return actionKitMemberList
		.map(({ Mobile_Phone, Home_Phone, Work_Phone, ...rest }) => ({
			consolidatedNumbers: [
				...(Mobile_Phone ? Mobile_Phone.split(',') : []),
				...(Home_Phone ? Home_Phone.split(',') : []),
				...(Work_Phone ? Work_Phone.split(',') : []),
			].map((number) => ({ number: number })),
			...rest,
			Mobile_Phone,
			Home_Phone,
			Work_Phone,
		}))
		.map(
			({
				last_name,
				first_name,
				Email,
				Mailing_Address1,
				Mailing_Address2,
				Mailing_City,
				Mailing_State,
				Mailing_Zip,
				Billing_Address_Line_1,
				Billing_Address_Line_2,
				Billing_City,
				Billing_State,
				Billing_Zip,
				consolidatedNumbers,
				...custom_fields
			}) => ({
				family_name: last_name,
				given_name: first_name,
				postal_addresses: [
					...(Mailing_Address1
						? [
								{
									address_lines: [Mailing_Address1, ...(Mailing_Address2 ? [Mailing_Address2] : [])],
									locality: Mailing_City,
									region: Mailing_State,
									postal_code: Mailing_Zip,
								},
						  ]
						: []),
					...(Billing_Address_Line_1
						? [
								{
									address_lines: [Billing_Address_Line_1, ...(Billing_Address_Line_2 ? [Billing_Address_Line_2] : [])],
									locality: Billing_City,
									region: Billing_State,
									postal_code: Billing_Zip,
								},
						  ]
						: []),
				],
				phone_numbers: consolidatedNumbers,
				email_addresses: [{ address: Email }],
				custom_fields: { ...custom_fields },
			})
		);
}
