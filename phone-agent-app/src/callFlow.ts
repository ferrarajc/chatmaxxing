// Lightweight intent classification over the agent's recognized speech, used to branch the
// simulated callback conversation. Keyword heuristics — good enough for a demo where the agent
// knows the expected responses; defaults in the script lean toward the cooperative path.

const norm = (t: string) => ` ${t.toLowerCase()} `;
const any = (t: string, words: string[]) => words.some(w => t.includes(w));

export function isOptOut(t: string): boolean {
  return any(norm(t), ['stop calling', "don't call", 'do not call', 'remove me', 'remove my number', 'take me off', 'unsubscribe', 'opt out', 'stop contacting', 'no more calls']);
}

export function isWrongParty(t: string, firstName: string): boolean {
  void firstName;
  const n = norm(t);
  return any(n, ['wrong number', 'not here', "isn't here", "isn't home", 'no one by', 'nobody', "doesn't live", 'no longer', "you've got the wrong", "you have the wrong", 'this is not', "this isn't", 'no this is', ' nope ', ' no, ', ' no. ']);
}

export function isQuestionWhy(t: string): boolean {
  return any(norm(t), ['why are you', 'why is', 'who is this', 'who are you', "what's this", 'what is this', 'what do you want', 'what are you calling', 'is this a scam', 'is this real']);
}

export function isAvailableNo(t: string): boolean {
  return any(norm(t), ['not here', 'not available', "isn't here", "isn't available", "can't come", 'no longer', 'wrong number', 'no one', 'not home', "they're out", "he's out", "she's out", 'not in', " no ", 'nope', 'unavailable']);
}

export function isAvailableYes(t: string): boolean {
  return any(norm(t), ['hold on', 'one moment', 'one sec', 'just a', 'let me get', "i'll get", 'hang on', 'get them', 'get him', 'get her', ' yes ', ' sure ', ' yeah ', 'hold please', 'i can get', 'right here', 'speaking', 'one minute', 'go get']);
}

/** Did the new person state their own identity (e.g. "This is Alex")? */
export function statesName(t: string, firstName: string): boolean {
  const n = norm(t);
  return n.includes('this is') || n.includes('speaking') || (!!firstName && n.includes(firstName.toLowerCase()));
}

export function isPassphrase(t: string): boolean {
  const n = norm(t);
  return n.includes('password') || n.includes('voice is my') || (n.includes('voice') && n.includes("bob"));
}

export function isBadTime(t: string): boolean {
  return any(norm(t), ['not a good time', 'bad time', ' later', 'call back', 'call me back', 'not now', "can't talk", "can't right now", ' busy', 'another time', 'in a meeting', 'not really a good', 'some other time', 'catch me later']);
}
