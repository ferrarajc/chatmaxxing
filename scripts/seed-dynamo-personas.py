"""Seed DynamoDB bobs-clients table with missing persona profiles."""
import boto3

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table = dynamodb.Table('bobs-clients')

personas = [
    {
        'clientId': 'demo-client-002',
        'name': 'Maria Chen',
        'phone': '6175550192',
        'totalBalance': 890000,
        'accounts': [
            {'type': 'Traditional IRA', 'balance': 612000, 'id': 'acc-201'},
            {'type': 'Taxable Account', 'balance': 278000, 'id': 'acc-202'},
        ],
        'recentChatHistory': [
            {'date': '2025-04-10', 'topic': 'RMD distribution', 'summary': 'Asked about this year\'s required minimum distribution from Traditional IRA'},
            {'date': '2025-03-15', 'topic': 'Bond fund performance', 'summary': 'Asked about BobsFunds Bond Income 1-year returns'},
        ],
    },
    {
        'clientId': 'demo-client-003',
        'name': 'Jordan Williams',
        'phone': '5035550847',
        'totalBalance': 23300,
        'accounts': [
            {'type': 'Roth IRA', 'balance': 18500, 'id': 'acc-301'},
            {'type': 'Taxable Account', 'balance': 4800, 'id': 'acc-302'},
        ],
        'recentChatHistory': [
            {'date': '2025-04-01', 'topic': 'Roth IRA contribution', 'summary': 'Asked about 2025 Roth IRA contribution limits'},
            {'date': '2025-03-28', 'topic': 'ESG funds', 'summary': 'Asked about BobsFunds ESG Leaders performance and expense ratio'},
        ],
    },
    {
        'clientId': 'demo-client-004',
        'name': 'Robert Martinez',
        'phone': '7135550234',
        'totalBalance': 445000,
        'accounts': [
            {'type': 'SEP-IRA', 'balance': 285000, 'id': 'acc-401'},
            {'type': 'Roth IRA', 'balance': 42000, 'id': 'acc-402'},
            {'type': 'Taxable Account', 'balance': 118000, 'id': 'acc-403'},
        ],
        'recentChatHistory': [
            {'date': '2025-04-10', 'topic': 'SEP-IRA contribution limits', 'summary': 'Asked about 2025 SEP-IRA contribution limits for self-employed'},
            {'date': '2025-03-28', 'topic': 'Bond fund allocation', 'summary': 'Asked about rebalancing between BobsFunds 500 Index and Bond Income'},
        ],
    },
]

for persona in personas:
    response = table.put_item(Item=persona)
    status = response['ResponseMetadata']['HTTPStatusCode']
    print(f"Seeded {persona['clientId']} ({persona['name']}): HTTP {status}")

print("Done.")
