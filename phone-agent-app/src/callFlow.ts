// Lightweight intent classification over the agent's recognized speech, used to branch the
// simulated callback conversation. Keyword heuristics — good enough for a demo where the agent
// knows the expected responses; defaults in the script lean toward the cooperative path.

const norm = (t: string) => ` ${t.toLowerCase()} `;
const any = (t: string, words: string[]) => words.some(w => t.includes(w));

export function isOptOut(t: string): boolean {
  return any(norm(t), ['stop calling', "don't call", 'do not call', 'do-not-call', 'remove me', 'remove my number', 'remove this number', 'take me off', 'take my name off', 'unsubscribe', 'opt out', 'opt-out', 'stop contacting', 'no more calls', 'stop the calls', 'not interested', "don't contact"]);
}

export function isWrongParty(t: string, firstName: string): boolean {
  void firstName;
  const n = norm(t);
  return any(n, ['wrong number', 'wrong person', 'not here', "isn't here", "isn't home", "he's not", "she's not", "they're not", "he isn't", "she isn't", 'no one by', 'no one named', 'no one here', 'nobody', "doesn't live", 'no longer', "you've got the wrong", "you have the wrong", 'this is not', "this isn't", "that's not me", 'no this is', 'her husband', 'his wife', 'her son', 'his son', 'her daughter', 'speaking for', 'on behalf', ' nope ', ' no, ', ' no. ']);
}

/** A clear "yes, you've got the right person" answer to "Am I speaking with X?". */
export function isAffirmative(t: string, firstName: string): boolean {
  const n = norm(t);
  if (any(n, ['speaking', 'this is', "that's me", 'thats me', "that's right", 'correct', ' yes', ' yeah', ' yep', ' yup', 'uh huh', 'mm hmm', 'sure is', 'you are', 'go ahead', 'this is she', 'this is he'])) return true;
  return !!firstName && n.includes(firstName.toLowerCase());
}

/** A clear "no / not me" answer (used to route to the wrong-party branch). */
export function isNegative(t: string): boolean {
  return any(norm(t), [' no ', ' no,', ' no.', ' nope', ' nah ', "i'm not", 'i am not', "that's not", 'not me', 'not him', 'not her', 'wrong']);
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
  return any(norm(t), ['not a good time', 'not a great time', 'bad time', ' later', 'call back', 'call me back', 'not now', "can't talk", "can't right now", "can't really talk", ' busy', 'another time', 'another day', 'some other time', 'in a meeting', 'in the middle of', 'not really a good', 'catch me later', 'reschedule', 'driving', 'at work', 'step out', 'tomorrow', 'next week']);
}
