// Invoked by the Amazon Connect outbound-callback IVR flow to verify the caller entered
// the correct verification code. Amazon Connect can't compare two dynamic values natively,
// so the flow hands us both (the expected code from the callback's contact attributes and
// the digits the caller keyed in) and we return the match. Connect's Lambda contract
// requires a FLAT object of string values back.

interface ConnectEvent {
  Details?: { Parameters?: Record<string, string> };
}

export const handler = async (event: ConnectEvent): Promise<{ matched: string }> => {
  const p = event.Details?.Parameters ?? {};
  const expected = (p.expectedCode ?? '').replace(/\D/g, '');
  const entered = (p.enteredCode ?? '').replace(/\D/g, '');
  const matched = expected.length === 4 && entered === expected;
  return { matched: matched ? 'true' : 'false' };
};
