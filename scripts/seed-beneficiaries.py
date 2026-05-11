"""Seed default beneficiaries for all IRA accounts into bobs-clients DynamoDB table."""
import boto3

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table = dynamodb.Table('bobs-clients')

defaults = {
    'demo-client-001': [
        {'accountId': 'acc-001', 'name': 'Sarah Johnson',   'relationship': 'Spouse',  'percentage': 100, 'type': 'Primary'},
        {'accountId': 'acc-002', 'name': 'Sarah Johnson',   'relationship': 'Spouse',  'percentage': 70,  'type': 'Primary'},
        {'accountId': 'acc-002', 'name': 'Michael Johnson', 'relationship': 'Son',     'percentage': 30,  'type': 'Primary'},
    ],
    'demo-client-002': [],
    'demo-client-003': [
        {'accountId': 'acc-301', 'name': 'Casey Williams', 'relationship': 'Sibling', 'percentage': 100, 'type': 'Primary'},
        {'accountId': 'acc-301', 'name': 'Pat Williams',   'relationship': 'Parent',  'percentage': 100, 'type': 'Secondary'},
    ],
    'demo-client-004': [
        {'accountId': 'acc-401', 'name': 'Elena Martinez', 'relationship': 'Spouse', 'percentage': 100, 'type': 'Primary'},
    ],
}

for client_id, bens in defaults.items():
    response = table.update_item(
        Key={'clientId': client_id},
        UpdateExpression='SET beneficiaries = :v',
        ExpressionAttributeValues={':v': bens},
    )
    status = response['ResponseMetadata']['HTTPStatusCode']
    count = len(bens)
    print(f"Seeded {client_id}: {count} beneficiar{'y' if count == 1 else 'ies'} — HTTP {status}")

print("Done.")
