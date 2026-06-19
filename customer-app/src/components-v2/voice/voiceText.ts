// Turn the bot's rich markdown answer into clean text for speech: drop links and markdown
// marks, collapse whitespace, and keep it to a few sentences so the spoken reply stays
// snappy. The full reply is still shown on screen / in the chat transcript.

export function firstSentences(text: string, n: number): string {
  const parts = text.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g);
  if (!parts) return text;
  return parts.slice(0, n).join(' ').trim();
}

export function toSpeakable(md: string): string {
  let t = md ?? '';
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // [label](url) -> label
  t = t.replace(/https?:\/\/\S+/g, '');          // bare URLs
  t = t.replace(/[*_#`>]/g, '');                  // emphasis / heading / quote / code marks
  t = t.replace(/^\s*[-•]\s*/gm, '');             // list bullets
  t = t.replace(/\s+/g, ' ').trim();              // collapse whitespace
  return firstSentences(t, 4);
}
